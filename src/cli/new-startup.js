import fs from 'node:fs/promises';
import path from 'node:path';
import paths from '../utils/paths.js';
import { banner, step, success, warn, info, dim, select, ask, confirm } from './prompt.js';

const TEMPLATES = {
  'lean': { file: 'lean-3.json', label: 'Lean Startup (3 Agents)', hint: 'CEO, Tech Lead, Product' },
  'growth': { file: 'growth-5.json', label: 'Growth Startup (5 Agents)', hint: 'CEO, CTO, Product, Marketing, Sales' },
  'enterprise': { file: 'enterprise-8.json', label: 'Enterprise (8 Agents)', hint: 'Volles Team' },
  'custom': { file: null, label: 'Custom', hint: 'Eigenes Team zusammenstellen' },
};

const ROLES = [
  { label: 'CEO / Strategic Lead', value: 'ceo', defaultSkills: ['strategy', 'leadership', 'vision'] },
  { label: 'CTO / Tech Lead', value: 'cto', defaultSkills: ['architecture', 'coding', 'devops'] },
  { label: 'Developer', value: 'developer', defaultSkills: ['coding', 'architecture', 'debugging'] },
  { label: 'Researcher / Analyst', value: 'analyst', defaultSkills: ['research', 'analysis', 'writing'] },
  { label: 'Marketing / CMO', value: 'cmo', defaultSkills: ['marketing', 'writing', 'sales'] },
  { label: 'Designer (UX/UI)', value: 'designer', defaultSkills: ['design', 'prototyping', 'research'] },
  { label: 'Sales', value: 'sales', defaultSkills: ['sales', 'negotiation', 'writing'] },
  { label: 'Finance / CFO', value: 'cfo', defaultSkills: ['finance', 'strategy', 'analysis'] },
];

const SKILL_TIERS = [
  { label: 'Junior (lernt noch)', value: 'beginner', hint: 'Level 30' },
  { label: 'Mid-Level (solide)', value: 'intermediate', hint: 'Level 50' },
  { label: 'Senior (erfahren)', value: 'expert', hint: 'Level 70' },
  { label: 'Experte (top)', value: 'master', hint: 'Level 85' },
];

const ALL_SKILLS = [
  'strategy', 'leadership', 'vision', 'coding', 'architecture', 'devops',
  'debugging', 'research', 'analysis', 'writing', 'marketing', 'sales',
  'design', 'prototyping', 'finance', 'negotiation',
];

export async function runNewStartup() {
  banner('Neues Startup erstellen');

  // Step 1: Name
  step(1, 5, 'Startup benennen');
  const name = await ask('Wie soll dein Startup heissen?');
  if (!name) {
    warn('Kein Name eingegeben. Abgebrochen.');
    return;
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const startupDir = paths.startup(slug);

  try {
    await fs.access(startupDir);
    warn(`Startup "${slug}" existiert bereits!`);
    const overwrite = await confirm('Ueberschreiben?', false);
    if (!overwrite) return;
  } catch { /* doesn't exist, good */ }

  // Step 2: Description + Mission + Goals
  step(2, 5, 'Startup definieren');
  const description = await ask('Was macht dein Startup? (kurze Beschreibung):') || `${name} — AI Startup`;
  const mission = await ask('Mission (das grosse Ziel):') || description;

  dim('  Definiere Ziele fuer dein Startup. Leeren Eintrag = fertig.');
  const goals = [];
  for (let g = 1; g <= 10; g++) {
    const goal = await ask(`Ziel ${g} (leer = fertig):`);
    if (!goal) break;
    goals.push(goal);
  }
  if (goals.length === 0) {
    goals.push('MVP entwickeln', 'Erste Kunden gewinnen', 'Marktposition aufbauen');
    dim('  Standard-Ziele gesetzt.');
  }

  // Step 3: Team
  step(3, 5, 'Team zusammenstellen');
  const templateItems = Object.entries(TEMPLATES).map(([id, t]) => ({
    label: t.label,
    hint: t.hint,
    id,
    file: t.file,
  }));
  const template = await select('Welche Team-Groesse?', templateItems);

  let agents;
  if (template.file) {
    const templatePath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '../../templates',
      template.file,
    );
    try {
      const data = JSON.parse(await fs.readFile(templatePath, 'utf8'));
      agents = data.agents.map(a => ({
        ...a,
        skills: a.skills?.map(s => typeof s === 'string' ? { name: s, tier: 'intermediate' } : s) || [],
        active: true,
      }));
      success(`Template "${template.label}" geladen — ${agents.length} Agents`);

      // Ask if user wants to customize the template agents
      const customize = await confirm('Agents individuell anpassen?', false);
      if (customize) {
        agents = await customizeAgents(agents);
      }
    } catch {
      warn('Template konnte nicht geladen werden. Verwende Standard-Team.');
      agents = getDefaultAgents();
    }
  } else {
    agents = await buildCustomTeam();
  }

  // Step 4: Create
  step(4, 5, 'Startup erstellen');

  await fs.mkdir(path.join(startupDir, 'shared'), { recursive: true });
  await fs.mkdir(path.join(startupDir, 'output', 'docs'), { recursive: true });
  await fs.mkdir(path.join(startupDir, 'logs'), { recursive: true });

  for (const agent of agents) {
    await fs.mkdir(path.join(startupDir, 'agents', agent.id), { recursive: true });
  }

  const startupConfig = {
    version: 1,
    name,
    description,
    mission,
    goals,
    createdAt: new Date().toISOString(),
    agents,
    autonomyLevel: 'balanced',
  };
  await fs.writeFile(
    path.join(startupDir, 'startup.json'),
    JSON.stringify(startupConfig, null, 2),
  );

  console.log();
  step(5, 5, 'Fertig');
  success(`Startup "${name}" erstellt!`);
  info(`  Ordner: ${startupDir}`);
  info(`  Mission: ${mission}`);
  info(`  Ziele: ${goals.length}`);
  console.log();
  for (const a of agents) {
    const tierLabel = getTierLabel(a.skills);
    info(`  ${a.name} (${a.role}) — ${tierLabel}`);
  }
  console.log();
  dim('Starte mit:');
  info(`  sparkcell start ${slug}`);
  console.log();
}

