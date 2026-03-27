import { ModelDetector } from '../llm/ModelDetector.js';
import { PROVIDERS } from '../llm/ProviderRegistry.js';
import { GlobalConfig } from '../config/GlobalConfig.js';
import paths from '../utils/paths.js';
import { banner, step, success, warn, info, dim, select, ask, askSecret, confirm } from './prompt.js';

const PROVIDER_MODELS = {
  ollama: ['llama3', 'mistral', 'codellama', 'gemma2'],
  lmstudio: [],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
  openrouter: ['meta-llama/llama-3.1-8b-instruct', 'anthropic/claude-sonnet-4-20250514'],
  together: ['meta-llama/Llama-3-8b-chat-hf'],
  groq: ['llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  deepseek: ['deepseek-chat', 'deepseek-coder'],
  mistral: ['mistral-small-latest', 'mistral-large-latest'],
};

export async function runSetup() {
  banner('SparkCell v2.0 — Setup');

  // Step 1: Detect local LLMs
  step(1, 4, 'Lokale LLM-Server suchen...');
  const detector = new ModelDetector();
  let detected = [];
  try {
    detected = await detector.detect();
  } catch { /* ignore */ }

  if (detected.length > 0) {
    for (const d of detected) {
      success(`${d.name} gefunden (Port ${d.port}) — ${d.models.length} Modelle`);
    }
  } else {
    dim('  Keine lokalen Server gefunden.');
  }

  // Step 2: Pick provider
  step(2, 4, 'LLM-Provider wählen');
  const providerItems = [];

  for (const d of detected) {
    const providerInfo = PROVIDERS[d.name] || {};
    providerItems.push({
      label: `${providerInfo.name || d.name} (lokal erkannt)`,
      hint: `${d.models.length} Modelle`,
      id: d.name,
      baseUrl: providerInfo.baseUrl || `http://localhost:${d.port}/v1`,
      requiresKey: false,
      models: d.models,
    });
  }

  for (const [id, p] of Object.entries(PROVIDERS)) {
    if (id === 'custom') continue;
    if (detected.some(d => d.name === id)) continue;
    providerItems.push({
      label: p.name,
      hint: p.requiresKey ? 'API-Key nötig' : 'kostenlos',
      id,
      baseUrl: p.baseUrl,
      requiresKey: p.requiresKey,
      models: PROVIDER_MODELS[id] || [],
    });
  }

  const chosen = await select('Welchen Provider möchtest du nutzen?', providerItems);

  // Step 3: API key (if needed)
  let apiKey = null;
  if (chosen.requiresKey) {
    step(3, 4, 'API-Key eingeben');
    apiKey = await askSecret(`API-Key für ${chosen.label}:`);
    if (!apiKey) {
      warn('Kein API-Key eingegeben. Du kannst ihn später mit "sparkcell config" setzen.');
    }
  } else {
    step(3, 4, 'API-Key');
    dim('  Nicht nötig für diesen Provider.');
  }

  // Step 4: Model
  step(4, 4, 'Modell wählen');
  let model;
  if (chosen.models && chosen.models.length > 0) {
    const modelItems = chosen.models.slice(0, 10).map(m => ({ label: m, value: m }));
    const selected = await select('Welches Modell?', modelItems);
    model = selected.value || selected.label;
  } else {
    model = await ask('Modellname eingeben:');
  }

  // Confirm
  console.log();
  info(`Provider: ${chosen.id}`);
  info(`Modell:   ${model}`);
  info(`URL:      ${chosen.baseUrl}`);
  if (apiKey) info(`API-Key:  ${'*'.repeat(8)}...`);
  console.log();

  const ok = await confirm('Config speichern?');
  if (!ok) {
    warn('Abgebrochen.');
    return false;
  }

  // Save
  const config = new GlobalConfig(paths.config());
  await config.load();
  config.data = {
    ...config.data,
    version: 1,
    llm: {
      primary: {
        provider: chosen.id,
        model,
        baseUrl: chosen.baseUrl,
        ...(apiKey ? { apiKey } : {}),
      },
    },
  };
  await config.save();

  console.log();
  success(`Config gespeichert: ${paths.config()}`);
  console.log();
  dim('Nächste Schritte:');
  info('  sparkcell new     — Neues Startup erstellen');
  info('  sparkcell start   — Startup starten');
  console.log();

  return true;
}
