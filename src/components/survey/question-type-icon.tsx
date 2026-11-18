import {
  AlignLeft, CalendarDays, CircleDot, Gauge, Hash, Heading, SlidersHorizontal, SquareCheck, ToggleLeft, Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { canonicalType, type QuestionType } from '../../api/surveys';

const ICONS: Partial<Record<QuestionType, LucideIcon>> = {
  section: Heading, short_text: Type, long_text: AlignLeft, number: Hash, date: CalendarDays,
  single_choice: CircleDot, multiple_choice: SquareCheck, yes_no: ToggleLeft, scale: SlidersHorizontal, nps: Gauge,
};

export function QuestionTypeIcon({ type, size = 16 }: { type: QuestionType; size?: number }) {
  const Icon = ICONS[canonicalType(type)] ?? Type;
  return <Icon size={size} aria-hidden />;
}
