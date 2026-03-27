import fs from 'node:fs/promises';
import { GlobalConfig } from '../config/GlobalConfig.js';
import { PROVIDERS } from '../llm/ProviderRegistry.js';
import { ModelDetector } from '../llm/ModelDetector.js';
import { StartupSelector } from '../wizard/StartupSelector.js';
import paths from '../utils/paths.js';
import { banner, success, warn, error, info, dim } from './prompt.js';

export async function runDoctor() {
  banner('SparkCell Doctor');
  let issues = 0;

  // 1. Node version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1));
  if (major >= 18) {
    success(`Node.js ${nodeVersion}`);
  } else {
    error(`Node.js ${nodeVersion} — mindestens v18 nötig!`);
    issues++;
  }

  // 2. Home directory
  const home = paths.home();
  try {
    await fs.access(home);
    success(`Home-Verzeichnis existiert: ${home}`);
  } catch {
    warn(`Home-Verzeichnis fehlt: ${home}`);
    dim('  Wird beim ersten Start erstellt.');
  }

  // 3. Config
  const config = new GlobalConfig(paths.config());
  await config.load();
  if (config.needsSetup()) {
    error('Keine LLM-Config gefunden — führe "sparkcell setup" aus');
    issues++;
  } else {
    success(`Config geladen: ${paths.config()}`);
    const primary = config.data.llm?.primary;
    if (primary) {
      info(`  Provider: ${primary.provider}`);
      info(`  Modell:   ${primary.model}`);
      info(`  URL:      ${primary.baseUrl}`);
      if (primary.apiKey) {
        success('  API-Key ist gesetzt');
      } else {
        const providerInfo = PROVIDERS[primary.provider];
        if (providerInfo?.requiresKey) {
          error('  API-Key fehlt! Setze ihn mit "sparkcell config set apikey <key>"');
          issues++;
        } else {
          dim('  API-Key nicht nötig');
        }
      }
    }
  }

  // 4. LLM connectivity
  if (!config.needsSetup()) {
    const primary = config.data.llm?.primary;
    if (primary?.baseUrl) {
      try {
        const url = primary.baseUrl.replace(/\/v1$/, '') + '/v1/models';
        const response = await fetch(url, {
          signal: AbortSignal.timeout(3000),
          headers: primary.apiKey ? { Authorization: `Bearer ${primary.apiKey}` } : {},
        });
        if (response.ok) {
          success('LLM-Server erreichbar');
        } else {
          warn(`LLM-Server antwortet mit Status ${response.status}`);
          issues++;
        }
      } catch {
        error('LLM-Server nicht erreichbar!');
        issues++;
      }
    }
  }

  // 5. Local LLM scan
  const detector = new ModelDetector();
  try {
    const detected = await detector.detect();
    if (detected.length > 0) {
      for (const d of detected) {
        success(`Lokaler Server: ${d.name} (Port ${d.port}, ${d.models.length} Modelle)`);
      }
    } else {
      dim('  Keine lokalen LLM-Server gefunden');
    }
  } catch {
    dim('  LLM-Scan fehlgeschlagen');
  }

  // 6. Startups
  const selector = new StartupSelector();
  const startups = await selector.listStartups();
  if (startups.length > 0) {
    success(`${startups.length} Startup(s) gefunden:`);
    for (const s of startups) {
      info(`  ${s.name} — ${s.displayName} (${s.agentCount} Agents)`);
    }
  } else {
    dim('  Keine Startups vorhanden');
  }

  // Summary
  console.log();
  if (issues === 0) {
    success('Alles in Ordnung! SparkCell ist bereit.');
  } else {
    error(`${issues} Problem(e) gefunden. Siehe oben.`);
  }
  console.log();
}
