export class OpenAICompatibleProvider {
  #baseUrl;
  #apiKey;
  #model;
  #stats = { totalRequests: 0, totalErrors: 0, totalTokens: 0 };

  constructor({ baseUrl, apiKey, model, name }) {
    this.#baseUrl = baseUrl.replace(/\/$/, '');
    this.#apiKey = apiKey || null;
    this.#model = model;
    this.name = name || 'OpenAI-Compatible';
  }

  _buildRequestBody(prompt, options = {}) {
    const messages = typeof prompt === 'string'
      ? [{ role: 'user', content: prompt }]
      : prompt;
    return {
      model: this.#model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    };
  }

  async query(prompt, options = {}) {
    const body = this._buildRequestBody(prompt, options);
    const headers = { 'Content-Type': 'application/json' };
    if (this.#apiKey) headers['Authorization'] = `Bearer ${this.#apiKey}`;
    this.#stats.totalRequests++;
    const response = await fetch(`${this.#baseUrl}/chat/completions`, {
      method: 'POST', headers, body: JSON.stringify(body), signal: options.signal,
    });
    if (!response.ok) {
      this.#stats.totalErrors++;
      throw new Error(`LLM request failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (data.usage) this.#stats.totalTokens += (data.usage.total_tokens || 0);
    return { content: data.choices?.[0]?.message?.content || '', usage: data.usage || {}, model: data.model };
  }

  async listModels() {
    const headers = {};
    if (this.#apiKey) headers['Authorization'] = `Bearer ${this.#apiKey}`;
    const response = await fetch(`${this.#baseUrl}/models`, { headers });
    if (!response.ok) throw new Error(`Failed to list models: ${response.status}`);
    const data = await response.json();
    return (data.data || []).map(m => m.id);
  }

  async healthCheck() {
    try { await this.listModels(); return true; } catch { return false; }
  }

  getStats() { return { ...this.#stats }; }
}
