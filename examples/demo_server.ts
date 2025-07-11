/**
 * Demo Server for User Agent 402 Library
 * 
 * This file demonstrates how to set up a simple API server using the User Agent 402
 * library with Polar payment integration. It provides various endpoints that showcase
 * different response formats and payment scenarios.
 */

import { initializeServer, type Config } from "../main.ts";
import OpenAI from "openai";
import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// JWT configuration
const JWT_SECRET_STRING = Deno.env.get("JWT_SECRET") || "demo-secret-key-change-in-production";

// Create JWT secret as CryptoKey
async function getJWTSecret(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET_STRING),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// User type definitions
interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  balance: number;
  created_at: string;
  polar_customer_id?: string;
}

interface UserSession {
  id: string;
  email: string;
  name: string;
  balance: number;
}

// Image generation pricing configuration
// TODO: credits can be traded to establish price, on embedded clob 
const IMAGE_PRICING = {
  "256x256": 5,    // 5 credits for small images
  "512x512": 10,   // 10 credits for medium images
  "1024x1024": 25, // 25 credits for large images
  "1792x1024": 35, // 35 credits for landscape
  "1024x1792": 35, // 35 credits for portrait
} as const;

const FREE_IMAGE_LIMIT = 2; // Free images for anonymous users

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY") || "",
});

// Authentication utility functions
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return encodeBase64(new Uint8Array(hashBuffer));
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashedInput = await hashPassword(password);
  return hashedInput === hash;
}

async function generateJWT(user: UserSession): Promise<string> {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    balance: user.balance,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  };
  
  const secret = await getJWTSecret();
  return await create({ alg: "HS256", typ: "JWT" }, payload, secret);
}

async function verifyJWT(token: string): Promise<UserSession | null> {
  try {
    const secret = await getJWTSecret();
    const payload = await verify(token, secret);
    return {
      id: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
      balance: payload.balance as number,
    };
  } catch {
    return null;
  }
}

