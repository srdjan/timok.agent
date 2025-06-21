#!/usr/bin/env -S deno run --allow-net

/**
 * Demo Test Script
 * 
 * This script tests the demo server endpoints to ensure they work correctly
 * with different request formats and authentication scenarios.
 */

const BASE_URL = 'http://localhost:8000';

interface TestResult {
  endpoint: string;
  format: string;
  auth: boolean;
  status: number;
  success: boolean;
  error?: string;
}

class DemoTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Testing User Agent 402 Demo Server\n');

    const endpoints = [
      '/',
      '/api/status',
      '/api/user',
      '/api/data',
      '/api/premium'
    ];

    const formats = [
      { accept: 'application/json', name: 'JSON' },
      { accept: 'text/html', name: 'HTML' },
      { accept: 'text/markdown', name: 'Markdown' }
    ];

    // Test each endpoint with different formats
    for (const endpoint of endpoints) {
      for (const format of formats) {
        // Test without authentication
        await this.testEndpoint(endpoint, format.accept, format.name, false);

        // Test with authentication (for premium endpoint)
        if (endpoint === '/api/premium' || endpoint === '/api/user') {
          await this.testEndpoint(endpoint, format.accept, format.name, true);
        }
      }
    }

    // Test rate limiting simulation
    await this.testRateLimiting();

    // Test image generation endpoints
    await this.testImageGeneration();

    this.printResults();
  }

  private async testEndpoint(
    endpoint: string,
    accept: string,
    formatName: string,
    useAuth: boolean
  ): Promise<void> {
    const url = `${BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Accept': accept
    };

    if (useAuth) {
      headers['Authorization'] = 'Bearer demo_token_123';
    }

    try {
      const response = await fetch(url, { headers });
      const success = response.ok || response.status === 401; // 401 is expected for some endpoints

      this.results.push({
        endpoint,
        format: formatName,
        auth: useAuth,
        status: response.status,
        success
      });

      const authStr = useAuth ? '🔑' : '🆓';
      const statusStr = success ? '✅' : '❌';
      console.log(`${statusStr} ${authStr} ${endpoint} (${formatName}) - ${response.status}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.results.push({
        endpoint,
        format: formatName,
        auth: useAuth,
        status: 0,
        success: false,
        error: errorMessage
      });

      const authStr = useAuth ? '🔑' : '🆓';
      console.log(`❌ ${authStr} ${endpoint} (${formatName}) - Error: ${errorMessage}`);
    }
  }

  private async testRateLimiting(): Promise<void> {
    console.log('\n🚦 Testing Rate Limiting...');

    let requestCount = 0;
    const maxRequests = 15; // Test beyond the limit

    for (let i = 0; i < maxRequests; i++) {
      try {
        const response = await fetch(`${BASE_URL}/api/data`);
        requestCount++;

        if (response.status === 402) {
          console.log(`💳 Rate limit hit after ${requestCount} requests (expected around 10)`);
          break;
        } else if (response.ok) {
          console.log(`✅ Request ${requestCount} successful`);
        } else {
          console.log(`⚠️  Request ${requestCount} returned ${response.status}`);
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ Request ${requestCount + 1} failed: ${errorMessage}`);
        break;
      }
    }
  }

  private async testImageGeneration(): Promise<void> {
    console.log('\n🎨 Testing Image Generation...');

    // Test GET endpoint for image generation info
    try {
      const response = await fetch(`${BASE_URL}/api/generate-image`);
      const success = response.ok;

      this.results.push({
        endpoint: '/api/generate-image',
        format: 'JSON',
        auth: false,
        status: response.status,
        success
      });

      console.log(`${success ? '✅' : '❌'} GET /api/generate-image (Info) - ${response.status}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ GET /api/generate-image - Error: ${errorMessage}`);
    }

    // Test POST endpoint without auth (should hit free limit quickly)
    console.log('\n🆓 Testing anonymous image generation...');
    for (let i = 1; i <= 3; i++) {
      try {
        const response = await fetch(`${BASE_URL}/api/generate-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: `Test image ${i}`,
            size: '256x256',
            quality: 'standard'
          })
        });

        if (response.status === 402) {
          console.log(`💳 Image generation limit hit after ${i - 1} attempts (expected after 2)`);
          break;
        } else if (response.status === 503) {
          console.log(`⚠️  Image generation service not configured (OpenAI API key missing)`);
          break;
        } else if (response.ok) {
          console.log(`✅ Image ${i} generation request accepted`);
        } else {
          console.log(`⚠️  Image ${i} generation returned ${response.status}`);
        }

        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ Image generation ${i} failed: ${errorMessage}`);
        break;
      }
    }

    // Test POST endpoint with auth
    console.log('\n🔑 Testing authenticated image generation...');
    try {
      const response = await fetch(`${BASE_URL}/api/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer demo_token_123'
        },
        body: JSON.stringify({
          prompt: 'Test authenticated image',
          size: '512x512',
          quality: 'standard'
        })
      });

      if (response.status === 503) {
        console.log(`⚠️  Image generation service not configured (OpenAI API key missing)`);
      } else if (response.status === 402) {
        console.log(`💳 Insufficient credits for authenticated user`);
      } else if (response.ok) {
        console.log(`✅ Authenticated image generation request accepted`);
      } else {
        console.log(`⚠️  Authenticated image generation returned ${response.status}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ Authenticated image generation failed: ${errorMessage}`);
    }
  }

  private printResults(): void {
    console.log('\n📊 Test Summary');
    console.log('================');

    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = total - passed;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          const authStr = r.auth ? 'Auth' : 'Anon';
          console.log(`  - ${r.endpoint} (${r.format}, ${authStr}) - Status: ${r.status}${r.error ? `, Error: ${r.error}` : ''}`);
        });
    }

    console.log('\n💡 Tips:');
    console.log('- Make sure the demo server is running: deno run --allow-all demo_server.ts');
    console.log('- Open demo.html in your browser to test interactively');
    console.log('- Check the server logs for any error messages');
  }
}

// Helper function to check if server is running
async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/status`);
    return response.ok;
  } catch {
    return false;
  }
}

// Main execution
if (import.meta.main) {
  console.log('🔍 Checking if demo server is running...');

  const isServerRunning = await checkServerHealth();

  if (!isServerRunning) {
    console.log('❌ Demo server is not running or not accessible');
    console.log('💡 Start the server with: deno run --allow-all demo_server.ts');
    console.log('🌐 Server should be available at: http://localhost:8000');
    Deno.exit(1);
  }

  console.log('✅ Demo server is running\n');

  const tester = new DemoTester();
  await tester.runAllTests();
}
