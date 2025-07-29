const Room = require('./Room');

/**
 * Room class to manage real-time understanding feedback sessions
 */
class RTFeedbackRoom extends Room {
  constructor(code, widgetId = null) {
    super(code, widgetId);
    this.feedbackData = new Map(); // Map of studentId -> feedback value (1-5)
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
    const removed = this.feedbackData.delete(studentId);
    if (removed) {
      this.updateActivity();
    }
    return removed;
  }

  /**
   * Clear all feedback data
   */
  clearAllFeedback() {
    this.feedbackData.clear();
    this.updateActivity();
  }

  /**
   * Get all feedback entries
   */
  getAllFeedback() {
    const feedback = [];
    this.feedbackData.forEach((data, studentId) => {
      feedback.push({
        studentId,
        value: data.value,
        timestamp: data.timestamp
      });
    });
    return feedback;
  }
  
  /**
   * Get aggregated feedback for visualization
   * Returns count of students at each understanding level
   */
  getAggregatedFeedback() {
    // Count how many students are at each level (1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5)
    const understanding = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // 9 buckets for 0.5 increments
    let totalResponses = 0;
    
    this.feedbackData.forEach((data) => {
      const value = data.value;
      if (value >= 1 && value <= 5) {
        // Round to nearest 0.5: 1.2->1, 1.3->1.5, 1.7->1.5, 1.8->2, etc.
        const roundedValue = Math.round(value * 2) / 2;
        // Convert to index: 1->0, 1.5->1, 2->2, etc.
        const index = (roundedValue - 1) * 2;
        if (index >= 0 && index < 9) {
          understanding[index]++;
          totalResponses++;
        }
      }
    });
    
    return {
      understanding,
      totalResponses
    };
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
      responseCount: this.feedbackData.size
    };
  }
}

module.exports = RTFeedbackRoom;