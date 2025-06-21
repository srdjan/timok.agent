# 🧪 Testing Guide for User Agent 402

A comprehensive guide to testing the User Agent 402 library, demo application, and image generation features.

## 🚀 Quick Start

### Run All Tests
```bash
# Run the complete test suite
deno task test

# This will:
# 1. Check TypeScript types
# 2. Run unit tests
# 3. Verify migration
# 4. Test demo server (if running)
```

### Individual Test Commands
```bash
# Unit tests only
deno task test-unit

# Demo server tests (requires server running)
deno task test-demo

# Migration verification
deno task verify

# TypeScript type checking
deno task check
```

## 📋 Test Structure

### 1. **Unit Tests** (`tests/test_unit.ts`)
Tests core library functionality without external dependencies:

#### Pure Function Tests
- ✅ URL parsing and request data extraction
- ✅ Response format detection (JSON/HTML/Markdown)
- ✅ Cache key generation
- ✅ Markdown to HTML conversion
- ✅ CORS header creation

#### Result Type Tests
- ✅ Ok/Error result creation and checking
- ✅ Type safety and pattern matching

#### Database Operation Tests
- ✅ User retrieval by token
- ✅ Rate limiting logic
- ✅ Cache operations (set/get/miss)
- ✅ User charging and balance management

#### Response Creation Tests
- ✅ Success response formatting
- ✅ Payment required responses with Polar links

### 2. **Demo Server Tests** (`tests/test_demo.ts`)
Tests the demo application endpoints and integration:

#### API Endpoint Tests
- ✅ All demo endpoints (/, /api/status, /api/user, etc.)
- ✅ Multiple response formats (JSON, HTML, Markdown)
- ✅ Authentication scenarios (anonymous vs authenticated)

#### Rate Limiting Tests
- ✅ Free tier limit enforcement
- ✅ 402 Payment Required responses
- ✅ Rate limit progression tracking

#### Image Generation Tests
- ✅ Image generation endpoint info (GET)
- ✅ Anonymous user free limit testing
- ✅ Authenticated user credit testing
- ✅ Error handling for missing OpenAI API key

### 3. **Migration Verification** (`verify_migration.ts`)
Ensures successful Stripe to Polar migration:

#### Type Structure Tests
- ✅ PolarUser type validation
- ✅ Configuration validity
- ✅ Result type functionality

#### Code Migration Tests
- ✅ No remaining Stripe imports
- ✅ Proper Polar references
- ✅ Environment variable naming

#### Documentation Tests
- ✅ Updated documentation mentions Polar
- ✅ Removed Stripe references

## 🔧 Test Configuration

### Environment Variables for Testing
```bash
# Optional: For image generation tests
export OPENAI_API_KEY=sk-your-test-key

# Optional: For payment flow testing
export POLAR_ACCESS_TOKEN=polar_test_token
export POLAR_PAYMENT_LINK=https://polar.sh/checkout/test
```

### Mock Implementation
The tests use a `MockKV` class that simulates Deno KV operations:

```typescript
class MockKV {
  private data = new Map<string, { value: unknown; expireTime?: number }>();
  
  get<T>(key: Deno.KvKey): Promise<Deno.KvEntryMaybe<T>>
  set(key: Deno.KvKey, value: unknown, options?: { expireIn?: number }): Promise<Deno.KvCommitResult>
}
```

This allows testing database operations without requiring a real Deno KV instance.

## 🎯 Testing Scenarios

### Scenario 1: Basic Library Functionality
```bash
# Test core library without external dependencies
deno task test-unit

# Should pass all tests for:
# - Request parsing
# - Response formatting
# - Rate limiting logic
# - User management
# - Caching operations
```

### Scenario 2: Demo Application Integration
```bash
# Start demo server in one terminal
deno task demo

# Run demo tests in another terminal
deno task test-demo

# Tests will verify:
# - All endpoints respond correctly
# - Rate limiting works as expected
# - Authentication flows function
# - Image generation handles errors gracefully
```

### Scenario 3: Image Generation (with OpenAI)
```bash
# Set OpenAI API key
export OPENAI_API_KEY=sk-your-real-key

# Start demo server
deno task demo

# Test image generation in browser
# Open examples/demo.html
# Try generating images with different sizes
```

### Scenario 4: Payment Flow Testing
```bash
# Test anonymous user hitting limits
curl -X POST http://localhost:8000/api/generate-image \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test", "size": "256x256"}'

# Repeat 3 times to hit free limit
# Should get 402 Payment Required on 3rd attempt
```

