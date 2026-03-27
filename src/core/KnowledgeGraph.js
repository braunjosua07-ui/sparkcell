// src/core/KnowledgeGraph.js

export class KnowledgeGraph {
  #entities  = new Map(); // name → { type, metadata }
  #relations = new Map(); // name → [{ entity, relation }]

  /**
   * Add or overwrite an entity.
   * @param {string} name
   * @param {string} type
   * @param {object} metadata
   */
  addEntity(name, type, metadata = {}) {
    this.#entities.set(name, { type, metadata });
    if (!this.#relations.has(name)) {
      this.#relations.set(name, []);
    }
  }

  /**
   * Retrieve an entity by name, or null if not found.
   */
  getEntity(name) {
    return this.#entities.get(name) ?? null;
  }

  /**
   * Add a directed edge from → to.
   * Auto-creates nodes if they don't exist.
   * @param {string} from
   * @param {string} to
   * @param {string} relation
   */
  addRelation(from, to, relation) {
    if (!this.#entities.has(from)) this.addEntity(from, 'unknown');
    if (!this.#entities.has(to))   this.addEntity(to,   'unknown');

    const edges = this.#relations.get(from);
    // Avoid duplicate edges
    if (!edges.some(e => e.entity === to && e.relation === relation)) {
      edges.push({ entity: to, relation });
    }
  }

  /**
   * BFS traversal starting from `name` up to `depth` hops.
   * Returns array of { entity, relation, depth } (excludes the start node).
   * @param {string} name
   * @param {number} depth
   * @returns {{ entity: string, relation: string, depth: number }[]}
   */
  getRelated(name, depth = 1) {
    const visited = new Set([name]);
    const result  = [];
    // queue entries: [entityName, currentDepth]
    let queue = [[name, 0]];

    while (queue.length > 0) {
      const next = [];
      for (const [current, currentDepth] of queue) {
        if (currentDepth >= depth) continue;
        const edges = this.#relations.get(current) ?? [];
        for (const edge of edges) {
          if (!visited.has(edge.entity)) {
            visited.add(edge.entity);
            result.push({ entity: edge.entity, relation: edge.relation, depth: currentDepth + 1 });
            next.push([edge.entity, currentDepth + 1]);
          }
        }
      }
      queue = next;
    }

    return result;
  }
}
