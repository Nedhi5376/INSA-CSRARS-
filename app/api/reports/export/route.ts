import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateDocxReport } from "@/lib/services/reportService";

export async function GET(request: Request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get("analysisId");
    const format = searchParams.get("format");

    // Validate parameters
    if (!analysisId) {
      return NextResponse.json(
        { error: "Missing analysisId parameter" },
        { status: 400 }
      );
    }

    if (!format || format.toUpperCase() !== "DOCX") {
      return NextResponse.json(
        { error: "Only DOCX format is supported currently" },
        { status: 400 }
      );
    }

    // Optional: Check authentication (uncomment if needed)
    // const session = await getSession();
    // if (!session) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    // Generate DOCX report
    const buffer = await generateDocxReport(analysisId);

    // Return as file download
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="risk-assessment-report-${analysisId}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error in reports/export route:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message || "Failed to generate report" },
      { status: 500 }
    );
  }
}