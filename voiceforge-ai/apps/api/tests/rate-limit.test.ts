import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../src/config/env.js', () => ({
  env: { REDIS_URL: '', NODE_ENV: 'test' },
}));

vi.mock('../src/config/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockEval = vi.fn();

vi.mock('../src/db/redis.js', () => ({
  getRedisClient: vi.fn(() => ({
    eval: mockEval,
  })),
}));

describe('MemoryRateLimitStore via rateLimiter middleware', () => {
  let rateLimiter: typeof import('../src/middleware/rate-limit.js').rateLimiter;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../src/middleware/rate-limit.js');
    rateLimiter = mod.rateLimiter;
  });

  it('allows requests under the limit', async () => {
    const app = new Hono();
    app.use('/*', rateLimiter(3, 60_000));
    app.get('/test', (c) => c.text('ok'));

    const res = await app.request('http://localhost/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('3');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('2');
  });

  it('blocks when limit is reached and returns 429', async () => {
    const app = new Hono();
    app.use('/*', rateLimiter(2, 60_000));
    app.get('/test', (c) => c.text('ok'));

    const makeReq = () =>
      app.request('http://localhost/test', {
        headers: { 'x-forwarded-for': '10.0.0.1' },
      });

    const res1 = await makeReq();
    expect(res1.status).toBe(200);
    expect(res1.headers.get('X-RateLimit-Remaining')).toBe('1');

    const res2 = await makeReq();
    expect(res2.status).toBe(200);
    expect(res2.headers.get('X-RateLimit-Remaining')).toBe('0');

    const res3 = await makeReq();
    expect(res3.status).toBe(429);
    expect(res3.headers.get('Retry-After')).toBeTruthy();
  });

  it('different IPs have independent limits', async () => {
    const app = new Hono();
    app.use('/*', rateLimiter(1, 60_000));
    app.get('/test', (c) => c.text('ok'));

    const res1 = await app.request('http://localhost/test', {
      headers: { 'x-forwarded-for': '1.1.1.1' },
    });
    expect(res1.status).toBe(200);

    const res2 = await app.request('http://localhost/test', {
      headers: { 'x-forwarded-for': '2.2.2.2' },
    });
    expect(res2.status).toBe(200);
  });

  it('resets after window expires', async () => {
    vi.useFakeTimers();
    const app = new Hono();
    app.use('/*', rateLimiter(1, 5_000));
    app.get('/test', (c) => c.text('ok'));

    const makeReq = () =>
      app.request('http://localhost/test', {
        headers: { 'x-forwarded-for': '5.5.5.5' },
      });

    const res1 = await makeReq();
    expect(res1.status).toBe(200);

    const res2 = await makeReq();
    expect(res2.status).toBe(429);

    vi.advanceTimersByTime(5_001);

    const res3 = await makeReq();
    expect(res3.status).toBe(200);

    vi.useRealTimers();
  });
});

describe('RedisRateLimitStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses singleton — same client object returned for every request', async () => {
    vi.resetModules();

    vi.doMock('../src/config/env.js', () => ({
      env: { REDIS_URL: 'redis://localhost:6379', NODE_ENV: 'test' },
    }));

    const mockEvalLocal = vi.fn().mockResolvedValue([1, 99, Date.now() + 60_000]);
    const singletonClient = { eval: mockEvalLocal };
    const returnedClients: unknown[] = [];
    vi.doMock('../src/db/redis.js', () => ({
      getRedisClient: vi.fn(() => {
        returnedClients.push(singletonClient);
        return singletonClient;
      }),
    }));

    const { rateLimiter } = await import('../src/middleware/rate-limit.js');

    const app = new Hono();
    app.use('/*', rateLimiter(100, 60_000));
    app.get('/test', (c) => c.text('ok'));

    await app.request('http://localhost/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    await app.request('http://localhost/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });

    expect(returnedClients).toHaveLength(2);
    expect(returnedClients[0]).toBe(returnedClients[1]);
    expect(mockEvalLocal).toHaveBeenCalledTimes(2);
  });

  it('fail-open: allows request when Redis throws', async () => {
    vi.resetModules();

    vi.doMock('../src/config/env.js', () => ({
      env: { REDIS_URL: 'redis://localhost:6379', NODE_ENV: 'test' },
    }));

    const mockEvalFail = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.doMock('../src/db/redis.js', () => ({
      getRedisClient: vi.fn(() => ({ eval: mockEvalFail })),
    }));

    const { rateLimiter } = await import('../src/middleware/rate-limit.js');

    const app = new Hono();
    app.use('/*', rateLimiter(100, 60_000));
    app.get('/test', (c) => c.text('ok'));

    const res = await app.request('http://localhost/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    expect(res.status).toBe(200);
  });

  it('concurrent load: 100 parallel requests use same client instance, no connection leak', async () => {
    vi.resetModules();

    vi.doMock('../src/config/env.js', () => ({
      env: { REDIS_URL: 'redis://localhost:6379', NODE_ENV: 'test' },
    }));

    let callCount = 0;
    const mockEvalConcurrent = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve([1, 200 - callCount, Date.now() + 60_000]);
    });
    const singletonClient = { eval: mockEvalConcurrent };
    const returnedClients: unknown[] = [];
    vi.doMock('../src/db/redis.js', () => ({
      getRedisClient: vi.fn(() => {
        returnedClients.push(singletonClient);
        return singletonClient;
      }),
    }));

    const { rateLimiter } = await import('../src/middleware/rate-limit.js');

    const app = new Hono();
    app.use('/*', rateLimiter(200, 60_000));
    app.get('/test', (c) => c.text('ok'));

    const requests = Array.from({ length: 100 }, () =>
      app.request('http://localhost/test', {
        headers: { 'x-forwarded-for': '9.9.9.9' },
      }),
    );

    const responses = await Promise.all(requests);
    responses.forEach((res) => expect(res.status).toBe(200));
    expect(mockEvalConcurrent).toHaveBeenCalledTimes(100);
    expect(returnedClients).toHaveLength(100);
    const uniqueClients = new Set(returnedClients);
    expect(uniqueClients.size).toBe(1);
  });
});
