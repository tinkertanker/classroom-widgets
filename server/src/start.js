#!/usr/bin/env node

/**
 * Environment-based server switcher
 * 
 * This script determines which server implementation to use based on:
 * 1. USE_NEW_SERVER environment variable
 * 2. NODE_ENV (production uses new server by default)
 * 3. Command line arguments
 */

const path = require('path');
const { spawn } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const forceNew = args.includes('--new');
const forceLegacy = args.includes('--legacy');

// Determine which server to use
let useNewServer = false;

if (forceNew) {
  useNewServer = true;
  console.log('🚀 Force starting NEW server (--new flag)');
} else if (forceLegacy) {
  useNewServer = false;
  console.log('🔧 Force starting LEGACY server (--legacy flag)');
} else if (process.env.USE_NEW_SERVER !== undefined) {
  useNewServer = process.env.USE_NEW_SERVER === 'true';
  console.log(`🔄 Using ${useNewServer ? 'NEW' : 'LEGACY'} server (USE_NEW_SERVER=${process.env.USE_NEW_SERVER})`);
} else if (process.env.NODE_ENV === 'production') {
  useNewServer = true;
  console.log('🚀 Using NEW server (production environment)');
} else {
  // Default to new server
  useNewServer = true;
  console.log('🚀 Using NEW server (default)');
}

// Select server file
const serverFile = useNewServer ? 'server.js' : 'index.legacy.js';
const serverPath = path.join(__dirname, serverFile);

console.log(`📁 Starting: ${serverPath}`);
console.log('');

// Start the selected server
const serverProcess = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: process.env
});

// Handle process termination
process.on('SIGINT', () => {
  serverProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM');
  process.exit(0);
});

serverProcess.on('exit', (code) => {
  process.exit(code);
});