export const PROVIDERS = {
  ollama:     { name: 'Ollama (Local)',    baseUrl: 'http://localhost:11434/v1', requiresKey: false, supportsToolUse: false },
  lmstudio:   { name: 'LM Studio (Local)', baseUrl: 'http://localhost:1234/v1',  requiresKey: false, supportsToolUse: false },
  openai:     { name: 'OpenAI',            baseUrl: 'https://api.openai.com/v1', requiresKey: true },
  anthropic:  { name: 'Anthropic',         baseUrl: 'https://api.anthropic.com', requiresKey: true, isAnthropic: true },
  openrouter: { name: 'OpenRouter',        baseUrl: 'https://openrouter.ai/api/v1', requiresKey: true },
  together:   { name: 'Together AI',       baseUrl: 'https://api.together.xyz/v1',  requiresKey: true },
  groq:       { name: 'Groq',             baseUrl: 'https://api.groq.com/openai/v1', requiresKey: true },
  deepseek:   { name: 'DeepSeek',          baseUrl: 'https://api.deepseek.com/v1',   requiresKey: true },
  mistral:    { name: 'Mistral',           baseUrl: 'https://api.mistral.ai/v1',     requiresKey: true },
  custom:     { name: 'Custom (any URL)',  baseUrl: null, requiresKey: null },
};

export const PRICING = {
  'gpt-4o':        { input: 2.50, output: 10.00 },
  'gpt-4o-mini':   { input: 0.15, output: 0.60 },
  'claude-sonnet': { input: 3.00, output: 15.00 },
  'llama-3.1-8b':  { input: 0.00, output: 0.00 },
};

export function getProvider(name) {
  return PROVIDERS[name] || null;
}

export function listProviders() {
  return Object.entries(PROVIDERS).map(([id, info]) => ({ id, ...info }));
}
