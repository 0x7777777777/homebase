import { Tool, ToolExecution } from './types';

export interface StaticSearchDataset {
  topic: string;
  headline: string;
  details: string;
  url?: string;
  timestamp?: string;
}

export class StaticSearchTool implements Tool {
  public readonly name: string;
  public readonly description: string;
  private readonly dataset: StaticSearchDataset[];

  constructor(options: { name?: string; description?: string; dataset: StaticSearchDataset[] }) {
    this.name = options.name ?? 'static.search';
    this.description = options.description ?? 'Returns curated news style snippets for well known technology leaders.';
    this.dataset = options.dataset;
  }

  async invoke(input: Record<string, unknown>): Promise<ToolExecution> {
    const query = String(input.query ?? '').toLowerCase();
    if (!query) {
      return { output: 'No query provided.', data: { matches: [] } };
    }

    const matches = this.dataset
      .filter((item) => item.topic.toLowerCase().includes(query) || query.includes(item.topic.toLowerCase()))
      .slice(0, 5);

    if (!matches.length) {
      return { output: `No curated matches for "${query}".`, data: { matches: [] } };
    }

    const output = matches
      .map((match, index) => {
        const url = match.url ? ` (source: ${match.url})` : '';
        const timestamp = match.timestamp ? ` [${match.timestamp}]` : '';
        return `${index + 1}. ${match.headline}${timestamp}\n${match.details}${url}`;
      })
      .join('\n\n');

    return {
      output,
      data: {
        matches
      }
    };
  }
}

export interface VirtualFileRecord {
  path: string;
  content: string;
  updatedAt: number;
}

export class VirtualFileTool implements Tool {
  public readonly name: string;
  public readonly description: string;
  private readonly files = new Map<string, VirtualFileRecord>();

  constructor(options: { name?: string; description?: string } = {}) {
    this.name = options.name ?? 'virtual.files';
    this.description = options.description ?? 'Stores artifacts in an in-memory virtual file system.';
  }

  async invoke(input: Record<string, unknown>): Promise<ToolExecution> {
    const path = String(input.path ?? '').trim();
    const content = String(input.content ?? '');

    if (!path) {
      return { output: 'A "path" value is required to store a file.' };
    }

    const record: VirtualFileRecord = {
      path,
      content,
      updatedAt: Date.now()
    };

    this.files.set(path, record);

    return {
      output: `Saved ${content.length} characters to ${path}.`,
      data: {
        file: record
      }
    };
  }

  read(path: string): VirtualFileRecord | undefined {
    return this.files.get(path);
  }

  list(): VirtualFileRecord[] {
    return Array.from(this.files.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  clear() {
    this.files.clear();
  }
}
