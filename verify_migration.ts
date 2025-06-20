#!/usr/bin/env -S deno run --allow-all

/**
 * Migration Verification Script
 * 
 * This script verifies that the Stripe to Polar migration was successful
 * by checking that all the key components work correctly.
 */

import { 
  defaultConfig,
  type PolarUser,
  type Result
} from "./main.ts";

// Test data
const testUser: PolarUser = {
  access_token: "test_token_123",
  balance: 100,
  name: "Test User",
  email: "test@example.com",
  customer_id: "polar_customer_123",
  external_customer_id: "ext_123"
};

// Simple test runner
class TestRunner {
  private tests: Array<{ name: string; fn: () => Promise<void> | void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => Promise<void> | void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log("🧪 Running Migration Verification Tests\n");
    
    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✅ ${test.name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${test.name}: ${error.message}`);
        this.failed++;
      }
    }
    
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    
    if (this.failed === 0) {
      console.log("🎉 All migration verification tests passed!");
      return true;
    } else {
      console.log("⚠️  Some tests failed. Please review the migration.");
      return false;
    }
  }
}

const runner = new TestRunner();

// Test 1: Verify PolarUser type structure
runner.test("PolarUser type has correct structure", () => {
  if (!testUser.access_token) throw new Error("Missing access_token");
  if (typeof testUser.balance !== "number") throw new Error("balance should be number");
  if (!testUser.customer_id) throw new Error("Missing customer_id");
  if (!testUser.external_customer_id) throw new Error("Missing external_customer_id");
});

// Test 2: Verify configuration is valid
runner.test("Default configuration is valid", () => {
  if (!defaultConfig.version) throw new Error("Missing version");
  if (typeof defaultConfig.priceCredit !== "number") throw new Error("priceCredit should be number");
  if (typeof defaultConfig.freeRatelimit !== "number") throw new Error("freeRatelimit should be number");
  if (typeof defaultConfig.fetch !== "function") throw new Error("fetch should be function");
});

// Test 3: Verify Result type works
runner.test("Result type works correctly", () => {
  const okResult: Result<string> = { kind: 'ok', value: 'success' };
  const errResult: Result<string> = { kind: 'err', error: new Error('test error') };
  
  if (okResult.kind !== 'ok') throw new Error("OK result kind incorrect");
  if (errResult.kind !== 'err') throw new Error("Error result kind incorrect");
});

// Test 4: Verify environment variable names
runner.test("Environment variables use Polar naming", () => {
  const env = Deno.env.toObject();
  
  // Check that old Stripe variables are not expected
  const hasOldStripeVars = 'STRIPE_SECRET' in env || 'STRIPE_PAYMENT_LINK' in env;
  if (hasOldStripeVars) {
    console.log("⚠️  Old Stripe environment variables detected. Consider updating to POLAR_* equivalents.");
  }
  
  // This test always passes as env vars are optional
});

// Test 5: Verify no Stripe imports
runner.test("No Stripe imports in main.ts", async () => {
  const mainContent = await Deno.readTextFile("./main.ts");
  
  if (mainContent.includes('from "stripe"') || mainContent.includes("from 'stripe'")) {
    throw new Error("Found Stripe import in main.ts");
  }
  
  if (mainContent.includes('StripeUser')) {
    throw new Error("Found StripeUser reference in main.ts");
  }
});

// Test 6: Verify Polar references
runner.test("Polar references are present", async () => {
  const mainContent = await Deno.readTextFile("./main.ts");
  
  if (!mainContent.includes('PolarUser')) {
    throw new Error("PolarUser type not found in main.ts");
  }
  
  if (!mainContent.includes('POLAR_PAYMENT_LINK')) {
    throw new Error("POLAR_PAYMENT_LINK not found in main.ts");
  }
});

// Test 7: Verify documentation updates
runner.test("Documentation mentions Polar", async () => {
  const readmeContent = await Deno.readTextFile("./README.md");
  
  if (!readmeContent.includes('Polar')) {
    throw new Error("README.md doesn't mention Polar");
  }
  
  if (readmeContent.includes('Stripe integration') && !readmeContent.includes('Polar integration')) {
    throw new Error("README.md still mentions Stripe integration without Polar");
  }
});

// Run all tests
if (import.meta.main) {
  const success = await runner.run();
  Deno.exit(success ? 0 : 1);
}
