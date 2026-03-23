export const ROLES = {
  'strategic-lead': { name: 'CEO', defaultSkills: ['strategy', 'vision', 'planning', 'leadership'] },
  'implementer': { name: 'Tech Lead', defaultSkills: ['coding', 'architecture', 'debugging', 'api-design'] },
  'analyst': { name: 'Analyst', defaultSkills: ['research', 'analysis', 'data', 'user-stories'] },
  'creative': { name: 'Designer', defaultSkills: ['design', 'ux', 'branding', 'prototyping'] },
  'marketer': { name: 'Marketing', defaultSkills: ['marketing', 'content', 'social-media', 'seo'] },
  'financial': { name: 'CFO', defaultSkills: ['finance', 'budgeting', 'forecasting', 'metrics'] },
  'sales': { name: 'Sales', defaultSkills: ['sales', 'negotiation', 'networking', 'pitching'] },
  'generalist': { name: 'Generalist', defaultSkills: ['research', 'writing', 'planning'] },
};

export const DEFAULT_ENERGY = { decayRate: 4, recoveryRate: 20, forcePauseAt: 25, canResumeAt: 80 };
export const DEFAULT_TICK_RATE = 5000;

export const DEFAULT_CONFIG = {
  version: 1,
  llm: null,
  budget: { dailyLimit: 10.00, onExhaustion: 'fallback-then-pause' },
  tickRate: DEFAULT_TICK_RATE,
  energy: DEFAULT_ENERGY,
};
