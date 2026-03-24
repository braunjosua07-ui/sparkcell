/**
 * SocialScheduleTool — Schedule a post for later.
 *
 * Stores the scheduled post in a JSON file. A background check in the
 * agent loop publishes posts when their scheduled time arrives.
 * Permission: auto (scheduling is not destructive).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

export default class SocialScheduleTool {
  name = 'socialSchedule';
  description = 'Schedule a social media post for a specific time. The post will be stored and published when the time arrives.';
  parameters = {
    platform: { type: 'string', required: true, description: 'Platform name (tiktok, twitter, instagram, etc.)' },
    content: { type: 'string', required: true, description: 'Post content' },
    scheduledTime: { type: 'string', required: true, description: 'ISO 8601 datetime when to publish (e.g., "2026-03-25T14:00:00Z")' },
    media: { type: 'string', required: false, description: 'Optional path to media file' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const { platform, content, scheduledTime, media } = args;

    // Validate scheduled time
    const time = new Date(scheduledTime);
    if (isNaN(time.getTime())) {
      return { success: false, output: null, error: `Invalid datetime: "${scheduledTime}". Use ISO 8601 format.` };
    }
    if (time.getTime() <= Date.now()) {
      return { success: false, output: null, error: 'Scheduled time must be in the future.' };
    }

    const scheduleEntry = {
      id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      platform: platform.toLowerCase(),
      content,
      media: media || null,
      scheduledTime: time.toISOString(),
      createdAt: new Date().toISOString(),
      createdBy: context.agentId,
      status: 'pending',
    };

    // Save to schedule file
    const scheduleDir = context.workDir || context.outputDir;
    if (!scheduleDir) {
      return { success: false, output: null, error: 'No work directory configured' };
    }

    const scheduleFile = path.join(scheduleDir, 'scheduled-posts.json');
    let schedule = [];
    try {
      schedule = JSON.parse(await fs.readFile(scheduleFile, 'utf8'));
    } catch {
      // No existing schedule
    }

    schedule.push(scheduleEntry);
    await fs.mkdir(path.dirname(scheduleFile), { recursive: true });
    await fs.writeFile(scheduleFile, JSON.stringify(schedule, null, 2));

    // Publish event
    if (context.bus) {
      context.bus.publish('social:scheduled', {
        agentId: context.agentId,
        agentName: context.agentName,
        platform: platform.toLowerCase(),
        scheduledTime: time.toISOString(),
        contentPreview: content.slice(0, 80),
      });
    }

    return {
      success: true,
      output: {
        id: scheduleEntry.id,
        platform: platform.toLowerCase(),
        scheduledTime: time.toISOString(),
        message: `Post scheduled for ${time.toISOString()} on ${platform}.`,
      },
    };
  }
}
