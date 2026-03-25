import AnalysisLock from '@/models/AnalysisLock';
import mongoose from 'mongoose';

const DEFAULT_TTL_MS = 1000 * 60 * 5; // 5 minutes

type LockAcquireResult =
  | { acquired: true; lock: unknown }
  | { acquired: false; reason: 'exists' | 'race' | 'error'; error?: unknown };

export async function acquireAnalysisLock(questionnaireId: string, ttlMs = DEFAULT_TTL_MS): Promise<LockAcquireResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    // Try to insert a new lock document. If one exists, this will throw duplicate key.
    const doc = await AnalysisLock.create({ questionnaireId: new mongoose.Types.ObjectId(questionnaireId), createdAt: now, expiresAt });
    return { acquired: true, lock: doc };
  } catch (err: unknown) {
    // Duplicate key -> lock exists. Try to check if it's expired and replace it.
    if (typeof err === "object" && err !== null && "code" in err && err.code === 11000) {
      const existing = await AnalysisLock.findOne({ questionnaireId });
      if (!existing) return { acquired: false, reason: 'exists' };
      if (existing.expiresAt && existing.expiresAt.getTime() < Date.now()) {
        // expired -> remove and try to insert once
        try {
          await AnalysisLock.deleteOne({ _id: existing._id });
          const doc = await AnalysisLock.create({ questionnaireId: new mongoose.Types.ObjectId(questionnaireId), createdAt: now, expiresAt });
          return { acquired: true, lock: doc };
        } catch {
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
  } catch {
    return false;
  }
}
