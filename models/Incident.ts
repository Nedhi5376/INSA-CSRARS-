import mongoose, { Document, Model, Schema } from "mongoose";

export type IncidentSeverity = "Critical" | "High" | "Medium" | "Low";
export type IncidentStatus = "Open" | "Investigating" | "Contained" | "Resolved" | "Closed";
export type IncidentCategory = "Security Breach" | "Data Loss" | "System Outage" | "Compliance Violation" | "Operational Failure" | "Other";

export interface IIncidentTimeline {
    timestamp: Date;
    event: string;
    description: string;
    recordedBy: mongoose.Types.ObjectId;
}

export interface IIncidentImpact {
    businessImpact: string;
    financialImpact?: number;
    affectedSystems: string[];
    affectedUsers?: number;
    dataCompromised?: boolean;
    regulatoryImplications?: string;
}

export interface IIncidentResponse {
    immediateActions: string[];
    containmentActions: string[];
    investigationFindings: string[];
    rootCause?: string;
    lessonsLearned: string[];
    preventiveActions: string[];
}

export interface IIncident extends Document {
    // Basic Information
    incidentId: string; // Unique incident identifier (e.g., INC-2024-001)
    title: string;
    description: string;
    category: IncidentCategory;

    // Severity and Status
    severity: IncidentSeverity;
    status: IncidentStatus;

    // Timing
    detectedAt: Date;
    reportedAt: Date;
    acknowledgedAt?: Date;
    containedAt?: Date;
    resolvedAt?: Date;
    closedAt?: Date;

    // People Involved
    reportedBy: mongoose.Types.ObjectId;
    assignedTo?: mongoose.Types.ObjectId;
    incidentManager?: mongoose.Types.ObjectId;
    responseTeam: mongoose.Types.ObjectId[];

    // Impact Assessment
    impact: IIncidentImpact;

    // Response and Investigation
    response: IIncidentResponse;

    // Timeline
    timeline: IIncidentTimeline[];

    // Related Entities
    relatedRisks: mongoose.Types.ObjectId[]; // Related risk register entries
    relatedQuestionnaires: mongoose.Types.ObjectId[]; // Related assessments

    // Communication
    stakeholdersNotified: boolean;
    externalReportingRequired: boolean;
    regulatoryNotificationRequired: boolean;

    // Documentation
    attachments: {
        filename: string;
        originalName: string;
        mimeType: string;
        size: number;
        url: string;
        uploadedAt: Date;
        uploadedBy: mongoose.Types.ObjectId;
    }[];

    // Post-Incident
    postIncidentReviewCompleted: boolean;
    postIncidentReviewDate?: Date;

    // Metadata
    tags: string[];
    confidentialityLevel: "Public" | "Internal" | "Confidential" | "Restricted";

    createdAt: Date;
    updatedAt: Date;
}

const IncidentTimelineSchema = new Schema({
    timestamp: { type: Date, required: true, default: Date.now },
    event: { type: String, required: true },
    description: { type: String, required: true },
    recordedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
});

const IncidentImpactSchema = new Schema({
    businessImpact: { type: String, required: true },
    financialImpact: { type: Number },
    affectedSystems: [{ type: String }],
    affectedUsers: { type: Number },
    dataCompromised: { type: Boolean, default: false },
    regulatoryImplications: { type: String }
});

const IncidentResponseSchema = new Schema({
    immediateActions: [{ type: String }],
    containmentActions: [{ type: String }],
    investigationFindings: [{ type: String }],
    rootCause: { type: String },
    lessonsLearned: [{ type: String }],
    preventiveActions: [{ type: String }]
});

const IncidentAttachmentSchema = new Schema({
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
});

