import { items } from './items';

export const itemColors = new Map<string, string>([
  ['P01', 'hsl(4 78% 58%)'],
  ['P02', 'hsl(190 82% 50%)'],
  ['P03', 'hsl(48 92% 55%)'],
  ['P04', 'hsl(135 58% 48%)'],
  ['P05', 'hsl(282 63% 58%)'],
  ['P06', 'hsl(30 92% 54%)'],
  ['P07', 'hsl(205 86% 60%)'],
  ['P08', 'hsl(332 78% 60%)'],
  ['P09', 'hsl(108 55% 48%)'],
  ['P10', 'hsl(218 78% 58%)'],
  ['P11', 'hsl(18 82% 66%)'],
  ['P12', 'hsl(252 64% 60%)'],
  ['P13', 'hsl(70 70% 48%)'],
  ['P14', 'hsl(315 70% 58%)'],
  ['P15', 'hsl(172 58% 46%)'],
]);

export function getItemColor(itemId: string): string {
  return itemColors.get(itemId) ?? 'hsl(212 84% 69%)';
}

export function getMissingItemColorIds(): string[] {
  return items.map((item) => item.id).filter((itemId) => !itemColors.has(itemId));
}
