const test = require('node:test');
const assert = require('node:assert/strict');
const BAMLVoiceCommandService = require('./BAMLVoiceCommandService');
const sourceDefinitions = require('../../../shared/voiceCommandDefinitions.json');

const EXPECTED_TARGETS = Object.values(sourceDefinitions.widgets).map((widget) => widget.targetName);
const EXPECTED_ACTIONS = [
  ...Object.values(sourceDefinitions.widgets).flatMap((widget) => (
    widget.actions.map((action) => action.name)
  )),
  ...sourceDefinitions.genericActions.map((action) => action.name)
].sort();

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
  assert.deepEqual(calls[0].actionNames, EXPECTED_ACTIONS);
});

test('the widget catalog covers every widget in the shared definitions', async () => {
  const { service, calls } = makeService(() => OK_RESULT);

  await service.processVoiceCommand('start a wordle');

  const targets = calls[0].widgetTargets;
  assert.equal(targets.length, Object.keys(sourceDefinitions.widgets).length);
  for (const widget of Object.values(sourceDefinitions.widgets)) {
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
  assert.deepEqual(actions, EXPECTED_ACTIONS);
  assert.ok(actions.includes('LAUNCH_WIDGET'));
  assert.ok(actions.includes('UNKNOWN'));
});

test('the catalog matches its JSON source and getters cannot mutate later requests', () => {
  const service = new BAMLVoiceCommandService({ client: { ParseVoiceCommand: async () => OK_RESULT } });

  assert.deepEqual(service.getWidgetTargets(), EXPECTED_TARGETS);
  assert.deepEqual(service.getActionNames(), EXPECTED_ACTIONS);

  service.getWidgetTargets().length = 0;
  service.getActionNames().length = 0;

  assert.deepEqual(service.getWidgetTargets(), EXPECTED_TARGETS);
  assert.deepEqual(service.getActionNames(), EXPECTED_ACTIONS);
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
  assert.equal(result.command.target, 'unknown');
  assert.equal(result.feedback.type, 'not_understood');
  assert.match(result.feedback.message, /banana hammock/);
});

test('a low-confidence parse is normalized to UNKNOWN so the teacher cannot execute it', async () => {
  const { service } = makeService(() => ({
    action: 'CREATE_TIMER',
    target: 'timer',
    confidence: 0.3,
    parameters: { duration: 300 },
    feedback: { message: 'Creating a timer', type: 'success', shouldSpeak: true }
  }));

  const result = await service.processVoiceCommand('maybe a timer');

  assert.equal(result.success, false);
  assert.equal(result.command.action, 'UNKNOWN');
  assert.equal(result.command.target, 'unknown');
  assert.deepEqual(result.command.parameters, {});
  assert.equal(result.feedback.type, 'not_understood');
  assert.doesNotMatch(result.feedback.message, /Creating a timer/);
  assert.equal(result.command.confidence, 0.3);
});

test('an action/target mismatch is normalized to UNKNOWN', async () => {
  const { service } = makeService(() => ({
    action: 'STOP_TIMER',
    target: 'poll',
    confidence: 0.95,
    parameters: {},
    feedback: { message: 'Stopping the poll', type: 'success', shouldSpeak: true }
  }));

  const result = await service.processVoiceCommand('stop the poll');

  assert.equal(result.success, false);
  assert.equal(result.command.action, 'UNKNOWN');
  assert.equal(result.command.target, 'unknown');
  assert.equal(result.feedback.type, 'not_understood');
});

test('LAUNCH_WIDGET accepts any canonical widget target from the shared catalog', async () => {
  const { service } = makeService(() => ({
    action: 'LAUNCH_WIDGET',
    target: 'visualiser',
    confidence: 0.9,
    parameters: {}
  }));

  const result = await service.processVoiceCommand('launch the visualiser');

  assert.equal(result.success, true);
  assert.equal(result.command.action, 'LAUNCH_WIDGET');
  assert.equal(result.command.target, 'visualiser');
});

test('a client failure falls back to an UNKNOWN command with alternatives', async () => {
  const { service } = makeService(() => {
    throw new Error('ollama is not running');
  });

  const result = await service.processVoiceCommand('create a timer');

  assert.equal(result.success, false);
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
  assert.deepEqual(calls[0].actionNames, EXPECTED_ACTIONS);

  const { service: broken } = makeService(() => {
    throw new Error('connection refused');
  });
  const unhealthy = await broken.healthCheck();
  assert.equal(unhealthy.status, 'unhealthy');
  assert.equal(unhealthy.error, 'connection refused');
});
