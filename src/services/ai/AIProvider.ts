import { AICapability, AIClassificationResult, AIChatMessage, AIModelInfo } from '../../types/ai';

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly isLocal: boolean;

  isAvailable(): Promise<boolean>;
  getModels(): Promise<string[]>;
  getDetailedModels?(): Promise<AIModelInfo[]>;
  getCapabilities(): AICapability[];

  summarize(text: string, model?: string): Promise<string>;
  classify(text: string, model?: string): Promise<AIClassificationResult>;
  suggestTags(text: string, existingTags?: string[], model?: string): Promise<string[]>;
  askContext(
    contextText: string,
    history: AIChatMessage[],
    userQuestion: string,
    model?: string
  ): Promise<string>;
}
