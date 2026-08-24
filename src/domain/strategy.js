import { z } from "zod";

const shortText = z.string().trim().min(1).max(300);
const paragraph = z.string().trim().min(1).max(3000);
const longText = z.string().trim().min(1).max(12000);

export const strategyStatuses = [
  "draft",
  "analyzing",
  "needs_clarification",
  "generating",
  "ready",
  "refining",
  "saved",
  "error",
];

export const refinementActions = [
  "shorten",
  "localize_azerbaijan",
  "think_deeper",
  "make_practical",
  "budget_optimize",
  "custom",
];

export const ClarificationQuestionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  question: shortText,
  reason: z.string().trim().max(300),
  inputType: z.enum(["text", "single_choice", "multi_choice"]),
  options: z.array(z.string().trim().min(1).max(120)).max(8),
});

export const StrategyAssessmentSchema = z.object({
  status: z.enum(["needs_clarification", "ready"]),
  understanding: paragraph,
  questions: z.array(ClarificationQuestionSchema).max(5),
  assumptions: z.array(shortText).max(12),
});

export const StrategySchema = z.object({
  title: shortText,
  summary: longText,
  context: z.object({
    business: paragraph,
    objective: paragraph,
    market: paragraph,
    targetAudience: paragraph,
  }),
  sections: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        title: shortText,
        summary: z.string().trim().max(800),
        content: longText,
        bullets: z.array(paragraph).max(12),
      }),
    )
    .min(3)
    .max(12),
  priorities: z
    .array(
      z.object({
        title: shortText,
        description: paragraph,
        priority: z.enum(["high", "medium", "low"]),
      }),
    )
    .min(1)
    .max(10),
  actionPlan: z
    .array(
      z.object({
        phase: shortText,
        actions: z.array(paragraph).min(1).max(10),
        expectedOutcome: z.string().trim().max(800),
      }),
    )
    .min(1)
    .max(10),
  kpis: z
    .array(
      z.object({
        name: shortText,
        reason: paragraph,
        target: z.string().trim().max(300),
      }),
    )
    .min(1)
    .max(12),
  risks: z
    .array(
      z.object({
        risk: paragraph,
        mitigation: paragraph,
      }),
    )
    .max(10),
  assumptions: z.array(paragraph).max(12),
  nextSteps: z.array(paragraph).min(1).max(12),
});

export const ClarificationAnswerSchema = z.object({
  questionId: z.string().trim().min(1).max(80),
  question: shortText,
  answer: z.string().trim().min(1).max(1500),
});

export const AssessRequestSchema = z.object({
  brief: z.string().trim().min(8).max(8000),
  answers: z.array(ClarificationAnswerSchema).max(10).default([]),
  round: z.number().int().min(0).max(2).default(0),
  selectedModel: z.enum(["gemini-3.7-flash", "gpt-5.6-terra"]),
});

export const GenerateRequestSchema = z.object({
  brief: z.string().trim().min(8).max(8000),
  answers: z.array(ClarificationAnswerSchema).max(10).default([]),
  assumptions: z.array(shortText).max(12).default([]),
  idempotencyKey: z.string().trim().min(8).max(120),
  selectedModel: z.enum(["gemini-3.7-flash", "gpt-5.6-terra"]),
  continuation: z.string().max(60000).optional(),
});

export const RefineRequestSchema = z
  .object({
    brief: z.string().trim().min(8).max(8000),
    answers: z.array(ClarificationAnswerSchema).max(10).default([]),
    strategy: StrategySchema,
    action: z.enum(refinementActions),
    request: z.string().trim().max(2000).default(""),
    selectedModel: z.enum(["gemini-3.7-flash", "gpt-5.6-terra"]),
  })
  .superRefine((value, context) => {
    if (value.action === "custom" && value.request.length < 3) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["request"],
        message: "Dəyişiklik istəyini yaz.",
      });
    }
  });

export const SaveStrategyRequestSchema = z.object({
  clientSaveId: z.string().trim().min(8).max(120),
  brief: z.string().trim().min(8).max(8000),
  answers: z.array(ClarificationAnswerSchema).max(10).default([]),
  strategy: StrategySchema,
  versions: z
    .array(
      z.object({
        versionNumber: z.number().int().min(1).max(100),
        data: StrategySchema,
        changeRequest: z.string().trim().max(2000),
        createdAt: z.string().datetime(),
      }),
    )
    .min(1)
    .max(100),
});

export function validateAssessment(value) {
  const assessment = StrategyAssessmentSchema.parse(value);

  if (assessment.status === "needs_clarification" && assessment.questions.length === 0) {
    throw new Error("Clarification assessment did not include any questions.");
  }

  if (assessment.status === "ready") {
    return { ...assessment, questions: [] };
  }

  return { ...assessment, assumptions: [] };
}

const signalMatchers = {
  business: /\b(restoran|restaurant|cafe|kafe|brand|brend|saas|app|məhsul|product|xidmət|service|e-?commerce|mağaza|shop|şirkət|company)\b/i,
  objective: /\b(artır|increase|launch|satış|sales|growth|böyü|repeat|təkrar|lead|conversion|konversiya|awareness|tanınma)\b/i,
  audience: /\b(auditoriya|target|müştəri|customer|women|men|qadın|kişi|yaş|aged|b2b|b2c|student|tələbə)\b/i,
  market: /\b(bakı|baku|azərbaycan|azerbaijan|market|bazar|region|regional|badamdar)\b/i,
  timeline: /\b(gün|days?|weeks?|həftə|months?|ay|quarter|rüb|20\d{2})\b/i,
  budget: /\b(azn|manat|₼|budget|büdcə|\$|€)\b/i,
};

export function analyzeBriefSignals(brief) {
  const signals = Object.fromEntries(
    Object.entries(signalMatchers).map(([name, matcher]) => [name, matcher.test(brief)]),
  );
  const score = Object.values(signals).filter(Boolean).length;
  return {
    signals,
    score,
    likelyComplete: score >= 5 && signals.business && signals.objective && signals.audience,
    missing: Object.entries(signals)
      .filter(([, found]) => !found)
      .map(([name]) => name),
  };
}

export function formatValidationError(error) {
  if (!(error instanceof z.ZodError)) return null;
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "request",
    message: issue.message,
  }));
}
