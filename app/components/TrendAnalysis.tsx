import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendProps {
  data: { date: string; score: number }[];
}

const TrendAnalysis: React.FC<TrendProps> = ({ data }) => {
  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl">
      <h3 className="text-xl font-bold text-white mb-4 uppercase tracking-widest text-sm text-slate-400">Trend Analysis</h3>
      <p className="text-xs text-slate-500 mb-6">Average Risk Score across assessments over time</p>
      
      <div className="h-64 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="date" 
              stroke="#94a3b8" 
              fontSize={10} 
              tickFormatter={(str) => new Date(str).toLocaleDateString()}
            />
            <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 25]} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#3b82f6' }}
            />
            <Area 
              type="monotone" 
              dataKey="score" 
              stroke="#3b82f6" 
              fillOpacity={1} 
              fill="url(#colorScore)" 
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrendAnalysis;
