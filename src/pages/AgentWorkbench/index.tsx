import classNames from 'classnames';
import { useMemo, useState } from 'react';
import { WorkflowEvent, WorkflowRunResult } from 'libs/agent-workflow';
import { createNewsResearchWorkspace, extractStepMarkdown } from 'libs/agent-workflow/examples';
import styles from './index.module.scss';

interface EventLogItem {
  id: string;
  label: string;
  detail: string;
  meta: string;
}

function renderEvent(event: WorkflowEvent): EventLogItem {
  const time = new Date(event.timestamp).toLocaleTimeString();
  switch (event.type) {
    case 'step:start':
      return { id: `${event.stepId}-start-${event.timestamp}`, label: `Step • ${event.title}`, detail: 'Started', meta: time };
    case 'tool:start':
      return {
        id: `${event.stepId}-tool-${event.timestamp}`,
        label: `Tool • ${event.label}`,
        detail: `Running via ${event.tool}`,
        meta: time
      };
    case 'tool:end':
      return {
        id: `${event.stepId}-tool-end-${event.timestamp}`,
        label: `Tool • ${event.label}`,
        detail: event.output,
        meta: time
      };
    case 'llm:complete':
      return {
        id: `${event.stepId}-llm-${event.timestamp}`,
        label: `Agent • ${event.agent}`,
        detail: `Generated response (tokens: ${event.tokensUsed})`,
        meta: time
      };
    case 'step:end':
    default:
      return { id: `${event.stepId}-end-${event.timestamp}`, label: `Step • ${event.title}`, detail: 'Completed', meta: time };
  }
}

const DEFAULT_PROMPT = 'Search for the latest news about Musk, summarize and save to the desktop as Musk.md';

const DEFAULT_TOPIC_HINT = 'E.g. "Elon Musk", "Tesla", "Neuralink"';

const DEFAULT_FILE_NAME = 'Musk.md';

export default function AgentWorkbench() {
  const workspace = useMemo(() => createNewsResearchWorkspace(), []);
  const [topic, setTopic] = useState('Elon Musk');
  const [fileName, setFileName] = useState(DEFAULT_FILE_NAME);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [events, setEvents] = useState<EventLogItem[]>([]);
  const [result, setResult] = useState<WorkflowRunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runWorkflow = async () => {
    setIsRunning(true);
    setEvents([]);
    setResult(null);
    workspace.workflow.resetAgents();
    workspace.fileTool.clear();

    const nextEvents: EventLogItem[] = [];
    try {
      const execution = await workspace.workflow.run(
        {
          topic: topic.trim() || 'Elon Musk',
          fileName: fileName.trim() || DEFAULT_FILE_NAME,
          instructions: prompt.trim()
        },
        (event) => {
          const rendered = renderEvent(event);
          nextEvents.push(rendered);
          setEvents([...nextEvents]);
        }
      );
      setResult(execution);
    } finally {
      setIsRunning(false);
    }
  };

  const files = workspace.fileTool.list();

  return (
    <div className={classNames(styles.container)}>
      <section className={styles.hero}>
        <div>
          <h1>Agent Workbench</h1>
          <p>
            Explore a simplified agentic workflow inspired by the Eko framework. Define a topic, synthesize the findings, and
            archive the deliverable in a virtual file system.
          </p>
        </div>
        <div className={styles.grid}>
          {workspace.agents.map((agent) => (
            <div key={agent.name} className={styles.card}>
              <h3>{agent.name}</h3>
              <p>{agent.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.form}>
        <label>
          Topic
          <span>{DEFAULT_TOPIC_HINT}</span>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" />
        </label>
        <label>
          Workflow Instructions
          <span>Explain the goal for the workflow. The planner agent will interpret the guidance.</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} />
        </label>
        <label>
          Output File Name
          <span>The archivist will save the generated summary to this virtual path.</span>
          <input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="insights.md" />
        </label>
        <button onClick={runWorkflow} disabled={isRunning}>
          {isRunning ? 'Running workflow…' : 'Run workflow'}
        </button>
      </section>

      <section className={styles.section}>
        <h2>Execution timeline</h2>
        <div className={styles.eventLog}>
          {events.map((event) => (
            <div key={event.id} className={styles.eventItem}>
              <div className={styles.eventMeta}>
                <span>{event.label}</span>
                <span>{event.meta}</span>
              </div>
              <div className={styles.eventTitle}>{event.detail}</div>
            </div>
          ))}
          {!events.length && <p>No execution events yet. Run the workflow to see a detailed timeline.</p>}
        </div>
      </section>

      {result && (
        <section className={styles.section}>
          <h2>Workflow outputs</h2>
          <div className={styles.grid}>
            {Object.values(result.state).map((entry) => (
              <div key={entry.id} className={styles.card}>
                <h3>{entry.title}</h3>
                <p>{extractStepMarkdown(result.state, entry.id)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h2>Virtual files</h2>
        <div className={styles.files}>
          {files.map((file) => (
            <div key={file.path} className={styles.file}>
              <h4 className={styles.fileTitle}>
                {file.path} <span>• {new Date(file.updatedAt).toLocaleTimeString()}</span>
              </h4>
              <pre className={styles.fileContent}>{file.content}</pre>
            </div>
          ))}
          {!files.length && <p>No files archived yet.</p>}
        </div>
      </section>
    </div>
  );
}
