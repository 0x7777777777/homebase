import { Agent } from './agent';
import { HeuristicLLM } from './llm';
import { StaticSearchDataset, StaticSearchTool, VirtualFileTool } from './tools';
import { WorkflowEngine } from './workflow';
import { WorkflowState } from './types';

export interface Workspace {
  workflow: WorkflowEngine;
  searchTool: StaticSearchTool;
  fileTool: VirtualFileTool;
  agents: Agent[];
}

const DATASET: StaticSearchDataset[] = [
  {
    topic: 'elon musk',
    headline: 'Starlink expands coverage to new maritime corridors',
    details:
      'SpaceX announces that Starlink Maritime now offers high-bandwidth coverage for transatlantic cargo ships with 35% lower latency.',
    timestamp: '2025-02-11',
    url: 'https://news.example.com/spacex-starlink-maritime-expansion'
  },
  {
    topic: 'elon musk',
    headline: 'Tesla introduces adaptive energy routing for Superchargers',
    details:
      'The firmware update allows Superchargers to rebalance demand across a city, reducing queue times in peak hours by up to 22%.',
    timestamp: '2025-02-09'
  },
  {
    topic: 'spacex',
    headline: 'Starship completes reusable heat shield stress test',
    details:
      'The latest prototype survived a rapid reentry simulation, clearing the way for the first crewed lunar rehearsal mission.',
    timestamp: '2025-02-02'
  },
  {
    topic: 'tesla',
    headline: 'Tesla Energy partners with European grid operator on AI balancing',
    details:
      'A new partnership with ENTSO-E will allow Tesla Megapacks to respond automatically to grid imbalances across five countries.',
    timestamp: '2025-01-28'
  },
  {
    topic: 'neuralink',
    headline: 'Neuralink receives expanded FDA approval for precision motor trials',
    details:
      'The approval expands its trial cohort to include spinal cord injury patients focusing on restoring fine motor control.',
    timestamp: '2025-01-24'
  }
];

export function createNewsResearchWorkspace(): Workspace {
  const searchTool = new StaticSearchTool({ dataset: DATASET });
  const fileTool = new VirtualFileTool();

  const researchLLM = new HeuristicLLM({ id: 'research-llm', name: 'Analytical Researcher', style: 'analysis' });
  const plannerLLM = new HeuristicLLM({ id: 'planner-llm', name: 'Structured Planner', style: 'planner' });
  const archivistLLM = new HeuristicLLM({ id: 'archivist-llm', name: 'Story Weaver', style: 'creative' });

  const researchAgent = new Agent({
    name: 'Research Analyst',
    description: 'Collects the most relevant curated insights for a topic using available tools.',
    llm: researchLLM,
    tools: [searchTool],
    systemPrompt:
      'You are a research analyst synthesizing high-signal technology updates. Highlight clear facts and context. '
  });

  const strategistAgent = new Agent({
    name: 'Strategy Planner',
    description: 'Transforms raw findings into structured plans focused on clarity and priority.',
    llm: plannerLLM,
    systemPrompt:
      'You produce actionable plans with numbered steps. Keep instructions concise and highlight measurable outcomes.'
  });

  const archivistAgent = new Agent({
    name: 'Archivist',
    description: 'Archives insights into well-formatted markdown files for later review.',
    llm: archivistLLM,
    tools: [fileTool],
    systemPrompt: 'You craft narrative summaries that read naturally while preserving key facts.'
  });

  const workflow = new WorkflowEngine({
    id: 'news-research',
    title: 'News Research Workflow',
    description: 'Collects curated updates, synthesizes them into a plan, and archives the deliverable.',
    steps: [
      {
        id: 'research',
        title: 'Collect curated updates',
        description: 'Gather relevant curated snippets about the requested topic.',
        agent: researchAgent,
        prepare: ({ input }) => {
          const topic = String(input.topic ?? '').trim();
          const instructions = String(input.instructions ?? '').trim();
          return {
            prompt: `Topic: ${topic || 'unknown topic'}\n${
              instructions ? `Primary instruction: ${instructions}\n` : ''
            }Explain why the updates below matter for our stakeholders.`,
            toolInvocations: [
              {
                tool: searchTool,
                label: 'Curated search results',
                input: {
                  query: topic || 'technology'
                }
              }
            ],
            metadata: { topic }
          };
        }
      },
      {
        id: 'synthesize',
        title: 'Transform research into plan',
        description: 'Use the curated snippets to build an actionable plan.',
        agent: strategistAgent,
        dependsOn: ['research'],
        prepare: ({ input, state }) => {
          const topic = String(input.topic ?? '').trim();
          const instructions = String(input.instructions ?? '').trim();
          const research = state.research?.output.response.content ?? 'No findings available.';
          return {
            prompt: `We are planning next steps for ${topic || 'the topic'}. ${
              instructions ? `Follow the guidance: ${instructions}. ` : ''
            }Use the findings below to build a numbered strategy.\n\nFindings:\n${research}`,
            metadata: { topic }
          };
        }
      },
      {
        id: 'archive',
        title: 'Archive deliverable',
        description: 'Store the synthesized plan in a markdown file.',
        agent: archivistAgent,
        dependsOn: ['synthesize'],
        prepare: ({ input, state }) => {
          const fileName = String(input.fileName ?? '').trim() || 'insights.md';
          const summary = state.synthesize?.output.response.content ?? 'No summary created.';
          const topic = String(input.topic ?? '').trim() || 'General Update';

          return {
            prompt: `Compose a short introduction for the archived note on ${topic}.`,
            toolInvocations: [
              {
                tool: fileTool,
                label: 'Save summary',
                input: {
                  path: fileName,
                  content: `# ${topic} Update\n\n${summary}`
                }
              }
            ],
            metadata: { fileName, topic }
          };
        }
      }
    ]
  });

  return {
    workflow,
    searchTool,
    fileTool,
    agents: [researchAgent, strategistAgent, archivistAgent]
  };
}

export function extractStepMarkdown(state: WorkflowState, id: string): string | undefined {
  return state[id]?.output.response.content;
}
