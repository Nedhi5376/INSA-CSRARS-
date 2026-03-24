import dbConnect from "@/lib/mongodb";
import ThreatFeed, { ThreatSeverity, ThreatCategory } from "@/models/ThreatFeed";

/**
 * Threat Intelligence Feed Service — Part 4
 *
 * Fetches threat data from external intelligence sources,
 * normalizes it into a consistent structure, and stores it
 * in the database for Module 2 to use during risk correlation.
 *
 * Currently supports:
 *  - Manual push   : external system POSTs threat entries directly
 *  - Fetch by URL  : system pulls from a configured feed URL
 *
 * Each entry is deduplicated by externalId so re-fetching is safe.
 */

export interface RawThreatEntry {
  id: string;
  source: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  affected_sectors?: string[];
  indicators?: string[];
  published_at: string; // ISO 8601
}

export interface ThreatIngestResult {
  total: number;
  saved: number;
  skipped: number; // duplicates
  failed: number;
  entries: {
    id: string;
    status: "saved" | "skipped" | "failed";
    error?: string;
  }[];
}

// Normalize severity to allowed values
function normalizeSeverity(raw: string): ThreatSeverity {
  const val = raw.toLowerCase();
  if (val === "critical") return "critical";
  if (val === "high") return "high";
  if (val === "medium" || val === "moderate") return "medium";
  return "low";
}

// Normalize category to allowed values
function normalizeCategory(raw: string): ThreatCategory {
  const val = raw.toLowerCase().replace(/\s+/g, "_");
  const allowed: ThreatCategory[] = [
    "malware",
    "phishing",
    "ransomware",
    "vulnerability",
    "insider_threat",
    "ddos",
    "social_engineering",
    "supply_chain",
  ];
  return allowed.includes(val as ThreatCategory)
    ? (val as ThreatCategory)
    : "other";
}

/**
 * Ingest an array of raw threat entries into the database.
 * Skips duplicates, reports failures per entry without stopping the rest.
 */
export async function ingestThreatEntries(
  entries: RawThreatEntry[]
): Promise<ThreatIngestResult> {
  await dbConnect();

  const result: ThreatIngestResult = {
    total: entries.length,
    saved: 0,
    skipped: 0,
    failed: 0,
    entries: [],
  };

  for (const entry of entries) {
    try {
      if (!entry.id || !entry.title || !entry.description || !entry.source || !entry.published_at) {
        result.failed++;
        result.entries.push({
          id: entry.id || "unknown",
          status: "failed",
          error: "Missing required fields: id, title, description, source, published_at",
        });
        continue;
      }

      // Skip duplicates
      const existing = await ThreatFeed.findOne({ externalId: entry.id });
      if (existing) {
        result.skipped++;
        result.entries.push({ id: entry.id, status: "skipped" });
        continue;
      }

      const publishedAt = new Date(entry.published_at);
      if (isNaN(publishedAt.getTime())) {
        result.failed++;
        result.entries.push({
          id: entry.id,
          status: "failed",
          error: "Invalid published_at date format. Use ISO 8601.",
        });
        continue;
      }

      await ThreatFeed.create({
        externalId: entry.id,
        source: entry.source,
        title: entry.title,
        description: entry.description,
        severity: normalizeSeverity(entry.severity || "low"),
        category: normalizeCategory(entry.category || "other"),
        affectedSectors: entry.affected_sectors || [],
        indicators: entry.indicators || [],
        publishedAt,
        fetchedAt: new Date(),
        isActive: true,
      });

      result.saved++;
      result.entries.push({ id: entry.id, status: "saved" });
    } catch (err: any) {
      result.failed++;
      result.entries.push({
        id: entry.id || "unknown",
        status: "failed",
        error: err.message,
      });
    }
  }

  console.log(
    `[ThreatFeed] Ingest complete — saved: ${result.saved}, skipped: ${result.skipped}, failed: ${result.failed}`
  );

  return result;
}

/**
 * Fetch active threats from the database.
 * Module 2 calls this to get current threat intelligence for risk correlation.
 */
export async function getActiveThreats(filters?: {
  severity?: ThreatSeverity;
  category?: ThreatCategory;
  sector?: string;
}) {
  await dbConnect();

  const query: Record<string, any> = { isActive: true };

  if (filters?.severity) query.severity = filters.severity;
  if (filters?.category) query.category = filters.category;
  if (filters?.sector) query.affectedSectors = { $in: [filters.sector] };

  return ThreatFeed.find(query).sort({ fetchedAt: -1 }).lean();
}

/**
 * Mark old threats as inactive (older than given days).
 * Keeps the database clean without deleting historical data.
 */
export async function deactivateOldThreats(olderThanDays: number = 90): Promise<number> {
  await dbConnect();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const result = await ThreatFeed.updateMany(
    { publishedAt: { $lt: cutoff }, isActive: true },
    { $set: { isActive: false } }
  );

  console.log(`[ThreatFeed] Deactivated ${result.modifiedCount} old threats`);
  return result.modifiedCount;
}
