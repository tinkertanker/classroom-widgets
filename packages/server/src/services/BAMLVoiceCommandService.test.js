const test = require('node:test');
const assert = require('node:assert/strict');
const BAMLVoiceCommandService = require('./BAMLVoiceCommandService');
const {
  VOICE_WIDGET_DEFINITIONS,
  VOICE_ACTION_NAMES
} = require('../shared/constants/voiceCommandDefinitions');

const EXPECTED_TARGETS = Object.values(VOICE_WIDGET_DEFINITIONS).map((widget) => widget.targetName);

/**
 * Build a service with a fake BAML client, so no tsx transpile or running Ollama
 * is needed. Returns the service plus the recorded calls.
 */
function makeService(handler) {
  const calls = [];
  const client = {
    async ParseVoiceCommand(transcript, widgetTargets, actionNames) {
      calls.push({ transcript, widgetTargets, actionNames });
      return handler(transcript);
    }
  };
  return { service: new BAMLVoiceCommandService({ client }), calls };
}

const OK_RESULT = {
  action: 'CREATE_WORDLE',
  target: 'wordle',
  confidence: 0.9,
  parameters: {},
  feedback: { message: 'Starting Wordle', type: 'success', shouldSpeak: true }
};

test('passes the shared widget/action catalog into ParseVoiceCommand', async () => {
  const { service, calls } = makeService(() => OK_RESULT);

  await service.processVoiceCommand('start a wordle');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].transcript, 'start a wordle');
  assert.deepEqual(calls[0].widgetTargets, EXPECTED_TARGETS);
  assert.deepEqual(calls[0].actionNames, VOICE_ACTION_NAMES);
});

test('the widget catalog covers every widget in the shared definitions', async () => {
  const { service, calls } = makeService(() => OK_RESULT);

  await service.processVoiceCommand('start a wordle');

  const targets = calls[0].widgetTargets;
  assert.equal(targets.length, Object.keys(VOICE_WIDGET_DEFINITIONS).length);
  for (const widget of Object.values(VOICE_WIDGET_DEFINITIONS)) {
    assert.ok(
      targets.includes(widget.targetName),
      `missing widget target "${widget.targetName}" in the catalog sent to the model`
    );
  }
  // Widgets that the previously hardcoded BAML prompt did not expose at all.
  for (const target of ['wordle', 'snake', 'qrcode', 'ticTacToe', 'visualiser']) {
    assert.ok(targets.includes(target), `expected newly exposed target "${target}"`);
  }
});

test('the action catalog covers every action in the shared definitions', async () => {
  const { service, calls } = makeService(() => OK_RESULT);

  await service.processVoiceCommand('play a sound effect');

  const actions = calls[0].actionNames;
  const expected = new Set();
  for (const widget of Object.values(VOICE_WIDGET_DEFINITIONS)) {
    for (const action of widget.actions) {
      expected.add(action.name);
    }
  }
  for (const name of expected) {
    assert.ok(actions.includes(name), `missing action "${name}" in the catalog sent to the model`);
  }
  // UNKNOWN is a sentinel appended by the BAML prompt template, not a catalog entry.
  assert.ok(!actions.includes('UNKNOWN'));
});

test('the catalog is derived, not a snapshot of the service module', () => {
  const service = new BAMLVoiceCommandService({ client: { ParseVoiceCommand: async () => OK_RESULT } });

  assert.deepEqual(service.getWidgetTargets(), EXPECTED_TARGETS);
  assert.deepEqual(service.getActionNames(), VOICE_ACTION_NAMES);
});

test('a recognised command is reported as a success with the model feedback', async () => {
  const { service } = makeService(() => OK_RESULT);

  const result = await service.processVoiceCommand('start a wordle');

  assert.equal(result.success, true);
  assert.equal(result.command.action, 'CREATE_WORDLE');
  assert.equal(result.command.target, 'wordle');
  assert.equal(result.command.confidence, 0.9);
  assert.equal(result.feedback.message, 'Starting Wordle');
  assert.equal(result.feedback.type, 'success');
  assert.equal(result.feedback.shouldSpeak, true);
});

test('an UNKNOWN action is not a success and gets a not_understood default feedback', async () => {
  const { service } = makeService(() => ({
    action: 'UNKNOWN',
    target: 'unknown',
    confidence: 0.9,
    parameters: {}
  }));

  const result = await service.processVoiceCommand('banana hammock');

  assert.equal(result.success, false);
  assert.equal(result.command.action, 'UNKNOWN');
  assert.equal(result.feedback.type, 'not_understood');
  assert.match(result.feedback.message, /banana hammock/);
});

test('a low-confidence parse is not a success even with a known action', async () => {
  const { service } = makeService(() => ({
    action: 'CREATE_TIMER',
    target: 'timer',
    confidence: 0.3,
    parameters: { duration: 300 }
  }));

  const result = await service.processVoiceCommand('maybe a timer');

  assert.equal(result.success, false);
  assert.equal(result.feedback.type, 'not_understood');
  assert.equal(result.command.confidence, 0.3);
});

test('a client failure falls back to an UNKNOWN command with alternatives', async () => {
  const { service } = makeService(() => {
    throw new Error('ollama is not running');
  });

  const result = await service.processVoiceCommand('create a timer');

  assert.equal(result.success, undefined);
  assert.equal(result.command.action, 'UNKNOWN');
  assert.equal(result.command.target, 'unknown');
  assert.equal(result.feedback.type, 'error');
  assert.match(result.feedback.message, /ollama is not running/);
  assert.deepEqual(
    result.alternatives.map((alternative) => alternative.action),
    ['CREATE_TIMER', 'CREATE_LIST', 'RANDOMISE']
  );
});

test('healthCheck reports healthy when the client parses, unhealthy when it throws', async () => {
  const { service: healthy, calls } = makeService(() => OK_RESULT);
  assert.equal((await healthy.healthCheck()).status, 'healthy');
  assert.deepEqual(calls[0].widgetTargets, EXPECTED_TARGETS);
  assert.deepEqual(calls[0].actionNames, VOICE_ACTION_NAMES);

  const { service: broken } = makeService(() => {
    throw new Error('connection refused');
  });
  const unhealthy = await broken.healthCheck();
  assert.equal(unhealthy.status, 'unhealthy');
  assert.equal(unhealthy.error, 'connection refused');
});
