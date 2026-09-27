import test from "node:test";
import assert from "node:assert/strict";
import {
  IMMEDIATE_ACTION_ITEMS_RULES,
  STRATEGY_PROMPT,
  REFINEMENT_PROMPT,
  LOCAL_AZ_MODE_RULES,
  buildStrategyPrompt,
  buildRefinementPrompt,
  getRefinementInstruction,
} from "../src/services/ai/prompts.js";
import {
  validateActionItemTiming,
  validateNextStepsSequencing,
  alignNextStepsLogic,
  fallbackSummarizeTasks,
  summarizeTasksWithLuna,
} from "../src/services/ai/strategy-service.js";

test("1. IMMEDIATE_ACTION_ITEMS_RULES defines clear timeframe boundaries, prohibitions, and causality", () => {
  // 1. BU GÜN: First 24h triggers only, forbids 7-day monitoring
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /BU GÜN \/ TODAY/i);
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /İlk 24 saat/i);
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /tək-tək tətikləyici \(trigger\) addımlar/i);
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /7 gün ərzində izləyin/i);

  // 2. NÖVBƏTİ 48 SAAT: 2 days prep only, forbids 20-30 in-depth interviews
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /NÖVBƏTİ 48 SAAT \/ NEXT 48 HOURS/i);
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /Cəmi 2 gün/i);
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /20–30 nəfərlə canlı dərin müsahibə/i);
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /ilk 3 namizədlə əlaqə/i);

  // 3. BU HƏFTƏ: Pilot setup & first test orders, forbids premature retention/cohort analysis
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /BU HƏFTƏ \/ THIS WEEK/i);
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /Pilotun qurulması/i);
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /ilk test sifarişlərinin qəbulu/i);
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /ikinci sifariş \(retention\) analizi/i);
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /kohort retention/i);

  // 4. Causality: Operations must precede analytics
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /SƏBƏB-NƏTİCƏ ARDICILLIĞI/i);
  assert.match(IMMEDIATE_ACTION_ITEMS_RULES, /Əməliyyat baş vermədən onun analitik nəticəsi növbəti addım kimi tələb oluna bilməz/i);
});

test("2. STRATEGY_PROMPT, REFINEMENT_PROMPT, and LOCAL_AZ_MODE_RULES incorporate IMMEDIATE_ACTION_ITEMS_RULES", () => {
  // Strategy prompt integration
  assert.match(STRATEGY_PROMPT, /IMMEDIATE_ACTION_ITEMS_RULES/);
  assert.match(STRATEGY_PROMPT, /7 gün ərzində izləyin/);
  assert.match(STRATEGY_PROMPT, /20–30 nəfərlə canlı dərin müsahibə/);
  assert.match(STRATEGY_PROMPT, /ikinci sifariş \(retention\) analizi/);

  // Refinement prompt integration
  assert.match(REFINEMENT_PROMPT, /IMMEDIATE_ACTION_ITEMS_RULES/);
  assert.match(REFINEMENT_PROMPT, /Immediate Action Items \(nextSteps\)/);

  // Local AZ Mode rules integration
  assert.match(LOCAL_AZ_MODE_RULES, /Dərhal başlanılacaq fəaliyyətlər/);
  assert.match(LOCAL_AZ_MODE_RULES, /çoxgünlük proseslər qadağandır/);
  assert.match(LOCAL_AZ_MODE_RULES, /20–30 dərin müsahibə/);
  assert.match(LOCAL_AZ_MODE_RULES, /ikinci sifariş\/retention analizi qadağandır/);

  // make_practical refinement instruction
  const practicalInst = getRefinementInstruction("make_practical");
  assert.match(practicalInst, /Today: 24h single triggers/);
  assert.match(practicalInst, /Next 48h: initial prep without 20-30 interviews/);
  assert.match(practicalInst, /This week: pilot launch without premature retention analysis/);

  // Build helpers preserve rules
  const stratPromptAz = buildStrategyPrompt({ brief: "Bakıda kafe", answers: [] });
  assert.match(stratPromptAz, /IMMEDIATE_ACTION_ITEMS_RULES/);

  const stratPromptEn = buildStrategyPrompt({ brief: "Coffee shop in London", answers: [] });
  assert.match(stratPromptEn, /IMMEDIATE_ACTION_ITEMS_RULES/);

  const refPrompt = buildRefinementPrompt({ brief: "Bakı kafe" });
  assert.match(refPrompt, /IMMEDIATE_ACTION_ITEMS_RULES/);
});

