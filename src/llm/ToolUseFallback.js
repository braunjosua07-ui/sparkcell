let callIdCounter = 0;

export function injectToolsAsText(messages, tools) {
  if (!tools || tools.length === 0) return messages;

  const toolDescriptions = tools.map(t => {
    const fn = t.function || t;
    const params = fn.parameters?.properties
      ? Object.entries(fn.parameters.properties).map(([name, schema]) => `${name}: ${schema.type}`).join(', ')
      : '';
    return `- ${fn.name || t.name}(${params}): ${fn.description || t.description}`;
  }).join('\n');

  const instruction = [
    'Available tools:',
    toolDescriptions,
    '',
    'To use a tool, respond with: [TOOL: toolName({"param": "value"})]',
    'You can use multiple tools. Each tool call must be on its own line.',
    'After using tools, you will receive the results and can continue.',
  ].join('\n');

  // Inject into first system message or prepend one
  const result = [...messages];
  const sysIdx = result.findIndex(m => m.role === 'system');
  if (sysIdx >= 0) {
    result[sysIdx] = {
      ...result[sysIdx],
      content: result[sysIdx].content + '\n\n' + instruction,
    };
  } else {
    result.unshift({ role: 'system', content: instruction });
  }
  return result;
}

export function parseToolCallsFromText(content) {
  const regex = /\[TOOL:\s*(\w+)\((\{.*?\})\)\]/g;
  const toolCalls = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const args = JSON.parse(match[2]);
      toolCalls.push({
        id: `text-call-${++callIdCounter}`,
        name: match[1],
        args,
      });
    } catch {
      // Skip malformed tool calls
    }
  }
  const cleanContent = content.replace(regex, '').trim();
  return { cleanContent, toolCalls };
}
