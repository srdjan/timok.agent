#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env --unstable-kv

/**
 * Demo Server for User Agent 402 Library
 * 
 * This file demonstrates how to set up a simple API server using the User Agent 402
 * library with Polar payment integration. It provides various endpoints that showcase
 * different response formats and payment scenarios.
 */

import { initializeServer, type Config } from "./main.ts";

// Demo configuration with custom handlers
const demoConfig: Config = {
  version: 1,
  priceCredit: 1, // Cost per request for authenticated users
  freeRatelimit: 10, // Free requests per hour for anonymous users
  freeRateLimitResetSeconds: 3600, // 1 hour reset period
  cacheSeconds: 300, // 5 minutes cache
  
  // Custom fetch handler that provides different demo responses
  fetch: async (request: Request, context): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const acceptHeader = request.headers.get('Accept') || 'application/json';
    
    // Determine response format based on Accept header
    const isHtml = acceptHeader.includes('text/html');
    const isMarkdown = acceptHeader.includes('text/markdown');
    
    // Demo endpoints
    switch (pathname) {
      case '/':
        return createDemoResponse('welcome', isHtml, isMarkdown, context);
      
      case '/api/status':
        return createDemoResponse('status', isHtml, isMarkdown, context);
      
      case '/api/user':
        return createDemoResponse('user', isHtml, isMarkdown, context);
      
      case '/api/data':
        return createDemoResponse('data', isHtml, isMarkdown, context);
      
      case '/api/premium':
        // This endpoint requires authentication and demonstrates premium features
        if (!context.user) {
          return new Response(JSON.stringify({
            error: "Authentication Required",
            message: "This endpoint requires a valid Bearer token",
            status: 401
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return createDemoResponse('premium', isHtml, isMarkdown, context);
      
      default:
        return createDemoResponse('notfound', isHtml, isMarkdown, context);
    }
  }
};

// Helper function to create demo responses in different formats
function createDemoResponse(
  type: string, 
  isHtml: boolean, 
  isMarkdown: boolean, 
  context: any
): Response {
  const responses = {
    welcome: {
      json: {
        message: "Welcome to User Agent 402 Demo!",
        description: "A monetized API with Polar payment integration",
        features: [
          "Rate limiting for free tier users",
          "Bearer token authentication",
          "Multiple response formats (JSON, HTML, Markdown)",
          "Payment required responses (402 status)",
          "Polar payment integration"
        ],
        user: context.user ? {
          authenticated: true,
          balance: context.user.balance,
          name: context.user.name
        } : {
          authenticated: false,
          message: "Add a Bearer token to authenticate"
        },
        timestamp: new Date().toISOString()
      },
      markdown: `# Welcome to User Agent 402 Demo!

A **monetized API** with Polar payment integration.

## Features
- Rate limiting for free tier users
- Bearer token authentication  
- Multiple response formats (JSON, HTML, Markdown)
- Payment required responses (402 status)
- Polar payment integration

## User Status
${context.user ? 
  `**Authenticated**: ${context.user.name || 'User'} (Balance: ${context.user.balance})` : 
  '**Anonymous**: Add a Bearer token to authenticate'
}

*Generated at: ${new Date().toISOString()}*`,
      html: `<h1>🚀 Welcome to User Agent 402 Demo!</h1>
<p>A <strong>monetized API</strong> with Polar payment integration.</p>
<h2>✨ Features</h2>
<ul>
  <li>Rate limiting for free tier users</li>
  <li>Bearer token authentication</li>
  <li>Multiple response formats (JSON, HTML, Markdown)</li>
  <li>Payment required responses (402 status)</li>
  <li>Polar payment integration</li>
</ul>
<h2>👤 User Status</h2>
${context.user ? 
  `<p><strong>Authenticated</strong>: ${context.user.name || 'User'} (Balance: ${context.user.balance})</p>` : 
  '<p><strong>Anonymous</strong>: Add a Bearer token to authenticate</p>'
}
<p><em>Generated at: ${new Date().toISOString()}</em></p>`
    },
    
    status: {
      json: {
        status: "operational",
        server: "User Agent 402",
        version: demoConfig.version,
        payment_processor: "Polar",
        rate_limit: {
          free_tier: `${demoConfig.freeRatelimit} requests per ${demoConfig.freeRateLimitResetSeconds} seconds`,
          authenticated: "Pay per request"
        },
        cache_duration: `${demoConfig.cacheSeconds} seconds`,
        timestamp: new Date().toISOString()
      },
      markdown: `# Server Status

**Status**: ✅ Operational  
**Server**: User Agent 402  
**Version**: ${demoConfig.version}  
**Payment Processor**: Polar  

## Rate Limits
- **Free Tier**: ${demoConfig.freeRatelimit} requests per ${demoConfig.freeRateLimitResetSeconds} seconds
- **Authenticated**: Pay per request

**Cache Duration**: ${demoConfig.cacheSeconds} seconds  
**Timestamp**: ${new Date().toISOString()}`,
      html: `<h1>📊 Server Status</h1>
<p><strong>Status</strong>: ✅ Operational</p>
<p><strong>Server</strong>: User Agent 402</p>
<p><strong>Version</strong>: ${demoConfig.version}</p>
<p><strong>Payment Processor</strong>: Polar</p>
<h2>Rate Limits</h2>
<ul>
  <li><strong>Free Tier</strong>: ${demoConfig.freeRatelimit} requests per ${demoConfig.freeRateLimitResetSeconds} seconds</li>
  <li><strong>Authenticated</strong>: Pay per request</li>
</ul>
<p><strong>Cache Duration</strong>: ${demoConfig.cacheSeconds} seconds</p>
<p><strong>Timestamp</strong>: ${new Date().toISOString()}</p>`
    },
    
    user: {
      json: context.user ? {
        user: {
          id: context.user.access_token,
          name: context.user.name || "Demo User",
          email: context.user.email || "demo@example.com",
          balance: context.user.balance,
          customer_id: context.user.customer_id || "polar_demo_customer",
          verified: !!context.user.verified_email
        },
        account_type: "authenticated",
        message: "User data retrieved successfully"
      } : {
        error: "Not authenticated",
        message: "Please provide a Bearer token to access user data",
        status: 401
      },
      markdown: context.user ? 
        `# User Profile\n\n**Name**: ${context.user.name || 'Demo User'}\n**Email**: ${context.user.email || 'demo@example.com'}\n**Balance**: ${context.user.balance} credits\n**Customer ID**: ${context.user.customer_id || 'polar_demo_customer'}\n**Verified**: ${context.user.verified_email ? 'Yes' : 'No'}` :
        `# Authentication Required\n\nPlease provide a Bearer token to access user data.`,
      html: context.user ?
        `<h1>👤 User Profile</h1><p><strong>Name</strong>: ${context.user.name || 'Demo User'}</p><p><strong>Email</strong>: ${context.user.email || 'demo@example.com'}</p><p><strong>Balance</strong>: ${context.user.balance} credits</p><p><strong>Customer ID</strong>: ${context.user.customer_id || 'polar_demo_customer'}</p><p><strong>Verified</strong>: ${context.user.verified_email ? 'Yes' : 'No'}</p>` :
        `<h1>🔒 Authentication Required</h1><p>Please provide a Bearer token to access user data.</p>`
    },
    
    data: {
      json: {
        data: [
          { id: 1, name: "Sample Item 1", value: Math.random() * 100 },
          { id: 2, name: "Sample Item 2", value: Math.random() * 100 },
          { id: 3, name: "Sample Item 3", value: Math.random() * 100 }
        ],
        meta: {
          total: 3,
          generated_at: new Date().toISOString(),
          user_authenticated: !!context.user
        }
      },
      markdown: `# Sample Data\n\n| ID | Name | Value |\n|----|----|----|\n| 1 | Sample Item 1 | ${(Math.random() * 100).toFixed(2)} |\n| 2 | Sample Item 2 | ${(Math.random() * 100).toFixed(2)} |\n| 3 | Sample Item 3 | ${(Math.random() * 100).toFixed(2)} |\n\n**Total**: 3 items\n**Generated**: ${new Date().toISOString()}\n**User**: ${context.user ? 'Authenticated' : 'Anonymous'}`,
      html: `<h1>📊 Sample Data</h1><table border="1"><tr><th>ID</th><th>Name</th><th>Value</th></tr><tr><td>1</td><td>Sample Item 1</td><td>${(Math.random() * 100).toFixed(2)}</td></tr><tr><td>2</td><td>Sample Item 2</td><td>${(Math.random() * 100).toFixed(2)}</td></tr><tr><td>3</td><td>Sample Item 3</td><td>${(Math.random() * 100).toFixed(2)}</td></tr></table><p><strong>Total</strong>: 3 items</p><p><strong>Generated</strong>: ${new Date().toISOString()}</p><p><strong>User</strong>: ${context.user ? 'Authenticated' : 'Anonymous'}</p>`
    },
    
    premium: {
      json: {
        premium_data: {
          advanced_analytics: {
            user_engagement: Math.random() * 100,
            conversion_rate: Math.random() * 10,
            revenue_metrics: Math.random() * 1000
          },
          exclusive_features: [
            "Advanced reporting",
            "Priority support", 
            "Custom integrations",
            "Real-time analytics"
          ],
          user_tier: "Premium",
          credits_remaining: context.user?.balance || 0
        },
        message: "Premium content accessed successfully"
      },
      markdown: `# 💎 Premium Content\n\n## Advanced Analytics\n- **User Engagement**: ${(Math.random() * 100).toFixed(2)}%\n- **Conversion Rate**: ${(Math.random() * 10).toFixed(2)}%\n- **Revenue Metrics**: $${(Math.random() * 1000).toFixed(2)}\n\n## Exclusive Features\n- Advanced reporting\n- Priority support\n- Custom integrations\n- Real-time analytics\n\n**Credits Remaining**: ${context.user?.balance || 0}`,
      html: `<h1>💎 Premium Content</h1><h2>Advanced Analytics</h2><ul><li><strong>User Engagement</strong>: ${(Math.random() * 100).toFixed(2)}%</li><li><strong>Conversion Rate</strong>: ${(Math.random() * 10).toFixed(2)}%</li><li><strong>Revenue Metrics</strong>: $${(Math.random() * 1000).toFixed(2)}</li></ul><h2>Exclusive Features</h2><ul><li>Advanced reporting</li><li>Priority support</li><li>Custom integrations</li><li>Real-time analytics</li></ul><p><strong>Credits Remaining</strong>: ${context.user?.balance || 0}</p>`
    },
    
    notfound: {
      json: {
        error: "Not Found",
        message: "The requested endpoint does not exist",
        available_endpoints: ["/", "/api/status", "/api/user", "/api/data", "/api/premium"],
        status: 404
      },
      markdown: `# 404 - Not Found\n\nThe requested endpoint does not exist.\n\n## Available Endpoints\n- \`/\` - Welcome message\n- \`/api/status\` - Server status\n- \`/api/user\` - User information\n- \`/api/data\` - Sample data\n- \`/api/premium\` - Premium content (requires auth)`,
      html: `<h1>🔍 404 - Not Found</h1><p>The requested endpoint does not exist.</p><h2>Available Endpoints</h2><ul><li><code>/</code> - Welcome message</li><li><code>/api/status</code> - Server status</li><li><code>/api/user</code> - User information</li><li><code>/api/data</code> - Sample data</li><li><code>/api/premium</code> - Premium content (requires auth)</li></ul>`
    }
  };

  const responseData = responses[type as keyof typeof responses];
  let content: string;
  let contentType: string;

  if (isHtml) {
    content = responseData.html;
    contentType = 'text/html';
  } else if (isMarkdown) {
    content = responseData.markdown;
    contentType = 'text/markdown';
  } else {
    content = JSON.stringify(responseData.json, null, 2);
    contentType = 'application/json';
  }

  const status = type === 'notfound' ? 404 : (type === 'user' && !context.user && !isHtml && !isMarkdown) ? 401 : 200;

  return new Response(content, {
    status,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

// Start the demo server
if (import.meta.main) {
  console.log("🚀 Starting User Agent 402 Demo Server...");
  console.log("📱 Open demo.html in your browser to test the API");
  console.log("🌐 Server will be available at http://localhost:8000");
  console.log("\n📋 Available endpoints:");
  console.log("  GET /              - Welcome message");
  console.log("  GET /api/status    - Server status");
  console.log("  GET /api/user      - User information");
  console.log("  GET /api/data      - Sample data");
  console.log("  GET /api/premium   - Premium content (requires auth)");
  console.log("\n💡 Test with different Accept headers:");
  console.log("  application/json   - JSON response");
  console.log("  text/html         - HTML response");
  console.log("  text/markdown     - Markdown response");
  console.log("\n🔑 To test authentication, use any Bearer token (demo mode)");
  
  await initializeServer(demoConfig);
}
