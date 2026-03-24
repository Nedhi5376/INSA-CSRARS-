import dbConnect from "@/lib/mongodb";
import Asset, { AssetType, AssetCriticality } from "@/models/Asset";

/**
 * Asset Inventory Service — Part 5
 *
 * Handles importing, storing, and retrieving organizational assets.
 * Assets are used by Module 2 to correlate identified risks and
 * vulnerabilities against specific systems and devices.
 */

export interface RawAssetEntry {
  id: string;
  name: string;
  type: string;
  criticality: string;
  owner: string;
  department: string;
  ip_address?: string;
  operating_system?: string;
  location?: string;
  tags?: string[];
}

export interface AssetIngestResult {
  total: number;
  saved: number;
  updated: number;
  failed: number;
  entries: {
    id: string;
    status: "saved" | "updated" | "failed";
    error?: string;
  }[];
}

// Normalize type to allowed values
function normalizeType(raw: string): AssetType {
  const val = raw.toLowerCase().replace(/\s+/g, "_");
  const allowed: AssetType[] = [
    "server",
    "workstation",
    "network_device",
    "application",
    "database",
    "cloud_service",
    "mobile_device",
  ];
  return allowed.includes(val as AssetType) ? (val as AssetType) : "other";
}

// Normalize criticality to allowed values
function normalizeCriticality(raw: string): AssetCriticality {
  const val = raw.toLowerCase();
  if (val === "critical") return "critical";
  if (val === "high") return "high";
  if (val === "medium" || val === "moderate") return "medium";
  return "low";
}

/**
 * Import an array of raw asset entries.
 * If an asset with the same externalId already exists it is updated,
 * otherwise it is created. Failures per entry do not stop the rest.
 */
export async function importAssets(
  entries: RawAssetEntry[]
): Promise<AssetIngestResult> {
  await dbConnect();

  const result: AssetIngestResult = {
    total: entries.length,
    saved: 0,
    updated: 0,
    failed: 0,
    entries: [],
  };

  for (const entry of entries) {
    try {
      if (!entry.id || !entry.name || !entry.type || !entry.owner || !entry.department) {
        result.failed++;
        result.entries.push({
          id: entry.id || "unknown",
          status: "failed",
          error: "Missing required fields: id, name, type, owner, department",
        });
        continue;
      }

      const normalized = {
        externalId: entry.id,
        name: entry.name,
        type: normalizeType(entry.type),
        criticality: normalizeCriticality(entry.criticality || "low"),
        owner: entry.owner,
        department: entry.department,
        ipAddress: entry.ip_address,
        operatingSystem: entry.operating_system,
        location: entry.location,
        tags: entry.tags || [],
        isActive: true,
        importedAt: new Date(),
      };

      const existing = await Asset.findOne({ externalId: entry.id });

      if (existing) {
        await Asset.updateOne({ externalId: entry.id }, { $set: normalized });
        result.updated++;
        result.entries.push({ id: entry.id, status: "updated" });
      } else {
        await Asset.create(normalized);
        result.saved++;
        result.entries.push({ id: entry.id, status: "saved" });
      }
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
    `[Assets] Import complete — saved: ${result.saved}, updated: ${result.updated}, failed: ${result.failed}`
  );

  return result;
}

/**
 * Retrieve assets from the database.
 * Module 2 calls this to get the asset inventory for risk correlation.
 */
export async function getAssets(filters?: {
  type?: AssetType;
  criticality?: AssetCriticality;
  department?: string;
}) {
  await dbConnect();

  const query: Record<string, any> = { isActive: true };

  if (filters?.type) query.type = filters.type;
  if (filters?.criticality) query.criticality = filters.criticality;
  if (filters?.department) query.department = filters.department;

  return Asset.find(query).sort({ criticality: 1, name: 1 }).lean();
}

/**
 * Deactivate assets that are no longer in the inventory.
 * Accepts a list of current externalIds — anything not in the list is marked inactive.
 */
export async function deactivateMissingAssets(
  currentIds: string[]
): Promise<number> {
  await dbConnect();

  const result = await Asset.updateMany(
    { externalId: { $nin: currentIds }, isActive: true },
    { $set: { isActive: false } }
  );

  console.log(`[Assets] Deactivated ${result.modifiedCount} removed assets`);
  return result.modifiedCount;
}
