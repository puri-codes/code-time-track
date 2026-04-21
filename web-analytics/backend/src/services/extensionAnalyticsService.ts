import { ANALYTICS_CONFIG } from '../config/customConfig.js';
import { ExtensionAnalyticsResponse, ExtensionEvent, ExtensionEventType, ExtensionInsightItem } from '../types/extension.js';
import { formatDuration } from '../utils/time.js';

type TrackingDurations = {
  activeMs: number;
  idleMs: number;
  totalMs: number;
  startTimestamp?: number;
};

const calculateTrackingDurations = (events: ExtensionEvent[], now: number): TrackingDurations => {
  const sessionStarts = events
    .filter((event) => event.eventType === ExtensionEventType.SESSION_START)
    .sort((a, b) => a.timestamp - b.timestamp);
  const sessionEnds = events
    .filter((event) => event.eventType === ExtensionEventType.SESSION_END)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!sessionStarts.length) {
    return { activeMs: 0, idleMs: 0, totalMs: 0 };
  }

  const endBySession = new Map<string, number>();
  sessionEnds.forEach((endEvent) => {
    if (!endEvent.sessionId) {
      return;
    }
    const existing = endBySession.get(endEvent.sessionId);
    if (existing === undefined || endEvent.timestamp > existing) {
      endBySession.set(endEvent.sessionId, endEvent.timestamp);
    }
  });

  const rawSegments: Array<{ start: number; end: number }> = [];
  sessionStarts.forEach((startEvent) => {
    if (!startEvent.sessionId) {
      return;
    }
    const end = endBySession.get(startEvent.sessionId) ?? now;
    if (end > startEvent.timestamp) {
      rawSegments.push({ start: startEvent.timestamp, end });
    }
  });

  if (!rawSegments.length) {
    return { activeMs: 0, idleMs: 0, totalMs: 0 };
  }

  rawSegments.sort((a, b) => a.start - b.start);
  const mergedSegments: Array<{ start: number; end: number }> = [];
  rawSegments.forEach((segment) => {
    const last = mergedSegments[mergedSegments.length - 1];
    if (!last || segment.start > last.end) {
      mergedSegments.push({ ...segment });
      return;
    }
    last.end = Math.max(last.end, segment.end);
  });

  const stateEvents = events
    .filter((event) =>
      event.eventType === ExtensionEventType.WINDOW_FOCUS ||
      event.eventType === ExtensionEventType.WINDOW_BLUR ||
      event.eventType === ExtensionEventType.IDLE_START ||
      event.eventType === ExtensionEventType.IDLE_END
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  let activeMs = 0;
  let idleMs = 0;

  const applyDelta = (start: number, end: number, focused: boolean, idle: boolean) => {
    const delta = Math.max(0, end - start);
    if (delta === 0) {
      return;
    }

    if (focused && !idle) {
      activeMs += delta;
    } else {
      idleMs += delta;
    }
  };

  mergedSegments.forEach((segment) => {
    let focused = true;
    let idle = false;

    for (const event of stateEvents) {
      if (event.timestamp >= segment.start) {
        break;
      }

      if (event.eventType === ExtensionEventType.WINDOW_FOCUS) {
        focused = true;
      } else if (event.eventType === ExtensionEventType.WINDOW_BLUR) {
        focused = false;
      } else if (event.eventType === ExtensionEventType.IDLE_START) {
        idle = true;
      } else if (event.eventType === ExtensionEventType.IDLE_END) {
        idle = false;
      }
    }

    let cursor = segment.start;
    for (const event of stateEvents) {
      if (event.timestamp < segment.start) {
        continue;
      }
      if (event.timestamp > segment.end) {
        break;
      }

      applyDelta(cursor, event.timestamp, focused, idle);
      cursor = event.timestamp;

      if (event.eventType === ExtensionEventType.WINDOW_FOCUS) {
        focused = true;
      } else if (event.eventType === ExtensionEventType.WINDOW_BLUR) {
        focused = false;
      } else if (event.eventType === ExtensionEventType.IDLE_START) {
        idle = true;
      } else if (event.eventType === ExtensionEventType.IDLE_END) {
        idle = false;
      }
    }

    applyDelta(cursor, segment.end, focused, idle);
  });

  return {
    activeMs,
    idleMs,
    totalMs: Math.max(0, activeMs + idleMs),
    startTimestamp: mergedSegments[0]?.start
  };
};

