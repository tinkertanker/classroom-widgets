const Room = require('./Room');

/**
 * Room class to manage real-time understanding feedback sessions
 */
class RTFeedbackRoom extends Room {
  constructor(code, widgetId = null) {
    super(code, widgetId);
    this.feedbackData = new Map(); // Map of studentId -> feedback value (1-5)
    this.understanding = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // 9 buckets for 0.5 increments
    this.totalResponses = 0;
    this.isActive = false; // RTFeedback starts paused by default
  }

  getType() {
    return 'rtfeedback';
  }

  /**
   * Update feedback value for a student
   */
  updateFeedback(studentId, value) {
    // Clamp value between 1 and 5
    const clampedValue = Math.max(1, Math.min(5, value));

    this.removeFromHistogram(this.feedbackData.get(studentId));
    this.addToHistogram(clampedValue);
    this.feedbackData.set(studentId, {
      value: clampedValue,
      timestamp: Date.now()
    });
    
    this.updateActivity();
  }

  /**
   * Remove feedback for a student
   */
  removeFeedback(studentId) {
    const existing = this.feedbackData.get(studentId);
    const removed = this.feedbackData.delete(studentId);
    if (removed) {
      this.removeFromHistogram(existing);
      this.updateActivity();
    }
    return removed;
  }

  /**
   * Clear all feedback data
   */
  clearAllFeedback() {
    this.feedbackData.clear();
    this.understanding.fill(0);
    this.totalResponses = 0;
    this.updateActivity();
  }

  /**
   * Bucket index for a value (1->0, 1.5->1, ..., 5->8), or -1 if out of range
   */
  static bucketIndex(value) {
    if (!(value >= 1 && value <= 5)) return -1;
    // Round to nearest 0.5: 1.2->1, 1.3->1.5, 1.7->1.5, 1.8->2, etc.
    const index = (Math.round(value * 2) / 2 - 1) * 2;
    return index >= 0 && index < 9 ? index : -1;
  }

  addToHistogram(value) {
    const index = RTFeedbackRoom.bucketIndex(value);
    if (index !== -1) {
      this.understanding[index]++;
      this.totalResponses++;
    }
  }

  removeFromHistogram(data) {
    if (!data) return;
    const index = RTFeedbackRoom.bucketIndex(data.value);
    if (index !== -1) {
      this.understanding[index]--;
      this.totalResponses--;
    }
  }

  /**
   * Get aggregated feedback for visualization
   * Returns count of students at each understanding level
   */
  getAggregatedFeedback() {
    return {
      understanding: [...this.understanding],
      totalResponses: this.totalResponses
    };
  }

  /**
   * Get number of feedback responses
   */
  getResponseCount() {
    return this.feedbackData.size;
  }

  /**
   * Get average understanding level
   */
  getAverageUnderstanding() {
    if (this.feedbackData.size === 0) return null;
    
    let sum = 0;
    this.feedbackData.forEach((data) => {
      sum += data.value;
    });
    
    return sum / this.feedbackData.size;
  }

  /**
   * Override removeParticipant to also remove their feedback
   */
  removeParticipant(socketId) {
    const removed = super.removeParticipant(socketId);
    if (removed) {
      this.removeFeedback(socketId);
    }
    return removed;
  }

  /**
   * Override toJSON to include feedback specific data
   */
  toJSON() {
    return {
      ...super.toJSON(),
      feedbackData: this.getAggregatedFeedback(),
      averageUnderstanding: this.getAverageUnderstanding(),
      responseCount: this.getResponseCount()
    };
  }
}

module.exports = RTFeedbackRoom;