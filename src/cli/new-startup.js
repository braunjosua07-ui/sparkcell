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

export async function runNewStartup() {
  banner('Neues Startup erstellen');

  // Step 1: Name
  step(1, 3, 'Startup benennen');
  const name = await ask('Wie soll dein Startup heißen?');
  if (!name) {
    warn('Kein Name eingegeben. Abgebrochen.');
    return;
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const startupDir = paths.startup(slug);

  try {
    await fs.access(startupDir);
    warn(`Startup "${slug}" existiert bereits!`);
    const overwrite = await confirm('Überschreiben?', false);
    if (!overwrite) return;
  } catch { /* doesn't exist, good */ }

  // Step 2: Description + Mission + Goals
  step(2, 5, 'Startup definieren');
  const description = await ask('Was macht dein Startup? (kurze Beschreibung):') || `${name} — AI Startup`;
  const mission = await ask('Mission (das große Ziel):') || description;

  dim('  Definiere Ziele für dein Startup. Leeren Eintrag = fertig.');
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

  // Step 3: Template
  step(3, 5, 'Team-Vorlage wählen');
  const templateItems = Object.entries(TEMPLATES).map(([id, t]) => ({
    label: t.label,
    hint: t.hint,
    id,
    file: t.file,
  }));
  const template = await select('Welche Team-Größe?', templateItems);

  // Load agents from template
  let agents;
  if (template.file) {
    const templatePath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '../../templates',
      template.file,
    );
    try {
      const data = JSON.parse(await fs.readFile(templatePath, 'utf8'));
      agents = data.agents.map(a => ({ ...a, active: true }));
      success(`Template "${template.label}" geladen — ${agents.length} Agents`);
    } catch {
      warn('Template konnte nicht geladen werden. Verwende Standard-Team.');
      agents = getDefaultAgents();
    }
  } else {
    agents = await buildCustomTeam();
  }

  // Step 4: Create
  step(4, 5, 'Startup erstellen');

  // Create directories
  await fs.mkdir(path.join(startupDir, 'shared'), { recursive: true });
  await fs.mkdir(path.join(startupDir, 'output', 'docs'), { recursive: true });
  await fs.mkdir(path.join(startupDir, 'logs'), { recursive: true });

  for (const agent of agents) {
    await fs.mkdir(path.join(startupDir, 'agents', agent.id), { recursive: true });
  }

  // Write startup config
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
  info(`  Agents: ${agents.map(a => a.name).join(', ')}`);
  console.log();
  dim('Starte mit:');
  info(`  sparkcell start ${slug}`);
  console.log();
}

async function buildCustomTeam() {
  const agents = [];
  const roles = [
    { label: 'Strategic Lead (CEO)', value: 'strategic-lead', skills: ['strategy', 'vision', 'planning'] },
    { label: 'Implementer (Developer)', value: 'implementer', skills: ['coding', 'architecture', 'debugging'] },
    { label: 'Analyst (Research)', value: 'analyst', skills: ['research', 'analysis', 'data'] },
    { label: 'Communicator (Marketing)', value: 'communicator', skills: ['writing', 'marketing', 'social-media'] },
    { label: 'Designer (UX/UI)', value: 'designer', skills: ['design', 'ux', 'prototyping'] },
  ];

  dim('  Füge Agents hinzu. Leeren Namen eingeben zum Beenden.');
  let i = 1;
  while (i <= 10) {
    console.log();
    const agentName = await ask(`Agent ${i} Name (leer = fertig):`);
    if (!agentName) break;

    const role = await select(`Rolle für ${agentName}:`, roles);
    const id = agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    agents.push({ id, name: agentName, role: role.value, skills: role.skills, active: true });
    success(`${agentName} (${role.label}) hinzugefügt`);
    i++;
  }

  if (agents.length === 0) {
    warn('Kein Agent erstellt. Verwende Standard-Team.');
    return getDefaultAgents();
  }

  return agents;
}

function getDefaultAgents() {
  return [
    { id: 'ceo', name: 'CEO', role: 'strategic-lead', skills: ['strategy', 'vision', 'planning'], active: true },
    { id: 'tech', name: 'Tech Lead', role: 'implementer', skills: ['coding', 'architecture', 'api-design'], active: true },
    { id: 'product', name: 'Product', role: 'analyst', skills: ['research', 'analysis', 'user-stories'], active: true },
  ];
}
