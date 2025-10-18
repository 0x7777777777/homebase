import { LLM, LLMRequest, LLMResponse } from './types';

export interface HeuristicLLMOptions {
  id?: string;
  name?: string;
  style?: 'analysis' | 'planner' | 'creative';
  maxTokens?: number;
}

const SUMMARY_SENTENCE_LIMIT = 4;

export class HeuristicLLM implements LLM {
  public readonly id: string;
  public readonly name: string;
  public readonly supportsStreaming = false;
  private readonly style: HeuristicLLMOptions['style'];
  private readonly maxTokens: number;

  constructor(options: HeuristicLLMOptions = {}) {
    this.id = options.id ?? 'heuristic-llm';
    this.name = options.name ?? 'Heuristic LLM';
    this.style = options.style ?? 'analysis';
    this.maxTokens = options.maxTokens ?? 400;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const context = [...(request.context ?? []), request.prompt]
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = context.split(/\s+/).filter(Boolean);
    const clippedTokens = tokens.slice(-this.maxTokens);

    let content = this.generateByStyle(clippedTokens.join(' '));

    return {
      content,
      tokensUsed: clippedTokens.length,
      metadata: {
        style: this.style,
        originalTokens: tokens.length
      }
    };
  }

  private generateByStyle(text: string): string {
    if (!text) {
      return 'No relevant information was provided.';
    }

    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    const selected = sentences.slice(-SUMMARY_SENTENCE_LIMIT);
    const baseSummary = selected.join(' ');

    switch (this.style) {
      case 'planner':
        return this.createPlannerSummary(baseSummary);
      case 'creative':
        return this.createCreativeSummary(baseSummary);
      case 'analysis':
      default:
        return this.createAnalyticalSummary(baseSummary);
    }
  }

  private createAnalyticalSummary(summary: string): string {
    const bulletPoints = summary.split(/,|;|\band\b/i).map((point) => point.trim()).filter(Boolean);
    if (bulletPoints.length <= 1) {
      return `Key Insight: ${summary}`;
    }

    const rendered = bulletPoints
      .slice(0, 5)
      .map((point) => `- ${point.charAt(0).toUpperCase()}${point.slice(1)}`)
      .join('\n');

    return `Insights:\n${rendered}`;
  }

  private createPlannerSummary(summary: string): string {
    const actions = summary
      .split(/(?<=[.!?])/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5)
      .map((item, index) => `${index + 1}. ${item.replace(/^[0-9]+\.\s*/, '')}`)
      .join('\n');

    return `Action Plan:\n${actions}`;
  }

  private createCreativeSummary(summary: string): string {
    const sentences = summary.split(/(?<=[.!?])/).filter(Boolean);
    if (!sentences.length) {
      return 'Imagine a future update filled with possibilities.';
    }

    const intro = sentences[0];
    const outro = sentences.slice(1, 3).join(' ');

    return `Narrative:\n${intro} ${outro} This scenario paints a vivid snapshot of the topic at hand.`;
  }
}
