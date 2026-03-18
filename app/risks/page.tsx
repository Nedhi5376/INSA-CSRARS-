"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Layout from "../components/Layout";

interface QuestionAnalysis {
  questionId: string; // backend is number, but comes as string here
  level: string;
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
  _id: string; // RiskAnalysis _id
  company: string;
  category: string;
  date: string;
  analyses: QuestionAnalysis[];
}

type SortOrder = "newest" | "oldest";

interface EditingState {
  analysisId: string;
  questionId: string;
  level: string;
  likelihood: string;
  impact: string;
  gap: string;
  threat: string;
  mitigation: string;
  impactLabel: string;
  impactDescription: string;
}

export default function RiskRegisterFromAssessmentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<ProcessedAssessment[]>([]);

  const [companyFilter, setCompanyFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [riskLevelFilter, setRiskLevelFilter] = useState("");

  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchAssessments();
    }
  }, [status, router]);

  const fetchAssessments = async () => {
    try {
      const res = await fetch("/api/analysis/processed");
      const data = await res.json();

      const list: ProcessedAssessment[] = Array.isArray(data.assessments)
        ? data.assessments
        : [];

      setAssessments(list);

      const companies = Array.from(
        new Set(list.map((a) => a.company).filter((c): c is string => !!c))
      );
      setAvailableCompanies(companies);

      const categories = Array.from(
        new Set(list.map((a) => a.category).filter((c): c is string => !!c))
      );
      setAvailableCategories(categories);

      setLoading(false);
    } catch (error) {
      console.error("Error loading assessments", error);
      setAssessments([]);
      setLoading(false);
    }
  };

  // 1) sort assessments by date
  const sortedAssessments = useMemo(() => {
    const copy = [...assessments];
    copy.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });
    return copy;
  }, [assessments, sortOrder]);

  // 2) apply company/category and date range filters
  const filteredAssessments = useMemo(() => {
    return sortedAssessments.filter((a) => {
      const matchCompany =
        !companyFilter ||
        (a.company || "").toLowerCase() === companyFilter.toLowerCase();
      const matchCategory =
        !categoryFilter ||
        (a.category || "").toLowerCase() === categoryFilter.toLowerCase();

      if (!matchCompany || !matchCategory) return false;

      const d = new Date(a.date);
      if (startDate) {
        const start = new Date(startDate);
        if (d < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }

      return true;
    });
  }, [sortedAssessments, companyFilter, categoryFilter, startDate, endDate]);

  // 3) flatten to rows and filter by risk level
  const rows: Array<
    QuestionAnalysis & {
      company: string;
      category: string;
      date: string;
      analysisId: string;
    }
  > = filteredAssessments
    .flatMap((a) =>
      (a.analyses || []).map((q) => ({
        ...q,
        company: a.company,
        category: a.category,
        date: a.date,
        analysisId: a._id,
      }))
    )
    .filter((q) => {
      if (!riskLevelFilter) return true;
      return (q.riskLevel || "").toLowerCase() === riskLevelFilter.toLowerCase();
    });

  const startEditing = (row: {
    analysisId: string;
    questionId: string;
    level: string;
    likelihood: number;
    impact: number;
    gap: string;
    threat: string;
    mitigation: string;
    impactLabel?: string;
    impactDescription?: string;
  }) => {
    setEditing({
      analysisId: row.analysisId,
      questionId: row.questionId,
      level: row.level,
      likelihood: String(row.likelihood ?? ""),
      impact: String(row.impact ?? ""),
      gap: row.gap ?? "",
      threat: row.threat ?? "",
      mitigation: row.mitigation ?? "",
      impactLabel: row.impactLabel ?? "",
      impactDescription: row.impactDescription ?? "",
    });
  };

  const cancelEditing = () => {
    setEditing(null);
  };

  const saveEdit = async () => {
    if (!editing) return;

    try {
      setSaving(true);

      const res = await fetch("/api/analysis/processed/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: editing.analysisId,
          level: editing.level,
          questionId: Number(editing.questionId),
          likelihood:
            editing.likelihood.trim() === ""
              ? undefined
              : Number(editing.likelihood),
          impact:
            editing.impact.trim() === ""
              ? undefined
              : Number(editing.impact),
          gap: editing.gap,
          threat: editing.threat,
          mitigation: editing.mitigation,
          impactLabel: editing.impactLabel,
          impactDescription: editing.impactDescription,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        console.error("Failed to update assessment", data);
        setSaving(false);
        return;
      }

      const updatedAssessment = data.assessment as ProcessedAssessment;

      setAssessments((prev) =>
        prev.map((a) =>
          a._id === updatedAssessment._id ? updatedAssessment : a
        )
      );

      setSaving(false);
      setEditing(null);
    } catch (error) {
      console.error("Error updating assessment", error);
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading assessments...</div>
        </div>
      </Layout>
    );
  }

  if (!session) return null;

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">
          Risk Register (from Assessments)
        </h1>

        {/* Filters */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Company */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Company
              </label>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
              >
                <option value="">All</option>
                {availableCompanies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
              >
                <option value="">All</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Risk level */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Risk level
              </label>
              <select
                value={riskLevelFilter}
                onChange={(e) => setRiskLevelFilter(e.target.value)}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
              >
                <option value="">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Sort + date range */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sort order */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Sort by date
              </label>
              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as SortOrder)
                }
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
              >
                <option value="newest">Newest to oldest</option>
                <option value="oldest">Oldest to newest</option>
              </select>
            </div>

            {/* Start date */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
              />
            </div>

            {/* End date */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                End date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Table + editing */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-400">
              No records match the current filters.
            </p>
          ) : (
            <table className="min-w-full text-xs text-left border-collapse text-slate-100">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="py-2 pr-3">Company</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Level</th>
                  <th className="py-2 pr-3">Question</th>
                  <th className="py-2 pr-3">Answer</th>
                  <th className="py-2 pr-3">Likelihood</th>
                  <th className="py-2 pr-3">Impact</th>
                  <th className="py-2 pr-3">Risk Score</th>
                  <th className="py-2 pr-3">Risk Level</th>
                  <th className="py-2 pr-3">Gap</th>
                  <th className="py-2 pr-3">Threat</th>
                  <th className="py-2 pr-3">Mitigation</th>
                  <th className="py-2 pr-3">Impact Label</th>
                  <th className="py-2 pr-3">Impact Description</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const isEditing =
                    editing &&
                    editing.analysisId === r.analysisId &&
                    editing.questionId === r.questionId &&
                    editing.level === r.level;

                  return (
                    <tr
                      key={`${r.analysisId}-${r.questionId}-${idx}`}
                      className="border-b border-slate-700 last:border-b-0"
                    >
                      <td className="py-2 pr-3">{r.company}</td>
                      <td className="py-2 pr-3">{r.category}</td>
                      <td className="py-2 pr-3">
                        {r.date
                          ? new Date(r.date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="py-2 pr-3">{r.level}</td>
                      <td className="py-2 pr-3">{r.question}</td>
                      <td className="py-2 pr-3">{r.answer}</td>

                      {/* Likelihood */}
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            max={5}
                            value={editing.likelihood}
                            onChange={(e) =>
                              setEditing((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      likelihood: e.target.value,
                                    }
                                  : prev
                              )
                            }
                            className="w-16 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-white"
                          />
                        ) : (
                          r.likelihood
                        )}
                      </td>

                      {/* Impact */}
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            max={5}
                            value={editing.impact}
                            onChange={(e) =>
                              setEditing((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      impact: e.target.value,
                                    }
                                  : prev
                              )
                            }
                            className="w-16 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-white"
                          />
                        ) : (
                          r.impact
                        )}
                      </td>

                      {/* Risk score / level (readonly, recalculated backend) */}
                      <td className="py-2 pr-3">{r.riskScore}</td>
                      <td className="py-2 pr-3">{r.riskLevel}</td>

                      {/* Gap */}
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editing.gap}
                            onChange={(e) =>
                              setEditing((prev) =>
                                prev
                                  ? { ...prev, gap: e.target.value }
                                  : prev
                              )
                            }
                            className="w-40 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-white"
                          />
                        ) : (
                          r.gap
                        )}
                      </td>

                      {/* Threat */}
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editing.threat}
                            onChange={(e) =>
                              setEditing((prev) =>
                                prev
                                  ? { ...prev, threat: e.target.value }
                                  : prev
                              )
                            }
                            className="w-40 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-white"
                          />
                        ) : (
                          r.threat
                        )}
                      </td>

                      {/* Mitigation */}
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editing.mitigation}
                            onChange={(e) =>
                              setEditing((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      mitigation: e.target.value,
                                    }
                                  : prev
                              )
                            }
                            className="w-40 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-white"
                          />
                        ) : (
                          r.mitigation
                        )}
                      </td>

                      {/* Impact label */}
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editing.impactLabel}
                            onChange={(e) =>
                              setEditing((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      impactLabel: e.target.value,
                                    }
                                  : prev
                              )
                            }
                            className="w-32 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-white"
                          />
                        ) : (
                          r.impactLabel
                        )}
                      </td>

                      {/* Impact description */}
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editing.impactDescription}
                            onChange={(e) =>
                              setEditing((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      impactDescription: e.target.value,
                                    }
                                  : prev
                              )
                            }
                            className="w-64 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-white"
                          />
                        ) : (
                          r.impactDescription
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs"
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={saving}
                              className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              startEditing({
                                analysisId: r.analysisId,
                                questionId: r.questionId,
                                level: r.level,
                                likelihood: r.likelihood,
                                impact: r.impact,
                                gap: r.gap,
                                threat: r.threat,
                                mitigation: r.mitigation,
                                impactLabel: r.impactLabel,
                                impactDescription: r.impactDescription,
                              })
                            }
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
