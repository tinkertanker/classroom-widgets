#!/usr/bin/env node
/**
 * Test script for BAML Voice Command Integration
 *
 * This script tests the BAML service without needing to run the full server
 */

const BAMLVoiceCommandService = require('./server/src/services/BAMLVoiceCommandService');

async function testBAML() {
  console.log('🧪 Testing BAML Voice Command Service\n');

  const service = new BAMLVoiceCommandService();

  // Test commands
  const testCommands = [
    'start a timer for 5 minutes',
    'create a poll',
    'pick someone at random',
    'show red light',
    'make a banner saying Hello World'
  ];

  console.log('📋 Test Commands:');
  testCommands.forEach((cmd, i) => {
    console.log(`  ${i + 1}. "${cmd}"`);
  });
  console.log('\n');

  for (const command of testCommands) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: "${command}"`);
    console.log('='.repeat(60));

    try {
      const result = await service.processVoiceCommand(command);

      console.log('\n✅ Result:');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('\n❌ Error:', error.message);
    }
  }

  console.log(`\n\n${'='.repeat(60)}`);
  console.log('Health Check');
  console.log('='.repeat(60));

  const health = await service.healthCheck();
  console.log(JSON.stringify(health, null, 2));

  console.log('\n\n🎉 BAML testing complete!\n');
}

// Run the test
testBAML().catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
