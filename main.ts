import { match } from "ts-pattern";

// Result type for explicit error handling (no exceptions)
type Result<T, E = Error> = 
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'err'; readonly error: E };

// Response format discriminated union
type ResponseFormat = 'json' | 'html' | 'markdown';

// User state as ADT
type UserState = 
  | { readonly kind: 'anonymous'; readonly clientId: string }
  | { readonly kind: 'authenticated'; readonly user: StripeUser }
  | { readonly kind: 'insufficient_balance'; readonly user: StripeUser };

// Rate limit result ADT
type RateLimitResult = 
  | { readonly kind: 'allowed'; readonly remaining: number }
  | { readonly kind: 'exceeded'; readonly resetTime: number };

// Cache result ADT
type CacheResult<T> = 
  | { readonly kind: 'hit'; readonly value: T }
  | { readonly kind: 'miss' };

// === PURE DATA TYPES ===

type StripeUser = {
  readonly access_token: string;
  readonly balance: number;
  readonly name?: string;
  readonly email?: string;
  readonly verified_email?: string;
  readonly verified_user_access_token?: string;
  readonly card_fingerprint?: string;
  readonly client_reference_id?: string;
};

type RateLimitData = {
  readonly count: number;
  readonly resetTime: number;
};

type Config = {
  readonly version: number;
  readonly priceCredit: number;
  readonly freeRatelimit: number;
  readonly freeRateLimitResetSeconds: number;
  readonly cacheSeconds?: number;
  readonly fetch: (request: Request, context: Context) => Promise<Response>;
};

type Context = {
  readonly user?: StripeUser;
  readonly kv: Deno.Kv;
  readonly env: Record<string, string>;
};

type RequestData = {
  readonly url: URL;
  readonly pathname: string;
  readonly searchParams: URLSearchParams;
  readonly authToken?: string;
  readonly acceptHeader: string;
};

// === RESULT TYPE UTILITIES ===

const ok = <T>(value: T): Result<T> => ({ kind: 'ok', value });
const err = <E>(error: E): Result<never, E> => ({ kind: 'err', error });

const isOk = <T, E>(result: Result<T, E>): result is Extract<Result<T, E>, { kind: 'ok' }> =>
  result.kind === 'ok';

const isErr = <T, E>(result: Result<T, E>): result is Extract<Result<T, E>, { kind: 'err' }> =>
  result.kind === 'err';

// === PURE FUNCTIONS ===

// Parse request data immutably
const parseRequestData = (request: Request): RequestData => {
  const url = new URL(request.url);
  const authHeader = request.headers.get('Authorization');
  
  return {
    url,
    pathname: url.pathname,
    searchParams: url.searchParams,
    authToken: authHeader?.replace('Bearer ', '') || undefined,
    acceptHeader: request.headers.get('accept') || '',
  };
};

// Determine response format using pattern matching
const getResponseFormat = (requestData: RequestData): ResponseFormat => {
  const ext = requestData.pathname.split('.').pop()?.toLowerCase();
  
  return match(ext)
    .with('html', () => 'html' as const)
    .with('md', 'markdown', () => 'markdown' as const)
    .otherwise(() => 
      match(requestData.acceptHeader)
        .when((header: string) => header.includes('text/html'), () => 'html' as const)
        .when((header: string) => header.includes('text/markdown'), () => 'markdown' as const)
        .otherwise(() => 'json' as const)
    );
};

