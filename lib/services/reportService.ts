import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, TextRun, BorderStyle, AlignmentType, VerticalAlign, convertInchesToTwip } from "docx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import pptxgen from "pptxgenjs";
import dbConnect from "@/lib/mongodb";
import RiskAnalysis from "@/models/RiskAnalysis";

interface Analysis {
    questionId: number;
    level: string;
    category?: string;
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
}

interface AssessmentData {
    _id: string;
    company: string;
    category: string;
    date: Date;
    analyses: Analysis[];
}

// Helper function to get risk color (for DOCX emphasis)
const getRiskColor = (riskLevel: string): string => {
    switch (riskLevel.toUpperCase()) {
        case "CRITICAL":
            return "DC2626";
        case "HIGH":
            return "EA580C";
        case "MEDIUM":
            return "EAB308";
        case "LOW":
            return "16A34A";
        default:
            return "6B7280";
    }
};

// Create table for Risk Matrix
const createRiskMatrixTable = (analyses: Analysis[]): Table => {
    const rows: TableRow[] = [];

    // Header row
    rows.push(
        new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Security Gap", bold: true, color: "FFFFFF" })] })],
                    shading: { fill: "1F2937" },
                    verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Aligned BMIS Element(s)", bold: true, color: "FFFFFF" })] })],
                    shading: { fill: "1F2937" },
                    verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Threat", bold: true, color: "FFFFFF" })] })],
                    shading: { fill: "1F2937" },
                    verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Likelihood", bold: true, color: "FFFFFF" })] })],
                    shading: { fill: "1F2937" },
                    verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Impact", bold: true, color: "FFFFFF" })] })],
                    shading: { fill: "1F2937" },
                    verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Risk Level", bold: true, color: "FFFFFF" })] })],
                    shading: { fill: "1F2937" },
                    verticalAlign: VerticalAlign.CENTER,
                }),
            ],
            height: { value: convertInchesToTwip(0.3), rule: "atLeast" },
        })
    );

    // Data rows
    analyses.forEach((analysis) => {
        rows.push(
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: analysis.gap })],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: analysis.category || "-" })],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: analysis.threat })],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: `${analysis.likelihood}/5` })],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: `${analysis.impact}/5` })],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                    new TableCell({
                        children: [new Paragraph({ 
                          children: [
                            new TextRun({ 
                              text: analysis.riskLevel, 
                              color: getRiskColor(analysis.riskLevel),
                              bold: true 
                            })
                          ] 
                        })],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                ],
                height: { value: convertInchesToTwip(0.4), rule: "atLeast" },
            })
        );
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows,
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
        },
    });
};

