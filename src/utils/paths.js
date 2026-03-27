// src/utils/paths.js
import os from 'node:os';
import path from 'node:path';

const SPARKCELL_HOME = process.env.SPARKCELL_HOME
  || path.join(os.homedir(), '.sparkcell');

export default {
  home:        () => SPARKCELL_HOME,
  config:      () => path.join(SPARKCELL_HOME, 'config.json'),
  startups:    () => path.join(SPARKCELL_HOME, 'startups'),
  startup:     (name) => path.join(SPARKCELL_HOME, 'startups', name),
  agents:      (startup) => path.join(SPARKCELL_HOME, 'startups', startup, 'agents'),
  agent:       (startup, agentId) => path.join(SPARKCELL_HOME, 'startups', startup, 'agents', agentId),
  output:      (startup) => path.join(SPARKCELL_HOME, 'startups', startup, 'output'),
  shared:      (startup) => path.join(SPARKCELL_HOME, 'startups', startup, 'shared'),
  logs:        () => path.join(SPARKCELL_HOME, 'logs'),
  startupLogs: (startup) => path.join(SPARKCELL_HOME, 'startups', startup, 'logs'),
};
