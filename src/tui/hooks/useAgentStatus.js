import { useState, useEffect } from 'react';

export function useAgentStatus(sparkCell) {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    if (!sparkCell) return;
    const update = () => {
      const status = sparkCell.getStatus?.();
      setAgents(status?.agents || []);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [sparkCell]);

  return agents;
}
