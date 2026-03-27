/**
 * CommitmentProtocol — Inter-agent promise system.
 *
 * Lifecycle: pending → fulfilled | broken | expired
 * Deadline is stored in milliseconds (cycles * ms_per_cycle) for time-based expiry.
 */

const MS_PER_CYCLE = 60_000; // 1 minute per cycle

let _idCounter = 0;

function generateId() {
  return `commitment-${Date.now()}-${++_idCounter}`;
}

export class CommitmentProtocol {
  constructor() {
    /** @type {Map<string, Object>} */
    this._commitments = new Map();
  }

  /**
   * Create a new commitment.
   * @param {{from: string, to: string, action: string, deadline: number}} opts
   *   deadline — number of cycles until expiry
   * @returns {string} Unique commitment ID
   */
  create({ from, to, action, deadline }) {
    const id = generateId();
    this._commitments.set(id, {
      id,
      from,
      to,
      action,
      deadline,
      status: 'pending',
      createdAt: Date.now(),
    });
    return id;
  }

  /**
   * Retrieve a commitment by ID.
   * @param {string} id
   * @returns {Object|undefined}
   */
  get(id) {
    return this._commitments.get(id);
  }

  /**
   * Mark a commitment as fulfilled.
   * @param {string} id
   */
  fulfill(id) {
    const c = this._commitments.get(id);
    if (c) c.status = 'fulfilled';
  }

  /**
   * Mark a commitment as broken.
   * @param {string} id
   */
  break(id) {
    const c = this._commitments.get(id);
    if (c) c.status = 'broken';
  }

  /**
   * Get all pending commitments where from === agentId.
   * @param {string} agentId
   * @returns {Object[]}
   */
  getPendingFor(agentId) {
    return [...this._commitments.values()].filter(
      (c) => c.from === agentId && c.status === 'pending'
    );
  }

  /**
   * Get all pending commitments that have exceeded their deadline.
   * A commitment is overdue when (Date.now() - createdAt) > deadline * MS_PER_CYCLE.
   * @returns {Object[]}
   */
  getOverdue() {
    const now = Date.now();
    return [...this._commitments.values()].filter((c) => {
      if (c.status !== 'pending') return false;
      const deadlineMs = c.deadline * MS_PER_CYCLE;
      return now - c.createdAt > deadlineMs;
    });
  }
}
