import React, { useState } from 'react';
import { Box, Text } from 'ink';

export function WizardScreen({ title, steps, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState({});

  const step = steps?.[currentStep];
  if (!step) {
    return React.createElement(Box, { padding: 1 },
      React.createElement(Text, null, 'Wizard complete!')
    );
  }

  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    React.createElement(Box, { borderStyle: 'double', borderColor: 'cyan', paddingX: 2, paddingY: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, title || 'Setup Wizard')
    ),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { dimColor: true }, `Step ${currentStep + 1} of ${steps.length}`)
    ),
    React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
      React.createElement(Text, { bold: true }, step.title || ''),
      React.createElement(Text, null, step.description || '')
    ),
    step.options && React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
      ...step.options.map((opt, i) =>
        React.createElement(Text, { key: i }, `  ${i + 1}. ${opt.label}`)
      )
    )
  );
}
