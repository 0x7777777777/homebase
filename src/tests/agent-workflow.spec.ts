import { createNewsResearchWorkspace } from '../libs/agent-workflow/examples';
import { WorkflowEvent } from '../libs/agent-workflow';

describe('agent workflow engine', () => {
  it('runs the news research workflow and archives a file', async () => {
    const workspace = createNewsResearchWorkspace();
    const received: WorkflowEvent[] = [];

    const result = await workspace.workflow.run(
      {
        topic: 'Elon Musk',
        fileName: 'musk.md',
        instructions: 'Focus on recent announcements and actionable takeaways.'
      },
      (event) => received.push(event)
    );

    expect(Object.keys(result.state)).toEqual(['research', 'synthesize', 'archive']);
    expect(received.filter((event) => event.type === 'step:end').map((event) => event.stepId)).toEqual([
      'research',
      'synthesize',
      'archive'
    ]);

    const file = workspace.fileTool.read('musk.md');
    expect(file).toBeDefined();
    expect(file?.content).toContain('# Elon Musk Update');
    expect(file?.content.toLowerCase()).toContain('action plan');
  });
});
