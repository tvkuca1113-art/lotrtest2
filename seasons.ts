import { message } from '../content/messages';
import type { Season } from '../types';
export const SEASONS: Season[] = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const seasonAt = (day: number): Season => SEASONS[Math.floor(Math.max(0, day) / 4) % 4];
export const seasonDay = (day: number) => day % 4 + 1;
export const seasonClue = (s: Season) => ({ Spring: message("seasons.001"), Summer: message("seasons.002"), Autumn: message("seasons.003"), Winter: message("seasons.004") }[s]);
export const seasonalDamage = (season: Season, kind: string) => season === 'Spring' && kind === 'stormcall' ? 1.1 : season === 'Summer' && kind === 'ember' ? 1.08 : 1;
