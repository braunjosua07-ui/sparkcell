export class ModelDetector {
  static KNOWN_PORTS = [
    { port: 11434, name: 'ollama', modelsEndpoint: '/v1/models', fallback: '/api/tags' },
    { port: 1234,  name: 'lmstudio', modelsEndpoint: '/v1/models' },
    { port: 8080,  name: 'vllm', modelsEndpoint: '/v1/models' },
  ];

  async detect() {
    const results = [];
    for (const server of ModelDetector.KNOWN_PORTS) {
      try {
        const response = await fetch(`http://localhost:${server.port}${server.modelsEndpoint}`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          const data = await response.json();
          const models = (data.data || data.models || []).map(m => m.id || m.name);
          results.push({ name: server.name, port: server.port, models });
        }
      } catch {
        if (server.fallback) {
          try {
            const r = await fetch(`http://localhost:${server.port}${server.fallback}`, {
              signal: AbortSignal.timeout(2000),
            });
            if (r.ok) {
              const data = await r.json();
              const models = (data.models || []).map(m => m.name);
              results.push({ name: server.name, port: server.port, models });
            }
          } catch { /* not available */ }
        }
      }
    }
    return results;
  }
}
