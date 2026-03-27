import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TaskGenerator } from '../../src/core/TaskGenerator.js';

describe('TaskGenerator', () => {
  it('generates role-based tasks for known roles', () => {
    const gen = new TaskGenerator('agent-1', 'ceo');
    const tasks = gen.generate();
    assert.ok(tasks.length > 0);
    assert.ok(tasks.every(t => t.id && t.title && t.description && t.priority));
    assert.ok(tasks.some(t => t.source === 'role'));
  });

  it('falls back to default tasks for unknown roles', () => {
    const gen = new TaskGenerator('agent-1', 'wizard');
    const tasks = gen.generate();
    assert.ok(tasks.length > 0);
    assert.equal(tasks[0].title, 'Define responsibilities');
  });

  it('handles null role gracefully', () => {
    const gen = new TaskGenerator('agent-1', null);
    assert.equal(gen.role, 'generic');
    const tasks = gen.generate();
    assert.ok(tasks.length > 0);
  });

  it('skips completed tasks', () => {
    const gen = new TaskGenerator('agent-1', 'ceo');
    const first = gen.generate();
    const firstTitle = first[0].title;

    gen.markCompleted(firstTitle);
    const second = gen.generate();
    assert.ok(second.every(t => t.title !== firstTitle));
  });

  it('generates mission alignment tasks from context', () => {
    const gen = new TaskGenerator('agent-1', 'developer');
    const tasks = gen.generate({ missionGoals: ['Launch MVP by Q2'] });
    const missionTasks = tasks.filter(t => t.source === 'mission');
    assert.ok(missionTasks.length > 0);
    assert.ok(missionTasks[0].title.includes('Launch MVP by Q2'));
  });

  it('generates skill gap tasks from context', () => {
    const gen = new TaskGenerator('agent-1', 'designer');
    const tasks = gen.generate({ skillGaps: ['Figma', 'CSS Grid'] });
    const skillTasks = tasks.filter(t => t.source === 'skill-gap');
    assert.equal(skillTasks.length, 2);
    assert.ok(skillTasks[0].title.includes('Figma'));
  });

  it('limits mission tasks to 2', () => {
    const gen = new TaskGenerator('agent-1', 'cto');
    const tasks = gen.generate({
      missionGoals: ['Goal A', 'Goal B', 'Goal C', 'Goal D'],
    });
    const missionTasks = tasks.filter(t => t.source === 'mission');
    assert.ok(missionTasks.length <= 2);
  });

  it('cycles through role tasks without repeating', () => {
    const gen = new TaskGenerator('agent-1', 'ceo');
    const batch1 = gen.generate();
    batch1.forEach(t => gen.markCompleted(t.title));

    const batch2 = gen.generate();
    const titles1 = new Set(batch1.map(t => t.title));
    assert.ok(batch2.every(t => !titles1.has(t.title)));
  });

  it('assigns unique task IDs', () => {
    const gen = new TaskGenerator('agent-1', 'cfo');
    const tasks = gen.generate({ skillGaps: ['Excel'], missionGoals: ['Fundraise'] });
    const ids = tasks.map(t => t.id);
    assert.equal(ids.length, new Set(ids).size);
  });

  it('exposes agentId and role getters', () => {
    const gen = new TaskGenerator('agent-42', 'cmo');
    assert.equal(gen.agentId, 'agent-42');
    assert.equal(gen.role, 'cmo');
  });
});
