import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateDocxReport } from "@/lib/services/reportService";

type SessionRole = "Director" | "Division Head" | "Risk Analyst" | "Staff";

const EXPORT_ROLES: SessionRole[] = ["Director", "Division Head", "Risk Analyst", "Staff"];

function isAuthorized(role: unknown): role is SessionRole {
  return typeof role === "string" && EXPORT_ROLES.includes(role as SessionRole);
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    const role = session?.user ? (session.user as { role?: unknown }).role : undefined;
    if (!session || !isAuthorized(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get("analysisId");
    const format = (searchParams.get("format") || "").toUpperCase();

    if (!analysisId) {
      return NextResponse.json({ error: "Missing analysisId parameter" }, { status: 400 });
    }

    if (format !== "DOCX") {
      return NextResponse.json(
        { error: "Only DOCX format is supported currently" },
        { status: 400 }
      );
    }

    const buffer = await generateDocxReport(analysisId);

    return new NextResponse(new Uint8Array(buffer), {
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
    const message = error instanceof Error ? error.message : "Failed to generate report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
