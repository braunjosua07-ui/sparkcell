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
