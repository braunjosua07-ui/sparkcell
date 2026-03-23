// src/core/TaskGenerator.js

let _taskCounter = 0;
function nextId() {
  return `task-${++_taskCounter}`;
}

/**
 * Default tasks per role.
 * Each entry is { title, description, priority }.
 */
const ROLE_TASKS = {
  ceo: [
    { title: 'Define company vision', description: 'Write a clear vision statement for the startup.', priority: 'high' },
    { title: 'Set quarterly OKRs', description: 'Define objectives and key results for this quarter.', priority: 'high' },
    { title: 'Recruit co-founders', description: 'Identify and reach out to potential co-founders.', priority: 'medium' },
  ],
  cto: [
    { title: 'Design system architecture', description: 'Draft the initial technical architecture document.', priority: 'high' },
    { title: 'Evaluate tech stack', description: 'Research and choose the primary technology stack.', priority: 'high' },
    { title: 'Set up CI/CD pipeline', description: 'Configure automated build and deploy workflows.', priority: 'medium' },
  ],
  cmo: [
    { title: 'Define target audience', description: 'Research and document the ideal customer profile.', priority: 'high' },
    { title: 'Build brand identity', description: 'Create brand guidelines, logo, and tone of voice.', priority: 'high' },
    { title: 'Launch social media presence', description: 'Set up and activate key social media channels.', priority: 'medium' },
  ],
  cfo: [
    { title: 'Create financial model', description: 'Build a 12-month financial projection spreadsheet.', priority: 'high' },
    { title: 'Track burn rate', description: 'Set up monthly expense tracking and reporting.', priority: 'high' },
    { title: 'Explore funding options', description: 'Research grants, angels, and VC opportunities.', priority: 'medium' },
  ],
  developer: [
    { title: 'Build MVP', description: 'Implement the minimum viable product feature set.', priority: 'high' },
    { title: 'Write unit tests', description: 'Achieve 80%+ test coverage for core modules.', priority: 'medium' },
    { title: 'Code review process', description: 'Establish a peer review workflow for pull requests.', priority: 'low' },
  ],
  designer: [
    { title: 'Create wireframes', description: 'Design low-fidelity wireframes for core user flows.', priority: 'high' },
    { title: 'Build design system', description: 'Create reusable component library and style guide.', priority: 'high' },
    { title: 'Conduct user research', description: 'Interview 5 potential users about pain points.', priority: 'medium' },
  ],
  sales: [
    { title: 'Identify first 10 leads', description: 'Research and list 10 high-potential prospects.', priority: 'high' },
    { title: 'Create sales pitch', description: 'Develop a compelling 5-minute pitch deck.', priority: 'high' },
    { title: 'Set up CRM', description: 'Configure a CRM tool to track sales pipeline.', priority: 'medium' },
  ],
};

const DEFAULT_ROLE_TASKS = [
  { title: 'Define responsibilities', description: 'Document your core responsibilities and deliverables.', priority: 'high' },
  { title: 'Set personal goals', description: 'Set 3 measurable goals for the next sprint.', priority: 'medium' },
];

export class TaskGenerator {
  #agentId;
  #role;
  #config;

  /**
   * @param {string} agentId
   * @param {string} role  — e.g. 'cto', 'designer'
   * @param {object} config
   */
  constructor(agentId, role, config = {}) {
    this.#agentId = agentId;
    this.#role = (role ?? 'generic').toLowerCase();
    this.#config = {
      maxTasksPerSource: config.maxTasksPerSource ?? 5,
      ...config,
    };
  }

  /**
   * Generate tasks from context.
   * @param {object} context
   * @param {string[]} [context.missionGoals]
   * @param {string[]} [context.skillGaps]
   * @param {string[]} [context.existingDocuments]
   * @param {object}  [context.agentState]
   * @returns {Array<{id, title, description, priority, source}>}
   */
  generate(context = {}) {
    const tasks = [];

    tasks.push(...this.#roleBasedTasks());
    tasks.push(...this.#skillGapTasks(context.skillGaps ?? []));
    tasks.push(...this.#missionAlignmentTasks(context.missionGoals ?? []));
    tasks.push(...this.#documentGapTasks(context.existingDocuments ?? []));

    return tasks;
  }

  // ── Task sources ──────────────────────────────────────────────────────────

  /**
   * Generate default tasks based on the agent's role.
   */
  #roleBasedTasks() {
    const roleDefs = ROLE_TASKS[this.#role] ?? DEFAULT_ROLE_TASKS;
    return roleDefs
      .slice(0, this.#config.maxTasksPerSource)
      .map(def => ({
        id: nextId(),
        title: def.title,
        description: def.description,
        priority: def.priority,
        source: 'role',
      }));
  }

  /**
   * Generate skill-development tasks from skill gaps array.
   * @param {string[]} skillGaps - skill names agent should develop
   */
  #skillGapTasks(skillGaps) {
    return skillGaps
      .slice(0, this.#config.maxTasksPerSource)
      .map(skill => ({
        id: nextId(),
        title: `Develop ${skill} skill`,
        description: `Practice and improve ${skill} through focused study and application.`,
        priority: 'medium',
        source: 'skill-gap',
      }));
  }

  /**
   * Generate mission-alignment tasks from high-level mission goals.
   * @param {string[]} missionGoals
   */
  #missionAlignmentTasks(missionGoals) {
    return missionGoals
      .slice(0, this.#config.maxTasksPerSource)
      .map(goal => ({
        id: nextId(),
        title: `Advance: ${goal}`,
        description: `Identify and execute concrete actions that contribute to: "${goal}".`,
        priority: 'high',
        source: 'mission',
      }));
  }

  /**
   * Stub: document gap analysis — will be wired to actual document inspection in Task 9/10.
   * @param {string[]} _existingDocuments
   */
  #documentGapTasks(_existingDocuments) {
    // Stub: returns no tasks until document content analysis is implemented.
    return [];
  }

  get agentId() { return this.#agentId; }
  get role()    { return this.#role; }
}
