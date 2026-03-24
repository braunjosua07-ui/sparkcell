export class AnthropicProvider {
  #apiKey;
  #model;
  #stats = { totalRequests: 0, totalErrors: 0, totalTokens: 0 };

  constructor({ apiKey, model }) {
    this.#apiKey = apiKey;
    this.#model = model || 'claude-sonnet-4-6';
    this.name = 'Anthropic';
    this.supportsToolUse = true;
  }

  async query(prompt, options = {}) {
    const messages = typeof prompt === 'string'
      ? [{ role: 'user', content: prompt }]
      : prompt;
    this.#stats.totalRequests++;
    // Separate system message from conversation messages for Anthropic format
    let system;
    const apiMessages = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content;
      } else {
        apiMessages.push(msg);
      }
    }
    const requestBody = {
      model: this.#model,
      messages: apiMessages.length > 0 ? apiMessages : messages,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
    };
    if (system) requestBody.system = system;
    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools;
    }
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.#apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
      signal: options.signal,
    });
    if (!response.ok) {
      this.#stats.totalErrors++;
      throw new Error(`Anthropic request failed: ${response.status}`);
    }
    const data = await response.json();
    if (data.usage) this.#stats.totalTokens += (data.usage.input_tokens + data.usage.output_tokens);
    // Parse content blocks: text and tool_use
    let content = '';
    const toolCalls = [];
    for (const block of (data.content || [])) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({ id: block.id, name: block.name, args: block.input || {} });
      }
    }
    return { content, toolCalls, usage: data.usage || {}, model: data.model };
  }

  async healthCheck() {
    try { await this.query('Say "ok"', { maxTokens: 5 }); return true; } catch { return false; }
  }

  getStats() { return { ...this.#stats }; }
}
