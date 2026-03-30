import { useState, useEffect } from 'react';

// Module-level persistent store for tool actions
const _toolStore = {
  actions: [],
  pendingApprovals: [],
  listeners: new Set(),
  maxEntries: 50,

  addAction(entry) {
    this.actions = [...this.actions, entry];
    if (this.actions.length > this.maxEntries) {
      this.actions = this.actions.slice(-this.maxEntries);
    }
    this._notify();
  },

  setPending(fn) {
    this.pendingApprovals = fn(this.pendingApprovals);
    this._notify();
  },

  _notify() {
    for (const fn of this.listeners) fn({ actions: this.actions, pendingApprovals: this.pendingApprovals });
  },

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
};

let _toolBusSubscribed = false;

function subscribeToolBus(bus) {
  if (_toolBusSubscribed || !bus) return;
  _toolBusSubscribed = true;

  bus.subscribe('tool:executed', (data) => _toolStore.addAction({ type: 'executed', ...data, timestamp: Date.now() }));
  bus.subscribe('tool:created',  (data) => _toolStore.addAction({ type: 'created',  ...data, timestamp: Date.now() }));
  bus.subscribe('tool:failed',   (data) => _toolStore.addAction({ type: 'failed',   ...data, timestamp: Date.now() }));
  bus.subscribe('tool:disabled', (data) => _toolStore.addAction({ type: 'disabled', ...data, timestamp: Date.now() }));
  bus.subscribe('tool:permission-requested', (data) => {
    _toolStore.setPending(prev => [...prev, { ...data, timestamp: Date.now() }]);
  });
  bus.subscribe('tool:permission-granted', (data) => {
    _toolStore.setPending(prev => prev.filter(p => `${p.agentId}:${p.toolName}` !== data.actionKey));
  });
}

export function useToolStatus(bus, toolRunner, maxEntries = 50) {
  _toolStore.maxEntries = maxEntries;
  subscribeToolBus(bus);

  const [state, setState] = useState({
    actions: _toolStore.actions,
    pendingApprovals: _toolStore.pendingApprovals,
  });

  useEffect(() => {
    // Sync immediately on mount
    setState({ actions: _toolStore.actions, pendingApprovals: _toolStore.pendingApprovals });
    return _toolStore.subscribe(setState);
  }, []);

  const toolCount = toolRunner?.getToolCount?.() || { total: 0, core: 0, custom: 0 };

  return { actions: state.actions, pendingApprovals: state.pendingApprovals, toolCount };
}
