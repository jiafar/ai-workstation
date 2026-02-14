import type { SkillContextCapabilities } from '../../electron/services/skill/SkillContext';

/**
 * Git Commit Convention skill
 * Generates conventional commit messages from git diffs
 */
export default async function (
  inputs: { diff?: string; staged?: boolean },
  context: SkillContextCapabilities,
  runContext: any
): Promise<{ diff: string; result?: string }> {
  context.log.info('Generating conventional commit message');

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
    context.log.debug('Git status:', status);

    // Get recent commits to learn the project's commit style
    const recentCommits = await context.git.log({ limit: 5 });
    const commitHistory = recentCommits
      .map(c => c.message)
      .join('\n');

    // Store the diff for the prompt
    return { diff };
  } catch (error) {
    context.log.error('Failed to generate commit message:', error);
    throw error;
  }
}
