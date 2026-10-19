import {
  EMPTY_SCENARIO_ID,
  EMPTY_SCENARIO_VERSION,
  NATURAL_SCENARIO_ID,
  NATURAL_SCENARIO_VERSION,
  MAX_REQUEST_BYTES,
  PROTOCOL_VERSION,
} from '../core/constants';
import { canonicalStringify, utf8ByteLength } from '../core/canonical-json';
import { validateSaveDocument } from '../core/world';
import type { WorkerRequest } from '../core/types';

export type ProtocolValidation =
  | { ok: true; request: WorkerRequest; requestId: number; protocolVersion: number }
  | { ok: false; code: string; message: string; requestId: number; protocolVersion: number };

const REQUEST_ID_MAX = Number.MAX_SAFE_INTEGER;

export function validateWorkerRequest(raw: unknown): ProtocolValidation {
  let protocolVersion: number = PROTOCOL_VERSION;
  let requestId = 0;
  if (!isRecord(raw)) return invalid('INVALID_MESSAGE', 'A mensagem deve ser um objeto.', requestId, protocolVersion);
  if (Number.isSafeInteger(raw['requestId']) && (raw['requestId'] as number) > 0 && (raw['requestId'] as number) <= REQUEST_ID_MAX) requestId = raw['requestId'] as number;

  if (requestId === 0) return invalid('INVALID_MESSAGE', 'requestId deve ser um inteiro seguro positivo.', 0, PROTOCOL_VERSION);
  if (!Number.isSafeInteger(raw['protocolVersion']) || (raw['protocolVersion'] as number) < 1) {
    return invalid('INVALID_MESSAGE', 'protocolVersion deve ser um inteiro positivo.', requestId, PROTOCOL_VERSION);
  }
  protocolVersion = raw['protocolVersion'] as number;
  if (protocolVersion !== PROTOCOL_VERSION) {
    return invalid('UNSUPPORTED_PROTOCOL', `Versão de protocolo não suportada: ${protocolVersion}.`, requestId, protocolVersion);
  }

  try {
    if (utf8ByteLength(canonicalStringify(raw)) > MAX_REQUEST_BYTES) {
      return invalid('INVALID_MESSAGE', `Mensagem excede o limite de ${MAX_REQUEST_BYTES} bytes.`, requestId, protocolVersion);
    }
  } catch {
    return invalid('INVALID_MESSAGE', 'A mensagem contém valores que não podem ser serializados como JSON.', requestId, protocolVersion);
  }

  if (typeof raw['type'] !== 'string') return invalid('INVALID_MESSAGE', 'type é obrigatório.', requestId, protocolVersion);
  switch (raw['type']) {
    case 'CREATE_WORLD': {
      if (!hasExactKeys(raw, ['protocolVersion', 'requestId', 'type', 'scenarioId', 'scenarioVersion', 'seed', 'config'])) {
        return invalid('INVALID_MESSAGE', 'CREATE_WORLD contém campos ausentes ou desconhecidos.', requestId, protocolVersion);
      }
      if (typeof raw['scenarioId'] !== 'string' || typeof raw['scenarioVersion'] !== 'string' || typeof raw['seed'] !== 'string' || !isRecord(raw['config'])) {
        return invalid('INVALID_MESSAGE', 'CREATE_WORLD possui campos com tipos inválidos.', requestId, protocolVersion);
      }
      const supportedScenario = (raw['scenarioId'] === EMPTY_SCENARIO_ID && raw['scenarioVersion'] === EMPTY_SCENARIO_VERSION)
        || (raw['scenarioId'] === NATURAL_SCENARIO_ID && raw['scenarioVersion'] === NATURAL_SCENARIO_VERSION);
      if (!supportedScenario) {
        return invalid('INVALID_SCENARIO', `Cenário não suportado: ${raw['scenarioId']}@${raw['scenarioVersion']}.`, requestId, protocolVersion);
      }
      if (!/^[0-9a-f]{16}$/.test(raw['seed'])) return invalid('INVALID_SCENARIO', 'A seed deve conter 16 dígitos hexadecimais minúsculos.', requestId, protocolVersion);
      if (Object.keys(raw['config']).length !== 0) return invalid('INVALID_SCENARIO', 'O cenário de referência não aceita parâmetros adicionais; a configuração é versionada no catálogo.', requestId, protocolVersion);
      return { ok: true, request: raw as unknown as WorkerRequest, requestId, protocolVersion };
    }
    case 'STEP': {
      if (!hasExactKeys(raw, ['protocolVersion', 'requestId', 'type', 'worldId', 'ticks'])) {
        return invalid('INVALID_MESSAGE', 'STEP contém campos ausentes ou desconhecidos.', requestId, protocolVersion);
      }
      if (!isWorldId(raw['worldId']) || typeof raw['ticks'] !== 'number' || !Number.isSafeInteger(raw['ticks'])) {
        return invalid('INVALID_MESSAGE', 'STEP exige worldId válido e ticks inteiro seguro.', requestId, protocolVersion);
      }
      return { ok: true, request: raw as unknown as WorkerRequest, requestId, protocolVersion };
    }
    case 'GET_SNAPSHOT':
    case 'SAVE':
    case 'DISPOSE': {
      if (!hasExactKeys(raw, ['protocolVersion', 'requestId', 'type', 'worldId']) || !isWorldId(raw['worldId'])) {
        return invalid('INVALID_MESSAGE', `${raw['type']} exige apenas um worldId válido.`, requestId, protocolVersion);
      }
      return { ok: true, request: raw as unknown as WorkerRequest, requestId, protocolVersion };
    }
    case 'LOAD': {
      if (!hasExactKeys(raw, ['protocolVersion', 'requestId', 'type', 'save'])) {
        return invalid('INVALID_MESSAGE', 'LOAD contém campos ausentes ou desconhecidos.', requestId, protocolVersion);
      }
      const result = validateSaveDocument(raw['save']);
      if (!result.ok) return invalid(result.code, result.message, requestId, protocolVersion);
      return { ok: true, request: { ...raw, save: result.save } as unknown as WorkerRequest, requestId, protocolVersion };
    }
    default:
      return invalid('INVALID_MESSAGE', `Tipo de mensagem desconhecido: ${String(raw['type']).slice(0, 128)}.`, requestId, protocolVersion);
  }
}

export function isWorldId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && /^world-[a-zA-Z0-9-]+$/.test(value);
}

function invalid(code: string, message: string, requestId: number, protocolVersion: number): ProtocolValidation {
  return { ok: false, code, message, requestId, protocolVersion };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(record: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(record).sort().join(',') === [...expected].sort().join(',');
}
