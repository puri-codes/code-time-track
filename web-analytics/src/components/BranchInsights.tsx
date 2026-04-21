import { ShieldCheck } from 'lucide-react';
import { formatDateTime } from '../utils/format';

interface BranchInsightsProps {
  selectedBranch: string;
  onBranchChange: (branch: string) => void;
  branches: Array<{ name: string; protected: boolean; lastCommitAt?: string; isDefault: boolean }>;
}

export const BranchInsights = ({ selectedBranch, onBranchChange, branches }: BranchInsightsProps) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Branch Insights</h3>
        <select
          value={selectedBranch}
          onChange={(event) => onBranchChange(event.target.value)}
          className="h-9 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-blue-400"
        >
          <option value="all">All Branches</option>
          {branches.map((branch) => (
            <option key={branch.name} value={branch.name}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 max-h-[340px] overflow-y-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <th className="pb-2">Branch</th>
              <th className="pb-2">Last Commit</th>
              <th className="pb-2">Flags</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.name} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{branch.name}</span>
                    {branch.isDefault && <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">default</span>}
                  </div>
                </td>
                <td className="py-2 text-slate-600 dark:text-slate-300">{branch.lastCommitAt ? formatDateTime(branch.lastCommitAt) : 'Unavailable'}</td>
                <td className="py-2">
                  {branch.protected ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" /> Protected
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">Standard</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