function getTierLabel(skills) {
  if (!skills || skills.length === 0) return 'keine Skills';
  const names = skills.map(s => typeof s === 'string' ? s : s.name);
  return names.join(', ');
}

async function buildCustomTeam() {
  const agents = [];

  dim('  Erstelle dein Team. Leeren Namen eingeben zum Beenden.');
  dim('  Du kannst jeden Agent individuell konfigurieren.');
  let i = 1;
  while (i <= 10) {
    console.log();
    const agentName = await ask(`Agent ${i} Name (leer = fertig):`);
    if (!agentName) break;

    const role = await select(`Rolle fuer ${agentName}:`, ROLES);
    const id = agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Experience level
    const tier = await select(`Erfahrungslevel von ${agentName}:`, SKILL_TIERS);

    // Skill customization
    const useDefaults = await confirm(`Standard-Skills verwenden? (${role.defaultSkills.join(', ')})`, true);
    let skills;
    if (useDefaults) {
      skills = role.defaultSkills.map(s => ({ name: s, tier: tier.value }));
    } else {
      skills = await pickSkills(agentName, tier.value);
    }

    // Optional: personality/focus
    const focus = await ask(`Fokus/Spezialgebiet von ${agentName} (optional):`);

    const agent = {
      id,
      name: agentName,
      role: role.value,
      skills,
      active: true,
    };
    if (focus) agent.focus = focus;

    agents.push(agent);
    success(`${agentName} (${role.label}, ${tier.label}) hinzugefuegt`);
    i++;
  }

  if (agents.length === 0) {
    warn('Kein Agent erstellt. Verwende Standard-Team.');
    return getDefaultAgents();
  }

  return agents;
}

async function customizeAgents(agents) {
  const result = [];
  for (const agent of agents) {
    console.log();
    info(`  ${agent.name} (${agent.role}):`);

    // Rename?
    const newName = await ask(`  Name (Enter = "${agent.name}"):`);
    if (newName) agent.name = newName;

    // Tier
    const tier = await select(`  Erfahrungslevel:`, SKILL_TIERS);
    agent.skills = (agent.skills || []).map(s => {
      const name = typeof s === 'string' ? s : s.name;
      return { name, tier: tier.value };
    });

    // Focus
    const focus = await ask('  Fokus/Spezialgebiet (optional):');
    if (focus) agent.focus = focus;

    result.push(agent);
    success(`  ${agent.name} konfiguriert`);
  }
  return result;
}

async function pickSkills(agentName, tier) {
  dim(`  Waehle Skills fuer ${agentName} (max 5). Leere Eingabe = fertig.`);
  const skills = [];
  const available = ALL_SKILLS.map((s, i) => ({ label: s, value: s, id: i }));

  for (let s = 0; s < 5; s++) {
    const remaining = available.filter(a => !skills.find(sk => sk.name === a.value));
    if (remaining.length === 0) break;
    const skill = await select(`  Skill ${s + 1}:`, [...remaining, { label: '(fertig)', value: null }]);
    if (!skill.value) break;
    skills.push({ name: skill.value, tier });
  }

  if (skills.length === 0) {
    dim('  Keine Skills gewaehlt, verwende Standard.');
    return [{ name: 'writing', tier }, { name: 'research', tier }];
  }
  return skills;
}

function getDefaultAgents() {
  return [
    { id: 'ceo', name: 'CEO', role: 'ceo', skills: [{ name: 'strategy', tier: 'expert' }, { name: 'leadership', tier: 'expert' }, { name: 'vision', tier: 'expert' }], active: true },
    { id: 'tech', name: 'Tech Lead', role: 'cto', skills: [{ name: 'coding', tier: 'expert' }, { name: 'architecture', tier: 'expert' }], active: true },
    { id: 'product', name: 'Product', role: 'analyst', skills: [{ name: 'research', tier: 'intermediate' }, { name: 'analysis', tier: 'intermediate' }, { name: 'writing', tier: 'intermediate' }], active: true },
  ];
}
