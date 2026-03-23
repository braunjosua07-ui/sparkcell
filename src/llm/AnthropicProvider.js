export class AnthropicProvider {
  #apiKey;
  #model;
  #stats = { totalRequests: 0, totalErrors: 0, totalTokens: 0 };

  constructor({ apiKey, model }) {
    this.#apiKey = apiKey;
    this.#model = model || 'claude-sonnet-4-6';
    this.name = 'Anthropic';
  }

  async query(prompt, options = {}) {
    const messages = typeof prompt === 'string'
      ? [{ role: 'user', content: prompt }]
      : prompt;
    this.#stats.totalRequests++;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.#apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.#model, messages,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.7,
      }),
      signal: options.signal,
    });
    if (!response.ok) {
      this.#stats.totalErrors++;
      throw new Error(`Anthropic request failed: ${response.status}`);
    }
    const data = await response.json();
    if (data.usage) this.#stats.totalTokens += (data.usage.input_tokens + data.usage.output_tokens);
    return { content: data.content?.[0]?.text || '', usage: data.usage || {}, model: data.model };
  }

  async healthCheck() {
    try { await this.query('Say "ok"', { maxTokens: 5 }); return true; } catch { return false; }
  }

  getStats() { return { ...this.#stats }; }
}
