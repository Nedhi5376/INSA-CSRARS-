import mongoose, { Document, Model, Schema } from "mongoose";

export type QualitativeRating = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";

export interface IRiskItem extends Document {
  analysisId: mongoose.Types.ObjectId;
  questionnaireId?: mongoose.Types.ObjectId;
  assetId?: mongoose.Types.ObjectId | string | null;
  vulnerabilityId?: mongoose.Types.ObjectId | string | null;
  threatId?: mongoose.Types.ObjectId | string | null;

  // Inherent / residual risk (numeric score, typically likelihood * impact)
  inherentRisk: number;
  residualRisk?: number | null;

  // Asset criticality (independent of likelihood/impact)
  criticality?: number | null;

  // Quantitative fields
  sle?: number | null; // Single Loss Expectancy
  ale?: number | null; // Annual Loss Expectancy
  annualizedRateOfOccurrence?: number | null; // frequency per year

  // Hybrid / composite score (questionnaire + scanner + threat intel)
  hybridScore?: number | null;

  qualitativeRating: QualitativeRating;

  // Basic context
  questionId?: number;
  question?: string;
  level?: string;
  gap?: string;
  mitigation?: string;
  threatSummary?: string;

  createdAt: Date;
  updatedAt: Date;
}

const RiskItemSchema = new Schema<IRiskItem>(
  {
    analysisId: {
      type: Schema.Types.ObjectId,
      ref: "RiskAnalysis",
      required: true,
      index: true,
    },
    questionnaireId: {
      type: Schema.Types.ObjectId,
      ref: "Questionnaire",
    },
    assetId: { type: Schema.Types.Mixed },
    vulnerabilityId: { type: Schema.Types.Mixed },
    threatId: { type: Schema.Types.Mixed },

    inherentRisk: { type: Number, required: true },
    residualRisk: { type: Number, default: null },

    criticality: { type: Number, default: null },

    sle: { type: Number, default: null },
    ale: { type: Number, default: null },
    annualizedRateOfOccurrence: { type: Number, default: null },

    hybridScore: { type: Number, default: null },

    qualitativeRating: {
      type: String,
      enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "VERY_LOW"],
      required: true,
    },

    questionId: { type: Number },
    question: { type: String },
    level: { type: String },
    gap: { type: String },
    mitigation: { type: String },
    threatSummary: { type: String },
  },
  { timestamps: true }
);

RiskItemSchema.index({ qualitativeRating: 1 });
RiskItemSchema.index({ assetId: 1 });
RiskItemSchema.index({ vulnerabilityId: 1 });
RiskItemSchema.index({ threatId: 1 });

const RiskItem: Model<IRiskItem> =
  mongoose.models.RiskItem || mongoose.model<IRiskItem>("RiskItem", RiskItemSchema);

export default RiskItem;
