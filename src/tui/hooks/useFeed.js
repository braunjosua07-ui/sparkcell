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
      bus.subscribe('tool:executed', addEntry('tool-executed')),
      bus.subscribe('tool:created', addEntry('tool-created')),
      bus.subscribe('tool:failed', addEntry('tool-failed')),
      bus.subscribe('tool:permission-requested', addEntry('tool-permission-requested')),
      bus.subscribe('tool:permission-granted', addEntry('tool-permission-granted')),
      bus.subscribe('agent:notification', addEntry('notification')),
      bus.subscribe('comm:email-sent', addEntry('email-sent')),
      bus.subscribe('comm:slack-sent', addEntry('slack-sent')),
      bus.subscribe('comm:discord-sent', addEntry('discord-sent')),
    ];
    return () => unsubs.forEach(u => u());
  }, [bus]);

  return entries;
}
