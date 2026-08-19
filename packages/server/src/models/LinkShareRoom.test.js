const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const LinkShareRoom = require('./LinkShareRoom');
const { LIMITS } = require('../config/constants');

describe('LinkShareRoom', () => {
  it('reports its type and starts paused with no submissions', () => {
    const room = new LinkShareRoom('CODE1', 'w-1');
    assert.equal(room.getType(), 'linkShare');
    assert.equal(room.isActive, false);
    assert.equal(room.acceptMode, 'all');
    assert.equal(room.getSubmissionCount(), 0);
  });

  it('adds a submission with a generated id', () => {
    const room = new LinkShareRoom('CODE1', 'w-1');
    const submission = room.addSubmission('Ada', 'https://example.com', true);

    assert.ok(submission.id);
    assert.equal(submission.studentName, 'Ada');
    assert.equal(submission.content, 'https://example.com');
    assert.equal(submission.isLink, true);
    assert.equal(submission.link, 'https://example.com');
    assert.equal(typeof submission.timestamp, 'number');
    assert.equal(room.getSubmissionCount(), 1);
  });

  it('accepts submissions up to MAX_SUBMISSIONS_PER_ROOM and rejects the next one', () => {
    const room = new LinkShareRoom('CODE1', 'w-1');
    for (let i = 0; i < LIMITS.MAX_SUBMISSIONS_PER_ROOM; i++) {
      const submission = room.addSubmission('Ada', `https://example.com/${i}`, true);
      assert.ok(submission, `submission ${i} should be accepted`);
    }
    assert.equal(room.getSubmissionCount(), LIMITS.MAX_SUBMISSIONS_PER_ROOM);

    const rejected = room.addSubmission('Ada', 'https://example.com/last', true);
    assert.equal(rejected, null);
    assert.equal(room.getSubmissionCount(), LIMITS.MAX_SUBMISSIONS_PER_ROOM);
  });

  it('deletes an existing submission by id', () => {
    const room = new LinkShareRoom('CODE1', 'w-1');
    const submission = room.addSubmission('Ada', 'https://example.com', true);

    assert.equal(room.deleteSubmission(submission.id), true);
    assert.equal(room.getSubmissionCount(), 0);
  });

  it('is a no-op deleting a nonexistent submission', () => {
    const room = new LinkShareRoom('CODE1', 'w-1');
    room.addSubmission('Ada', 'https://example.com', true);

    assert.equal(room.deleteSubmission('does-not-exist'), false);
    assert.equal(room.getSubmissionCount(), 1);
  });

  it('clears all submissions', () => {
    const room = new LinkShareRoom('CODE1', 'w-1');
    room.addSubmission('Ada', 'https://example.com/1', true);
    room.addSubmission('Ada', 'https://example.com/2', true);

    room.clearAllSubmissions();

    assert.equal(room.getSubmissionCount(), 0);
  });

  it('includes link-share-specific fields in toJSON', () => {
    const room = new LinkShareRoom('CODE1', 'w-1');
    const submission = room.addSubmission('Ada', 'https://example.com', true);

    const json = room.toJSON();

    assert.equal(json.type, 'linkShare');
    assert.equal(json.code, 'CODE1');
    assert.deepEqual(json.submissions, [submission]);
    assert.equal(json.submissionCount, 1);
    assert.equal(json.acceptMode, 'all');
  });
});
