import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import protocolSchema from '../../data/schemas/worker-protocol.v1.schema.json';
import saveSchema from '../../data/schemas/save.v1.schema.json';

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addSchema(protocolSchema);
const validateProtocol = ajv.compile(protocolSchema);
const validateSave = ajv.compile(saveSchema);

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../data/fixtures/spec-000/${name}`, import.meta.url), 'utf8')) as unknown;
}

describe('schemas versionados de SPEC-000', () => {
  it('aceita os fixtures válidos de criação e save', () => {
    expect(validateProtocol(fixture('valid-create-world.json'))).toBe(true);
    expect(validateSave(fixture('valid-save.json'))).toBe(true);
  });

  it('recusa propriedades desconhecidas, saves truncados e respostas que não pertencem ao protocolo', () => {
    expect(validateProtocol(fixture('invalid-create-unknown-field.json'))).toBe(false);
    expect(validateSave(fixture('invalid-save-truncated.json'))).toBe(false);
    expect(validateProtocol({ protocolVersion: 1, requestId: 1, type: 'UNKNOWN' })).toBe(false);
  });

  it('especifica STEP inteiro inclusive fora do limite operacional para produzir erro tipado no Worker', () => {
    expect(validateProtocol(fixture('invalid-step-zero.json'))).toBe(true);
    expect(validateProtocol({ protocolVersion: 1, requestId: 2, type: 'STEP', worldId: 'world-1', ticks: 1.5 })).toBe(false);
  });

  it('valida respostas com correlação, identidade do mundo e diagnóstico versionado', () => {
    expect(validateProtocol({
      protocolVersion: 1,
      requestId: 7,
      type: 'ADVANCED',
      worldId: 'world-1',
      tickFrom: 4,
      tickTo: 5,
      completedTicks: 1,
      events: [],
      eventsOmitted: 0,
      diagnostics: { durationMs: 0.25, simulationVersion: '0.1.0', seed: '0000000000000000' },
    })).toBe(true);
    expect(validateProtocol({
      protocolVersion: 1,
      requestId: 8,
      type: 'ERROR',
      code: 'INVARIANT_VIOLATION',
      message: 'Falha controlada.',
      recoverable: false,
      tick: 4,
      simulationVersion: '0.1.0',
      seed: '0000000000000000',
      systemId: 'core:foundation',
      entityId: 'animal:1',
      completedTicks: 4,
      lastValidTick: 4,
      worldId: 'world-1',
    })).toBe(true);
    expect(validateProtocol({ protocolVersion: 1, requestId: 0, type: 'ERROR', code: 'INVALID_MESSAGE', message: 'Sem envelope.', recoverable: true, tick: null })).toBe(true);
  });
});
