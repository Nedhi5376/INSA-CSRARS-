import React from 'react';

interface HeatmapCell {
  likelihood: number;
  impact: number;
  count: number;
}

interface PerformanceMetricsProps {
  data: HeatmapCell[];
}

const RiskHeatmap: React.FC<PerformanceMetricsProps> = ({ data }) => {
  // 5x5 Matrix (Likelihood x Impact)
  const matrix = Array(5).fill(0).map(() => Array(5).fill(0));
  
  data.forEach(cell => {
    if (cell.likelihood >= 1 && cell.likelihood <= 5 && cell.impact >= 1 && cell.impact <= 5) {
      matrix[5 - cell.likelihood][cell.impact - 1] = cell.count;
    }
  });

  const getCellColor = (likelihood: number, impact: number) => {
    const score = likelihood * impact;
    if (score >= 15) return 'bg-red-500/80 text-white';
    if (score >= 9) return 'bg-orange-500/80 text-white';
    if (score >= 5) return 'bg-yellow-500/80 text-slate-900';
    return 'bg-green-500/80 text-white';
  };

  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl">
      <h3 className="text-xl font-bold text-white mb-4">Risk Heatmap (5x5)</h3>
      <div className="relative">
        {/* Y-Axis Label */}
        <div className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
          Likelihood →
        </div>
        
        <div className="grid grid-cols-5 gap-1 ml-4">
          {matrix.map((row, lIdx) => (
            row.map((count, iIdx) => {
              const l = 5 - lIdx;
              const i = iIdx + 1;
              return (
                <div 
                  key={`${l}-${i}`}
                  className={`aspect-square flex flex-col items-center justify-center rounded-sm transition-all hover:scale-105 cursor-help ${getCellColor(l, i)}`}
                  title={`Likelihood: ${l}, Impact: ${i} | Count: ${count}`}
                >
                  <span className="text-lg font-bold">{count || ''}</span>
                  {count > 0 && <span className="text-[8px] opacity-70">Risks</span>}
                </div>
              );
            })
          ))}
        </div>

        {/* X-Axis Label */}
        <div className="text-center mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Impact →
        </div>
      </div>
      <div className="mt-6 grid grid-cols-4 gap-2">
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div><span className="text-[10px] text-slate-400">Critical</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-500 rounded-sm"></div><span className="text-[10px] text-slate-400">High</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-500 rounded-sm"></div><span className="text-[10px] text-slate-400">Medium</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-sm"></div><span className="text-[10px] text-slate-400">Low</span></div>
      </div>
    </div>
  );
};

export default RiskHeatmap;
