import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IQuestionAnalysis {
  questionId: number;
  section: string;
  question: string;
  answer: string;
  level: string;
  analysis: {
    likelihood: number;
    impact: number;
    riskScore: number;
    riskLevel: string;
    riskColor: string;
    gap: string;
    threat: string;
    mitigation: string;
    impactLabel?: string;
    likelihoodLabel?: string;
    impactDescription?: string;
  };
  timestamp: Date;
}

export interface IRiskAnalysis extends Document {
  questionnaireId: mongoose.Types.ObjectId;
  company: string;
  category: string;
  metadata: {
    timestamp: Date;
    totalQuestions: number;
    levels: {
      operational: number;
      tactical: number;
      strategic: number;
    };
  };
  operational: IQuestionAnalysis[];
  tactical: IQuestionAnalysis[];
  strategic: IQuestionAnalysis[];
  summary: {
    operational: any;
    tactical: any;
    strategic: any;
    overall: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const QuestionAnalysisSchema = new Schema({
  questionId: Number,
  section: String,
  question: String,
  answer: String,
  level: String,
  analysis: {
    likelihood: Number,
    impact: Number,
    riskScore: Number,
    riskLevel: String,
    riskColor: String,
    gap: String,
    threat: String,
    mitigation: String,
    impactLabel: String,
    likelihoodLabel: String,
    impactDescription: String
  },
  timestamp: Date
});

const RiskAnalysisSchema = new Schema<IRiskAnalysis>(
  {
    questionnaireId: {
      type: Schema.Types.ObjectId,
      ref: 'Questionnaire',
      required: true,
      unique: true // Prevent duplicate analyses
    },
    company: { type: String, required: true },
    category: { type: String, required: true },
    metadata: {
      timestamp: Date,
      totalQuestions: Number,
      levels: {
        operational: Number,
        tactical: Number,
        strategic: Number
      }
    },
    operational: [QuestionAnalysisSchema],
    tactical: [QuestionAnalysisSchema],
    strategic: [QuestionAnalysisSchema],
    summary: Schema.Types.Mixed
  },
  { timestamps: true }
);

// Create index for faster queries
RiskAnalysisSchema.index({ questionnaireId: 1 });
RiskAnalysisSchema.index({ company: 1, createdAt: -1 });

const RiskAnalysis: Model<IRiskAnalysis> =
  mongoose.models.RiskAnalysis ||
  mongoose.model<IRiskAnalysis>('RiskAnalysis', RiskAnalysisSchema);

export default RiskAnalysis;
