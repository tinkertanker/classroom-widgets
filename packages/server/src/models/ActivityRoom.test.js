const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const ActivityRoom = require('./ActivityRoom');

describe('ActivityRoom', () => {
  let room;

  beforeEach(() => {
    room = new ActivityRoom('TEST123', 'widget-1');
  });

  describe('constructor', () => {
    it('initializes with correct defaults', () => {
      assert.equal(room.code, 'TEST123');
      assert.equal(room.widgetId, 'widget-1');
      assert.equal(room.activityType, null);
      assert.equal(room.activity, null);
      assert.equal(room.responses.size, 0);
      assert.equal(room.isActive, false);
      assert.equal(room.answersRevealed, false);
      assert.equal(room.getType(), 'activity');
    });
  });

  describe('setActivity', () => {
    it('sets activity data correctly', () => {
      room.setActivity({
        type: 'fill-blank',
        title: 'Test Activity',
        instructions: 'Fill in the blanks',
        items: [
          { id: 'item-0', content: 'hello' },
          { id: 'item-1', content: 'world' }
        ],
        targets: [
          { id: 'blank-0', accepts: ['item-0'] },
          { id: 'blank-1', accepts: ['item-1'] }
        ],
        uiRecipe: []
      });

      assert.equal(room.activityType, 'fill-blank');
      assert.equal(room.activity.title, 'Test Activity');
      assert.equal(room.activity.items.length, 2);
      assert.equal(room.activity.targets.length, 2);
      assert.equal(room.showImmediateFeedback, true);
      assert.equal(room.allowRetry, true);
    });

    it('resets answersRevealed when setting new activity', () => {
      room.answersRevealed = true;
      room.setActivity({ type: 'fill-blank', items: [], targets: [] });
      assert.equal(room.answersRevealed, false);
    });
  });

  describe('evaluateTextInput', () => {
    it('evaluates exact match correctly', () => {
      assert.equal(room.evaluateTextInput('hello', ['hello'], 'exact'), true);
      assert.equal(room.evaluateTextInput('Hello', ['hello'], 'exact'), false);
      assert.equal(room.evaluateTextInput('  hello  ', ['hello'], 'exact'), true); // trims
      assert.equal(room.evaluateTextInput('hello world', ['hello'], 'exact'), false);
    });

    it('evaluates whitespace-flexible match correctly', () => {
      assert.equal(room.evaluateTextInput('hello', ['hello'], 'whitespace-flexible'), true);
      assert.equal(room.evaluateTextInput('hello  world', ['hello world'], 'whitespace-flexible'), true);
      assert.equal(room.evaluateTextInput('hello\n\nworld', ['hello world'], 'whitespace-flexible'), true);
      assert.equal(room.evaluateTextInput('  hello   world  ', ['hello world'], 'whitespace-flexible'), true);
      assert.equal(room.evaluateTextInput('helloworld', ['hello world'], 'whitespace-flexible'), false);
    });

    it('evaluates case-insensitive match correctly', () => {
      assert.equal(room.evaluateTextInput('Hello', ['hello'], 'case-insensitive'), true);
      assert.equal(room.evaluateTextInput('HELLO', ['hello'], 'case-insensitive'), true);
      assert.equal(room.evaluateTextInput('HeLLo', ['HELLO'], 'case-insensitive'), true);
      assert.equal(room.evaluateTextInput('hello world', ['Hello World'], 'case-insensitive'), true);
    });

    it('accepts any correct answer from the list', () => {
      assert.equal(room.evaluateTextInput('cat', ['dog', 'cat', 'bird'], 'exact'), true);
      assert.equal(room.evaluateTextInput('bird', ['dog', 'cat', 'bird'], 'exact'), true);
      assert.equal(room.evaluateTextInput('fish', ['dog', 'cat', 'bird'], 'exact'), false);
    });
  });

  describe('evaluateAnswers', () => {
    beforeEach(() => {
      room.setActivity({
        type: 'fill-blank',
        items: [
          { id: 'item-0', content: 'mitochondria' },
          { id: 'item-1', content: 'cell' },
          { id: 'item-2', content: 'nucleus' } // distractor
        ],
        targets: [
          { id: 'blank-0', accepts: ['item-0'] },
          { id: 'blank-1', accepts: ['item-1'] }
        ]
      });
    });

    it('evaluates drag-drop placements correctly', () => {
      const results = room.evaluateAnswers({
        placements: [
          { itemId: 'item-0', targetId: 'blank-0' },
          { itemId: 'item-1', targetId: 'blank-1' }
        ],
        textInputs: {}
      });

      assert.equal(results.score, 2);
      assert.equal(results.total, 2);
      assert.ok(results.correct.includes('blank-0'));
      assert.ok(results.correct.includes('blank-1'));
      assert.equal(results.incorrect.length, 0);
    });

    it('marks incorrect placements', () => {
      const results = room.evaluateAnswers({
        placements: [
          { itemId: 'item-0', targetId: 'blank-0' }, // correct
          { itemId: 'item-2', targetId: 'blank-1' }  // incorrect (nucleus instead of cell)
        ],
        textInputs: {}
      });

      assert.equal(results.score, 1);
      assert.equal(results.total, 2);
      assert.ok(results.correct.includes('blank-0'));
      assert.ok(results.incorrect.includes('blank-1'));
    });

    it('evaluates text inputs', () => {
      const results = room.evaluateAnswers({
        placements: [],
        textInputs: {
          'blank-0': 'mitochondria',
          'blank-1': 'cell'
        }
      });

      assert.equal(results.score, 2);
      assert.equal(results.total, 2);
    });

    it('marks unanswered targets as incorrect', () => {
      const results = room.evaluateAnswers({
        placements: [{ itemId: 'item-0', targetId: 'blank-0' }],
        textInputs: {}
      });

      assert.equal(results.score, 1);
      assert.equal(results.total, 2);
      assert.ok(results.incorrect.includes('blank-1'));
    });
  });

  describe('evaluateAnswers for code-fill-blank', () => {
    it('uses whitespace-flexible matching by default for code activities', () => {
      room.setActivity({
        type: 'code-fill-blank',
        items: [
          { id: 'item-0', content: 'def' },
          { id: 'item-1', content: 'return' }
        ],
        targets: [
          { id: 'blank-0', accepts: ['item-0'] },
          { id: 'blank-1', accepts: ['item-1'] }
        ]
      });

      const results = room.evaluateAnswers({
        placements: [],
        textInputs: {
          'blank-0': '  def  ', // extra whitespace
          'blank-1': 'return'
        }
      });

      assert.equal(results.score, 2);
      assert.equal(results.total, 2);
    });

    it('collapses whitespace even inside quoted strings (documented behavior)', () => {
      room.setActivity({
        type: 'code-fill-blank',
        items: [{ id: 'item-0', content: 'print("hello world")' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });

      const results = room.evaluateAnswers({
        placements: [],
        textInputs: {
          'blank-0': 'print("hello   world")' // extra space in string
        }
      });

      // Whitespace inside quotes matters semantically, but the simple
      // whitespace-flexible matcher treats it the same (debatable behavior).
      assert.equal(results.score, 1);
    });
  });

  describe('submitAnswer', () => {
    beforeEach(() => {
      room.setActivity({
        type: 'fill-blank',
        items: [{ id: 'item-0', content: 'test' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });
      room.isActive = true;
    });

    it('rejects submission when activity is not active', () => {
      room.isActive = false;
      const result = room.submitAnswer('socket-1', { placements: [], textInputs: {} });

      assert.equal(result.success, false);
      assert.equal(result.error, 'Activity not active');
    });

    it('records submission and returns results', () => {
      const result = room.submitAnswer('socket-1', {
        placements: [{ itemId: 'item-0', targetId: 'blank-0' }],
        textInputs: {}
      });

      assert.equal(result.success, true);
      assert.equal(result.results.score, 1);
      assert.equal(result.results.total, 1);
      assert.equal(room.responses.has('socket-1'), true);
    });

    it('tracks multiple student submissions', () => {
      room.submitAnswer('socket-1', { placements: [{ itemId: 'item-0', targetId: 'blank-0' }], textInputs: {} });
      room.submitAnswer('socket-2', { placements: [], textInputs: { 'blank-0': 'test' } });

      assert.equal(room.getResponseCount(), 2);
    });
  });

  describe('getActions', () => {
    beforeEach(() => {
      room.setActivity({
        type: 'fill-blank',
        items: [{ id: 'item-0', content: 'test' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });
      room.isActive = true;
    });

    it('returns submit action enabled when not submitted', () => {
      const submitAction = room.getActions('socket-1').find(a => a.type === 'submit');
      assert.ok(submitAction);
      assert.equal(submitAction.enabled, true);
    });

    it('returns retry action and disables submit after submission', () => {
      room.submitAnswer('socket-1', { placements: [], textInputs: {} });

      const actions = room.getActions('socket-1');
      const retryAction = actions.find(a => a.type === 'retry');
      const submitAction = actions.find(a => a.type === 'submit');

      assert.ok(retryAction);
      assert.equal(retryAction.enabled, true);
      assert.equal(submitAction.enabled, false);
    });
  });

  describe('revealAnswers', () => {
    beforeEach(() => {
      room.setActivity({
        type: 'fill-blank',
        items: [
          { id: 'item-0', content: 'hello' },
          { id: 'item-1', content: 'world' }
        ],
        targets: [
          { id: 'blank-0', accepts: ['item-0'] },
          { id: 'blank-1', accepts: ['item-1'] }
        ]
      });
    });

    it('sets and clears the answersRevealed flag', () => {
      room.revealAnswers(true);
      assert.equal(room.answersRevealed, true);

      room.revealAnswers(false);
      assert.equal(room.answersRevealed, false);
    });

    it('returns correct answers mapping', () => {
      const correctAnswers = room.getCorrectAnswers();

      assert.equal(correctAnswers['blank-0'], 'item-0');
      assert.equal(correctAnswers['blank-1'], 'item-1');
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      room.setActivity({
        type: 'fill-blank',
        items: [{ id: 'item-0', content: 'test' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });
      room.isActive = true;
    });

    it('clears all responses and reveal state', () => {
      room.submitAnswer('socket-1', { placements: [], textInputs: {} });
      room.submitAnswer('socket-2', { placements: [], textInputs: {} });
      room.answersRevealed = true;
      assert.equal(room.getResponseCount(), 2);

      room.reset();

      assert.equal(room.getResponseCount(), 0);
      assert.equal(room.answersRevealed, false);
    });
  });

  describe('getStateForStudent', () => {
    beforeEach(() => {
      room.setActivity({
        type: 'fill-blank',
        items: [{ id: 'item-0', content: 'test' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });
      room.isActive = true;
    });

    it('includes results only for submitted students', () => {
      room.submitAnswer('socket-1', { placements: [{ itemId: 'item-0', targetId: 'blank-0' }], textInputs: {} });

      assert.equal(room.getStateForStudent('socket-1').results.score, 1);
      assert.equal(room.getStateForStudent('socket-2').results, null);
    });

    it('includes correctAnswers only when revealed', () => {
      assert.equal(room.getStateForStudent('socket-1').correctAnswers, null);

      room.revealAnswers(true);

      assert.equal(room.getStateForStudent('socket-1').correctAnswers['blank-0'], 'item-0');
    });
  });

  describe('toJSON', () => {
    it('serializes room state correctly', () => {
      room.setActivity({
        type: 'fill-blank',
        title: 'Test',
        items: [],
        targets: []
      });
      room.isActive = true;
      room.answersRevealed = true;

      const json = room.toJSON();

      assert.equal(json.code, 'TEST123');
      assert.equal(json.widgetId, 'widget-1');
      assert.equal(json.activityType, 'fill-blank');
      assert.equal(json.isActive, true);
      assert.equal(json.answersRevealed, true);
      assert.equal(json.responseCount, 0);
    });
  });

  // Adversarial cases: student-controlled `answers` payloads must never throw,
  // because an exception in a socket handler crashes the whole server process.
  describe('malformed submissions', () => {
    beforeEach(() => {
      room.setActivity({
        type: 'fill-blank',
        items: [{ id: 'item-0', content: 'test' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });
      room.isActive = true;
    });

    it('handles null/undefined answers without throwing', () => {
      for (const answers of [null, undefined]) {
        const result = room.submitAnswer('socket-1', answers);
        assert.equal(result.success, true);
        assert.equal(result.results.score, 0);
        assert.equal(result.results.total, 1);
      }
    });

    it('handles non-object answers without throwing', () => {
      for (const answers of ['string', 42, true, []]) {
        const result = room.submitAnswer(`socket-${typeof answers}`, answers);
        assert.equal(result.success, true);
        assert.equal(result.results.score, 0);
      }
    });

    it('handles non-array placements without throwing', () => {
      for (const placements of ['not-array', 42, {}, null]) {
        const result = room.submitAnswer('socket-1', { placements, textInputs: {} });
        assert.equal(result.success, true);
        assert.equal(result.results.score, 0);
      }
    });

    it('handles placements with malformed entries', () => {
      const result = room.submitAnswer('socket-1', {
        placements: [null, 42, 'x', {}, { itemId: 'item-0', targetId: 'blank-0' }],
        textInputs: {}
      });
      assert.equal(result.success, true);
      assert.equal(result.results.score, 1); // valid entry still evaluated
    });

    it('handles null textInputs without throwing', () => {
      const result = room.submitAnswer('socket-1', { placements: [], textInputs: null });
      assert.equal(result.success, true);
      assert.equal(result.results.score, 0);
    });

    it('treats non-string text input values as incorrect instead of throwing', () => {
      for (const value of [42, null, {}, [], true]) {
        const result = room.submitAnswer('socket-1', {
          placements: [],
          textInputs: { 'blank-0': value }
        });
        assert.equal(result.success, true);
        assert.equal(result.results.score, 0, `value ${JSON.stringify(value)} should not score`);
      }
    });

    it('does not treat inherited object properties as text answers', () => {
      // '{}'.constructor exists on the prototype chain; only own keys count.
      room.setActivity({
        type: 'fill-blank',
        items: [{ id: 'item-0', content: 'test' }],
        targets: [{ id: 'constructor', accepts: ['item-0'] }]
      });
      const result = room.submitAnswer('socket-1', { placements: [], textInputs: {} });
      assert.equal(result.success, true);
      assert.equal(result.results.score, 0);
      assert.deepEqual(result.results.incorrect, ['constructor']);
    });

    it('handles targets without an accepts array', () => {
      room.setActivity({
        type: 'fill-blank',
        items: [{ id: 'item-0', content: 'test' }],
        targets: [{ id: 'blank-0' }] // no accepts
      });

      const result = room.submitAnswer('socket-1', {
        placements: [{ itemId: 'item-0', targetId: 'blank-0' }],
        textInputs: {}
      });
      assert.equal(result.success, true);
      assert.equal(result.results.score, 0);

      // getCorrectAnswers must not throw either
      assert.deepEqual(room.getCorrectAnswers(), {});
    });
  });
});
