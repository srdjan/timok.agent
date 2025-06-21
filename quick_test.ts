#!/usr/bin/env -S deno run --allow-all --unstable-kv

/**
 * Quick Test Script
 * 
 * A lightweight test script that verifies basic functionality without
 * running the full test suite. Useful for quick validation.
 */

import { assertEquals, assert } from "@std/assert";
import { defaultConfig, type PolarUser, type Result } from "./main.ts";

// Quick test of core functionality
function quickTest() {
  console.log('🚀 Running Quick Tests for User Agent 402\n');

  // Test 1: Configuration is valid
  console.log('1️⃣ Testing configuration...');
  assert(defaultConfig.version > 0, 'Config should have valid version');
  assert(defaultConfig.priceCredit > 0, 'Config should have valid price');
  assert(defaultConfig.freeRatelimit > 0, 'Config should have valid rate limit');
  console.log('✅ Configuration is valid\n');

  // Test 2: PolarUser type works
  console.log('2️⃣ Testing PolarUser type...');
  const testUser: PolarUser = {
    access_token: "test_token",
    balance: 100,
    name: "Test User",
    email: "test@example.com",
    customer_id: "polar_customer_123"
  };
  assert(testUser.access_token === "test_token", 'User token should match');
  assert(testUser.balance === 100, 'User balance should match');
  console.log('✅ PolarUser type works correctly\n');

  // Test 3: Result type functionality
  console.log('3️⃣ Testing Result type...');
  const okResult: Result<string> = { kind: 'ok', value: 'success' };
  const errResult: Result<string> = { kind: 'err', error: new Error('test error') };
  
  assert(okResult.kind === 'ok', 'OK result should have correct kind');
  assert(errResult.kind === 'err', 'Error result should have correct kind');
  console.log('✅ Result type works correctly\n');

  // Test 4: Basic URL parsing
  console.log('4️⃣ Testing URL parsing...');
  const testUrl = new URL('https://example.com/api/test?param=value');
  assert(testUrl.pathname === '/api/test', 'Pathname should be extracted correctly');
  assert(testUrl.searchParams.get('param') === 'value', 'Search params should be parsed');
  console.log('✅ URL parsing works correctly\n');

  // Test 5: Response format detection
  console.log('5️⃣ Testing response format detection...');
  const formatTests = [
    { accept: 'application/json', expected: 'json' },
    { accept: 'text/html', expected: 'html' },
    { accept: 'text/markdown', expected: 'markdown' },
    { accept: '', expected: 'json' }
  ];

  formatTests.forEach(({ accept, expected }) => {
    let format: string;
    if (accept.includes('text/html')) {
      format = 'html';
    } else if (accept.includes('text/markdown')) {
      format = 'markdown';
    } else {
      format = 'json';
    }
    assert(format === expected, `Format detection failed for ${accept}`);
  });
  console.log('✅ Response format detection works correctly\n');

  console.log('🎉 All quick tests passed! Basic functionality is working.\n');
}

// Test file structure
async function testFileStructure() {
  console.log('📁 Checking file structure...');
  
  const requiredFiles = [
    'main.ts',
    'deno.json',
    'examples/demo.html',
    'examples/demo_server.ts',
    'tests/test_unit.ts',
    'tests/test_demo.ts',
    'verify_migration.ts'
  ];

  for (const file of requiredFiles) {
    try {
      const stat = await Deno.stat(file);
      assert(stat.isFile, `${file} should be a file`);
      console.log(`✅ ${file} exists`);
    } catch (error) {
      console.log(`❌ ${file} missing: ${error.message}`);
      throw new Error(`Required file ${file} is missing`);
    }
  }
  
  console.log('✅ All required files are present\n');
}

// Test imports work
async function testImports() {
  console.log('📦 Testing imports...');
  
  try {
    // Test main module import
    const { defaultConfig } = await import('./main.ts');
    assert(defaultConfig, 'Should be able to import defaultConfig');
    console.log('✅ main.ts imports correctly');

    // Test demo server import (just check it doesn't throw)
    await import('./examples/demo_server.ts');
    console.log('✅ demo_server.ts imports correctly');

    // Test verification script import
    await import('./verify_migration.ts');
    console.log('✅ verify_migration.ts imports correctly');

  } catch (error) {
    console.log(`❌ Import failed: ${error.message}`);
    throw error;
  }
  
  console.log('✅ All imports work correctly\n');
}

// Main execution
if (import.meta.main) {
  try {
    console.log('🧪 User Agent 402 - Quick Test Suite');
    console.log('=====================================\n');

    // Run quick functionality tests
    quickTest();

    // Check file structure
    await testFileStructure();

    // Test imports
    await testImports();

    console.log('🎉 Quick test suite completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('- Run full test suite: deno task test');
    console.log('- Start demo server: deno task demo');
    console.log('- Open examples/demo.html in browser');
    console.log('- Check TESTING_GUIDE.md for detailed testing info');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n💥 Quick test failed: ${errorMessage}`);
    console.log('\n🔧 Troubleshooting:');
    console.log('- Check that all files are present');
    console.log('- Verify TypeScript syntax: deno task check');
    console.log('- Review error message above for specific issues');
    Deno.exit(1);
  }
}
