import mongoose, { Document, Model, Schema } from "mongoose";

export type FeedbackType = "Bug Report" | "Feature Request" | "General Feedback" | "Risk Assessment" | "System Issue";
export type FeedbackStatus = "Open" | "In Review" | "In Progress" | "Resolved" | "Closed" | "Rejected";
export type FeedbackPriority = "Low" | "Medium" | "High" | "Critical";

export interface IFeedbackAttachment {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    uploadedAt: Date;
}

export interface IFeedbackResponse {
    message: string;
    respondedBy: mongoose.Types.ObjectId;
    respondedAt: Date;
    internal: boolean; // Internal notes vs public responses
}

export interface IFeedback extends Document {
    // Basic Information
    title: string;
    description: string;
    type: FeedbackType;

    // Categorization
    category?: string; // e.g., "Dashboard", "Risk Analysis", "Reports"
    tags: string[];

    // Priority and Status
    priority: FeedbackPriority;
    status: FeedbackStatus;

    // User Information
    submittedBy: mongoose.Types.ObjectId;
    assignedTo?: mongoose.Types.ObjectId;

    // Context Information
    pageUrl?: string; // Where the feedback was submitted from
    browserInfo?: string;
    screenResolution?: string;

    // Related Entities
    relatedEntity?: {
        type: "Questionnaire" | "RiskAnalysis" | "RiskRegister" | "Report";
        id: mongoose.Types.ObjectId;
    };

    // Attachments and Media
    attachments: IFeedbackAttachment[];

    // Communication
    responses: IFeedbackResponse[];

    // Workflow
    estimatedResolutionDate?: Date;
    actualResolutionDate?: Date;
    resolutionNotes?: string;

    // Voting/Rating (for feature requests)
    upvotes: mongoose.Types.ObjectId[]; // Users who upvoted
    downvotes: mongoose.Types.ObjectId[]; // Users who downvoted

    // Metadata
    isPublic: boolean; // Whether feedback is visible to other users
    notifySubmitter: boolean; // Whether to notify submitter of updates

    createdAt: Date;
    updatedAt: Date;
}

const FeedbackAttachmentSchema = new Schema({
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
});

const FeedbackResponseSchema = new Schema({
    message: { type: String, required: true },
    respondedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    respondedAt: { type: Date, default: Date.now },
    internal: { type: Boolean, default: false }
});

const FeedbackSchema: Schema<IFeedback> = new Schema(
    {
        // Basic Information
        title: { type: String, required: true, maxlength: 200 },
        description: { type: String, required: true, maxlength: 2000 },
        type: {
            type: String,
            enum: ["Bug Report", "Feature Request", "General Feedback", "Risk Assessment", "System Issue"],
            required: true,
            index: true
        },

        // Categorization
        category: { type: String, maxlength: 100 },
        tags: [{ type: String, maxlength: 50 }],

        // Priority and Status
        priority: {
            type: String,
            enum: ["Low", "Medium", "High", "Critical"],
            default: "Medium",
            index: true
        },
        status: {
            type: String,
            enum: ["Open", "In Review", "In Progress", "Resolved", "Closed", "Rejected"],
            default: "Open",
            index: true
        },

        // User Information
        submittedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },

        // Context Information
        pageUrl: { type: String },
        browserInfo: { type: String },
        screenResolution: { type: String },

        // Related Entities
        relatedEntity: {
            type: {
                type: String,
                enum: ["Questionnaire", "RiskAnalysis", "RiskRegister", "Report"]
            },
            id: { type: Schema.Types.ObjectId }
        },

        // Attachments and Media
        attachments: [FeedbackAttachmentSchema],

        // Communication
        responses: [FeedbackResponseSchema],

        // Workflow
        estimatedResolutionDate: { type: Date },
        actualResolutionDate: { type: Date },
        resolutionNotes: { type: String, maxlength: 1000 },

        // Voting/Rating
        upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        downvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],

        // Metadata
        isPublic: { type: Boolean, default: false },
        notifySubmitter: { type: Boolean, default: true }
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient querying
FeedbackSchema.index({ submittedBy: 1, createdAt: -1 });
FeedbackSchema.index({ assignedTo: 1, status: 1 });
FeedbackSchema.index({ type: 1, status: 1 });
FeedbackSchema.index({ priority: 1, status: 1 });
FeedbackSchema.index({ createdAt: -1 });
FeedbackSchema.index({ tags: 1 });

// Virtual for vote score
FeedbackSchema.virtual('voteScore').get(function () {
    return (this.upvotes?.length || 0) - (this.downvotes?.length || 0);
});

// Virtual for response count
FeedbackSchema.virtual('responseCount').get(function () {
    return this.responses?.filter(r => !r.internal).length || 0;
});

// Static method to get feedback statistics
FeedbackSchema.statics.getStatistics = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                byStatus: {
                    $push: {
                        status: "$status",
                        count: 1
                    }
                },
                byType: {
                    $push: {
                        type: "$type",
                        count: 1
                    }
                },
                byPriority: {
                    $push: {
                        priority: "$priority",
                        count: 1
                    }
                }
            }
        }
    ]);

    return stats[0] || { total: 0, byStatus: [], byType: [], byPriority: [] };
};

// Static method to get user's feedback
FeedbackSchema.statics.getUserFeedback = async function (
    userId: mongoose.Types.ObjectId,
    limit: number = 20,
    skip: number = 0
) {
    return this.find({ submittedBy: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .populate('assignedTo', 'name email')
        .lean();
};

const Feedback: Model<IFeedback> =
    mongoose.models.Feedback || mongoose.model<IFeedback>("Feedback", FeedbackSchema);

export default Feedback;