const Room = require('./Room');

/**
 * Room class to manage link share sessions
 */
class LinkShareRoom extends Room {
  constructor(code, widgetId = null) {
    super(code, widgetId);
    this.submissions = [];
    this.isActive = false; // Link sharing starts paused by default
  }

  getType() {
    return 'linkShare';
  }

  /**
   * Add a new link submission
   */
  addSubmission(studentName, link) {
    const submission = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      studentName,
      link,
      timestamp: Date.now()
    };
    this.submissions.push(submission);
    this.updateActivity();
    return submission;
  }

  /**
   * Delete a submission by ID
   */
  deleteSubmission(submissionId) {
    const index = this.submissions.findIndex(s => s.id === submissionId);
    if (index > -1) {
      this.submissions.splice(index, 1);
      this.updateActivity();
      return true;
    }
    return false;
  }

  /**
   * Clear all submissions
   */
  clearAllSubmissions() {
    this.submissions = [];
    this.updateActivity();
  }

  /**
   * Get all submissions
   */
  getSubmissions() {
    return this.submissions;
  }

  /**
   * Get submission count
   */
  getSubmissionCount() {
    return this.submissions.length;
  }

  /**
   * Override toJSON to include link share specific data
   */
  toJSON() {
    return {
      ...super.toJSON(),
      submissions: this.submissions,
      submissionCount: this.getSubmissionCount()
    };
  }
}

module.exports = LinkShareRoom;