#!/usr/bin/env deno run --allow-net --allow-read --allow-write --allow-env --unstable-kv

import { initializeServer, defaultConfig } from "./main.ts";

// Create a custom config for testing
const testConfig = {
  ...defaultConfig,
  freeRatelimit: 100, // Higher limit for testing
  fetch: (_request: Request) => {
    return Promise.resolve(new Response(JSON.stringify({ 
      message: "API test successful!",
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    }));
  }
};

console.log("🧪 Starting  test server...");
await initializeServer(testConfig);