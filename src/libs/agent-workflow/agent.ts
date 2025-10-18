import { ConversationMemory } from './memory';
import { HeuristicLLM } from './llm';
import {
  AgentLike,
  AgentRunContext,
  AgentStepResult,
  ToolExecutionDetail,
  ToolInvocationPlan
} from './types';

export interface AgentOptions {
  name: string;
  description?: string;
  llm?: HeuristicLLM;
  tools?: ToolInvocationPlan['tool'][];
  systemPrompt?: string;
  memorySize?: number;
}

export class Agent implements AgentLike {
  public readonly name: string;
  public readonly description?: string;
  private readonly llm: HeuristicLLM;
  private readonly tools: ToolInvocationPlan['tool'][];
  private readonly systemPrompt: string;
  private readonly memory: ConversationMemory;

  constructor(options: AgentOptions) {
    this.name = options.name;
    this.description = options.description;
    this.llm = options.llm ?? new HeuristicLLM();
    this.tools = options.tools ?? [];
    this.systemPrompt = options.systemPrompt ?? `${this.name} is a diligent specialist.`;
    this.memory = new ConversationMemory(options.memorySize);
  }

  get availableTools() {
    return this.tools;
  }

  async runStep(context: AgentRunContext): Promise<AgentStepResult> {
    const toolDetails: ToolExecutionDetail[] = context.toolResults;

    const prompt = [this.systemPrompt, context.prompt]
      .concat(
        toolDetails.length
          ? [`Tool Findings:\n${toolDetails.map((detail) => `- ${detail.label}: ${detail.output}`).join('\n')}`]
          : []
      )
      .join('\n\n');

    const history = this.memory.snapshot();

    this.memory.append({ role: 'user', content: context.prompt, timestamp: Date.now() });

    const response = await this.llm.generate({ prompt, context: history });

    this.memory.append({ role: 'assistant', content: response.content, timestamp: Date.now() });

    return {
      response,
      prompt,
      toolResults: toolDetails
    };
  }

  reset() {
    this.memory.clear();
  }
}
