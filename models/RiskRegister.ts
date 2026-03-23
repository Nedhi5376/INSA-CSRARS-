import mongoose, { Document, Model, Schema } from "mongoose";

export type RiskStatus = "Open" | "In Progress" | "Mitigated" | "Closed" | "Accepted";
export type RiskCategory = "Operational" | "Strategic" | "Financial" | "Compliance" | "Technology" | "Reputational";
export type RiskLevel = "Critical" | "High" | "Medium" | "Low";

export interface IRiskTreatment {
    strategy: "Avoid" | "Mitigate" | "Transfer" | "Accept";
    description: string;
    owner: string;
    targetDate: Date;
    actualDate?: Date;
    cost?: number;
    status: "Not Started" | "In Progress" | "Completed" | "Overdue";
}

export interface IRiskRegister extends Document {
    riskId: string; // Unique risk identifier (e.g., RISK-2024-001)
    title: string;
    description: string;
    category: RiskCategory;

    // Risk Assessment
    likelihood: number; // 1-5 scale
    impact: number; // 1-5 scale
    riskScore: number; // likelihood * impact
    riskLevel: RiskLevel;

    // Risk Details
    rootCause: string;
    consequences: string[];
    existingControls: string[];

    // Risk Treatment
    treatment: IRiskTreatment;

    // Ownership & Tracking
    riskOwner: string;
    reviewer: string;
    status: RiskStatus;

    // Dates
    identifiedDate: Date;
    lastReviewDate: Date;
    nextReviewDate: Date;

    // Source Information
    sourceType: "Assessment" | "Manual" | "Incident" | "Audit";
    sourceId?: mongoose.Types.ObjectId; // Reference to questionnaire, incident, etc.

    // Metadata
    tags: string[];
    notes: string[];

    createdBy: mongoose.Types.ObjectId;
    updatedBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const RiskTreatmentSchema = new Schema({
    strategy: {
        type: String,
        enum: ["Avoid", "Mitigate", "Transfer", "Accept"],
        required: true
    },
    description: { type: String, required: true },
    owner: { type: String, required: true },
    targetDate: { type: Date, required: true },
    actualDate: { type: Date },
    cost: { type: Number },
    status: {
        type: String,
        enum: ["Not Started", "In Progress", "Completed", "Overdue"],
        default: "Not Started"
    }
});

const RiskRegisterSchema: Schema<IRiskRegister> = new Schema(
    {
        riskId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        title: { type: String, required: true },
        description: { type: String, required: true },
        category: {
            type: String,
            enum: ["Operational", "Strategic", "Financial", "Compliance", "Technology", "Reputational"],
            required: true
        },

        // Risk Assessment
        likelihood: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        impact: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        riskScore: {
            type: Number,
            required: true,
            min: 1,
            max: 25
        },
        riskLevel: {
            type: String,
            enum: ["Critical", "High", "Medium", "Low"],
            required: true
        },

        // Risk Details
        rootCause: { type: String, required: true },
        consequences: [{ type: String }],
        existingControls: [{ type: String }],

        // Risk Treatment
        treatment: { type: RiskTreatmentSchema, required: true },

        // Ownership & Tracking
        riskOwner: { type: String, required: true },
        reviewer: { type: String, required: true },
        status: {
            type: String,
            enum: ["Open", "In Progress", "Mitigated", "Closed", "Accepted"],
            default: "Open"
        },

        // Dates
        identifiedDate: { type: Date, required: true, default: Date.now },
        lastReviewDate: { type: Date, required: true, default: Date.now },
        nextReviewDate: { type: Date, required: true },

        // Source Information
        sourceType: {
            type: String,
            enum: ["Assessment", "Manual", "Incident", "Audit"],
            required: true
        },
        sourceId: { type: Schema.Types.ObjectId },

        // Metadata
        tags: [{ type: String }],
        notes: [{ type: String }],

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    {
        timestamps: true,
    }
);

// Indexes for better query performance
RiskRegisterSchema.index({ riskId: 1 });
RiskRegisterSchema.index({ category: 1, riskLevel: 1 });
RiskRegisterSchema.index({ status: 1 });
RiskRegisterSchema.index({ riskOwner: 1 });
RiskRegisterSchema.index({ nextReviewDate: 1 });
RiskRegisterSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate risk score and level
RiskRegisterSchema.pre('save', function (next) {
    // Calculate risk score
    this.riskScore = this.likelihood * this.impact;

    // Determine risk level based on score
    if (this.riskScore >= 20) {
        this.riskLevel = "Critical";
    } else if (this.riskScore >= 12) {
        this.riskLevel = "High";
    } else if (this.riskScore >= 6) {
        this.riskLevel = "Medium";
    } else {
        this.riskLevel = "Low";
    }

    next();
});

const RiskRegister: Model<IRiskRegister> =
    mongoose.models.RiskRegister || mongoose.model<IRiskRegister>("RiskRegister", RiskRegisterSchema);

export default RiskRegister;