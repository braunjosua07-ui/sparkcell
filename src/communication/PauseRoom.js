/**
 * PauseRoom — Swarm Intelligence Hub
 *
 * Agents autonomously share insights after every task.
 * Before starting a new task, each agent reads what others discovered.
 * This creates emergent cross-agent learning without explicit coordination.
 *
 * Flow:
 *   Task completes → agent posts insight → enters pool
 *   Next task starts → agent reads unseen insights from others → injected into prompt
 */

const MAX_INSIGHTS = 150;  // global cap — oldest evicted first
const MAX_INSIGHT_AGE_MS = 8 * 60 * 60 * 1000; // 8h — overnight window

export class PauseRoom {
  constructor() {
    /** @type {Map<string, {id: string, name: string, enteredAt: number}>} */
    this._present = new Map();

    /** @type {Array<{type: string, agentId: string, content: string, timestamp: number}>} */
    this._feed = [];

    /**
     * Insight pool — shared knowledge from all agents.
     * @type {Array<{
     *   id: string,
     *   agentId: string,
     *   agentName: string,
     *   role: string,
     *   taskTitle: string,
     *   insight: string,
     *   timestamp: number,
     *   seenBy: Set<string>
     * }>}
     */
    this._insights = [];

    this._insightCounter = 0;
  }

  // ─── Presence (kept for backward compat) ────────────────────────────────

  enter(agentId, agentName) {
    this._present.set(agentId, { id: agentId, name: agentName, enteredAt: Date.now() });
    this._feed.push({ type: 'presence', agentId, content: `${agentName} entered`, timestamp: Date.now() });
  }

  leave(agentId) {
    const agent = this._present.get(agentId);
    if (agent) {
      this._present.delete(agentId);
      this._feed.push({ type: 'presence', agentId, content: `${agent.name} left`, timestamp: Date.now() });
    }
  }

  addMessage(agentId, message) {
    this._feed.push({ type: 'message', agentId, content: message, timestamp: Date.now() });
  }

  addActivity(agentId, activity) {
    this._feed.push({ type: 'activity', agentId, content: activity, timestamp: Date.now() });
  }

  getPresent() { return [...this._present.keys()]; }

  getRecentActivity(limit = 10) { return this._feed.slice(-limit); }

  // ─── Swarm Intelligence ──────────────────────────────────────────────────

  /**
   * Post an insight after completing a task.
   * Extracts the most useful snippet from the task output.
   *
   * @param {string} agentId
   * @param {string} agentName
   * @param {string} role
   * @param {string} taskTitle
   * @param {string} output  - full task output
   */
  postInsight(agentId, agentName, role, taskTitle, output) {
    if (!output || output.trim().length < 20) return;

    // Extract the most useful part of the output as the insight.
    // Priority: first meaningful paragraph or bullet point.
    const insight = extractInsight(output);
    if (!insight) return;

    const entry = {
      id: `insight-${++this._insightCounter}`,
      agentId,
      agentName,
      role,
      taskTitle,
      insight,
      timestamp: Date.now(),
      seenBy: new Set([agentId]), // poster has already "seen" their own insight
    };

    this._insights.push(entry);

    // Add to feed for TUI display
    this._feed.push({
      type: 'insight',
      agentId,
      agentName,
      content: `[${role}] ${taskTitle}: ${insight.slice(0, 100)}${insight.length > 100 ? '…' : ''}`,
      timestamp: Date.now(),
    });

    // Evict oldest if over cap
    if (this._insights.length > MAX_INSIGHTS) {
      this._insights.shift();
    }

    // Evict insights older than 8h
    const cutoff = Date.now() - MAX_INSIGHT_AGE_MS;
    this._insights = this._insights.filter(i => i.timestamp > cutoff);
  }

  /**
   * Get insights this agent hasn't seen yet, from OTHER agents.
   * Marks them as seen immediately.
   *
   * @param {string} agentId
   * @param {number} limit  - max insights to return (default 5)
   * @returns {Array<{agentName: string, role: string, taskTitle: string, insight: string}>}
   */
  getUnseenInsights(agentId, limit = 5) {
    const unseen = this._insights
      .filter(i => i.agentId !== agentId && !i.seenBy.has(agentId))
      .slice(-limit); // most recent first (already sorted by push order)

    // Mark as seen
    for (const entry of unseen) {
      entry.seenBy.add(agentId);
    }

    return unseen.map(i => ({
      agentName: i.agentName,
      role: i.role,
      taskTitle: i.taskTitle,
      insight: i.insight,
    }));
  }

  /**
   * Get all insights (for diagnostics / TUI display).
   */
  getAllInsights() {
    return this._insights.map(i => ({
      id: i.id,
      agentName: i.agentName,
      role: i.role,
      taskTitle: i.taskTitle,
      insight: i.insight,
      timestamp: i.timestamp,
      seenByCount: i.seenBy.size,
    }));
  }

  /**
   * Total number of insights in the pool.
   */
  get insightCount() {
    return this._insights.length;
  }
}

/**
 * Extract the most useful insight from a task output.
 * Prefers: explicit key findings, first substantive bullet, or first paragraph.
 */
function extractInsight(output) {
  const text = output.trim();

  // 1. Look for explicit markers the agent might write
  const keyFinding = text.match(/(?:Erkenntnis|Fazit|Wichtig|Key finding|Result|Ergebnis)[:\s]+([^\n]{20,200})/i);
  if (keyFinding) return keyFinding[1].trim();

  // 2. First bullet point with substance
  const bullet = text.match(/^[-•*]\s+(.{20,200})/m);
  if (bullet) return bullet[1].trim();

  // 3. First numbered item
  const numbered = text.match(/^[1-9]\.\s+(.{20,200})/m);
  if (numbered) return numbered[1].trim();

  // 4. First non-empty line with at least 30 chars
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 30);
  if (lines.length > 0) return lines[0].slice(0, 200);

  return null;
}
