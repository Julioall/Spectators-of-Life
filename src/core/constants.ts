export const PROTOCOL_VERSION = 1 as const;
export const SAVE_FORMAT = 'spectators-of-life-save' as const;
export const SAVE_SCHEMA_VERSION = 1 as const;
export const SIMULATION_VERSION = '0.1.0' as const;
export const EMPTY_SCENARIO_ID = 'foundation:empty-world' as const;
export const EMPTY_SCENARIO_VERSION = '1.0.0' as const;

export const RNG_ALGORITHM = 'xoshiro128**-1.1' as const;
export const RNG_SEED_DERIVATION = 'fnv1a64-xor-splitmix64-v1' as const;

export const MAX_STEP_TICKS = 256;
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
export const MAX_WORLD_BYTES = 3 * 1024 * 1024;
export const MAX_WORLD_STATE_BYTES = MAX_WORLD_BYTES - 1024;
export const MAX_EVENTS_PER_RESPONSE = 4096;
export const MAX_RNG_STREAMS = 256;
export const MAX_MODULES = 256;
export const MAX_SCHEDULES = 1024;
export const MAX_ENTITIES = 100_000;
export const MAX_ENTITY_ID_LENGTH = 128;
export const MAX_SYSTEM_ID_LENGTH = 128;
export const MAX_PENDING_CLIENT_REQUESTS = 64;

export const MAX_SAFE_TICK = Number.MAX_SAFE_INTEGER;
