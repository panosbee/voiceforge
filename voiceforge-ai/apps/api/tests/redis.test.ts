import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockQuit = vi.fn().mockResolvedValue('OK');
const mockDisconnect = vi.fn();
const mockPing = vi.fn().mockResolvedValue('PONG');
const mockOn = vi.fn().mockReturnThis();

let lastConstructorArgs: unknown[] = [];

class MockRedis {
  connect = mockConnect;
  quit = mockQuit;
  disconnect = mockDisconnect;
  ping = mockPing;
  on = mockOn;
  constructor(...args: unknown[]) {
    lastConstructorArgs = args;
  }
}

vi.mock('ioredis', () => ({ default: MockRedis }));

vi.mock('../src/config/env.js', () => ({
  env: { REDIS_URL: 'redis://localhost:6379', NODE_ENV: 'test' },
}));

vi.mock('../src/config/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

let getRedisClient: typeof import('../src/db/redis.js').getRedisClient;
let disconnectRedis: typeof import('../src/db/redis.js').disconnectRedis;
let checkRedisHealth: typeof import('../src/db/redis.js').checkRedisHealth;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  lastConstructorArgs = [];
  const mod = await import('../src/db/redis.js');
  getRedisClient = mod.getRedisClient;
  disconnectRedis = mod.disconnectRedis;
  checkRedisHealth = mod.checkRedisHealth;
});

describe('getRedisClient', () => {
  it('returns the same instance on multiple calls', () => {
    const client1 = getRedisClient();
    const client2 = getRedisClient();
    expect(client1).toBe(client2);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('calls connect on first call', () => {
    getRedisClient();
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('registers event listeners', () => {
    getRedisClient();
    const events = mockOn.mock.calls.map((c: unknown[]) => c[0]);
    expect(events).toContain('connect');
    expect(events).toContain('ready');
    expect(events).toContain('error');
    expect(events).toContain('close');
    expect(events).toContain('reconnecting');
    expect(events).toContain('end');
  });

  it('configures retryStrategy with exponential backoff capped at 2000ms', () => {
    getRedisClient();
    const config = lastConstructorArgs[1] as { retryStrategy: (times: number) => number | null };
    expect(config.retryStrategy).toBeDefined();
    expect(config.retryStrategy(1)).toBe(50);
    expect(config.retryStrategy(5)).toBe(250);
    expect(config.retryStrategy(10)).toBe(500);
    expect(config.retryStrategy(10)).toBeLessThanOrEqual(2000);
  });

  it('retryStrategy stops reconnecting after 10 retries', () => {
    getRedisClient();
    const config = lastConstructorArgs[1] as { retryStrategy: (times: number) => number | null };
    expect(config.retryStrategy(10)).toBe(500);
    expect(config.retryStrategy(11)).toBeNull();
  });

  it('configures enableReadyCheck and maxRetriesPerRequest', () => {
    getRedisClient();
    const config = lastConstructorArgs[1] as Record<string, unknown>;
    expect(config.enableReadyCheck).toBe(true);
    expect(config.maxRetriesPerRequest).toBe(3);
    expect(config.connectTimeout).toBe(5000);
  });
});

describe('disconnectRedis', () => {
  it('calls quit on the client', async () => {
    getRedisClient();
    await disconnectRedis();
    expect(mockQuit).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no client exists', async () => {
    await disconnectRedis();
    expect(mockQuit).not.toHaveBeenCalled();
  });
});

describe('checkRedisHealth', () => {
  it('returns connected with latency on success', async () => {
    getRedisClient();
    const result = await checkRedisHealth();
    expect(result.connected).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(mockPing).toHaveBeenCalledTimes(1);
  });

  it('returns disconnected when no client exists', async () => {
    const result = await checkRedisHealth();
    expect(result.connected).toBe(false);
    expect(result.latencyMs).toBe(0);
  });

  it('returns disconnected when ping fails', async () => {
    getRedisClient();
    mockPing.mockRejectedValueOnce(new Error('Connection refused'));
    const result = await checkRedisHealth();
    expect(result.connected).toBe(false);
  });
});
