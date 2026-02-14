import type { SkillContextCapabilities } from '../../electron/services/skill/SkillContext';

/**
 * Work Log skill
 * Generates daily work logs from git history and memory
 */
export default async function (
  inputs: { date?: string; branch?: string; format?: string },
  context: SkillContextCapabilities,
  runContext: any
): Promise<{ date: string; branch: string; gitActivity: string; memoryContext: string; format: string; markdown: boolean; plain: boolean }> {
  context.log.info('Generating work log');

  try {
    // Determine date (default to today)
    const date = inputs.date || new Date().toISOString().split('T')[0];
    context.log.debug(`Generating work log for date: ${date}`);

    // Get current branch if not specified
    const branch = inputs.branch || await context.git.branch();
    context.log.debug(`Analyzing branch: ${branch}`);

    // Get git log for the date
    const allCommits = await context.git.log({ limit: 100 });

    // Filter commits by date
    const targetDate = new Date(date);
    const dateStr = targetDate.toISOString().split('T')[0];

    const dayCommits = allCommits.filter(commit => {
      const commitDate = new Date(commit.date).toISOString().split('T')[0];
      return commitDate === dateStr;
    });

    context.log.debug(`Found ${dayCommits.length} commits for ${date}`);

    if (dayCommits.length === 0) {
      throw new Error(`No commits found for date: ${date}`);
    }

    // Get detailed diff for each commit (simplified - in production you'd need proper git log with patches)
    let gitActivity = `## Commits (${dayCommits.length})\n\n`;

    for (const commit of dayCommits) {
      gitActivity += `### ${commit.message}\n`;
      gitActivity += `- **Author**: ${commit.author}\n`;
      gitActivity += `- **Time**: ${commit.date}\n`;
      gitActivity += `- **Hash**: ${commit.hash.substring(0, 8)}\n\n`;
    }

    // Try to get current diff for additional context
    try {
      const currentDiff = await context.git.diff();
      if (currentDiff) {
        gitActivity += `\n## Current Uncommitted Changes\n`;
        gitActivity += `\`\`\`diff\n${currentDiff.substring(0, 1000)}\`\`\`\n`;
      }
    } catch (error) {
      context.log.debug('No uncommitted changes');
    }

    // Get git status
    const status = await context.git.status();
    const totalFilesChanged = [
      ...status.modified,
      ...status.added,
      ...status.deleted
    ].length;

    gitActivity += `\n## Status\n`;
    gitActivity += `- Modified: ${status.modified.length}\n`;
    gitActivity += `- Added: ${status.added.length}\n`;
    gitActivity += `- Deleted: ${status.deleted.length}\n`;

    // Gather memory context
    let memoryContext = '';

    try {
      // Check for stored work items or notes
      const workItems = await context.memory.list('workItem:');
      if (workItems.length > 0) {
        memoryContext += `## Stored Work Items (${workItems.length})\n`;
        for (const key of workItems.slice(0, 5)) {
          const item = await context.memory.read(key);
          if (item) {
            memoryContext += `- ${key}: ${JSON.stringify(item)}\n`;
          }
        }
      }

      // Check for previous work logs
      const previousLogs = await context.memory.list('workLog:');
      if (previousLogs.length > 0) {
        memoryContext += `\n## Previous Work Logs: ${previousLogs.length}\n`;
      }

      // Store this work log generation in memory
      await context.memory.write(`workLog:${date}`, {
        date,
        branch,
        commits: dayCommits.length,
        filesChanged: totalFilesChanged,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      context.log.warn('Could not access memory context:', error);
      memoryContext = 'No memory context available';
    }

    if (!memoryContext) {
      memoryContext = 'No additional context available';
    }

    // Determine format flags
    const format = inputs.format || 'markdown';
    const markdown = format === 'markdown' || format === 'detailed';
    const plain = format === 'plain';

    return {
      date,
      branch,
      gitActivity,
      memoryContext,
      format,
      markdown,
      plain
    };
  } catch (error) {
    context.log.error('Work log generation failed:', error);
    throw error;
  }
}
