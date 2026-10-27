// Exercise the real HTTP route and generated BAML client, including native logs
// that bypass console.log. Failure modes: raw transcript CR/LF/ESC in native
// INFO output; raw model output on parse errors; encoding changes parser input.
// The local Ollama stand-in owns the client's configured port 11434 for this
// check. An occupied port fails safely rather than contacting an existing model.
// localhost can resolve to IPv4 or IPv6; neither occupied address may receive
// a request even when the other address is free.
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

if (process.argv[2] !== '--child') {
  const evidence = process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR
    || join(tmpdir(), 'classroom-widgets-test-evidence/voice-logging');
  mkdirSync(evidence, { recursive: true });
  const runChild = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [__filename, '--child'], {
      env: { ...process.env, USE_BAML: 'true', VOICE_COMMAND_DEBUG: 'false', BAML_LOG: 'info', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000
    });
    let output = '';
    child.stdout.on('data', data => output += data);
    child.stderr.on('data', data => output += data);
    child.once('error', reject);
    child.once('close', status => resolve({ status, output }));
  });
  (async () => {
    const { status, output } = await runChild();
    writeFileSync(join(evidence, 'voice-logging.txt'), output);
    assert.equal(status, 0, output);
    assert.match(output, /PASS real HTTP voice commands and malformed model response/);
    assert.match(output, /FORGED_NATIVE_TRANSCRIPT/);
    assert.ok(!/^\s*FORGED_NATIVE_(TRANSCRIPT|MODEL)/m.test(output), 'untrusted content became a physical log line');
    assert.ok(!output.includes('\u001b'), 'untrusted terminal escape reached native output');
    console.log('PASS native and JavaScript voice logs escape transcript/model control characters');
    for (const host of ['127.0.0.1', '::1']) {
      let requests = 0;
      const occupied = http.createServer((_req, res) => { requests++; res.writeHead(503); res.end(); });
      try {
        try {
          await new Promise((resolve, reject) => {
            occupied.once('error', reject);
            occupied.listen({ port: 11434, host, ipv6Only: host === '::1' }, resolve);
          });
        } catch (error) {
          if (host === '::1' && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)) continue;
          throw error;
        }
        const blocked = await runChild();
        writeFileSync(join(evidence, `voice-isolation-${host === '::1' ? 'ipv6' : 'ipv4'}.txt`),
          `childExit=${blocked.status} requestsToOccupiedListener=${requests}\n${blocked.output}`);
        assert.equal(blocked.status, 1);
        assert.equal(requests, 0, `test contacted an existing ${host} service`);
        assert.match(blocked.output, /EADDRINUSE/);
        console.log(`PASS occupied ${host}: child refused before any model request`);
      } finally {
        occupied.closeAllConnections();
        await new Promise(resolve => occupied.close(resolve));
      }
    }
  })().catch(error => { console.error(error); process.exitCode = 1; });
} else {
  const express = require('express');
  const transcript = 'applause\r\nFORGED_NATIVE_TRANSCRIPT\u001b[2J';
  let malformed = false;
  let prompt;
  let requests = 0;
  const respond = async (request, response) => {
    requests++;
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
  };
  const upstream = http.createServer(respond);
  const upstream6 = http.createServer(respond);
  const listen = (server, port, host = '127.0.0.1') => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ port, host, ipv6Only: host === '::1' }, resolve);
  });
  const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  (async () => {
    let server;
    try {
      await listen(upstream, 11434);
      // Native BAML resolves localhost itself. Own both loopback families
      // before loading the route so an IPv6-only existing service is untouched.
      try {
        await listen(upstream6, 11434, '::1');
      } catch (error) {
        if (!['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)) throw error;
      }
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
      assert.equal(requests, 2, 'both model requests must reach the owned stand-in');
      console.log('PASS real HTTP voice commands and malformed model response');
    } finally {
      if (server) await close(server);
      await close(upstream);
      await close(upstream6);
      require('../src/middleware/rateLimit').stopRateLimiterCleanup();
    }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
