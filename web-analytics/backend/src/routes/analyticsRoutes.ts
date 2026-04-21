import { Router } from 'express';
import { z } from 'zod';
import { getRepositoryComparison } from '../lib/database.js';

const querySchema = z.object({
  userId: z.string().min(1),
  repo: z.string().min(3)
});

const router = Router();

type RepositoryRow = {
  full_name: string;
  owner: string;
  name: string;
  default_branch: string;
  last_analyzed_at: string;
};

type ProjectRow = {
  extension_project_id: string;
  workspace_name: string;
  repository_name: string;
  last_seen_at: string;
  event_count: number;
  active_duration_ms: number;
  latest_event_ms: number;
};

router.get('/comparison', (req, res) => {
  const parsedQuery = querySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: 'userId and repo query parameters are required.' });
  }

  try {
    const data = getRepositoryComparison(parsedQuery.data.userId, parsedQuery.data.repo) as {
      repository?: RepositoryRow | null;
      githubTotals: { commits: number; pushes: number; prsCreated: number };
      projects: ProjectRow[];
    };

    const extensionTotals = data.projects.reduce(
      (acc: { events: number; activeDurationMs: number }, project: ProjectRow) => {
        acc.events += Number(project.event_count ?? 0);
        acc.activeDurationMs += Number(project.active_duration_ms ?? 0);
        return acc;
      },
      { events: 0, activeDurationMs: 0 }
    );

    return res.json({
      repository: data.repository
        ? {
            fullName: data.repository.full_name,
            owner: data.repository.owner,
            name: data.repository.name,
            defaultBranch: data.repository.default_branch,
            lastAnalyzedAt: data.repository.last_analyzed_at
          }
        : null,
      githubTotals: data.githubTotals,
      extensionTotals,
      projects: data.projects.map((project: ProjectRow) => ({
        projectId: project.extension_project_id,
        workspaceName: project.workspace_name,
        repositoryName: project.repository_name,
        lastSeenAt: project.last_seen_at,
        eventCount: Number(project.event_count ?? 0),
        activeDurationMs: Number(project.active_duration_ms ?? 0),
        latestEventMs: Number(project.latest_event_ms ?? 0)
      }))
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Failed to load comparison analytics.' });
  }
});

export const analyticsRoutes = router;
