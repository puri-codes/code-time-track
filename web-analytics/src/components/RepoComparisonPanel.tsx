import { ComparisonAnalytics } from '../types/analytics';
import { formatDate, formatRelativeMs } from '../utils/format';

interface RepoComparisonPanelProps {
  data: ComparisonAnalytics;
}

const cardClass = 'rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900';

const toDuration = (ms: number) => {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
};

export const RepoComparisonPanel = ({ data }: RepoComparisonPanelProps) => {
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Matched Repo Comparison (Common SQL)</h2>
        {data.repository ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
            Last synced {formatDate(data.repository.lastAnalyzedAt)}
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
            Repository not synced yet
          </span>
        )}
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className={cardClass}>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">GitHub Commits</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">{data.githubTotals.commits.toLocaleString()}</p>
        </article>
        <article className={cardClass}>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">GitHub Pushes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">{data.githubTotals.pushes.toLocaleString()}</p>
        </article>
        <article className={cardClass}>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Extension Events</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">{data.extensionTotals.events.toLocaleString()}</p>
        </article>
        <article className={cardClass}>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Extension Active Time</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">{toDuration(data.extensionTotals.activeDurationMs)}</p>
        </article>
      </div>

      <div className={cardClass}>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Matched Workspaces</h3>
        <div className="mt-3 space-y-2">
          {data.projects.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">No extension workspace currently matches this repository.</p>
          )}
          {data.projects.map((project) => (
            <div key={project.projectId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{project.workspaceName || project.projectId}</p>
                <span className="text-xs text-slate-500 dark:text-slate-400">{project.eventCount.toLocaleString()} events</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{project.repositoryName || 'No repository metadata'}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Active {toDuration(project.activeDurationMs)} • Last activity {project.latestEventMs ? formatRelativeMs(project.latestEventMs) : 'N/A'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
