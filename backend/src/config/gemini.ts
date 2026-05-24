import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './env';

export const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY ?? '');

export const GEMINI_CONFIG = {
  model: 'gemini-1.5-flash',
  maxTokens: env.OPENAI_MAX_TOKENS,
  temperature: env.OPENAI_TEMPERATURE,
};
