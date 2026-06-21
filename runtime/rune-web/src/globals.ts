// ============================================================================
// Global window helpers — typed access to window properties
// ============================================================================

/**
 * Safely get/set arbitrary properties on the window object.
 * Centralizes the `window as unknown as ...` pattern in one place.
 */
export function getWindowProp(key: string): unknown {
  return (window as unknown as Record<string, unknown>)[key];
}

export function setWindowProp(key: string, value: unknown): void {
  (window as unknown as Record<string, unknown>)[key] = value;
}
