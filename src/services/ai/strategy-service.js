import {
  StrategyAssessmentSchema,
  StrategySchema,
  StrategySummaryOutputSchema,
  serializeStrategyContext,
  analyzeBriefSignals,
  validateAssessment,
} from "../../domain/strategy.js";
import { aiConfig, hasOpenAIConfiguration } from "./config.js";
import { getOpenAIClient } from "./client.js";
import { LLMProviderError, routeStructuredGeneration } from "./llm-router.js";
import {
  ASSESSOR_PROMPT,
  REFINEMENT_PROMPT,
  STRATEGY_PROMPT,
  buildAssessorPrompt,
  buildRefinementInput,
  buildRefinementPrompt,
  buildStrategyPrompt,
} from "./prompts.js";

function clarificationContext(answers) {
  if (!answers?.length) return "No clarification answers have been provided.";
  return answers.map((item) => `${item.question}\nAnswer: ${item.answer}`).join("\n\n");
}

export async function assessBrief({
  brief,
  answers = [],
  round = 0,
  language = "az",
  ownerId,
  signal,
  personalizationContext = "",
  onChunk,
  onUsage,
}) {
  const isEn = language === "en";
  const signals = analyzeBriefSignals(brief);
  const forceDecision = round >= aiConfig.maxClarificationRounds;
  const languageDirective = isEn
    ? "IMPORTANT LANGUAGE REQUIREMENT: The user has selected ENGLISH as the UI language. All generated outputs (understanding, every question, reason, options, and assumptions) MUST BE WRITTEN IN ENGLISH, even if the brief is in Azerbaijani or discusses Azerbaijani topics."
    : "DİL TƏLƏBİ: İstifadəçinin interfeys dili AZƏRBAYCAN dilidir. Bütün suallar, səbəblər, seçimlər və fərziyyələr Azərbaycan dilində formalaşdırılmalıdır.";

  const input = `Original brief:\n${brief}\n\nClarification answers:\n${clarificationContext(answers)}\n\nIntake signals (advisory only):\n${JSON.stringify(signals)}\n\nClarification round: ${round} of ${aiConfig.maxClarificationRounds}.\n${
    forceDecision
      ? (isEn
          ? "The clarification limit has been reached. Return ready and clearly state reasonable assumptions in English unless the business itself or objective is impossible to identify."
          : "The clarification limit has been reached. Return ready and clearly state reasonable assumptions unless the business itself or objective is impossible to identify.")
      : (isEn
          ? "Decide whether a targeted clarification round is materially useful. All questions and options must be in English."
          : "Decide whether a targeted clarification round is materially useful.")
  }\n\n${languageDirective}`;

  const instructions = buildAssessorPrompt({ brief, answers, personalizationContext });

  const result = await routeStructuredGeneration({
    schema: StrategyAssessmentSchema,
    name: "strategy_assessment",
    instructions,
    input,
    maxOutputTokens: aiConfig.assessmentMaxOutputTokens,
    reasoning: "low",
    ownerId,
    signal,
    onChunk,
    onUsage,
  });

  const assessment = validateAssessment(result.data);
  if (forceDecision && assessment.status === "needs_clarification") {
    return {
      status: "ready",
      understanding: assessment.understanding,
      questions: [],
      assumptions: [
        isEn
          ? "Some intake details were not provided, so the strategy proceeds with clearly labeled working assumptions."
          : "Bəzi ilkin detallar təqdim edilmədiyi üçün strategiya aydın qeyd edilmiş işçi fərziyyələrlə davam edir.",
      ],
      model: result.model,
    };
  }
  return { ...assessment, model: result.model };
}

export async function generateStrategy({
  brief,
  answers = [],
  assumptions = [],
  language = "az",
  ownerId,
  signal,
  personalizationContext = "",
  onChunk,
  onUsage,
}) {
  const isEn = language === "en";
  const languageDirective = isEn
    ? "\n\nLanguage Directive: The user has selected English. Generate the entire strategy in clear, professional English."
    : "\n\nLanguage Directive: Strategiyanı təmiz, peşəkar Azərbaycan dilində hazırla.";

  const input = `Original brief:\n${brief}\n\nClarification answers:\n${clarificationContext(answers)}\n\nIntake assumptions:\n${
    assumptions.length ? assumptions.join("\n- ") : "None supplied."
  }${languageDirective}`;

  const instructions = buildStrategyPrompt({ brief, answers, personalizationContext });

  const result = await routeStructuredGeneration({
    schema: StrategySchema,
    name: "helmer_strategy",
    instructions,
    input,
    maxOutputTokens: aiConfig.strategyMaxOutputTokens,
    reasoning: "medium",
    ownerId,
    signal,
    onChunk,
    onUsage,
  });

  return result.data;
}

export async function refineStrategy(payload, ownerId, signal, personalizationContext = "", onChunk, onUsage) {
  const isEn = payload.language === "en";
  const languageDirective = isEn
    ? "\n\nLanguage Directive: The user has selected English. Maintain and output the refined strategy in professional English."
    : "";

  const instructions = buildRefinementPrompt({
    brief: payload.brief,
    answers: payload.answers,
    strategy: payload.strategy,
    personalizationContext,
  });

  const result = await routeStructuredGeneration({
    schema: StrategySchema,
    name: "helmer_refined_strategy",
    instructions,
    input: `${buildRefinementInput(payload)}${languageDirective}`,
    maxOutputTokens: aiConfig.refinementMaxOutputTokens,
    reasoning: payload.action === "think_deeper" ? "high" : "medium",
    ownerId,
    signal,
    onChunk,
    onUsage,
  });

  return result.data;
}

