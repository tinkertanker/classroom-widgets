#!/usr/bin/env node
/**
 * Simple BAML Test - Just check if it loads
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

  console.log('🎉 BAML integration test passed!');
  console.log('\n📝 Note: To test actual LLM parsing, make sure Ollama is running:');
  console.log('   ollama serve');
  console.log('   ollama pull gemma2:2b\n');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('\nStack trace:', error.stack);
  process.exit(1);
}
