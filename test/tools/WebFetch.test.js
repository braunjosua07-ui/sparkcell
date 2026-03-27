import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import WebFetchTool, { extractTextFromHTML } from '../../src/tools/core/WebFetchTool.js';

describe('WebFetchTool — Interface', () => {
  it('has correct interface', () => {
    const tool = new WebFetchTool();
    assert.equal(tool.name, 'webFetch');
    assert.equal(tool.permissionLevel, 'auto');
    assert.ok(tool.parameters.url);
    assert.ok(tool.parameters.method);
    assert.ok(tool.parameters.selector);
  });
});

describe('extractTextFromHTML', () => {
  it('strips script and style tags', () => {
    const html = '<html><script>alert("xss")</script><style>body{color:red}</style><p>Hello World</p></html>';
    const text = extractTextFromHTML(html);
    assert.ok(!text.includes('alert'));
    assert.ok(!text.includes('color:red'));
    assert.ok(text.includes('Hello World'));
  });

  it('converts br and block elements to newlines', () => {
    const html = '<p>Line 1</p><p>Line 2</p><br>Line 3';
    const text = extractTextFromHTML(html);
    assert.ok(text.includes('Line 1'));
    assert.ok(text.includes('Line 2'));
    assert.ok(text.includes('Line 3'));
  });

  it('decodes HTML entities', () => {
    const html = '<p>&amp; &lt; &gt; &quot; &#39; &nbsp;</p>';
    const text = extractTextFromHTML(html);
    assert.ok(text.includes('&'));
    assert.ok(text.includes('<'));
    assert.ok(text.includes('>'));
    assert.ok(text.includes('"'));
    assert.ok(text.includes("'"));
  });

  it('strips nav and footer', () => {
    const html = '<nav>Navigation</nav><main>Content</main><footer>Footer</footer>';
    const text = extractTextFromHTML(html);
    assert.ok(!text.includes('Navigation'));
    assert.ok(!text.includes('Footer'));
    assert.ok(text.includes('Content'));
  });

  it('collapses whitespace', () => {
    const html = '<p>   too   many    spaces   </p>';
    const text = extractTextFromHTML(html);
    assert.ok(!text.includes('   '));
    assert.ok(text.includes('too many spaces'));
  });

  it('extracts by ID selector', () => {
    const html = '<div id="main">Target content</div><div id="sidebar">Side</div>';
    const text = extractTextFromHTML(html, '#main');
    assert.ok(text.includes('Target content'));
  });

  it('extracts by class selector', () => {
    const html = '<div class="article-body">Article text here</div><div class="ads">Ads</div>';
    const text = extractTextFromHTML(html, '.article-body');
    assert.ok(text.includes('Article text here'));
  });

  it('handles empty input', () => {
    const text = extractTextFromHTML('');
    assert.equal(text, '');
  });

  it('handles plain text without tags', () => {
    const text = extractTextFromHTML('Just plain text');
    assert.equal(text, 'Just plain text');
  });
});

describe('WebFetchTool — Execution', () => {
  it('returns error for invalid URL', async () => {
    const tool = new WebFetchTool();
    const result = await tool.execute({ url: 'not-a-url' }, {});
    assert.equal(result.success, false);
  });

  it('handles fetch timeout gracefully', async () => {
    const tool = new WebFetchTool();
    // Use a URL that will likely timeout or fail fast
    const result = await tool.execute({ url: 'http://192.0.2.1:1' }, {});
    assert.equal(result.success, false);
    assert.ok(result.error);
  });
});
