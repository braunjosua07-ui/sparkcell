/**
 * WebSearchTool — searches via DuckDuckGo HTML (no API key required).
 * Returns a list of results with title, URL, and snippet.
 */
export default class WebSearchTool {
  name = 'webSearch';
  description = 'Search the web via DuckDuckGo and get a list of relevant results (title, URL, snippet). Use this before webFetch to find the right URLs.';
  parameters = {
    query: { type: 'string', required: true, description: 'Search query, e.g. "RTX 4060 price Germany" or "Node.js stream API"' },
    maxResults: { type: 'number', required: false, description: 'Max number of results to return (default: 5, max: 10)', default: 5 },
  };
  permissionLevel = 'auto';

  async execute(args) {
    const { query, maxResults = 5 } = args;

    if (!query || query.trim().length === 0) {
      return { success: false, output: null, error: 'Query cannot be empty' };
    }

    const limit = Math.min(10, Math.max(1, Number(maxResults) || 5));

    try {
      // DuckDuckGo HTML search — works without API key
      const encoded = encodeURIComponent(query.trim());
      const url = `https://html.duckduckgo.com/html/?q=${encoded}&kl=de-de`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.7',
          'Referer': 'https://duckduckgo.com/',
        },
        signal: AbortSignal.timeout(15000),
        redirect: 'follow',
      });

      if (!response.ok) {
        return {
          success: false,
          output: null,
          error: `Search failed: HTTP ${response.status}`,
        };
      }

      const html = await response.text();
      const results = parseDDGResults(html, limit);

      if (results.length === 0) {
        return {
          success: true,
          output: `Keine Ergebnisse für: "${query}"`,
        };
      }

      const formatted = results.map((r, i) =>
        `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`
      ).join('\n\n');

      return {
        success: true,
        output: `Suchergebnisse für "${query}":\n\n${formatted}`,
        results,
      };

    } catch (err) {
      return { success: false, output: null, error: `Search error: ${err.message}` };
    }
  }
}

/**
 * Parse DuckDuckGo HTML results without cheerio/DOM library.
 */
function parseDDGResults(html, limit) {
  const results = [];

  // DuckDuckGo result blocks are in <div class="result__body"> or similar
  // Match result links and snippets via regex
  const resultBlockRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  const links = [];
  let match;
  while ((match = resultBlockRegex.exec(html)) !== null && links.length < limit * 2) {
    const rawUrl = match[1];
    const rawTitle = match[2];

    // Skip non-http links and DDG internal
    if (!rawUrl.startsWith('http') && !rawUrl.startsWith('//')) continue;
    if (rawUrl.includes('duckduckgo.com')) continue;

    const url = rawUrl.startsWith('//') ? 'https:' + rawUrl : rawUrl;
    const title = stripTags(rawTitle).trim();
    if (title.length > 3) {
      links.push({ url, title });
    }
  }

  const snippets = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(stripTags(match[1]).trim());
  }

  for (let i = 0; i < Math.min(links.length, limit); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
    });
  }

  return results;
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
