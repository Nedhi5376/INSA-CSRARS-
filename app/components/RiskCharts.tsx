"use client";

import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  Cell,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useRef } from "react";
import html2canvas from "html2canvas";
import ExcelJS from "exceljs";

export interface RiskVisualizationData {
  level: string;
  count: number;
  color: string;
}

interface RiskChartsProps {
  data: RiskVisualizationData[];
  chartType: "pie" | "bar";
  companyName?: string;
  date?: string;
  assessmentData?: Array<{
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
  }>;
}

export const RiskCharts: React.FC<RiskChartsProps> = ({
  data,
  chartType,
  companyName = "All Companies",
  date = "",
  assessmentData = [],
}) => {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-800 border-2 border-dashed border-slate-700 rounded-lg p-12 text-center">
        <p className="text-white font-semibold mb-2">No risk data available</p>
        <p className="text-slate-400">
          Adjust filters or process more assessments to see data here.
        </p>
      </div>
    );
  }

  const totalRisks = data.reduce((sum, item) => sum + item.count, 0);

  const handleDownloadExcel = async () => {
    if (!chartContainerRef.current) return;

    try {
      // Step 1: Capture chart as image
      const canvas = await html2canvas(chartContainerRef.current, {
        backgroundColor: "#020617",
        useCORS: true,
        scale: 2,
      });
      const chartImageData = canvas.toDataURL("image/png");

      // Step 2: Create workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Risk Assessment");

      // Step 3: Set column widths
      worksheet.columns = [
        { header: "Question", width: 25, key: "question" },
        { header: "Answer", width: 20, key: "answer" },
        { header: "Likelihood", width: 12, key: "likelihood" },
        { header: "Impact", width: 12, key: "impact" },
        { header: "Risk Score", width: 12, key: "riskScore" },
        { header: "Risk Level", width: 12, key: "riskLevel" },
        { header: "Gap", width: 20, key: "gap" },
        { header: "Threat", width: 20, key: "threat" },
        { header: "Mitigation", width: 20, key: "mitigation" },
        { header: "Impact Label", width: 15, key: "impactLabel" },
        { header: "Impact Description", width: 25, key: "impactDescription" },
      ];

      // Step 4: Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 12,
      };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2F5496" }, // Professional blue
      };
      headerRow.alignment = { horizontal: "center", vertical: "center" };
      headerRow.height = 25;

      // Step 5: Add borders to header
      worksheet.getRow(1).eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
      });

      // Step 6: Add data rows
      if (assessmentData && assessmentData.length > 0) {
        assessmentData.forEach((item, index) => {
          const row = worksheet.addRow({
            question: item.question,
            answer: item.answer,
            likelihood: item.likelihood,
            impact: item.impact,
            riskScore: item.riskScore,
            riskLevel: item.riskLevel,
            gap: item.gap,
            threat: item.threat,
            mitigation: item.mitigation,
            impactLabel: item.impactLabel || "",
            impactDescription: item.impactDescription || "",
          });

          // Alternate row colors for readability
          if ((index + 1) % 2 === 0) {
            row.eachCell((cell) => {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF2F2F2" }, // Light gray
              };
            });
          }

          // Add borders to data cells
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin", color: { argb: "FFD3D3D3" } },
              left: { style: "thin", color: { argb: "FFD3D3D3" } },
              bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
              right: { style: "thin", color: { argb: "FFD3D3D3" } },
            };
          });

          // Center align numeric columns
          row.getCell("likelihood").alignment = { horizontal: "center" };
          row.getCell("impact").alignment = { horizontal: "center" };
          row.getCell("riskScore").alignment = { horizontal: "center" };
          row.getCell("riskLevel").alignment = { horizontal: "center" };

          row.height = 20;
        });
      }

      // Step 7: Add summary section with chart
      const chartRowStart = assessmentData.length + 4;

      // Add company and date info before chart
      const infoRow1 = worksheet.getRow(chartRowStart - 2);
      infoRow1.getCell(1).value = "Company:";
      infoRow1.getCell(1).font = { bold: true, size: 11 };
      infoRow1.getCell(2).value = companyName;

      const infoRow2 = worksheet.getRow(chartRowStart - 1);
      infoRow2.getCell(1).value = "Assessment Date:";
      infoRow2.getCell(1).font = { bold: true, size: 11 };
      infoRow2.getCell(2).value = date ? new Date(date).toLocaleDateString() : "N/A";

      // Step 8: Add chart image to worksheet
      const imageId = workbook.addImage({
        base64: chartImageData,
        extension: "png",
      });

      worksheet.addImage(imageId, {
        tl: { col: 0, row: chartRowStart },
        ext: { width: 500, height: 350 },
        editAs: "oneCell",
      });

      // Step 9: Add risk summary statistics
      const statsColStart = 6;
      const summaryRow = chartRowStart;

      worksheet.getCell(`${String.fromCharCode(65 + statsColStart)}${summaryRow}`).value = "Risk Summary";
      worksheet.getCell(`${String.fromCharCode(65 + statsColStart)}${summaryRow}`).font = {
        bold: true,
        size: 12,
      };

      let summaryRowNum = summaryRow + 1;
      data.forEach((item) => {
        const cell = worksheet.getCell(`${String.fromCharCode(65 + statsColStart)}${summaryRowNum}`);
        cell.value = `${item.level}: ${item.count}`;
        cell.font = { size: 11 };
        summaryRowNum++;
      });

      // Step 10: Generate file name and download
      const dateStr = date ? new Date(date).toISOString().split("T")[0] : "no-date";
      const companySanitized = (companyName || "all")
        .replace(/\s+/g, "-")
        .toLowerCase();
      const fileName = `RiskAssessment_${companySanitized}_${dateStr}.xlsx`;

      await workbook.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      });
    } catch (err) {
      console.error("Error exporting assessment:", err);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">
          Risk Assessment Overview
        </h3>
        <button
          onClick={handleDownloadExcel}
          className="px-4 py-2 text-sm font-semibold border border-amber-400 rounded-md bg-amber-500 text-slate-900 hover:bg-amber-600 transition"
        >
          Download Assessment
        </button>
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
        {/* Chart container with metadata caption */}
        <div
          ref={chartContainerRef}
          className="w-full lg:w-1/2 bg-slate-900 rounded-md p-4"
        >
          {/* Metadata section visible in exported image */}
          <div className="mb-4 pb-3 border-b border-slate-600">
            <p className="text-sm text-slate-200">
              <span className="font-semibold">Company:</span> {companyName}
            </p>
            {date && (
              <p className="text-sm text-slate-200 mt-1">
                <span className="font-semibold">Date:</span>{" "}
                {new Date(date).toLocaleDateString()}
              </p>
            )}
            <p className="text-sm text-slate-200 mt-1">
              <span className="font-semibold">Total Risks:</span> {totalRisks}
            </p>
          </div>

          {/* Chart area */}
          <div className="h-80">
            {chartType === "pie" ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="count"
                    nameKey="level"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                      color: "#f1f5f9",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="level" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                      color: "#f1f5f9",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="count" name="Risk Count" fill="#3b82f6">
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Stats sidebar (not exported) */}
        <div className="w-full lg:w-1/2 space-y-4">
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-1">Total Risks</p>
            <p className="text-4xl font-bold text-white">{totalRisks}</p>
          </div>

          {data.map((item) => (
            <div
              key={item.level}
              className="bg-slate-900/50 rounded-lg p-4 border-l-4"
              style={{ borderLeftColor: item.color }}
            >
              <div className="flex justify-between items-center">
                <p className="text-white font-medium">{item.level}</p>
                <p className="text-2xl font-bold text-white">{item.count}</p>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {((item.count / totalRisks) * 100).toFixed(1)}% of total
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