function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Demo configuration with custom handlers
const demoConfig: Config = {
  version: 1,
  priceCredit: 1, // Cost per request for authenticated users
  freeRatelimit: 10, // Free requests per hour for anonymous users
  freeRateLimitResetSeconds: 3600, // 1 hour reset period
  cacheSeconds: 300, // 5 minutes cache
  
  // User lookup function for JWT tokens
  getUserByToken: async (token: string, kv: Deno.Kv) => {
    try {
      console.log('Custom getUserByToken called with token:', token.substring(0, 20) + '...');
      const userSession = await verifyJWT(token);
      if (!userSession) {
        console.log('No user session found');
        return null;
      }
      
      console.log('User session found:', userSession.id);
      // Get fresh user data from KV store
      const userResult = await kv.get([`user:${userSession.id}`]);
      if (!userResult.value) {
        console.log('No user data found in KV store');
        return null;
      }
      
      const user = userResult.value as User;
      const polarUser = {
        access_token: token,
        name: user.name,
        email: user.email,
        balance: user.balance,
        verified_email: 'true',
        customer_id: user.polar_customer_id || `demo_${user.id}`
      };
      console.log('Returning polar user:', polarUser);
      return polarUser;
    } catch (error) {
      console.log('Error in getUserByToken:', error);
      return null;
    }
  },

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
      // Authentication endpoints
      case '/api/auth/register':
        if (request.method === 'POST') {
          return handleRegister(request, context);
        } else {
          return new Response('Method not allowed', { status: 405 });
        }

      case '/api/auth/login':
        if (request.method === 'POST') {
          return handleLogin(request, context);
        } else {
          return new Response('Method not allowed', { status: 405 });
        }

      case '/api/auth/me':
        if (request.method === 'GET') {
          return handleGetCurrentUser(request, context);
        } else {
          return new Response('Method not allowed', { status: 405 });
        }

      // Payment endpoints
      case '/api/payment/create-checkout':
        if (request.method === 'POST') {
          return handleCreateCheckout(request, context);
        } else {
          return new Response('Method not allowed', { status: 405 });
        }

      case '/api/payment/webhook':
        if (request.method === 'POST') {
          return handlePaymentWebhook(request, context);
        } else {
          return new Response('Method not allowed', { status: 405 });
        }

      case '/api/payment/balance':
        if (request.method === 'GET') {
          return handleGetBalance(request, context);
        } else {
          return new Response('Method not allowed', { status: 405 });
        }

      // Original demo endpoints
      case '/':
        // Serve the interactive demo HTML page for browsers, API response for other clients
        if (isHtml || (!acceptHeader.includes('application/json') && !acceptHeader.includes('text/markdown'))) {
          try {
            const htmlContent = await Deno.readTextFile('./examples/index.html');
            return new Response(htmlContent, {
              status: 200,
              headers: {
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
              }
            });
          } catch (error) {
            console.error('Error serving index.html:', error);
            // Fallback to JSON response if HTML file not found
            return createDemoResponse('welcome', isHtml, isMarkdown, context);
          }
        } else {
          // Return API response for explicit JSON/markdown requests with note about interactive demo
          const response = createDemoResponse('welcome', isHtml, isMarkdown, context);
          const originalResponse = await response.json();
          const enhancedResponse = {
            ...originalResponse,
            interactive_demo: "Visit http://localhost:8000 in your browser for the full interactive demo",
            demo_features: [
              "User registration and authentication",
              "API endpoint testing",
              "Credit purchasing simulation",
              "AI image generation",
              "Rate limiting demonstration"
            ]
          };
          return new Response(JSON.stringify(enhancedResponse, null, 2), {
            status: response.status,
            headers: response.headers
          });
        }

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
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        return createDemoResponse('premium', isHtml, isMarkdown, context);

      case '/api/generate-image':
        // Handle image generation endpoint
        if (request.method === 'POST') {
          return handleImageGeneration(request, context);
        } else if (request.method === 'GET') {
          return createImageGenerationInfo(isHtml, isMarkdown);
        } else {
          return new Response('Method not allowed', { status: 405 });
        }

      default:
        return createDemoResponse('notfound', isHtml, isMarkdown, context);
    }
  }
};

