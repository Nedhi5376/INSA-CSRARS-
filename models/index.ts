// Export all models for easy importing
export { default as User } from './User';
export { default as Questionnaire } from './Questionnaire';
export { default as RiskAnalysis } from './RiskAnalysis';
export { default as Report } from './Report';
export { default as AnalysisLock } from './AnalysisLock';

// New models for Module 4
export { default as RiskRegister } from './RiskRegister';
export { default as AuditLog } from './AuditLog';
export { default as Feedback } from './Feedback';
export { default as Incident } from './Incident';

// Export types
export type { IUser, UserRole } from './User';
export type { IRiskAnalysis, IQuestionAnalysis } from './RiskAnalysis';
export type {
    IRiskRegister,
    IRiskTreatment,
    RiskStatus,
    RiskCategory,
    RiskLevel
} from './RiskRegister';
export type {
    IAuditLog,
    AuditAction,
    AuditEntity
} from './AuditLog';
export type {
    IFeedback,
    IFeedbackAttachment,
    IFeedbackResponse,
    FeedbackType,
    FeedbackStatus,
    FeedbackPriority
} from './Feedback';
export type {
    IIncident,
    IIncidentTimeline,
    IIncidentImpact,
    IIncidentResponse,
    IncidentSeverity,
    IncidentStatus,
    IncidentCategory
} from './Incident';