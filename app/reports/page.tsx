"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Layout from "../components/Layout";

type Assessment = {
  _id: string;
  company: string;
  category: string;
  date: string;
  summary?: {
    overall?: {
      totalQuestionsAnalyzed?: number;
      averageRiskScore?: number;
      averageInherentRiskScore?: number;
      averageResidualRiskScore?: number;
    };
  };
};

type GeneratedReport = {
  _id?: string;
  level: "strategic" | "tactical" | "operational";
  content: string;
  riskMatrix: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    veryLow?: number;
  };
};

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [selectedReport, setSelectedReport] = useState<GeneratedReport | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      void fetchAssessments();
    }
  }, [status, router]);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/analysis/processed");
      const data = await response.json();
      setAssessments(data.success && Array.isArray(data.assessments) ? data.assessments : []);
    } catch (error) {
      console.error("Failed to load assessments", error);
      setAssessments([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssessments = useMemo(() => {
    return assessments.filter((assessment) => {
      if (companyFilter && assessment.company !== companyFilter) return false;
      return true;
    });
  }, [assessments, companyFilter]);

  const companies = Array.from(new Set(assessments.map((assessment) => assessment.company))).sort();
  const selectedAssessment =
    filteredAssessments.find((assessment) => assessment._id === selectedAssessmentId) || null;

  const generateReport = async (level: "strategic" | "tactical" | "operational") => {
    if (!selectedAssessmentId) return;
    try {
      setWorking(true);
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId: selectedAssessmentId, level }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate report");
      }
      setSelectedReport(data.report);
    } catch (error) {
      console.error("Failed to generate report", error);
    } finally {
      setWorking(false);
    }
  };

  const downloadDocx = async () => {
    if (!selectedAssessmentId || !selectedAssessment) return;
    try {
      setWorking(true);
      const response = await fetch(
        `/api/reports/export?analysisId=${selectedAssessmentId}&format=DOCX`
      );
      if (!response.ok) throw new Error("Failed to generate DOCX");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `report-${selectedAssessment.company}.docx`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download DOCX", error);
    } finally {
      setWorking(false);
    }
  };

  const downloadXlsx = async () => {
    if (!selectedAssessmentId || !selectedAssessment) return;
    try {
      setWorking(true);
      const response = await fetch("/api/excelreport/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: selectedAssessmentId }),
      });
      if (!response.ok) throw new Error("Failed to generate XLSX");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `report-${selectedAssessment.company}.xlsx`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download XLSX", error);
    } finally {
      setWorking(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center text-slate-400">Loading...</div>
      </Layout>
    );
  }

  if (!session) return null;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Reports</h1>
          <p className="text-sm text-slate-400">
            Generate audience-specific reports and export assessment packages.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-700 bg-slate-800 p-6 md:grid-cols-2">
          <select
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value);
              setSelectedAssessmentId("");
              setSelectedReport(null);
            }}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white"
          >
            <option value="">All companies</option>
            {companies.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>

          <select
            value={selectedAssessmentId}
            onChange={(e) => {
              setSelectedAssessmentId(e.target.value);
              setSelectedReport(null);
            }}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white"
          >
            <option value="">Select assessment</option>
            {filteredAssessments.map((assessment) => (
              <option key={assessment._id} value={assessment._id}>
                {assessment.company} | {new Date(assessment.date).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>

        {selectedAssessment && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Company</p>
                <p className="font-medium text-white">{selectedAssessment.company}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Category</p>
                <p className="font-medium text-white">{selectedAssessment.category}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Average Risk</p>
                <p className="font-medium text-white">
                  {selectedAssessment.summary?.overall?.averageRiskScore ?? "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Inherent / Residual</p>
                <p className="font-medium text-white">
                  {selectedAssessment.summary?.overall?.averageInherentRiskScore ?? "N/A"} /{" "}
                  {selectedAssessment.summary?.overall?.averageResidualRiskScore ?? "N/A"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => generateReport("strategic")}
                disabled={working}
                className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                Strategic Report
              </button>
              <button
                onClick={() => generateReport("tactical")}
                disabled={working}
                className="rounded-md bg-sky-600 px-4 py-2 font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
              >
                Tactical Report
              </button>
              <button
                onClick={() => generateReport("operational")}
                disabled={working}
                className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                Operational Report
              </button>
              <button
                onClick={downloadDocx}
                disabled={working}
                className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                Download DOCX
              </button>
              <button
                onClick={downloadXlsx}
                disabled={working}
                className="rounded-md bg-amber-600 px-4 py-2 font-medium text-slate-900 transition hover:bg-amber-500 disabled:opacity-50"
              >
                Download XLSX
              </button>
            </div>
          </div>
        )}

        {selectedReport && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {selectedReport.level.charAt(0).toUpperCase() + selectedReport.level.slice(1)} Report
              </h2>
              <div className="text-sm text-slate-400">
                Critical: {selectedReport.riskMatrix.critical || 0} | High:{" "}
                {selectedReport.riskMatrix.high || 0} | Medium:{" "}
                {selectedReport.riskMatrix.medium || 0}
              </div>
            </div>
            <pre className="whitespace-pre-wrap rounded-md bg-slate-900 p-4 text-sm text-slate-200">
              {selectedReport.content}
            </pre>
          </div>
        )}
      </div>
    </Layout>
  );
}
