import { useState, useEffect } from 'react';

export function useToolStatus(bus, toolRunner, maxEntries = 50) {
  const [actions, setActions] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  useEffect(() => {
    if (!bus) return;

    const addAction = (data) => {
      setActions(prev => {
        const next = [...prev, { ...data, timestamp: Date.now() }];
        return next.length > maxEntries ? next.slice(-maxEntries) : next;
      });
    };

    const unsubs = [
      bus.subscribe('tool:executed', (data) => {
        addAction({ type: 'executed', ...data });
      }),
      bus.subscribe('tool:created', (data) => {
        addAction({ type: 'created', ...data });
      }),
      bus.subscribe('tool:failed', (data) => {
        addAction({ type: 'failed', ...data });
      }),
      bus.subscribe('tool:disabled', (data) => {
        addAction({ type: 'disabled', ...data });
      }),
      bus.subscribe('tool:permission-requested', (data) => {
        setPendingApprovals(prev => [...prev, { ...data, timestamp: Date.now() }]);
      }),
      bus.subscribe('tool:permission-granted', (data) => {
        setPendingApprovals(prev => prev.filter(p =>
          `${p.agentId}:${p.toolName}` !== data.actionKey
        ));
      }),
    ];

    return () => unsubs.forEach(u => u());
  }, [bus]);

  const toolCount = toolRunner?.getToolCount?.() || { total: 0, core: 0, custom: 0 };

  return { actions, pendingApprovals, toolCount };
}
