// test/core/SkillManager.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SkillManager } from '../../src/core/SkillManager.js';

describe('SkillManager', () => {
  it('initializes with starting skills', () => {
    const sm = new SkillManager('agent-1', ['coding', 'design']);
    const skills = sm.getSkills();
    assert.ok(skills.has('coding'));
    assert.ok(skills.has('design'));
  });

  it('develops a skill through practice', () => {
    const sm = new SkillManager('agent-1', ['coding']);
    const before = sm.getLevel('coding');
    sm.practice('coding', 1.0);
    const after = sm.getLevel('coding');
    assert.ok(after > before);
  });

  it('calculates ROI for skill development', () => {
    const sm = new SkillManager('agent-1', ['coding', 'marketing']);
    sm.practice('coding', 5.0);
    const roi = sm.getROI('coding');
    assert.ok(typeof roi === 'number');
  });

  it('generates team skill matrix', () => {
    const sm1 = new SkillManager('a1', ['coding']);
    const sm2 = new SkillManager('a2', ['design']);
    sm1.practice('coding', 3.0);
    const matrix = SkillManager.teamMatrix([sm1, sm2]);
    assert.ok(matrix.skills.includes('coding'));
    assert.ok(matrix.skills.includes('design'));
  });
});

describe('SkillManager — Task Matching', () => {
  it('matches a coding task to the coding skill', () => {
    const sm = new SkillManager('dev', ['coding', 'design']);
    const match = sm.matchTaskToSkill({ title: 'Build MVP', description: 'Implement the core features' });
    assert.equal(match, 'coding');
  });

  it('matches a design task to the design skill', () => {
    const sm = new SkillManager('designer', ['design', 'coding']);
    const match = sm.matchTaskToSkill({ title: 'Create wireframes', description: 'Design low-fidelity wireframes for user flows' });
    assert.equal(match, 'design');
  });

  it('matches a strategy task to strategy skill', () => {
    const sm = new SkillManager('ceo', ['strategy', 'leadership']);
    const match = sm.matchTaskToSkill({ title: 'Define company vision', description: 'Write a clear vision and roadmap' });
    assert.equal(match, 'strategy');
  });

  it('returns null when no keywords match', () => {
    const sm = new SkillManager('agent', ['coding']);
    const match = sm.matchTaskToSkill({ title: 'Random unrelated thing', description: 'Nothing to match here' });
    assert.equal(match, null);
  });

  it('discovers skills outside the agent initial set', () => {
    const sm = new SkillManager('ceo', ['strategy']);
    // marketing keywords should still match even though agent doesn't have marketing skill
    const match = sm.matchTaskToSkill({ title: 'Launch social media campaign', description: 'Content marketing plan' });
    assert.equal(match, 'marketing');
  });
});

describe('SkillManager — Auto-learn from tasks', () => {
  it('practices the matched skill when learning from a task', () => {
    const sm = new SkillManager('dev', ['coding']);
    const before = sm.getLevel('coding');
    sm.learnFromTask({ title: 'Build REST API endpoints', description: 'Implement CRUD API' }, 0.5);
    const after = sm.getLevel('coding');
    assert.ok(after > before, 'Coding skill should increase after coding task');
  });

  it('auto-creates new skills when learning from unfamiliar tasks', () => {
    const sm = new SkillManager('ceo', ['strategy']);
    assert.equal(sm.getLevel('marketing'), 0, 'Should not have marketing skill yet');

    sm.learnFromTask({ title: 'Define marketing campaign', description: 'Social media content strategy' }, 0.3);
    assert.ok(sm.getLevel('marketing') > 0, 'Should now have marketing skill');
  });

  it('returns null and does not crash when task matches nothing', () => {
    const sm = new SkillManager('agent', ['coding']);
    const result = sm.learnFromTask({ title: 'Nap', description: 'Take a break' }, 0.1);
    assert.equal(result, null);
  });
});

describe('SkillManager — Gap Detection', () => {
  it('finds gaps when agent has no skill for a goal keyword', () => {
    const sm = new SkillManager('dev', ['coding']);
    const gaps = sm.findGaps(['Build marketing campaign and social media presence']);
    assert.ok(gaps.includes('marketing'), 'Should detect marketing as a gap');
  });

  it('does not flag high-level skills as gaps', () => {
    const sm = new SkillManager('dev', ['coding']);
    sm.practice('coding', 5.0); // level well above 20
    const gaps = sm.findGaps(['Build API and implement code']);
    assert.ok(!gaps.includes('coding'), 'High-level coding should not be a gap');
  });

  it('returns empty array when agent has all needed skills', () => {
    const sm = new SkillManager('ceo', ['strategy', 'leadership', 'writing']);
    sm.practice('strategy', 3.0);
    sm.practice('leadership', 3.0);
    sm.practice('writing', 3.0);
    const gaps = sm.findGaps(['Define vision and team strategy']);
    assert.equal(gaps.length, 0);
  });
});

describe('SkillManager — Skill Summary', () => {
  it('returns empty string for no skills', () => {
    const sm = new SkillManager('agent', []);
    assert.equal(sm.getSkillSummary(), '');
  });

  it('returns formatted skill summary sorted by level', () => {
    const sm = new SkillManager('dev', ['coding', 'design']);
    sm.practice('coding', 5.0);
    const summary = sm.getSkillSummary();
    assert.ok(summary.includes('coding'));
    assert.ok(summary.includes('design'));
    // coding should come first (higher level)
    assert.ok(summary.indexOf('coding') < summary.indexOf('design'));
  });
});
