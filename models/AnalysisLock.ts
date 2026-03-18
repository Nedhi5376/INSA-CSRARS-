import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAnalysisLock extends Document {
  questionnaireId: mongoose.Types.ObjectId;
  createdAt: Date;
  expiresAt: Date;
}

const AnalysisLockSchema = new Schema<IAnalysisLock>(
  {
    questionnaireId: { type: Schema.Types.ObjectId, ref: 'Questionnaire', required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: false }
);

const AnalysisLock: Model<IAnalysisLock> =
  mongoose.models.AnalysisLock || mongoose.model<IAnalysisLock>('AnalysisLock', AnalysisLockSchema);

export default AnalysisLock;
