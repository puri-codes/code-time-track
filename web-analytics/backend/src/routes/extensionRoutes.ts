import { Router } from 'express';
import { z } from 'zod';
import {
  getExtensionEvents,
  getLatestProjectForUser,
  refreshProjectRepositoryMatches,
  upsertExtensionEvent,
  upsertProject,
  upsertSession
} from '../lib/database.js';
import { buildExtensionAnalytics } from '../services/extensionAnalyticsService.js';
import { ExtensionEvent, ExtensionEventType } from '../types/extension.js';

const eventTypeSchema = z.nativeEnum(ExtensionEventType);

const extensionEventSchema = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string(),
  repository: z.string().optional(),
  folder: z.string().optional(),
  file: z.string().optional(),
  language: z.string().optional(),
  eventType: eventTypeSchema,
  timestamp: z.number(),
  duration: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
  branch: z.string().optional(),
  commitHash: z.string().optional(),
  filesChanged: z.number().optional(),
  linesAdded: z.number().optional(),
  linesRemoved: z.number().optional(),
  sessionId: z.string().optional(),
  activeDuration: z.number().optional(),
  idle: z.boolean().optional(),
  idleDuration: z.number().optional()
});

const payloadSchema = z.object({
  user_id: z.string(),
  events: z.array(extensionEventSchema)
});

const analyticsQuerySchema = z.object({
  userId: z.string(),
  projectId: z.string().optional()
});

const toIsoString = (timestamp: number) => new Date(timestamp).toISOString();

const getWorkspaceName = (event: z.infer<typeof extensionEventSchema>): string => {
  const fallback = event.repository ?? event.projectId;
  if (!event.folder) {
    return fallback;
  }

  const segments = event.folder.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? fallback;
};

const parseJson = (raw: string | null | undefined): Record<string, unknown> | undefined => {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const router = Router();

router.post('/events', async (req, res) => {
  const parsedBody = payloadSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: 'Invalid extension events payload.' });
  }

  try {
    const projectRows = Array.from(
      parsedBody.data.events.reduce((projects, event) => {
        const existing = projects.get(event.projectId);
        const nextLastSeenAt = toIsoString(event.timestamp);

        if (existing) {
          projects.set(event.projectId, {
            ...existing,
            workspace_name: existing.workspace_name ?? getWorkspaceName(event),
            workspace_root_label: existing.workspace_root_label ?? event.folder,
            repository_name: existing.repository_name ?? event.repository,
            default_branch: existing.default_branch ?? event.branch,
            last_seen_at: existing.last_seen_at > nextLastSeenAt ? existing.last_seen_at : nextLastSeenAt,
            metadata: {
              ...existing.metadata,
              last_file: event.file ?? existing.metadata.last_file ?? null,
              last_language: event.language ?? existing.metadata.last_language ?? null
            }
          });
          return projects;
        }

        projects.set(event.projectId, {
          extension_project_id: event.projectId,
          user_id: parsedBody.data.user_id,
          workspace_name: getWorkspaceName(event),
          workspace_root_label: event.folder,
          repository_name: event.repository,
          default_branch: event.branch,
          is_active: 1,
          last_seen_at: nextLastSeenAt,
          metadata: {
            last_file: event.file ?? null,
            last_language: event.language ?? null
          }
        });
        return projects;
      }, new Map<string, {
        extension_project_id: string;
        user_id: string;
        workspace_name: string;
        workspace_root_label?: string;
        repository_name?: string;
        default_branch?: string;
        is_active: number;
        last_seen_at: string;
        metadata: Record<string, unknown>;
      }>())
        .values()
    );

    projectRows.forEach((project) => {
      upsertProject({
        ...project,
        metadata: JSON.stringify(project.metadata)
      });

      refreshProjectRepositoryMatches(project.extension_project_id, project.repository_name);
    });

    const sessionRows = Array.from(
      parsedBody.data.events.reduce((sessions, event) => {
        if (!event.sessionId) {
          return sessions;
        }

        const existing = sessions.get(event.sessionId) ?? {
          session_id: event.sessionId,
          user_id: parsedBody.data.user_id,
          project_id: event.projectId,
          started_at: undefined as string | undefined,
          ended_at: undefined as string | undefined,
          duration_ms: undefined as number | undefined,
          is_active: 1,
          metadata: {} as Record<string, unknown>
        };

        existing.user_id = parsedBody.data.user_id;
        existing.project_id = event.projectId;
        existing.metadata = {
          ...existing.metadata,
          repository: event.repository ?? existing.metadata.repository ?? null,
          folder: event.folder ?? existing.metadata.folder ?? null
        };

        if (event.eventType === ExtensionEventType.SESSION_START) {
          const nextStartedAt = toIsoString(event.timestamp);
          existing.started_at =
            !existing.started_at || existing.started_at > nextStartedAt
              ? nextStartedAt
              : existing.started_at;
          existing.is_active = 1;
        }

        if (event.eventType === ExtensionEventType.SESSION_END) {
          const derivedStartTimestamp =
            typeof event.activeDuration === 'number'
              ? Math.max(0, event.timestamp - event.activeDuration)
              : event.timestamp;

          if (!existing.started_at) {
            existing.started_at = toIsoString(derivedStartTimestamp);
          }

          existing.ended_at = toIsoString(event.timestamp);
          existing.duration_ms =
            typeof event.activeDuration === 'number'
              ? event.activeDuration
              : Math.max(0, event.timestamp - new Date(existing.started_at).getTime());
          existing.is_active = 0;
        }

        sessions.set(event.sessionId, existing);
        return sessions;
      }, new Map<string, {
        session_id: string;
        user_id: string;
        project_id: string;
        started_at?: string;
        ended_at?: string;
        duration_ms?: number;
        is_active: number;
        metadata: Record<string, unknown>;
      }>())
        .values()
    ).filter((row): row is {
      session_id: string;
      user_id: string;
      project_id: string;
      started_at: string;
      ended_at?: string;
      duration_ms?: number;
      is_active: number;
      metadata: Record<string, unknown>;
    } => typeof row.started_at === 'string');

    sessionRows.forEach((session) => {
      upsertSession({
        ...session,
        metadata: JSON.stringify(session.metadata)
      });
    });

    parsedBody.data.events.forEach((event) => {
      upsertExtensionEvent({
        event_id: event.id,
        user_id: parsedBody.data.user_id,
        project_id: event.projectId,
        repository: event.repository,
        folder: event.folder,
        file: event.file,
        language: event.language,
        event_type: event.eventType,
        timestamp_ms: event.timestamp,
        occurred_at: new Date(event.timestamp).toISOString(),
        duration: event.duration,
        metadata: JSON.stringify(event.metadata ?? {}),
        branch: event.branch,
        commit_hash: event.commitHash,
        files_changed: event.filesChanged,
        lines_added: event.linesAdded,
        lines_removed: event.linesRemoved,
        session_id: event.sessionId,
        active_duration: event.activeDuration,
        idle: event.idle,
        idle_duration: event.idleDuration
      });
    });

    return res.status(202).json({
      received: parsedBody.data.events.length,
      stored: true
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Failed to store extension events.' });
  }
});