test("3. validateActionItemTiming identifies timeframe contradictions and validates compliant tasks", () => {
  // Violation 1: BU GÜN with multi-day tracking
  const resTodayInvalid = validateActionItemTiming("Növbəti 7 gün ərzində izləyin və rəyləri toplayın", "Bu gün", "az");
  assert.equal(resTodayInvalid.valid, false);
  assert.ok(resTodayInvalid.issues.some((i) => i.includes("7 gün ərzində izləyin")));

  // Violation 1 EN: Today with 7 days tracking
  const resTodayInvalidEn = validateActionItemTiming("Monitor customer feedback over next 7 days", "Today", "en");
  assert.equal(resTodayInvalidEn.valid, false);
  assert.ok(resTodayInvalidEn.issues.some((i) => i.includes("Multi-day processes")));

  // Valid BU GÜN: Single 24h trigger
  const resTodayValid = validateActionItemTiming("Hüquq məsləhətçisinə rəsmi brifin göndərilməsi", "Bu gün", "az");
  assert.equal(resTodayValid.valid, true);
  assert.equal(resTodayValid.issues.length, 0);

  // Violation 2: NÖVBƏTİ 48 SAAT with 20-30 customer interviews
  const res48hInvalid = validateActionItemTiming("20–30 dərin müştəri müsahibəsi keçirin və tələbləri analiz edin", "Növbəti 48 saat", "az");
  assert.equal(res48hInvalid.valid, false);
  assert.ok(res48hInvalid.issues.some((i) => i.includes("20–30 dərin müştəri müsahibəsi")));

  // Violation 2 EN: Next 48 hours with 20-30 interviews
  const res48hInvalidEn = validateActionItemTiming("Conduct 20-30 in-depth customer interviews", "Next 48 hours", "en");
  assert.equal(res48hInvalidEn.valid, false);
  assert.ok(res48hInvalidEn.issues.some((i) => i.includes("20–30 in-depth interviews")));

  // Valid NÖVBƏTİ 48 SAAT: Prep & 3 candidate contacts
  const res48hValid = validateActionItemTiming("Müsahibə suallarının hazırlanması və ilk 3 namizədlə əlaqə", "Növbəti 48 saat", "az");
  assert.equal(res48hValid.valid, true);
  assert.equal(res48hValid.issues.length, 0);

  // Violation 3: BU HƏFTƏ with second-order retention / cohort analysis
  const resWeekInvalid = validateActionItemTiming("İkinci sifariş kohortu və retention analizini aparın", "Bu həftə", "az");
  assert.equal(resWeekInvalid.valid, false);
  assert.ok(resWeekInvalid.issues.some((i) => i.includes("ikinci sifariş kohortu və retention analizi tələb edilə bilməz")));

  // Violation 3 EN: This week with cohort retention
  const resWeekInvalidEn = validateActionItemTiming("Calculate cohort retention and second-order repeat purchase metrics", "This week", "en");
  assert.equal(resWeekInvalidEn.valid, false);
  assert.ok(resWeekInvalidEn.issues.some((i) => i.includes("Second-order retention or cohort analysis")));

  // Valid BU HƏFTƏ: Pilot setup and first orders
  const resWeekValid = validateActionItemTiming("Pilot layihənin qurulması və ilk test sifarişlərinin qəbulu", "Bu həftə", "az");
  assert.equal(resWeekValid.valid, true);
  assert.equal(resWeekValid.issues.length, 0);
});

