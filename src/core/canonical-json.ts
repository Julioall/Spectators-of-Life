import type { JsonValue } from './types';

function compareKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalize(value: unknown, seen: Set<object>): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('JSON lógico só aceita números finitos.');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError('JSON lógico não aceita referências cíclicas.');
    seen.add(value);
    const result = value.map((item) => normalize(item, seen));
    seen.delete(value);
    return result;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('JSON lógico só aceita objetos simples.');
    }
    if (seen.has(value)) throw new TypeError('JSON lógico não aceita referências cíclicas.');
    seen.add(value);
    const result = Object.create(null) as Record<string, JsonValue>;
    for (const key of Object.keys(record).sort(compareKeys)) {
      const item = record[key];
      if (item === undefined) throw new TypeError(`Campo indefinido em JSON lógico: ${key}.`);
      result[key] = normalize(item, seen);
    }
    seen.delete(value);
    return result;
  }
  throw new TypeError(`Tipo não serializável em JSON lógico: ${typeof value}.`);
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(normalize(value, new Set()));
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(canonicalStringify(value)) as T;
}

/**
 * Fast deep copy for already-validated JSON state. The caller must validate
 * the input first; negative zero is normalized to match canonical JSON.
 */
export function cloneValidatedJson<T>(value: T): T {
  const copy = structuredClone(value);
  normalizeNegativeZero(copy);
  return copy;
}

export function logicalStateString(value: unknown): string {
  if (value !== null && typeof value === 'object' && 'worldId' in value && 'state' in value) {
    return canonicalStringify((value as { state: unknown }).state);
  }
  return canonicalStringify(value);
}

export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function normalizeNegativeZero(value: unknown): void {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const item: unknown = value[index];
      if (typeof item === 'number' && Object.is(item, -0)) value[index] = 0;
      else normalizeNegativeZero(item);
    }
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    const item = (value as Record<string, unknown>)[key];
    if (typeof item === 'number' && Object.is(item, -0)) (value as Record<string, unknown>)[key] = 0;
    else normalizeNegativeZero(item);
  }
}
