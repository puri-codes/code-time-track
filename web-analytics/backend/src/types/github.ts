export type TimelineType = 'commit' | 'push' | 'pull_request';
export type PullRequestAction = 'created' | 'merged' | 'closed';

export interface TimelineItem {
  id: string;
  type: TimelineType;
  timestamp: string;
  author?: string;
  branch?: string;
  message?: string;
  title?: string;
  action?: PullRequestAction;
  count?: number;
}

export interface GitHubAnalyticsResponse {
  repo: {
    owner: string;
    name: string;
    fullName: string;
    url: string;
    defaultBranch: string;
    createdAt: string;
  };
  overview: {
    repoCreatedDate: string;
    totalCommits: number;
    totalPullRequests: number;
    activeBranches: number;
    totalPushes: number;
  };
  charts: {
    commitFrequency: Array<{ date: string; count: number }>;
    pushActivity: Array<{ date: string; pushes: number; commitCount: number; source: 'events' | 'fallback_commits' }>;
    pullRequestLifecycle: Array<{ date: string; created: number; merged: number; closed: number }>;
  };
  timeline: TimelineItem[];
  branches: Array<{ name: string; protected: boolean; lastCommitAt?: string; isDefault: boolean }>;
}