// Create cache key deterministically
const createCacheKey = (config: Config) => 
  (pathname: string, searchParams: URLSearchParams, format: ResponseFormat): string => {
    const sortedParams = Array.from(searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    return `cache:v${config.version}:${pathname}:${sortedParams}:${format}`;
  };

// Simple markdown to HTML transformation (pure function)
const markdownToHtml = (markdown: string): string =>
  markdown
    .replace(/^# (.*)/gm, '<h1>$1</h1>')
    .replace(/^## (.*)/gm, '<h2>$1</h2>')
    .replace(/^### (.*)/gm, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

// Create CORS headers (pure function)
const createCorsHeaders = (): Record<string, string> => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
});

// === EFFECT FUNCTIONS (WITH EXPLICIT ERROR HANDLING) ===

// Get user by token with Result type
const getUserByToken = (kv: Deno.Kv) => 
  async (accessToken: string): Promise<Result<StripeUser | null>> => {
    try {
      const result = await kv.get<StripeUser>([`user:${accessToken}`]);
      return ok(result.value);
    } catch (error) {
      return err(error as Error);
    }
  };

// Get rate limit data with Result type
const getRateLimitData = (kv: Deno.Kv, config: Config) => 
  async (userId: string): Promise<Result<RateLimitData>> => {
    try {
      const key = `ratelimit:${userId}`;
      const result = await kv.get<RateLimitData>([key]);
      
      const currentTime = Date.now();
      const resetTime = currentTime + (config.freeRateLimitResetSeconds * 1000);
      
      if (!result.value || currentTime > result.value.resetTime) {
        return ok({ count: 0, resetTime });
      }
      
      return ok(result.value);
    } catch (error) {
      return err(error as Error);
    }
  };

// Update rate limit with Result type
const updateRateLimit = (kv: Deno.Kv) => 
  async (userId: string, rateLimitData: RateLimitData): Promise<Result<void>> => {
    try {
      const key = `ratelimit:${userId}`;
      await kv.set([key], rateLimitData);
      return ok(undefined);
    } catch (error) {
      return err(error as Error);
    }
  };

// Check rate limit using ADTs and pattern matching
const checkRateLimit = (kv: Deno.Kv, config: Config) => 
  async (userState: UserState): Promise<Result<RateLimitResult>> => {
    return await match(userState)
      .with({ kind: 'authenticated' }, async ({ user }: { user: StripeUser }) => {
        if (user.balance > 0) {
          return ok({ kind: 'allowed', remaining: user.balance } as const);
        }
        return await checkFreeRateLimit(kv, config)(user.access_token);
      })
      .with({ kind: 'anonymous' }, async ({ clientId }: { clientId: string }) =>
        await checkFreeRateLimit(kv, config)(clientId)
      )
      .with({ kind: 'insufficient_balance' }, async ({ user }: { user: StripeUser }) =>
        await checkFreeRateLimit(kv, config)(user.access_token)
      )
      .exhaustive();
  };

// Helper for free rate limit checking
const checkFreeRateLimit = (kv: Deno.Kv, config: Config) => 
  async (clientId: string): Promise<Result<RateLimitResult>> => {
    const rateLimitResult = await getRateLimitData(kv, config)(clientId);
    
    if (isErr(rateLimitResult)) {
      return rateLimitResult;
    }
    
    const rateLimitData = rateLimitResult.value;
    
    if (rateLimitData.count >= config.freeRatelimit) {
      return ok({ kind: 'exceeded', resetTime: rateLimitData.resetTime } as const);
    }
    
    // Update count immutably
    const updatedData = { ...rateLimitData, count: rateLimitData.count + 1 };
    const updateResult = await updateRateLimit(kv)(clientId, updatedData);
    
    if (isErr(updateResult)) {
      return updateResult;
    }
    
    return ok({ kind: 'allowed', remaining: config.freeRatelimit - updatedData.count } as const);
  };

// Charge user with Result type
const chargeUser = (kv: Deno.Kv) => 
  async (userId: string, amount: number): Promise<Result<StripeUser>> => {
    const userResult = await getUserByToken(kv)(userId);
    
    if (isErr(userResult)) {
      return userResult;
    }
    
    if (!userResult.value) {
      return err(new Error('User not found'));
    }
    
    const user = userResult.value;
    
    if (user.balance < amount) {
      return err(new Error('Insufficient balance'));
    }
    
    // Update user balance immutably
    const updatedUser = { ...user, balance: user.balance - amount };
    
    try {
      await kv.set([`user:${userId}`], updatedUser);
      return ok(updatedUser);
    } catch (error) {
      return err(error as Error);
    }
  };

// Get from cache with Result type
const getFromCache = <T>(kv: Deno.Kv) => 
  async (cacheKey: string): Promise<Result<CacheResult<T>>> => {
    try {
      const result = await kv.get<T>([cacheKey]);
      
      if (result.value) {
        return ok({ kind: 'hit', value: result.value } as const);
      }
      
      return ok({ kind: 'miss' } as const);
    } catch (error) {
      return err(error as Error);
    }
  };

// Set cache with Result type
const setCache = (kv: Deno.Kv, config: Config) => 
  async (cacheKey: string, value: string): Promise<Result<void>> => {
    if (!config.cacheSeconds || config.cacheSeconds <= 0) {
      return ok(undefined);
    }
    
    try {
      await kv.set([cacheKey], value, { expireIn: config.cacheSeconds * 1000 });
      return ok(undefined);
    } catch (error) {
      return err(error as Error);
    }
  };

// === RESPONSE CREATORS ===

// Create payment required response using pattern matching
const createPaymentRequiredResponse = (env: Record<string, string>) => 
  (message: string): Response => {
    const responseBody = {
      error: "Payment Required",
      message,
      payment_link: env.STRIPE_PAYMENT_LINK,
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

// Create success response with format handling
const createSuccessResponse = (responseText: string, format: ResponseFormat, cacheStatus: 'HIT' | 'MISS'): Response => {
  const contentType = match(format)
    .with('html', () => 'text/html')
    .with('markdown', () => 'text/markdown')
    .with('json', () => 'application/json')
    .exhaustive();
    
  const formattedText = match(format)
    .with('html', () => markdownToHtml(responseText))
    .otherwise(() => responseText);
  
  return new Response(formattedText, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'X-Cache': cacheStatus,
      ...createCorsHeaders(),
    }
  });
};

// Create OPTIONS response (for CORS preflight)
const createOptionsResponse = (): Response => 
  new Response(null, {
    status: 200,
    headers: createCorsHeaders(),
  });

// === USER STATE DETERMINATION ===

// Determine user state using pattern matching
const determineUserState = (kv: Deno.Kv) => 
  async (requestData: RequestData): Promise<UserState> => {
    if (!requestData.authToken) {
      const clientId = 'anonymous'; // In real implementation, use IP or similar
      return { kind: 'anonymous', clientId };
    }
    
    const userResult = await getUserByToken(kv)(requestData.authToken);
    
    if (isErr(userResult) || !userResult.value) {
      const clientId = requestData.authToken;
      return { kind: 'anonymous', clientId };
    }
    
    const user = userResult.value;
    
    if (user.balance <= 0) {
      return { kind: 'insufficient_balance', user };
    }
    
    return { kind: 'authenticated', user };
  };

// === MAIN REQUEST HANDLER (FUNCTIONAL COMPOSITION) ===

const handleRequest = (config: Config, kv: Deno.Kv, env: Record<string, string>) => 
  async (request: Request): Promise<Response> => {
    // Handle OPTIONS request for CORS
    if (request.method === 'OPTIONS') {
      return createOptionsResponse();
    }
    
    const requestData = parseRequestData(request);
    const responseFormat = getResponseFormat(requestData);
    const cacheKey = createCacheKey(config)(requestData.pathname, requestData.searchParams, responseFormat);
    
    // Check cache first
    const cacheResult = await getFromCache<string>(kv)(cacheKey);
    
    if (isOk(cacheResult) && cacheResult.value.kind === 'hit') {
      return createSuccessResponse(cacheResult.value.value, responseFormat, 'HIT');
    }
    
    // Determine user state
    const userState = await determineUserState(kv)(requestData);
    
    // Check rate limits
    const rateLimitResult = await checkRateLimit(kv, config)(userState);
    
    if (isErr(rateLimitResult)) {
      return createPaymentRequiredResponse(env)('Rate limit check failed');
    }
    
    // Handle rate limit result using pattern matching
    const rateLimitResponse = match(rateLimitResult.value)
      .with({ kind: 'exceeded' }, ({ resetTime: _resetTime }: { resetTime: number }) => {
        const message = `Free rate limit exceeded. Limit: ${config.freeRatelimit} requests per ${config.freeRateLimitResetSeconds} seconds.`;
        return createPaymentRequiredResponse(env)(message);
      })
      .with({ kind: 'allowed' }, () => null)
      .exhaustive();
    
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // Handle charging for authenticated users using pattern matching
    const chargeResult = await match(userState)
      .with({ kind: 'authenticated' }, ({ user }: { user: StripeUser }) => {
        if (user.balance > 0) {
          return chargeUser(kv)(user.access_token, config.priceCredit);
        }
        return Promise.resolve(ok(user));
      })
      .otherwise(() => Promise.resolve(ok(null)))
      .exhaustive();
    
    if (isErr(chargeResult)) {
      return createPaymentRequiredResponse(env)('Insufficient balance. Please add funds to your account.');
    }
    
    // Execute the user's handler
    const context: Context = { 
      user: chargeResult.value || undefined, 
      kv, 
      env 
    };
    
    try {
      const response = await config.fetch(request, context);
      const responseText = await response.text();
      
      // Cache the response
      await setCache(kv, config)(cacheKey, responseText);
      
      return createSuccessResponse(responseText, responseFormat, 'MISS');
    } catch (error) {
      return createPaymentRequiredResponse(env)(`Handler error: ${error}`);
    }
  };

// === MAIN CONFIGURATION AND STARTUP ===

// Default configuration (immutable)
const defaultConfig: Config = {
  version: 1,
  priceCredit: 1,
  freeRatelimit: 10,
  freeRateLimitResetSeconds: 3600,
  cacheSeconds: 300,
  fetch: (_request: Request): Promise<Response> => {
    return Promise.resolve(new Response(JSON.stringify({ message: "Hello, world!" }), {
      headers: { 'Content-Type': 'application/json' }
    }));
  }
} as const;

// Initialize server with functional composition
const initializeServer = async (config: Config): Promise<void> => {
  const kv = await Deno.openKv();
  const env = Deno.env.toObject();
  
  console.log("🚀 User Agent 402 server starting on port 8000");
  
  // Compose the final request handler
  const requestHandler = handleRequest(config, kv, env);
  
  Deno.serve({ port: 8000 }, requestHandler);
};

// Main entry point
if (import.meta.main) {
  initializeServer(defaultConfig).catch(console.error);
}

// Export for use as a library
export { initializeServer, defaultConfig };
export type { Config, Context, StripeUser, Result };