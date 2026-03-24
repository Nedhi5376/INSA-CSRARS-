import { NextRequest, NextResponse } from "next/server";
import {
  importAssets,
  getAssets,
  deactivateMissingAssets,
  RawAssetEntry,
} from "@/lib/services/assetService";
import { AssetType, AssetCriticality } from "@/models/Asset";

/**
 * POST /api/ingest/assets
 * Import one or more assets into the inventory.
 *
 * Expected body:
 * {
 *   assets: RawAssetEntry[]
 * }
 *
 * GET /api/ingest/assets
 * Retrieve active assets. Optional query params:
 *   ?type=server|workstation|application|...
 *   ?criticality=critical|high|medium|low
 *   ?department=IT
 *
 * DELETE /api/ingest/assets
 * Deactivate assets no longer in the inventory.
 *
 * Expected body:
 * {
 *   currentIds: string[]   // list of still-active asset IDs
 * }
 */

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-webhook-secret");
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    if (!Array.isArray(body.assets) || body.assets.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing required field: assets (non-empty array)" },
        { status: 400 }
      );
    }

    const result = await importAssets(body.assets as RawAssetEntry[]);

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error: any) {
    console.error("[Assets API] POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const filters = {
      type: (searchParams.get("type") as AssetType) || undefined,
      criticality: (searchParams.get("criticality") as AssetCriticality) || undefined,
      department: searchParams.get("department") || undefined,
    };

    const assets = await getAssets(filters);

    return NextResponse.json(
      { success: true, total: assets.length, assets },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Assets API] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const secret = req.headers.get("x-webhook-secret");
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    if (!Array.isArray(body.currentIds)) {
      return NextResponse.json(
        { success: false, error: "Missing required field: currentIds (array of asset IDs)" },
        { status: 400 }
      );
    }

    const count = await deactivateMissingAssets(body.currentIds);

    return NextResponse.json(
      { success: true, message: `Deactivated ${count} assets no longer in inventory` },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Assets API] DELETE error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
