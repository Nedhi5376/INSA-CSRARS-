"use client";
import React, { useEffect, useState } from "react";

type Q = {
  _id: string;
  title?: string;
  company?: string;
  filledBy?: string;
  role?: string;
  date?: string;
  status?: string;
  responseCount?: number;
  category?: string;
  questions?: unknown[];
};

export default function QuestionnaireSidebar() {
  const [questionnaires, setQuestionnaires] = useState<Q[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState<Q | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    fetchList();
  }, []);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/questionnaires/list");
      const data = await res.json();
      if (data.success && Array.isArray(data.questionnaires)) setQuestionnaires(data.questionnaires);
      else setQuestionnaires([]);
    } catch (err) {
      console.error("Failed to load questionnaires", err);
      setQuestionnaires([]);
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(questionnaires.map(q => q.category || "(none)")));

  const filtered = questionnaires.filter(q => categoryFilter === "all" || (q.category || "(none)") === categoryFilter);

  const triggerAnalysis = async (id: string) => {
    try {
      await fetch("/api/analysis/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionnaireId: id }),
      });
      // refresh
      fetchList();
    } catch (err) {
      console.error("Failed to trigger analysis", err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Questionnaires</h3>
        <button onClick={fetchList} className="text-xs text-slate-400 hover:text-white">Refresh</button>
      </div>

      <div className="mb-3">
        <label className="text-xs text-slate-400">Category</label>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full mt-1 bg-slate-900 text-white text-sm px-2 py-1 rounded border border-slate-700">
          <option value="all">All</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      <div className="space-y-2 max-h-[40vh] overflow-y-auto">
        {loading ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-slate-400 text-sm">No questionnaires found.</div>
        ) : (
          filtered.map(q => (
            <div key={q._id} className="bg-slate-900 rounded p-2 border border-slate-700 flex items-start justify-between">
              <div className="flex-1 pr-2">
                <div className="text-xs text-white font-medium">{q.company || 'Unknown'}</div>
                <div className="text-[11px] text-slate-400">{q.title}</div>
                <div className="text-[11px] text-slate-500">{q.responseCount || 0} q • {q.date ? new Date(q.date).toLocaleDateString() : ''}</div>
              </div>
              <div className="flex flex-col gap-2 ml-2">
                <button onClick={() => setViewing(q)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs">View</button>
                <button onClick={() => triggerAnalysis(q._id)} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs">Run</button>
              </div>
            </div>
          ))
        )}
      </div>

      {viewing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-bold text-white">{viewing.company}</h3>
                <p className="text-slate-400">{viewing.title}</p>
                <div className="text-sm text-slate-500 mt-1">{viewing.date ? new Date(viewing.date).toLocaleString() : ''}</div>
              </div>
              <button onClick={() => setViewing(null)} className="text-slate-400 hover:text-white text-2xl">&times;</button>
            </div>

            <div className="space-y-3">
              {Array.isArray(viewing.questions) && viewing.questions.length > 0 ? (
                viewing.questions.map((q: any, idx: number) => (
                  <div key={idx} className="bg-slate-900 rounded p-3 border border-slate-700">
                    <div className="text-xs text-slate-400">Question</div>
                    <div className="text-white font-medium">{(q as any).question}</div>
                    <div className="text-xs text-slate-400 mt-2">Answer</div>
                    <div className="text-slate-300">{(q as any).answer}</div>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 italic">No questions available.</div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={() => setViewing(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
