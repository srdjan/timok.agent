# User Agent 402 - Deno Edition

A **minimal framework for pay-as-you-go monetized agent-first APIs** built with functional programming principles in TypeScript and Deno. This is a complete port of the original [user-agent-402](https://github.com/janwilmake/user-agent-402) from CloudFlare Workers to Deno with Deno KV and Polar instead of Stripe.

## Migration Benefits

### Strip -> Polar

- **Lower Fees**: Polar offers 20% lower fees than traditional payment processors
- **Developer-Friendly**: Built specifically for developers with better APIs
- **Open Source**: Transparent, community-driven development
- **Modern Architecture**: Better suited for modern web applications

### CloudFlare Functions -> Deno

- **Broader Hosting Options**: Deno has a hosting ecosystem that includes Deno Deploy, Vercel, and more
- **Modern Runtime**: Deno is a secure, performant, and modern runtime
- **Local Development**: Easy to run and test locally
- **File System Access**: No need for CloudFlare Workers' limited file system
- **Community & Ecosystem**: Strong TypeScript and Deno community support

## 🎯 **What is User Agent 402?**

User Agent 402 provides a ready-to-use framework for building **monetized APIs** that charge users per request. It handles the complex infrastructure around:

- **Authentication & Billing**: Polar integration for user payments
- **Rate Limiting**: Free tier with configurable limits
- **Response Caching**: Versioned caching with Deno KV
- **Format Negotiation**: Automatic JSON/HTML/Markdown responses
- **CORS Support**: Cross-origin request handling

Perfect for building **AI agents, data APIs, or any service** where you want to monetize usage while providing a free tier.

## 🚀 **Quick Start**

### Prerequisites

- [Deno](https://deno.land/) installed
- Optional: Polar account for payment processing

### Installation & Running

```bash
# Clone or download this repository
git clone <repository-url>
cd timok.agent

# Run with default configuration
deno task dev

# Or run manually with permissions
deno run --allow-net --allow-read --allow-write --allow-env --unstable-kv main.ts
```

The server starts on `http://localhost:8000` with a simple "Hello, world!" handler.

### Basic Usage

```bash
# Test the API
curl http://localhost:8000/

# Request HTML format
curl -H "Accept: text/html" http://localhost:8000/test.html

# After 10 requests, you'll get a payment required response
curl http://localhost:8000/  # Returns HTTP 402 after rate limit
```

## 🛠 **Configuration**

Create your own configuration by importing and customizing:

```typescript
import { initializeServer, type Config } from "./main.ts";

const myConfig: Config = {
  version: 1,
  priceCredit: 1,           // Cost per request (in cents)
  freeRatelimit: 10,        // Free requests per period
  freeRateLimitResetSeconds: 3600, // Rate limit reset (1 hour)
  cacheSeconds: 300,        // Cache responses for 5 minutes
  
  // Your custom API handler
  fetch: async (request, context) => {
    const { user, kv, env } = context;
    
    // Your API logic here
    const data = await yourApiLogic(request);
    
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

await initializeServer(myConfig);
```

## 🔧 **Environment Variables**

For payment processing (optional):

```bash
export POLAR_ACCESS_TOKEN=polar_...
export POLAR_PAYMENT_LINK=https://polar.sh/checkout/...
```

## 📊 **How It Works**

### Request Flow

1. **CORS Handling**: Automatic OPTIONS responses
2. **Cache Check**: Look for cached response first
3. **Authentication**: Check for Bearer token
4. **Rate Limiting**: Free tier limits or paid usage
5. **Billing**: Charge authenticated users per request
6. **Handler Execution**: Run your custom API logic
7. **Response Formatting**: JSON/HTML/Markdown based on Accept header
8. **Caching**: Store response for future requests

### User States

- **Anonymous**: No auth token, subject to free rate limits
- **Authenticated**: Valid token with balance, charged per request
- **Insufficient Balance**: Valid token but no credits, falls back to free tier

### Response Formats

The framework automatically detects desired format:

- **JSON**: Default format
- **HTML**: When `Accept: text/html` header or `.html` extension
- **Markdown**: When `Accept: text/markdown` header or `.md` extension

## 🧮 **Functional Programming Architecture**

This implementation showcases **light functional programming in TypeScript**:

### Core Principles

- **No Classes**: Function composition instead of OOP
- **Immutable Data**: All types are `readonly`, no `let` variables
- **Explicit Error Handling**: `Result<T, E>` type instead of exceptions
- **Pattern Matching**: Exhaustive case handling with `ts-pattern`
- **Pure Functions**: Side-effect free transformations
- **Higher-Order Functions**: Curried composition

### Key Types

```typescript
// Result type for explicit error handling
type Result<T, E = Error> = 
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'err'; readonly error: E };

// User state as algebraic data type
type UserState =
  | { readonly kind: 'anonymous'; readonly clientId: string }
  | { readonly kind: 'authenticated'; readonly user: PolarUser }
  | { readonly kind: 'insufficient_balance'; readonly user: PolarUser };
```

### Functional Benefits

- **Type Safety**: Exhaustive pattern matching prevents runtime errors
- **Testability**: Pure functions are easy to unit test
- **Maintainability**: Clear separation of pure and effect functions
- **Composability**: Small, focused functions that compose well

## 📁 **Project Structure**

```
timok.agent/
├── main.ts              # Main implementation (functional)
├── test.ts              # Test server configuration
├── deno.json            # Deno configuration & dependencies
├── CLAUDE.md            # Development guidance
├── .claude_memory       # Functional programming guidelines
└── README.md            # This file
```

## 🎨 **Features**

### ✅ **Implemented**

- ✅ Rate limiting with Deno KV
- ✅ Response caching with versioning
- ✅ Multiple response formats (JSON/HTML/Markdown)
- ✅ CORS support
- ✅ Polar integration (optional)
- ✅ Bearer token authentication
- ✅ Functional programming architecture
- ✅ Type-safe error handling

### 🚧 **Potential Enhancements**

- Webhook handling for Polar events
- Admin dashboard for user management
- Analytics and usage tracking
- Custom rate limit tiers
- Request logging and monitoring

## 🔍 **API Reference**

### Request Headers

- `Authorization: Bearer <token>` - User authentication
- `Accept: text/html` - Request HTML format
- `Accept: text/markdown` - Request Markdown format

### Response Headers

- `X-Cache: HIT|MISS` - Cache status
- `Access-Control-Allow-Origin: *` - CORS support
- `Content-Type` - Based on requested format

### HTTP Status Codes

- `200` - Success
- `402` - Payment Required (rate limited or insufficient balance)
- `500` - Internal Server Error

### Example Responses

**Success (200)**:

```json
{
  "message": "Hello, world!",
  "data": {...}
}
```

**Payment Required (402)**:

```json
{
  "error": "Payment Required",
  "message": "Free rate limit exceeded. Limit: 10 requests per 3600 seconds.",
  "payment_link": "https://polar.sh/checkout/...",
  "status": 402
}
```

## 🧪 **Testing**

```bash
# Run test server with higher rate limits
deno run --allow-net --allow-read --allow-write --allow-env --unstable-kv test.ts

# Test rate limiting
for i in {1..12}; do curl -s http://localhost:8000/test$i; done

# Test different formats
curl -H "Accept: text/html" http://localhost:8000/page.html
curl -H "Accept: text/markdown" http://localhost:8000/content.md
```

## 🤝 **Contributing**

This project follows functional programming principles. When contributing:

1. Use **immutable data structures** (`readonly` types)
2. Write **pure functions** where possible
3. Handle errors with **Result types**, not exceptions
4. Use **pattern matching** for conditionals
5. Prefer **function composition** over classes
6. Follow the existing **curried function** patterns

## 🔄 **Migration from Original**

This Deno port differs from the original CloudFlare Workers version:

### What Changed

- **Runtime**: CloudFlare Workers → Deno
- **Storage**: CloudFlare KV → Deno KV
- **Architecture**: Object-oriented → Functional programming
- **Dependencies**: Node.js packages → Deno/ESM modules
- **Configuration**: TOML → TypeScript objects

### What Stayed the Same

- Core functionality and API design
- Rate limiting and billing logic
- CORS and response format handling
- Stripe integration patterns

## 📜 **License**

This is a port of the original user-agent-402. Check the original repository for licensing information.

## 🔗 **Related Projects**

- [Original user-agent-402](https://github.com/janwilmake/user-agent-402) - CloudFlare Workers version
- [Deno](https://deno.land/) - TypeScript runtime
- [ts-pattern](https://github.com/gvergnaud/ts-pattern) - Pattern matching library

---

**Built with ❤️ using functional programming principles in TypeScript and Deno.**
