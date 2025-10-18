import {
  AgentLike,
  AgentRunContext,
  AgentStepResult,
  ToolExecutionDetail,
  ToolInvocationPlan,
  WorkflowEvent,
  WorkflowObserver,
  WorkflowPreparedStep,
  WorkflowRunResult,
  WorkflowState,
  WorkflowStateEntry,
  WorkflowStepPlan
} from './types';

function now() {
  return Date.now();
}

function ensureUniqueStepIds(steps: WorkflowStepPlan[]) {
  const ids = new Set<string>();
  steps.forEach((step) => {
    if (ids.has(step.id)) {
      throw new Error(`Duplicate workflow step id detected: ${step.id}`);
    }
    ids.add(step.id);
  });
}

function dependenciesSatisfied(step: WorkflowStepPlan, state: WorkflowState) {
  return (step.dependsOn ?? []).every((dependency) => Boolean(state[dependency]));
}

async function executeToolInvocation(plan: ToolInvocationPlan): Promise<ToolExecutionDetail> {
  const result = await plan.tool.invoke(plan.input);
  return {
    ...result,
    tool: plan.tool,
    label: plan.label ?? plan.tool.name
  };
}

async function executeAgentStep(agent: AgentLike, context: AgentRunContext): Promise<AgentStepResult> {
  return agent.runStep(context);
}

export interface WorkflowOptions {
  id: string;
  title: string;
  description?: string;
  steps: WorkflowStepPlan[];
}

export class WorkflowEngine {
  public readonly id: string;
  public readonly title: string;
  public readonly description?: string;
  private readonly steps: WorkflowStepPlan[];

  constructor(options: WorkflowOptions) {
    this.id = options.id;
    this.title = options.title;
    this.description = options.description;
    this.steps = options.steps;
    ensureUniqueStepIds(this.steps);
  }

  resetAgents() {
    this.steps.forEach((step) => {
      step.agent.reset?.();
    });
  }

  async run(input: Record<string, unknown>, observer?: WorkflowObserver): Promise<WorkflowRunResult> {
    const events: WorkflowEvent[] = [];
    const state: WorkflowState = {};
    const queue = [...this.steps];

    const pushEvent = (event: WorkflowEvent) => {
      events.push(event);
      observer?.(event);
    };

    while (queue.length) {
      const step = queue.shift()!;
      if (!dependenciesSatisfied(step, state)) {
        queue.push(step);
        continue;
      }

      const prepared: WorkflowPreparedStep = step.prepare({ input, state });

      pushEvent({
        type: 'step:start',
        stepId: step.id,
        title: step.title,
        agent: step.agent.name,
        timestamp: now()
      });

      const toolResults: ToolExecutionDetail[] = [];
      for (const plan of prepared.toolInvocations ?? []) {
        pushEvent({
          type: 'tool:start',
          stepId: step.id,
          tool: plan.tool.name,
          label: plan.label ?? plan.tool.name,
          timestamp: now()
        });
        const result = await executeToolInvocation(plan);
        toolResults.push(result);
        pushEvent({
          type: 'tool:end',
          stepId: step.id,
          tool: plan.tool.name,
          label: result.label,
          output: result.output,
          timestamp: now()
        });
      }

      const agentContext: AgentRunContext = {
        prompt: prepared.prompt,
        toolResults,
        metadata: prepared.metadata
      };

      const output = await executeAgentStep(step.agent, agentContext);

      pushEvent({
        type: 'llm:complete',
        stepId: step.id,
        agent: step.agent.name,
        tokensUsed: output.response.tokensUsed,
        timestamp: now()
      });

      const entry: WorkflowStateEntry = {
        id: step.id,
        title: step.title,
        agent: step.agent.name,
        output
      };

      state[step.id] = entry;

      pushEvent({
        type: 'step:end',
        stepId: step.id,
        title: step.title,
        agent: step.agent.name,
        timestamp: now()
      });
    }

    return {
      input,
      state,
      events,
      completedAt: now()
    };
  }
}