router.get('/analytics', async (req, res) => {
  const parsedQuery = analyticsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: 'userId query parameter is required.' });
  }

  try {
    const latestProject = parsedQuery.data.projectId ? undefined : getLatestProjectForUser(parsedQuery.data.userId);
    const scopedProjectId = parsedQuery.data.projectId ?? latestProject?.extension_project_id;
    const rows = getExtensionEvents(parsedQuery.data.userId, scopedProjectId);

    const events: ExtensionEvent[] = (rows ?? []).map((row: any) => ({
      id: row.event_id,
      userId: row.user_id,
      projectId: row.project_id,
      repository: row.repository ?? undefined,
      folder: row.folder ?? undefined,
      file: row.file ?? undefined,
      language: row.language ?? undefined,
      eventType: row.event_type as ExtensionEventType,
      timestamp: row.timestamp_ms,
      duration: row.duration ?? undefined,
      metadata: parseJson(row.metadata),
      branch: row.branch ?? undefined,
      commitHash: row.commit_hash ?? undefined,
      filesChanged: row.files_changed ?? undefined,
      linesAdded: row.lines_added ?? undefined,
      linesRemoved: row.lines_removed ?? undefined,
      sessionId: row.session_id ?? undefined,
      activeDuration: row.active_duration ?? undefined,
      idle: row.idle !== null && row.idle !== undefined ? Boolean(row.idle) : undefined,
      idleDuration: row.idle_duration ?? undefined
    }));

    const analytics = buildExtensionAnalytics(events);
    return res.json({
      ...analytics,
      context: {
        projectId: scopedProjectId,
        repository: latestProject?.repository_name,
        workspaceName: latestProject?.workspace_name
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Failed to load extension analytics.' });
  }
});

export const extensionRoutes = router;
