import { ANALYTICS_CONFIG } from '../config/customConfig.js';
import { GitHubAnalyticsResponse, TimelineItem } from '../types/github.js';
import { dayKey } from '../utils/time.js';
import { GitHubApiClient } from './githubApiClient.js';

export class GitHubAnalyticsService {
  private readonly apiClient = new GitHubApiClient();

  private parseRepository(fullName: string): { owner: string; repo: string } {
    const trimmed = fullName.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(trimmed)) {
      throw new Error('Repository must match owner/repo format.');
    }
    const [owner, repo] = trimmed.split('/');
    return { owner, repo };
  }

  public async analyzeRepository(fullRepositoryName: string): Promise<GitHubAnalyticsResponse> {
    const { owner, repo } = this.parseRepository(fullRepositoryName);
    const { perPage, maxPages, branchCommitLookupsLimit, timelineMaxItems } = ANALYTICS_CONFIG.github;

    const [repoInfo, commits, events, pulls, branches] = await Promise.all([
      this.apiClient.getRepo(owner, repo),
      this.apiClient.getCommits(owner, repo, perPage, maxPages.commits),
      this.apiClient.getEvents(owner, repo, perPage, maxPages.events),
      this.apiClient.getPulls(owner, repo, perPage, maxPages.pulls),
      this.apiClient.getBranches(owner, repo, perPage, maxPages.branches)
    ]);

    const pushEvents = events.filter((event) => event.type === 'PushEvent');

    const commitFrequency = this.groupCommitsByDay(
      commits
        .map((commit) => commit.commit.author?.date)
        .filter((date): date is string => Boolean(date))
    );

    // Push events are capped by GitHub's events API. If empty, we reconstruct activity from commits.
    const pushActivity = pushEvents.length
      ? this.groupPushEvents(pushEvents)
      : this.groupCommitsAsFallbackPushes(
          commits
            .map((commit) => commit.commit.author?.date)
            .filter((date): date is string => Boolean(date))
        );

    const pullRequestLifecycle = this.buildPullRequestLifecycle(pulls);
    // Unified timeline merges commit, push, and PR lifecycle events, then sorts chronologically.
    const timeline = this.buildTimeline(commits, pushEvents, pulls).slice(0, timelineMaxItems);

    const branchesWithCommit = await Promise.all(
      branches.slice(0, branchCommitLookupsLimit).map(async (branch) => {
        try {
          const commit = await this.apiClient.getCommit(owner, repo, branch.commit.sha);
          return {
            name: branch.name,
            protected: branch.protected,
            lastCommitAt: commit.commit.author?.date ?? commit.commit.committer?.date,
            isDefault: repoInfo.default_branch === branch.name
          };
        } catch {
          return {
            name: branch.name,
            protected: branch.protected,
            lastCommitAt: undefined,
            isDefault: repoInfo.default_branch === branch.name
          };
        }
      })
    );

    return {
      repo: {
        owner,
        name: repo,
        fullName: repoInfo.full_name,
        url: repoInfo.html_url,
        defaultBranch: repoInfo.default_branch,
        createdAt: repoInfo.created_at
      },
      overview: {
        repoCreatedDate: repoInfo.created_at,
        totalCommits: commits.length,
        totalPullRequests: pulls.length,
        activeBranches: branches.length,
        totalPushes: pushEvents.length
      },
      charts: {
        commitFrequency,
        pushActivity,
        pullRequestLifecycle
      },
      timeline,
      branches: branchesWithCommit
    };
  }

  private groupCommitsByDay(timestamps: string[]): Array<{ date: string; count: number }> {
    const grouped = new Map<string, number>();
    timestamps.forEach((timestamp) => {
      const key = dayKey(timestamp);
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    });
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }

  private groupCommitsAsFallbackPushes(
    timestamps: string[]
  ): Array<{ date: string; pushes: number; commitCount: number; source: 'fallback_commits' }> {
    const grouped = new Map<string, number>();
    timestamps.forEach((timestamp) => {
      const key = dayKey(timestamp);
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    });
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date,
        pushes: count,
        commitCount: count,
        source: 'fallback_commits'
      }));
  }

  private groupPushEvents(
    pushEvents: Array<{ created_at: string; payload?: { commits?: Array<{ sha: string }> } }>
  ): Array<{ date: string; pushes: number; commitCount: number; source: 'events' }> {
    const grouped = new Map<string, { pushes: number; commitCount: number }>();
    pushEvents.forEach((event) => {
      const key = dayKey(event.created_at);
      const current = grouped.get(key) ?? { pushes: 0, commitCount: 0 };
      current.pushes += 1;
      current.commitCount += event.payload?.commits?.length ?? 0;
      grouped.set(key, current);
    });
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, totals]) => ({
        date,
        pushes: totals.pushes,
        commitCount: totals.commitCount,
        source: 'events'
      }));
  }

  private buildPullRequestLifecycle(
    pulls: Array<{ created_at: string; merged_at: string | null; closed_at: string | null }>
  ): Array<{ date: string; created: number; merged: number; closed: number }> {
    const grouped = new Map<string, { created: number; merged: number; closed: number }>();

    const ensure = (date: string) => {
      if (!grouped.has(date)) {
        grouped.set(date, { created: 0, merged: 0, closed: 0 });
      }
      return grouped.get(date)!;
    };

    pulls.forEach((pull) => {
      ensure(dayKey(pull.created_at)).created += 1;
      if (pull.merged_at) {
        ensure(dayKey(pull.merged_at)).merged += 1;
      } else if (pull.closed_at) {
        ensure(dayKey(pull.closed_at)).closed += 1;
      }
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({
        date,
        ...counts
      }));
  }

  private buildTimeline(
    commits: Array<{
      sha: string;
      commit: { message: string; author: { name: string; date: string } | null };
      author: { login: string } | null;
    }>,
    pushEvents: Array<{
      id: string;
      created_at: string;
      actor?: { login?: string };
      payload?: { ref?: string; commits?: Array<{ sha: string }> };
    }>,
    pulls: Array<{
      id: number;
      number: number;
      title: string;
      created_at: string;
      merged_at: string | null;
      closed_at: string | null;
      user?: { login?: string };
      base?: { ref?: string };
    }>
  ): TimelineItem[] {
    const commitItems: TimelineItem[] = commits
      .filter((commit) => Boolean(commit.commit.author?.date))
      .map((commit) => ({
        id: commit.sha,
        type: 'commit',
        timestamp: commit.commit.author!.date,
        author: commit.author?.login ?? commit.commit.author?.name ?? 'unknown',
        message: commit.commit.message.split('\n')[0]
      }));

    const pushItems: TimelineItem[] = pushEvents.map((event) => ({
      id: event.id,
      type: 'push',
      timestamp: event.created_at,
      author: event.actor?.login,
      branch: event.payload?.ref?.replace('refs/heads/', ''),
      count: event.payload?.commits?.length ?? 0
    }));

    const pullItems: TimelineItem[] = pulls.flatMap((pull) => {
      const base = {
        author: pull.user?.login,
        branch: pull.base?.ref,
        title: `#${pull.number} ${pull.title}`,
        type: 'pull_request' as const
      };
      const items: TimelineItem[] = [
        {
          id: `${pull.id}-created`,
          ...base,
          timestamp: pull.created_at,
          action: 'created'
        }
      ];
      if (pull.merged_at) {
        items.push({
          id: `${pull.id}-merged`,
          ...base,
          timestamp: pull.merged_at,
          action: 'merged'
        });
      } else if (pull.closed_at) {
        items.push({
          id: `${pull.id}-closed`,
          ...base,
          timestamp: pull.closed_at,
          action: 'closed'
        });
      }
      return items;
    });

    return [...commitItems, ...pushItems, ...pullItems].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}
