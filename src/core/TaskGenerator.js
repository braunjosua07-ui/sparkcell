// src/core/TaskGenerator.js

let _taskCounter = 0;
function nextId() {
  return `task-${++_taskCounter}`;
}

/**
 * Expanded role task pools — agents cycle through these, never repeating.
 */
const ROLE_TASKS = {
  ceo: [
    { title: 'Define company vision', description: 'Write a clear vision statement for the startup.', priority: 'high' },
    { title: 'Set quarterly OKRs', description: 'Define objectives and key results for this quarter.', priority: 'high' },
    { title: 'Define company values', description: 'Establish 3-5 core values that guide company culture.', priority: 'medium' },
    { title: 'Create investor pitch narrative', description: 'Draft the compelling story behind the company for fundraising.', priority: 'high' },
    { title: 'Define go-to-market strategy', description: 'Outline how the product will reach its first customers.', priority: 'high' },
    { title: 'Analyze competitive landscape', description: 'Map out direct and indirect competitors and our differentiation.', priority: 'medium' },
    { title: 'Define partnership strategy', description: 'Identify potential strategic partners and integration opportunities.', priority: 'medium' },
    { title: 'Plan team expansion roadmap', description: 'Define which roles to hire next and in what order.', priority: 'medium' },
  ],
  cto: [
    { title: 'Design system architecture', description: 'Draft the initial technical architecture document.', priority: 'high' },
    { title: 'Evaluate tech stack', description: 'Research and choose the primary technology stack.', priority: 'high' },
    { title: 'Set up CI/CD pipeline', description: 'Configure automated build and deploy workflows.', priority: 'medium' },
    { title: 'Define API design', description: 'Design the core API endpoints and data models.', priority: 'high' },
    { title: 'Create security framework', description: 'Define authentication, authorization, and data protection strategy.', priority: 'high' },
    { title: 'Plan database schema', description: 'Design the data model and choose database technology.', priority: 'high' },
    { title: 'Define scaling strategy', description: 'Plan for horizontal scaling, caching, and performance optimization.', priority: 'medium' },
    { title: 'Create technical documentation', description: 'Write developer docs for API, setup, and architecture decisions.', priority: 'medium' },
  ],
  cmo: [
    { title: 'Define target audience', description: 'Research and document the ideal customer profile.', priority: 'high' },
    { title: 'Build brand identity', description: 'Create brand guidelines, logo concepts, and tone of voice.', priority: 'high' },
    { title: 'Launch social media strategy', description: 'Plan content strategy and channels for social media presence.', priority: 'medium' },
    { title: 'Create content marketing plan', description: 'Define blog topics, content calendar, and SEO strategy.', priority: 'high' },
    { title: 'Design launch campaign', description: 'Plan the product launch marketing campaign with timeline and channels.', priority: 'high' },
    { title: 'Analyze marketing channels', description: 'Evaluate paid vs organic channels and budget allocation.', priority: 'medium' },
    { title: 'Create email marketing strategy', description: 'Design email sequences for onboarding, retention, and conversion.', priority: 'medium' },
    { title: 'Define brand voice guidelines', description: 'Document tone, language, and messaging framework for all communications.', priority: 'medium' },
  ],
  cfo: [
    { title: 'Create financial model', description: 'Build a 12-month financial projection with revenue and costs.', priority: 'high' },
    { title: 'Track burn rate', description: 'Set up monthly expense tracking and reporting framework.', priority: 'high' },
    { title: 'Explore funding options', description: 'Research grants, angels, and VC opportunities for seed round.', priority: 'medium' },
    { title: 'Define pricing strategy', description: 'Analyze market prices and define our pricing model (freemium, subscription, etc).', priority: 'high' },
    { title: 'Create budget allocation plan', description: 'Allocate budget across departments: engineering, marketing, ops.', priority: 'high' },
    { title: 'Analyze unit economics', description: 'Calculate CAC, LTV, payback period and break-even point.', priority: 'high' },
    { title: 'Prepare investor financials', description: 'Create financial slides for pitch deck with projections and assumptions.', priority: 'medium' },
    { title: 'Define KPI dashboard', description: 'Design the key financial metrics dashboard for team visibility.', priority: 'medium' },
  ],
  developer: [
    { title: 'Build MVP core features', description: 'Implement the minimum viable product feature set.', priority: 'high' },
    { title: 'Write unit tests', description: 'Achieve 80%+ test coverage for core modules.', priority: 'medium' },
    { title: 'Set up development environment', description: 'Create Docker setup, README, and local dev workflow.', priority: 'high' },
    { title: 'Implement authentication', description: 'Build user registration, login, and session management.', priority: 'high' },
    { title: 'Build REST API endpoints', description: 'Implement the core CRUD endpoints defined in the API spec.', priority: 'high' },
    { title: 'Set up error handling', description: 'Implement global error handling, logging, and monitoring.', priority: 'medium' },
    { title: 'Implement data validation', description: 'Add input validation and sanitization for all endpoints.', priority: 'medium' },
    { title: 'Create database migrations', description: 'Set up migration system and create initial schema.', priority: 'high' },
  ],
  designer: [
    { title: 'Create wireframes', description: 'Design low-fidelity wireframes for core user flows.', priority: 'high' },
    { title: 'Build design system', description: 'Create reusable component library and style guide.', priority: 'high' },
    { title: 'Conduct user research', description: 'Define user personas and map their journey through the product.', priority: 'medium' },
    { title: 'Design landing page', description: 'Create high-fidelity mockup for the product landing page.', priority: 'high' },
    { title: 'Design onboarding flow', description: 'Create the first-time user experience with progressive disclosure.', priority: 'high' },
    { title: 'Create icon and illustration set', description: 'Design custom icons and illustrations for the product.', priority: 'medium' },
    { title: 'Design mobile responsive layouts', description: 'Adapt key screens for mobile and tablet viewports.', priority: 'medium' },
    { title: 'Create prototype', description: 'Build an interactive clickable prototype for usability testing.', priority: 'high' },
  ],
  sales: [
    { title: 'Identify first 10 leads', description: 'Research and list 10 high-potential prospects with contact info.', priority: 'high' },
    { title: 'Create sales pitch', description: 'Develop a compelling 5-minute pitch with value proposition.', priority: 'high' },
    { title: 'Design sales funnel', description: 'Map the complete sales process from lead to customer.', priority: 'high' },
    { title: 'Create outreach templates', description: 'Write email and LinkedIn message templates for cold outreach.', priority: 'medium' },
    { title: 'Define ideal customer profile', description: 'Document the characteristics of our best-fit customers.', priority: 'high' },
    { title: 'Create demo script', description: 'Write a structured product demo script highlighting key features.', priority: 'medium' },
    { title: 'Analyze competitor pricing', description: 'Research and compare competitor pricing and packaging.', priority: 'medium' },
    { title: 'Create objection handling guide', description: 'Document common objections and effective responses.', priority: 'medium' },
  ],
};

