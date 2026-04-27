/**
 * Simple test script for the refactored server
 * Run with: node test-server.js
 */

const io = require('socket.io-client');
const axios = require('axios');

const SERVER_URL = 'http://localhost:3001';
const API_URL = `${SERVER_URL}/api`;

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

// Test results
let passed = 0;
let failed = 0;

// Helper functions
const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const test = async (name, fn) => {
  try {
    await fn();
    passed++;
    log(`✓ ${name}`, 'green');
  } catch (error) {
    failed++;
    log(`✗ ${name}`, 'red');
    log(`  Error: ${error.message}`, 'red');
  }
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
};

// Test suite
async function runTests() {
  log('\n🧪 Testing Refactored Server\n', 'blue');

  // Test 1: API Health Check
  await test('API: Health check endpoint', async () => {
    const response = await axios.get(`${SERVER_URL}/health`);
    assert(response.status === 200, 'Status should be 200');
    assert(response.data.status === 'ok', 'Status should be ok');
    assert(response.data.stats, 'Should have stats');
  });

  // Test 2: API Stats
  await test('API: Stats endpoint', async () => {
    const response = await axios.get(`${API_URL}/stats`);
    assert(response.status === 200, 'Status should be 200');
    assert(response.data.success === true, 'Should be successful');
    assert(typeof response.data.data.activeSessions === 'number', 'Should have activeSessions count');
  });

  // Test 3: Socket Connection
  await test('Socket: Can connect', async () => {
    const socket = io(SERVER_URL, { 
      transports: ['websocket'],
      reconnection: false 
    });
    
    await new Promise((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
    
    socket.disconnect();
  });

  // Test 4: Session Creation
  await test('Socket: Create session', async () => {
    const socket = io(SERVER_URL, { 
      transports: ['websocket'],
      reconnection: false 
    });
    
    await new Promise((resolve) => socket.on('connect', resolve));
    
    const result = await new Promise((resolve) => {
      socket.emit('session:create', (response) => {
        resolve(response);
      });
    });
    
    assert(result.success === true, 'Session creation should succeed');
    assert(result.code, 'Should return session code');
    assert(result.code.length === 5, 'Session code should be 5 characters');
    
    socket.disconnect();
  });

  // Test 5: Join Session
  await test('Socket: Join session', async () => {
    // First create a session
    const hostSocket = io(SERVER_URL, { 
      transports: ['websocket'],
      reconnection: false 
    });
    
    await new Promise((resolve) => hostSocket.on('connect', resolve));
    
    const session = await new Promise((resolve) => {
      hostSocket.emit('session:create', resolve);
    });
    
    // Now join it
    const participantSocket = io(SERVER_URL, { 
      transports: ['websocket'],
      reconnection: false 
    });
    
    await new Promise((resolve) => participantSocket.on('connect', resolve));
    
    const joinResult = await new Promise((resolve) => {
      participantSocket.emit('session:join', {
        code: session.code,
        name: 'Test User',
        studentId: 'test123'
      });
      
      participantSocket.on('session:joined', resolve);
    });
    
    assert(joinResult.success === true, 'Join should succeed');
    
    hostSocket.disconnect();
    participantSocket.disconnect();
  });

  // Test 6: Create Room
  await test('Socket: Create room (Poll)', async () => {
    const socket = io(SERVER_URL, { 
      transports: ['websocket'],
      reconnection: false 
    });
    
    await new Promise((resolve) => socket.on('connect', resolve));
    
    // Create session first
    const session = await new Promise((resolve) => {
      socket.emit('session:create', resolve);
    });
    
    // Create poll room
    const roomResult = await new Promise((resolve) => {
      socket.emit('session:createRoom', {
        sessionCode: session.code,
        roomType: 'poll',
        widgetId: 'test-poll-1'
      }, resolve);
    });
    
    assert(roomResult.success === true, 'Room creation should succeed');
    
    socket.disconnect();
  });

  // Test 7: API Session Check
  await test('API: Check session exists', async () => {
    // Create a session first
    const socket = io(SERVER_URL, { 
      transports: ['websocket'],
      reconnection: false 
    });
    
    await new Promise((resolve) => socket.on('connect', resolve));
    
    const session = await new Promise((resolve) => {
      socket.emit('session:create', resolve);
    });
    
    // Check via API
    const response = await axios.get(`${API_URL}/sessions/${session.code}/exists`);
    assert(response.data.exists === true, 'Session should exist');
    
    socket.disconnect();
  });

  // Test 8: Widget Types API
  await test('API: Get widget types', async () => {
    const response = await axios.get(`${API_URL}/widgets`);
    assert(response.status === 200, 'Status should be 200');
    assert(Array.isArray(response.data.data.widgets), 'Should return widgets array');
    assert(response.data.data.widgets.length === 4, 'Should have 4 widget types');
  });

  // Test 9: Voice command — known transcript matches a pattern
  await test('API: Voice command matches known transcript', async () => {
    const response = await axios.post(`${API_URL}/voice-command`, {
      transcript: 'create a timer',
      context: {},
      userPreferences: {}
    });
    assert(response.status === 200, 'Status should be 200');
    assert(response.data.success === true, 'Should match');
    assert(response.data.command.action === 'CREATE_TIMER', 'Should resolve to CREATE_TIMER');
    assert(response.data.command.target === 'timer', 'Target should be timer');
  });

  // Test 10: Voice command — intent prefilter fast path returns UNKNOWN without leaking marker
  await test('API: Voice command intent prefilter rejects gibberish without leaking marker', async () => {
    const response = await axios.post(`${API_URL}/voice-command`, {
      transcript: 'blargle wibble frobnicate quantum zebra',
      context: {},
      userPreferences: {}
    });
    assert(response.status === 200, 'Status should be 200');
    assert(response.data.success === false, 'Should not match');
    assert(response.data.command.action === 'UNKNOWN', 'Should be UNKNOWN');
    assert(!('viaIntentPrefilter' in response.data), 'Internal viaIntentPrefilter marker must not leak in response');
    assert(!('skipAIFallback' in response.data), 'Legacy skipAIFallback marker must not leak in response');
  });

  // Test 11: Voice command — randomise variants reach the pattern matcher
  await test('API: Voice command resolves randomise/randomize variants', async () => {
    for (const transcript of ['randomise', 'randomize']) {
      const response = await axios.post(`${API_URL}/voice-command`, {
        transcript,
        context: {},
        userPreferences: {}
      });
      assert(response.data.success === true, `"${transcript}" should match`);
      assert(response.data.command.action === 'RANDOMISE', `"${transcript}" should resolve to RANDOMISE`);
    }
  });

  // Test 12: Voice command health endpoint (regression: ollamaService ReferenceError)
  await test('API: Voice command health endpoint responds without error', async () => {
    const response = await axios.get(`${API_URL}/voice-command/health`);
    assert(response.status === 200, 'Status should be 200');
    assert(response.data.status === 'healthy', 'Should be healthy');
    assert('ollamaAvailable' in response.data.llmService, 'Should report ollamaAvailable');
  });

  // Summary
  log('\n📊 Test Summary', 'blue');
  log(`   Passed: ${passed}`, 'green');
  log(`   Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`   Total:  ${passed + failed}\n`, 'blue');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  log('\n❌ Test suite failed:', 'red');
  console.error(error);
  process.exit(1);
});