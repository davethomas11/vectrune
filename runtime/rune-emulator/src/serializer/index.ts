// ============================================================================
// Serializer public API
// ============================================================================

import { toJson } from './json';
import { toYaml } from './yaml';
import { toXml } from './xml';

export type SerializeFormat = 'json' | 'yaml' | 'xml';

/**
 * Serialize any value to the given format string.
 *
 * @param value  The value to serialize
 * @param format One of 'json' | 'yaml' | 'xml'
 * @param rootTag Optional root element tag name for XML (default: 'root')
 */
export function serialize(
  value: unknown,
  format: SerializeFormat,
  rootTag = 'root',
): string {
  switch (format) {
    case 'json': return toJson(value);
    case 'yaml': return toYaml(value);
    case 'xml':  return toXml(value, rootTag);
    default:     return String(value);
  }
}

export { toJson, toYaml, toXml };