const DEFAULT_ROLE_TASKS = [
  { title: 'Define responsibilities', description: 'Document your core responsibilities and deliverables.', priority: 'high' },
  { title: 'Set personal goals', description: 'Set 3 measurable goals for the next sprint.', priority: 'medium' },
  { title: 'Create status report', description: 'Write a brief status report on current progress and next steps.', priority: 'low' },
];

export class TaskGenerator {
  #agentId;
  #role;
  #config;
  #completedTitles = new Set(); // Track completed task titles to avoid repeats
  #roleTaskIndex = 0; // Current position in role task pool

  constructor(agentId, role, config = {}) {
    this.#agentId = agentId;
    this.#role = (role ?? 'generic').toLowerCase();
    this.#config = {
      maxTasksPerSource: config.maxTasksPerSource ?? 5,
      ...config,
    };
  }

  /**
   * Mark a task title as completed so it won't be regenerated.
   */
  markCompleted(title) {
    this.#completedTitles.add(title);
  }

  /**
   * Generate tasks from context, avoiding duplicates.
   */
  generate(context = {}) {
    const tasks = [];

    // Role-based tasks — cycle through the pool, skip completed
    tasks.push(...this.#roleBasedTasks());
    // Mission-aligned tasks from whiteboard goals
    tasks.push(...this.#missionAlignmentTasks(context.missionGoals ?? []));
    // Skill gap tasks
    tasks.push(...this.#skillGapTasks(context.skillGaps ?? []));

    return tasks;
  }

  // ── Task sources ──────────────────────────────────────────────────────────

  #roleBasedTasks() {
    const roleDefs = ROLE_TASKS[this.#role] ?? DEFAULT_ROLE_TASKS;
    const tasks = [];

    // Start from where we left off, cycle through all tasks
    for (let i = 0; i < roleDefs.length && tasks.length < 3; i++) {
      const idx = (this.#roleTaskIndex + i) % roleDefs.length;
      const def = roleDefs[idx];
      if (this.#completedTitles.has(def.title)) continue;
      tasks.push({
        id: nextId(),
        title: def.title,
        description: def.description,
        priority: def.priority,
        source: 'role',
      });
    }

    // Advance the index
    this.#roleTaskIndex = (this.#roleTaskIndex + tasks.length) % roleDefs.length;

    return tasks;
  }

  #skillGapTasks(skillGaps) {
    return skillGaps
      .filter(s => !this.#completedTitles.has(`Develop ${s} skill`))
      .slice(0, this.#config.maxTasksPerSource)
      .map(skill => ({
        id: nextId(),
        title: `Develop ${skill} skill`,
        description: `Practice and improve ${skill} through focused study and application.`,
        priority: 'medium',
        source: 'skill-gap',
      }));
  }

  #missionAlignmentTasks(missionGoals) {
    return missionGoals
      .filter(g => !this.#completedTitles.has(`Advance: ${g}`))
      .slice(0, 2) // max 2 mission tasks at once
      .map(goal => ({
        id: nextId(),
        title: `Advance: ${goal}`,
        description: `As ${this.#role}, identify and execute concrete actions that contribute to: "${goal}". Produce a deliverable.`,
        priority: 'high',
        source: 'mission',
      }));
  }

  get agentId() { return this.#agentId; }
  get role()    { return this.#role; }
}
