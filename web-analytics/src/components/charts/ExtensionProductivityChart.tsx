import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface ExtensionProductivityChartProps {
  labels: string[];
  data: number[];
}

const COLORS = ['#2563EB', '#F59E0B', '#16A34A', '#DC2626'];

export const ExtensionProductivityChart = ({ labels, data }: ExtensionProductivityChartProps) => {
  const chartData = labels.map((label, index) => ({ label, value: data[index] ?? 0 }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="label" outerRadius={88} innerRadius={56} paddingAngle={2}>
            {chartData.map((entry, index) => (
              <Cell key={`${entry.label}-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

