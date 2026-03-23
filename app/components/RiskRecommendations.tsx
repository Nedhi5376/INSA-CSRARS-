import React from 'react';

interface RiskItem {
  gap: string;
  threat: string;
  mitigation: string;
  riskScore: number;
}

interface RecommendationsProps {
  risks: RiskItem[];
}

const RiskRecommendations: React.FC<RecommendationsProps> = ({ risks }) => {
  // Sort and pick top 5 most critical risks
  const topRisks = [...risks]
    .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
    .slice(0, 5)
    .filter(r => (r.riskScore || 0) >= 9);

  return (
    <div className="bg-slate-800 p-8 rounded-lg border border-slate-700 shadow-xl overflow-hidden relative group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <svg className="w-24 h-24 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.673.337a4 4 0 01-2.574.344l-2.387-.477a2 2 0 00-1.022.547l-1.637 1.637a2 2 0 00.17 2.628l1.34 1.34a2 2 0 002.628.17l1.637-1.637z" />
        </svg>
      </div>

      <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-widest text-sm flex items-center gap-2">
        <div className="w-2 h-4 bg-blue-500 rounded-sm"></div>
        Priority Treatment Recommendations
      </h3>

      <div className="space-y-6 relative z-10">
        {topRisks.length > 0 ? (
          topRisks.map((risk, idx) => (
            <div key={idx} className="p-4 bg-slate-900 border-l-4 border-blue-500 rounded-r-lg hover:bg-slate-850 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-blue-400 tracking-widest uppercase">Treatment Objective {idx + 1}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  risk.riskScore >= 15 ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-500'
                }`}>
                  Score: {risk.riskScore}
                </span>
              </div>
              <p className="text-white font-medium mb-3 text-sm">{risk.gap}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1">Threat Context</h4>
                  <p className="text-xs text-slate-300 leading-relaxed italic">"{risk.threat}"</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1">Recommended Mitigation</h4>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">{risk.mitigation}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-10 text-center text-slate-500 italic">
            No critical risks found requiring immediate treatment recommendations.
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskRecommendations;
