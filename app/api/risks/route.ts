import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import RiskAnalysis from "@/models/RiskAnalysis";
import RiskRegister from "@/models/RiskRegister";
import { validate, RiskFilterSchema } from "@/lib/validation";

type SessionRole = "Director" | "Division Head" | "Risk Analyst" | "Staff";

const RISK_ROLES: SessionRole[] = ["Director", "Division Head", "Risk Analyst", "Staff"];
const MUTATION_ROLES: SessionRole[] = ["Director", "Division Head", "Risk Analyst"];

function isAuthorized(role: unknown, allowed: SessionRole[]): role is SessionRole {
  return typeof role === "string" && allowed.includes(role as SessionRole);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const role = session?.user ? (session.user as { role?: unknown }).role : undefined;
    if (!session || !isAuthorized(role, RISK_ROLES)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const v = validate(RiskFilterSchema, {
      company: req.nextUrl.searchParams.get("company") ?? undefined,
      category: req.nextUrl.searchParams.get("category") ?? undefined,
      riskLevel: req.nextUrl.searchParams.get("riskLevel") ?? undefined,
      status: req.nextUrl.searchParams.get("status") ?? undefined,
    });
    if (!v.success) return v.response;
    const { company, category, riskLevel, status } = v.data;

    const query: Record<string, string> = {};
    if (company) query.company = company;
    if (category) query.category = category;
    if (riskLevel) query.riskLevel = riskLevel;
    if (status) query.status = status;

    const risks = await RiskRegister.find(query).sort({ updatedAt: -1 }).lean();

    return NextResponse.json({ success: true, risks });
  } catch (error) {
    console.error("Error fetching risk register:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch risks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getSession();
    const role = session?.user ? (session.user as { role?: unknown }).role : undefined;
    if (!session || !isAuthorized(role, MUTATION_ROLES)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const analyses = await RiskAnalysis.find({}).lean();
    let upserted = 0;

    for (const analysis of analyses) {
      const findings = [
        ...(analysis.operational || []).map((item) => ({ sourceLevel: "operational", item })),
        ...(analysis.tactical || []).map((item) => ({ sourceLevel: "tactical", item })),
        ...(analysis.strategic || []).map((item) => ({ sourceLevel: "strategic", item })),
      ];

      for (const { sourceLevel, item } of findings) {
        await RiskRegister.findOneAndUpdate(
          { analysisId: analysis._id, questionId: item.questionId },
          {
            $set: {
              analysisId: analysis._id,
              questionnaireId: analysis.questionnaireId || null,
              company: analysis.company,
              category: analysis.category,
              section: item.section || "",
              sourceLevel,
              questionId: item.questionId,
              question: item.question || "",
              answer: item.answer || "",
              likelihood: item.analysis?.likelihood || 0,
              impact: item.analysis?.impact || 0,
              riskScore: item.analysis?.riskScore || 0,
              riskLevel: item.analysis?.riskLevel || "UNKNOWN",
              inherentRiskScore: item.analysis?.inherentRiskScore || item.analysis?.riskScore || 0,
              inherentRiskLevel: item.analysis?.inherentRiskLevel || item.analysis?.riskLevel || "UNKNOWN",
              residualRiskScore: item.analysis?.residualRiskScore || item.analysis?.riskScore || 0,
              residualRiskLevel: item.analysis?.residualRiskLevel || item.analysis?.riskLevel || "UNKNOWN",
              gap: item.analysis?.gap || "",
              threat: item.analysis?.threat || "",
              mitigation: item.analysis?.mitigation || "",
              impactDescription: item.analysis?.impactDescription || "",
              lastSyncedAt: new Date(),
            },
            $setOnInsert: {
              treatment: "mitigate",
              status: "open",
              owner: "",
              comments: "",
              dueDate: null,
            },
          },
          { upsert: true, new: true }
        );
        upserted += 1;
      }
    }

    return NextResponse.json({ success: true, upserted });
  } catch (error) {
    console.error("Error syncing risk register:", error);
    const message = error instanceof Error ? error.message : "Failed to sync risks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
