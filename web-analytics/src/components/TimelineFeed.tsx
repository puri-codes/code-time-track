import { GitHubTimelineItem } from '../types/analytics';
import { formatDateTime } from '../utils/format';

interface TimelineFeedProps {
  items: GitHubTimelineItem[];
  selectedBranch: string;
}

const actionLabel = (item: GitHubTimelineItem): string => {
  if (item.type === 'pull_request') {
    return `PR ${item.action ?? 'event'}`;
  }
  if (item.type === 'push') {
    return `Push (${item.count ?? 0} commits)`;
  }
  return 'Commit';
};

export const TimelineFeed = ({ items, selectedBranch }: TimelineFeedProps) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Repository Timeline</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {selectedBranch === 'all' ? 'All branches' : `Branch: ${selectedBranch}`}
        </span>
      </div>

      <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No timeline items found for this branch filter.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 p-3 transition hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-500/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{actionLabel(item)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(item.timestamp)}</p>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.title ?? item.message ?? 'No message available'}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                {item.author && <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">{item.author}</span>}
                {item.branch && <span className="rounded-md bg-blue-100 px-2 py-1 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{item.branch}</span>}
                <span className="rounded-md bg-slate-100 px-2 py-1 uppercase dark:bg-slate-800">{item.type}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

