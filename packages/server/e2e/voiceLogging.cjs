// Exercise the real HTTP route and generated BAML client, including native logs
// that bypass console.log. Failure modes: raw transcript CR/LF/ESC in native
// INFO output; raw model output on parse errors; encoding changes parser input.
// The local Ollama stand-in owns the client's configured port 11434 for this
// check. An occupied port fails safely rather than contacting an existing model.
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

if (process.argv[2] !== '--child') {
  const result = spawnSync(process.execPath, [__filename, '--child'], {
    env: { ...process.env, USE_BAML: 'true', VOICE_COMMAND_DEBUG: 'false', BAML_LOG: 'info', NO_COLOR: '1' },
    encoding: 'utf8', timeout: 30000
  });
  const output = (result.stdout || '') + (result.stderr || '');
  const evidence = process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR
    || join(tmpdir(), 'classroom-widgets-test-evidence/voice-logging');
  mkdirSync(evidence, { recursive: true });
  writeFileSync(join(evidence, 'voice-logging.txt'), output);
  assert.equal(result.status, 0, result.error?.message || output);
  assert.match(output, /PASS real HTTP voice commands and malformed model response/);
  assert.match(output, /FORGED_NATIVE_TRANSCRIPT/);
  assert.ok(!/^\s*FORGED_NATIVE_(TRANSCRIPT|MODEL)/m.test(output), 'untrusted content became a physical log line');
  assert.ok(!output.includes('\u001b'), 'untrusted terminal escape reached native output');
  console.log('PASS native and JavaScript voice logs escape transcript/model control characters');
} else {
  const express = require('express');
  const transcript = 'applause\r\nFORGED_NATIVE_TRANSCRIPT\u001b[2J';
  let malformed = false;
  let prompt;
  const upstream = http.createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    prompt = JSON.parse(body).messages;
    const content = malformed ? 'not JSON\r\nFORGED_NATIVE_MODEL\u001b[2J' : JSON.stringify({
      action: 'CREATE_SNAKE', target: 'snake', confidence: 0.9, parameters: {},
      feedback: { message: 'Snake', type: 'success', shouldSpeak: true }
    });
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({
      id: 'test', object: 'chat.completion', created: 0, model: 'local-test',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
    }));
  });
  const listen = (server, port) => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  (async () => {
    let server;
    try {
      await listen(upstream, 11434);
      const app = express();
      app.use(express.json());
      app.use('/api/voice-command', require('../src/routes/voiceCommand'));
      server = http.createServer(app);
      await listen(server, 0);
      const submit = () => fetch(`http://127.0.0.1:${server.address().port}/api/voice-command`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript })
      });
      let response = await submit();
      assert.equal(response.status, 200);
      assert.equal((await response.json()).command.action, 'CREATE_SNAKE');
      assert.ok(JSON.stringify(prompt).includes(JSON.stringify(transcript).slice(1, -1)), 'parser lost original input');
      malformed = true;
      response = await submit();
      assert.equal(response.status, 200);
      assert.equal((await response.json()).command.action, 'UNKNOWN');
      console.log('PASS real HTTP voice commands and malformed model response');
    } finally {
      if (server) await close(server);
      await close(upstream);
      require('../src/middleware/rateLimit').stopRateLimiterCleanup();
    }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
