import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import RiskRegister from "@/models/RiskRegister";
import { validate, UpdateRiskSchema } from "@/lib/validation";

type SessionRole = "Director" | "Division Head" | "Risk Analyst";

const MUTATION_ROLES: SessionRole[] = ["Director", "Division Head", "Risk Analyst"];

function isAuthorized(role: unknown): role is SessionRole {
  return typeof role === "string" && MUTATION_ROLES.includes(role as SessionRole);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    const role = session?.user ? (session.user as { role?: unknown }).role : undefined;
    if (!session || !isAuthorized(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const v = validate(UpdateRiskSchema, await request.json());
    if (!v.success) return v.response;
    const body = v.data;

    const update: Record<string, string | Date | null> = {};
    if (typeof body.owner === "string") update.owner = body.owner;
    if (typeof body.treatment === "string") update.treatment = body.treatment;
    if (typeof body.status === "string") update.status = body.status;
    if (typeof body.comments === "string") update.comments = body.comments;
    if (body.dueDate === null || typeof body.dueDate === "string") {
      update.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }

    const risk = await RiskRegister.findByIdAndUpdate(params.id, { $set: update }, { new: true });
    if (!risk) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, risk });
  } catch (error) {
    console.error("Error updating risk:", error);
    const message = error instanceof Error ? error.message : "Failed to update risk";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
