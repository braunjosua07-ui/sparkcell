import { StartupBuilder } from './StartupBuilder.js';
import { StartupConfig } from '../config/StartupConfig.js';
import paths from '../utils/paths.js';

export class StartupWizard {
  #llm;
  #builder;

  constructor(llmManager) {
    this.#llm = llmManager;
    this.#builder = new StartupBuilder(llmManager);
  }

  async createStartup({ name, description, teamSize = 3, autonomyLevel = 'balanced' }) {
    // Generate team
    const agents = await this.#builder.buildTeam(description, { teamSize });

    // Mark all agents as active
    const activeAgents = agents.map(a => ({ ...a, active: true }));

    // Create startup config
    const startupDir = paths.startup(name.toLowerCase().replace(/\s+/g, '-'));
    const config = new StartupConfig(startupDir);
    const data = await config.create({
      name,
      description,
      agents: activeAgents,
      autonomyLevel,
    });

    return { startupDir, config: data, agents: activeAgents };
  }
}
