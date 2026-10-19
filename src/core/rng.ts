import { MAX_RNG_STREAMS, MAX_SAFE_TICK, RNG_ALGORITHM, RNG_SEED_DERIVATION } from './constants';
import { ContractError } from './errors';
import type { RandomState, RandomStreamState } from './types';

const MASK_64 = 0xffff_ffff_ffff_ffffn;
const TWO_POW_32 = 0x1_0000_0000;
const SPLITMIX_INCREMENT = 0x9e37_79b9_7f4a_7c15n;
const SPLITMIX_MUL_1 = 0xbf58_476d_1ce4_e5b9n;
const SPLITMIX_MUL_2 = 0x94d0_49bb_1331_11ebn;
const FNV_OFFSET_BASIS = 0xcbf2_9ce4_8422_2325n;
const FNV_PRIME = 0x0000_0100_0000_01b3n;

function isSeed(seed: string): boolean {
  return /^[0-9a-f]{16}$/.test(seed);
}

function isSystemId(systemId: string): boolean {
  return systemId.length <= 128 && /^[a-z][a-z0-9]*(?:[.:/_-][a-z0-9]+)*$/.test(systemId);
}

function splitMix64Next(cursor: { value: bigint }): bigint {
  cursor.value = (cursor.value + SPLITMIX_INCREMENT) & MASK_64;
  let value = cursor.value;
  value = ((value ^ (value >> 30n)) * SPLITMIX_MUL_1) & MASK_64;
  value = ((value ^ (value >> 27n)) * SPLITMIX_MUL_2) & MASK_64;
  return (value ^ (value >> 31n)) & MASK_64;
}

export function splitMix64Outputs(initialState: bigint, count: number): bigint[] {
  if (!Number.isSafeInteger(count) || count < 0 || count > 256) throw new RangeError('O vetor SplitMix64 aceita de 0 a 256 saídas.');
  const cursor = { value: initialState & MASK_64 };
  return Array.from({ length: count }, () => splitMix64Next(cursor));
}

function fnv1a64Ascii(value: string): bigint {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash;
}

function lowWord(value: bigint): number {
  return Number(value & 0xffff_ffffn);
}

function highWord(value: bigint): number {
  return Number((value >> 32n) & 0xffff_ffffn);
}

export function deriveStreamState(seed: string, systemId: string): RandomStreamState {
  if (!isSeed(seed)) throw new ContractError('INVALID_SCENARIO', 'A seed deve conter 16 dígitos hexadecimais minúsculos.');
  if (!isSystemId(systemId)) throw new ContractError('INVALID_MESSAGE', 'systemId deve ser ASCII, namespaced e estável.');

  const seedValue = BigInt(`0x${seed}`);
  const cursor = { value: (seedValue ^ fnv1a64Ascii(systemId)) & MASK_64 };
  const first = splitMix64Next(cursor);
  const second = splitMix64Next(cursor);
  const state: [number, number, number, number] = [lowWord(first), highWord(first), lowWord(second), highWord(second)];
  if (state.every((word) => word === 0)) state[0] = 1;
  return { state, draws: 0 };
}

export function createRandomState(): RandomState {
  return { algorithm: RNG_ALGORITHM, derivation: RNG_SEED_DERIVATION, streams: {} };
}

function rotl(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

export function nextUint32(stream: RandomStreamState): number {
  if (!Number.isSafeInteger(stream.draws) || stream.draws < 0 || stream.draws >= MAX_SAFE_TICK) {
    throw new ContractError('INVARIANT_VIOLATION', 'O cursor do fluxo aleatório excedeu o limite seguro.', false);
  }
  const [s0, s1, s2, s3] = stream.state;
  const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
  const temporary = (s1 << 9) >>> 0;
  const next2 = (s2 ^ s0 ^ temporary) >>> 0;
  stream.state = [
    (s0 ^ s3 ^ s1) >>> 0,
    (s1 ^ s2 ^ s0) >>> 0,
    next2,
    rotl((s3 ^ s1) >>> 0, 11),
  ];
  stream.draws += 1;
  return result;
}

export function nextRandomFloat(stream: RandomStreamState): number {
  return nextUint32(stream) / TWO_POW_32;
}

export function drawFromSystem(random: RandomState, seed: string, systemId: string): number {
  let stream = random.streams[systemId];
  if (stream === undefined) {
    if (Object.keys(random.streams).length >= MAX_RNG_STREAMS) {
      throw new ContractError('INVARIANT_VIOLATION', 'O limite de fluxos aleatórios ativos foi atingido.', false);
    }
    stream = deriveStreamState(seed, systemId);
    random.streams[systemId] = stream;
  }
  return nextUint32(stream);
}

export function validateRandomState(value: unknown): value is RandomState {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const random = value as Record<string, unknown>;
  if (random['algorithm'] !== RNG_ALGORITHM || random['derivation'] !== RNG_SEED_DERIVATION) return false;
  const streams = random['streams'];
  if (streams === null || typeof streams !== 'object' || Array.isArray(streams)) return false;
  const streamsPrototype = Object.getPrototypeOf(streams);
  if (streamsPrototype !== Object.prototype && streamsPrototype !== null) return false;
  const entries = Object.entries(streams as Record<string, unknown>);
  if (entries.length > MAX_RNG_STREAMS) return false;
  for (const [systemId, rawStream] of entries) {
    if (!isSystemId(systemId) || rawStream === null || typeof rawStream !== 'object' || Array.isArray(rawStream)) return false;
    const stream = rawStream as Record<string, unknown>;
    if (Object.keys(stream).sort().join(',') !== 'draws,state') return false;
    if (!Number.isSafeInteger(stream['draws']) || (stream['draws'] as number) < 0) return false;
    const state = stream['state'];
    if (!Array.isArray(state) || state.length !== 4) return false;
    if (!state.every((word) => Number.isInteger(word) && (word as number) >= 0 && (word as number) <= 0xffff_ffff)) return false;
    if (state.every((word) => word === 0)) return false;
  }
  return Object.keys(random).sort().join(',') === 'algorithm,derivation,streams';
}