const IncidentSchema: Schema<IIncident> = new Schema(
    {
        // Basic Information
        incidentId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        title: { type: String, required: true, maxlength: 200 },
        description: { type: String, required: true, maxlength: 2000 },
        category: {
            type: String,
            enum: ["Security Breach", "Data Loss", "System Outage", "Compliance Violation", "Operational Failure", "Other"],
            required: true,
            index: true
        },

        // Severity and Status
        severity: {
            type: String,
            enum: ["Critical", "High", "Medium", "Low"],
            required: true,
            index: true
        },
        status: {
            type: String,
            enum: ["Open", "Investigating", "Contained", "Resolved", "Closed"],
            default: "Open",
            index: true
        },

        // Timing
        detectedAt: { type: Date, required: true },
        reportedAt: { type: Date, required: true, default: Date.now },
        acknowledgedAt: { type: Date },
        containedAt: { type: Date },
        resolvedAt: { type: Date },
        closedAt: { type: Date },

        // People Involved
        reportedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        incidentManager: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        responseTeam: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],

        // Impact Assessment
        impact: { type: IncidentImpactSchema, required: true },

        // Response and Investigation
        response: { type: IncidentResponseSchema, default: {} },

        // Timeline
        timeline: [IncidentTimelineSchema],

        // Related Entities
        relatedRisks: [{
            type: Schema.Types.ObjectId,
            ref: 'RiskRegister'
        }],
        relatedQuestionnaires: [{
            type: Schema.Types.ObjectId,
            ref: 'Questionnaire'
        }],

        // Communication
        stakeholdersNotified: { type: Boolean, default: false },
        externalReportingRequired: { type: Boolean, default: false },
        regulatoryNotificationRequired: { type: Boolean, default: false },

        // Documentation
        attachments: [IncidentAttachmentSchema],

        // Post-Incident
        postIncidentReviewCompleted: { type: Boolean, default: false },
        postIncidentReviewDate: { type: Date },

        // Metadata
        tags: [{ type: String }],
        confidentialityLevel: {
            type: String,
            enum: ["Public", "Internal", "Confidential", "Restricted"],
            default: "Internal"
        }
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient querying
IncidentSchema.index({ incidentId: 1 });
IncidentSchema.index({ severity: 1, status: 1 });
IncidentSchema.index({ category: 1, createdAt: -1 });
IncidentSchema.index({ reportedBy: 1, createdAt: -1 });
IncidentSchema.index({ assignedTo: 1, status: 1 });
IncidentSchema.index({ detectedAt: -1 });
IncidentSchema.index({ tags: 1 });

// Virtual for incident duration
IncidentSchema.virtual('duration').get(function () {
    if (this.resolvedAt && this.detectedAt) {
        return this.resolvedAt.getTime() - this.detectedAt.getTime();
    }
    return null;
});

// Virtual for response time
IncidentSchema.virtual('responseTime').get(function () {
    if (this.acknowledgedAt && this.reportedAt) {
        return this.acknowledgedAt.getTime() - this.reportedAt.getTime();
    }
    return null;
});

// Pre-save middleware to add timeline entry for status changes
IncidentSchema.pre('save', function (next) {
    if (this.isModified('status') && !this.isNew) {
        this.timeline.push({
            timestamp: new Date(),
            event: 'Status Changed',
            description: `Status changed to ${this.status}`,
            recordedBy: this.assignedTo || this.reportedBy
        });
    }
    next();
});

// Static method to get incident statistics
IncidentSchema.statics.getStatistics = async function (dateRange?: { start: Date; end: Date }) {
    const matchStage = dateRange
        ? { createdAt: { $gte: dateRange.start, $lte: dateRange.end } }
        : {};

    const stats = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                bySeverity: {
                    $push: {
                        severity: "$severity",
                        count: 1
                    }
                },
                byStatus: {
                    $push: {
                        status: "$status",
                        count: 1
                    }
                },
                byCategory: {
                    $push: {
                        category: "$category",
                        count: 1
                    }
                },
                avgResolutionTime: {
                    $avg: {
                        $cond: [
                            { $and: ["$resolvedAt", "$detectedAt"] },
                            { $subtract: ["$resolvedAt", "$detectedAt"] },
                            null
                        ]
                    }
                }
            }
        }
    ]);

    return stats[0] || {
        total: 0,
        bySeverity: [],
        byStatus: [],
        byCategory: [],
        avgResolutionTime: null
    };
};

const Incident: Model<IIncident> =
    mongoose.models.Incident || mongoose.model<IIncident>("Incident", IncidentSchema);

export default Incident;