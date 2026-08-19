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
    const submission = {
      id: this._generateId(),
      studentName,
      content,
      isLink,
      // Keep 'link' for backward compatibility
      link: isLink ? content : null,
      timestamp: Date.now()
    };
    return this._addToList(this.submissions, submission, LIMITS.MAX_SUBMISSIONS_PER_ROOM);
  }

  /**
   * Delete a submission by ID
   */
  deleteSubmission(submissionId) {
    return this._removeFromList(this.submissions, submissionId);
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