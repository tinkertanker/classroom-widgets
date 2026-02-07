#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Classroom Widgets setup...\n');

// Check locations
const checks = [
  {
    name: 'Root node_modules',
    path: './node_modules',
    required: true
  },
  {
    name: 'Environment configuration',
    path: './.env',
    required: false
  },
  {
    name: 'Teacher app build',
    path: './packages/teacher/build',
    required: false
  },
  {
    name: 'Student app build',
    path: './packages/server/public/student',
    required: false
  }
];

let hasErrors = false;

checks.forEach(check => {
  const exists = fs.existsSync(check.path);
  const status = exists ? '✅' : (check.required ? '❌' : '⚠️ ');
  const message = exists ? 'Found' : (check.required ? 'Missing (required)' : 'Not found (optional)');

  console.log(`${status} ${check.name}: ${message}`);

  if (check.required && !exists) {
    hasErrors = true;
  }
});

console.log('\n' + '='.repeat(50) + '\n');

if (hasErrors) {
  console.log('❌ Setup incomplete! Run: npm install\n');
  process.exit(1);
} else {
  console.log('✅ All required dependencies are installed!\n');
  console.log('To start development, run: npm run dev:all\n');
}
