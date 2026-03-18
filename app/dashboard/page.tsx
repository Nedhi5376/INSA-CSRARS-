"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Layout from "../components/Layout";
import { RiskCharts, RiskVisualizationData } from "../components/RiskCharts";

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

const RISK_COLORS = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#eab308",
  low: "#16a34a",
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [processedAssessments, setProcessedAssessments] =
    useState<ProcessedAssessment[]>([]);

  const [companyFilter, setCompanyFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [questionnaireFilter, setQuestionnaireFilter] = useState("");
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]); // NEW

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchProcessedAssessments();
      fetchCompanies();
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

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/analysis/processed");
      const data = await res.json();
      if (data.success && Array.isArray(data.assessments)) {
        const companies = Array.from(
          new Set(
            data.assessments
              .map((assessment: ProcessedAssessment) => assessment.company)
              .filter((company: string) => company)
          )
        ) as string[];
        setAvailableCompanies(companies);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  const fetchProcessedAssessments = async () => {
    try {
      const res = await fetch("/api/analysis/processed");
      const data = await res.json();
      const assessments: ProcessedAssessment[] =
        data.success && Array.isArray(data.assessments) ? data.assessments : [];
      setProcessedAssessments(assessments);

      // build available dates for dropdown
      const dates = Array.from(
        new Set(
          assessments
            .map((a) => a.date)
            .filter((d): d is string => Boolean(d))
        )
      ).sort();
      setAvailableDates(dates);
    } catch (error) {
      console.error("Error:", error);
      setProcessedAssessments([]);
      setAvailableDates([]);
    }
  };

  const filterItems = (items: ProcessedAssessment[]) => {
    return items.filter((item) => {
      if (!item) return false;

      const matchCompany =
        !companyFilter ||
        (item.company || "")
          .toLowerCase()
          .includes(companyFilter.toLowerCase());

      const matchDate = !dateFilter || item.date === dateFilter;

      const matchQuestionnaire =
        !questionnaireFilter || item._id === questionnaireFilter;

      // removed category + risk level checks

      return matchCompany && matchDate && matchQuestionnaire;
    });
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

  const filteredAssessments = filterItems(processedAssessments).sort(
    (a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    }
  );

  const filteredAssessmentsForFilters = processedAssessments.filter((a) => {
    const matchCompany =
      !companyFilter ||
      (a.company || "").toLowerCase().includes(companyFilter.toLowerCase());
    const matchDate = !dateFilter || a.date === dateFilter;
    return matchCompany && matchDate;
  });

  const filteredQuestionnaireOptions = Array.from(
    new Set(filteredAssessmentsForFilters.map((a) => a._id).filter(Boolean))
  );

  const riskData: RiskVisualizationData[] = (() => {
    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    filteredAssessments.forEach((assessment) => {
      assessment.analyses?.forEach((analysis) => {
        const level = (analysis.riskLevel || "").toLowerCase();
        if (level === "critical") counts.critical += 1;
        else if (level === "high") counts.high += 1;
        else if (level === "medium") counts.medium += 1;
        else if (level === "low") counts.low += 1;
      });
    });

    return [
      { level: "Critical", count: counts.critical, color: RISK_COLORS.critical },
      { level: "High", count: counts.high, color: RISK_COLORS.high },
      { level: "Medium", count: counts.medium, color: RISK_COLORS.medium },
      { level: "Low", count: counts.low, color: RISK_COLORS.low },
    ].filter((item) => item.count > 0);
  })();

  const hasAnyFilter =
    !!companyFilter || !!dateFilter || !!questionnaireFilter;

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Risk Dashboard</h1>

        {/* Filters */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-bold text-white mb-4">
            Assessment Filters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Company */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Company
              </label>
              <select
                value={companyFilter}
                onChange={(e) => {
                  setCompanyFilter(e.target.value);
                  setQuestionnaireFilter("");
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
              >
                <option value="">Select company…</option>
                {availableCompanies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            </div>

            {/* Assessment date as dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Assessment date
              </label>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setQuestionnaireFilter("");
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
              >
                <option value="">All dates</option>
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </div>

            {/* Questionnaire */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Questionnaire ID
              </label>
              <select
                value={questionnaireFilter}
                onChange={(e) => setQuestionnaireFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
              >
                <option value="">All questionnaires</option>
                {filteredQuestionnaireOptions.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>

            {/* Chart Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Chart type
              </label>
              <select
                value={chartType}
                onChange={(e) =>
                  setChartType(e.target.value as "pie" | "bar")
                }
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
              >
                <option value="pie">Pie Chart</option>
                <option value="bar">Bar Chart</option>
              </select>
            </div>
          </div>
        </div>

        {/* Chart / Placeholder */}
        {hasAnyFilter && riskData.length > 0 ? (
          <RiskCharts
            data={riskData}
            chartType={chartType}
            companyName={companyFilter || "All Companies"}
            date={dateFilter || ""}
            assessmentData={filteredAssessments.flatMap(
              (a) => a.analyses || []
            )}
          />
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-10 text-center text-slate-400">
            <p className="text-lg font-semibold text-white mb-2">
              No assessment selected
            </p>
            <p className="text-sm">
              Please apply at least one filter (Company, Assessment date, or Questionnaire) to view the risk assessment overview.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
