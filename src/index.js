// src/index.js
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import paths from './utils/paths.js';
import { Agent } from './core/Agent.js';
import { WorkerBus } from './communication/WorkerBus.js';
import { CommitmentProtocol } from './communication/CommitmentProtocol.js';
import { SharedWhiteboard } from './communication/SharedWhiteboard.js';
import { PauseRoom } from './communication/PauseRoom.js';
import { FileLock } from './utils/FileLock.js';
import { Logger } from './utils/Logger.js';
import { ErrorHandler } from './utils/ErrorHandler.js';
import { LLMManager } from './llm/LLMManager.js';

export class SparkCell extends EventEmitter {
  #startupName;
  #agents = new Map();
  #bus;
  #protocol;
  #whiteboard;
  #pauseRoom;
  #logger;
  #errorHandler;
  #fileLock;
  #intervals = [];
  #running = false;
  #paused = false;
  #startTime;
  #config;

  constructor(startupName, config = {}) {
    super();
    this.#startupName = startupName;
    this.#config = config;
    this.#bus = new WorkerBus();
    this.#protocol = new CommitmentProtocol();
    this.#whiteboard = new SharedWhiteboard();
    this.#pauseRoom = new PauseRoom();
    this.#fileLock = new FileLock();
    this.#logger = new Logger(paths.startupLogs(startupName));
    this.#errorHandler = new ErrorHandler(this.#logger);

    // Create LLM from global config
    if (config.llm) {
      this.llm = new LLMManager(config.llm);
    } else {
      this.llm = null;
    }
  }

  get startupName() { return this.#startupName; }
  get agents() { return [...this.#agents.values()]; }
  get bus() { return this.#bus; }
  get protocol() { return this.#protocol; }
  get whiteboard() { return this.#whiteboard; }
  get pauseRoom() { return this.#pauseRoom; }
  get isRunning() { return this.#running; }
  get isPaused() { return this.#paused; }
  get uptime() { return this.#startTime ? Date.now() - this.#startTime : 0; }

  async initialize() {
    // Check for stale session lock
    const lockFile = path.join(paths.startup(this.#startupName), 'session.lock');
    try {
      const lockData = await fs.readFile(lockFile, 'utf8');
      const { pid } = JSON.parse(lockData);
      // Check if process is still running
      try { process.kill(pid, 0); throw new Error(`SparkCell already running (PID ${pid})`); }
      catch (e) {
        if (e.message.includes('already running')) throw e;
        // Stale lock — previous process died
        this.#logger.warn('Stale session lock found, recovering');
        await fs.unlink(lockFile);
      }
    } catch (e) {
      if (e.message.includes('already running')) throw e;
      // No lock file — clean start
    }

    // Initialize logger
    await this.#logger.initialize();

    // Load startup config
    const startupDir = paths.startup(this.#startupName);
    const configPath = path.join(startupDir, 'startup.json');
    let startupConfig;
    try {
      startupConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
    } catch {
      throw new Error(`Startup config not found: ${configPath}`);
    }

    // Phase 2: Load whiteboard state if it exists, set mission + goals
    const wbPath = path.join(paths.shared(this.#startupName), 'whiteboard.json');
    try {
      await this.#whiteboard.load(wbPath);
      this.#logger.info('Whiteboard state loaded');
    } catch {
      // No saved state — initialize from startup config
      if (startupConfig.mission) {
        this.#whiteboard.setMission(startupConfig.mission);
      } else if (startupConfig.description) {
        this.#whiteboard.setMission(startupConfig.description);
      }
      for (const goal of (startupConfig.goals || [])) {
        this.#whiteboard.addGoal(goal);
      }
    }

    // Create agents from config
    for (const agentConfig of (startupConfig.agents || [])) {
      if (agentConfig.active === false) continue;
      const agent = new Agent(agentConfig.id, {
        name: agentConfig.name,
        role: agentConfig.role,
        skills: agentConfig.skills || [],
        bus: this.#bus,
        llm: this.llm,
        outputDir: paths.output(this.#startupName),
        startupDescription: startupConfig.description || '',
        whiteboard: this.#whiteboard,
        energyConfig: agentConfig.energy,
      });
      this.#agents.set(agentConfig.id, agent);
    }

    // Write session lock
    await fs.mkdir(startupDir, { recursive: true });
    await fs.writeFile(lockFile, JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      startup: this.#startupName,
    }));

    this.#logger.info(`Initialized ${this.#agents.size} agents for ${this.#startupName}`);
    this.emit('initialized', { agents: this.#agents.size });
  }

  async start() {
    if (this.#running) return;
    this.#running = true;
    this.#startTime = Date.now();

    // Start agent loops — cooperative scheduling via setInterval
    const tickRate = this.#config.tickRate || 5000; // 5 second default
    for (const agent of this.#agents.values()) {
      const interval = setInterval(async () => {
        if (this.#paused) return;
        await this.#errorHandler.safeAsync(
          () => agent.runLoop(),
          null,
          `agent:${agent.id}:runLoop`
        );
      }, tickRate);
      this.#intervals.push(interval);
    }

    // Setup signal handlers
    const shutdownHandler = async () => {
      await this.shutdown();
      process.exit(0);
    };
    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);

    // Phase 2: Forward whiteboard bus events to SparkCell emitter
    this.#bus.subscribe('whiteboard:*', (data) => {
      this.emit('whiteboard-event', data);
    });

    this.#logger.info(`Started ${this.#startupName} with ${this.#agents.size} agents`);
    this.emit('started', { agents: this.#agents.size, tickRate });
  }

  async shutdown() {
    if (!this.#running) return;
    this.#running = false;
    this.#logger.info('Shutting down...');

    // 1. Stop all intervals
    for (const interval of this.#intervals) {
      clearInterval(interval);
    }
    this.#intervals = [];

    // 2. Save agent state
    for (const agent of this.#agents.values()) {
      await this.#errorHandler.safeAsync(
        () => agent.save(),
        null,
        `agent:${agent.id}:save`
      );
    }

    // 3. Save whiteboard
    const wbPath = path.join(paths.shared(this.#startupName), 'whiteboard.json');
    await this.#errorHandler.safeAsync(
      () => this.#whiteboard.save(wbPath),
      null,
      'whiteboard:save'
    );

    // 4. Remove session lock
    const lockFile = path.join(paths.startup(this.#startupName), 'session.lock');
    await this.#errorHandler.safeAsync(
      () => fs.unlink(lockFile),
      null,
      'session:unlock'
    );

    // 5. Release file locks
    await this.#fileLock.releaseAll();

    // 6. Flush logger
    await this.#logger.shutdown();

    this.emit('shutdown');
  }

  togglePause() {
    this.#paused = !this.#paused;
    const event = this.#paused ? 'paused' : 'resumed';
    this.emit(event);
    this.#logger.info(`Simulation ${event}`);

    if (this.#paused) {
      for (const agent of this.#agents.values()) {
        this.#pauseRoom.enter(agent.id, agent.name);
      }
    } else {
      for (const agent of this.#agents.values()) {
        this.#pauseRoom.leave(agent.id);
      }
    }
  }

  getAgent(id) {
    return this.#agents.get(id) || null;
  }

  getStatus() {
    return {
      startup: this.#startupName,
      running: this.#running,
      paused: this.#paused,
      uptime: this.uptime,
      agents: this.agents.map(a => a.getStatus()),
    };
  }
}
