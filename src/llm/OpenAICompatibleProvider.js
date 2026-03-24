export class OpenAICompatibleProvider {
  #baseUrl;
  #apiKey;
  #model;
  #stats = { totalRequests: 0, totalErrors: 0, totalTokens: 0 };
  supportsToolUse;

  constructor({ baseUrl, apiKey, model, name, supportsToolUse }) {
    this.#baseUrl = baseUrl.replace(/\/$/, '');
    this.#apiKey = apiKey || null;
    this.#model = model;
    this.name = name || 'OpenAI-Compatible';
    this.supportsToolUse = supportsToolUse !== false; // default true
  }

  _buildRequestBody(prompt, options = {}) {
    const messages = typeof prompt === 'string'
      ? [{ role: 'user', content: prompt }]
      : prompt;
    const body = {
      model: this.#model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    };
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }
    return body;
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
    const message = data.choices?.[0]?.message || {};
    // Some models (thinking/reasoning models like glm, qwen3) put output in
    // "reasoning" instead of "content". Fall back to reasoning if content is empty.
    const content = message.content || message.reasoning || '';
    // Extract tool calls if present
    const toolCalls = (message.tool_calls || []).map(tc => ({
      id: tc.id,
      name: tc.function?.name,
      args: typeof tc.function?.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function?.arguments || {},
    }));
    return { content, toolCalls, usage: data.usage || {}, model: data.model };
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
