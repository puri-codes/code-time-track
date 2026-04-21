import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface PushActivityChartProps {
  data: Array<{ date: string; pushes: number; commitCount: number; source: 'events' | 'fallback_commits' }>;
}

export const PushActivityChart = ({ data }: PushActivityChartProps) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Push Activity</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Falls back to commit-derived activity when PushEvent history is unavailable.</p>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="pushes" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
            <Bar dataKey="commitCount" fill="#2563EB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};

