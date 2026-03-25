import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ExcelReportService } from "@/lib/services/excelReportService";

export async function POST(request: Request) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { batchId } = body;

    // Validate input
    if (!batchId) {
      return NextResponse.json(
        { success: false, error: "batchId is required" },
        { status: 400 }
      );
    }

    // Generate Excel report
    const excelBuffer = await ExcelReportService.generateBatchReport(batchId);

    // Return Excel file
    return new NextResponse(new Uint8Array(excelBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="batch-${batchId}-${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error generating Excel report:", error);
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        success: false,
        error: message || "Failed to generate Excel report",
      },
      { status: 500 }
    );
  }
}
