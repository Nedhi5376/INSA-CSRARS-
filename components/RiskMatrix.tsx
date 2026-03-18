import React from 'react';

interface RiskMatrixData {
  likelihood: number;
  impact: number;
  count: number;
}

interface RiskMatrixProps {
  data: RiskMatrixData[] | null;
}

const RiskMatrix: React.FC<RiskMatrixProps> = ({ data }) => {
  // Initialize 5x5 matrix with zeros
  const matrix: number[][] = Array(5).fill(0).map(() => Array(5).fill(0));

  // Populate matrix with data (only if data exists and is an array)
  if (data && Array.isArray(data)) {
    data.forEach((item) => {
      if (item.likelihood >= 1 && item.likelihood <= 5 && item.impact >= 1 && item.impact <= 5) {
        matrix[5 - item.impact][item.likelihood - 1] = item.count;
      }
    });
  }

  const getColor = (likelihood: number, impact: number): string => {
    const score = likelihood * impact;
    if (score >= 20) return 'bg-red-600';
    if (score >= 12) return 'bg-orange-500';
    if (score >= 6) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getCellOpacity = (count: number): string => {
    if (count === 0) return 'opacity-20';
    if (count <= 2) return 'opacity-40';
    if (count <= 5) return 'opacity-60';
    if (count <= 10) return 'opacity-80';
    return 'opacity-100';
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-6 gap-1">
        {/* Top-left empty cell */}
        <div className="h-8"></div>

        {/* Likelihood labels (horizontal) */}
        {[1, 2, 3, 4, 5].map(l => (
          <div key={`likelihood-${l}`} className="h-8 flex items-center justify-center text-xs text-slate-400 font-semibold">
            L{l}
          </div>
        ))}

        {/* Matrix rows */}
        {matrix.map((row, rowIndex) => (
          <React.Fragment key={`row-${rowIndex}`}>
            {/* Impact label (vertical) */}
            <div className="h-12 flex items-center justify-center text-xs text-slate-400 font-semibold">
              I{5 - rowIndex}
            </div>

            {/* Matrix cells */}
            {row.map((count, colIndex) => {
              const likelihood = colIndex + 1;
              const impact = 5 - rowIndex;
              const colorClass = getColor(likelihood, impact);
              const opacityClass = getCellOpacity(count);

              return (
                <div
                  key={`cell-${rowIndex}-${colIndex}`}
                  className={`h-12 ${colorClass} ${opacityClass} rounded flex items-center justify-center border border-slate-700 relative`}
                >
                  {count > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-slate-900">
                        {count}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-600 rounded"></div>
          <span className="text-slate-400">Critical (20-25)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-500 rounded"></div>
          <span className="text-slate-400">High (12-19)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
          <span className="text-slate-400">Medium (6-11)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-slate-400">Low (1-5)</span>
        </div>
      </div>

      {/* Empty state message */}
      {(!data || data.length === 0) && (
        <div className="mt-4 text-center text-sm text-slate-500">
          No risk data available
        </div>
      )}
    </div>
  );
};

export default RiskMatrix;
