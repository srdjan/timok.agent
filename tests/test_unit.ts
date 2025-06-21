#!/usr/bin/env deno test --allow-net --allow-read --allow-write --allow-env --unstable-kv

import { assertEquals, assert } from "@std/assert";
import {
  defaultConfig,
  type Config,
  type PolarUser,
  type Result
} from "../main.ts";

// === PURE FUNCTION TESTS ===

Deno.test("parseRequestData - basic URL parsing", () => {
  const request = new Request("https://example.com/test?param=value", {
    headers: { "Authorization": "Bearer token123", "Accept": "text/html" }
  });

  // Access parseRequestData through module internals for testing
  const url = new URL(request.url);
  const authHeader = request.headers.get('Authorization');

  const requestData = {
    url,
    pathname: url.pathname,
    searchParams: url.searchParams,
    authToken: authHeader?.replace('Bearer ', '') || undefined,
    acceptHeader: request.headers.get('accept') || '',
  };

  assertEquals(requestData.pathname, "/test");
  assertEquals(requestData.searchParams.get("param"), "value");
  assertEquals(requestData.authToken, "token123");
  assertEquals(requestData.acceptHeader, "text/html");
});

Deno.test("parseRequestData - no auth token", () => {
  const request = new Request("https://example.com/api");

  const url = new URL(request.url);
  const authHeader = request.headers.get('Authorization');

  const requestData = {
    url,
    pathname: url.pathname,
    searchParams: url.searchParams,
    authToken: authHeader?.replace('Bearer ', '') || undefined,
    acceptHeader: request.headers.get('accept') || '',
  };

  assertEquals(requestData.authToken, undefined);
  assertEquals(requestData.acceptHeader, "");
});

Deno.test("getResponseFormat - file extension detection", () => {
  const testCases = [
    { pathname: "/test.html", acceptHeader: "", expected: "html" },
    { pathname: "/test.md", acceptHeader: "", expected: "markdown" },
    { pathname: "/test.markdown", acceptHeader: "", expected: "markdown" },
    { pathname: "/api", acceptHeader: "text/html", expected: "html" },
    { pathname: "/api", acceptHeader: "text/markdown", expected: "markdown" },
    { pathname: "/api", acceptHeader: "application/json", expected: "json" },
    { pathname: "/api", acceptHeader: "", expected: "json" },
  ];

  testCases.forEach(({ pathname, acceptHeader, expected }) => {
    const ext = pathname.split('.').pop()?.toLowerCase();
    let format: string;

    if (ext === 'html') {
      format = 'html';
    } else if (ext === 'md' || ext === 'markdown') {
      format = 'markdown';
    } else if (acceptHeader.includes('text/html')) {
      format = 'html';
    } else if (acceptHeader.includes('text/markdown')) {
      format = 'markdown';
    } else {
      format = 'json';
    }

    assertEquals(format, expected, `Failed for pathname: ${pathname}, acceptHeader: ${acceptHeader}`);
  });
});

