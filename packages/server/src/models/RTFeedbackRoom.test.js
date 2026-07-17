const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const RTFeedbackRoom = require('./RTFeedbackRoom');

describe('RTFeedbackRoom', () => {
  let room;

  beforeEach(() => {
    room = new RTFeedbackRoom('CODE1', 'widget-1');
  });

  describe('updateFeedback', () => {
    it('clamps out-of-range values into [1, 5]', () => {
      room.updateFeedback('s1', -100);
      room.updateFeedback('s2', 0);
      room.updateFeedback('s3', 100);
      assert.equal(room.feedbackData.get('s1').value, 1);
      assert.equal(room.feedbackData.get('s2').value, 1);
      assert.equal(room.feedbackData.get('s3').value, 5);
    });

    it('overwrites a student\'s previous value instead of double counting', () => {
      room.updateFeedback('s1', 2);
      room.updateFeedback('s1', 4);
      assert.equal(room.feedbackData.size, 1);
      assert.equal(room.getAverageUnderstanding(), 4);
    });
  });

  describe('getAggregatedFeedback', () => {
    it('buckets values into 0.5 increments', () => {
      room.updateFeedback('s1', 1);    // bucket 0
      room.updateFeedback('s2', 1.5);  // bucket 1
      room.updateFeedback('s3', 5);    // bucket 8
      const { understanding, totalResponses } = room.getAggregatedFeedback();
      assert.equal(understanding[0], 1);
      assert.equal(understanding[1], 1);
      assert.equal(understanding[8], 1);
      assert.equal(totalResponses, 3);
    });

    it('rounds to the nearest 0.5 bucket', () => {
      room.updateFeedback('s1', 1.2);  // -> 1.0, bucket 0
      room.updateFeedback('s2', 1.3);  // -> 1.5, bucket 1
      room.updateFeedback('s3', 4.8);  // -> 5.0, bucket 8
      const { understanding } = room.getAggregatedFeedback();
      assert.equal(understanding[0], 1);
      assert.equal(understanding[1], 1);
      assert.equal(understanding[8], 1);
    });

    it('excludes NaN feedback from aggregation instead of corrupting buckets', () => {
      // NaN can only arrive if handler validation is bypassed; the room must
      // still not corrupt its aggregates.
      room.feedbackData.set('sX', { value: NaN, timestamp: Date.now() });
      const { understanding, totalResponses } = room.getAggregatedFeedback();
      assert.equal(totalResponses, 0);
      assert.ok(understanding.every(count => count === 0));
    });
  });

  describe('getAverageUnderstanding', () => {
    it('returns null with no responses (not NaN or 0)', () => {
      assert.equal(room.getAverageUnderstanding(), null);
    });

    it('averages across students', () => {
      room.updateFeedback('s1', 2);
      room.updateFeedback('s2', 4);
      assert.equal(room.getAverageUnderstanding(), 3);
    });
  });

  describe('removeParticipant', () => {
    it('removes the participant\'s feedback with them', () => {
      room.addParticipant('s1', { name: 'A' });
      room.updateFeedback('s1', 3);

      room.removeParticipant('s1');

      assert.equal(room.feedbackData.has('s1'), false);
      assert.equal(room.getAverageUnderstanding(), null);
    });

    it('keeps feedback of unknown socket removals intact', () => {
      room.addParticipant('s1', { name: 'A' });
      room.updateFeedback('s1', 3);

      assert.equal(room.removeParticipant('ghost'), false);
      assert.equal(room.feedbackData.has('s1'), true);
    });
  });

  describe('clearAllFeedback', () => {
    it('resets all data', () => {
      room.updateFeedback('s1', 3);
      room.clearAllFeedback();
      assert.equal(room.feedbackData.size, 0);
      assert.deepEqual(room.getAggregatedFeedback().totalResponses, 0);
    });
  });
});
