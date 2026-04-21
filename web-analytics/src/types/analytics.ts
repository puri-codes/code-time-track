export type TimelineItemType = 'commit' | 'push' | 'pull_request';
export type PullRequestAction = 'created' | 'merged' | 'closed';

export interface GitHubTimelineItem {
  id: string;
  type: TimelineItemType;
  timestamp: string;
  author?: string;
  branch?: string;
  message?: string;
  title?: string;
  action?: PullRequestAction;
  count?: number;
}

export interface GitHubAnalytics {
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
  timeline: GitHubTimelineItem[];
  branches: Array<{ name: string; protected: boolean; lastCommitAt?: string; isDefault: boolean }>;
}

export interface ExtensionAnalytics {
  summary: {
    todayCodingTime: {
      formatted: string;
      description: string;
      progress: number;
    };
    currentSession: {
      duration: string;
      status: string;
      description: string;
      isActive: boolean;
      statusClass: string;
    };
    projectTracking: {
      idle: string;
      description: string;
      totalTracked: string;
      active: string;
      startTime: string;
    };
    productivity: {
      score: number;
      description: string;
      insights: Array<{ type: 'productive' | 'focus' | 'idle'; icon: string; text: string }>;
      chartData: {
        labels: string[];
        data: number[];
      };
    };
  };
  folderAnalytics: Array<{
    name: string;
    fullPath: string;
    time: string;
    isCurrent: boolean;
  }>;
  eventDistribution: Array<{ eventType: string; count: number }>;
  timeline: Array<{
    id: string;
    eventType: string;
    timestamp: number;
    repository?: string;
    folder?: string;
    file?: string;
    branch?: string;
  }>;
  rawCount: number;
  context?: {
    projectId?: string;
    repository?: string;
    workspaceName?: string;
  };
}

export interface ComparisonAnalytics {
  repository: {
    fullName: string;
    owner: string;
    name: string;
    defaultBranch: string;
    lastAnalyzedAt: string;
  } | null;
  githubTotals: {
    commits: number;
    pushes: number;
    prsCreated: number;
  };
  extensionTotals: {
    events: number;
    activeDurationMs: number;
  };
  projects: Array<{
    projectId: string;
    workspaceName: string;
    repositoryName: string;
    lastSeenAt: string;
    eventCount: number;
    activeDurationMs: number;
    latestEventMs: number;
  }>;
}