export async function generateDocxReport(analysisId: string, level: string = "overall"): Promise<Buffer> {
    try {
        await dbConnect();
        const analysis = await RiskAnalysis.findById(analysisId).lean();
        if (!analysis) throw new Error("Analysis not found");

        const fullAnalysis = analysis as any;
        let filteredItems: any[] = [];
        if (level === "strategic") filteredItems = fullAnalysis.strategic || [];
        else if (level === "tactical") filteredItems = fullAnalysis.tactical || [];
        else if (level === "operational") filteredItems = fullAnalysis.operational || [];
        else if (level === "human_awareness") filteredItems = fullAnalysis.humanAwareness || [];
        else {
            filteredItems = [
                ...(fullAnalysis.operational || []),
                ...(fullAnalysis.tactical || []),
                ...(fullAnalysis.strategic || []),
                ...(fullAnalysis.humanAwareness || []),
            ];
        }

        const assessmentData: AssessmentData = {
            _id: analysis._id.toString(),
            company: analysis.company,
            category: analysis.category,
            date: analysis.createdAt,
            analyses: filteredItems.map((a: any) => ({
                questionId: a.questionId,
                level: a.level,
                question: a.question,
                answer: a.answer,
                likelihood: a.analysis?.likelihood || 0,
                impact: a.analysis?.impact || 0,
                riskScore: a.analysis?.riskScore || 0,
                riskLevel: a.analysis?.riskLevel || "UNKNOWN",
                gap: a.analysis?.gap || "",
                threat: a.analysis?.threat || "",
                mitigation: a.analysis?.mitigation || "",
                impactLabel: a.analysis?.impactLabel || "",
                impactDescription: a.analysis?.impactDescription || "",
            })),
        };

        const docChildren: any[] = [];

        // Title
        docChildren.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `${level.toUpperCase().replace("_", " ")} RISK ASSESSMENT REPORT`,
                        size: 32,
                        bold: true,
                    }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
            }),
            new Paragraph({
                children: [new TextRun({ text: assessmentData.company, size: 24 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
            }),
            new Paragraph({
                children: [new TextRun({ text: `Generated: ${new Date(assessmentData.date).toLocaleDateString()}`, size: 14, color: "6B7280" })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
            })
        );

        // 1. Executive Summary
        docChildren.push(
            new Paragraph({
                children: [new TextRun({ text: "1. Executive Summary", size: 26, bold: true })],
                spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
                text: `This report presents a comprehensive security risk assessment for ${assessmentData.company}. The assessment evaluated ${assessmentData.analyses.length} questions across multiple security domains.`,
                spacing: { after: 200 },
            })
        );

        // 2. Assessment Overview
        docChildren.push(
            new Paragraph({
                children: [new TextRun({ text: "2. Assessment Overview", size: 26, bold: true })],
                spacing: { before: 200, after: 100 },
            }),
            new Paragraph({ text: `Company: ${assessmentData.company}` }),
            new Paragraph({ text: `Assessment Date: ${new Date(assessmentData.date).toLocaleDateString()}` }),
            new Paragraph({ text: `Category: ${assessmentData.category}`, spacing: { after: 200 } })
        );

        // 3. Questions and Answers
        docChildren.push(
            new Paragraph({
                children: [new TextRun({ text: "3. Questions and Their Answers", size: 26, bold: true })],
                spacing: { before: 200, after: 100 },
            })
        );
        assessmentData.analyses.forEach((a, index) => {
            docChildren.push(
                new Paragraph({ text: `Q${index + 1}: ${a.question}`, style: "ListParagraph" }),
                new Paragraph({ children: [new TextRun({ text: `Answer: ${a.answer}`, italics: true })], spacing: { after: 150 } })
            );
        });

        // 4. Analysis Results
        docChildren.push(
            new Paragraph({
                children: [new TextRun({ text: "4. Risk Analysis Matrix", size: 26, bold: true })],
                spacing: { before: 200, after: 100 },
            }),
            createRiskMatrixTable(assessmentData.analyses),
            new Paragraph({ text: "", spacing: { after: 200 } })
        );

        // 5. Findings & Recommendations
        docChildren.push(
            new Paragraph({
                children: [new TextRun({ text: "5. Findings & Recommendations", size: 26, bold: true })],
                spacing: { before: 200, after: 100 },
            })
        );
        assessmentData.analyses.filter(a => a.riskScore >= 15).forEach((a, index) => {
            docChildren.push(
                new Paragraph({ children: [new TextRun({ text: `${index + 1}. ${a.gap}`, bold: true })], spacing: { before: 100 } }),
                new Paragraph({ text: `Threat: ${a.threat}` }),
                new Paragraph({ text: `Mitigation: ${a.mitigation}`, spacing: { after: 100 } })
            );
        });

        const doc = new Document({
            sections: [{ children: docChildren }],
        });

        return await Packer.toBuffer(doc);
    } catch (error) {
        console.error("Error generating DOCX report:", error);
        throw error;
    }
}

export async function generatePdfReport(analysisId: string, level: string = "overall"): Promise<Buffer> {
    try {
        await dbConnect();
        const analysis = await RiskAnalysis.findById(analysisId).lean();
        if (!analysis) throw new Error("Analysis not found");

        const doc = new jsPDF();
        const title = `${level.toUpperCase().replace("_", " ")} RISK ASSESSMENT REPORT`;
        
        doc.setFontSize(20);
        doc.setTextColor(51, 65, 85);
        doc.text(title, 105, 30, { align: "center" });
        
        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139);
        doc.text(`Organization: ${analysis.company}`, 20, 50);
        doc.text(`Sector: ${analysis.category}`, 20, 60);
        doc.text(`Assessment Date: ${new Date(analysis.createdAt || Date.now()).toLocaleDateString()}`, 20, 70);

        doc.line(20, 85, 190, 85);

        const fullAnalysis = analysis as any;
        const items: any[] = level === 'overall' 
            ? [...(fullAnalysis.operational || []), ...(fullAnalysis.tactical || []), ...(fullAnalysis.strategic || []), ...(fullAnalysis.humanAwareness || [])]
            : (fullAnalysis as any)[level === 'human_awareness' ? 'humanAwareness' : level] || [];

        const tableData = items
            .sort((a, b) => (b.analysis?.riskScore || 0) - (a.analysis?.riskScore || 0))
            .slice(0, 15)
            .map((item, index) => [
                index + 1,
                item.analysis?.gap?.substring(0, 50) || 'N/A',
                item.analysis?.riskLevel || 'N/A',
                item.analysis?.riskScore || 0,
                item.analysis?.mitigation?.substring(0, 60) || 'N/A'
            ]);

        (doc as any).autoTable({
            startY: 95,
            head: [['#', 'Gap Identified', 'Level', 'Score', 'Mitigation']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [30, 41, 59] },
        });

        return Buffer.from(doc.output("arraybuffer"));
    } catch (error) {
        console.error("Error generating PDF report:", error);
        throw error;
    }
}

export async function generatePptxReport(analysisId: string, level: string = "overall"): Promise<Buffer> {
    try {
        await dbConnect();
        const analysis = await RiskAnalysis.findById(analysisId).lean();
        if (!analysis) throw new Error("Analysis not found");

        const pres = new pptxgen();
        const slide = pres.addSlide();
        
        slide.addText(`${level.toUpperCase().replace("_", " ")} RISK ASSESSMENT`, {
            x: 0, y: "40%", w: "100%", align: "center", fontSize: 36, bold: true, color: "1F2937"
        });
        slide.addText(analysis.company, {
            x: 0, y: "55%", w: "100%", align: "center", fontSize: 24, color: "6B7280"
        });

        const data = await pres.write({ outputType: "nodebuffer" }) as Buffer;
        return data;
    } catch (error) {
        console.error("Error generating PPTX report:", error);
        throw error;
    }
}