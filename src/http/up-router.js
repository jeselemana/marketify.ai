import express from 'express';
import { z } from 'zod';
import { requireAuth } from './auth-middleware.js';
import { upLog } from '../services/up/ai.js';

const language = z.enum(['az', 'en']).default('az');
const StartSchema = z.object({ language }).strict();
const SubmitSchema = z.object({
  selectedOption: z.string().trim().min(1).max(8000).optional(),
  answer: z.string().trim().min(1).max(8000).optional(),
  language: language.optional().default('az'),
}).strict().refine(val => Boolean(val.selectedOption || val.answer), {
  message: 'Variant və ya cavab tələb olunur.',
});

const uuid = z.string().uuid();
const domainCodes = new Set(['NOT_FOUND', 'ONBOARDING_REQUIRED', 'ONBOARDING_COMPLETE', 'ANSWER_IMMUTABLE', 'ANSWER_REQUIRED', 'INVALID_OPTION', 'GENERATION_BUSY', 'GENERATION_SUPERSEDED', 'EVALUATION_BUSY', 'EVALUATION_SUPERSEDED', 'EVALUATION_RETRY_LIMIT', 'DAILY_EVALUATION_LIMIT', 'DAILY_GENERATION_LIMIT', 'INVALID_OWNER', 'STORAGE_LIMIT', 'ACCOUNT_DELETED', 'STORAGE_BUSY']);
const messages = {
  AI_NOT_CONFIGURED: 'GPT-6 Luna bağlantısı konfiqurasiya edilməyib.',
  MODEL_UNAVAILABLE: 'GPT-6 Luna bu hesab üçün əlçatan deyil. Başqa modelə keçid edilmədi.',
  GENERATION_BUSY: 'Challenge hazırlanır. Bir az sonra yeniləyin.',
  EVALUATION_BUSY: 'Qərar yoxlanılır. Bir az sonra yeniləyin.',
  DAILY_EVALUATION_LIMIT: 'Bu gün üçün qiymətləndirmə limiti tamamlanıb.',
  DAILY_GENERATION_LIMIT: 'Bu gün üçün challenge limiti tamamlanıb.',
  EVALUATION_RETRY_LIMIT: 'Qiymətləndirmə cəhdlərinin limiti tamamlanıb.',
  ANSWER_IMMUTABLE: 'Göndərilmiş qərarı dəyişmək mümkün deyil.',
  ONBOARDING_REQUIRED: 'Əvvəlcə UP hədəflərini seçin.',
  NOT_FOUND: 'Challenge tapılmadı.',
  INVALID_OPTION: 'Yanlış variant seçimi.',
};

export function createUpRouter(service) {
  const router = express.Router();
  const limits = new Map();

  router.use((req, res, next) => {
    if (!req.auth?.user) return next();
    const now = Date.now(), key = `${req.user.id}:${req.ip || req.socket.remoteAddress}`;
    for (const [id, bucket] of limits) if (bucket.until <= now) limits.delete(id);
    const bucket = limits.get(key) || { until: now + 60000, count: 0 };
    bucket.count++; limits.set(key, bucket);
    if (bucket.count > 90 || limits.size > 5000) return res.status(429).json({ code: 'RATE_LIMIT', error: 'Bir az sonra yenidən cəhd edin.' });
    next();
  });

  router.use(requireAuth, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  const route = fn => async (req, res) => {
    try { return res.json(await fn(req)); }
    catch (error) {
      const invalid = error.name === 'ZodError' && !error.status;
      const domain = domainCodes.has(error.code);
      const unavailable = error.code === 'model_not_found' || !domain && [403, 404].includes(error.status);
      const code = invalid ? 'VALIDATION_ERROR' : unavailable ? 'MODEL_UNAVAILABLE' : error.code === 'AI_NOT_CONFIGURED' ? error.code : domain ? error.code : 'UP_UNAVAILABLE';
      const status = invalid ? 400 : unavailable || error.code === 'AI_NOT_CONFIGURED' ? 503 : domain ? error.status : 503;
      upLog('request_failed', { path: req.route.path, code, status });
      return res.status(status).json({
        code,
        error: messages[code] || (invalid ? 'Məlumatları yoxlayın.' : req.route.path.endsWith('/submit') || req.route.path.endsWith('/retry') ? 'Qiymətləndirmə tamamlanmadı. Göndərilmiş qərarı yenidən yoxlamaq mümkündür.' : 'UP sorğusu tamamlanmadı. Bir az sonra yenidən cəhd edin.'),
        retryable: status >= 500 || ['GENERATION_BUSY', 'EVALUATION_BUSY'].includes(code),
      });
    }
  };

  router.get('/', route(req => service.home(req.user.id)));
  router.post('/opened', route(req => { z.object({}).strict().parse(req.body); return service.opened(req.user.id); }));
  router.post('/onboarding', route(req => service.preferences(req.user.id, req.body, true)));
  router.patch('/preferences', route(req => service.preferences(req.user.id, req.body)));
  router.post('/challenges', route(req => service.start(req.user.id, StartSchema.parse(req.body).language)));
  router.get('/challenges/:id', route(req => service.challenge(req.user.id, uuid.parse(req.params.id))));
  router.post('/challenges/:id/submit', route(req => {
    const id = uuid.parse(req.params.id);
    const value = SubmitSchema.parse(req.body);
    const choice = value.selectedOption || value.answer;
    return service.submit(req.user.id, id, choice, value.language);
  }));
  router.post('/challenges/:id/retry', route(req => service.submit(req.user.id, uuid.parse(req.params.id), undefined, StartSchema.parse(req.body).language)));
  return router;
}
