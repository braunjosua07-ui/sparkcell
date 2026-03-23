import { ModelDetector } from '../llm/ModelDetector.js';
import { listProviders } from '../llm/ProviderRegistry.js';

export class FirstTimeSetup {
  #detector;

  constructor() {
    this.#detector = new ModelDetector();
  }

  async detectLocalServers() {
    return await this.#detector.detect();
  }

  getProviderList() {
    return listProviders().filter(p => p.id !== 'custom');
  }

  async testConnection(providerConfig) {
    // Creates a temporary provider and tests connectivity
    const { OpenAICompatibleProvider } = await import('../llm/OpenAICompatibleProvider.js');
    const provider = new OpenAICompatibleProvider({
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
      model: providerConfig.model || 'test',
      name: 'test',
    });
    return await provider.healthCheck();
  }

  buildConfig(providerChoice) {
    return {
      version: 1,
      llm: {
        primary: {
          provider: providerChoice.provider,
          model: providerChoice.model,
          baseUrl: providerChoice.baseUrl,
          apiKey: providerChoice.apiKey || undefined,
        },
      },
      budget: { dailyLimit: 10.00, onExhaustion: 'fallback-then-pause' },
    };
  }
}