test("4. validateNextStepsSequencing audits full 6-step sequential plans", () => {
  const cleanPlan = [
    "Hüquq məsləhətçisinə rəsmi brifin göndərilməsi",
    "Büdcə bölgüsü cədvəlinin qaralamasının açılması",
    "Müsahibə suallarının hazırlanması və ilk 3 namizədlə əlaqə",
    "Pilot üçün 3 hazır setin və qiymətlərin dəqiqləşdirilməsi",
    "Pilotun qurulması və ilk test sifarişlərinin qəbulu",
    "İlkin test sifarişlərinin çatdırılması və müştəri rəylərinin toplanması",
  ];

  const cleanResult = validateNextStepsSequencing(cleanPlan, "az");
  assert.equal(cleanResult.valid, true);
  assert.equal(cleanResult.issues.length, 0);
  assert.equal(cleanResult.evaluated.length, 6);

  const flawedPlan = [
    "Növbəti 7 gün ərzində izləyin", // Flaw in Group 0 (Bu gün)
    "Büdcə bölgüsü cədvəlinin qaralamasının açılması",
    "20–30 dərin müştəri müsahibəsi aparın", // Flaw in Group 1 (Növbəti 48 saat)
    "Pilot üçün 3 hazır setin və qiymətlərin dəqiqləşdirilməsi",
    "İkinci sifariş kohortu və retention analizi aparın", // Flaw in Group 2 (Bu həftə)
    "Pilotun qurulması və ilk test sifarişlərinin qəbulu",
  ];

  const flawedResult = validateNextStepsSequencing(flawedPlan, "az");
  assert.equal(flawedResult.valid, false);
  assert.equal(flawedResult.issues.length, 3);
  assert.ok(flawedResult.issues[0].includes("Bu gün"));
  assert.ok(flawedResult.issues[1].includes("Növbəti 48 saat"));
  assert.ok(flawedResult.issues[2].includes("Bu həftə"));
});

test("5. alignNextStepsLogic automatically aligns and corrects flawed timeframes non-destructively", () => {
  const flawedSteps = [
    "Növbəti 7 gün ərzində izləyin",
    "Büdcə bölgüsü cədvəlinin qaralamasının açılması",
    "20–30 dərin müştəri müsahibəsi aparın",
    "Pilot üçün 3 hazır setin və qiymətlərin dəqiqləşdirilməsi",
    "İkinci sifariş kohortu və retention analizi aparın",
    "Pilotun qurulması və ilk test sifarişlərinin qəbulu",
  ];

  const aligned = alignNextStepsLogic(flawedSteps, "az");
  assert.equal(aligned.length, 6);

  // Group 0 step 0 corrected from 7-day monitoring to immediate 24h trigger
  assert.ok(!aligned[0].includes("7 gün"));
  assert.ok(aligned[0].includes("bu gün") || aligned[0].includes("ilkin"));

  // Compliant step 1 untouched
  assert.equal(aligned[1], "Büdcə bölgüsü cədvəlinin qaralamasının açılması");

  // Group 1 step 2 corrected from 20-30 interviews to question prep and first 3 candidates
  assert.ok(!aligned[2].includes("20–30"));
  assert.ok(aligned[2].includes("ilk 3 namizəd"));

  // Compliant step 3 untouched
  assert.equal(aligned[3], "Pilot üçün 3 hazır setin və qiymətlərin dəqiqləşdirilməsi");

  // Group 2 step 4 corrected from premature retention/cohort analysis to pilot launch
  assert.ok(!aligned[4].includes("retention"));
  assert.ok(!aligned[4].includes("kohort"));
  assert.ok(aligned[4].includes("Pilot"));

  // After alignment, validateNextStepsSequencing must report 100% valid
  const postValidation = validateNextStepsSequencing(aligned, "az");
  assert.equal(postValidation.valid, true);
  assert.equal(postValidation.issues.length, 0);
});

