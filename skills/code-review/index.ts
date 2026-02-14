import type { SkillContextCapabilities } from '../../electron/services/skill/SkillContext';

/**
 * Code Review skill
 * Performs automated code review on git diffs
 */
export default async function (
  inputs: { diff?: string; staged?: boolean; context?: string },
  context: SkillContextCapabilities,
  runContext: any
): Promise<{ diff: string; context?: string }> {
  context.log.info('Performing code review');

  try {
    let diff: string;

    // If diff is not provided, fetch it from git
    if (!inputs.diff) {
      context.log.debug('Fetching git diff');
      diff = await context.git.diff({ staged: inputs.staged || false });

      if (!diff || diff.trim().length === 0) {
        throw new Error('No changes detected. Make some changes or stage files first.');
      }
    } else {
      diff = inputs.diff;
    }

    // Get git status for additional context
    const status = await context.git.status();
    const filesChanged = [
      ...status.modified,
      ...status.added,
      ...status.deleted,
      ...status.staged
    ];

    context.log.debug(`Reviewing ${filesChanged.length} changed files`);

    // Try to gather additional context from project files
    let projectContext = inputs.context || '';

    // Check if there's a README or documentation
    try {
      const readmeExists = await context.fs.exists('README.md');
      if (readmeExists) {
        const readme = await context.fs.readFile('README.md');
        // Extract first few lines for context
        const lines = readme.split('\n').slice(0, 10);
        projectContext += `\n\nProject Info:\n${lines.join('\n')}`;
      }
    } catch (error) {
      context.log.debug('Could not read README:', error);
    }

    // Get current branch for context
    const branch = await context.git.branch();
    context.log.debug(`Reviewing changes on branch: ${branch}`);

    // Store review in memory for future reference
    await context.memory.write('lastReview', {
      timestamp: new Date().toISOString(),
      branch,
      filesChanged,
      diffLength: diff.length
    });

    return {
      diff,
      context: projectContext || undefined
    };
  } catch (error) {
    context.log.error('Code review failed:', error);
    throw error;
  }
}
