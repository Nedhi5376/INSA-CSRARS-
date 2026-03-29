import { IThreatFeed } from "@/models/ThreatFeed";
import { IAsset } from "@/models/Asset";
import { IQuestionnaire } from "@/models/Questionnaire";

/**
 * Data Normalization Layer — Part 6
 *
 * Takes raw data from all ingestion sources (questionnaires, threat feeds,
 * asset inventories) and transforms them into a single consistent structure
 * that Module 2 can consume for risk analysis and correlation.
 *
 * This layer does NOT perform any analysis or scoring — it only shapes data.
 */

// ─── Normalized Types ────────────────────────────────────────────────────────

export interface NormalizedQuestion {
  id: number;
  question: string;
  answer: string;
  explanation: string;
  section: string;
  level: "operational" | "tactical" | "strategic";
}

export interface NormalizedQuestionnaire {
  sourceId: string;          // original externalId
  company: string;
  filledBy: string;
  role: string;
  filledDate: Date;
  category: string;
  status: string;
  questions: NormalizedQuestion[];
  receivedAt: Date;
}

export interface NormalizedThreat {
  sourceId: string;
  source: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  affectedSectors: string[];
  indicators: string[];
  publishedAt: Date;
  isActive: boolean;
}

export interface NormalizedAsset {
  sourceId: string;
  name: string;
  type: string;
  criticality: string;
  owner: string;
  department: string;
  ipAddress: string;
  operatingSystem: string;
  location: string;
  tags: string[];
  isActive: boolean;
}

export interface NormalizedDataBundle {
  questionnaires: NormalizedQuestionnaire[];
  threats: NormalizedThreat[];
  assets: NormalizedAsset[];
  normalizedAt: Date;
  summary: {
    totalQuestionnaires: number;
    totalQuestions: number;
    totalThreats: number;
    totalAssets: number;
    questionsByLevel: {
      operational: number;
      tactical: number;
      strategic: number;
    };
  };
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

/**
 * Normalize a single questionnaire document from MongoDB into a clean structure.
 */
export function normalizeQuestionnaire(doc: IQuestionnaire): NormalizedQuestionnaire {
  const questions: NormalizedQuestion[] = (doc.questions || []).map((q: any) => ({
    id: q.id,
    question: q.question,
    answer: q.answer,
    explanation: q.explanation || "",
    section: q.section,
    level: q.level,
  }));

  return {
    sourceId: doc.externalId,
    company: doc.company,
    filledBy: doc.filledBy,
    role: doc.role,
    filledDate: doc.filledDate,
    category: doc.category,
    status: doc.status,
    questions,
    receivedAt: doc.createdAt,
  };
}

/**
 * Normalize a threat feed document from MongoDB.
 */
export function normalizeThreat(doc: IThreatFeed): NormalizedThreat {
  return {
    sourceId: doc.externalId,
    source: doc.source,
    title: doc.title,
    description: doc.description,
    severity: doc.severity,
    category: doc.category,
    affectedSectors: doc.affectedSectors || [],
    indicators: doc.indicators || [],
    publishedAt: doc.publishedAt,
    isActive: doc.isActive,
  };
}

/**
 * Normalize an asset document from MongoDB.
 */
export function normalizeAsset(doc: IAsset): NormalizedAsset {
  return {
    sourceId: doc.externalId,
    name: doc.name,
    type: doc.type,
    criticality: doc.criticality,
    owner: doc.owner,
    department: doc.department,
    ipAddress: doc.ipAddress || "",
    operatingSystem: doc.operatingSystem || "",
    location: doc.location || "",
    tags: doc.tags || [],
    isActive: doc.isActive,
  };
}

/**
 * Build a full normalized data bundle from all three sources.
 * This is what Module 2 receives as input for risk analysis.
 */
export function buildNormalizedBundle(
  questionnaires: IQuestionnaire[],
  threats: IThreatFeed[],
  assets: IAsset[]
): NormalizedDataBundle {
  const normalizedQuestionnaires = questionnaires.map(normalizeQuestionnaire);
  const normalizedThreats = threats.map(normalizeThreat);
  const normalizedAssets = assets.map(normalizeAsset);

  const allQuestions = normalizedQuestionnaires.flatMap((q) => q.questions);
  const questionsByLevel = {
    operational: allQuestions.filter((q) => q.level === "operational").length,
    tactical: allQuestions.filter((q) => q.level === "tactical").length,
    strategic: allQuestions.filter((q) => q.level === "strategic").length,
  };

  return {
    questionnaires: normalizedQuestionnaires,
    threats: normalizedThreats,
    assets: normalizedAssets,
    normalizedAt: new Date(),
    summary: {
      totalQuestionnaires: normalizedQuestionnaires.length,
      totalQuestions: allQuestions.length,
      totalThreats: normalizedThreats.length,
      totalAssets: normalizedAssets.length,
      questionsByLevel,
    },
  };
}
