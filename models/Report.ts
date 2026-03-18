import mongoose, { Document, Model, Schema } from "mongoose";

export type ReportLevel = "strategic" | "tactical" | "operational";

export interface IRiskMatrix {
  high: number;
  medium: number;
  low: number;
  matrix: Array<{
    likelihood: number;
    impact: number;
    count: number;
  }>;
}

export interface IReport extends Document {
  analysisId: mongoose.Types.ObjectId;
  level: ReportLevel;
  content: string;
  riskMatrix: IRiskMatrix;
  charts: {
    type: string;
    data: any;
  };
  exportFormats: string[];
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RiskMatrixSchema = new Schema({
  high: { type: Number, default: 0 },
  medium: { type: Number, default: 0 },
  low: { type: Number, default: 0 },
  matrix: [
    {
      likelihood: { type: Number },
      impact: { type: Number },
      count: { type: Number },
    },
  ],
});

const ReportSchema: Schema<IReport> = new Schema(
  {
    analysisId: {
      type: Schema.Types.ObjectId,
      ref: "RiskAnalysis",
      required: true,
    },
    level: {
      type: String,
      enum: ["strategic", "tactical", "operational"],
      required: true,
    },
    content: { type: String, required: true },
    riskMatrix: { type: RiskMatrixSchema, required: true },
    charts: {
      type: {
        type: String,
      },
      data: { type: Schema.Types.Mixed },
    },
    exportFormats: [{ type: String }],
    generatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

const Report: Model<IReport> =
  mongoose.models.Report || mongoose.model<IReport>("Report", ReportSchema);

export default Report;

