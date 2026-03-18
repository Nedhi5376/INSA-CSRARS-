"use client";
import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";

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
  questions?: QuestionItem[];
};

type QuestionItem = {
  question?: string;
  answer?: string;
};

export default function QuestionnairesPage() {
  const [questionnaires, setQuestionnaires] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Q | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [analysisLoading, setAnalysisLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchList();
  }, []);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/questionnaires/list");
      const data = await res.json();
      if (data.success && Array.isArray(data.questionnaires))
        setQuestionnaires(data.questionnaires);
      else setQuestionnaires([]);
    } catch (err) {
      console.error("Failed to load questionnaires", err);
      setQuestionnaires([]);
    } finally {
      setLoading(false);
    }
  };

  // Build a unique list of questionnaire names (titles) for the dropdown
  const names = Array.from(
    new Set(questionnaires.map((q) => q.title || "(untitled)"))
  );

  // Filter by selected name (dropdown) and by optional date range; then sort by date
  const filtered = questionnaires
    .filter((q) =>
      categoryFilter === "all"
        ? true
        : (q.title || "(untitled)") === categoryFilter
    )
    .filter((q) => {
      if (!dateFrom && !dateTo) return true;
      const t = q.date ? new Date(q.date).getTime() : 0;
      if (dateFrom) {
        const fromT = new Date(dateFrom).getTime();
        if (t < fromT) return false;
      }
      if (dateTo) {
        // include the end day by setting end to end-of-day
        const toT = new Date(dateTo).setHours(23, 59, 59, 999);
        if (t > toT) return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return sortOrder === "desc" ? tb - ta : ta - tb;
    });

  const triggerAnalysis = async (id: string) => {
    setAnalysisLoading(id);
    try {
      await fetch("/api/analysis/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionnaireId: id }),
      });
      alert("Analysis triggered successfully!");
      fetchList();
    } catch (err) {
      console.error("Failed to trigger analysis", err);
      alert("Error triggering analysis");
    } finally {
      setAnalysisLoading(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Assessment</h1>
          <button
            onClick={fetchList}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition font-medium"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Filter & Sort</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Questionnaire Name
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-md border border-slate-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All</option>
                {names.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-md border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-md border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Sort Order
              </label>
              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as "desc" | "asc")
                }
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-md border border-slate-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setCategoryFilter("all");
                }}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition font-medium"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Questionnaires List */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="bg-slate-800 border-2 border-dashed border-slate-700 rounded-lg p-12 text-center">
              <div className="text-6xl mb-4 opacity-30">📋</div>
              <p className="text-white font-semibold mb-2">
                No questionnaires found
              </p>
              <p className="text-slate-400">
                Try adjusting your filters or refresh the page
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-400 mb-4">
                Showing {filtered.length} of {questionnaires.length} questionnaires
              </p>
              <div className="space-y-4">
                {filtered.map((q) => (
                  <div
                    key={q._id}
                    className="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-blue-500 hover:shadow-lg transition"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-2">
                          {q.company || "Unknown Company"}
                        </h3>
                        <div className="space-y-1 text-sm text-slate-300">
                          <p>
                            <span className="font-medium">Title:</span>{" "}
                            {q.title || "(untitled)"}
                          </p>
                          <p>
                            <span className="font-medium">Category:</span>{" "}
                            {q.category || "N/A"}
                          </p>
                          <p>
                            <span className="font-medium">Filled By:</span>{" "}
                            {q.filledBy || "N/A"}
                          </p>
                          <p>
                            <span className="font-medium">Role:</span>{" "}
                            {q.role || "N/A"}
                          </p>
                          <p>
                            <span className="font-medium">Responses:</span>{" "}
                            {q.responseCount || 0} answers
                          </p>
                          <p>
                            <span className="font-medium">Date:</span>{" "}
                            {q.date
                              ? new Date(q.date).toLocaleDateString()
                              : "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* Badges & Buttons */}
                      <div className="flex flex-col gap-3 ml-4">
                        {q.status && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-600/20 text-blue-400 border border-blue-600/30 text-center">
                            {q.status.charAt(0).toUpperCase() +
                              q.status.slice(1)}
                          </span>
                        )}
                        <button
                          onClick={() => setViewing(q)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition font-medium text-sm"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => triggerAnalysis(q._id)}
                          disabled={analysisLoading === q._id}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {analysisLoading === q._id
                            ? "Processing..."
                            : "Run Analysis"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {viewing.company || "Unknown Company"}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {viewing.title || "(untitled)"}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  {viewing.date ? new Date(viewing.date).toLocaleString() : ""}
                </p>
              </div>
              <button
                onClick={() => setViewing(null)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Summary Info */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Filled By</p>
                    <p className="text-white font-medium">
                      {viewing.filledBy || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Role</p>
                    <p className="text-white font-medium">
                      {viewing.role || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Category</p>
                    <p className="text-white font-medium">
                      {viewing.category || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Status</p>
                    <p className="text-white font-medium">
                      {viewing.status || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Questions & Answers */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4">
                  Questions & Answers
                </h3>
                {Array.isArray(viewing.questions) &&
                viewing.questions.length > 0 ? (
                  <div className="space-y-4">
                    {viewing.questions.map((qq: QuestionItem, idx: number) => (
                      <div
                        key={idx}
                        className="bg-slate-900/50 rounded-lg p-4 border border-slate-700"
                      >
                        <div className="mb-3">
                          <p className="text-xs text-slate-400 mb-1">
                            Question {idx + 1}
                          </p>
                          <p className="text-white font-medium">
                            {qq.question || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Answer</p>
                          <p className="text-slate-300">{qq.answer || "N/A"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 italic">
                    No questions available.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6">
              <button
                onClick={() => setViewing(null)}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}