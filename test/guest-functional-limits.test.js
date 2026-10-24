import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUEST_RESTRICTION_NOTICES,
  buildGuestFunctionalRestrictionInstructions,
  detectGuestFunctionalRestriction,
  buildAskPrompt,
} from '../src/services/ai/prompts.js';

test('Guest functional limits: GUEST_RESTRICTION_NOTICES exact strings match specifications', () => {
  assert.equal(
    GUEST_RESTRICTION_NOTICES.thinking,
    "Ask rejimində 'Thinking' funksiyasından istifadə etmək üçün qeydiyyatdan keçməlisiniz. Hesab yaradaraq dərin strateji təhlilləri aktivləşdirin."
  );
  assert.equal(
    GUEST_RESTRICTION_NOTICES.file,
    "Fayl yükləmək və sənədlərinizi analiz etmək üçün qeydiyyatdan keçməlisiniz."
  );
  assert.equal(
    GUEST_RESTRICTION_NOTICES.strategy,
    "Saxlanılmış strategiyalarınıza daxil olmaq və onlar üzərində işləmək üçün qeydiyyatdan keçməlisiniz."
  );
  assert.equal(
    GUEST_RESTRICTION_NOTICES.planner,
    "'Planner Tasks' bölməsindən istifadə etmək və tapşırıqlarınızı idarə etmək üçün qeydiyyatdan keçməlisiniz."
  );
});

test('Guest functional limits: buildGuestFunctionalRestrictionInstructions creates prompt directives', () => {
  const instructions = buildGuestFunctionalRestrictionInstructions();
  assert.ok(instructions.includes('GİRİŞ VƏ FUNKSİONAL MƏHDUDİYYƏT QAYDALARI'));
  assert.ok(instructions.includes('Hazırkı istifadəçi sessiyası: Qeydiyyatsız (Qonaq).'));
  assert.ok(instructions.includes(GUEST_RESTRICTION_NOTICES.thinking));
  assert.ok(instructions.includes(GUEST_RESTRICTION_NOTICES.file));
  assert.ok(instructions.includes(GUEST_RESTRICTION_NOTICES.strategy));
  assert.ok(instructions.includes(GUEST_RESTRICTION_NOTICES.planner));
  assert.ok(instructions.includes('Ümumi Qayda: Yuxarıdakı 4 halda əlavə heç bir izahat və ya alternativ cavab vermə.'));
});

test('Guest functional limits: buildAskPrompt integrates restriction directives only for guests', () => {
  const guestPrompt = buildAskPrompt({ isGuest: true });
  assert.ok(guestPrompt.includes('GİRİŞ VƏ FUNKSİONAL MƏHDUDİYYƏT QAYDALARI'));
  assert.ok(guestPrompt.includes(GUEST_RESTRICTION_NOTICES.thinking));

  const userPrompt = buildAskPrompt({ isGuest: false });
  assert.ok(!userPrompt.includes('GİRİŞ VƏ FUNKSİONAL MƏHDUDİYYƏT QAYDALARI'));
  assert.ok(!userPrompt.includes(GUEST_RESTRICTION_NOTICES.thinking));
});

test('Guest functional limits: detectGuestFunctionalRestriction detects thinking feature', () => {
  // via thinkingLevel
  assert.equal(
    detectGuestFunctionalRestriction({ rawThinkingLevel: 'high' }),
    GUEST_RESTRICTION_NOTICES.thinking
  );
  assert.equal(
    detectGuestFunctionalRestriction({ rawThinkingLevel: 'medium' }),
    GUEST_RESTRICTION_NOTICES.thinking
  );

  // via text queries
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Thinking rejimini aktivləşdir' }),
    GUEST_RESTRICTION_NOTICES.thinking
  );
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Bu məsələni dərindən düşün' }),
    GUEST_RESTRICTION_NOTICES.thinking
  );
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Düşünmə rejiminə keç' }),
    GUEST_RESTRICTION_NOTICES.thinking
  );
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Dərin təhlil apar' }),
    GUEST_RESTRICTION_NOTICES.thinking
  );
});

test('Guest functional limits: detectGuestFunctionalRestriction detects file attachment feature', () => {
  // via hasAttachment flag
  assert.equal(
    detectGuestFunctionalRestriction({ hasAttachment: true }),
    GUEST_RESTRICTION_NOTICES.file
  );

  // via text queries
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Zəhmət olmasa bu fayl əlavə et' }),
    GUEST_RESTRICTION_NOTICES.file
  );
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Bu sənədi analiz et' }),
    GUEST_RESTRICTION_NOTICES.file
  );
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Fayl yükləmək istəyirəm' }),
    GUEST_RESTRICTION_NOTICES.file
  );
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Attach file to analyze' }),
    GUEST_RESTRICTION_NOTICES.file
  );
});

test('Guest functional limits: detectGuestFunctionalRestriction detects saved strategies feature', () => {
  // via hasStrategyContext flag
  assert.equal(
    detectGuestFunctionalRestriction({ hasStrategyContext: true }),
    GUEST_RESTRICTION_NOTICES.strategy
  );

  // via text queries
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'My strategies siyahısını göstər' }),
    GUEST_RESTRICTION_NOTICES.strategy
  );
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Saxlanılmış strategiyalarıma baxaq' }),
    GUEST_RESTRICTION_NOTICES.strategy
  );
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Discuss a saved strategy with me' }),
    GUEST_RESTRICTION_NOTICES.strategy
  );
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Yadda saxlanılmış strategiyamı aç' }),
    GUEST_RESTRICTION_NOTICES.strategy
  );
});

test('Guest functional limits: detectGuestFunctionalRestriction detects planner tasks feature', () => {
  // via hasTaskContext flag
  assert.equal(
    detectGuestFunctionalRestriction({ hasTaskContext: true }),
    GUEST_RESTRICTION_NOTICES.planner
  );

  // via text queries
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Planner tasks bölməsini aç' }),
    GUEST_RESTRICTION_NOTICES.planner
  );
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Planlayıcı tapşırıqlarımı göstər' }),
    GUEST_RESTRICTION_NOTICES.planner
  );
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Planlayıcıya bax və tapşırıqları idarə et' }),
    GUEST_RESTRICTION_NOTICES.planner
  );
});

test('Guest functional limits: regular business queries pass through undetected', () => {
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'Bakıda qəhvəxana üçün marketinq strategiyası necə qurulmalıdır?' }),
    null
  );
  assert.equal(
    detectGuestFunctionalRestriction({ lastUserMsg: 'B2B satışlarda konversiyanı necə artıra bilərik?' }),
    null
  );
});
