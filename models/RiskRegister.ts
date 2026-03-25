import mongoose, { Document, Model, Schema } from "mongoose";

export type RiskTreatment = "mitigate" | "accept" | "transfer" | "avoid";
export type RiskStatus =
  | "open"
  | "in_progress"
  | "mitigated"
  | "accepted"
  | "closed"
  | "transferred";

export interface IRiskRegister extends Document {
  analysisId: mongoose.Types.ObjectId;
  questionnaireId?: mongoose.Types.ObjectId | null;
  company: string;
  category: string;
  section: string;
  sourceLevel: string;
  questionId: number;
  question: string;
  answer: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  riskLevel: string;
  inherentRiskScore?: number;
  inherentRiskLevel?: string;
  residualRiskScore?: number;
  residualRiskLevel?: string;
  gap: string;
  threat: string;
  mitigation: string;
  impactDescription?: string;
  owner?: string;
  treatment: RiskTreatment;
  status: RiskStatus;
  dueDate?: Date | null;
  comments?: string;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RiskRegisterSchema = new Schema<IRiskRegister>(
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
      default: null,
    },
    company: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    section: { type: String, required: true },
    sourceLevel: { type: String, required: true, index: true },
    questionId: { type: Number, required: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    likelihood: { type: Number, required: true },
    impact: { type: Number, required: true },
    riskScore: { type: Number, required: true, index: true },
    riskLevel: { type: String, required: true, index: true },
    inherentRiskScore: { type: Number, default: 0 },
    inherentRiskLevel: { type: String, default: "UNKNOWN" },
    residualRiskScore: { type: Number, default: 0 },
    residualRiskLevel: { type: String, default: "UNKNOWN" },
    gap: { type: String, default: "" },
    threat: { type: String, default: "" },
    mitigation: { type: String, default: "" },
    impactDescription: { type: String, default: "" },
    owner: { type: String, default: "" },
    treatment: {
      type: String,
      enum: ["mitigate", "accept", "transfer", "avoid"],
      default: "mitigate",
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "mitigated", "accepted", "closed", "transferred"],
      default: "open",
    },
    dueDate: { type: Date, default: null },
    comments: { type: String, default: "" },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

RiskRegisterSchema.index({ analysisId: 1, questionId: 1 }, { unique: true });

const RiskRegister: Model<IRiskRegister> =
  mongoose.models.RiskRegister ||
  mongoose.model<IRiskRegister>("RiskRegister", RiskRegisterSchema);

export default RiskRegister;
