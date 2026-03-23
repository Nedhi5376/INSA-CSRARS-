"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Layout from "../components/Layout";
import { RiskCharts, RiskVisualizationData } from "../components/RiskCharts";
import RiskHeatmap from "../components/RiskHeatmap";
import TrendAnalysis from "../components/TrendAnalysis";
import PerformanceMetrics from "../components/PerformanceMetrics";
import RiskRecommendations from "../components/RiskRecommendations";

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
  level: string;
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
  const [reportLevelFilter, setReportLevelFilter] = useState<string>("all");
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const ROLE_PERMISSIONS: Record<string, string[]> = {
    "Risk Analyst": ["strategic", "tactical", "operational", "human_awareness"],
    "Director": ["strategic"],
    "Division Head": ["tactical"],
    "Staff": ["operational"],
  };

  const availableLevels = session?.user?.role ? ROLE_PERMISSIONS[session.user.role] || ["operational"] : ["operational"];

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchProcessedAssessments();
      fetchCompanies();
      
      // Auto-select level if only one is available for the role
      if (availableLevels.length === 1 && reportLevelFilter === "all") {
        setReportLevelFilter(availableLevels[0]);
      }
      
      setLoading(false);
    }
  }, [status, router, availableLevels]);

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
      const matchQuestionnaire = !questionnaireFilter || item._id === questionnaireFilter;

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
    (a: ProcessedAssessment, b: ProcessedAssessment) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    }
  );

  const filteredAssessmentsForFilters = processedAssessments.filter((a: ProcessedAssessment) => {
    const matchCompany =
      !companyFilter ||
      (a.company || "").toLowerCase().includes(companyFilter.toLowerCase());
    const matchDate = !dateFilter || a.date === dateFilter;
    return matchCompany && matchDate;
  });

  const allFilteredRisks = filteredAssessments.flatMap((a: ProcessedAssessment) => {
    const allAnalyses = a.analyses || [];
    if (reportLevelFilter === "all") return allAnalyses;
    return allAnalyses.filter(item => item.level === reportLevelFilter);
  });

  const riskData: RiskVisualizationData[] = (() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    allFilteredRisks.forEach((analysis) => {
      const level = (analysis.riskLevel || "").toLowerCase();
      if (level === "critical") counts.critical += 1;
      else if (level === "high") counts.high += 1;
      else if (level === "medium") counts.medium += 1;
      else if (level === "low") counts.low += 1;
    });

    return [
      { level: "Critical", count: counts.critical, color: RISK_COLORS.critical },
      { level: "High", count: counts.high, color: RISK_COLORS.high },
      { level: "Medium", count: counts.medium, color: RISK_COLORS.medium },
      { level: "Low", count: counts.low, color: RISK_COLORS.low },
    ].filter((item) => item.count > 0);
  })();

  const heatmapData = (() => {
    const counts: Record<string, number> = {};
    allFilteredRisks.forEach((item) => {
      const key = `${item.likelihood}-${item.impact}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([key, count]) => {
      const [likelihood, impact] = key.split("-").map(Number);
      return { likelihood, impact, count };
    });
  })();

  const trendData = processedAssessments.map((a: ProcessedAssessment) => {
    const relevantAnalyses = reportLevelFilter === "all" 
      ? (a.analyses || [])
      : (a.analyses || []).filter(item => item.level === reportLevelFilter);
      
    const totalScore = relevantAnalyses.reduce((sum, item) => sum + (item.riskScore || 0), 0);
    const avgScore = relevantAnalyses.length ? totalScore / relevantAnalyses.length : 0;
    return {
      date: a.date,
      score: parseFloat(avgScore.toFixed(2)),
    };
  });

  const performanceData = (() => {
    const categories: Record<string, { total: number; sum: number }> = {};
    allFilteredRisks.forEach((item) => {
      const cat = item.level && item.level !== 'all' ? item.level.replace('_', ' ').toUpperCase() : "General";
      if (!categories[cat]) categories[cat] = { total: 0, sum: 0 };
      categories[cat].total += 1;
      const compliance = ((25 - (item.riskScore || 0)) / 25) * 100;
      categories[cat].sum += compliance;
    });
    return Object.entries(categories).map(([cat, data]) => ({
      category: cat,
      score: Math.round(data.sum / data.total),
    })).filter(m => m.category);
  })();

  const hasAnyFilter = !!companyFilter || !!dateFilter || !!questionnaireFilter;

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Risk Dashboard</h1>

        {/* Global Level Switcher and Filters Core */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Assessment Filters</h2>
              <p className="text-xs text-slate-400">Select parameters to drill down into risk data</p>
            </div>
            
            <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-700 shrink-0">
              {availableLevels.length > 1 && (
                <button
                  onClick={() => setReportLevelFilter("all")}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all uppercase tracking-wider ${
                    reportLevelFilter === "all" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-white"
                  }`}
                >
                  All
                </button>
              )}
              {availableLevels.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setReportLevelFilter(lvl)}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all uppercase tracking-wider ${
                    reportLevelFilter === lvl ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-white"
                  }`}
                >
                  {lvl.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Company</label>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="">All Companies</option>
                {availableCompanies.map((company) => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Assessment Date</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="">All Dates</option>
                {availableDates.map((date) => (
                  <option key={date} value={date}>{new Date(date).toLocaleDateString()}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Questionnaire ID</label>
              <select
                value={questionnaireFilter}
                onChange={(e) => setQuestionnaireFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:ring-2 focus:ring-blue-500 transition-all font-mono"
              >
                <option value="">All Questionnaires</option>
                {(companyFilter || dateFilter
                  ? filteredAssessmentsForFilters
                  : processedAssessments
                ).map((a: ProcessedAssessment) => (
                  <option key={a._id} value={a._id}>{a._id.substring(0, 8)}... ({a.company})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Visualization Type</label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as "pie" | "bar")}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="pie">Pie Chart</option>
                <option value="bar">Bar Chart</option>
              </select>
            </div>
          </div>
        </div>

        {hasAnyFilter && riskData.length > 0 ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <RiskCharts
                data={riskData}
                chartType={chartType}
                companyName={companyFilter || "All Companies"}
                date={dateFilter || ""}
                assessmentData={allFilteredRisks}
              />
              <RiskHeatmap data={heatmapData} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <TrendAnalysis data={trendData} />
              <PerformanceMetrics data={performanceData} />
            </div>

            <div className="grid grid-cols-1 gap-8">
              <RiskRecommendations risks={allFilteredRisks} />
            </div>

            {session?.user?.role === "Director" && (
              <div className="p-6 bg-blue-900/10 border border-blue-500/30 rounded-lg shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                  <h4 className="text-blue-400 font-bold uppercase tracking-widest text-sm">Strategic Executive Insights</h4>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  As Director, your dashboard includes consolidated strategic data. 
                  Currently viewing <strong>{allFilteredRisks.length}</strong> analysis items across 
                  <strong>{reportLevelFilter.replace("_", " ").toUpperCase()}</strong>.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-20 text-center text-slate-400 shadow-xl">
            <div className="mb-4 flex justify-center">
              <svg className="w-16 h-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-xl font-bold text-white mb-2">Ready to analyze data?</p>
            <p className="text-sm max-w-md mx-auto">Select a Company or Date from the filters above to load the interactive risk dashboard.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
