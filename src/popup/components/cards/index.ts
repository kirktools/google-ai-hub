import type { ComponentType } from 'react';
import type { BenefitId } from '../../../shared/types';
import { AiStudioCard } from './AiStudioCard';
import { AntigravityCard } from './AntigravityCard';
import { ColabCard } from './ColabCard';
import { FlowCard } from './FlowCard';
import { GeminiCard } from './GeminiCard';
import { GoogleOneCard } from './GoogleOneCard';
import { NotebookLmCard } from './NotebookLmCard';
import type { PlatformCardProps } from './types';

export const PLATFORM_CARD_REGISTRY: Record<
  Exclude<BenefitId, 'ecosystem'>,
  ComponentType<PlatformCardProps>
> = {
  google_one: GoogleOneCard,
  ai_studio: AiStudioCard,
  flow: FlowCard,
  colab: ColabCard,
  gemini: GeminiCard,
  notebooklm: NotebookLmCard,
  antigravity: AntigravityCard,
};
