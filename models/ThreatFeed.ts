import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * ThreatFeed model
 * Stores threat intelligence entries pulled from external feeds.
 * Used by Module 2 to correlate identified risks with known threats.
 */

export type ThreatSeverity = "critical" | "high" | "medium" | "low";
export type ThreatCategory =
  | "malware"
  | "phishing"
  | "ransomware"
  | "vulnerability"
  | "insider_threat"
  | "ddos"
  | "social_engineering"
  | "supply_chain"
  | "other";

export interface IThreatFeed extends Document {
  externalId: string;        // unique ID from the threat intelligence source
  source: string;            // name of the feed provider (e.g. "MITRE ATT&CK")
  title: string;             // short title of the threat
  description: string;       // full description
  severity: ThreatSeverity;
  category: ThreatCategory;
  affectedSectors: string[]; // e.g. ["finance", "healthcare", "government"]
  indicators: string[];      // IOCs: IPs, domains, hashes, CVE IDs, etc.
  publishedAt: Date;         // when the threat was published by the source
  fetchedAt: Date;           // when our system pulled it in
  isActive: boolean;         // whether this threat is still considered active
  createdAt: Date;
  updatedAt: Date;
}

const ThreatFeedSchema = new Schema<IThreatFeed>(
  {
    externalId: { type: String, required: true, unique: true },
    source: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    severity: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      required: true,
    },
    category: {
      type: String,
      enum: [
        "malware",
        "phishing",
        "ransomware",
        "vulnerability",
        "insider_threat",
        "ddos",
        "social_engineering",
        "supply_chain",
        "other",
      ],
      required: true,
    },
    affectedSectors: [{ type: String }],
    indicators: [{ type: String }],
    publishedAt: { type: Date, required: true },
    fetchedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Index for fast lookups by source and severity
ThreatFeedSchema.index({ source: 1, severity: 1 });
ThreatFeedSchema.index({ category: 1, isActive: 1 });
ThreatFeedSchema.index({ fetchedAt: -1 });

const ThreatFeed: Model<IThreatFeed> =
  mongoose.models.ThreatFeed ||
  mongoose.model<IThreatFeed>("ThreatFeed", ThreatFeedSchema);

export default ThreatFeed;
