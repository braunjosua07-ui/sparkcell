import { useState, useEffect } from 'react';

export function useFeed(bus, maxEntries = 100) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!bus) return;
    const addEntry = (type) => (data) => {
      setEntries(prev => {
        const next = [...prev, { type, ...data, timestamp: Date.now() }];
        return next.length > maxEntries ? next.slice(-maxEntries) : next;
      });
    };
    const unsubs = [
      bus.subscribe('agent:state-change', addEntry('state-change')),
      bus.subscribe('agent:task-started', addEntry('task-started')),
      bus.subscribe('agent:task-completed', addEntry('task-completed')),
      bus.subscribe('agent:thinking', addEntry('thinking')),
      bus.subscribe('agent:output', addEntry('output')),
      bus.subscribe('agent:error', addEntry('error')),
      bus.subscribe('agent:energy-low', addEntry('energy-low')),
      bus.subscribe('whiteboard:blocker-added', addEntry('blocker-added')),
      bus.subscribe('whiteboard:decision-added', addEntry('decision-added')),
      bus.subscribe('agent:skill-evaluation', addEntry('skill-evaluation')),
      bus.subscribe('agent:chat-response', addEntry('chat-response')),
    ];
    return () => unsubs.forEach(u => u());
  }, [bus]);

  return entries;
}