// Authentication handler functions
async function handleRegister(request: Request, context: any): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validate input
    if (!email || !password || !name) {
      return new Response(JSON.stringify({
        error: "Validation Error",
        message: "Email, password, and name are required",
        status: 400
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({
        error: "Validation Error",
        message: "Invalid email format",
        status: 400
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Password validation
    if (password.length < 6) {
      return new Response(JSON.stringify({
        error: "Validation Error",
        message: "Password must be at least 6 characters long",
        status: 400
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if user already exists
    const existingUser = await context.kv.get([`user_email:${email.toLowerCase()}`]);
    if (existingUser.value) {
      return new Response(JSON.stringify({
        error: "User Exists",
        message: "A user with this email already exists",
        status: 409
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Create new user
    const userId = generateUserId();
    const passwordHash = await hashPassword(password);
    
    const newUser: User = {
      id: userId,
      email: email.toLowerCase(),
      name: name.trim(),
      passwordHash,
      balance: 100, // Give new users 100 credits to start
      created_at: new Date().toISOString(),
    };

    // Store user data
    await context.kv.set([`user:${userId}`], newUser);
    await context.kv.set([`user_email:${email.toLowerCase()}`], userId);

    // Create user session and JWT
    const userSession: UserSession = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      balance: newUser.balance,
    };

    const token = await generateJWT(userSession);

    return new Response(JSON.stringify({
      success: true,
      message: "Account created successfully",
      token,
      user: userSession
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Registration error:', error);
    console.error('Error details:', (error as Error).message, (error as Error).stack);
    return new Response(JSON.stringify({
      error: "Internal Server Error",
      message: "Failed to create account",
      status: 500
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleLogin(request: Request, context: any): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return new Response(JSON.stringify({
        error: "Validation Error",
        message: "Email and password are required",
        status: 400
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get user ID from email
    const userIdResult = await context.kv.get([`user_email:${email.toLowerCase()}`]);
    if (!userIdResult.value) {
      return new Response(JSON.stringify({
        error: "Authentication Failed",
        message: "Invalid email or password",
        status: 401
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get user data
    const userResult = await context.kv.get([`user:${userIdResult.value}`]);
    if (!userResult.value) {
      return new Response(JSON.stringify({
        error: "Authentication Failed",
        message: "Invalid email or password",
        status: 401
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const user = userResult.value as User;

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return new Response(JSON.stringify({
        error: "Authentication Failed",
        message: "Invalid email or password",
        status: 401
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Create user session and JWT
    const userSession: UserSession = {
      id: user.id,
      email: user.email,
      name: user.name,
      balance: user.balance,
    };

    const token = await generateJWT(userSession);

    return new Response(JSON.stringify({
      success: true,
      message: "Login successful",
      token,
      user: userSession
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({
      error: "Internal Server Error",
      message: "Failed to authenticate",
      status: 500
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetCurrentUser(request: Request, context: any): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        error: "Authentication Required",
        message: "Bearer token is required",
        status: 401
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const userSession = await verifyJWT(token);

    if (!userSession) {
      return new Response(JSON.stringify({
        error: "Invalid Token",
        message: "Token is invalid or expired",
        status: 401
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get fresh user data from database
    const userResult = await context.kv.get([`user:${userSession.id}`]);
    if (!userResult.value) {
      return new Response(JSON.stringify({
        error: "User Not Found",
        message: "User no longer exists",
        status: 404
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const user = userResult.value as User;
    const currentUserSession: UserSession = {
      id: user.id,
      email: user.email,
      name: user.name,
      balance: user.balance,
    };

    return new Response(JSON.stringify({
      success: true,
      user: currentUserSession
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    return new Response(JSON.stringify({
      error: "Internal Server Error",
      message: "Failed to get user data",
      status: 500
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Payment handler functions
async function handleCreateCheckout(request: Request, context: any): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const body = await request.json();
    const { credits = 100 } = body;

    // Validate credits amount
    const validCredits = [100, 250, 500, 1000];
    if (!validCredits.includes(credits)) {
      return new Response(JSON.stringify({
        error: "Invalid Credits Amount",
        message: "Credits must be one of: 100, 250, 500, 1000",
        status: 400
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // For demo purposes, we'll create a mock checkout URL
    // In a real implementation, this would integrate with Polar's API
    const checkoutUrl = `${context.env.POLAR_PAYMENT_LINK || 'https://polar.sh/checkout/demo'}?credits=${credits}`;
    
    return new Response(JSON.stringify({
      success: true,
      checkout_url: checkoutUrl,
      credits,
      amount: credits / 10, // $0.10 per credit for demo
      currency: "USD"
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Create checkout error:', error);
    return new Response(JSON.stringify({
      error: "Internal Server Error",
      message: "Failed to create checkout session",
      status: 500
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handlePaymentWebhook(request: Request, context: any): Promise<Response> {
  // This would handle Polar webhooks to credit user accounts
  // For demo purposes, we'll simulate successful payments
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const body = await request.json();
    const { user_id, credits, transaction_id } = body;

    if (!user_id || !credits || !transaction_id) {
      return new Response(JSON.stringify({
        error: "Invalid Webhook Data",
        message: "user_id, credits, and transaction_id are required",
        status: 400
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get user and update balance
    const userResult = await context.kv.get([`user:${user_id}`]);
    if (!userResult.value) {
      return new Response(JSON.stringify({
        error: "User Not Found",
        message: "User does not exist",
        status: 404
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const user = userResult.value as User;
    const updatedUser = { ...user, balance: user.balance + credits };
    await context.kv.set([`user:${user_id}`], updatedUser);

    // Log transaction
    await context.kv.set([`transaction:${transaction_id}`], {
      user_id,
      credits,
      transaction_id,
      timestamp: new Date().toISOString(),
      type: 'credit_purchase'
    });

    return new Response(JSON.stringify({
      success: true,
      message: "Payment processed successfully"
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Payment webhook error:', error);
    return new Response(JSON.stringify({
      error: "Internal Server Error",
      message: "Failed to process payment",
      status: 500
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetBalance(request: Request, context: any): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        error: "Authentication Required",
        message: "Bearer token is required",
        status: 401
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const userSession = await verifyJWT(token);

    if (!userSession) {
      return new Response(JSON.stringify({
        error: "Invalid Token",
        message: "Token is invalid or expired",
        status: 401
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get fresh user data
    const userResult = await context.kv.get([`user:${userSession.id}`]);
    if (!userResult.value) {
      return new Response(JSON.stringify({
        error: "User Not Found",
        message: "User no longer exists",
        status: 404
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const user = userResult.value as User;

    return new Response(JSON.stringify({
      success: true,
      balance: user.balance,
      user_id: user.id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Get balance error:', error);
    return new Response(JSON.stringify({
      error: "Internal Server Error",
      message: "Failed to get balance",
      status: 500
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Image generation handler function
async function handleImageGeneration(request: Request, context: any): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Parse request body
    const body = await request.json();
    const { prompt, size = "1024x1024", quality = "standard" } = body;

    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return new Response(JSON.stringify({
        error: "Invalid prompt",
        message: "Prompt is required and must be a non-empty string",
        status: 400
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Validate size
    const validSizes = Object.keys(IMAGE_PRICING) as Array<keyof typeof IMAGE_PRICING>;
    if (!validSizes.includes(size as keyof typeof IMAGE_PRICING)) {
      return new Response(JSON.stringify({
        error: "Invalid size",
        message: `Size must be one of: ${validSizes.join(', ')}`,
        status: 400
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get cost for this image size
    const cost = IMAGE_PRICING[size as keyof typeof IMAGE_PRICING];

    // Check if user is authenticated
    if (!context.user) {
      // Anonymous user - check free limit
      const freeUsageKey = `free_images:${context.clientId || 'anonymous'}`;
      const freeUsage = await context.kv.get([freeUsageKey]);
      const currentUsage = freeUsage.value || 0;

      if (currentUsage >= FREE_IMAGE_LIMIT) {
        return new Response(JSON.stringify({
          error: "Payment Required",
          message: `Free limit of ${FREE_IMAGE_LIMIT} images exceeded. Please authenticate to continue.`,
          payment_link: context.env.POLAR_PAYMENT_LINK,
          cost_per_image: cost,
          status: 402
        }), {
          status: 402,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Increment free usage
      await context.kv.set([freeUsageKey], currentUsage + 1, { expireIn: 24 * 60 * 60 * 1000 }); // 24 hours
    } else {
      // Authenticated user - check balance
      if (context.user.balance < cost) {
        return new Response(JSON.stringify({
          error: "Insufficient Credits",
          message: `Image generation requires ${cost} credits. Your balance: ${context.user.balance}`,
          payment_link: context.env.POLAR_PAYMENT_LINK,
          cost_required: cost,
          current_balance: context.user.balance,
          status: 402
        }), {
          status: 402,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Check if OpenAI API key is configured
    if (!Deno.env.get("OPENAI_API_KEY")) {
      return new Response(JSON.stringify({
        error: "Service Unavailable",
        message: "Image generation service is not configured",
        status: 503
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Generate image using OpenAI
    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt.trim(),
        size: size as "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792",
        quality: quality as "standard" | "hd",
        n: 1,
        response_format: "url"
      });

      // Charge user if authenticated
      if (context.user) {
        // Get current user data and update balance
        const userResult = await context.kv.get([`user:${context.user.id}`]);
        if (userResult.value) {
          const user = userResult.value as User;
          const updatedUser = { ...user, balance: user.balance - cost };
          await context.kv.set([`user:${context.user.id}`], updatedUser);
        }
      }

      // Validate response data
      if (!response.data || response.data.length === 0) {
        throw new Error("No image data received from OpenAI");
      }

      const imageData = response.data[0];
      if (!imageData?.url) {
        throw new Error("No image URL received from OpenAI");
      }

      // Get current free usage for response
      const freeUsageKey = `free_images:${context.clientId || 'anonymous'}`;
      const currentFreeUsage = context.user ? 0 : (await context.kv.get([freeUsageKey])).value || 0;

      return new Response(JSON.stringify({
        success: true,
        image: {
          url: imageData.url,
          revised_prompt: imageData.revised_prompt || prompt,
          size: size,
          quality: quality
        },
        cost: context.user ? cost : 0,
        remaining_balance: context.user ? Math.max(0, context.user.balance - cost) : null,
        free_generations_remaining: context.user ? null : Math.max(0, FREE_IMAGE_LIMIT - currentFreeUsage)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (openaiError) {
      console.error('OpenAI API Error:', openaiError);
      const errorMessage = openaiError instanceof Error ? openaiError.message : "Failed to generate image";
      return new Response(JSON.stringify({
        error: "Image Generation Failed",
        message: errorMessage,
        status: 500
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

  } catch (error) {
    console.error('Image generation error:', error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(JSON.stringify({
      error: "Internal Server Error",
      message: errorMessage,
      status: 500
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Helper function to create image generation info response
function createImageGenerationInfo(isHtml: boolean, isMarkdown: boolean): Response {
  const info = {
    json: {
      endpoint: "/api/generate-image",
      method: "POST",
      description: "Generate images using OpenAI DALL-E",
      pricing: IMAGE_PRICING,
      free_limit: FREE_IMAGE_LIMIT,
      parameters: {
        prompt: "string (required) - Description of the image to generate",
        size: "string (optional) - Image size: 256x256, 512x512, 1024x1024, 1792x1024, 1024x1792",
        quality: "string (optional) - Image quality: standard, hd"
      },
      authentication: "Bearer token required for unlimited generations",
      example: {
        prompt: "A serene mountain landscape at sunset",
        size: "1024x1024",
        quality: "standard"
      }
    },
    markdown: `# Image Generation API

**Endpoint**: \`POST /api/generate-image\`

Generate high-quality images using OpenAI's DALL-E model.

## Pricing
- **256x256**: ${IMAGE_PRICING["256x256"]} credits
- **512x512**: ${IMAGE_PRICING["512x512"]} credits
- **1024x1024**: ${IMAGE_PRICING["1024x1024"]} credits
- **1792x1024**: ${IMAGE_PRICING["1792x1024"]} credits (landscape)
- **1024x1792**: ${IMAGE_PRICING["1024x1792"]} credits (portrait)

## Free Tier
Anonymous users get **${FREE_IMAGE_LIMIT} free generations** before payment required.

## Parameters
- \`prompt\` (required): Description of the image
- \`size\` (optional): Image dimensions
- \`quality\` (optional): standard or hd

## Example Request
\`\`\`json
{
  "prompt": "A serene mountain landscape at sunset",
  "size": "1024x1024",
  "quality": "standard"
}
\`\`\``,
    html: `<h1>🎨 Image Generation API</h1>
<p><strong>Endpoint</strong>: <code>POST /api/generate-image</code></p>
<p>Generate high-quality images using OpenAI's DALL-E model.</p>
<h2>💰 Pricing</h2>
<ul>
  <li><strong>256x256</strong>: ${IMAGE_PRICING["256x256"]} credits</li>
  <li><strong>512x512</strong>: ${IMAGE_PRICING["512x512"]} credits</li>
  <li><strong>1024x1024</strong>: ${IMAGE_PRICING["1024x1024"]} credits</li>
  <li><strong>1792x1024</strong>: ${IMAGE_PRICING["1792x1024"]} credits (landscape)</li>
  <li><strong>1024x1792</strong>: ${IMAGE_PRICING["1024x1792"]} credits (portrait)</li>
</ul>
<h2>🆓 Free Tier</h2>
<p>Anonymous users get <strong>${FREE_IMAGE_LIMIT} free generations</strong> before payment required.</p>
<h2>📝 Parameters</h2>
<ul>
  <li><code>prompt</code> (required): Description of the image</li>
  <li><code>size</code> (optional): Image dimensions</li>
  <li><code>quality</code> (optional): standard or hd</li>
</ul>`
  };

  let content: string;
  let contentType: string;

  if (isHtml) {
    content = info.html;
    contentType = 'text/html';
  } else if (isMarkdown) {
    content = info.markdown;
    contentType = 'text/markdown';
  } else {
    content = JSON.stringify(info.json, null, 2);
    contentType = 'application/json';
  }

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

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
  console.log("📱 Interactive demo available at http://localhost:8000");
  console.log("🌐 The home page serves the complete monetized API flow demo");
  console.log("\n📋 Authentication endpoints:");
  console.log("  POST /api/auth/register     - Create new user account");
  console.log("  POST /api/auth/login        - User login");
  console.log("  GET  /api/auth/me           - Get current user info");
  console.log("\n💳 Payment endpoints:");
  console.log("  POST /api/payment/create-checkout - Create Polar checkout session");
  console.log("  POST /api/payment/webhook         - Process payment webhooks");
  console.log("  GET  /api/payment/balance         - Get user credit balance");
  console.log("\n📋 API endpoints:");
  console.log("  GET  /                      - Interactive demo home page");
  console.log("  GET  /api/status            - Server status");
  console.log("  GET  /api/user              - User information");
  console.log("  GET  /api/data              - Sample data");
  console.log("  GET  /api/premium           - Premium content (requires auth)");
  console.log("  GET  /api/generate-image    - Image generation info");
  console.log("  POST /api/generate-image    - Generate images with DALL-E");
  console.log("\n💡 Complete flow demonstration:");
  console.log("  1. Anonymous user → Free tier with rate limits");
  console.log("  2. Rate limit exceeded → Payment required (402)");
  console.log("  3. User registration → 100 free credits");
  console.log("  4. Credit purchase → Polar payment integration");
  console.log("  5. Authenticated usage → Pay-per-request model");
  console.log("\n🔑 Environment variables:");
  console.log("  JWT_SECRET         - JWT signing secret (optional, has default)");
  console.log("  OPENAI_API_KEY     - Required for image generation");
  console.log("  POLAR_PAYMENT_LINK - Polar checkout URL (optional)");

  // Create custom server that bypasses framework for auth endpoints
  const kv = await Deno.openKv();
  const env = Deno.env.toObject();
  
  const requestHandler = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
    
    // Handle home page HTML serving directly (bypass framework to avoid rate limiting)
    if (pathname === '/') {
      const acceptHeader = request.headers.get('Accept') || '';
      // Serve HTML for browsers, let framework handle JSON API requests
      if (acceptHeader.includes('text/html') || (!acceptHeader.includes('application/json') && !acceptHeader.includes('text/markdown'))) {
        try {
          const htmlContent = await Deno.readTextFile('./examples/index.html');
          return new Response(htmlContent, {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
          });
        } catch (error) {
          console.error('Error serving index.html:', error);
          // Fall through to framework handler as fallback
        }
      }
    }
    
    // Bypass framework for auth and payment endpoints
    if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/payment/')) {
      const context = { kv, env };
      return await demoConfig.fetch(request, context);
    }
    
    // Use framework for other endpoints
    const { handleRequest } = await import('../main.ts');
    return await handleRequest(demoConfig, kv, env)(request);
  };
  
  console.log("🚀 User Agent 402 server starting on port 8000");
  Deno.serve({ port: 8000 }, requestHandler);
}
