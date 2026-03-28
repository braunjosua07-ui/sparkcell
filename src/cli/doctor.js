import fs from 'node:fs/promises';
import { GlobalConfig } from '../config/GlobalConfig.js';
import { PROVIDERS } from '../llm/ProviderRegistry.js';
import { ModelDetector } from '../llm/ModelDetector.js';
import { StartupSelector } from '../wizard/StartupSelector.js';
import paths from '../utils/paths.js';
import { showBox, success, warn, error, info, dim } from './prompt.js';
import { THEME, ANSI } from './colors.js';

export async function runDoctor() {
  // Premium health check banner
  console.log();
  console.log(`${THEME.primary}╔══════════════════╗${ANSI.reset}`);
  console.log(`${THEME.primary}║${ANSI.reset}  ${ANSI.bold}SparkCell Doctor${ANSI.reset}  ${THEME.primary}║${ANSI.reset}`);
  console.log(`${THEME.primary}╚══════════════════╝${ANSI.reset}`);
  console.log();

  let issues = 0;
  const checks = [];

  // 1. Node version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1));
  if (major >= 18) {
    checks.push({ status: 'ok', message: `Node.js ${nodeVersion}` });
  } else {
    checks.push({ status: 'error', message: `Node.js ${nodeVersion} — mindestens v18 nötig!` });
    issues++;
  }

  // 2. Home directory
  const home = paths.home();
  try {
    await fs.access(home);
    checks.push({ status: 'ok', message: `Home-Verzeichnis existiert: ${home}` });
  } catch {
    checks.push({ status: 'warn', message: `Home-Verzeichnis fehlt: ${home}` });
  }

  // 3. Config
  const config = new GlobalConfig(paths.config());
  await config.load();
  if (config.needsSetup()) {
    checks.push({ status: 'error', message: 'Keine LLM-Config — führe "sparkcell setup" aus' });
    issues++;
  } else {
    checks.push({ status: 'ok', message: `Config geladen: ${paths.config()}` });
    const primary = config.data.llm?.primary;
    if (primary) {
      checks.push({ status: 'info', message: `  Provider: ${primary.provider}` });
      checks.push({ status: 'info', message: `  Modell:   ${primary.model}` });
      checks.push({ status: 'info', message: `  URL:      ${primary.baseUrl}` });
      if (primary.apiKey) {
        checks.push({ status: 'ok', message: '  API-Key ist gesetzt' });
      } else {
        const providerInfo = PROVIDERS[primary.provider];
        if (providerInfo?.requiresKey) {
          checks.push({ status: 'error', message: '  API-Key fehlt! Setze mit "sparkcell config set apikey <key>"' });
          issues++;
        } else {
          checks.push({ status: 'dim', message: '  API-Key nicht nötig' });
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
          checks.push({ status: 'ok', message: 'LLM-Server erreichbar' });
        } else {
          checks.push({ status: 'warn', message: `LLM-Server antwortet mit Status ${response.status}` });
          issues++;
        }
      } catch {
        checks.push({ status: 'error', message: 'LLM-Server nicht erreichbar!' });
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
