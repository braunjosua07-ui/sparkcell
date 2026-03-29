export class OpenAICompatibleProvider {
  #baseUrl;
  #apiKey;
  #model;
  #stats = { totalRequests: 0, totalErrors: 0, totalTokens: 0 };
  #toolUseFailures = 0;
  supportsToolUse;

  constructor({ baseUrl, apiKey, model, name, supportsToolUse }) {
    this.#baseUrl = baseUrl.replace(/\/$/, '');
    this.#apiKey = apiKey || null;
    this.#model = model;
    this.name = name || 'OpenAI-Compatible';
    this.supportsToolUse = supportsToolUse !== false; // default true
  }

  /**
   * Strip tool-related content from messages so the request is valid
   * when sent without the `tools` parameter. Converts assistant tool_calls
   * into plain text and drops `tool` role messages.
   */
  static _stripToolMessages(messages) {
    return messages
      .filter(m => m.role !== 'tool') // remove tool results
      .map(m => {
        if (m.role === 'assistant' && m.tool_calls) {
          // Convert tool calls to readable text so context isn't lost
          const toolText = m.tool_calls.map(tc => {
            const name = tc.function?.name || tc.name || 'unknown';
            const args = typeof tc.function?.arguments === 'string'
              ? tc.function.arguments
              : JSON.stringify(tc.args || tc.function?.arguments || {});
            return `[Used tool: ${name}(${args.slice(0, 120)})]`;
          }).join('\n');
          const content = (m.content || '') + (toolText ? '\n' + toolText : '');
          return { role: 'assistant', content };
        }
        return m;
      });
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const signal = options.signal || controller.signal;
    let response;
    try {
      response = await fetch(`${this.#baseUrl}/chat/completions`, {
        method: 'POST', headers, body: JSON.stringify(body), signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      this.#stats.totalErrors++;
      let errorBody = '';
      try { errorBody = await response.text(); } catch {}
      console.error(`[LLM DEBUG] ${response.status} ${response.statusText} | URL: ${this.#baseUrl}/chat/completions | Model: ${this.#model} | Error body: ${errorBody}`);

      // Auto-retry without tools on 400
      if (response.status === 400 && (body.tools?.length > 0 || body.messages?.some(m => m.role === 'tool' || m.tool_calls))) {
        this.#toolUseFailures++;
        // Disable native tool use immediately — model clearly doesn't support it
        if (this.supportsToolUse) {
          console.warn(`[LLM AUTO-DISABLE] Disabling native tool use for ${this.name} (${this.#model}) — using text fallback`);
          this.supportsToolUse = false;
        }
        console.warn(`[LLM RETRY] 400 — retrying without tools & cleaning messages for model ${this.#model}`);
        const retryBody = { ...body };
        delete retryBody.tools;
        delete retryBody.tool_choice;
        retryBody.messages = OpenAICompatibleProvider._stripToolMessages(retryBody.messages);
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 60000);
        try {
          response = await fetch(`${this.#baseUrl}/chat/completions`, {
            method: 'POST', headers, body: JSON.stringify(retryBody),
            signal: retryController.signal,
          });
        } finally {
          clearTimeout(retryTimeout);
        }
        if (!response.ok) {
          let retryError = '';
          try { retryError = await response.text(); } catch {}
          throw new Error(`LLM request failed (retry without tools): ${response.status} ${response.statusText} — ${retryError.slice(0, 300)}`);
        }
      } else {
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const error = new Error('Rate limit exceeded');
          error.name = 'RateLimitError';
          error.retryAfter = retryAfter ? parseInt(retryAfter) : 60;
          throw error;
        }
        if (response.status === 401) {
          throw Object.assign(new Error('Authentication failed'), { name: 'AuthenticationError' });
        }
        throw new Error(`LLM request failed: ${response.status} ${response.statusText} — ${errorBody.slice(0, 300)}`);
      }
    } else {
      // Don't reset tool failure counter — once disabled, stay disabled
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
        ? (() => {
            try {
              return JSON.parse(tc.function.arguments);
            } catch (e) {
              console.warn('Failed to parse tool args:', e.message);
              return { _parseError: true, raw: tc.function.arguments };
            }
          })()
        : tc.function?.arguments || {},
    }));
    return { content, toolCalls, usage: data.usage || {}, model: data.model };
  }

  async *queryStream(prompt, options = {}) {
    const body = this._buildRequestBody(prompt, options);
    body.stream = true;
    const headers = { 'Content-Type': 'application/json' };
    if (this.#apiKey) headers['Authorization'] = `Bearer ${this.#apiKey}`;
    this.#stats.totalRequests++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const signal = options.signal || controller.signal;
    let response;
    try {
      response = await fetch(`${this.#baseUrl}/chat/completions`, {
        method: 'POST', headers, body: JSON.stringify(body), signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      this.#stats.totalErrors++;
      let errorBody = '';
      try { errorBody = await response.text(); } catch {}
      console.error(`[LLM DEBUG] ${response.status} ${response.statusText} | URL: ${this.#baseUrl}/chat/completions | Model: ${this.#model} | Error body: ${errorBody}`);

      // Auto-retry without tools on 400 — many local models (glm, qwen, etc.)
      // fail intermittently when tools are included in the request body.
      if (response.status === 400 && (body.tools?.length > 0 || body.messages?.some(m => m.role === 'tool' || m.tool_calls))) {
        this.#toolUseFailures = (this.#toolUseFailures || 0) + 1;
        // Disable native tool use immediately — model clearly doesn't support it
        if (this.supportsToolUse) {
          console.warn(`[LLM AUTO-DISABLE] Disabling native tool use for ${this.name} (${this.#model}) — using text fallback`);
          this.supportsToolUse = false;
        }
        console.warn(`[LLM RETRY] 400 — retrying without tools & cleaning messages for model ${this.#model}`);
        const retryBody = { ...body };
        delete retryBody.tools;
        delete retryBody.tool_choice;
        // Clean tool-related messages from conversation history
        retryBody.messages = OpenAICompatibleProvider._stripToolMessages(retryBody.messages);
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 60000);
        try {
          response = await fetch(`${this.#baseUrl}/chat/completions`, {
            method: 'POST', headers, body: JSON.stringify(retryBody),
            signal: retryController.signal,
          });
        } finally {
          clearTimeout(retryTimeout);
        }
        if (!response.ok) {
          let retryError = '';
          try { retryError = await response.text(); } catch {}
          throw new Error(`LLM stream failed (retry without tools): ${response.status} ${response.statusText} — ${retryError.slice(0, 300)}`);
        }
        // Retry succeeded — continue with response (no tool calls will be returned)
      } else {
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const error = new Error('Rate limit exceeded');
          error.name = 'RateLimitError';
          error.retryAfter = retryAfter ? parseInt(retryAfter) : 60;
          throw error;
        }
        if (response.status === 401) {
          throw Object.assign(new Error('Authentication failed'), { name: 'AuthenticationError' });
        }
        throw new Error(`LLM stream failed: ${response.status} ${response.statusText} — ${errorBody.slice(0, 300)}`);
      }
    } else {
      // Success with tools — reset failure counter
      // Don't reset tool failure counter — once disabled, stay disabled
    }

    let fullContent = '';
    let fullReasoning = '';
    const toolCalls = [];
    for await (const chunk of this.#parseSSE(response.body)) {
      if (chunk === '[DONE]') break;
      const data = JSON.parse(chunk);
      const delta = data.choices?.[0]?.delta;
      if (!delta) continue;
      // Handle both content and reasoning (for thinking models like glm-5)
      if (delta.content) {
        fullContent += delta.content;
        yield { type: 'token', text: delta.content };
      }
      if (delta.reasoning) {
        fullReasoning += delta.reasoning;
        // Optionally yield reasoning tokens for visibility
        yield { type: 'token', text: delta.reasoning };
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: '', name: '', args: '' };
          if (tc.id) toolCalls[tc.index].id = tc.id;
          if (tc.function?.name) toolCalls[tc.index].name = tc.function.name;
          if (tc.function?.arguments) toolCalls[tc.index].args += tc.function.arguments;
        }
      }
      if (data.usage) this.#stats.totalTokens += (data.usage.total_tokens || 0);
    }
    // Use reasoning as fallback if content is empty (thinking models)
    if (!fullContent && fullReasoning) fullContent = fullReasoning;
    const parsed = toolCalls.map(tc => ({
      id: tc.id, name: tc.name,
      args: (() => {
        try {
          return tc.args ? JSON.parse(tc.args) : {};
        } catch (e) {
          console.warn('Failed to parse tool args:', e.message);
          return { _parseError: true, raw: tc.args };
        }
      })(),
    }));
    yield { type: 'done', content: fullContent, toolCalls: parsed };
  }

  async *#parseSSE(body) {
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith('data: ')) yield line.slice(6);
      }
    }
    if (buffer.startsWith('data: ')) yield buffer.slice(6);
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
