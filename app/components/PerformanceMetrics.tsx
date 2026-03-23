import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MetricProps {
  data: { category: string; score: number }[];
}

const PerformanceMetrics: React.FC<MetricProps> = ({ data }) => {
  const getBarColor = (score: number) => {
    if (score >= 80) return '#16a34a';
    if (score >= 60) return '#eab308';
    if (score >= 40) return '#ea580c';
    return '#dc2626';
  };

  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl">
      <h3 className="text-xl font-bold text-white mb-4 uppercase tracking-widest text-sm text-slate-400">Compliance Metrics</h3>
      <p className="text-xs text-slate-500 mb-6">Percentage of compliance per security category (calculated from risk scores)</p>
      
      <div className="h-64 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" stroke="#94a3b8" fontSize={10} domain={[0, 100]} />
            <YAxis 
                type="category" 
                dataKey="category" 
                stroke="#94a3b8" 
                fontSize={8} 
                width={80}
                tickFormatter={(val) => val.split(' ')[0]} 
            />
            <Tooltip 
              cursor={{ fill: '#334155' }}
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '10px' }}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.score)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PerformanceMetrics;