## 📊 Test Coverage

### Core Library Coverage
- ✅ **Request Processing**: URL parsing, headers, authentication
- ✅ **Response Generation**: Multiple formats, CORS, caching
- ✅ **Rate Limiting**: Free tier, authenticated users, reset logic
- ✅ **User Management**: Token validation, balance tracking, charging
- ✅ **Error Handling**: Result types, graceful failures

### Demo Application Coverage
- ✅ **API Endpoints**: All demo endpoints with different formats
- ✅ **Authentication**: Anonymous vs authenticated flows
- ✅ **Payment Integration**: 402 responses, Polar links
- ✅ **Image Generation**: Cost calculation, free limits, error handling

### Integration Coverage
- ✅ **End-to-End Flows**: Complete user journeys
- ✅ **Error Scenarios**: Network failures, invalid inputs
- ✅ **Performance**: Response times, resource usage

## 🐛 Debugging Tests

### Common Issues and Solutions

#### 1. **Tests Fail with "Module not found"**
```bash
# Check import paths in test files
deno check tests/test_unit.ts

# Ensure main.ts exports are correct
grep -n "export" main.ts
```

#### 2. **Demo Tests Fail with Connection Error**
```bash
# Ensure demo server is running
curl http://localhost:8000/api/status

# Check server logs for errors
deno task demo
```

#### 3. **Image Generation Tests Fail**
```bash
# Check if OpenAI API key is set
echo $OPENAI_API_KEY

# Test OpenAI API directly
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

#### 4. **Type Errors in Tests**
```bash
# Run type checking
deno task check

# Fix any TypeScript errors before running tests
```

### Test Output Interpretation

#### Successful Test Run
```
🧪 Running User Agent 402 Test Suite

🔍 Checking TypeScript types...
✅ main.ts - types OK
✅ examples/demo_server.ts - types OK
✅ tests/test_unit.ts - types OK

🔄 Running Unit Tests...
✅ Unit Tests passed (1234ms)

🔄 Running Migration Verification...
✅ Migration Verification passed (567ms)

🔄 Running Demo Server Tests...
✅ Demo Server Tests passed (890ms)

📊 Test Summary
================
Total Tests: 3
Passed: 3 ✅
Failed: 0 ❌
Success Rate: 100.0%

🎉 All tests passed! The User Agent 402 library is working correctly.
```

#### Failed Test Run
```
❌ Unit Tests failed (1234ms): Test "chargeUser - sufficient balance" failed

📊 Test Summary
================
Total Tests: 3
Passed: 2 ✅
Failed: 1 ❌

❌ Failed Tests:
  - Unit Tests: Test "chargeUser - sufficient balance" failed

⚠️  Some tests failed. Please review the errors above.
```

## 🔄 Continuous Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      - name: Run tests
        run: deno task test
```

### Pre-commit Hook
```bash
#!/bin/sh
# .git/hooks/pre-commit
deno task check && deno task test-unit
```

## 📈 Performance Testing

### Load Testing Demo Server
```bash
# Install wrk (HTTP benchmarking tool)
# brew install wrk  # macOS
# apt-get install wrk  # Ubuntu

# Test basic endpoint
wrk -t12 -c400 -d30s http://localhost:8000/api/status

# Test rate limiting
wrk -t12 -c400 -d30s http://localhost:8000/api/data
```

### Memory Usage Testing
```bash
# Monitor memory usage during tests
deno task demo &
SERVER_PID=$!

# Run load tests
wrk -t4 -c100 -d60s http://localhost:8000/api/data

# Check memory usage
ps -o pid,vsz,rss,comm $SERVER_PID
kill $SERVER_PID
```

## 💡 Best Practices

### Writing New Tests
1. **Use descriptive test names** that explain what is being tested
2. **Test both success and failure cases**
3. **Use the MockKV class** for database operations
4. **Keep tests isolated** - no shared state between tests
5. **Test edge cases** like empty inputs, invalid data

### Maintaining Tests
1. **Update tests when adding features**
2. **Remove obsolete tests** when removing features
3. **Keep test data realistic** but minimal
4. **Document complex test scenarios**
5. **Run tests before committing changes**

---

**🧪 Ready to test? Run `deno task test` to verify everything works correctly!**

Built with ❤️ using **Deno**, **TypeScript**, and **functional programming patterns**
