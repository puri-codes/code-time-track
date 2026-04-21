import { Activity, Clock3, Database, FolderKanban } from 'lucide-react';
import { ExtensionAnalytics } from '../types/analytics';
import { ExtensionProductivityChart } from './charts/ExtensionProductivityChart';
import { formatRelativeMs } from '../utils/format';

interface ExtensionAnalyticsPanelProps {
  data: ExtensionAnalytics;
}

const statItemClass =
  'rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900';

export const ExtensionAnalyticsPanel = ({ data }: ExtensionAnalyticsPanelProps) => {
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Extension Analytics (Common SQL-backed)</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {data.rawCount.toLocaleString()} synced events
        </span>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={statItemClass}>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Clock3 className="h-4 w-4" /> Today Coding Time
          </p>
          <p className="mt-2 text-2xl font-semibold">{data.summary.todayCodingTime.formatted}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{data.summary.todayCodingTime.description}</p>
        </div>
        <div className={statItemClass}>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Activity className="h-4 w-4" /> Current Session
          </p>
          <p className="mt-2 text-2xl font-semibold">{data.summary.currentSession.duration}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{data.summary.currentSession.description}</p>
        </div>
        <div className={statItemClass}>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Database className="h-4 w-4" /> Project Tracking
          </p>
          <p className="mt-2 text-2xl font-semibold">{data.summary.projectTracking.totalTracked}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Active {data.summary.projectTracking.active} • Idle {data.summary.projectTracking.idle}</p>
        </div>
        <div className={statItemClass}>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <FolderKanban className="h-4 w-4" /> Productivity Score
          </p>
          <p className="mt-2 text-2xl font-semibold">{data.summary.productivity.score}%</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{data.summary.productivity.description}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className={statItemClass}>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Productivity Mix</h3>
          <ExtensionProductivityChart labels={data.summary.productivity.chartData.labels} data={data.summary.productivity.chartData.data} />
          <div className="space-y-2">
            {data.summary.productivity.insights.map((insight, index) => (
              <p key={`${insight.type}-${index}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
                {insight.icon} {insight.text}
              </p>
            ))}
          </div>
        </div>

        <div className={statItemClass}>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Recent Extension Timeline</h3>
          <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto">
            {data.timeline.map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{event.eventType}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{formatRelativeMs(event.timestamp)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{event.file || event.folder || event.repository || 'No location metadata'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