const calculateTodayCodingTime = (events: ExtensionEvent[], now: number) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  const todayEvents = events.filter((event) => event.timestamp >= todayStart);
  const tracking = calculateTrackingDurations(todayEvents, now);
  const totalCodingTime = tracking.activeMs;
  const sessionCount = new Set(
    todayEvents
      .filter((event) =>
        event.eventType === ExtensionEventType.SESSION_START || event.eventType === ExtensionEventType.SESSION_END
      )
      .map((event) => event.sessionId)
      .filter((sessionId): sessionId is string => Boolean(sessionId))
  ).size;

  const targetMs = 8 * 60 * 60 * 1000;
  const progress = Math.min(100, Math.round((totalCodingTime / targetMs) * 100));
  const description = sessionCount > 0 ? `${sessionCount} session${sessionCount > 1 ? 's' : ''} today` : 'No sessions recorded today';

  return {
    formatted: formatDuration(totalCodingTime),
    description,
    progress
  };
};

const getCurrentSessionInfo = (events: ExtensionEvent[], now: number) => {
  const sessionStarts = events.filter((event) => event.eventType === ExtensionEventType.SESSION_START);
  const sessionEnds = events.filter((event) => event.eventType === ExtensionEventType.SESSION_END);

  if (!sessionStarts.length) {
    return {
      duration: '0m',
      status: 'Inactive',
      description: 'No active session',
      isActive: false,
      statusClass: 'status-inactive'
    };
  }

  const latestStart = [...sessionStarts].sort((a, b) => b.timestamp - a.timestamp)[0];
  const hasEnded = sessionEnds.some((end) => end.sessionId === latestStart.sessionId);

  if (hasEnded) {
    return {
      duration: '0m',
      status: 'Inactive',
      description: 'Last session ended',
      isActive: false,
      statusClass: 'status-inactive'
    };
  }

  return {
    duration: formatDuration(now - latestStart.timestamp),
    status: 'Active',
    description: `Started at ${new Date(latestStart.timestamp).toLocaleTimeString()}`,
    isActive: true,
    statusClass: 'status-active'
  };
};

const calculateFolderAnalytics = (events: ExtensionEvent[], now: number) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  const todayEvents = events.filter((event) => event.timestamp >= todayStart);
  const sessionStarts = todayEvents.filter((event) => event.eventType === ExtensionEventType.SESSION_START);
  const sessionEnds = todayEvents.filter((event) => event.eventType === ExtensionEventType.SESSION_END);
  const folderMap = new Map<string, number>();

  sessionStarts.forEach((startEvent) => {
    const folder = startEvent.folder || 'Unknown';
    const endEvent = sessionEnds.find((endEvent) => endEvent.sessionId === startEvent.sessionId);
    const duration = endEvent ? endEvent.timestamp - startEvent.timestamp : now - startEvent.timestamp;
    folderMap.set(folder, (folderMap.get(folder) ?? 0) + Math.max(0, duration));
  });

  const latestFolder =
    [...todayEvents]
      .sort((a, b) => b.timestamp - a.timestamp)
      .find((event) => Boolean(event.folder))
      ?.folder ?? '';

  return Array.from(folderMap.entries())
    .map(([fullPath, ms]) => ({
      name: fullPath.split(/[\\/]/).filter(Boolean).at(-1) ?? fullPath,
      fullPath,
      ms,
      isCurrent: fullPath === latestFolder
    }))
    .sort((a, b) => {
      if (a.isCurrent) {
        return -1;
      }
      if (b.isCurrent) {
        return 1;
      }
      return b.ms - a.ms;
    })
    .map(({ name, fullPath, ms, isCurrent }) => ({
      name,
      fullPath,
      isCurrent,
      time: formatDuration(ms)
    }));
};

