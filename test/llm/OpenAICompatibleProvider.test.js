import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAICompatibleProvider } from '../../src/llm/OpenAICompatibleProvider.js';

describe('OpenAICompatibleProvider', () => {
  it('constructs with required params', () => {
    const p = new OpenAICompatibleProvider({
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.1:8b',
      name: 'Ollama',
    });
    assert.equal(p.name, 'Ollama');
  });

  it('formats chat completion request correctly', () => {
    const p = new OpenAICompatibleProvider({
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.1:8b',
      name: 'test',
    });
    const body = p._buildRequestBody('Hello, world', { temperature: 0.7 });
    assert.equal(body.model, 'llama3.1:8b');
    assert.ok(body.messages.some(m => m.role === 'user'));
    assert.equal(body.temperature, 0.7);
  });

  it('tracks usage stats', () => {
    const p = new OpenAICompatibleProvider({
      baseUrl: 'http://localhost:11434/v1',
      model: 'test',
      name: 'test',
    });
    const stats = p.getStats();
    assert.equal(stats.totalRequests, 0);
    assert.equal(stats.totalErrors, 0);
  });
});
