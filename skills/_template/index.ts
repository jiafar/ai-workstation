import type { SkillContextCapabilities } from '../../electron/services/skill/SkillContext';

/**
 * Template skill script
 *
 * @param inputs - Input values as defined in skill.json
 * @param context - Skill execution context with capabilities (ai, fs, memory, etc.)
 * @param runContext - Runtime context (projectPath, userId, etc.)
 * @returns Output values as defined in skill.json
 */
export default async function (
  inputs: { input1: string },
  context: SkillContextCapabilities,
  runContext: any
): Promise<{ result: string }> {
  // Log execution
  context.log.info(`Executing my-skill with input: ${inputs.input1}`);

  try {
    // Example: Read from memory
    const previousRun = await context.memory.read('lastRun');
    context.log.debug('Previous run:', previousRun);

    // Example: Use AI
    const aiResponse = await context.ai.complete(
      `Process this input: ${inputs.input1}`,
      { temperature: 0.7 }
    );

    // Example: Save to memory
    await context.memory.write('lastRun', {
      timestamp: new Date().toISOString(),
      input: inputs.input1,
      output: aiResponse
    });

    // Example: File system operations
    // const files = await context.fs.readDir('.');
    // context.log.info('Files:', files);

    // Example: Git operations
    // const branch = await context.git.branch();
    // context.log.info('Current branch:', branch);

    // Return outputs
    return {
      result: aiResponse
    };
  } catch (error) {
    context.log.error('Skill execution failed:', error);
    throw error;
  }
}
