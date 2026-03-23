import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StateMachine, STATES } from '../../src/core/StateMachine.js';

describe('StateMachine', () => {
  it('starts in IDLE state', () => {
    const sm = new StateMachine('agent-1');
    assert.equal(sm.currentState, STATES.IDLE);
  });

  it('transitions from IDLE to WORKING on taskAvailable', () => {
    const sm = new StateMachine('agent-1');
    const result = sm.transition('taskAvailable');
    assert.equal(result, true);
    assert.equal(sm.currentState, STATES.WORKING);
  });

  it('rejects invalid transitions', () => {
    const sm = new StateMachine('agent-1');
    const result = sm.transition('taskComplete');
    assert.equal(result, false);
    assert.equal(sm.currentState, STATES.IDLE);
  });

  it('tracks state history', () => {
    const sm = new StateMachine('agent-1');
    sm.transition('taskAvailable');
    sm.transition('energyLow');
    assert.equal(sm.history.length, 2);
    assert.equal(sm.history[0].from, STATES.IDLE);
    assert.equal(sm.history[0].to, STATES.WORKING);
  });

  it('emits state-change events', () => {
    const sm = new StateMachine('agent-1');
    let emitted = null;
    sm.on('state-change', (data) => { emitted = data; });
    sm.transition('taskAvailable');
    assert.ok(emitted);
    assert.equal(emitted.from, STATES.IDLE);
    assert.equal(emitted.to, STATES.WORKING);
  });

  it('supports transition callbacks', () => {
    const sm = new StateMachine('agent-1');
    let called = false;
    sm.onTransition(STATES.IDLE, STATES.WORKING, () => { called = true; });
    sm.transition('taskAvailable');
    assert.equal(called, true);
  });

  it('COMPLETE auto-transitions to IDLE', () => {
    const sm = new StateMachine('agent-1');
    sm.transition('taskAvailable');
    sm.transition('taskComplete');
    assert.equal(sm.currentState, STATES.COMPLETE);
    sm.transition('auto');
    assert.equal(sm.currentState, STATES.IDLE);
  });

  it('RESTED auto-transitions to IDLE', () => {
    const sm = new StateMachine('agent-1');
    sm.transition('taskAvailable');
    sm.transition('energyLow');
    sm.transition('energyRestored');
    assert.equal(sm.currentState, STATES.RESTED);
    sm.transition('auto');
    assert.equal(sm.currentState, STATES.IDLE);
  });

  it('BLOCKED transitions to HELP on timeout', () => {
    const sm = new StateMachine('agent-1');
    sm.transition('taskAvailable');
    sm.transition('blocked');
    sm.transition('timeout');
    assert.equal(sm.currentState, STATES.HELP);
  });
});
