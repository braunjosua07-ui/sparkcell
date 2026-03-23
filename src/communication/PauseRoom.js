/**
 * PauseRoom — Social dynamics hub for agents during pause periods.
 *
 * Tracks who is present, chat messages, and cross-pollination activities.
 */
export class PauseRoom {
  constructor() {
    /** @type {Map<string, {id: string, name: string, enteredAt: number}>} */
    this._present = new Map();

    /** @type {Array<{type: string, agentId: string, content: string, timestamp: number}>} */
    this._feed = [];
  }

  /**
   * Agent joins the pause room.
   * @param {string} agentId
   * @param {string} agentName
   */
  enter(agentId, agentName) {
    this._present.set(agentId, { id: agentId, name: agentName, enteredAt: Date.now() });
    this._feed.push({
      type: 'presence',
      agentId,
      content: `${agentName} entered the pause room`,
      timestamp: Date.now(),
    });
  }

  /**
   * Agent leaves the pause room.
   * @param {string} agentId
   */
  leave(agentId) {
    const agent = this._present.get(agentId);
    if (agent) {
      this._present.delete(agentId);
      this._feed.push({
        type: 'presence',
        agentId,
        content: `${agent.name} left the pause room`,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Record a social chat message from an agent.
   * @param {string} agentId
   * @param {string} message
   */
  addMessage(agentId, message) {
    this._feed.push({
      type: 'message',
      agentId,
      content: message,
      timestamp: Date.now(),
    });
  }

  /**
   * Record a skill-sharing / cross-pollination activity.
   * @param {string} agentId
   * @param {string} activity
   */
  addActivity(agentId, activity) {
    this._feed.push({
      type: 'activity',
      agentId,
      content: activity,
      timestamp: Date.now(),
    });
  }

  /**
   * Get agent IDs currently in the pause room.
   * @returns {string[]}
   */
  getPresent() {
    return [...this._present.keys()];
  }

  /**
   * Get the most recent feed entries (messages + activities).
   * @param {number} limit
   * @returns {Array}
   */
  getRecentActivity(limit = 10) {
    return this._feed.slice(-limit);
  }
}
