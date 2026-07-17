const Room = require('./Room');
const { LIMITS } = require('../config/constants');

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
   * @returns {Object|null} The created submission, or null if the room is full
   */
  addSubmission(studentName, content, isLink = true) {
    if (this.submissions.length >= LIMITS.MAX_SUBMISSIONS_PER_ROOM) {
      return null;
    }
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