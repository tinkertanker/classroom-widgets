const Room = require('./Room');

/**
 * Room class to manage link share sessions
 */
class LinkShareRoom extends Room {
  constructor(code, widgetId = null) {
    super(code, widgetId);
    this.submissions = [];
    this.isActive = false; // Link sharing starts paused by default
    this.acceptMode = 'all'; // 'links' = links only, 'all' = links + text
  }

  /**
   * Set the accept mode
   */
  setAcceptMode(mode) {
    if (mode === 'links' || mode === 'all') {
      this.acceptMode = mode;
      this.updateActivity();
    }
  }

  getType() {
    return 'linkShare';
  }

  /**
   * Add a new submission (link or text)
   */
  addSubmission(studentName, content, isLink = true) {
    const submission = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      studentName,
      content,
      isLink,
      // Keep 'link' for backward compatibility
      link: isLink ? content : null,
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
      submissionCount: this.getSubmissionCount(),
      acceptMode: this.acceptMode
    };
  }
}

module.exports = LinkShareRoom;