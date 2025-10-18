export interface LLMRequest {
  prompt: string;
  context?: string[];
}

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  metadata?: Record<string, unknown>;
}

export interface LLM {
  readonly id: string;
  readonly name: string;
  readonly supportsStreaming?: boolean;
  generate(request: LLMRequest): Promise<LLMResponse>;
}

export interface MemoryMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ToolExecution {
  output: string;
  data?: Record<string, unknown>;
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  invoke(input: Record<string, unknown>): Promise<ToolExecution>;
}

export interface ToolInvocationPlan {
  tool: Tool;
  input: Record<string, unknown>;
  label?: string;
}

export interface AgentRunContext {
  prompt: string;
  toolResults: ToolExecutionDetail[];
  metadata?: Record<string, unknown>;
}

export interface ToolExecutionDetail extends ToolExecution {
  tool: Tool;
  label: string;
}

export interface AgentStepResult {
  response: LLMResponse;
  prompt: string;
  toolResults: ToolExecutionDetail[];
}

export interface WorkflowInput {
  [key: string]: unknown;
}

export interface WorkflowStateEntry {
  id: string;
  title: string;
  agent: string;
  output: AgentStepResult;
}

export interface WorkflowState {
  [stepId: string]: WorkflowStateEntry;
}

export interface WorkflowPrepareArgs {
  input: WorkflowInput;
  state: WorkflowState;
}

export interface WorkflowStepPlan {
  id: string;
  title: string;
  description: string;
  agent: AgentLike;
  dependsOn?: string[];
  prepare(args: WorkflowPrepareArgs): WorkflowPreparedStep;
}

export interface WorkflowPreparedStep {
  prompt: string;
  toolInvocations?: ToolInvocationPlan[];
  metadata?: Record<string, unknown>;
}

export interface WorkflowEventBase {
  stepId: string;
  timestamp: number;
}

export type WorkflowEvent =
  | (WorkflowEventBase & { type: 'step:start'; title: string; agent: string })
  | (WorkflowEventBase & { type: 'tool:start'; tool: string; label: string })
  | (WorkflowEventBase & { type: 'tool:end'; tool: string; label: string; output: string })
  | (WorkflowEventBase & { type: 'llm:complete'; agent: string; tokensUsed: number })
  | (WorkflowEventBase & { type: 'step:end'; title: string; agent: string });

export type WorkflowObserver = (event: WorkflowEvent) => void;

export interface WorkflowRunResult {
  input: WorkflowInput;
  state: WorkflowState;
  events: WorkflowEvent[];
  completedAt: number;
}

export interface AgentLike {
  name: string;
  description?: string;
  runStep(context: AgentRunContext): Promise<AgentStepResult>;
  reset?: () => void;
}
