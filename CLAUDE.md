# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Deno/TypeScript port of the user-agent-402 library (originally built for CloudFlare Workers). It provides a minimal framework for pay-as-you-go monetized agent-first APIs with built-in rate limiting, caching, billing, and CORS support.

## Development Commands

- **Run in development mode**: `deno task dev` (runs with file watching and all required permissions)
- **Run normally**: `deno task start`
- **Manual run**: `deno run --allow-net --allow-read --allow-write --allow-env --unstable-kv main.ts`

## Project Structure

- `main.ts` - Main implementation containing the UserAgent402 class and server logic
- `deno.json` - Deno configuration with tasks, imports, and permissions

## Key Dependencies

- `stripe` - Stripe payment processing (optional, loaded via esm.sh)
- Deno KV - Built-in key-value store for caching and rate limiting

## Architecture Overview

### Core Components

1. **UserAgent402 Class** - Main framework class handling:
   - Request routing and processing
   - Rate limiting for free users
   - User authentication via Bearer tokens
   - Response caching with versioned keys
   - Automatic CORS handling
   - Response format detection (JSON/HTML/Markdown)

2. **Rate Limiting** - Implemented using Deno KV:
   - Free tier: 10 requests per hour for anonymous/unpaid users
   - Paid users: Charged per request based on configuration

3. **Caching System** - Deno KV-based response caching:
   - Cache keys include version, pathname, query params, and response format
   - Configurable cache expiration times
   - Cache hit/miss headers

4. **Payment Integration** - Optional Stripe integration:
   - User balance tracking in Deno KV
   - Automatic charging for paid requests
   - Payment required responses (HTTP 402)

### Configuration

The default configuration can be overridden:

```typescript
const config = {
  version: 1,
  priceCredit: 1,           // Cost per request for paid users
  freeRatelimit: 10,        // Free requests per period
  freeRateLimitResetSeconds: 3600, // Rate limit reset period
  cacheSeconds: 300,        // Response cache duration
  fetch: (request, context) => { /* Custom handler */ }
};
```

### Environment Variables

- `STRIPE_SECRET` - Stripe secret key (optional)
- `STRIPE_PAYMENT_LINK` - Payment link for upgrading users

## Testing

The server runs on port 8000 by default. Test endpoints:
- `GET /` - Basic JSON response
- `GET /test.html` - HTML formatted response (when Accept: text/html)
- Rate limiting triggers after 10 requests from same IP

## Implementation Notes

- Uses Deno's native HTTP server (`Deno.serve`)
- Stripe integration is optional - server works without payment processing
- Rate limiting uses client IP as fallback identifier
- Supports automatic markdown to HTML conversion
- All responses include CORS headers for cross-origin access

## Functional Programming Architecture

The codebase follows **light functional programming principles** in TypeScript:

### Core Functional Patterns

1. **Algebraic Data Types (ADTs)**: Uses discriminated unions for modeling domain states
   - `UserState`: `anonymous | authenticated | insufficient_balance`
   - `RateLimitResult`: `allowed | exceeded`
   - `CacheResult`: `hit | miss`
   - `Result<T, E>`: `ok | err` for explicit error handling

2. **Result Type**: No exceptions - all errors handled explicitly via `Result<T, E>`
   - `ok(value)` for success cases
   - `err(error)` for error cases
   - Type-safe error handling throughout

3. **Pattern Matching**: Uses `ts-pattern` for exhaustive case handling
   - All conditionals handled via `match()` with `.exhaustive()`
   - Type-safe pattern matching on discriminated unions

4. **Pure Functions**: Side-effect free functions for data transformations
   - `parseRequestData()` - immutable request parsing
   - `getResponseFormat()` - content negotiation
   - `markdownToHtml()` - text transformation
   - `createCacheKey()` - deterministic key generation

5. **Higher-Order Functions**: Functions that return other functions
   - `createCacheKey(config)` returns cache key creator
   - `getUserByToken(kv)` returns user lookup function
   - Curried function composition throughout

6. **Immutability**: All data structures are `readonly`
   - No `let` variables - only `const`
   - Immutable updates using spread operators
   - Configuration objects marked `as const`

### Architecture Benefits

- **Type Safety**: Exhaustive pattern matching prevents runtime errors
- **Testability**: Pure functions are easy to unit test
- **Maintainability**: Clear separation of pure and effect functions
- **Composability**: Small, focused functions that compose well
- **Error Handling**: Explicit error handling without exceptions

### Functional Techniques Used

- **No Classes**: Function composition instead of OOP
- **No `this`**: Explicit parameter passing
- **No Interfaces**: Type aliases and discriminated unions
- **No Exceptions**: Result type for error handling
- **No Loops**: Declarative array methods (`map`, `filter`, `sort`)
- **No Mutations**: Immutable data transformations