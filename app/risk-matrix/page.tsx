"use client";

import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import RiskMatrix from "@/components/RiskMatrix";

interface QuestionAnalysis {
  question: string;
  answer: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  riskLevel: string;
  gap: string;
  threat: string;
  mitigation: string;
}

interface ProcessedAssessment {
  _id: string;
  company: string;
  category: string;
  date: string;
  analyses: QuestionAnalysis[];
  riskMatrix: { likelihood: number; impact: number; count: number }[];
}

export default function RiskMatrixPage() {
  const [assessments, setAssessments] = useState<ProcessedAssessment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProcessedAssessments();

    let es: EventSource | null = null;
    if (typeof window !== "undefined" && "EventSource" in window) {
      try {
        es = new EventSource("/api/notifications/stream");
        es.addEventListener("analysis", (ev: MessageEvent) => {
          try {
            JSON.parse(ev.data);
            fetchProcessedAssessments();
          } catch {
            fetchProcessedAssessments();
          }
        });
        es.onopen = () => console.debug("RiskMatrix SSE connected");
        es.onerror = () => {
          console.debug("RiskMatrix SSE error, closing");
          if (es) {
            es.close();
            es = null;
          }
        };
      } catch {
        es = null;
      }
    }

    return () => {
      if (es) es.close();
    };
  }, []);

  const fetchProcessedAssessments = async () => {
    try {
      const res = await fetch("/api/analysis/processed");
      const data = await res.json();
      const list =
        data.success && Array.isArray(data.assessments)
          ? data.assessments
          : [];
      setAssessments(list);
      if (list.length > 0) {
        setSelectedId(list[0]._id);
      } else {
        setSelectedId(null);
      }
    } catch (err) {
      console.error("Failed to load assessments", err);
      setAssessments([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  };

  const selected =
    assessments.find((a) => a._id === selectedId) || null;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Risk Matrix</h1>
          <button
            onClick={fetchProcessedAssessments}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition font-medium"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Assessment Selector & Matrix */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          {/* Selector */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-4">
               Select Assessment
            </h3>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Assessment
                </label>
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(e.target.value || null)}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-md border border-slate-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Select assessment --</option>
                  {assessments.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.company || "Unknown company"} —{" "}
                      {a.date
                        ? new Date(a.date).toLocaleDateString()
                        : "No date"}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-slate-400">
                {assessments.length} total assessment{assessments.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Matrix Display */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-slate-400">Loading assessments...</div>
            </div>
          ) : !selected ? (
            <div className="bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-lg p-12 text-center">
              <div className="text-6xl mb-4 opacity-30"></div>
              <p className="text-white font-semibold mb-2">
                No assessment selected
              </p>
              <p className="text-slate-400 text-sm">
                Select an assessment above to visualize its risk matrix, or
                analyze questionnaires to generate new data.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Assessment Summary */}
              <div className="bg-slate-900/50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Company</p>
                  <p className="text-white font-medium text-sm">
                    {selected.company || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Category</p>
                  <p className="text-white font-medium text-sm">
                    {selected.category || "Uncategorized"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Date</p>
                  <p className="text-white font-medium text-sm">
                    {selected.date
                      ? new Date(selected.date).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">
                    Questions Analyzed
                  </p>
                  <p className="text-white font-medium text-sm">
                    {(selected.analyses || []).length}
                  </p>
                </div>
              </div>

              {/* Risk Matrix Component */}
              <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700 overflow-x-auto">
                <h3 className="text-lg font-bold text-white mb-4">
                  Risk Distribution
                </h3>
                <RiskMatrix data={selected.riskMatrix} />
              </div>

              {/* Matrix Legend */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <p className="text-sm font-medium text-white mb-3">
                  How to read this matrix:
                </p>
                <div className="text-xs text-slate-300 space-y-2">
                  <p>
                    • <span className="font-medium">X-axis (Likelihood):</span>{" "}
                    Probability of risk occurring (1-5 scale)
                  </p>
                  <p>
                    • <span className="font-medium">Y-axis (Impact):</span>{" "}
                    Severity of impact if risk occurs (1-5 scale)
                  </p>
                  <p>
                    • <span className="font-medium">Cell values:</span> Number
                    of questions in that likelihood/impact combination
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}