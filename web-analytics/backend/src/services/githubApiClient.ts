import { env } from '../config/env.js';

const BASE_URL = 'https://api.github.com';

export class GitHubApiError extends Error {
  public readonly status: number;
  public readonly rateLimited: boolean;
  public readonly resetAt?: string;

  constructor(message: string, status: number, rateLimited = false, resetAt?: string) {
    super(message);
    this.status = status;
    this.rateLimited = rateLimited;
    this.resetAt = resetAt;
  }
}

export class GitHubApiClient {
  private readonly token = env.githubToken;

  private async request<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'web-analytics-dashboard',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
      }
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      const remaining = response.headers.get('x-ratelimit-remaining');
      const resetAtUnix = response.headers.get('x-ratelimit-reset');
      const rateLimited = response.status === 403 && remaining === '0';
      const resetAt = resetAtUnix ? new Date(Number(resetAtUnix) * 1000).toISOString() : undefined;

      throw new GitHubApiError(
        body.message ?? `GitHub request failed with status ${response.status}`,
        response.status,
        rateLimited,
        resetAt
      );
    }

    return (await response.json()) as T;
  }

  public async paginate<T>(
    path: string,
    perPage: number,
    maxPages: number,
    query: Record<string, string | number | undefined> = {}
  ): Promise<T[]> {
    const all: T[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const pageData = await this.request<T[]>(path, {
        ...query,
        per_page: perPage,
        page
      });
      all.push(...pageData);
      if (pageData.length < perPage) {
        break;
      }
    }
    return all;
  }

  public getRepo(owner: string, repo: string) {
    return this.request<{
      full_name: string;
      html_url: string;
      created_at: string;
      default_branch: string;
    }>(`/repos/${owner}/${repo}`);
  }

  public getCommits(owner: string, repo: string, perPage: number, maxPages: number) {
    return this.paginate<{
      sha: string;
      commit: {
        message: string;
        author: { name: string; date: string } | null;
      };
      author: { login: string } | null;
    }>(`/repos/${owner}/${repo}/commits`, perPage, maxPages);
  }

  public getEvents(owner: string, repo: string, perPage: number, maxPages: number) {
    return this.paginate<{
      id: string;
      type: string;
      created_at: string;
      actor?: { login?: string };
      payload?: { ref?: string; commits?: Array<{ sha: string }> };
    }>(`/repos/${owner}/${repo}/events`, perPage, maxPages);
  }

  public getPulls(owner: string, repo: string, perPage: number, maxPages: number) {
    return this.paginate<{
      id: number;
      number: number;
      title: string;
      created_at: string;
      closed_at: string | null;
      merged_at: string | null;
      user?: { login?: string };
      base?: { ref?: string };
    }>(`/repos/${owner}/${repo}/pulls`, perPage, maxPages, { state: 'all', sort: 'updated', direction: 'desc' });
  }

  public getBranches(owner: string, repo: string, perPage: number, maxPages: number) {
    return this.paginate<{
      name: string;
      protected: boolean;
      commit: { sha: string };
    }>(`/repos/${owner}/${repo}/branches`, perPage, maxPages);
  }

  public getCommit(owner: string, repo: string, sha: string) {
    return this.request<{ commit: { author: { date: string } | null; committer: { date: string } | null } }>(
      `/repos/${owner}/${repo}/commits/${sha}`
    );
  }
}

