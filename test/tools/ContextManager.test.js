import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ContextManager } from '../../src/tools/ContextManager.js';

describe('ContextManager — estimateTokens', () => {
  const cm = new ContextManager({ maxTokens: 1000 });

  it('estimates tokens from string content', () => {
    const messages = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello world' },
    ];
    const tokens = cm.estimateTokens(messages);
    // "system" + "You are helpful." + "user" + "Hello world" = 6+16+4+11 = 37 chars, /4 = ~10
    assert.ok(tokens > 0);
    assert.ok(tokens < 20);
  });

  it('handles array content (Anthropic format)', () => {
    const messages = [
      { role: 'user', content: [{ text: 'Hello' }, { text: 'World' }] },
    ];
    const tokens = cm.estimateTokens(messages);
    assert.ok(tokens > 0);
  });

  it('returns 0 for empty messages', () => {
    assert.equal(cm.estimateTokens([]), 0);
  });
});

describe('ContextManager — shouldSummarize', () => {
  it('returns false when under budget', () => {
    const cm = new ContextManager({ maxTokens: 10000 });
    const messages = [{ role: 'user', content: 'short' }];
    assert.equal(cm.shouldSummarize(messages), false);
  });

  it('returns true when over budget', () => {
    const cm = new ContextManager({ maxTokens: 100 }); // 100 tokens = ~400 chars
    const longContent = 'x'.repeat(500); // ~125 tokens > 80% of 100
    const messages = [{ role: 'user', content: longContent }];
    assert.equal(cm.shouldSummarize(messages), true);
  });

  it('respects custom budgetRatio', () => {
    const cm = new ContextManager({ maxTokens: 100, budgetRatio: 0.5 });
    const content = 'x'.repeat(250); // ~63 tokens > 50% of 100
    const messages = [{ role: 'user', content: content }];
    assert.equal(cm.shouldSummarize(messages), true);
  });
});

describe('ContextManager — truncateToolResult', () => {
  const cm = new ContextManager();

  it('returns short results unchanged', () => {
    assert.equal(cm.truncateToolResult('hello', 4000), 'hello');
  });

  it('truncates long results', () => {
    const long = 'x'.repeat(5000);
    const result = cm.truncateToolResult(long, 4000);
    assert.ok(result.includes('[...truncated'));
    assert.ok(result.includes('1000 chars omitted'));
  });

  it('handles objects by JSON stringifying', () => {
    const obj = { data: 'x'.repeat(5000) };
    const result = cm.truncateToolResult(obj, 4000);
    assert.ok(result.includes('[...truncated'));
  });

  it('respects custom maxChars', () => {
    const result = cm.truncateToolResult('x'.repeat(100), 50);
    assert.ok(result.includes('[...truncated'));
    assert.ok(result.includes('50 chars omitted'));
  });
});

describe('ContextManager — summarize', () => {
  it('calls llm to summarize old messages', async () => {
    const cm = new ContextManager({ maxTokens: 1000 });
    let queryCalled = false;
    const fakeLLM = {
      query: async () => {
        queryCalled = true;
        return { content: 'Summary: user asked about files, tool returned list.' };
      },
    };

    const messages = [
      { role: 'system', content: 'You are an agent.' },
      { role: 'user', content: 'List files' },
      { role: 'assistant', content: 'Using glob tool...' },
      { role: 'tool', content: 'file1.js\nfile2.js' },
      { role: 'assistant', content: 'Found 2 files.' },
      { role: 'user', content: 'Read file1.js' },
      { role: 'tool', content: 'const x = 1;' },
      { role: 'assistant', content: 'Here is the content.' },
    ];

    const result = await cm.summarize(messages, fakeLLM);
    assert.ok(queryCalled);
    // System message preserved
    assert.equal(result[0].role, 'system');
    assert.equal(result[0].content, 'You are an agent.');
    // Summary message added
    assert.ok(result[1].content.includes('[Context Summary]'));
    // Last 4 messages preserved
    assert.ok(result.length <= 6); // system + summary + last 4
  });

  it('returns messages unchanged when nothing to summarize', async () => {
    const cm = new ContextManager();
    const messages = [
      { role: 'system', content: 'System' },
      { role: 'user', content: 'Hello' },
    ];
    const result = await cm.summarize(messages, null);
    // Only 1 non-system message, nothing to summarize
    assert.equal(result.length, 2);
  });
});
