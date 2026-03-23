// src/content/CodeGenerator.js
export class CodeGenerator {
  generate(language, type, context = {}) {
    const langGenerators = this.#generators[language];
    if (!langGenerators) return this.#unsupported(language, type, context);
    const generator = langGenerators[type];
    if (!generator) return this.#defaultCode(language, type, context);
    return generator(context);
  }

  #generators = {
    javascript: {
      component: (ctx) => [
        `// ${ctx.name || 'Component'}.js`,
        `export class ${ctx.name || 'Component'} {`,
        `  constructor(${ctx.params || ''}) {`,
        ctx.constructorBody ? `    ${ctx.constructorBody}` : `    // Initialize`,
        `  }`,
        ``,
        ...(ctx.methods || []).map(m => [
          `  ${m.name}(${m.params || ''}) {`,
          `    ${m.body || '// TODO: implement'}`,
          `  }`,
          ``,
        ].join('\n')),
        ...(!(ctx.methods || []).length ? [
          `  // Add methods here`,
          ``,
        ] : []),
        `}`,
      ].join('\n'),

      'api-endpoint': (ctx) => [
        `// ${ctx.name || 'endpoint'}.js`,
        `import express from 'express';`,
        ``,
        `const router = express.Router();`,
        ``,
        `router.${ctx.method || 'get'}('${ctx.path || '/'}', async (req, res) => {`,
        `  try {`,
        `    ${ctx.body || '// TODO: implement handler'}`,
        `    res.json({ success: true });`,
        `  } catch (err) {`,
        `    res.status(500).json({ error: err.message });`,
        `  }`,
        `});`,
        ``,
        `export default router;`,
      ].join('\n'),

      model: (ctx) => [
        `// ${ctx.name || 'Model'}.js`,
        `export class ${ctx.name || 'Model'} {`,
        `  #data;`,
        ``,
        `  constructor(data = {}) {`,
        `    this.#data = {`,
        ...(ctx.fields || ['id', 'createdAt', 'updatedAt']).map(f => `      ${f}: data.${f} ?? null,`),
        `    };`,
        `  }`,
        ``,
        `  toJSON() {`,
        `    return { ...this.#data };`,
        `  }`,
        ``,
        `  static fromJSON(data) {`,
        `    return new ${ctx.name || 'Model'}(data);`,
        `  }`,
        `}`,
      ].join('\n'),

      utility: (ctx) => [
        `// ${ctx.name || 'utils'}.js`,
        ``,
        ...(ctx.functions || [{ name: 'helper', params: 'value', body: 'return value;' }]).map(fn => [
          `export function ${fn.name}(${fn.params || ''}) {`,
          `  ${fn.body || '// TODO: implement'}`,
          `}`,
          ``,
        ].join('\n')),
      ].join('\n'),

      test: (ctx) => [
        `// ${ctx.name || 'module'}.test.js`,
        `import { describe, it } from 'node:test';`,
        `import assert from 'node:assert/strict';`,
        ``,
        `describe('${ctx.subject || ctx.name || 'Module'}', () => {`,
        ...(ctx.cases || [{ description: 'works correctly', body: 'assert.ok(true);' }]).map(tc => [
          `  it('${tc.description}', () => {`,
          `    ${tc.body || 'assert.ok(true);'}`,
          `  });`,
          ``,
        ].join('\n')),
        `});`,
      ].join('\n'),
    },

