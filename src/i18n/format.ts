/** Ersetzt {name}-Platzhalter: format('Tag {day}', { day: 3 }) → 'Tag 3'. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}