test("6. fallbackSummarizeTasks normalizes and assigns timeframes complying with standards", () => {
  // Multi-day task placed at index 0 (which would default to Bu gün) gets reassigned to Bu həftə
  const tasks = [
    "Növbəti 7 gün ərzində izləyin və rəyləri toplayın",
    "Müsahibə suallarının hazırlanması və ilk 3 namizədlə əlaqə",
    "Pilotun qurulması və ilk test sifarişlərinin qəbulu",
  ];

  const result = fallbackSummarizeTasks(tasks, "az", "gpt-6-luna");
  assert.equal(result.tasks.length, 3);
  // Task 0 was multi-day, so it should NOT be assigned to Bu gün
  assert.equal(result.tasks[0].timeframe, "Bu həftə");
  assert.equal(result.tasks[1].timeframe, "Növbəti 48 saat");
  assert.equal(result.tasks[2].timeframe, "Bu həftə");

  // Standard tasks without multi-day phrasing get standard distribution
  const normalTasks = [
    "Hüquq məsləhətçisinə rəsmi brifin göndərilməsi",
    "Müsahibə suallarının hazırlanması və ilk 3 namizədlə əlaqə",
    "Pilotun qurulması və ilk test sifarişlərinin qəbulu",
  ];

  const normalResult = fallbackSummarizeTasks(normalTasks, "az", "gpt-6-luna");
  assert.equal(normalResult.tasks[0].timeframe, "Bu gün");
  assert.equal(normalResult.tasks[1].timeframe, "Növbəti 48 saat");
  assert.equal(normalResult.tasks[2].timeframe, "Bu həftə");
});

test("7. summarizeTasksWithLuna passes strict timeframe and causality instructions to gpt-6-luna", async () => {
  let capturedSystemPrompt = null;

  const mockOpenAIClient = {
    chat: {
      completions: {
        async create(payload) {
          capturedSystemPrompt = payload.messages?.find((m) => m.role === "system")?.content;
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    tasks: [
                      {
                        title: "Hüquq məsləhətçisinə rəsmi brifin göndərilməsi",
                        timeframe: "Bu gün",
                        status: "todo",
                      },
                      {
                        title: "Müsahibə suallarını hazırla və ilk 3 namizədlə əlaqə qur",
                        timeframe: "Növbəti 48 saat",
                        status: "todo",
                      },
                      {
                        title: "Pilot layihəni qur və ilk test sifarişlərini qəbul et",
                        timeframe: "Bu həftə",
                        status: "todo",
                      },
                    ],
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
          };
        },
      },
    },
  };

  // Test Azerbaijani prompt
  await summarizeTasksWithLuna({
    tasks: ["Task 1", "Task 2", "Task 3"],
    strategyTitle: "Bakı Kafe",
    language: "az",
    client: mockOpenAIClient,
  });

  assert.match(capturedSystemPrompt, /Dəqiq Zaman Çərçivəsi Uyğunluğu/);
  assert.match(capturedSystemPrompt, /'7 gün ərzində izləyin' kimi uzun proseslər 'Bu gün' başlığı altına qətiyyən salına bilməz/);
  assert.match(capturedSystemPrompt, /20–30 nəfərlə canlı görüş\/müsahibə/);
  assert.match(capturedSystemPrompt, /Hələ baş tutmamış pilotun ikinci sifariş \(retention\) analizi/);
  assert.match(capturedSystemPrompt, /Səbəb-Nəticə Ardıcıllığı/);

  // Test English prompt
  await summarizeTasksWithLuna({
    tasks: ["Task 1", "Task 2", "Task 3"],
    strategyTitle: "London Cafe",
    language: "en",
    client: mockOpenAIClient,
  });

  assert.match(capturedSystemPrompt, /Strict Timeframe Compliance/);
  assert.match(capturedSystemPrompt, /Long multi-day processes like 'Monitor over 7 days' must NEVER be assigned to 'Today'/);
  assert.match(capturedSystemPrompt, /Never squeeze multi-week tasks \(like conducting 20–30 customer interviews\) into 48 hours/);
  assert.match(capturedSystemPrompt, /Never demand second-order retention analysis/);
  assert.match(capturedSystemPrompt, /Strict Causality/);
});
