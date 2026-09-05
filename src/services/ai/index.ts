import { AIRouter, ActiveAIInfo } from './AIRouter';
import { OllamaProvider } from './OllamaProvider';
import { LMStudioProvider } from './LMStudioProvider';
import { CloudAIProvider, ConnectionTestResponse } from './CloudAIProvider';
import { DEFAULT_SETTINGS } from '../../types/settings';

export const aiRouter = new AIRouter(DEFAULT_SETTINGS);
export { OllamaProvider, LMStudioProvider, CloudAIProvider, AIRouter };
export type { ActiveAIInfo, ConnectionTestResponse };
