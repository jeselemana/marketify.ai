export function providerUsage(value) {
  const source = value?.response || value;
  const gemini = source?.usageMetadata;
  const usage = gemini || source?.usage;
  if (!usage) return null;
  const inputTokens = gemini ? usage.promptTokenCount : usage.input_tokens ?? usage.prompt_tokens;
  const outputTokens = gemini ? (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0) : usage.output_tokens ?? usage.completion_tokens;
  if (![inputTokens, outputTokens].every(number => Number.isSafeInteger(number) && number >= 0)) return null;
  return { inputTokens, outputTokens, searchCalls: (source.output || []).filter(item => item.type === 'web_search_call' && item.status === 'completed').length };
}
