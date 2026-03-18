import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, TextRun, BorderStyle, AlignmentType, VerticalAlign, convertInchesToTwip } from "docx";
import dbConnect from "@/lib/mongodb";
import RiskAnalysis from "@/models/RiskAnalysis";

interface Analysis {
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
}

interface AssessmentData {
    _id: string;
    company: string;
    category: string;
    date: string;
    analyses: Analysis[];
}

// Helper function to get risk color (for DOCX emphasis)
const getRiskColor = (riskLevel: string): string => {
    switch (riskLevel) {
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
                    children: [new Paragraph({ text: "Security Gap", bold: true })],
                    shading: { fill: "1F2937" },
                    verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                    children: [new Paragraph({ text: "Aligned BMIS Element(s)", bold: true })],
                    shading: { fill: "1F2937" },
                    verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                    children: [new Paragraph({ text: "Threat", bold: true })],
                    shading: { fill: "1F2937" },
                    verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                    children: [new Paragraph({ text: "Likelihood", bold: true })],
                    shading: { fill: "1F2937" },
                    verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                    children: [new Paragraph({ text: "Impact", bold: true })],
                    shading: { fill: "1F2937" },
                    verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                    children: [new Paragraph({ text: "Risk Level", bold: true })],
                    shading: { fill: "1F2937" },
                    verticalAlign: VerticalAlign.CENTER,
                }),
            ],
            height: { value: convertInchesToTwip(0.3), rule: "atLeast" },
        })
    );

    // Data rows
    analyses.forEach((analysis) => {
        const riskColor = getRiskColor(analysis.riskLevel);
        rows.push(
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph(analysis.gap)],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                    new TableCell({
                        children: [new Paragraph(analysis.category || "-")],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                    new TableCell({
                        children: [new Paragraph(analysis.threat)],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                    new TableCell({
                        children: [new Paragraph(`${analysis.likelihood}/5`)],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                    new TableCell({
                        children: [new Paragraph(`${analysis.impact}/5`)],
                        verticalAlign: VerticalAlign.CENTER,
                    }),
                    new TableCell({
                        children: [new Paragraph(`${analysis.riskLevel}`)],
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

export async function generateDocxReport(analysisId: string): Promise<Buffer> {
    try {
        await dbConnect();

        // Fetch the specific analysis by ID
        const analysis = await RiskAnalysis.findById(analysisId).lean();

        if (!analysis) {
            throw new Error("Analysis not found");
        }

        // Combine all analyses from all levels
        const allAnalyses: (Analysis & { category?: string })[] = [
            ...(analysis.operational || []),
            ...(analysis.tactical || []),
            ...(analysis.strategic || []),
        ];

        // Create assessment data structure
        const assessmentData: AssessmentData = {
            _id: analysis._id.toString(),
            company: analysis.company,
            category: analysis.category,
            date: analysis.createdAt,
            analyses: allAnalyses.map((a: any) => ({
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

        const sections = [];

        // Title Section
        sections.push(
            new Paragraph({
                text: `RISK ASSESSMENT REPORT`,
                size: 32,
                bold: true,
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
            }),
            new Paragraph({
                text: `${assessmentData.company}`,
                size: 24,
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
            }),
            new Paragraph({
                text: `Generated: ${new Date(assessmentData.date).toLocaleDateString()}`,
                size: 14,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
                color: "6B7280",
            })
        );

        // Executive Summary
        sections.push(
            new Paragraph({
                text: "1. Executive Summary",
                size: 20,
                bold: true,
                spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
                text: `This report presents a comprehensive security risk assessment for ${assessmentData.company}. The assessment evaluated ${assessmentData.analyses.length} questions across multiple security domains.`,
                spacing: { after: 200 },
            })
        );

        // Assessment Overview
        sections.push(
            new Paragraph({
                text: "2. Assessment Overview",
                size: 20,
                bold: true,
                spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
                text: `Company: ${assessmentData.company}`,
                spacing: { after: 50 },
            }),
            new Paragraph({
                text: `Assessment Date: ${new Date(assessmentData.date).toLocaleDateString()}`,
                spacing: { after: 50 },
            }),
            new Paragraph({
                text: `Category: ${assessmentData.category}`,
                spacing: { after: 200 },
            })
        );

        // Questions and Answers Section
        sections.push(
            new Paragraph({
                text: "3. Questions and Their Answers",
                size: 20,
                bold: true,
                spacing: { before: 200, after: 100 },
            })
        );

        assessmentData.analyses.forEach((analysis, index) => {
            sections.push(
                new Paragraph({
                    text: `Q${index + 1}: ${analysis.question}`,
                    spacing: { before: 100, after: 50 },
                    style: "ListParagraph",
                }),
                new Paragraph({
                    text: `Answer: ${analysis.answer}`,
                    spacing: { after: 150 },
                    italics: true,
                })
            );
        });

        // Assessment Findings Section
        sections.push(
            new Paragraph({
                text: "4. Assessment Findings",
                size: 20,
                bold: true,
                spacing: { before: 200, after: 100 },
            })
        );

        // Strengths (placeholder)
        sections.push(
            new Paragraph({
                text: "a. Strengths",
                size: 16,
                bold: true,
                spacing: { before: 100, after: 50 },
            }),
            new Paragraph({
                text: "Review the analyzed responses for areas of compliance and effective controls.",
                spacing: { after: 150 },
            })
        );

        // Security Gaps
        sections.push(
            new Paragraph({
                text: "b. Security Gaps",
                size: 16,
                bold: true,
                spacing: { before: 100, after: 50 },
            })
        );

        // List unique gaps
        const uniqueGaps = Array.from(new Set(assessmentData.analyses.map((a) => a.gap)));
        uniqueGaps.forEach((gap) => {
            sections.push(
                new Paragraph({
                    text: gap,
                    spacing: { after: 50 },
                    style: "List Bullet",
                })
            );
        });

        sections.push(
            new Paragraph({
                text: "",
                spacing: { after: 200 },
            })
        );

        // Risk Analysis Section
        sections.push(
            new Paragraph({
                text: "5. Risk Analysis",
                size: 20,
                bold: true,
                spacing: { before: 200, after: 100 },
            }),
            createRiskMatrixTable(assessmentData.analyses),
            new Paragraph({
                text: "",
                spacing: { after: 200 },
            })
        );

        // Risk Evaluation Section
        sections.push(
            new Paragraph({
                text: "6. Risk Evaluation",
                size: 20,
                bold: true,
                spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
                text: "Risk = Likelihood × Impact",
                italics: true,
                spacing: { after: 150 },
            })
        );

        // Risk Summary Statistics
        const criticalCount = assessmentData.analyses.filter(
            (a) => a.riskLevel === "CRITICAL"
        ).length;
        const highCount = assessmentData.analyses.filter(
            (a) => a.riskLevel === "HIGH"
        ).length;
        const mediumCount = assessmentData.analyses.filter(
            (a) => a.riskLevel === "MEDIUM"
        ).length;
        const lowCount = assessmentData.analyses.filter(
            (a) => a.riskLevel === "LOW"
        ).length;

        sections.push(
            new Paragraph({
                text: `Critical Risks: ${criticalCount}`,
                color: "DC2626",
                bold: true,
                spacing: { after: 50 },
            }),
            new Paragraph({
                text: `High Risks: ${highCount}`,
                color: "EA580C",
                bold: true,
                spacing: { after: 50 },
            }),
            new Paragraph({
                text: `Medium Risks: ${mediumCount}`,
                color: "EAB308",
                bold: true,
                spacing: { after: 50 },
            }),
            new Paragraph({
                text: `Low Risks: ${lowCount}`,
                color: "16A34A",
                bold: true,
                spacing: { after: 200 },
            })
        );

        // Risk Treatment
        sections.push(
            new Paragraph({
                text: "7. Risk Treatment",
                size: 20,
                bold: true,
                spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
                text: "Recommended mitigation strategies for identified risks:",
                spacing: { after: 100 },
            })
        );

        assessmentData.analyses.forEach((analysis, index) => {
            if (analysis.riskLevel === "CRITICAL" || analysis.riskLevel === "HIGH") {
                sections.push(
                    new Paragraph({
                        text: `${index + 1}. ${analysis.gap}`,
                        spacing: { before: 50, after: 50 },
                        bold: true,
                    }),
                    new Paragraph({
                        text: `Mitigation: ${analysis.mitigation}`,
                        spacing: { after: 100 },
                    })
                );
            }
        });

        // Conclusion
        sections.push(
            new Paragraph({
                text: "8. Conclusion and Control Recommendations",
                size: 20,
                bold: true,
                spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
                text: "Based on this assessment, it is recommended that immediate action be taken to address critical and high-risk findings. A phased approach should be followed for medium and low-risk items.",
                spacing: { after: 200 },
            })
        );

        // References
        sections.push(
            new Paragraph({
                text: "9. References",
                size: 20,
                bold: true,
                spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
                text: "This assessment was conducted using standardized security evaluation frameworks.",
                spacing: { after: 200 },
            })
        );

        // Create document
        const doc = new Document({
            sections: [
                {
                    children: sections,
                    properties: {},
                },
            ],
        });

        // Convert to buffer
        const buffer = await Packer.toBuffer(doc);
        return buffer;
    } catch (error) {
        console.error("Error generating DOCX report:", error);
        throw error;
    }
}