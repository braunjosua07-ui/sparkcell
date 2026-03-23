export class StartupBuilder {
  #llm;

  constructor(llmManager) {
    this.#llm = llmManager;
  }

  async buildTeam(projectDescription, options = {}) {
    if (!this.#llm) return this.#fallbackTeam(projectDescription, options);

    const prompt = `You are designing a startup team. Given this project description, suggest a team of ${options.teamSize || 3} agents.

Project: ${projectDescription}

Respond in JSON format:
{
  "agents": [
    { "id": "short-id", "name": "Display Name", "role": "role-type", "skills": ["skill1", "skill2", "skill3"] }
  ]
}

Available roles: strategic-lead, implementer, analyst, creative, marketer, financial, sales, generalist`;

    try {
      const result = await this.#llm.query(prompt, { jsonMode: true, temperature: 0.8 });
      const parsed = JSON.parse(result.content);
      if (parsed.agents && Array.isArray(parsed.agents)) return parsed.agents;
    } catch { /* fallback */ }

    return this.#fallbackTeam(projectDescription, options);
  }

  #fallbackTeam(description, options = {}) {
    const size = options.teamSize || 3;
    const teams = {
      3: [
        { id: 'ceo', name: 'CEO', role: 'strategic-lead', skills: ['strategy', 'vision', 'planning'] },
        { id: 'tech', name: 'Tech Lead', role: 'implementer', skills: ['coding', 'architecture', 'api-design'] },
        { id: 'product', name: 'Product', role: 'analyst', skills: ['research', 'analysis', 'user-stories'] },
      ],
      5: [
        { id: 'ceo', name: 'CEO', role: 'strategic-lead', skills: ['strategy', 'vision'] },
        { id: 'cto', name: 'CTO', role: 'implementer', skills: ['coding', 'architecture'] },
        { id: 'cmo', name: 'CMO', role: 'marketer', skills: ['marketing', 'content'] },
        { id: 'product', name: 'Product', role: 'analyst', skills: ['research', 'analysis'] },
        { id: 'designer', name: 'Designer', role: 'creative', skills: ['design', 'ux'] },
      ],
    };
    return teams[size] || teams[3];
  }
}