    python: {
      component: (ctx) => [
        `# ${ctx.name || 'component'}.py`,
        ``,
        `class ${ctx.name || 'Component'}:`,
        `    def __init__(self${ctx.params ? ', ' + ctx.params : ''}):`,
        ctx.constructorBody ? `        ${ctx.constructorBody}` : `        pass  # Initialize`,
        ``,
        ...(ctx.methods || []).map(m => [
          `    def ${m.name}(self${m.params ? ', ' + m.params : ''}):`,
          `        ${m.body || 'pass  # TODO: implement'}`,
          ``,
        ].join('\n')),
        ...(!(ctx.methods || []).length ? [
          `    # Add methods here`,
          ``,
        ] : []),
      ].join('\n'),

      'api-endpoint': (ctx) => [
        `# ${ctx.name || 'endpoint'}.py`,
        `from flask import Blueprint, jsonify, request`,
        ``,
        `bp = Blueprint('${ctx.name || 'api'}', __name__)`,
        ``,
        `@bp.route('${ctx.path || '/'}', methods=['${(ctx.method || 'GET').toUpperCase()}'])`,
        `def ${(ctx.name || 'handler').toLowerCase().replace(/-/g, '_')}():`,
        `    try:`,
        `        ${ctx.body || '# TODO: implement handler'}`,
        `        return jsonify({'success': True})`,
        `    except Exception as e:`,
        `        return jsonify({'error': str(e)}), 500`,
      ].join('\n'),

      model: (ctx) => [
        `# ${ctx.name || 'model'}.py`,
        `from dataclasses import dataclass, field`,
        `from typing import Optional`,
        ``,
        `@dataclass`,
        `class ${ctx.name || 'Model'}:`,
        ...(ctx.fields || ['id', 'created_at', 'updated_at']).map(f => `    ${f}: Optional[str] = None`),
        ``,
        `    def to_dict(self):`,
        `        return {k: v for k, v in self.__dict__.items()}`,
        ``,
        `    @classmethod`,
        `    def from_dict(cls, data: dict):`,
        `        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})`,
      ].join('\n'),

      utility: (ctx) => [
        `# ${ctx.name || 'utils'}.py`,
        ``,
        ...(ctx.functions || [{ name: 'helper', params: 'value', body: 'return value' }]).map(fn => [
          `def ${fn.name}(${fn.params || ''}):`,
          `    ${fn.body || '# TODO: implement'}`,
          ``,
        ].join('\n')),
      ].join('\n'),

      test: (ctx) => [
        `# test_${(ctx.name || 'module').toLowerCase()}.py`,
        `import unittest`,
        ``,
        `class Test${ctx.name || 'Module'}(unittest.TestCase):`,
        ...(ctx.cases || [{ description: 'test_works_correctly', body: 'self.assertTrue(True)' }]).map(tc => [
          `    def ${tc.description.replace(/\s+/g, '_')}(self):`,
          `        ${tc.body || 'self.assertTrue(True)'}`,
          ``,
        ].join('\n')),
        `if __name__ == '__main__':`,
        `    unittest.main()`,
      ].join('\n'),
    },

    html: {
      component: (ctx) => [
        `<!-- ${ctx.name || 'Component'} -->`,
        `<div class="${(ctx.name || 'component').toLowerCase().replace(/\s+/g, '-')}">`,
        `  <h2>${ctx.title || ctx.name || 'Component Title'}</h2>`,
        `  ${ctx.body || '<!-- Content here -->'}`,
        `</div>`,
      ].join('\n'),

      'api-endpoint': (ctx) => [
        `<!-- ${ctx.name || 'API'} Form -->`,
        `<form id="${(ctx.name || 'api').toLowerCase()}-form" action="${ctx.path || '/'}" method="${ctx.method || 'get'}">`,
        ...(ctx.fields || ['query']).map(f => [
          `  <label for="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}:</label>`,
          `  <input type="text" id="${f}" name="${f}" />`,
        ].join('\n')),
        `  <button type="submit">Submit</button>`,
        `</form>`,
      ].join('\n'),

      model: (ctx) => [
        `<!-- ${ctx.name || 'Model'} Template -->`,
        `<template id="${(ctx.name || 'model').toLowerCase()}-template">`,
        `  <article class="${(ctx.name || 'model').toLowerCase()}">`,
        ...(ctx.fields || ['id', 'title', 'description']).map(f => `    <p data-field="${f}"></p>`),
        `  </article>`,
        `</template>`,
      ].join('\n'),

      utility: (ctx) => [
        `<!-- ${ctx.name || 'Utility'} Snippet -->`,
        `<script>`,
        ...(ctx.functions || [{ name: 'helper', params: 'value', body: 'return value;' }]).map(fn => [
          `  function ${fn.name}(${fn.params || ''}) {`,
          `    ${fn.body || '// TODO: implement'}`,
          `  }`,
        ].join('\n')),
        `</script>`,
      ].join('\n'),

      test: (ctx) => [
        `<!-- ${ctx.name || 'Module'} Tests -->`,
        `<!DOCTYPE html>`,
        `<html>`,
        `<head><title>${ctx.name || 'Tests'}</title></head>`,
        `<body>`,
        `  <div id="test-results"></div>`,
        `  <script>`,
        `    const results = [];`,
        ...(ctx.cases || [{ description: 'works correctly', body: 'true' }]).map(tc => [
          `    results.push({ name: '${tc.description}', pass: !!( ${tc.body || 'true'} ) });`,
        ].join('\n')),
        `    document.getElementById('test-results').textContent = JSON.stringify(results, null, 2);`,
        `  </script>`,
        `</body>`,
        `</html>`,
      ].join('\n'),
    },

