import AnalysisLock from '@/models/AnalysisLock';
import mongoose from 'mongoose';

const DEFAULT_TTL_MS = 1000 * 60 * 5; // 5 minutes

export async function acquireAnalysisLock(questionnaireId: string, ttlMs = DEFAULT_TTL_MS) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    // Try to insert a new lock document. If one exists, this will throw duplicate key.
    const doc = await AnalysisLock.create({ questionnaireId: new mongoose.Types.ObjectId(questionnaireId), createdAt: now, expiresAt });
    return { acquired: true, lock: doc };
  } catch (err: any) {
    // Duplicate key -> lock exists. Try to check if it's expired and replace it.
    if (err && err.code === 11000) {
      const existing = await AnalysisLock.findOne({ questionnaireId });
      if (!existing) return { acquired: false, reason: 'exists' };
      if (existing.expiresAt && existing.expiresAt.getTime() < Date.now()) {
        // expired -> remove and try to insert once
        try {
          await AnalysisLock.deleteOne({ _id: existing._id });
          const doc = await AnalysisLock.create({ questionnaireId: new mongoose.Types.ObjectId(questionnaireId), createdAt: now, expiresAt });
          return { acquired: true, lock: doc };
        } catch (e) {
          return { acquired: false, reason: 'race' };
        }
      }
      return { acquired: false, reason: 'exists' };
    }
    return { acquired: false, reason: 'error', error: err };
  }
}

export async function releaseAnalysisLock(questionnaireId: string) {
  try {
    await AnalysisLock.deleteOne({ questionnaireId: new mongoose.Types.ObjectId(questionnaireId) });
    return true;
  } catch (err) {
    return false;
  }
}