export async function summarizeStrategyWithLuna({
  strategy,
  language = "az",
  client = null,
  signal = null,
  onUsage = null,
}) {
  const isEn = language === "en";
  const modelName = aiConfig.strategySummaryModel || "gpt-5.6-luna";

  if (!client && !hasOpenAIConfiguration()) {
    const err = new Error("OpenAI is not configured.");
    err.code = "AI_NOT_CONFIGURED";
    err.model = modelName;
    throw err;
  }

  const openaiClient = client || getOpenAIClient();
  const strategyContext = serializeStrategyContext(strategy);

  const systemPrompt = isEn
    ? `You are an elite Chief Strategy Officer and executive advisor.
Analyze the complete business and marketing strategy provided below and produce an incisive, high-impact executive summary.

STRICT REQUIREMENTS:
1. No fluff, no boilerplate corporate buzzwords. Present direct, actionable points, key metrics, and decisive strategic moves.
2. The summary must be comprehensive yet punchy, precisely covering every critical pillar of the strategy:
   - Objective: core business goal, target market, and primary audience
   - Key Moves: decisive strategic and tactical differentiators (at least 3-5 concrete moves)
   - Execution Direction: implementation roadmap, key phases, and sequencing
   - Budget & KPIs: budget allocation logic, target metrics, and measurable benchmarks
   - Executive Takeaway: decisive bottom-line verdict and strategic priority for leadership
3. Return ONLY a valid JSON object matching this structure:
{
  "title": "Strategy Title",
  "objective": "Concise summary of core objectives and market focus",
  "keyMoves": [
    "Critical strategic move 1",
    "Critical strategic move 2",
    "Critical strategic move 3"
  ],
  "execution": "Execution roadmap and phase breakdown",
  "kpisAndBudget": "Budget considerations and target KPIs",
  "takeaway": "Decisive executive takeaway for leadership",
  "summary": "Cohesive, high-impact executive summary paragraph uniting all points"
}`
    : `Sən yüksək səviyyəli strateq və icraçı direktorsan (Chief Strategy Officer).
Sənə təqdim olunan marketinq və biznes strategiyasının tam məzmununu dərindən təhlil edib, qərarvericilər üçün kəsərli, konkret və dolğun xülasə hazırlamalısan.

CİDDİ TƏLƏBLƏR:
1. Boş söz yığını, ümumi bəlağətli ifadələr qətiyyən olmamalıdır. Birbaşa konkret faktlar, rəqəmlər və əsas qərarlar verilməlidir.
2. Xülasə yığcam, lakin strategiyanın bütün kritik bəndlərini dəqiq əks etdirən ətraflı xülasə formatında olmalıdır:
   - Hədəf: biznesin əsas məqsədi, hədəf kütləsi və bazar fokusu
   - Əsas gedişlər: strategiyanı fərqləndirən və qələbə gətirən ən mühüm taktiki və strateji addımlar (ən azı 3-5 konkret addım)
   - İcra istiqaməti: icra mərhələləri, ardıcıllıq və əsas addımlar
   - Büdcə və KPI: büdcə istiqamətləri və ölçülə bilən əsas nəticə göstəriciləri
   - Kəsərli yekun: qərarverici üçün ən mühüm strateji nəticə və rəhbərlik üçün əsas mesaj
3. Cavab YALNIZ aşağıdakı struktura uyğun valid JSON formatında olmalıdır:
{
  "title": "Strategiyanın adı",
  "objective": "Konkret hədəf və bazar fokusunun xülasəsi",
  "keyMoves": [
    "1-ci kritik strateji gediş",
    "2-ci kritik strateji gediş",
    "3-cü kritik strateji gediş"
  ],
  "execution": "İcra ardıcıllığı və əsas mərhələlərin xülasəsi",
  "kpisAndBudget": "Büdcə bölgüsü və əsas ölçülə bilən KPI hədəfləri",
  "takeaway": "Qərarverici üçün kəsərli strateji yekun",
  "summary": "Bütün bu məqamları birləşdirən bütöv, axıcı və kəsərli xülasə mətni"
}`;

  const userContent = isEn
    ? `Generate an incisive, high-impact executive summary for this strategy:\n\n${strategyContext}`
    : `Aşağıdakı strategiya üçün kəsərli, dolğun və konkret icraçı xülasəsini tərtib et:\n\n${strategyContext}`;

  const completion = await openaiClient.chat.completions.create(
    {
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    },
    signal ? { signal } : undefined,
  );

  if (typeof onUsage === "function" && completion.usage) {
    onUsage({
      provider: "openai",
      model: modelName,
      usage: {
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
      },
    });
  }

  const rawContent = completion.choices?.[0]?.message?.content?.trim() || "{}";
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (jsonErr) {
    throw new LLMProviderError("Model etibarsız JSON cavabı qaytardı.", {
      code: "AI_INVALID_OUTPUT",
      status: 502,
      model: modelName,
      cause: jsonErr,
    });
  }

  const validated = StrategySummaryOutputSchema.parse({
    title: parsed.title || strategy?.title || (isEn ? "Strategy Summary" : "Strategiya Xülasəsi"),
    objective: parsed.objective || "",
    keyMoves: Array.isArray(parsed.keyMoves) ? parsed.keyMoves.map(String) : [],
    execution: parsed.execution || "",
    kpisAndBudget: parsed.kpisAndBudget || "",
    takeaway: parsed.takeaway || "",
    summary: parsed.summary || "",
  });

  return {
    ...validated,
    model: modelName,
  };
}
