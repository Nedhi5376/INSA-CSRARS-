import dbConnect from "@/lib/mongodb";
import Questionnaire from "@/models/Questionnaire";

/**
 * Shared ingestion service used by both the direct API (Part 1)
 * and the webhook receiver (Part 2).
 *
 * Responsibilities:
 * - Validate all required fields
 * - Validate answer values and section levels
 * - Flatten sections into individual questions
 * - Keep answer and explanation as separate concerns
 * - Parse the filled date
 * - Derive category from dominant question level (required by DB schema)
 * - Check for duplicates
 * - Save to database
 */

export const VALID_ANSWERS = ["Yes", "No", "Partially Implemented", "Not Applicable"];
export const VALID_LEVELS = ["operational", "tactical", "strategic"];

export interface IngestPayload {
  id: string;
  organization_name: string;
  respondent_name: string;
  respondent_title: string;
  interviewer_name: string;
  role: string;
  filled_date: string; // DD/MM/YYYY
  sections: {
    section_name: string;
    level: "operational" | "tactical" | "strategic";
    questions: {
      id: number;
      question: string;
      answer: string;
      explanation?: string; // kept separate, not merged into answer
    }[];
  }[];
}

export interface IngestResult {
  success: boolean;
  status: number;
  data?: {
    id: string;
    company: string;
    filledBy: string;
    category: string;
    totalQuestions: number;
    questionsByLevel: { operational: number; tactical: number; strategic: number };
    questionnaireStatus: string;
    receivedAt: Date;
  };
  error?: string;
  existingId?: string;
}

export async function ingestQuestionnaire(
  payload: IngestPayload,
  source: string = "direct"
): Promise<IngestResult> {
  // --- Validate required fields ---
  const requiredFields: (keyof IngestPayload)[] = [
    "id",
    "organization_name",
    "respondent_name",
    "respondent_title",
    "interviewer_name",
    "role",
    "filled_date",
    "sections",
  ];

  for (const field of requiredFields) {
    if (!payload[field]) {
      return { success: false, status: 400, error: `Missing required field: ${field}` };
    }
  }

  if (!Array.isArray(payload.sections) || payload.sections.length === 0) {
    return { success: false, status: 400, error: "sections must be a non-empty array" };
  }

  // --- Validate sections and questions ---
  const flatQuestions: {
    id: number;
    question: string;
    answer: string;       // fixed value only: Yes / No / Partially Implemented / Not Applicable
    explanation: string;  // kept separate
    section: string;
    level: "operational" | "tactical" | "strategic";
  }[] = [];

  for (const section of payload.sections) {
    if (!section.section_name || !section.level || !Array.isArray(section.questions)) {
      return {
        success: false,
        status: 400,
        error: "Each section must have section_name, level, and questions array",
      };
    }

    if (!VALID_LEVELS.includes(section.level)) {
      return {
        success: false,
        status: 400,
        error: `Invalid level "${section.level}". Must be one of: ${VALID_LEVELS.join(", ")}`,
      };
    }

    for (const q of section.questions) {
      if (!q.id || !q.question || !q.answer) {
        return {
          success: false,
          status: 400,
          error: "Each question must have id, question, and answer",
        };
      }

      if (!VALID_ANSWERS.includes(q.answer)) {
        return {
          success: false,
          status: 400,
          error: `Invalid answer "${q.answer}" for question ${q.id}. Must be one of: ${VALID_ANSWERS.join(", ")}`,
        };
      }

      flatQuestions.push({
        id: q.id,
        question: q.question,
        answer: q.answer,                  // fixed value, not merged
        explanation: q.explanation || "",  // separate field
        section: section.section_name,
        level: section.level,
      });
    }
  }

  if (flatQuestions.length === 0) {
    return { success: false, status: 400, error: "No questions found in sections" };
  }

  // --- Parse date DD/MM/YYYY ---
  let filledDate: Date;
  try {
    const [day, month, year] = payload.filled_date.split("/");
    filledDate = new Date(`${year}-${month}-${day}`);
    if (isNaN(filledDate.getTime())) throw new Error();
  } catch {
    return {
      success: false,
      status: 400,
      error: "Invalid filled_date format. Use DD/MM/YYYY",
    };
  }

  // --- Derive category (required by DB schema, not analysis) ---
  const levelCounts = { operational: 0, tactical: 0, strategic: 0 };
  for (const q of flatQuestions) levelCounts[q.level]++;
  const category = (Object.entries(levelCounts) as [string, number][]).reduce(
    (a, b) => (a[1] > b[1] ? a : b)
  )[0];

  // --- Database operations ---
  await dbConnect();

  const existing = await Questionnaire.findOne({ externalId: payload.id });
  if (existing) {
    return {
      success: false,
      status: 409,
      error: "A questionnaire with this ID has already been submitted",
      existingId: String(existing._id),
    };
  }

  const questionnaire = new Questionnaire({
    externalId: payload.id,
    title: `${payload.organization_name} — Security Assessment`,
    company: payload.organization_name,
    filledBy: `${payload.respondent_name} (${payload.respondent_title})`,
    role: payload.role,
    filledDate,
    category,
    status: "pending",
    questions: flatQuestions,
  });

  const saved = await questionnaire.save();

  console.log(
    `[Ingest][${source}] Saved: ${saved.company} | Interviewer: ${payload.interviewer_name} | ${flatQuestions.length} questions | ID: ${saved._id}`
  );

  return {
    success: true,
    status: 201,
    data: {
      id: String(saved._id),
      company: saved.company,
      filledBy: saved.filledBy,
      category: saved.category,
      totalQuestions: flatQuestions.length,
      questionsByLevel: levelCounts,
      questionnaireStatus: saved.status,
      receivedAt: saved.createdAt,
    },
  };
}
