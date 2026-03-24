import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Asset model
 * Stores organizational assets (devices, systems, servers, applications).
 * Used by Module 2 to correlate identified risks against specific assets.
 */

export type AssetType =
  | "server"
  | "workstation"
  | "network_device"
  | "application"
  | "database"
  | "cloud_service"
  | "mobile_device"
  | "other";

export type AssetCriticality = "critical" | "high" | "medium" | "low";

export interface IAsset extends Document {
  externalId: string;         // unique ID from the source system
  name: string;               // asset name or hostname
  type: AssetType;
  criticality: AssetCriticality;
  owner: string;              // team or person responsible
  department: string;
  ipAddress?: string;
  operatingSystem?: string;
  location?: string;          // physical or cloud region
  tags: string[];             // free-form labels for grouping
  isActive: boolean;
  importedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AssetSchema = new Schema<IAsset>(
  {
    externalId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "server",
        "workstation",
        "network_device",
        "application",
        "database",
        "cloud_service",
        "mobile_device",
        "other",
      ],
      required: true,
    },
    criticality: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      required: true,
    },
    owner: { type: String, required: true },
    department: { type: String, required: true },
    ipAddress: { type: String },
    operatingSystem: { type: String },
    location: { type: String },
    tags: [{ type: String }],
    isActive: { type: Boolean, default: true },
    importedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

AssetSchema.index({ type: 1, criticality: 1 });
AssetSchema.index({ department: 1 });
AssetSchema.index({ isActive: 1 });

const Asset: Model<IAsset> =
  mongoose.models.Asset || mongoose.model<IAsset>("Asset", AssetSchema);

export default Asset;
