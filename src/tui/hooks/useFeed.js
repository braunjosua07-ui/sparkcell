import { useState, useEffect } from 'react';

// Module-level persistent store — survives component unmount/remount (tab switches).
// All subscribers share the same entries array.
const _store = {
  entries: [],
  listeners: new Set(),
  maxEntries: 100,

  add(entry) {
    this.entries = [...this.entries, entry];
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    for (const fn of this.listeners) fn(this.entries);
  },

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
};

let _busSubscribed = false;

function subscribeToBus(bus) {
  if (_busSubscribed || !bus) return;
  _busSubscribed = true;

  const addEntry = (type) => (data) => {
    _store.add({ type, ...data, timestamp: Date.now() });
  };

  bus.subscribe('agent:state-change',            addEntry('state-change'));
  bus.subscribe('agent:task-started',            addEntry('task-started'));
  bus.subscribe('agent:task-completed',          addEntry('task-completed'));
  bus.subscribe('agent:thinking',                addEntry('thinking'));
  bus.subscribe('agent:output',                  addEntry('output'));
  bus.subscribe('agent:error',                   addEntry('error'));
  bus.subscribe('agent:energy-low',              addEntry('energy-low'));
  bus.subscribe('whiteboard:blocker-added',      addEntry('blocker-added'));
  bus.subscribe('whiteboard:decision-added',     addEntry('decision-added'));
  bus.subscribe('agent:skill-evaluation',        addEntry('skill-evaluation'));
  bus.subscribe('agent:chat-response',           addEntry('chat-response'));
  bus.subscribe('tool:executed',                 addEntry('tool-executed'));
  bus.subscribe('tool:created',                  addEntry('tool-created'));
  bus.subscribe('tool:failed',                   addEntry('tool-failed'));
  bus.subscribe('tool:permission-requested',     addEntry('tool-permission-requested'));
  bus.subscribe('tool:permission-granted',       addEntry('tool-permission-granted'));
  bus.subscribe('agent:notification',            addEntry('notification'));
  bus.subscribe('comm:email-sent',               addEntry('email-sent'));
  bus.subscribe('comm:slack-sent',               addEntry('slack-sent'));
  bus.subscribe('comm:discord-sent',             addEntry('discord-sent'));
  bus.subscribe('mcp:server-connected',          addEntry('mcp-server-connected'));
  bus.subscribe('credential:input-requested',    addEntry('credential-input-requested'));
  bus.subscribe('agent:protection-violation',    addEntry('protection-violation'));
  bus.subscribe('agent:token',                   addEntry('token'));
}

export function useFeed(bus, maxEntries = 100) {
  _store.maxEntries = maxEntries;

  // Subscribe to bus once globally (not per component)
  subscribeToBus(bus);

  // Local state initialized from the persistent store
  const [entries, setEntries] = useState(_store.entries);

  useEffect(() => {
    // Sync immediately in case entries changed while unmounted
    setEntries(_store.entries);
    // Subscribe to future updates
    return _store.subscribe(setEntries);
  }, []);

  return entries;
}
