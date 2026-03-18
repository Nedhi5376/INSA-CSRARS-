"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Layout from "../components/Layout";

/* ---------------- Types for DOCX tab ---------------- */

type Assessment = {
  _id: string;
  company: string;
  category: string;
  date: string;
  analyses: Array<{
    questionId: number;
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
    impactLabel: string;
    impactDescription: string;
  }>;
};

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  /* ---------------- DOCX tab state ---------------- */

  const [processedAssessments, setProcessedAssessments] = useState<Assessment[]>([]);
  const [filteredAssessments, setFilteredAssessments] = useState<Assessment[]>([]);
  const [loadingDocx, setLoadingDocx] = useState(true);

  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  /* ---------------- Auth effect ---------------- */

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  /* ---------------- DOCX tab logic ---------------- */

  const fetchProcessedAssessments = useCallback(async () => {
    try {
      setLoadingDocx(true);
      const res = await fetch("/api/analysis/processed");
      const data = await res.json();
      setProcessedAssessments(
        data.success && Array.isArray(data.assessments) ? data.assessments : []
      );
    } catch (error) {
      console.error("Error:", error);
      setProcessedAssessments([]);
    } finally {
      setLoadingDocx(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchProcessedAssessments();
    }
  }, [status, fetchProcessedAssessments]);

  useEffect(() => {
    let filtered = [...processedAssessments];

    if (selectedCompany) {
      filtered = filtered.filter(
        (assessment) =>
          assessment.company.toLowerCase() === selectedCompany.toLowerCase()
      );
    }

    if (selectedDate) {
      filtered = filtered.filter((assessment) => {
        const assessmentDate = new Date(assessment.date)
          .toISOString()
          .split("T")[0];
        return assessmentDate === selectedDate;
      });
    }

    setFilteredAssessments(filtered);
  }, [processedAssessments, selectedCompany, selectedDate]);

  const handleViewDetails = (assessment: Assessment) => {
    setSelectedAssessment(assessment);
    setIsModalOpen(true);
  };

  const handleGenerateReport = async (assessment: Assessment) => {
    try {
      const response = await fetch(
        `/api/reports/export?analysisId=${assessment._id}&format=DOCX`
      );

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${assessment.company}-${new Date(assessment.date)
        .toISOString()
        .split("T")[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Error generating report");
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAssessment(null);
  };

  const uniqueCompaniesDocx = Array.from(
    new Set(processedAssessments.map((a) => a.company))
  );

  const uniqueDates = Array.from(
    new Set(
      processedAssessments.map((a) =>
        new Date(a.date).toISOString().split("T")[0]
      )
    )
  )
    .sort()
    .reverse();

  /* ---------------- Loading / auth guards ---------------- */

  const isLoadingAny = status === "loading" || loadingDocx;

  if (isLoadingAny) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!session) return null;

  /* ---------------- Render ---------------- */

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Reports</h1>

        {/* DOCX Filters */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Company Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Filter by Company
              </label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-md border border-slate-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Companies</option>
                {uniqueCompaniesDocx.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Filter by Date
              </label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-md border border-slate-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Dates</option>
                {uniqueDates.map((date) => (
                  <option key={date} value={date}>
                    {new Date(date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Assessments List */}
        {filteredAssessments.length > 0 ? (
          <div className="space-y-4">
            {filteredAssessments.map((assessment) => (
              <div
                key={assessment._id}
                className="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-slate-600 transition"
              >
                <div className="flex justify بین items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-2">
                      {assessment.company}
                    </h3>
                    <div className="space-y-1 text-sm text-slate-300">
                      <p>
                        <span className="font-medium">Category:</span>{" "}
                        {assessment.category}
                      </p>
                      <p>
                        <span className="font-medium">Date:</span>{" "}
                        {new Date(assessment.date).toLocaleDateString()}{" "}
                        {new Date(assessment.date).toLocaleTimeString()}
                      </p>
                      <p>
                        <span className="font-medium">
                          Questions Analyzed:
                        </span>{" "}
                        {assessment.analyses.length}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3 ml-4">
                    <button
                      onClick={() => handleViewDetails(assessment)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition text-sm font-medium"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleGenerateReport(assessment)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition text-sm font-medium"
                    >
                      Generate Report
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
            <p className="text-slate-400 text-lg">
              No assessed questionnaires found.
            </p>
            <p className="text-slate-500 text-sm mt-2">
              Complete and analyze questionnaires to see them here.
            </p>
          </div>
        )}
      </div>

      {/* DOCX details modal */}
      {isModalOpen && selectedAssessment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {selectedAssessment.company}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {new Date(selectedAssessment.date).toLocaleDateString()}{" "}
                  {new Date(selectedAssessment.date).toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {selectedAssessment.analyses.map((analysis, index) => (
                <div
                  key={index}
                  className="border border-slate-700 rounded-lg p-4 space-y-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-400 mb-1">
                      Question {index + 1}
                    </p>
                    <p className="text-white font-medium">
                      {analysis.question}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-400 mb-1">
                      Answer
                    </p>
                    <p className="text-slate-300">{analysis.answer}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400 mb-1">Likelihood</p>
                      <p className="text-white font-medium">
                        {analysis.likelihood}/5
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-1">Impact</p>
                      <p className="text-white font-medium">
                        {analysis.impact}/5
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400 mb-1">Risk Score</p>
                      <p className="text-white font-medium">
                        {analysis.riskScore}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-1">Risk Level</p>
                      <p
                        className={`font-medium ${
                          analysis.riskLevel === "CRITICAL"
                            ? "text-red-400"
                            : analysis.riskLevel === "HIGH"
                            ? "text-orange-400"
                            : analysis.riskLevel === "MEDIUM"
                            ? "text-yellow-400"
                            : "text-green-400"
                        }`}
                      >
                        {analysis.riskLevel}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-400 mb-1">
                      Gap
                    </p>
                    <p className="text-slate-300 text-sm">{analysis.gap}</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-400 mb-1">
                      Threat
                    </p>
                    <p className="text-slate-300 text-sm">{analysis.threat}</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-400 mb-1">
                      Mitigation
                    </p>
                    <p className="text-slate-300 text-sm">
                      {analysis.mitigation}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6 flex space-x-3">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition font-medium"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleGenerateReport(selectedAssessment);
                  closeModal();
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition font-medium"
              >
                Generate Report
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
