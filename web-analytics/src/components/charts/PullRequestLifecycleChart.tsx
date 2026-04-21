import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface PullRequestLifecycleChartProps {
  data: Array<{ date: string; created: number; merged: number; closed: number }>;
}

export const PullRequestLifecycleChart = ({ data }: PullRequestLifecycleChartProps) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Pull Request Lifecycle</h3>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar stackId="lifecycle" dataKey="created" fill="#2563EB" />
            <Bar stackId="lifecycle" dataKey="merged" fill="#16A34A" />
            <Bar stackId="lifecycle" dataKey="closed" fill="#DC2626" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};

