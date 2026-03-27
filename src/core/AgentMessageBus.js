/**
 * AgentMessageBus — Wraps an EventBus for agent-to-agent messaging with type-based subscriptions.
 *
 * Provides methods to send messages, request help, and subscribe to message types.
 * Uses the WorkerBus for event delivery.
 */

import { WorkerBus } from '../communication/WorkerBus.js';

/**
 * Unique message type constants.
 * @readonly
 * @enum {string}
 */
export const MESSAGE_TYPE = {
  MESSAGE: 'agent:message',
  HELP: 'agent:help',
  HELP_RESPONSE: 'agent:help-response',
};

/**
 * AgentMessageBus — Wraps an EventBus for agent-to-agent messaging.
 */
export class AgentMessageBus {
  #bus;
  #pendingMessages = new Map();
  #messageIdCounter = 0;

  /**
   * Create an AgentMessageBus.
   * @param {WorkerBus} bus - The underlying EventBus instance
   */
  constructor(bus) {
    this.#bus = bus;
  }

  /**
   * Generate the next message ID.
   * @returns {string} Unique message ID in format "msg-{counter}-{timestamp}"
   */
  #nextMessageId() {
    this.#messageIdCounter++;
    return `msg-${this.#messageIdCounter}-${Date.now()}`;
  }

  /**
   * Send a message from one agent to another.
   * @param {string} fromAgentId - Sender agent ID
   * @param {string} toAgentId - Receiver agent ID (or 'all' for broadcast)
   * @param {string|Object} content - Message content
   * @param {Object} [options] - Additional options
   * @param {string} [options.type] - Message type (default: 'default')
   * @returns {string} The generated message ID
   */
  send(fromAgentId, toAgentId, content, options = {}) {
    const messageId = this.#nextMessageId();
    const message = {
      messageId,
      fromAgentId,
      toAgentId,
      content,
      timestamp: Date.now(),
      type: options.type || 'default',
    };

    this.#pendingMessages.set(messageId, message);
    this.#bus.publish(MESSAGE_TYPE.MESSAGE, message);

    return messageId;
  }

  /**
   * Request help from another agent.
   * @param {string} fromAgentId - Sender agent ID
   * @param {string} toAgentId - Receiver agent ID (or 'all' for broadcast)
   * @param {string} description - Help description
   * @param {Object} [options] - Additional options
   * @returns {string} The generated message ID
   */
  requestHelp(fromAgentId, toAgentId, description, options = {}) {
    const messageId = this.#nextMessageId();
    const message = {
      messageId,
      fromAgentId,
      toAgentId,
      content: {
        type: 'help',
        description,
        ...options,
      },
      timestamp: Date.now(),
      type: 'help',
    };

    this.#pendingMessages.set(messageId, message);
    this.#bus.publish(MESSAGE_TYPE.MESSAGE, message);

    return messageId;
  }

  /**
   * Respond to a help request.
   * @param {string} originalMessageId - ID of the original help message
   * @param {string|Object} response - Response content
   * @param {boolean} approved - Whether the response is approved
   * @param {string} fromAgentId - Responder agent ID
   * @param {string} [toAgentId] - Original sender ID (optional, defaults to original message sender)
   */
  respondToHelp(originalMessageId, response, approved, fromAgentId, toAgentId) {
    const responseEvent = {
      originalMessageId,
      fromAgentId,
      toAgentId,
      response,
      approved,
      timestamp: Date.now(),
    };

    this.#bus.publish(MESSAGE_TYPE.HELP_RESPONSE, responseEvent);
  }

  /**
   * Subscribe to all messages for a specific agent or all agents.
   * @param {string} agentId - Agent ID to subscribe to, or 'all' for all messages
   * @param {Function} handler - Called with (message) when a matching message is received
   * @returns {Function} Unsubscribe function
   */
  subscribeToMessages(agentId, handler) {
    return this.#bus.subscribe(MESSAGE_TYPE.MESSAGE, (data) => {
      if (data.toAgentId === agentId || data.toAgentId === 'all') {
        handler(data);
      }
    });
  }

  /**
   * Subscribe to help-type messages for a specific agent or all agents.
   * @param {string} agentId - Agent ID to subscribe to, or 'all' for all help requests
   * @param {Function} handler - Called with (message) when a help message is received
   * @returns {Function} Unsubscribe function
   */
  subscribeToHelpRequests(agentId, handler) {
    return this.#bus.subscribe(MESSAGE_TYPE.MESSAGE, (data) => {
      if ((data.toAgentId === agentId || data.toAgentId === 'all') && data.type === 'help') {
        handler(data);
      }
    });
  }

  /**
   * Subscribe to help-response events for a specific agent or all agents.
   * @param {string} agentId - Agent ID to subscribe to, or 'all' for all help responses
   * @param {Function} handler - Called with (responseEvent) when a help response is received
   * @returns {Function} Unsubscribe function
   */
  subscribeToHelpResponses(agentId, handler) {
    return this.#bus.subscribe(MESSAGE_TYPE.HELP_RESPONSE, (data) => {
      if (data.toAgentId === agentId || data.toAgentId === 'all') {
        handler(data);
      }
    });
  }

  /**
   * Get statistics about pending messages.
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      pendingMessages: this.#pendingMessages.size,
      messageIdCounter: this.#messageIdCounter,
    };
  }
}
