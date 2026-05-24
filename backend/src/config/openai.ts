import OpenAI from 'openai';
import { env } from './env';

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY ?? 'placeholder',
});

export const OPENAI_CONFIG = {
  model: env.OPENAI_MODEL,
  embeddingModel: env.OPENAI_EMBEDDING_MODEL,
  maxTokens: env.OPENAI_MAX_TOKENS,
  temperature: env.OPENAI_TEMPERATURE,
};
