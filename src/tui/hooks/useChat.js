import { useState, useCallback } from 'react';

export function useChat(sparkCell) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);

    // Process through ChatInterpreter if available
    try {
      const { ChatInterpreter } = await import('../ChatInterpreter.js');
      const interpreter = new ChatInterpreter(sparkCell);
      const response = await interpreter.interpret(text);
      setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Command processed.', timestamp: Date.now() }]);
    }
  }, [sparkCell]);

  return { messages, inputValue, setInputValue, sendMessage };
}
