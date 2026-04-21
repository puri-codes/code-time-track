import { Moon, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BranchInsights } from '../components/BranchInsights';
import { ExtensionAnalyticsPanel } from '../components/ExtensionAnalyticsPanel';
import { OverviewCards } from '../components/OverviewCards';
import { RepoComparisonPanel } from '../components/RepoComparisonPanel';
import { RepoInputForm } from '../components/RepoInputForm';
import { TimelineFeed } from '../components/TimelineFeed';
import { CommitFrequencyChart } from '../components/charts/CommitFrequencyChart';
import { PullRequestLifecycleChart } from '../components/charts/PullRequestLifecycleChart';
import { PushActivityChart } from '../components/charts/PushActivityChart';
import { useComparisonAnalytics } from '../hooks/useComparisonAnalytics';
import { CUSTOM_UI_CONFIG } from '../config/customConfig';
import { useExtensionAnalytics } from '../hooks/useExtensionAnalytics';
import { useRepoAnalytics } from '../hooks/useRepoAnalytics';
import { useTheme } from '../hooks/useTheme';
import { formatDate } from '../utils/format';

export function DashboardPage() {
  const { theme, toggleTheme } = useTheme();
  const repo = useRepoAnalytics();
  const extension = useExtensionAnalytics();
  const comparison = useComparisonAnalytics();
  const [selectedBranch, setSelectedBranch] = useState(CUSTOM_UI_CONFIG.defaultBranchFilter);

  // Get extension credentials from environment variables
  const extensionUserId = import.meta.env.VITE_EXTENSION_USER_ID || 'anonymous';

  // Keeps the timeline responsive when users switch branch filters.
  const filteredTimeline = useMemo(() => {
    if (!repo.data) {
      return [];
    }
    if (selectedBranch === 'all') {
      return repo.data.timeline.slice(0, CUSTOM_UI_CONFIG.timelineLimit);
    }
    return repo.data.timeline.filter((item) => item.branch === selectedBranch).slice(0, CUSTOM_UI_CONFIG.timelineLimit);
  }, [repo.data, selectedBranch]);

  const handleAnalyze = async (repository: string) => {
    const repoAnalytics = await repo.runAnalysis(repository);
    if (repoAnalytics) {
      setSelectedBranch(CUSTOM_UI_CONFIG.defaultBranchFilter);
    }
    if (extensionUserId) {
      await extension.load(extensionUserId);
      await comparison.load(extensionUserId, repository);
    }
  };

  useEffect(() => {
    if (!extensionUserId) {
      return;
    }

    const refresh = async () => {
      await extension.load(extensionUserId);
      const comparedRepo = repo.data?.repo.fullName;
      if (comparedRepo) {
        await comparison.load(extensionUserId, comparedRepo);
      }
    };

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [comparison.load, extension.load, extensionUserId, repo.data?.repo.fullName]);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">GitHub Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Production-grade repository + extension insights with unified analytics workflows.</p>
        </div>
        <button
          onClick={toggleTheme}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {theme === 'light' ? 'Dark' : 'Light'} mode
        </button>
      </header>

      <RepoInputForm loading={repo.loading || extension.loading} onAnalyze={handleAnalyze} />

      {(repo.error || extension.error || comparison.error) && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200">
          {repo.error && <p>Repository error: {repo.error}</p>}
          {extension.error && <p>Extension error: {extension.error}</p>}
          {comparison.error && <p>Comparison error: {comparison.error}</p>}
        </div>
      )}

      {repo.data && (
        <>
          <OverviewCards
            createdDate={formatDate(repo.data.overview.repoCreatedDate)}
            totalCommits={repo.data.overview.totalCommits}
            totalPrs={repo.data.overview.totalPullRequests}
            totalBranches={repo.data.overview.activeBranches}
          />

          <section className="grid gap-3 xl:grid-cols-2">
            <CommitFrequencyChart data={repo.data.charts.commitFrequency} />
            <PushActivityChart data={repo.data.charts.pushActivity} />
          </section>

          <section className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
            <PullRequestLifecycleChart data={repo.data.charts.pullRequestLifecycle} />
            <BranchInsights selectedBranch={selectedBranch} onBranchChange={setSelectedBranch} branches={repo.data.branches} />
          </section>

          <TimelineFeed items={filteredTimeline} selectedBranch={selectedBranch} />
        </>
      )}

      {CUSTOM_UI_CONFIG.showExtensionPanelByDefault && extension.data && <ExtensionAnalyticsPanel data={extension.data} />}
      {comparison.data && <RepoComparisonPanel data={comparison.data} />}
    </main>
  );
}
