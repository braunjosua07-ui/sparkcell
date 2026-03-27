// src/content/DocumentManager.js
import fs from 'node:fs/promises';
import path from 'node:path';
import paths from '../utils/paths.js';

export class DocumentManager {
  #startupName;
  #crossRefs = new Map();

  constructor(startupName) {
    this.#startupName = startupName;
  }

  #docsDir() {
    return path.join(paths.output(this.#startupName), 'docs');
  }

  async createDocument(agentId, filename, content) {
    const dir = this.#docsDir();
    await fs.mkdir(dir, { recursive: true });
    const header = `# ${filename.replace('.md', '')}\n\n_Created by ${agentId} at ${new Date().toISOString()}_\n\n`;
    await fs.writeFile(path.join(dir, filename), header + content);
  }

  async appendSection(agentId, filename, section, content) {
    const filePath = path.join(this.#docsDir(), filename);
    const sectionContent = `\n\n## ${section}\n\n_Updated by ${agentId}_\n\n${content}`;
    await fs.appendFile(filePath, sectionContent);
  }

  async getDocument(filename) {
    try {
      return await fs.readFile(path.join(this.#docsDir(), filename), 'utf8');
    } catch { return null; }
  }

  async listDocuments() {
    try {
      const entries = await fs.readdir(this.#docsDir());
      return entries.filter(f => f.endsWith('.md'));
    } catch { return []; }
  }

  addCrossReference(fromDoc, toDoc, description) {
    if (!this.#crossRefs.has(fromDoc)) this.#crossRefs.set(fromDoc, []);
    this.#crossRefs.get(fromDoc).push({ toDoc, description });
  }

  getCrossReferences(doc) {
    return this.#crossRefs.get(doc) || [];
  }
}
