interface OverviewCardsProps {
  createdDate: string;
  totalCommits: number;
  totalPrs: number;
  totalBranches: number;
}

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
  </div>
);

export const OverviewCards = ({ createdDate, totalCommits, totalPrs, totalBranches }: OverviewCardsProps) => {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Repo Created Date" value={createdDate} />
      <StatCard label="Total Commits" value={totalCommits.toLocaleString()} />
      <StatCard label="Total PRs" value={totalPrs.toLocaleString()} />
      <StatCard label="Active Branches" value={totalBranches.toLocaleString()} />
    </section>
  );
};

