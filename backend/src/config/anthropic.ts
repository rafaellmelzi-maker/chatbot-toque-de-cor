import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

export const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY ?? '',
});

export const ANTHROPIC_CONFIG = {
  model: 'claude-3-5-haiku-20241022',      // rápido e barato
  intentModel: 'claude-3-haiku-20240307',  // mais rápido ainda para classificação
  maxTokens: env.OPENAI_MAX_TOKENS,
  temperature: env.OPENAI_TEMPERATURE,
};
