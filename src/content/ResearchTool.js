// src/content/ResearchTool.js
export class ResearchTool {
  #tavilyKey;
  #braveKey;

  constructor(config = {}) {
    this.#tavilyKey = config.tavilyApiKey || null;
    this.#braveKey = config.braveApiKey || null;
  }

  async search(query, options = {}) {
    if (this.#tavilyKey) {
      try {
        return await this.#tavilySearch(query, options);
      } catch {
        // fall through to brave
      }
    }

    if (this.#braveKey) {
      try {
        return await this.#braveSearch(query, options);
      } catch {
        // fall through to empty
      }
    }

    return { results: [] };
  }

  async #tavilySearch(query, options) {
    const body = {
      api_key: this.#tavilyKey,
      query,
      search_depth: options.depth || 'basic',
      max_results: options.maxResults || 5,
      include_answer: options.includeAnswer ?? false,
    };

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Tavily API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const results = (data.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.content || r.snippet || '',
    }));

    return { results };
  }

  async #braveSearch(query, options) {
    const params = new URLSearchParams({
      q: query,
      count: String(options.maxResults || 5),
    });

    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': this.#braveKey,
      },
    });

    if (!res.ok) {
      throw new Error(`Brave Search API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const webResults = data.web?.results || [];
    const results = webResults.map(r => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.description || '',
    }));

    return { results };
  }
}
