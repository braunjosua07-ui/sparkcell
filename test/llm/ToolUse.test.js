import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAICompatibleProvider } from '../../src/llm/OpenAICompatibleProvider.js';
import { AnthropicProvider } from '../../src/llm/AnthropicProvider.js';
import { injectToolsAsText, parseToolCallsFromText } from '../../src/llm/ToolUseFallback.js';

describe('OpenAICompatibleProvider — Tool-Use', () => {
  it('includes tools in request body when provided', () => {
    const p = new OpenAICompatibleProvider({
      baseUrl: 'http://localhost:11434/v1', model: 'test', name: 'test',
    });
    const tools = [{ type: 'function', function: { name: 'readFile', description: 'Read', parameters: {} } }];
    const body = p._buildRequestBody('Hello', { tools });
    assert.ok(body.tools);
    assert.equal(body.tools.length, 1);
  });

  it('does not include tools when not provided', () => {
    const p = new OpenAICompatibleProvider({
      baseUrl: 'http://localhost:11434/v1', model: 'test', name: 'test',
    });
    const body = p._buildRequestBody('Hello', {});
    assert.equal(body.tools, undefined);
  });

  it('has supportsToolUse=true by default', () => {
    const p = new OpenAICompatibleProvider({
      baseUrl: 'http://localhost:11434/v1', model: 'test', name: 'test',
    });
    assert.equal(p.supportsToolUse, true);
  });

  it('supportsToolUse can be disabled', () => {
    const p = new OpenAICompatibleProvider({
      baseUrl: 'http://localhost:11434/v1', model: 'test', name: 'test',
      supportsToolUse: false,
    });
    assert.equal(p.supportsToolUse, false);
  });
});

describe('AnthropicProvider — Tool-Use', () => {
  it('has supportsToolUse=true', () => {
    const p = new AnthropicProvider({ apiKey: 'test-key' });
    assert.equal(p.supportsToolUse, true);
  });
});

describe('ToolUseFallback — injectToolsAsText', () => {
  it('injects tool descriptions into system message', () => {
    const messages = [
      { role: 'system', content: 'You are an agent.' },
      { role: 'user', content: 'List files' },
    ];
    const tools = [
      { type: 'function', function: { name: 'glob', description: 'Find files', parameters: { properties: { pattern: { type: 'string' } } } } },
    ];
    const result = injectToolsAsText(messages, tools);
    assert.ok(result[0].content.includes('glob'));
    assert.ok(result[0].content.includes('[TOOL:'));
  });

  it('creates system message if none exists', () => {
    const messages = [{ role: 'user', content: 'Hello' }];
    const tools = [{ name: 'test', description: 'Test tool', parameters: {} }];
    const result = injectToolsAsText(messages, tools);
    assert.equal(result[0].role, 'system');
    assert.ok(result[0].content.includes('test'));
  });

  it('returns unchanged if no tools', () => {
    const messages = [{ role: 'user', content: 'Hello' }];
    const result = injectToolsAsText(messages, []);
    assert.deepEqual(result, messages);
  });
});

describe('ToolUseFallback — parseToolCallsFromText', () => {
  it('parses tool calls from text', () => {
    const content = 'Let me read the file.\n[TOOL: readFile({"path": "/tmp/test.js"})]\nDone.';
    const { cleanContent, toolCalls } = parseToolCallsFromText(content);
    assert.equal(toolCalls.length, 1);
    assert.equal(toolCalls[0].name, 'readFile');
    assert.equal(toolCalls[0].args.path, '/tmp/test.js');
    assert.ok(!cleanContent.includes('[TOOL:'));
    assert.ok(cleanContent.includes('Let me read'));
  });

  it('parses multiple tool calls', () => {
    const content = '[TOOL: readFile({"path": "a.js"})]\n[TOOL: readFile({"path": "b.js"})]';
    const { toolCalls } = parseToolCallsFromText(content);
    assert.equal(toolCalls.length, 2);
  });

  it('returns empty array for no tool calls', () => {
    const { cleanContent, toolCalls } = parseToolCallsFromText('Just text');
    assert.equal(toolCalls.length, 0);
    assert.equal(cleanContent, 'Just text');
  });

  it('generates unique ids', () => {
    const content = '[TOOL: a({"x": 1})]\n[TOOL: b({"y": 2})]';
    const { toolCalls } = parseToolCallsFromText(content);
    assert.notEqual(toolCalls[0].id, toolCalls[1].id);
  });

  it('skips malformed JSON', () => {
    const content = '[TOOL: bad({not json})]';
    const { toolCalls } = parseToolCallsFromText(content);
    assert.equal(toolCalls.length, 0);
  });
});
