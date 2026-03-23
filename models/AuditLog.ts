import mongoose, { Document, Model, Schema } from "mongoose";

export type AuditAction =
    | "CREATE" | "UPDATE" | "DELETE" | "VIEW" | "EXPORT"
    | "LOGIN" | "LOGOUT" | "ANALYZE" | "APPROVE" | "REJECT";

export type AuditEntity =
    | "User" | "Questionnaire" | "RiskAnalysis" | "RiskRegister"
    | "Report" | "Feedback" | "Incident" | "System";

export interface IAuditLog extends Document {
    // Core audit information
    action: AuditAction;
    entity: AuditEntity;
    entityId?: string; // ID of the affected entity

    // User information
    userId: mongoose.Types.ObjectId;
    userEmail: string;
    userRole: string;

    // Request information
    ipAddress: string;
    userAgent: string;
    sessionId?: string;

    // Change details
    changes?: {
        before?: any; // Previous state
        after?: any;  // New state
        fields?: string[]; // Changed field names
    };

    // Context information
    description: string;
    metadata?: {
        [key: string]: any; // Additional context data
    };

    // Result information
    success: boolean;
    errorMessage?: string;

    // Timing
    timestamp: Date;
    duration?: number; // Operation duration in milliseconds

    createdAt: Date;
}

const AuditLogSchema: Schema<IAuditLog> = new Schema(
    {
        // Core audit information
        action: {
            type: String,
            enum: ["CREATE", "UPDATE", "DELETE", "VIEW", "EXPORT", "LOGIN", "LOGOUT", "ANALYZE", "APPROVE", "REJECT"],
            required: true,
            index: true
        },
        entity: {
            type: String,
            enum: ["User", "Questionnaire", "RiskAnalysis", "RiskRegister", "Report", "Feedback", "Incident", "System"],
            required: true,
            index: true
        },
        entityId: {
            type: String,
            index: true
        },

        // User information
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        userEmail: { type: String, required: true },
        userRole: { type: String, required: true },

        // Request information
        ipAddress: { type: String, required: true },
        userAgent: { type: String },
        sessionId: { type: String },

        // Change details
        changes: {
            before: { type: Schema.Types.Mixed },
            after: { type: Schema.Types.Mixed },
            fields: [{ type: String }]
        },

        // Context information
        description: { type: String, required: true },
        metadata: { type: Schema.Types.Mixed },

        // Result information
        success: { type: Boolean, required: true, default: true },
        errorMessage: { type: String },

        // Timing
        timestamp: { type: Date, required: true, default: Date.now },
        duration: { type: Number } // milliseconds
    },
    {
        timestamps: { createdAt: true, updatedAt: false }, // Only track creation time
    }
);

// Indexes for efficient querying
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ entity: 1, entityId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 }); // For general chronological queries
AuditLogSchema.index({ success: 1, timestamp: -1 }); // For error tracking

// TTL index to automatically delete old audit logs after 2 years (optional)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 }); // 2 years

// Static methods for common audit operations
AuditLogSchema.statics.logAction = async function (
    action: AuditAction,
    entity: AuditEntity,
    userId: mongoose.Types.ObjectId,
    userEmail: string,
    userRole: string,
    ipAddress: string,
    description: string,
    options?: {
        entityId?: string;
        userAgent?: string;
        sessionId?: string;
        changes?: any;
        metadata?: any;
        success?: boolean;
        errorMessage?: string;
        duration?: number;
    }
) {
    try {
        const auditLog = new this({
            action,
            entity,
            entityId: options?.entityId,
            userId,
            userEmail,
            userRole,
            ipAddress,
            userAgent: options?.userAgent,
            sessionId: options?.sessionId,
            changes: options?.changes,
            description,
            metadata: options?.metadata,
            success: options?.success ?? true,
            errorMessage: options?.errorMessage,
            duration: options?.duration,
            timestamp: new Date()
        });

        await auditLog.save();
        return auditLog;
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // Don't throw error to avoid breaking the main operation
    }
};

// Static method to get user activity
AuditLogSchema.statics.getUserActivity = async function (
    userId: mongoose.Types.ObjectId,
    limit: number = 50,
    skip: number = 0
) {
    return this.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip)
        .lean();
};

// Static method to get entity history
AuditLogSchema.statics.getEntityHistory = async function (
    entity: AuditEntity,
    entityId: string,
    limit: number = 50
) {
    return this.find({ entity, entityId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .populate('userId', 'name email')
        .lean();
};

const AuditLog: Model<IAuditLog> =
    mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;