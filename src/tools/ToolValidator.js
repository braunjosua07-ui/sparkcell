import path from 'node:path';

export class ToolValidator {
  validateToolInterface(tool) {
    const errors = [];
    if (!tool.name || typeof tool.name !== 'string') errors.push('missing or invalid name');
    if (!tool.description || typeof tool.description !== 'string') errors.push('missing or invalid description');
    if (!tool.parameters || typeof tool.parameters !== 'object') errors.push('missing or invalid parameters');
    if (typeof tool.execute !== 'function') errors.push('missing execute function');
    if (!tool.permissionLevel || !['auto', 'ask', 'deny'].includes(tool.permissionLevel)) {
      errors.push('missing or invalid permissionLevel (must be auto|ask|deny)');
    }
    if (errors.length > 0) {
      throw new Error(`Invalid tool "${tool.name || 'unknown'}": ${errors.join(', ')}`);
    }
  }

  validateArgs(tool, args) {
    const errors = [];
    for (const [paramName, schema] of Object.entries(tool.parameters)) {
      const value = args[paramName];
      if (schema.required && (value === undefined || value === null)) {
        errors.push(`missing required parameter: ${paramName}`);
        continue;
      }
      if (value !== undefined && value !== null && schema.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== schema.type) {
          errors.push(`parameter "${paramName}" must be ${schema.type}, got ${actualType}`);
        }
      }
    }
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    // Apply defaults
    const resolved = { ...args };
    for (const [paramName, schema] of Object.entries(tool.parameters)) {
      if (resolved[paramName] === undefined && schema.default !== undefined) {
        resolved[paramName] = schema.default;
      }
    }
    return resolved;
  }

  isPathAllowed(filePath, context) {
    if (!context.workDir && !context.outputDir) return true;
    const resolved = path.resolve(filePath);
    const workDir = context.workDir ? path.resolve(context.workDir) : null;
    const outputDir = context.outputDir ? path.resolve(context.outputDir) : null;
    if (workDir && resolved.startsWith(workDir + path.sep)) return true;
    if (workDir && resolved === workDir) return true;
    if (outputDir && resolved.startsWith(outputDir + path.sep)) return true;
    if (outputDir && resolved === outputDir) return true;
    return false;
  }
}
