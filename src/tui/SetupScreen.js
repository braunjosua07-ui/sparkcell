import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { ModelDetector } from '../llm/ModelDetector.js';
import { PROVIDERS } from '../llm/ProviderRegistry.js';
import { GlobalConfig } from '../config/GlobalConfig.js';
import paths from '../utils/paths.js';

const STEPS = ['welcome', 'detect', 'provider', 'apikey', 'model', 'confirm', 'done'];

const PROVIDER_LIST = Object.entries(PROVIDERS)
  .filter(([id]) => id !== 'custom')
  .map(([id, info]) => ({ id, ...info }));

export function SetupScreen({ onComplete }) {
  const { exit } = useApp();
  const [step, setStep] = useState('welcome');
  const [detected, setDetected] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [provider, setProvider] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Auto-detect on mount
  useEffect(() => {
    if (step === 'detect') {
      setDetecting(true);
      const detector = new ModelDetector();
      detector.detect().then(results => {
        setDetected(results);
        setDetecting(false);
      }).catch(() => {
        setDetecting(false);
      });
    }
  }, [step]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') { exit(); return; }

    if (step === 'welcome') {
      if (key.return) setStep('detect');
      return;
    }

    if (step === 'detect') {
      if (!detecting && key.return) {
        setSelectedIdx(0);
        setStep('provider');
      }
      return;
    }

    if (step === 'provider') {
      const items = buildProviderItems();
      if (key.upArrow) setSelectedIdx(i => Math.max(0, i - 1));
      if (key.downArrow) setSelectedIdx(i => Math.min(items.length - 1, i + 1));
      if (key.return) {
        const chosen = items[selectedIdx];
        setProvider(chosen);
        if (chosen.models && chosen.models.length > 0) {
          setModelName(chosen.models[0]);
          setSelectedIdx(0);
          setStep('model');
        } else if (chosen.requiresKey) {
          setStep('apikey');
        } else {
          setModelName(chosen.defaultModel || 'default');
          setStep('confirm');
        }
      }
      return;
    }

    if (step === 'apikey') {
      if (key.return && apiKey.length > 0) {
        setModelName(provider.defaultModel || '');
        setStep('model');
        setSelectedIdx(0);
        return;
      }
      if (key.backspace || key.delete) {
        setApiKey(k => k.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setApiKey(k => k + input);
      }
      return;
    }

    if (step === 'model') {
      if (provider.models && provider.models.length > 0) {
        if (key.upArrow) setSelectedIdx(i => Math.max(0, i - 1));
        if (key.downArrow) setSelectedIdx(i => Math.min(provider.models.length - 1, i + 1));
        if (key.return) {
          setModelName(provider.models[selectedIdx]);
          setStep('confirm');
        }
      } else {
        if (key.return && modelName.length > 0) {
          setStep('confirm');
          return;
        }
        if (key.backspace || key.delete) {
          setModelName(m => m.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          setModelName(m => m + input);
        }
      }
      return;
    }

    if (step === 'confirm') {
      if (key.return) {
        saveConfig();
      }
      if (input === 'n') {
        setStep('provider');
        setSelectedIdx(0);
      }
      return;
    }

    if (step === 'done') {
      if (key.return) {
        if (onComplete) onComplete();
        else exit();
      }
      return;
    }
  });

  function buildProviderItems() {
    const items = [];
    // Detected local servers first
    for (const d of detected) {
      const providerInfo = PROVIDERS[d.name] || {};
      items.push({
        label: `${providerInfo.name || d.name} (detected - ${d.models.length} models)`,
        id: d.name,
        baseUrl: providerInfo.baseUrl || `http://localhost:${d.port}/v1`,
        requiresKey: false,
        models: d.models,
        isDetected: true,
      });
    }
    // Then all providers
    for (const p of PROVIDER_LIST) {
      const alreadyDetected = detected.some(d => d.name === p.id);
      if (alreadyDetected) continue;
      items.push({
        label: `${p.name}${p.requiresKey ? ' (API key required)' : ''}`,
        id: p.id,
        baseUrl: p.baseUrl,
        requiresKey: p.requiresKey,
        models: null,
        defaultModel: getDefaultModel(p.id),
      });
    }
    return items;
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const config = new GlobalConfig(paths.config());
      await config.load();
      const providerInfo = PROVIDERS[provider.id] || {};
      config.data = {
        ...config.data,
        version: 1,
        llm: {
          primary: {
            provider: provider.id,
            model: modelName,
            baseUrl: provider.baseUrl || providerInfo.baseUrl,
            ...(apiKey ? { apiKey } : {}),
          },
        },
      };
      await config.save();
      setStep('done');
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  // --- Render ---

  if (step === 'welcome') {
    return React.createElement(Box, { flexDirection: 'column', padding: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, '╔══════════════════════════════════════╗'),
      React.createElement(Text, { bold: true, color: 'cyan' }, '║         ⚡ SparkCell v2.0 ⚡         ║'),
      React.createElement(Text, { bold: true, color: 'cyan' }, '║   Multi-Agent Startup Simulator     ║'),
      React.createElement(Text, { bold: true, color: 'cyan' }, '╚══════════════════════════════════════╝'),
      React.createElement(Text, null, ''),
      React.createElement(Text, null, 'Willkommen! Lass uns dein LLM einrichten.'),
      React.createElement(Text, null, ''),
      React.createElement(Text, { dimColor: true }, 'Drücke ENTER zum Starten...'),
    );
  }

  if (step === 'detect') {
    return React.createElement(Box, { flexDirection: 'column', padding: 1 },
      React.createElement(Text, { bold: true, color: 'yellow' }, '🔍 Suche lokale LLM-Server...'),
      React.createElement(Text, null, ''),
      detecting
        ? React.createElement(Text, { dimColor: true }, 'Scanne Ports 11434, 1234, 8080...')
        : React.createElement(Box, { flexDirection: 'column' },
            detected.length > 0
              ? detected.map((d, i) =>
                  React.createElement(Text, { key: i, color: 'green' },
                    `  ✓ ${d.name} gefunden (Port ${d.port}) — ${d.models.length} Modelle`
                  )
                )
              : React.createElement(Text, { color: 'gray' }, '  Keine lokalen Server gefunden.'),
            React.createElement(Text, null, ''),
            React.createElement(Text, { dimColor: true }, 'Drücke ENTER um fortzufahren...'),
          ),
    );
  }

  if (step === 'provider') {
    const items = buildProviderItems();
    return React.createElement(Box, { flexDirection: 'column', padding: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, '📡 Wähle deinen LLM-Provider:'),
      React.createElement(Text, null, ''),
      ...items.map((item, i) =>
        React.createElement(Text, { key: i, color: i === selectedIdx ? 'cyan' : 'white' },
          `${i === selectedIdx ? '  ❯ ' : '    '}${item.label}`
        )
      ),
      React.createElement(Text, null, ''),
      React.createElement(Text, { dimColor: true }, '↑/↓ zum Wählen, ENTER zum Bestätigen'),
    );
  }

  if (step === 'apikey') {
    return React.createElement(Box, { flexDirection: 'column', padding: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, `🔑 API-Key für ${provider.label || provider.id}:`),
      React.createElement(Text, null, ''),
      React.createElement(Box, null,
        React.createElement(Text, null, '  Key: '),
        React.createElement(Text, { color: 'green' }, apiKey.length > 0 ? '*'.repeat(apiKey.length) : ''),
        React.createElement(Text, { color: 'cyan' }, '█'),
      ),
      React.createElement(Text, null, ''),
      React.createElement(Text, { dimColor: true }, 'Tippe deinen API-Key ein, dann ENTER'),
    );
  }

  if (step === 'model') {
    if (provider.models && provider.models.length > 0) {
      return React.createElement(Box, { flexDirection: 'column', padding: 1 },
        React.createElement(Text, { bold: true, color: 'cyan' }, '🤖 Wähle ein Modell:'),
        React.createElement(Text, null, ''),
        ...provider.models.slice(0, 15).map((m, i) =>
          React.createElement(Text, { key: i, color: i === selectedIdx ? 'cyan' : 'white' },
            `${i === selectedIdx ? '  ❯ ' : '    '}${m}`
          )
        ),
        provider.models.length > 15
          ? React.createElement(Text, { dimColor: true }, `  ... und ${provider.models.length - 15} weitere`)
          : null,
        React.createElement(Text, null, ''),
        React.createElement(Text, { dimColor: true }, '↑/↓ zum Wählen, ENTER zum Bestätigen'),
      );
    }
    return React.createElement(Box, { flexDirection: 'column', padding: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, '🤖 Modellname eingeben:'),
      React.createElement(Text, null, ''),
      React.createElement(Text, { dimColor: true }, `  Beispiele: ${getSuggestedModels(provider.id)}`),
      React.createElement(Text, null, ''),
      React.createElement(Box, null,
        React.createElement(Text, null, '  Modell: '),
        React.createElement(Text, { color: 'green' }, modelName),
        React.createElement(Text, { color: 'cyan' }, '█'),
      ),
      React.createElement(Text, null, ''),
      React.createElement(Text, { dimColor: true }, 'Tippe den Modellnamen, dann ENTER'),
    );
  }

  if (step === 'confirm') {
    return React.createElement(Box, { flexDirection: 'column', padding: 1 },
      React.createElement(Text, { bold: true, color: 'green' }, '✅ Zusammenfassung:'),
      React.createElement(Text, null, ''),
      React.createElement(Text, null, `  Provider: ${provider.id}`),
      React.createElement(Text, null, `  Modell:   ${modelName}`),
      React.createElement(Text, null, `  URL:      ${provider.baseUrl}`),
      apiKey ? React.createElement(Text, null, `  API-Key:  ${'*'.repeat(8)}...`) : null,
      React.createElement(Text, null, ''),
      saving
        ? React.createElement(Text, { color: 'yellow' }, '  Speichere...')
        : React.createElement(Text, { dimColor: true }, 'ENTER zum Speichern, N zum Ändern'),
      error ? React.createElement(Text, { color: 'red' }, `  Fehler: ${error}`) : null,
    );
  }

  if (step === 'done') {
    return React.createElement(Box, { flexDirection: 'column', padding: 1 },
      React.createElement(Text, { bold: true, color: 'green' }, '🚀 Setup abgeschlossen!'),
      React.createElement(Text, null, ''),
      React.createElement(Text, null, `  Config gespeichert: ${paths.config()}`),
      React.createElement(Text, null, ''),
      React.createElement(Text, null, '  Nächste Schritte:'),
      React.createElement(Text, { color: 'cyan' }, '    sparkcell new     — Neues Startup erstellen'),
      React.createElement(Text, { color: 'cyan' }, '    sparkcell start   — Startup starten'),
      React.createElement(Text, null, ''),
      React.createElement(Text, { dimColor: true }, 'Drücke ENTER zum Beenden.'),
    );
  }

  return null;
}

function getDefaultModel(providerId) {
  const defaults = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-sonnet-4-20250514',
    groq: 'llama-3.1-8b-instant',
    together: 'meta-llama/Llama-3-8b-chat-hf',
    openrouter: 'meta-llama/llama-3.1-8b-instruct',
    deepseek: 'deepseek-chat',
    mistral: 'mistral-small-latest',
  };
  return defaults[providerId] || '';
}

function getSuggestedModels(providerId) {
  const suggestions = {
    openai: 'gpt-4o, gpt-4o-mini',
    anthropic: 'claude-sonnet-4-20250514, claude-haiku-4-5-20251001',
    groq: 'llama-3.1-8b-instant, mixtral-8x7b',
    together: 'meta-llama/Llama-3-8b-chat-hf',
    openrouter: 'meta-llama/llama-3.1-8b-instruct',
    deepseek: 'deepseek-chat, deepseek-coder',
    mistral: 'mistral-small-latest, mistral-large-latest',
  };
  return suggestions[providerId] || 'model-name';
}
