import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ToolValidator } from '../../src/tools/ToolValidator.js';

describe('ToolValidator — validateToolInterface', () => {
  const validator = new ToolValidator();

  const validTool = {
    name: 'readFile',
    description: 'Read a file',
    parameters: { path: { type: 'string', required: true, description: 'File path' } },
    permissionLevel: 'auto',
    execute: async () => ({ success: true, output: '' }),
  };

  it('accepts a valid tool', () => {
    assert.doesNotThrow(() => validator.validateToolInterface(validTool));
  });

  it('rejects tool without name', () => {
    assert.throws(() => validator.validateToolInterface({ ...validTool, name: '' }), /invalid name/);
  });

  it('rejects tool without execute function', () => {
    assert.throws(() => validator.validateToolInterface({ ...validTool, execute: 'not-a-fn' }), /missing execute/);
  });

  it('rejects tool with invalid permissionLevel', () => {
    assert.throws(() => validator.validateToolInterface({ ...validTool, permissionLevel: 'yolo' }), /invalid permissionLevel/);
  });
});

describe('ToolValidator — validateArgs', () => {
  const validator = new ToolValidator();
  const tool = {
    name: 'test',
    parameters: {
      path: { type: 'string', required: true, description: 'Path' },
      limit: { type: 'number', required: false, description: 'Limit', default: 100 },
    },
  };

  it('passes with valid required args', () => {
    const result = validator.validateArgs(tool, { path: '/tmp/test' });
    assert.equal(result.path, '/tmp/test');
  });

  it('applies defaults for missing optional args', () => {
    const result = validator.validateArgs(tool, { path: '/tmp/test' });
    assert.equal(result.limit, 100);
  });

  it('rejects missing required args', () => {
    assert.throws(() => validator.validateArgs(tool, {}), /missing required parameter: path/);
  });

  it('rejects wrong type', () => {
    assert.throws(() => validator.validateArgs(tool, { path: 123 }), /must be string, got number/);
  });

  it('passes with correct optional args', () => {
    const result = validator.validateArgs(tool, { path: '/tmp/test', limit: 50 });
    assert.equal(result.limit, 50);
  });
});

describe('ToolValidator — isPathAllowed', () => {
  const validator = new ToolValidator();

  it('allows paths within workDir', () => {
    assert.ok(validator.isPathAllowed('/home/user/project/src/file.js', {
      workDir: '/home/user/project',
    }));
  });

  it('allows paths within outputDir', () => {
    assert.ok(validator.isPathAllowed('/home/user/output/result.txt', {
      workDir: '/home/user/project',
      outputDir: '/home/user/output',
    }));
  });

  it('denies paths outside workDir and outputDir', () => {
    assert.equal(validator.isPathAllowed('/etc/passwd', {
      workDir: '/home/user/project',
      outputDir: '/home/user/output',
    }), false);
  });

  it('denies path traversal', () => {
    assert.equal(validator.isPathAllowed('/home/user/project/../../../etc/passwd', {
      workDir: '/home/user/project',
    }), false);
  });

  it('allows when no workDir/outputDir set', () => {
    assert.ok(validator.isPathAllowed('/anywhere', {}));
  });

  it('allows workDir itself', () => {
    assert.ok(validator.isPathAllowed('/home/user/project', {
      workDir: '/home/user/project',
    }));
  });
});
