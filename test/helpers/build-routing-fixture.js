import { beforeEach } from 'node:test';
import { getGeminiClient } from '../../src/services/ai/client.js';
import { getBuildOpenAIClient } from '../../src/services/ai/build-openai-client.js';

// Legacy storage/concurrency tests still exercise the real Build services.
// Supply the new first-stage decision; these fixtures route narrow edits direct.
export function installBuildRoutingFixture() {
  beforeEach(t => {
    const previous = process.env.OPENAI_API_KEY;
    const previousGemini = process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY ||= 'test-build-router-key';
    process.env.GEMINI_API_KEY ||= 'test-build-workhorse-key';
    const client = getBuildOpenAIClient();
    t.mock.method(client.responses, 'create', async params => {
      if (params.model !== 'gpt-6-luna') throw new Error('Unexpected strategist call in narrow-edit fixture');
      return { status: 'completed', output_text: JSON.stringify({ complexity: 'small', reasoning: 'low', googleSearch: false, solWebSearch: false, profileFields: [] }) };
    });
    if (process.env.GEMINI_API_KEY) {
      const gemini = getGeminiClient();
      t.mock.method(gemini.models, 'generateContentStream', async params => (async function* () {
        yield await gemini.models.generateContent(params);
      })());
    }
    t.after(() => {
      if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous;
      if (previousGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousGemini;
    });
  });
}
