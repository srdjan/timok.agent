# 🎉 User Agent 402 Demo - Complete Package

A comprehensive demonstration of the User Agent 402 library with Polar payment integration, showcasing how to build and interact with monetized APIs.

## 📦 What's Included

### Core Demo Files
- **`demo.html`** - Single-file web application (no dependencies required)
- **`demo_server.ts`** - Demo server with example endpoints and responses
- **`test_demo.ts`** - Automated testing script for all endpoints
- **`DEMO_README.md`** - Detailed documentation and usage guide

### Supporting Files
- **`main.ts`** - User Agent 402 library with Polar integration
- **`verify_migration.ts`** - Migration verification script
- **`deno.json`** - Updated with demo tasks

## 🚀 Quick Start Guide

### 1. Start the Demo Server
```bash
# Option 1: Use the task runner
deno task demo

# Option 2: Run directly
deno run --allow-all demo_server.ts
```

### 2. Open the Web Demo
Simply open `demo.html` in any modern web browser. No build process needed!

### 3. Test the API
```bash
# Run automated tests
deno task test-demo

# Verify migration
deno task verify
```

## 🎯 Demo Features

### 💳 **Payment Flow Demonstration**
- **Free Tier**: 10 requests per hour for anonymous users
- **Rate Limiting**: Visual progress bar and 402 responses
- **Polar Integration**: Payment links in 402 responses
- **Authentication**: Bearer token bypass for paid users

### 📄 **Multiple Response Formats**
```bash
# JSON Response
curl -H "Accept: application/json" http://localhost:8000/

# HTML Response  
curl -H "Accept: text/html" http://localhost:8000/

# Markdown Response
curl -H "Accept: text/markdown" http://localhost:8000/
```

### 🔑 **Authentication Testing**
```bash
# Anonymous request (rate limited)
curl http://localhost:8000/api/data

# Authenticated request (pay per use)
curl -H "Authorization: Bearer demo_token" http://localhost:8000/api/premium
```

### 🌐 **Available Endpoints**
- `GET /` - Welcome message with library overview
- `GET /api/status` - Server status and configuration  
- `GET /api/user` - User information (requires auth)
- `GET /api/data` - Sample data endpoint
- `GET /api/premium` - Premium content (requires auth)

## 🎨 Web Demo Features

### Interactive Controls
- **Endpoint Selection**: Dropdown with predefined endpoints + custom input
- **Response Format**: Toggle between JSON, HTML, and Markdown
- **Authentication**: Optional Bearer token input
- **Real-time Feedback**: Visual status indicators and rate limit tracking

### Visual Elements
- **Modern Design**: Clean, responsive layout with gradients
- **Status Indicators**: Color-coded success/error/payment states
- **Rate Limit Bar**: Visual progress indicator for free tier usage
- **Code Display**: Syntax-highlighted response viewer

### Mobile Responsive
- **Adaptive Layout**: Single column on mobile devices
- **Touch Friendly**: Large buttons and inputs
- **Readable Text**: Optimized typography for all screen sizes

## 🧪 Testing Scenarios

### Scenario 1: Free Tier Rate Limiting
1. Open `demo.html` in browser
2. Leave authentication unchecked
3. Make 10+ requests to any endpoint
4. Observe rate limit progression and 402 response

### Scenario 2: Authenticated Usage
1. Check "Use Authentication" 
2. Enter any Bearer token (demo accepts any value)
3. Make requests without rate limits
4. Access premium endpoints like `/api/premium`

### Scenario 3: Response Format Testing
1. Select different response formats
2. Make requests to the same endpoint
3. Observe how data is presented differently
4. Check the `Accept` header changes

### Scenario 4: Error Handling
1. Try invalid endpoints
2. Test with server stopped
3. Observe network error handling
4. Check 404 responses

## 🔧 Customization Guide

### Adding New Endpoints
Edit `demo_server.ts`:
```typescript
case '/api/your-endpoint':
  return createDemoResponse('your-data', isHtml, isMarkdown, context);
```

### Modifying Rate Limits
Update configuration:
```typescript
const demoConfig: Config = {
  freeRatelimit: 20,              // Increase free requests
  freeRateLimitResetSeconds: 1800, // 30 minutes reset
  priceCredit: 2,                 // Cost per request
};
```

### Styling Changes
Modify the `<style>` section in `demo.html`:
- Update color schemes and gradients
- Adjust layout and spacing
- Customize animations and transitions

## 📊 Architecture Highlights

### Functional Programming
- **Pure Functions**: No side effects in core logic
- **Immutable Data**: All data structures are readonly
- **Pattern Matching**: Using ts-pattern for control flow
- **Result Types**: Explicit error handling without exceptions

### Polar Integration
- **Payment Links**: 402 responses include Polar checkout URLs
- **Customer Management**: User data includes Polar customer IDs  
- **Lower Fees**: 20% lower than traditional payment processors
- **Developer-Friendly**: Modern API designed for developers

### Modern Web Standards
- **Fetch API**: Modern HTTP client
- **ES6+ Features**: Arrow functions, destructuring, async/await
- **CSS Grid/Flexbox**: Modern layout techniques
- **Responsive Design**: Mobile-first approach

## 🌟 Real-World Applications

This demo pattern is perfect for:

### API Monetization
- **AI/ML Services**: Charge per inference or model call
- **Data APIs**: Free basic data, premium for advanced datasets
- **Processing APIs**: Free small jobs, paid for large processing
- **Analytics APIs**: Free basic metrics, paid advanced analytics

### SaaS Products
- **Content APIs**: Free public content, paid premium content
- **Integration APIs**: Free tier for testing, paid for production
- **Monitoring APIs**: Free basic monitoring, paid advanced features
- **Search APIs**: Free limited searches, paid unlimited access

## 🚀 Deployment Ready

### Production Considerations
- **Environment Variables**: Set `POLAR_ACCESS_TOKEN` and `POLAR_PAYMENT_LINK`
- **Database**: Replace Deno KV with production database
- **Caching**: Add Redis or similar for distributed caching
- **Monitoring**: Add logging, metrics, and error tracking
- **Security**: Implement proper authentication and rate limiting

### Platform Options
- **Deno Deploy**: Native Deno hosting platform
- **Vercel**: Edge functions with Deno support
- **AWS Lambda**: Serverless deployment
- **Docker**: Containerized deployment
- **Traditional VPS**: Direct server deployment

## 📚 Learning Resources

### Next Steps
1. **Study the Code**: Examine the functional programming patterns
2. **Extend the Demo**: Add new endpoints and features
3. **Deploy to Production**: Use real Polar integration
4. **Build Your API**: Apply these patterns to your use case

### Key Concepts Demonstrated
- **Monetized API Design**: Balancing free and paid tiers
- **Payment Integration**: Seamless Polar checkout flow
- **Response Format Negotiation**: Content-type based responses
- **Rate Limiting Strategies**: Fair usage policies
- **Error Handling**: Graceful degradation and user feedback

## 🤝 Contributing

This demo is part of the User Agent 402 library. Contributions welcome!

1. **Fork the Repository**: Create your own copy
2. **Add Features**: Enhance the demo with new capabilities
3. **Improve Documentation**: Help others understand the concepts
4. **Share Examples**: Show how you've used the library
5. **Submit Pull Requests**: Contribute back to the community

---

**🎯 Ready to monetize your API? Start with this demo and build something amazing!**

Built with ❤️ using **User Agent 402** and **Polar**
