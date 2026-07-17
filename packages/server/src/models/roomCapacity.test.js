const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const QuestionsRoom = require('./QuestionsRoom');
const LinkShareRoom = require('./LinkShareRoom');
const { LIMITS } = require('../config/constants');

// Resource-exhaustion regression tests: these caps exist in constants but
// were previously never enforced, letting students grow server memory
// without bound.

describe('QuestionsRoom capacity', () => {
  it('rejects questions beyond MAX_QUESTIONS_PER_ROOM', () => {
    const room = new QuestionsRoom('CODE1', 'w-1');
    room.questions = Array.from({ length: LIMITS.MAX_QUESTIONS_PER_ROOM }, (_, i) => ({
      id: `q-${i}`,
      answered: false
    }));

    const rejected = room.addQuestion('sock-1', 'One more?', 'Ada');

    assert.equal(rejected, null);
    assert.equal(room.getQuestionCount(), LIMITS.MAX_QUESTIONS_PER_ROOM);
  });

  it('accepts questions again after clearing', () => {
    const room = new QuestionsRoom('CODE1', 'w-1');
    room.questions = Array.from({ length: LIMITS.MAX_QUESTIONS_PER_ROOM }, (_, i) => ({ id: `q-${i}` }));

    room.clearAllQuestions();

    const question = room.addQuestion('sock-1', 'Now?', 'Ada');
    assert.ok(question);
    assert.equal(room.getQuestionCount(), 1);
  });
});

describe('LinkShareRoom capacity', () => {
  it('rejects submissions beyond MAX_SUBMISSIONS_PER_ROOM', () => {
    const room = new LinkShareRoom('CODE1', 'w-1');
    room.submissions = Array.from({ length: LIMITS.MAX_SUBMISSIONS_PER_ROOM }, (_, i) => ({ id: `s-${i}` }));

    const rejected = room.addSubmission('Ada', 'https://example.com');

    assert.equal(rejected, null);
    assert.equal(room.getSubmissionCount(), LIMITS.MAX_SUBMISSIONS_PER_ROOM);
  });

  it('accepts submissions again after deletion frees space', () => {
    const room = new LinkShareRoom('CODE1', 'w-1');
    room.submissions = Array.from({ length: LIMITS.MAX_SUBMISSIONS_PER_ROOM }, (_, i) => ({ id: `s-${i}` }));

    assert.equal(room.deleteSubmission('s-0'), true);

    const submission = room.addSubmission('Ada', 'https://example.com');
    assert.ok(submission);
    assert.equal(room.getSubmissionCount(), LIMITS.MAX_SUBMISSIONS_PER_ROOM);
  });
});

describe('QuestionsRoom behavior', () => {
  it('handles unknown ids in markAnswered/deleteQuestion without corrupting state', () => {
    const room = new QuestionsRoom('CODE1', 'w-1');
    const q = room.addQuestion('sock-1', 'Why?', 'Ada');

    assert.equal(room.markAnswered('nope'), false);
    assert.equal(room.deleteQuestion('nope'), false);
    assert.equal(room.getQuestionCount(), 1);
    assert.equal(room.getUnansweredCount(), 1);

    assert.equal(room.markAnswered(q.id), true);
    assert.equal(room.getUnansweredCount(), 0);
    assert.equal(room.deleteQuestion(q.id), true);
    assert.equal(room.getQuestionCount(), 0);
  });

  it('defaults missing student names to Anonymous', () => {
    const room = new QuestionsRoom('CODE1', 'w-1');
    const q = room.addQuestion('sock-1', 'Why?', undefined);
    assert.equal(q.studentName, 'Anonymous');
  });
});

describe('LinkShareRoom behavior', () => {
  it('ignores invalid accept modes', () => {
    const room = new LinkShareRoom('CODE1', 'w-1');
    assert.equal(room.acceptMode, 'all');

    room.setAcceptMode('links');
    assert.equal(room.acceptMode, 'links');

    for (const bad of ['everything', '', null, undefined, 42, {}]) {
      room.setAcceptMode(bad);
      assert.equal(room.acceptMode, 'links', `mode ${String(bad)} must be ignored`);
    }
  });

  it('stores text submissions with a null link for backward compatibility', () => {
    const room = new LinkShareRoom('CODE1', 'w-1');
    const sub = room.addSubmission('Ada', 'just text', false);
    assert.equal(sub.isLink, false);
    assert.equal(sub.link, null);
    assert.equal(sub.content, 'just text');
  });
});
