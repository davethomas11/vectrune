// ============================================================================
// JSON serializer
// ============================================================================

export function toJson(value: unknown, pretty = true): string {
  return JSON.stringify(value, null, pretty ? 2 : undefined) ?? 'null';
}
