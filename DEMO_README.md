# 🚀 User Agent 402 Demo Application

A minimal web application demonstrating the core capabilities of the User Agent 402 library with Polar payment integration.

## 📋 What This Demo Shows

This demo showcases how to build and interact with a **monetized API** that:

- ✅ **Rate Limits Free Users**: Anonymous users get 10 requests per hour
- 🔑 **Supports Authentication**: Bearer token authentication for paid users  
- 💳 **Handles Payment Flow**: 402 Payment Required responses with Polar integration
- 📄 **Multiple Formats**: JSON, HTML, and Markdown response formats
- ⚡ **Real-time Feedback**: Visual indicators for API states and rate limits
- 🎯 **Clean Architecture**: Functional programming with TypeScript

## 🏗️ File Structure

```
├── demo.html          # Single-file web application (no dependencies)
├── demo_server.ts     # Demo server with example endpoints
├── DEMO_README.md     # This file
└── main.ts           # User Agent 402 library (with Polar integration)
```

## 🚀 Quick Start

### 1. Start the Demo Server

```bash
# Run the demo server
deno run --allow-all demo_server.ts

# Or use the task runner
deno task dev
```

The server will start on `http://localhost:8000` with these endpoints:

- `GET /` - Welcome message with library overview
- `GET /api/status` - Server status and configuration
- `GET /api/user` - User information (requires auth)
- `GET /api/data` - Sample data endpoint
- `GET /api/premium` - Premium content (requires auth)

### 2. Open the Demo Web App

Simply open `demo.html` in your web browser. No build process or dependencies required!

### 3. Test Different Scenarios

#### 🆓 **Free Tier Testing**
1. Leave "Use Authentication" unchecked
2. Make requests to see rate limiting in action
3. After 10 requests, you'll see a 402 Payment Required response

#### 🔑 **Authenticated Testing**  
1. Check "Use Authentication"
2. Enter any Bearer token (demo accepts any token)
3. Make requests without rate limits (pay-per-request model)

#### 📄 **Response Format Testing**
- Select different response formats (JSON/HTML/Markdown)
- See how the same data is presented in different formats
- Notice the `Accept` header changes

## 🎯 Key Features Demonstrated

### Rate Limiting & Payment Flow
```javascript
// Free users hit rate limits
if (requestCount > maxFreeRequests) {
  // Returns 402 Payment Required with Polar checkout link
  return {
    error: "Payment Required",
    message: "Free rate limit exceeded",
    payment_link: "https://polar.sh/checkout/...",
    status: 402
  };
}
```

### Multiple Response Formats
```javascript
// Same endpoint, different formats based on Accept header
Accept: application/json  → JSON response
Accept: text/html        → HTML response  
Accept: text/markdown    → Markdown response
```

### Authentication Flow
```javascript
// Bearer token authentication
Authorization: Bearer your_token_here

// Authenticated users bypass rate limits but pay per request
```

## 🔧 Customization

### Adding New Endpoints

Edit `demo_server.ts` to add new endpoints:

```typescript
case '/api/your-endpoint':
  return createDemoResponse('your-data', isHtml, isMarkdown, context);
```

### Modifying Rate Limits

Update the configuration in `demo_server.ts`:

```typescript
const demoConfig: Config = {
  freeRatelimit: 20,              // Increase free requests
  freeRateLimitResetSeconds: 1800, // 30 minutes reset
  priceCredit: 2,                 // Cost per authenticated request
  // ...
};
```

### Styling the Web App

The demo uses embedded CSS in `demo.html`. Modify the `<style>` section to customize:

- Colors and gradients
- Layout and spacing  
- Responsive breakpoints
- Animation effects

## 🌐 Integration Examples

### JavaScript Fetch API
```javascript
// Basic request
const response = await fetch('http://localhost:8000/api/data', {
  headers: {
    'Accept': 'application/json',
    'Authorization': 'Bearer your_token' // Optional
  }
});

// Handle 402 Payment Required
if (response.status === 402) {
  const error = await response.json();
  window.open(error.payment_link, '_blank'); // Redirect to Polar
}
```

### cURL Testing
```bash
# Anonymous request (rate limited)
curl http://localhost:8000/api/data

# Authenticated request  
curl -H "Authorization: Bearer demo_token" \
     http://localhost:8000/api/premium

# Request HTML format
curl -H "Accept: text/html" \
     http://localhost:8000/
```

### Python Requests
```python
import requests

# Test rate limiting
for i in range(15):  # Exceed free limit
    response = requests.get('http://localhost:8000/api/data')
    if response.status_code == 402:
        print("Payment required:", response.json())
        break
```

## 💡 Real-World Usage

This demo pattern works for:

- **AI/ML APIs**: Charge per inference or model call
- **Data APIs**: Rate limit free tier, charge for premium data
- **Analytics APIs**: Free basic metrics, paid advanced analytics  
- **Content APIs**: Free public content, paid premium content
- **Processing APIs**: Free small jobs, paid large processing

## 🔗 Polar Integration

The demo shows how User Agent 402 integrates with Polar:

1. **Payment Links**: 402 responses include Polar checkout URLs
2. **Customer Management**: User data includes Polar customer IDs
3. **Billing**: Automatic per-request charging for authenticated users
4. **Lower Fees**: 20% lower fees compared to traditional processors

## 🛠️ Development

### Running Tests
```bash
deno test test_unit.ts
```

### Type Checking
```bash
deno check demo_server.ts
deno check main.ts
```

### Linting
```bash
deno lint
```

## 📚 Next Steps

1. **Deploy to Production**: Use Deno Deploy or your preferred platform
2. **Add Real Authentication**: Integrate with your auth system
3. **Connect Polar**: Set up real Polar webhooks and customer management
4. **Add Monitoring**: Track usage, revenue, and performance
5. **Scale**: Add caching, load balancing, and database persistence

## 🤝 Contributing

This demo is part of the User Agent 402 library. Contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Add your improvements
4. Submit a pull request

## 📄 License

MIT License - see the main project for details.

---

**Built with ❤️ using User Agent 402 and Polar**
