export class ContextManager {
  #maxTokens;
  #budgetRatio;

  constructor(options = {}) {
    this.#maxTokens = options.maxTokens || 128000;
    this.#budgetRatio = options.budgetRatio || 0.8;
  }

  estimateTokens(messages) {
    let totalChars = 0;
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length;
      } else if (Array.isArray(msg.content)) {
        // Anthropic format: array of content blocks
        for (const block of msg.content) {
          if (block.text) totalChars += block.text.length;
          if (block.content) totalChars += (typeof block.content === 'string' ? block.content.length : JSON.stringify(block.content).length);
        }
      }
      if (msg.role) totalChars += msg.role.length;
    }
    return Math.ceil(totalChars / 4);
  }

  shouldSummarize(messages) {
    const tokens = this.estimateTokens(messages);
    return tokens > this.#maxTokens * this.#budgetRatio;
  }

  async summarize(messages, llm) {
    // Find the split point: keep system messages, last 3 tool results, and current call
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    // Keep the last 4 non-system messages (current + last 3)
    const keepCount = Math.min(4, nonSystemMessages.length);
    const toSummarize = nonSystemMessages.slice(0, nonSystemMessages.length - keepCount);
    const toKeep = nonSystemMessages.slice(nonSystemMessages.length - keepCount);

    if (toSummarize.length === 0) return messages;

    // Build summary prompt
    const summaryContent = toSummarize.map(m => {
      const role = m.role || 'unknown';
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return `[${role}]: ${content.slice(0, 500)}`;
    }).join('\n');

    const summaryResult = await llm.query([
      { role: 'system', content: 'Summarize these tool interactions concisely. Focus on key results, decisions, and current state. Be brief.' },
      { role: 'user', content: summaryContent },
    ], { maxTokens: 1024, temperature: 0.3 });

    const summaryMessage = {
      role: 'system',
      content: `[Context Summary]\n${summaryResult.content}`,
    };

    return [...systemMessages, summaryMessage, ...toKeep];
  }

  truncateToolResult(result, maxChars = 4000) {
    if (typeof result !== 'string') {
      result = JSON.stringify(result);
    }
    if (result.length <= maxChars) return result;
    const omitted = result.length - maxChars;
    return result.slice(0, maxChars) + `\n[...truncated, ${omitted} chars omitted]`;
  }
}
