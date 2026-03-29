export default class WebFetchTool {
  name = 'webFetch';
  description = 'Fetch a URL and extract content. Returns cleaned text or JSON. Supports GET/POST with optional headers and body.';
  parameters = {
    url: { type: 'string', required: true, description: 'URL to fetch' },
    method: { type: 'string', required: false, description: 'HTTP method (GET, POST, etc.)', default: 'GET' },
    headers: { type: 'object', required: false, description: 'Request headers as key-value pairs' },
    body: { type: 'string', required: false, description: 'Request body (for POST/PUT)' },
    selector: { type: 'string', required: false, description: 'CSS selector to extract specific content (requires text/html response)' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const { url, method = 'GET', headers = {}, body, selector } = args;

    // Validate URL
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { success: false, output: null, error: 'Invalid URL' };
    }

    // Block dangerous protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { success: false, output: null, error: 'Only HTTP/HTTPS URLs allowed' };
    }

    // Block internal IPs
    const blockedRanges = [
      /^127\./,
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^169\.254\./,  // AWS metadata
      /^0\.0\.0\.0$/,
      /^localhost$/i,
    ];
    if (blockedRanges.some(r => r.test(parsed.hostname))) {
      return { success: false, output: null, error: 'Access to internal networks not allowed' };
    }

    try {
      const fetchOpts = {
        method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          ...headers,
        },
        signal: AbortSignal.timeout(30000),
        redirect: 'follow',
      };
      if (body && method !== 'GET') {
        fetchOpts.body = body;
      }

      const response = await fetch(url, fetchOpts);

      if (!response.ok) {
        return {
          success: false,
          output: null,
          error: `HTTP ${response.status} ${response.statusText}`,
        };
      }

      const contentType = response.headers.get('content-type') || '';

      // JSON response
      if (contentType.includes('application/json')) {
        const json = await response.json();
        let output = JSON.stringify(json, null, 2);
        if (output.length > 4000) {
          output = output.slice(0, 4000) + '\n[...truncated]';
        }
        return { success: true, output };
      }

      // HTML response
      const text = await response.text();

      if (contentType.includes('text/html')) {
        let cleaned = extractTextFromHTML(text, selector);
        if (cleaned.length > 4000) {
          cleaned = cleaned.slice(0, 4000) + `\n[...truncated, ${cleaned.length - 4000} chars omitted]`;
        }
        return { success: true, output: cleaned };
      }

      // Plain text or other
      let output = text;
      if (output.length > 4000) {
        output = output.slice(0, 4000) + `\n[...truncated, ${output.length - 4000} chars omitted]`;
      }
      return { success: true, output };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }
}

/**
 * Basic HTML to text extraction without external dependencies.
 * Strips tags, decodes entities, collapses whitespace.
 */
function extractTextFromHTML(html, selector) {
  // If selector provided, try to extract that section
  if (selector) {
    // Simple ID/class extraction for common cases
    const idMatch = selector.match(/^#([\w-]+)$/);
    if (idMatch) {
      const regex = new RegExp(`<[^>]+id=["']${idMatch[1]}["'][^>]*>([\\s\\S]*?)<\\/`, 'i');
      const match = html.match(regex);
      if (match) html = match[1];
    }
    const classMatch = selector.match(/^\.([\w-]+)$/);
    if (classMatch) {
      const regex = new RegExp(`<[^>]+class=["'][^"']*${classMatch[1]}[^"']*["'][^>]*>([\\s\\S]*?)<\\/`, 'i');
      const match = html.match(regex);
      if (match) html = match[1];
    }
  }

  // Remove script and style blocks
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');

  // Convert common block elements to newlines
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<(hr)\s*\/?>/gi, '\n---\n');

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

  // Collapse whitespace
  text = text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 0)
    .join('\n');

  return text;
}

export { extractTextFromHTML };
