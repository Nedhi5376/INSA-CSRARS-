"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Layout from "../components/Layout";

type RiskRecord = {
  _id: string;
  company: string;
  category: string;
  section: string;
  sourceLevel: string;
  question: string;
  answer: string;
  riskLevel: string;
  riskScore: number;
  inherentRiskLevel?: string;
  inherentRiskScore?: number;
  residualRiskLevel?: string;
  residualRiskScore?: number;
  gap: string;
  threat: string;
  mitigation: string;
  owner?: string;
  treatment: "mitigate" | "accept" | "transfer" | "avoid";
  status:
    | "open"
    | "in_progress"
    | "mitigated"
    | "accepted"
    | "closed"
    | "transferred";
  dueDate?: string | null;
  comments?: string;
};

type EditingState = {
  id: string;
  owner: string;
  treatment: RiskRecord["treatment"];
  status: RiskRecord["status"];
  dueDate: string;
  comments: string;
} | null;

export default function RisksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [risks, setRisks] = useState<RiskRecord[]>([]);
  const [editing, setEditing] = useState<EditingState>(null);
  const [companyFilter, setCompanyFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [riskLevelFilter, setRiskLevelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      void fetchRisks();
    }
  }, [status, router]);

  const fetchRisks = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/risks");
      const data = await response.json();
      setRisks(data.success && Array.isArray(data.risks) ? data.risks : []);
    } catch (error) {
      console.error("Failed to load risks", error);
      setRisks([]);
    } finally {
      setLoading(false);
    }
  };

  const syncRegister = async () => {
    try {
      setSyncing(true);
      const response = await fetch("/api/risks", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to sync register");
      }
      await fetchRisks();
    } catch (error) {
      console.error("Failed to sync risk register", error);
    } finally {
      setSyncing(false);
    }
  };

  const filteredRisks = useMemo(() => {
    return risks.filter((risk) => {
      if (companyFilter && risk.company !== companyFilter) return false;
      if (categoryFilter && risk.category !== categoryFilter) return false;
      if (riskLevelFilter && risk.riskLevel !== riskLevelFilter) return false;
      if (statusFilter && risk.status !== statusFilter) return false;
      return true;
    });
  }, [risks, companyFilter, categoryFilter, riskLevelFilter, statusFilter]);

  const companies = Array.from(new Set(risks.map((risk) => risk.company))).sort();
  const categories = Array.from(new Set(risks.map((risk) => risk.category))).sort();

  const startEditing = (risk: RiskRecord) => {
    setEditing({
      id: risk._id,
      owner: risk.owner || "",
      treatment: risk.treatment,
      status: risk.status,
      dueDate: risk.dueDate ? new Date(risk.dueDate).toISOString().split("T")[0] : "",
      comments: risk.comments || "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/risks/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: editing.owner,
          treatment: editing.treatment,
          status: editing.status,
          dueDate: editing.dueDate || null,
          comments: editing.comments,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update risk");
      }

      setRisks((current) =>
        current.map((risk) => (risk._id === data.risk._id ? data.risk : risk))
      );
      setEditing(null);
    } catch (error) {
      console.error("Failed to update risk", error);
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center text-slate-400">
          Loading...
        </div>
      </Layout>
    );
  }

  if (!session) return null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Risk Register</h1>
            <p className="text-sm text-slate-400">
              Persistent register entries synced from analyzed assessments.
            </p>
          </div>
          <button
            onClick={syncRegister}
            disabled={syncing}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync From Analyses"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-700 bg-slate-800 p-6 md:grid-cols-4">
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
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
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={riskLevelFilter}
            onChange={(e) => setRiskLevelFilter(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white"
          >
            <option value="">All risk levels</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="VERY_LOW">Very Low</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="mitigated">Mitigated</option>
            <option value="accepted">Accepted</option>
            <option value="closed">Closed</option>
            <option value="transferred">Transferred</option>
          </select>
        </div>

        <div className="space-y-4">
          {filteredRisks.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-slate-700 bg-slate-800 p-12 text-center text-slate-400">
              No risk register entries found. Sync from analyses to create the register.
            </div>
          ) : (
            filteredRisks.map((risk) => (
              <div
                key={risk._id}
                className="rounded-lg border border-slate-700 bg-slate-800 p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:justify-between">
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-white">{risk.gap || risk.question}</h2>
                    <p className="text-sm text-slate-400">
                      {risk.company} | {risk.category} | {risk.section} | {risk.sourceLevel}
                    </p>
                    <p className="text-sm text-slate-300">{risk.question}</p>
                    <p className="text-sm text-slate-400">Threat: {risk.threat || "N/A"}</p>
                    <p className="text-sm text-slate-400">Mitigation: {risk.mitigation || "N/A"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm md:min-w-[320px]">
                    <div className="rounded-md bg-slate-900 p-3">
                      <p className="text-slate-400">Residual Risk</p>
                      <p className="font-semibold text-white">
                        {risk.residualRiskLevel || risk.riskLevel} ({risk.residualRiskScore || risk.riskScore})
                      </p>
                    </div>
                    <div className="rounded-md bg-slate-900 p-3">
                      <p className="text-slate-400">Inherent Risk</p>
                      <p className="font-semibold text-white">
                        {risk.inherentRiskLevel || risk.riskLevel} ({risk.inherentRiskScore || risk.riskScore})
                      </p>
                    </div>
                    <div className="rounded-md bg-slate-900 p-3">
                      <p className="text-slate-400">Treatment</p>
                      <p className="font-semibold capitalize text-white">{risk.treatment}</p>
                    </div>
                    <div className="rounded-md bg-slate-900 p-3">
                      <p className="text-slate-400">Status</p>
                      <p className="font-semibold capitalize text-white">{risk.status.replace("_", " ")}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-slate-700 pt-4 text-sm text-slate-300 md:flex-row md:items-center md:justify-between">
                  <div>
                    Owner: {risk.owner || "Unassigned"} | Due:{" "}
                    {risk.dueDate ? new Date(risk.dueDate).toLocaleDateString() : "Not set"}
                  </div>
                  <button
                    onClick={() => startEditing(risk)}
                    className="rounded-md bg-amber-600 px-4 py-2 font-medium text-white transition hover:bg-amber-700"
                  >
                    Update Register Entry
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-800">
            <div className="border-b border-slate-700 p-6">
              <h2 className="text-2xl font-bold text-white">Update Risk Register Entry</h2>
            </div>
            <div className="space-y-4 p-6">
              <input
                value={editing.owner}
                onChange={(e) => setEditing({ ...editing, owner: e.target.value })}
                placeholder="Owner"
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white"
              />
              <select
                value={editing.treatment}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    treatment: e.target.value as RiskRecord["treatment"],
                  })
                }
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white"
              >
                <option value="mitigate">Mitigate</option>
                <option value="accept">Accept</option>
                <option value="transfer">Transfer</option>
                <option value="avoid">Avoid</option>
              </select>
              <select
                value={editing.status}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    status: e.target.value as RiskRecord["status"],
                  })
                }
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="mitigated">Mitigated</option>
                <option value="accepted">Accepted</option>
                <option value="closed">Closed</option>
                <option value="transferred">Transferred</option>
              </select>
              <input
                type="date"
                value={editing.dueDate}
                onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })}
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white"
              />
              <textarea
                value={editing.comments}
                onChange={(e) => setEditing({ ...editing, comments: e.target.value })}
                rows={4}
                placeholder="Comments"
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white"
              />
            </div>
            <div className="flex gap-3 border-t border-slate-700 p-6">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="flex-1 rounded-md bg-slate-700 px-4 py-2 font-medium text-white transition hover:bg-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
