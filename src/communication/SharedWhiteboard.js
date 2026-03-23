/**
 * SharedWhiteboard — Project-level coordination board.
 *
 * Sections: mission, decisions, blockers, goals.
 * Supports persistence via save(filePath) / load(filePath).
 */
import { readFile, writeFile } from 'node:fs/promises';

let _blockerId = 0;
let _decisionId = 0;
let _goalId = 0;

function nextId(prefix) {
  switch (prefix) {
    case 'b': return `b-${++_blockerId}`;
    case 'd': return `d-${++_decisionId}`;
    case 'g': return `g-${++_goalId}`;
    default:  return `${prefix}-${Date.now()}`;
  }
}

export class SharedWhiteboard {
  constructor() {
    this._state = {
      mission: null,
      decisions: [],
      blockers: [],
      goals: [],
    };
  }

  /**
   * Set or update the mission statement.
   * @param {string} text
   */
  setMission(text) {
    this._state.mission = text;
  }

  /**
   * Record a team decision.
   * @param {string} decision
   * @returns {string} Decision ID
   */
  addDecision(decision) {
    const id = nextId('d');
    this._state.decisions.push({ id, decision, recordedAt: Date.now() });
    return id;
  }

  /**
   * Record a blocker from an agent.
   * @param {string} agentId
   * @param {string} blocker
   * @returns {string} Blocker ID
   */
  addBlocker(agentId, blocker) {
    const id = nextId('b');
    this._state.blockers.push({ id, agentId, blocker, resolved: false, addedAt: Date.now() });
    return id;
  }

  /**
   * Mark a blocker as resolved.
   * @param {string} blockerId
   */
  resolveBlocker(blockerId) {
    const b = this._state.blockers.find((b) => b.id === blockerId);
    if (b) {
      b.resolved = true;
      b.resolvedAt = Date.now();
    }
  }

  /**
   * Add a project goal.
   * @param {string} goal
   * @returns {string} Goal ID
   */
  addGoal(goal) {
    const id = nextId('g');
    this._state.goals.push({ id, goal, addedAt: Date.now() });
    return id;
  }

  /**
   * Return the full whiteboard state.
   * @returns {Object}
   */
  getState() {
    return {
      mission: this._state.mission,
      decisions: [...this._state.decisions],
      blockers: [...this._state.blockers],
      goals: [...this._state.goals],
    };
  }

  /**
   * Persist whiteboard state to a JSON file.
   * @param {string} filePath
   */
  async save(filePath) {
    await writeFile(filePath, JSON.stringify(this._state, null, 2), 'utf8');
  }

  /**
   * Load whiteboard state from a JSON file.
   * @param {string} filePath
   */
  async load(filePath) {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    this._state = {
      mission: parsed.mission ?? null,
      decisions: parsed.decisions ?? [],
      blockers: parsed.blockers ?? [],
      goals: parsed.goals ?? [],
    };
  }
}
