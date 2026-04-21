export enum ExtensionEventType {
  FILE_EDIT = 'file_edit',
  FILE_OPEN = 'file_open',
  FILE_SAVE = 'file_save',
  TERMINAL_OPEN = 'terminal_open',
  DEBUG_START = 'debug_start',
  GIT_COMMIT = 'git_commit',
  GIT_BRANCH_CHANGE = 'git_branch_change',
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  WINDOW_FOCUS = 'window_focus',
  WINDOW_BLUR = 'window_blur',
  IDLE_START = 'idle_start',
  IDLE_END = 'idle_end'
}

export interface ExtensionEvent {
  id: string;
  userId: string;
  projectId: string;
  repository?: string;
  folder?: string;
  file?: string;
  language?: string;
  eventType: ExtensionEventType;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, unknown>;
  branch?: string;
  commitHash?: string;
  filesChanged?: number;
  linesAdded?: number;
  linesRemoved?: number;
  sessionId?: string;
  activeDuration?: number;
  idle?: boolean;
  idleDuration?: number;
}

export interface ExtensionEventsPayload {
  user_id: string;
  events: ExtensionEvent[];
}

export interface ExtensionInsightItem {
  type: 'productive' | 'idle' | 'focus';
  icon: string;
  text: string;
}

export interface ExtensionAnalyticsResponse {
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
      insights: ExtensionInsightItem[];
      chartData: {
        labels: string[];
        data: number[];
      };
    };
  };
  folderAnalytics: Array<{
    name: string;
    time: string;
    isCurrent: boolean;
    fullPath: string;
  }>;
  eventDistribution: Array<{
    eventType: string;
    count: number;
  }>;
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

