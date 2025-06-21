#!/usr/bin/env -S deno run --allow-all --unstable-kv

/**
 * Test Runner Script
 * 
 * This script runs all tests in the correct order and provides a comprehensive
 * test report for the User Agent 402 library and demo application.
 */

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
}

class TestRunner {
  private results: TestResult[] = [];

  async runAllTests(): Promise<boolean> {
    console.log('🧪 Running User Agent 402 Test Suite\n');

    // Run unit tests
    await this.runTest('Unit Tests', () => this.runUnitTests());

    // Run migration verification
    await this.runTest('Migration Verification', () => this.runMigrationVerification());

    // Run demo tests (only if server is available)
    const serverRunning = await this.checkServerHealth();
    if (serverRunning) {
      await this.runTest('Demo Server Tests', () => this.runDemoTests());
    } else {
      console.log('⚠️  Demo server not running - skipping demo tests');
      console.log('💡 Start server with: deno task demo');
    }

    this.printSummary();
    return this.results.every(r => r.success);
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();

    try {
      console.log(`🔄 Running ${name}...`);
      await testFn();

      const duration = Date.now() - startTime;
      this.results.push({ name, success: true, duration });
      console.log(`✅ ${name} passed (${duration}ms)\n`);

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.push({ name, success: false, duration, error: errorMessage });
      console.log(`❌ ${name} failed (${duration}ms): ${errorMessage}\n`);
    }
  }

  private async runUnitTests(): Promise<void> {
    const process = new Deno.Command('deno', {
      args: ['test', '--allow-all', '--unstable-kv', 'tests/test_unit.ts'],
      stdout: 'piped',
      stderr: 'piped'
    });

    const { code, stdout, stderr } = await process.output();

    if (code !== 0) {
      const errorOutput = new TextDecoder().decode(stderr);
      const stdOutput = new TextDecoder().decode(stdout);
      throw new Error(`Unit tests failed:\n${stdOutput}\n${errorOutput}`);
    }

    const output = new TextDecoder().decode(stdout);
    console.log(output);
  }

  private async runMigrationVerification(): Promise<void> {
    const process = new Deno.Command('deno', {
      args: ['run', '--allow-all', '--unstable-kv', 'verify_migration.ts'],
      stdout: 'piped',
      stderr: 'piped'
    });

    const { code, stdout, stderr } = await process.output();

    if (code !== 0) {
      const errorOutput = new TextDecoder().decode(stderr);
      const stdOutput = new TextDecoder().decode(stdout);
      throw new Error(`Migration verification failed:\n${stdOutput}\n${errorOutput}`);
    }

    const output = new TextDecoder().decode(stdout);
    console.log(output);
  }

  private async runDemoTests(): Promise<void> {
    const process = new Deno.Command('deno', {
      args: ['run', '--allow-net', '--allow-env', '--unstable-kv', 'tests/test_demo.ts'],
      stdout: 'piped',
      stderr: 'piped'
    });

    const { code, stdout, stderr } = await process.output();

    if (code !== 0) {
      const errorOutput = new TextDecoder().decode(stderr);
      const stdOutput = new TextDecoder().decode(stdout);
      throw new Error(`Demo tests failed:\n${stdOutput}\n${errorOutput}`);
    }

    const output = new TextDecoder().decode(stdout);
    console.log(output);
  }

  private async checkServerHealth(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:8000/api/status', {
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private printSummary(): void {
    console.log('📊 Test Summary');
    console.log('================');

    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = total - passed;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.name}: ${r.error}`);
        });
    }

    console.log('\n💡 Tips:');
    console.log('- Run individual test suites with:');
    console.log('  deno task test-unit    # Unit tests only');
    console.log('  deno task verify       # Migration verification');
    console.log('  deno task test-demo    # Demo tests (requires server)');
    console.log('- Start demo server with: deno task demo');
    console.log('- Check test files in tests/ directory for details');
  }
}

// Type checking helper
async function checkTypeScript(): Promise<void> {
  console.log('🔍 Checking TypeScript types...');

  const files = [
    'main.ts',
    'examples/demo_server.ts',
    'tests/test_unit.ts',
    'tests/test_demo.ts',
    'verify_migration.ts'
  ];

  for (const file of files) {
    try {
      const process = new Deno.Command('deno', {
        args: ['check', file],
        stdout: 'piped',
        stderr: 'piped'
      });

      const { code, stderr } = await process.output();

      if (code !== 0) {
        const errorOutput = new TextDecoder().decode(stderr);
        throw new Error(`Type check failed for ${file}:\n${errorOutput}`);
      }

      console.log(`✅ ${file} - types OK`);
    } catch (error) {
      console.log(`❌ ${file} - type errors`);
      throw error;
    }
  }

  console.log('✅ All TypeScript files type-check successfully\n');
}

// Main execution
if (import.meta.main) {
  try {
    // First check TypeScript types
    await checkTypeScript();

    // Then run all tests
    const runner = new TestRunner();
    const success = await runner.runAllTests();

    if (success) {
      console.log('\n🎉 All tests passed! The User Agent 402 library is working correctly.');
      Deno.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Please review the errors above.');
      Deno.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n💥 Test runner failed:', errorMessage);
    Deno.exit(1);
  }
}
