import { MemoryMessage } from './types';

export class ConversationMemory {
  private readonly messages: MemoryMessage[] = [];

  constructor(private readonly maxMessages = 12) {}

  append(message: MemoryMessage) {
    this.messages.push(message);
    if (this.messages.length > this.maxMessages) {
      this.messages.splice(0, this.messages.length - this.maxMessages);
    }
  }

  snapshot(): string[] {
    return this.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`);
  }

  clear() {
    this.messages.length = 0;
  }
}
