import { Router } from 'express';
import { z } from 'zod';
import { saveGithubAnalytics } from '../lib/database.js';
import { GitHubApiError } from '../services/githubApiClient.js';
import { GitHubAnalyticsService } from '../services/githubAnalyticsService.js';

const querySchema = z.object({
  repo: z.string().min(3)
});

const router = Router();
const githubAnalyticsService = new GitHubAnalyticsService();

router.get('/analyze', async (req, res) => {
  const parsedQuery = querySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({
      error: 'Repository is required in owner/repo format.'
    });
  }

  try {
    const analytics = await githubAnalyticsService.analyzeRepository(parsedQuery.data.repo);
    saveGithubAnalytics({
      fullName: analytics.repo.fullName,
      owner: analytics.repo.owner,
      name: analytics.repo.name,
      url: analytics.repo.url,
      defaultBranch: analytics.repo.defaultBranch,
      createdAt: analytics.repo.createdAt,
      rawPayload: JSON.stringify(analytics),
      branches: analytics.branches.map((branch) => ({
        name: branch.name,
        isDefault: branch.isDefault,
        isProtected: branch.protected,
        lastCommitAt: branch.lastCommitAt
      })),
      timeline: analytics.timeline.map((item) => ({
        id: item.id,
        type: item.type,
        timestamp: item.timestamp,
        author: item.author,
        branch: item.branch,
        message: item.message,
        title: item.title,
        action: item.action,
        count: item.count
      })),
      commitFrequency: analytics.charts.commitFrequency,
      pushActivity: analytics.charts.pushActivity,
      pullLifecycle: analytics.charts.pullRequestLifecycle
    });

    return res.json(analytics);
  } catch (error) {
    if (error instanceof GitHubApiError) {
      if (error.rateLimited) {
        return res.status(429).json({
          error: `GitHub API rate limit reached. Try again after ${error.resetAt ?? 'reset window'}.`
        });
      }

      if (error.status === 404) {
        return res.status(404).json({
          error: 'Repository not found or is private without token access.'
        });
      }

      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Unknown error while analyzing repository.' });
  }
});

export const githubRoutes = router;

