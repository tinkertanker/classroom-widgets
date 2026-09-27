const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const PollRoom = require('./PollRoom');

describe('PollRoom', () => {
  let room;

  beforeEach(() => {
    room = new PollRoom('CODE1', 'widget-1');
    room.setPollData({
      question: 'Favourite colour?',
      options: ['Red', 'Green', 'Blue']
    });
    room.isActive = true;
  });

  describe('vote', () => {
    it('records one vote per participant', () => {
      assert.equal(room.vote('s1', 0), true);
      assert.equal(room.vote('s1', 1), false); // second vote rejected
      assert.equal(room.getTotalVotes(), 1);
      assert.deepEqual(room.getVoteCounts(), { 0: 1, 1: 0, 2: 0 });
    });

    it('rejects votes when the poll is paused', () => {
      room.isActive = false;
      assert.equal(room.vote('s1', 0), false);
      assert.equal(room.getTotalVotes(), 0);
    });

    it('rejects out-of-range option indices without consuming the vote', () => {
      assert.equal(room.vote('s1', 99), false);
      assert.equal(room.vote('s1', -1), false);
      // The participant can still cast a valid vote afterwards
      assert.equal(room.vote('s1', 2), true);
    });

    it('rejects inherited-object-key indices instead of corrupting counts to NaN', () => {
      for (const evil of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
        assert.equal(room.vote(`voter-${evil}`, evil), false, evil);
      }
      assert.equal(room.getTotalVotes(), 0);
      assert.ok(!Number.isNaN(room.getTotalVotes()));
    });
  });

  describe('setPollData', () => {
    it('resets votes when options change', () => {
      room.vote('s1', 0);
      room.setPollData({ options: ['Yes', 'No'] });
      assert.deepEqual(room.getVoteCounts(), { 0: 0, 1: 0 });
    });

    it('keeps votes when only the question changes', () => {
      room.vote('s1', 0);
      room.setPollData({ question: 'New question, same options' });
      assert.equal(room.getVoteCounts()[0], 1);
    });
  });

  describe('clearVotes', () => {
    it('lets everyone vote again after clearing', () => {
      room.vote('s1', 0);
      room.clearVotes();
      assert.equal(room.getTotalVotes(), 0);
      assert.equal(room.vote('s1', 1), true);
    });
  });

  describe('getResults', () => {
    it('reports empty state without throwing when no poll data set', () => {
      const fresh = new PollRoom('CODE2');
      const results = fresh.getResults();
      assert.equal(results.totalVotes, 0);
      assert.deepEqual(results.votes, {});
    });
  });

  // Issue #78: a teacher widget that remounts over a live room re-sends its
  // poll data. After a page reload that copy came from the recovery snapshot,
  // which includes the vote counts at reload time. Votes are counted by the
  // server; a host update must never roll them back to a stale copy.
  it('keeps its own vote counts when a host update carries a stale votes map', () => {
    room.vote('student-1', 0);
    // What the teacher got from the recovery snapshot (serialised over the socket)
    const staleCopy = JSON.parse(JSON.stringify(room.toJSON().pollData));
    room.vote('student-2', 2);

    room.setPollData(staleCopy);

    assert.deepEqual(room.pollData.votes, { 0: 1, 1: 0, 2: 1 });
    assert.equal(room.getResults().totalVotes, 2);
  });
});