// Mirrors extension/src/ui/dashboardPanel.ts "calculateInactivityAnalytics" logic.
const calculateInactivityAnalytics = (events: ExtensionEvent[], now: number) => {
  const tracking = calculateTrackingDurations(events, now);
  const clampedActiveMs = tracking.activeMs;
  const idleMs = tracking.idleMs;
  const totalProjectMs = tracking.totalMs;

  const startTimeFormatted = tracking.startTimestamp ? new Date(tracking.startTimestamp).toLocaleString() : 'Unknown';
  const activeFormatted = formatDuration(clampedActiveMs);
  const idleFormatted = formatDuration(idleMs);
  const totalFormatted = formatDuration(totalProjectMs);

  return {
    idle: idleFormatted,
    description:
      totalProjectMs > 0
        ? `Started: ${startTimeFormatted}, Active: ${activeFormatted}, Idle: ${idleFormatted}`
        : 'No session data for this project yet',
    totalTracked: totalFormatted,
    active: activeFormatted,
    startTime: startTimeFormatted
  };
};

const calculateProductivityInsights = (events: ExtensionEvent[], now: number) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const todayEvents = events.filter((event) => event.timestamp >= todayStart);

  const tracking = calculateTrackingDurations(todayEvents, now);

  const totalCodingTime = tracking.activeMs;
  const totalInactiveTime = tracking.idleMs;
  const sessionCount = new Set(
    todayEvents
      .filter((event) =>
        event.eventType === ExtensionEventType.SESSION_START || event.eventType === ExtensionEventType.SESSION_END
      )
      .map((event) => event.sessionId)
      .filter((sessionId): sessionId is string => Boolean(sessionId))
  ).size;

  const fileEdits = todayEvents.filter((event) => event.eventType === ExtensionEventType.FILE_EDIT).length;
  const focusSwitches = todayEvents.filter((event) =>
    [ExtensionEventType.WINDOW_FOCUS, ExtensionEventType.WINDOW_BLUR].includes(event.eventType)
  ).length;

  const totalTime = totalCodingTime + totalInactiveTime;
  const score = Math.round(totalTime > 0 ? (totalCodingTime / totalTime) * 100 : 0);

  const insights: ExtensionInsightItem[] = [];
  if (score >= 80) {
    insights.push({ type: 'productive', icon: '🚀', text: 'Excellent focus! High productivity score today.' });
  } else if (score >= 60) {
    insights.push({ type: 'focus', icon: '🎯', text: 'Good productivity. Consider minimizing distractions.' });
  } else {
    insights.push({ type: 'idle', icon: '⚠️', text: 'Productivity could be improved. Try focused work sessions.' });
  }

  if (sessionCount > 5) {
    insights.push({ type: 'focus', icon: '🔁', text: `Active in ${sessionCount} sessions. Consider longer focused periods.` });
  }

  if (fileEdits > 50) {
    insights.push({ type: 'productive', icon: '✏️', text: `Made ${fileEdits} edits. Very active coding day!` });
  }

  if (focusSwitches > 20) {
    insights.push({ type: 'idle', icon: '🔄', text: `Switched focus ${focusSwitches} times. Consider reducing context switching.` });
  }

  const activeMinutes = Math.max(0, Math.round(totalCodingTime / (1000 * 60)));
  const idleMinutes = Math.max(0, Math.round(totalInactiveTime / (1000 * 60)));

  return {
    score: Math.max(0, Math.min(100, score)),
    description: score >= 70 ? 'Productive day!' : score >= 40 ? 'Moderate productivity' : 'Room for improvement',
    insights,
    chartData: {
      labels: ['Active', 'Idle'],
      data: [activeMinutes, idleMinutes]
    }
  };
};

export const buildExtensionAnalytics = (events: ExtensionEvent[]): ExtensionAnalyticsResponse => {
  const now = Date.now();
  const distributionMap = new Map<string, number>();
  events.forEach((event) => {
    distributionMap.set(event.eventType, (distributionMap.get(event.eventType) ?? 0) + 1);
  });

  const timeline = [...events]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, ANALYTICS_CONFIG.extension.recentTimelineLimit)
    .map((event) => ({
      id: event.id,
      eventType: event.eventType,
      timestamp: event.timestamp,
      repository: event.repository,
      folder: event.folder,
      file: event.file,
      branch: event.branch
    }));

  return {
    summary: {
      todayCodingTime: calculateTodayCodingTime(events, now),
      currentSession: getCurrentSessionInfo(events, now),
      projectTracking: calculateInactivityAnalytics(events, now),
      productivity: calculateProductivityInsights(events, now)
    },
    folderAnalytics: calculateFolderAnalytics(events, now),
    eventDistribution: Array.from(distributionMap.entries())
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count),
    timeline,
    rawCount: events.length
  };
};
