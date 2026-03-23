import { ingestQuestionnaire, IngestPayload } from "@/lib/services/ingestionService";

/**
 * Sync Mode Controller — Part 3
 *
 * Controls how questionnaire data enters the system.
 * Three modes are supported:
 *
 *  - real-time : single questionnaire, processed immediately on arrival
 *  - batch     : array of questionnaires, processed sequentially in one call
 *  - manual    : user explicitly triggers ingestion for a specific payload
 *
 * All modes reuse the shared ingestionService — no logic is duplicated here.
 */

export type SyncMode = "real-time" | "batch" | "manual";

export interface SyncResult {
  mode: SyncMode;
  total: number;
  succeeded: number;
  failed: number;
  results: {
    id: string;
    success: boolean;
    data?: object;
    error?: string;
  }[];
}

/**
 * Real-time sync — single payload, processed immediately.
 * Used when a questionnaire arrives and must be ingested right away.
 */
export async function syncRealTime(payload: IngestPayload): Promise<SyncResult> {
  const result = await ingestQuestionnaire(payload, "sync:real-time");

  return {
    mode: "real-time",
    total: 1,
    succeeded: result.success ? 1 : 0,
    failed: result.success ? 0 : 1,
    results: [
      {
        id: payload.id,
        success: result.success,
        data: result.data,
        error: result.error,
      },
    ],
  };
}

/**
 * Batch sync — array of payloads, processed one by one.
 * Failures in one entry do not stop the rest.
 * Used for bulk imports or scheduled syncs.
 */
export async function syncBatch(payloads: IngestPayload[]): Promise<SyncResult> {
  const results: SyncResult["results"] = [];
  let succeeded = 0;
  let failed = 0;

  for (const payload of payloads) {
    const result = await ingestQuestionnaire(payload, "sync:batch");

    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }

    results.push({
      id: payload.id,
      success: result.success,
      data: result.data,
      error: result.error,
    });
  }

  console.log(`[Sync:Batch] Done — ${succeeded} succeeded, ${failed} failed out of ${payloads.length}`);

  return {
    mode: "batch",
    total: payloads.length,
    succeeded,
    failed,
    results,
  };
}

/**
 * Manual sync — user explicitly triggers ingestion for a single payload.
 * Same as real-time but logged separately so it is traceable.
 */
export async function syncManual(payload: IngestPayload): Promise<SyncResult> {
  const result = await ingestQuestionnaire(payload, "sync:manual");

  return {
    mode: "manual",
    total: 1,
    succeeded: result.success ? 1 : 0,
    failed: result.success ? 0 : 1,
    results: [
      {
        id: payload.id,
        success: result.success,
        data: result.data,
        error: result.error,
      },
    ],
  };
}