    css: {
      component: (ctx) => [
        `/* ${ctx.name || 'Component'} styles */`,
        `.${(ctx.name || 'component').toLowerCase().replace(/\s+/g, '-')} {`,
        `  display: ${ctx.display || 'block'};`,
        `  ${ctx.styles || '/* Add styles here */'}`,
        `}`,
        ``,
        `.${(ctx.name || 'component').toLowerCase().replace(/\s+/g, '-')}:hover {`,
        `  ${ctx.hoverStyles || '/* Add hover styles */'}`,
        `}`,
      ].join('\n'),

      'api-endpoint': (ctx) => [
        `/* ${ctx.name || 'API'} form styles */`,
        `form#${(ctx.name || 'api').toLowerCase()}-form {`,
        `  display: flex;`,
        `  flex-direction: column;`,
        `  gap: 1rem;`,
        `  max-width: ${ctx.maxWidth || '400px'};`,
        `  margin: 0 auto;`,
        `}`,
        ``,
        `form#${(ctx.name || 'api').toLowerCase()}-form input {`,
        `  padding: 0.5rem;`,
        `  border: 1px solid #ccc;`,
        `  border-radius: 4px;`,
        `}`,
        ``,
        `form#${(ctx.name || 'api').toLowerCase()}-form button {`,
        `  padding: 0.5rem 1rem;`,
        `  background: #007bff;`,
        `  color: white;`,
        `  border: none;`,
        `  border-radius: 4px;`,
        `  cursor: pointer;`,
        `}`,
      ].join('\n'),

      model: (ctx) => [
        `/* ${ctx.name || 'Model'} card styles */`,
        `.${(ctx.name || 'model').toLowerCase()} {`,
        `  border: 1px solid #e0e0e0;`,
        `  border-radius: 8px;`,
        `  padding: 1rem;`,
        `  margin-bottom: 1rem;`,
        `  background: #fff;`,
        `  box-shadow: 0 2px 4px rgba(0,0,0,0.1);`,
        `}`,
      ].join('\n'),

      utility: (ctx) => [
        `/* ${ctx.name || 'Utility'} styles */`,
        `/* Flexbox helpers */`,
        `.flex { display: flex; }`,
        `.flex-col { flex-direction: column; }`,
        `.items-center { align-items: center; }`,
        `.justify-center { justify-content: center; }`,
        ``,
        `/* Spacing helpers */`,
        `.m-0 { margin: 0; }`,
        `.p-0 { padding: 0; }`,
        `.mt-1 { margin-top: 0.25rem; }`,
        `.mb-1 { margin-bottom: 0.25rem; }`,
      ].join('\n'),

      test: (ctx) => [
        `/* ${ctx.name || 'Test'} visual test styles */`,
        `/* These styles help visually verify component rendering */`,
        `.test-pass { background: #d4edda; border: 1px solid #c3e6cb; }`,
        `.test-fail { background: #f8d7da; border: 1px solid #f5c6cb; }`,
        `.test-result { padding: 0.5rem; margin: 0.25rem 0; border-radius: 4px; }`,
      ].join('\n'),
    },

