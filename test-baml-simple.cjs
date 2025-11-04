#!/usr/bin/env node
/**
 * Simple BAML Test - CommonJS version
 */

console.log('🧪 Testing BAML Integration\n');

try {
  console.log('1. Loading BAML client...');
  const { b } = require('./baml_client');
  console.log('✅ BAML client loaded successfully\n');

  console.log('2. Client methods available:');
  console.log('  - ParseVoiceCommand:', typeof b.ParseVoiceCommand);
  console.log('');

  console.log('3. Loading BAMLVoiceCommandService...');
  const BAMLService = require('./server/src/services/BAMLVoiceCommandService');
  console.log('✅ BAMLVoiceCommandService loaded successfully\n');

  console.log('4. Creating service instance...');
  const service = new BAMLService();
  console.log('✅ Service instance created\n');

  console.log('5. Service info:');
  const info = service.getInfo();
  console.log(JSON.stringify(info, null, 2));

  console.log('\n🎉 BAML integration test passed!');
  console.log('\n📝 To test with Ollama, set USE_BAML=true in server/.env');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('\nStack trace:', error.stack);
  process.exit(1);
}
