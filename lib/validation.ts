/**
 * lib/validation.ts
 *
 * Central Zod schemas for every API route and form in the project.
 * Import the schema you need; call `validate(schema, data)` in route handlers.
 * Nothing here touches the database or changes business logic.
 */
import { z } from "zod";
import { NextResponse } from "next/server";

// ─── Shared primitives ────────────────────────────────────────────────────────

const email = z
    .string({ required_error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Invalid email address");

const password = z
    .string({ required_error: "Password is required" })
    .min(6, "Password must be at least 6 characters");

const strongPassword = password.min(8, "Password must be at least 8 characters");

const mongoId = z
    .string({ required_error: "ID is required" })
    .regex(/^[a-f\d]{24}$/i, "Invalid ID format");

const totpToken = z
    .string({ required_error: "Code is required" })
    .min(6, "Code must be at least 6 characters")
    .max(10, "Code is too long");

const userRole = z.enum(
    ["Director", "Division Head", "Risk Analyst", "Staff"],
    { errorMap: () => ({ message: "Invalid role" }) }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const SignupSchema = z.object({
    email,
    password,
    role: userRole,
    name: z.string().trim().max(100, "Name is too long").optional(),
});

export const LoginSchema = z.object({
    email,
    password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

// ─── Profile ──────────────────────────────────────────────────────────────────

export const UpdateProfileSchema = z
    .object({
        name: z.string().trim().max(100, "Name is too long").optional(),
        currentPassword: z.string().optional(),
        newPassword: strongPassword.optional(),
    })
    .refine(
        (data) => {
            // If newPassword is provided, currentPassword must also be provided
            if (data.newPassword && !data.currentPassword) return false;
            return true;
        },
        { message: "Current password is required to set a new password", path: ["currentPassword"] }
    );

export const UpdateUserRoleSchema = z.object({
    role: userRole,
});

// ─── MFA ──────────────────────────────────────────────────────────────────────

export const MfaEnableSchema = z.object({
    secret: z.string({ required_error: "Secret is required" }).min(16, "Invalid secret"),
    token: totpToken,
});

export const MfaDisableSchema = z.object({
    token: totpToken,
});

export const MfaVerifySchema = z.object({
    userId: mongoId,
    token: totpToken,
});

export const MfaPendingSchema = z.object({
    userId: mongoId,
});

// ─── Risk register ────────────────────────────────────────────────────────────

export const RiskFilterSchema = z.object({
    company: z.string().trim().optional(),
    category: z.string().trim().optional(),
    riskLevel: z
        .enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "VERY_LOW"])
        .optional(),
    status: z
        .enum(["open", "in_progress", "mitigated", "accepted", "closed", "transferred"])
        .optional(),
});

export const UpdateRiskSchema = z.object({
    owner: z.string().trim().max(200).optional(),
    treatment: z.enum(["mitigate", "accept", "transfer", "avoid"]).optional(),
    status: z
        .enum(["open", "in_progress", "mitigated", "accepted", "closed", "transferred"])
        .optional(),
    dueDate: z
        .string()
        .nullable()
        .optional()
        .refine(
            (v) => v === null || v === undefined || !isNaN(Date.parse(v)),
            "Invalid date format"
        ),
    comments: z.string().trim().max(2000).optional(),
});

// ─── Reports ──────────────────────────────────────────────────────────────────

export const GenerateReportSchema = z.object({
    analysisId: mongoId,
    level: z.enum(["strategic", "tactical", "operational"], {
        errorMap: () => ({ message: "Level must be strategic, tactical, or operational" }),
    }),
});

// ─── Analysis ─────────────────────────────────────────────────────────────────

export const ProcessAnalysisSchema = z.object({
    questionnaireId: mongoId,
});

// ─── Helper: validate + return consistent error response ─────────────────────

type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = { success: false; response: NextResponse };

/**
 * Parse `input` against `schema`.
 * On success returns `{ success: true, data }`.
 * On failure returns `{ success: false, response }` — return `response` directly from your route.
 *
 * Usage:
 *   const v = validate(SignupSchema, await req.json());
 *   if (!v.success) return v.response;
 *   const { email, password } = v.data;
 */
export function validate<T>(
    schema: z.ZodSchema<T>,
    input: unknown
): ValidationSuccess<T> | ValidationFailure {
    const result = schema.safeParse(input);
    if (result.success) {
        return { success: true, data: result.data };
    }

    // Flatten errors into a simple field → message map
    const fieldErrors = result.error.flatten().fieldErrors as Record<string, string[] | undefined>;
    const formErrors = result.error.flatten().formErrors;

    // Build a human-readable primary message
    const firstField = Object.keys(fieldErrors)[0];
    const primaryMessage =
        (firstField && fieldErrors[firstField]?.[0]) ??
        formErrors[0] ??
        "Validation failed";

    return {
        success: false,
        response: NextResponse.json(
            {
                error: primaryMessage,
                // Include full field-level detail so clients can highlight specific inputs
                fieldErrors: Object.fromEntries(
                    Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0]])
                ),
            },
            { status: 400 }
        ),
    };
}
