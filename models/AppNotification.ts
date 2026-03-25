import mongoose, { Document, Model, Schema } from "mongoose";

export type NotificationType = "questionnaire" | "analysis" | "critical_risk";

export interface IAppNotification extends Document {
    type: NotificationType;
    title: string;
    message: string;
    /** Extra context — analysisId, company, riskCount, etc. */
    meta: Record<string, unknown>;
    read: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const AppNotificationSchema = new Schema<IAppNotification>(
    {
        type: {
            type: String,
            enum: ["questionnaire", "analysis", "critical_risk"],
            required: true,
            index: true,
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        meta: { type: Schema.Types.Mixed, default: {} },
        read: { type: Boolean, default: false, index: true },
    },
    { timestamps: true }
);

// Keep only the 200 most recent notifications — TTL-style cleanup via a sparse index
AppNotificationSchema.index({ createdAt: -1 });

const AppNotification: Model<IAppNotification> =
    mongoose.models.AppNotification ||
    mongoose.model<IAppNotification>("AppNotification", AppNotificationSchema);

export default AppNotification;