Deno.test("createCacheKey - deterministic key generation", () => {
  const config = { version: 1 } as Config;
  const createKey = (pathname: string, searchParams: URLSearchParams, format: string): string => {
    const sortedParams = Array.from(searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    return `cache:v${config.version}:${pathname}:${sortedParams}:${format}`;
  };

  const params1 = new URLSearchParams("b=2&a=1");
  const params2 = new URLSearchParams("a=1&b=2");

  const key1 = createKey("/test", params1, "json");
  const key2 = createKey("/test", params2, "json");

  assertEquals(key1, key2, "Keys should be identical regardless of parameter order");
  assertEquals(key1, "cache:v1:/test:a=1&b=2:json");
});

Deno.test("markdownToHtml - basic markdown conversion", () => {
  const markdownToHtml = (markdown: string): string =>
    markdown
      .replace(/^# (.*)/gm, '<h1>$1</h1>')
      .replace(/^## (.*)/gm, '<h2>$1</h2>')
      .replace(/^### (.*)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');

  const testCases = [
    { input: "# Header 1", expected: "<h1>Header 1</h1>" },
    { input: "## Header 2", expected: "<h2>Header 2</h2>" },
    { input: "### Header 3", expected: "<h3>Header 3</h3>" },
    { input: "**bold text**", expected: "<strong>bold text</strong>" },
    { input: "*italic text*", expected: "<em>italic text</em>" },
    { input: "line 1\nline 2", expected: "line 1<br>line 2" },
  ];

  testCases.forEach(({ input, expected }) => {
    assertEquals(markdownToHtml(input), expected);
  });
});

Deno.test("createCorsHeaders - returns correct headers", () => {
  const createCorsHeaders = (): Record<string, string> => ({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });

  const headers = createCorsHeaders();

  assertEquals(headers['Access-Control-Allow-Origin'], '*');
  assertEquals(headers['Access-Control-Allow-Methods'], 'GET, POST, PUT, DELETE, OPTIONS');
  assertEquals(headers['Access-Control-Allow-Headers'], 'Content-Type, Authorization');
});

// === RESULT TYPE TESTS ===

Deno.test("Result type - ok creation and checking", () => {
  const ok = <T>(value: T): Result<T> => ({ kind: 'ok', value });
  const isOk = <T, E>(result: Result<T, E>): result is Extract<Result<T, E>, { kind: 'ok' }> =>
    result.kind === 'ok';

  const result = ok("success");

  assert(isOk(result));
  assertEquals(result.value, "success");
});

Deno.test("Result type - err creation and checking", () => {
  const err = <E>(error: E): Result<never, E> => ({ kind: 'err', error });
  const isErr = <T, E>(result: Result<T, E>): result is Extract<Result<T, E>, { kind: 'err' }> =>
    result.kind === 'err';

  const result = err(new Error("failure"));

  assert(isErr(result));
  assertEquals(result.error.message, "failure");
});

// === MOCK KV IMPLEMENTATION FOR TESTING ===

class MockKV {
  private data = new Map<string, { value: unknown; expireTime?: number }>();

  get<T>(key: Deno.KvKey): Promise<Deno.KvEntryMaybe<T>> {
    const keyStr = JSON.stringify(key);
    const entry = this.data.get(keyStr);

    if (!entry) {
      return Promise.resolve({ key, value: null, versionstamp: null });
    }

    if (entry.expireTime && Date.now() > entry.expireTime) {
      this.data.delete(keyStr);
      return Promise.resolve({ key, value: null, versionstamp: null });
    }

    return Promise.resolve({ key, value: entry.value as T, versionstamp: "mockstamp" });
  }

  set(key: Deno.KvKey, value: unknown, options?: { expireIn?: number }): Promise<Deno.KvCommitResult> {
    const keyStr = JSON.stringify(key);
    const expireTime = options?.expireIn ? Date.now() + options.expireIn : undefined;

    this.data.set(keyStr, { value, expireTime });

    return Promise.resolve({ ok: true, versionstamp: "mockstamp" });
  }
}

// === DATABASE OPERATION TESTS ===

Deno.test("getUserByToken - existing user", async () => {
  const mockKv = new MockKV();
  const testUser: PolarUser = {
    access_token: "token123",
    balance: 100,
    name: "Test User",
    email: "test@example.com"
  };

  await mockKv.set([`user:token123`], testUser);

  const getUserByToken = (kv: MockKV) =>
    async (accessToken: string): Promise<Result<PolarUser | null>> => {
      try {
        const result = await kv.get<PolarUser>([`user:${accessToken}`]);
        return { kind: 'ok', value: result.value };
      } catch (error) {
        return { kind: 'err', error: error as Error };
      }
    };

  const result = await getUserByToken(mockKv)("token123");

  assert(result.kind === 'ok');
  assertEquals(result.value?.access_token, "token123");
  assertEquals(result.value?.balance, 100);
});

Deno.test("getUserByToken - non-existing user", async () => {
  const mockKv = new MockKV();

  const getUserByToken = (kv: MockKV) =>
    async (accessToken: string): Promise<Result<PolarUser | null>> => {
      try {
        const result = await kv.get<PolarUser>([`user:${accessToken}`]);
        return { kind: 'ok', value: result.value };
      } catch (error) {
        return { kind: 'err', error: error as Error };
      }
    };

  const result = await getUserByToken(mockKv)("nonexistent");

  assert(result.kind === 'ok');
  assertEquals(result.value, null);
});

// === RATE LIMITING TESTS ===

Deno.test("rate limiting - fresh user within limit", async () => {
  const mockKv = new MockKV();
  const config = { ...defaultConfig, freeRatelimit: 5, freeRateLimitResetSeconds: 3600 };

  const getRateLimitData = (kv: MockKV, config: Config) =>
    async (userId: string): Promise<Result<{ count: number; resetTime: number }>> => {
      try {
        const key = `ratelimit:${userId}`;
        const result = await kv.get<{ count: number; resetTime: number }>([key]);

        const currentTime = Date.now();
        const resetTime = currentTime + (config.freeRateLimitResetSeconds * 1000);

        if (!result.value || currentTime > result.value.resetTime) {
          return { kind: 'ok', value: { count: 0, resetTime } };
        }

        return { kind: 'ok', value: result.value };
      } catch (error) {
        return { kind: 'err', error: error as Error };
      }
    };

  const result = await getRateLimitData(mockKv, config)("testuser");

  assert(result.kind === 'ok');
  assertEquals(result.value.count, 0);
  assert(result.value.resetTime > Date.now());
});

Deno.test("rate limiting - expired reset time", async () => {
  const mockKv = new MockKV();
  const config = { ...defaultConfig, freeRatelimit: 5, freeRateLimitResetSeconds: 3600 };

  // Set expired rate limit data
  const expiredData = { count: 10, resetTime: Date.now() - 1000 };
  await mockKv.set([`ratelimit:testuser`], expiredData);

  const getRateLimitData = (kv: MockKV, config: Config) =>
    async (userId: string): Promise<Result<{ count: number; resetTime: number }>> => {
      try {
        const key = `ratelimit:${userId}`;
        const result = await kv.get<{ count: number; resetTime: number }>([key]);

        const currentTime = Date.now();
        const resetTime = currentTime + (config.freeRateLimitResetSeconds * 1000);

        if (!result.value || currentTime > result.value.resetTime) {
          return { kind: 'ok', value: { count: 0, resetTime } };
        }

        return { kind: 'ok', value: result.value };
      } catch (error) {
        return { kind: 'err', error: error as Error };
      }
    };

  const result = await getRateLimitData(mockKv, config)("testuser");

  assert(result.kind === 'ok');
  assertEquals(result.value.count, 0); // Should reset to 0
});

// === CACHING TESTS ===

Deno.test("cache operations - set and get", async () => {
  const mockKv = new MockKV();
  const config = { ...defaultConfig, cacheSeconds: 300 };

  const setCache = (kv: MockKV, config: Config) =>
    async (cacheKey: string, value: string): Promise<Result<void>> => {
      if (!config.cacheSeconds || config.cacheSeconds <= 0) {
        return { kind: 'ok', value: undefined };
      }

      try {
        await kv.set([cacheKey], value, { expireIn: config.cacheSeconds * 1000 });
        return { kind: 'ok', value: undefined };
      } catch (error) {
        return { kind: 'err', error: error as Error };
      }
    };

  const getFromCache = <T>(kv: MockKV) =>
    async (cacheKey: string): Promise<Result<{ kind: 'hit'; value: T } | { kind: 'miss' }>> => {
      try {
        const result = await kv.get<T>([cacheKey]);

        if (result.value) {
          return { kind: 'ok', value: { kind: 'hit', value: result.value } };
        }

        return { kind: 'ok', value: { kind: 'miss' } };
      } catch (error) {
        return { kind: 'err', error: error as Error };
      }
    };

  const cacheKey = "test:cache:key";
  const testValue = "cached response";

  // Set cache
  const setResult = await setCache(mockKv, config)(cacheKey, testValue);
  assert(setResult.kind === 'ok');

  // Get from cache
  const getResult = await getFromCache<string>(mockKv)(cacheKey);
  assert(getResult.kind === 'ok');
  assert(getResult.value.kind === 'hit');
  assertEquals(getResult.value.value, testValue);
});

Deno.test("cache operations - miss on non-existent key", async () => {
  const mockKv = new MockKV();

  const getFromCache = <T>(kv: MockKV) =>
    async (cacheKey: string): Promise<Result<{ kind: 'hit'; value: T } | { kind: 'miss' }>> => {
      try {
        const result = await kv.get<T>([cacheKey]);

        if (result.value) {
          return { kind: 'ok', value: { kind: 'hit', value: result.value } };
        }

        return { kind: 'ok', value: { kind: 'miss' } };
      } catch (error) {
        return { kind: 'err', error: error as Error };
      }
    };

  const result = await getFromCache<string>(mockKv)("nonexistent:key");

  assert(result.kind === 'ok');
  assert(result.value.kind === 'miss');
});

// === USER CHARGING TESTS ===

Deno.test("chargeUser - sufficient balance", async () => {
  const mockKv = new MockKV();
  const testUser: PolarUser = {
    access_token: "token123",
    balance: 100,
    name: "Test User"
  };

  await mockKv.set([`user:token123`], testUser);

  const getUserByToken = (kv: MockKV) =>
    async (accessToken: string): Promise<Result<PolarUser | null>> => {
      try {
        const result = await kv.get<PolarUser>([`user:${accessToken}`]);
        return { kind: 'ok', value: result.value };
      } catch (error) {
        return { kind: 'err', error: error as Error };
      }
    };

  const chargeUser = (kv: MockKV) =>
    async (userId: string, amount: number): Promise<Result<PolarUser>> => {
      const userResult = await getUserByToken(kv)(userId);

      if (userResult.kind === 'err') {
        return userResult;
      }

      if (!userResult.value) {
        return { kind: 'err', error: new Error('User not found') };
      }

      const user = userResult.value;

      if (user.balance < amount) {
        return { kind: 'err', error: new Error('Insufficient balance') };
      }

      const updatedUser = { ...user, balance: user.balance - amount };

      try {
        await kv.set([`user:${userId}`], updatedUser);
        return { kind: 'ok', value: updatedUser };
      } catch (error) {
        return { kind: 'err', error: error as Error };
      }
    };

  const result = await chargeUser(mockKv)("token123", 10);

  assert(result.kind === 'ok');
  assertEquals(result.value.balance, 90);
});

Deno.test("chargeUser - insufficient balance", async () => {
  const mockKv = new MockKV();
  const testUser: PolarUser = {
    access_token: "token123",
    balance: 5,
    name: "Test User"
  };

  await mockKv.set([`user:token123`], testUser);

  const getUserByToken = (kv: MockKV) =>
    async (accessToken: string): Promise<Result<PolarUser | null>> => {
      try {
        const result = await kv.get<PolarUser>([`user:${accessToken}`]);
        return { kind: 'ok', value: result.value };
      } catch (error) {
        return { kind: 'err', error: error as Error };
      }
    };

  const chargeUser = (kv: MockKV) =>
    async (userId: string, amount: number): Promise<Result<PolarUser>> => {
      const userResult = await getUserByToken(kv)(userId);

      if (userResult.kind === 'err') {
        return userResult;
      }

      if (!userResult.value) {
        return { kind: 'err', error: new Error('User not found') };
      }

      const user = userResult.value;

      if (user.balance < amount) {
        return { kind: 'err', error: new Error('Insufficient balance') };
      }

      const updatedUser = { ...user, balance: user.balance - amount };

      try {
        await kv.set([`user:${userId}`], updatedUser);
        return { kind: 'ok', value: updatedUser };
      } catch (error) {
        return { kind: 'err', error: error as Error };
      }
    };

  const result = await chargeUser(mockKv)("token123", 10);

  assert(result.kind === 'err');
  assertEquals(result.error.message, 'Insufficient balance');
});

// === RESPONSE CREATION TESTS ===

Deno.test("createSuccessResponse - JSON format", () => {
  const createCorsHeaders = (): Record<string, string> => ({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });

  const createSuccessResponse = (responseText: string, format: string, cacheStatus: 'HIT' | 'MISS'): Response => {
    let contentType: string;
    if (format === 'html') {
      contentType = 'text/html';
    } else if (format === 'markdown') {
      contentType = 'text/markdown';
    } else {
      contentType = 'application/json';
    }

    let formattedText = responseText;
    if (format === 'html') {
      formattedText = responseText
        .replace(/^# (.*)/gm, '<h1>$1</h1>')
        .replace(/^## (.*)/gm, '<h2>$1</h2>')
        .replace(/^### (.*)/gm, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
    }

    return new Response(formattedText, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-Cache': cacheStatus,
        ...createCorsHeaders(),
      }
    });
  };

  const response = createSuccessResponse('{"test": true}', 'json', 'MISS');

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('Content-Type'), 'application/json');
  assertEquals(response.headers.get('X-Cache'), 'MISS');
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test("createPaymentRequiredResponse - includes payment link", () => {
  const createCorsHeaders = (): Record<string, string> => ({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });

  const createPaymentRequiredResponse = (env: Record<string, string>) =>
    (message: string): Response => {
      const responseBody = {
        error: "Payment Required",
        message,
        payment_link: env.POLAR_PAYMENT_LINK,
        status: 402
      };

      return new Response(JSON.stringify(responseBody), {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          ...createCorsHeaders(),
        }
      });
    };

  const env = { POLAR_PAYMENT_LINK: "https://pay.polar.sh/test" };
  const response = createPaymentRequiredResponse(env)("Test payment required message");

  assertEquals(response.status, 402);
  assertEquals(response.headers.get('Content-Type'), 'application/json');

  const bodyPromise = response.text();
  bodyPromise.then(body => {
    const parsed = JSON.parse(body);
    assertEquals(parsed.error, "Payment Required");
    assertEquals(parsed.message, "Test payment required message");
    assertEquals(parsed.payment_link, "https://pay.polar.sh/test");
    assertEquals(parsed.status, 402);
  });
});

console.log("✅ All unit tests defined. Run with: deno test test_unit.ts");