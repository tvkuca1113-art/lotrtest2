import english from './messages.en.json';
/** Localisable presentation templates; preserve markup, attributes and {0} tokens. */
export const messages: Record<string, string> = english;
export function message(key: string, ...values: unknown[]): string {
  return (messages[key] ?? key).replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? ''));
}
