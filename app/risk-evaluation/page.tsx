"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Layout from "../components/Layout";

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
  impactLabel?: string;
  impactDescription?: string;
}

interface ProcessedAssessment {
  _id: string;
  company: string;
  category: string;
  date: string;
  analyses: QuestionAnalysis[];
  riskMatrix: { likelihood: number; impact: number; count: number }[];
}

type MessageState =
  | {
      type: "success" | "error";
      text: string;
    }
  | null;

export default function ProcessedAssessmentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [processedAssessments, setProcessedAssessments] =
    useState<ProcessedAssessment[]>([]);
  const [message, setMessage] = useState<MessageState>(null);

  const [viewingAssessment, setViewingAssessment] =
    useState<ProcessedAssessment | null>(null);
  const [viewingEdit, setViewingEdit] = useState<{
    assessmentId: string;
    level: string;
    questionId: number | string;
    current: any;
  } | null>(null);

  const [reanalyzing, setReanalyzing] = useState(false);

  const [companyFilter, setCompanyFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchProcessedAssessments();
      setLoading(false);
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let es: EventSource | null = null;
    if (typeof window !== "undefined" && "EventSource" in window) {
      try {
        es = new EventSource("/api/notifications/stream");
        es.addEventListener("analysis", () => {
          fetchProcessedAssessments();
        });
        es.onopen = () => console.debug("SSE connected");
        es.onerror = () => {
          console.debug("SSE error, falling back to polling");
          if (es) {
            es.close();
            es = null;
          }
        };
      } catch {
        es = null;
      }
    }

    const interval = setInterval(() => {
      if (!es) {
        fetchProcessedAssessments();
      }
    }, 15000);

    return () => {
      if (es) es.close();
      clearInterval(interval);
    };
  }, [status]);

  const fetchProcessedAssessments = async () => {
    try {
      const res = await fetch("/api/analysis/processed");
      const data = await res.json();
      const assessments: ProcessedAssessment[] =
        data.success && Array.isArray(data.assessments) ? data.assessments : [];
      setProcessedAssessments(assessments);

      const companies = Array.from(
        new Set(
          assessments
            .map((a) => a.company)
            .filter((c): c is string => !!c)
        )
      );
      setAvailableCompanies(companies);
    } catch (error) {
      console.error("Error:", error);
      setProcessedAssessments([]);
      setAvailableCompanies([]);
    }
  };

  const openAssessmentModal = (assessment: ProcessedAssessment) => {
    setViewingAssessment(assessment);
  };

  const closeAssessmentModal = () => setViewingAssessment(null);

  const closeEditModal = () => setViewingEdit(null);

  const saveEditedAnalysis = async (payload: any) => {
    try {
      const res = await fetch("/api/analysis/update-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.success) {
        fetchProcessedAssessments();
        closeEditModal();
        setMessage({ type: "success", text: "Analysis updated successfully" });
      } else {
        setMessage({
          type: "error",
          text: "Failed to save edits: " + (d.error || ""),
        });
      }
    } catch (err) {
      console.error("Save edit error", err);
      setMessage({ type: "error", text: "Error saving edits" });
    }
  };

  const handleReanalyze = async (assessmentId: string) => {
    if (
      !confirm(
        "Re-analyze this assessment? This will replace the existing analysis with fresh AI results."
      )
    )
      return;

    setReanalyzing(true);
    try {
      const res = await fetch("/api/analysis/reanalyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId: assessmentId }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({
          type: "success",
          text: "Re-analysis completed successfully",
        });
        fetchProcessedAssessments();
        closeAssessmentModal();
      } else {
        setMessage({
          type: "error",
          text: data.error || "Re-analysis failed",
        });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "Error during re-analysis" });
    } finally {
      setReanalyzing(false);
    }
  };

  const filterItems = <T extends { company?: string; date?: string }>(
    items: T[]
  ) => {
    return items.filter((item) => {
      if (!item) return false;
      const matchCompany = !companyFilter || item.company === companyFilter;
      const matchDate = !dateFilter || item.date === dateFilter;
      return matchCompany && matchDate;
    });
  };

  const getRiskLevelColorClasses = (level: string) => {
    switch (level?.toLowerCase()) {
      case "critical":
        return "from-red-600 to-red-400 border-red-500 text-red-100";
      case "high":
        return "from-orange-600 to-orange-400 border-orange-500 text-orange-100";
      case "medium":
        return "from-yellow-600 to-yellow-400 border-yellow-500 text-yellow-100";
      case "low":
        return "from-green-600 to-green-400 border-green-500 text-green-100";
      default:
        return "from-slate-600 to-slate-500 border-slate-500 text-slate-100";
    }
  };

  const getRiskLevelBadgeClasses = (level: string) => {
    switch (level?.toLowerCase()) {
      case "critical":
        return "bg-red-900/50 text-red-200 border-red-600";
      case "high":
        return "bg-orange-900/50 text-orange-200 border-orange-600";
      case "medium":
        return "bg-yellow-900/50 text-yellow-200 border-yellow-600";
      case "low":
        return "bg-green-900/50 text-green-200 border-green-600";
      default:
        return "bg-slate-900/50 text-slate-200 border-slate-600";
    }
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 16) return "bg-red-500";
    if (score >= 9) return "bg-orange-500";
    if (score >= 4) return "bg-yellow-400";
    return "bg-green-500";
  };

  if (status === "loading" || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!session) return null;

  const filteredAssessments = filterItems(processedAssessments).sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">
          Risk Evaluation Results
        </h1>

        {message && (
          <div
            className={`px-4 py-2 rounded ${
              message.type === "success"
                ? "bg-green-900/40 text-green-300 border border-green-700"
                : "bg-red-900/40 text-red-300 border border-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Filters */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Filter List</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                Company Name
              </label>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
              >
                <option value="">All Companies</option>
                {availableCompanies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Assessments List */}
        <div className="space-y-4">
          {filteredAssessments.length === 0 ? (
            <div className="bg-slate-800 border-2 border-dashed border-slate-700 rounded-lg p-12 text-center">
              <p className="text-white font-semibold mb-2">
                No processed assessments
              </p>
              <p className="text-slate-400">
                Analyze questionnaires to see results here
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-400 mb-4">
                Showing {filteredAssessments.length} of{" "}
                {processedAssessments.length} evaluated assessments.
              </p>
              <div className="space-y-4">
                {filteredAssessments.map((assessment) => (
                  <div
                    key={assessment._id}
                    className="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-blue-500 hover:shadow-lg transition cursor-pointer"
                    onClick={() => openAssessmentModal(assessment)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-2">
                          {assessment.company || "Unknown Company"}
                        </h3>
                        <div className="space-y-1 text-sm text-slate-300">
                          <p>
                            <span className="font-medium">Category:</span>{" "}
                            {assessment.category || "Uncategorized"}
                          </p>
                          <p>
                            <span className="font-medium">Date:</span>{" "}
                            {assessment.date
                              ? new Date(
                                  assessment.date
                                ).toLocaleDateString()
                              : "N/A"}
                          </p>
                          <p>
                            <span className="font-medium">Questions:</span>{" "}
                            {(assessment.analyses || []).length} analyzed
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openAssessmentModal(assessment);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition font-medium text-sm"
                        >
                          View Details
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchProcessedAssessments();
                          }}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition font-medium text-sm"
                        >
                          Refresh
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

      {/* Assessment Details Modal */}
      {viewingAssessment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {viewingAssessment.company}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {viewingAssessment.category}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  {viewingAssessment.date
                    ? new Date(viewingAssessment.date).toLocaleString()
                    : ""}
                </p>
              </div>
              <button
                onClick={closeAssessmentModal}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-sm text-slate-400 mb-2">
                  Total Questions evaluated:
                </p>
                <p className="text-3xl font-bold text-white">
                  {(viewingAssessment.analyses || []).length}
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-4">
                  Questions And evaluations
                </h3>
                <div className="space-y-4">
                  {(viewingAssessment.analyses || []).map((a, idx) => {
                    const score = a.riskScore ?? a.likelihood * a.impact;
                    const scorePercent = Math.min(
                      100,
                      Math.max(0, (score / 25) * 100)
                    );

                    return (
                      <div
                        key={idx}
                        className="bg-slate-900/50 rounded-lg p-4 border border-slate-700"
                      >
                        <div className="mb-4">
                          <p className="text-xs text-slate-400 mb-1">
                            Question {idx + 1}
                          </p>
                          <p className="text-white font-medium">
                            {a.question}
                          </p>
                        </div>

                        <div className="mb-4">
                          <p className="text-xs text-slate-400 mb-1">Answer</p>
                          <p className="text-slate-300">{a.answer}</p>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
                          <div className="rounded-lg border bg-gradient-to-br from-slate-800 to-slate-700 border-slate-600 p-3">
                            <p className="text-xs text-slate-400 mb-1">
                              Likelihood
                            </p>
                            <p className="text-2xl font-bold text-white">
                              {a.likelihood ?? 0}
                              <span className="text-sm text-slate-400">
                                /5
                              </span>
                            </p>
                            <div className="mt-2 h-1.5 bg-slate-700 rounded-full">
                              <div
                                className="h-1.5 rounded-full bg-blue-500"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    ((a.likelihood ?? 0) / 5) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="rounded-lg border bg-gradient-to-br from-slate-800 to-slate-700 border-slate-600 p-3">
                            <p className="text-xs text-slate-400 mb-1">
                              Impact
                            </p>
                            <p className="text-2xl font-bold text-white">
                              {a.impact ?? 0}
                              <span className="text-sm text-slate-400">
                                /5
                              </span>
                            </p>
                            <div className="mt-2 h-1.5 bg-slate-700 rounded-full">
                              <div
                                className="h-1.5 rounded-full bg-purple-500"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    ((a.impact ?? 0) / 5) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="rounded-lg border bg-gradient-to-br from-slate-800 to-slate-700 border-slate-600 p-3">
                            <p className="text-xs text-slate-400 mb-1">
                              Risk Score
                            </p>
                            <p className="text-2xl font-bold text-white">
                              {score}
                            </p>
                            <div className="mt-2 h-1.5 bg-slate-700 rounded-full">
                              <div
                                className={`h-1.5 rounded-full ${getScoreBarColor(
                                  score
                                )}`}
                                style={{ width: `${scorePercent}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[10px] text-slate-400">
                              Scale 0 - 25
                            </p>
                          </div>

                          <div
                            className={`rounded-lg border bg-gradient-to-br ${getRiskLevelColorClasses(
                              a.riskLevel
                            )} p-3`}
                          >
                            <p className="text-xs mb-1 opacity-80">
                              Risk Level
                            </p>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${getRiskLevelBadgeClasses(
                                a.riskLevel
                              )}`}
                            >
                              {(a.riskLevel || "Unknown").toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Gap, threat, impact description */}
                        <div className="space-y-3 mb-4">
                          {a.gap && a.gap !== "" && (
                            <div>
                              <p className="text-xs text-slate-400 mb-1">
                                Gap
                              </p>
                              <p className="text-slate-300 text-sm">{a.gap}</p>
                            </div>
                          )}
                          {a.threat && a.threat !== "" && (
                            <div>
                              <p className="text-xs text-slate-400 mb-1">
                                Threat
                              </p>
                              <p className="text-slate-300 text-sm">
                                {a.threat}
                              </p>
                            </div>
                          )}
                          {a.impactDescription &&
                            a.impactDescription !== "" && (
                              <div>
                                <p className="text-xs text-slate-400 mb-1">
                                  Impact Description
                                </p>
                                <p className="text-slate-300 text-sm">
                                  {a.impactDescription}
                                </p>
                              </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              setViewingEdit({
                                assessmentId: viewingAssessment._id,
                                level: a.riskLevel,
                                questionId: idx,
                                current: a,
                              })
                            }
                            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md text-sm font-medium transition"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer with Re-analyze */}
            <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6 flex justify-between gap-3">
              <div className="flex gap-3">
                <button
                  onClick={() => handleReanalyze(viewingAssessment._id)}
                  disabled={reanalyzing}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {reanalyzing ? "Re-analyzing..." : "Re-analyze"}
                </button>
              </div>
              <button
                onClick={closeAssessmentModal}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Analysis Modal (unchanged) */}
      {viewingEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-2xl w-full">
            <div className="bg-slate-800 border-b border-slate-700 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Edit Analysis</h2>
              <button
                onClick={closeEditModal}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Likelihood (1-5)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  defaultValue={viewingEdit.current.likelihood}
                  id="edit-likelihood"
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-md border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Impact (1-5)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  defaultValue={viewingEdit.current.impact}
                  id="edit-impact"
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-md border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Gap
                </label>
                <textarea
                  defaultValue={viewingEdit.current.gap}
                  id="edit-gap"
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-md border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Threat
                </label>
                <textarea
                  defaultValue={viewingEdit.current.threat}
                  id="edit-threat"
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-md border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Mitigation
                </label>
                <textarea
                  defaultValue={viewingEdit.current.mitigation}
                  id="edit-mitigation"
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-md border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Impact Description
                </label>
                <textarea
                  defaultValue={viewingEdit.current.impactDescription}
                  id="edit-impactDescription"
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-md border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-800 border-t border-slate-700 p-6 flex gap-3">
              <button
                onClick={async () => {
                  const likelihood = Number(
                    (
                      document.getElementById(
                        "edit-likelihood"
                      ) as HTMLInputElement
                    ).value
                  );
                  const impact = Number(
                    (
                      document.getElementById(
                        "edit-impact"
                      ) as HTMLInputElement
                    ).value
                  );
                  const gap = (
                    document.getElementById(
                      "edit-gap"
                    ) as HTMLTextAreaElement
                  ).value;
                  const threat = (
                    document.getElementById(
                      "edit-threat"
                    ) as HTMLTextAreaElement
                  ).value;
                  const mitigation = (
                    document.getElementById(
                      "edit-mitigation"
                    ) as HTMLTextAreaElement
                  ).value;
                  const impactDescription = (
                    document.getElementById(
                      "edit-impactDescription"
                    ) as HTMLTextAreaElement
                  ).value;

                  await saveEditedAnalysis({
                    assessmentId: viewingEdit.assessmentId,
                    questionIndex: viewingEdit.questionId,
                    likelihood,
                    impact,
                    gap,
                    threat,
                    mitigation,
                    impactDescription,
                  });
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition font-medium"
              >
                Save Changes
              </button>
              <button
                onClick={closeEditModal}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