    sql: {
      component: (ctx) => [
        `-- ${ctx.name || 'Component'} view`,
        `CREATE OR REPLACE VIEW ${(ctx.name || 'component').toLowerCase().replace(/\s+/g, '_')}_view AS`,
        `SELECT`,
        `  ${(ctx.fields || ['id', 'created_at']).join(',\n  ')}`,
        `FROM ${ctx.table || (ctx.name || 'records').toLowerCase()}`,
        `${ctx.where ? 'WHERE ' + ctx.where : ''}`,
        `;`,
      ].join('\n'),

      'api-endpoint': (ctx) => [
        `-- ${ctx.name || 'Query'} for API endpoint`,
        `-- Method: ${ctx.method || 'GET'} ${ctx.path || '/'}`,
        `SELECT`,
        `  ${(ctx.fields || ['*']).join(',\n  ')}`,
        `FROM ${ctx.table || 'records'}`,
        `${ctx.where ? 'WHERE ' + ctx.where : ''}`,
        `${ctx.orderBy ? 'ORDER BY ' + ctx.orderBy : ''}`,
        `${ctx.limit ? 'LIMIT ' + ctx.limit : ''}`,
        `;`,
      ].join('\n'),

      model: (ctx) => [
        `-- ${ctx.name || 'Model'} table`,
        `CREATE TABLE IF NOT EXISTS ${(ctx.name || 'records').toLowerCase().replace(/\s+/g, '_')} (`,
        `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),`,
        ...(ctx.fields || []).map(f => typeof f === 'string'
          ? `  ${f} TEXT,`
          : `  ${f.name} ${f.type || 'TEXT'}${f.nullable === false ? ' NOT NULL' : ''},`),
        `  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),`,
        `  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
        `);`,
        ``,
        `CREATE INDEX IF NOT EXISTS idx_${(ctx.name || 'records').toLowerCase()}_created_at`,
        `  ON ${(ctx.name || 'records').toLowerCase()} (created_at DESC);`,
      ].join('\n'),

      utility: (ctx) => [
        `-- ${ctx.name || 'Utility'} stored procedure`,
        `CREATE OR REPLACE FUNCTION ${(ctx.name || 'helper').toLowerCase().replace(/\s+/g, '_')}(`,
        `  ${ctx.params || 'p_value TEXT'}`,
        `)`,
        `RETURNS ${ctx.returns || 'VOID'}`,
        `LANGUAGE plpgsql`,
        `AS $$`,
        `BEGIN`,
        `  ${ctx.body || '-- TODO: implement'}`,
        `END;`,
        `$$;`,
      ].join('\n'),

      test: (ctx) => [
        `-- ${ctx.name || 'Test'} queries`,
        `BEGIN;`,
        ``,
        ...(ctx.cases || [{ description: 'basic select works', body: 'SELECT 1 AS result;' }]).map(tc => [
          `-- Test: ${tc.description}`,
          tc.body || 'SELECT 1;',
          ``,
        ].join('\n')),
        `ROLLBACK;`,
      ].join('\n'),
    },
  };

  #unsupported(language, type, ctx) {
    return `// Unsupported language: ${language}\n// Type: ${type}\n// Context: ${JSON.stringify(ctx, null, 2)}`;
  }

  #defaultCode(language, type, ctx) {
    return `// ${language} — ${type}\n// Name: ${ctx.name || 'unnamed'}\n// TODO: implement`;
  }
}
