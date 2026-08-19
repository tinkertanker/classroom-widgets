const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const QuestionsRoom = require('./QuestionsRoom');
const { LIMITS } = require('../config/constants');

describe('QuestionsRoom', () => {
  it('reports its type and starts paused with no questions', () => {
    const room = new QuestionsRoom('CODE1', 'w-1');
    assert.equal(room.getType(), 'questions');
    assert.equal(room.isActive, false);
    assert.deepEqual(room.getQuestions(), []);
    assert.equal(room.getQuestionCount(), 0);
  });

  it('adds a question with a generated id and defaults', () => {
    const room = new QuestionsRoom('CODE1', 'w-1');
    const question = room.addQuestion('sock-1', 'Why?', 'Ada');

    assert.ok(question.id);
    assert.equal(question.studentId, 'sock-1');
    assert.equal(question.studentName, 'Ada');
    assert.equal(question.text, 'Why?');
    assert.equal(question.answered, false);
    assert.equal(typeof question.timestamp, 'number');
    assert.equal(room.getQuestionCount(), 1);
  });

  it('accepts questions up to MAX_QUESTIONS_PER_ROOM and rejects the next one', () => {
    const room = new QuestionsRoom('CODE1', 'w-1');
    for (let i = 0; i < LIMITS.MAX_QUESTIONS_PER_ROOM; i++) {
      const question = room.addQuestion('sock-1', `Q${i}`, 'Ada');
      assert.ok(question, `question ${i} should be accepted`);
    }
    assert.equal(room.getQuestionCount(), LIMITS.MAX_QUESTIONS_PER_ROOM);

    const rejected = room.addQuestion('sock-1', 'One more?', 'Ada');
    assert.equal(rejected, null);
    assert.equal(room.getQuestionCount(), LIMITS.MAX_QUESTIONS_PER_ROOM);
  });

  it('deletes an existing question by id', () => {
    const room = new QuestionsRoom('CODE1', 'w-1');
    const question = room.addQuestion('sock-1', 'Why?', 'Ada');

    assert.equal(room.deleteQuestion(question.id), true);
    assert.equal(room.getQuestionCount(), 0);
  });

  it('is a no-op deleting a nonexistent question', () => {
    const room = new QuestionsRoom('CODE1', 'w-1');
    room.addQuestion('sock-1', 'Why?', 'Ada');

    assert.equal(room.deleteQuestion('does-not-exist'), false);
    assert.equal(room.getQuestionCount(), 1);
  });

  it('clears all questions', () => {
    const room = new QuestionsRoom('CODE1', 'w-1');
    room.addQuestion('sock-1', 'One', 'Ada');
    room.addQuestion('sock-1', 'Two', 'Ada');

    room.clearAllQuestions();

    assert.equal(room.getQuestionCount(), 0);
    assert.deepEqual(room.getQuestions(), []);
  });

  it('includes questions-specific fields in toJSON', () => {
    const room = new QuestionsRoom('CODE1', 'w-1');
    const question = room.addQuestion('sock-1', 'Why?', 'Ada');

    const json = room.toJSON();

    assert.equal(json.type, 'questions');
    assert.equal(json.code, 'CODE1');
    assert.deepEqual(json.questions, [question]);
    assert.equal(json.questionCount, 1);
    assert.equal(json.unansweredCount, 1);
  });
});
