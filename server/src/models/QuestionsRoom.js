const Room = require('./Room');

/**
 * Room class to manage questions submissions
 */
class QuestionsRoom extends Room {
  constructor(code, widgetId = null) {
    super(code, widgetId);
    this.questions = [];
    this.isActive = true; // Questions start active by default
  }

  getType() {
    return 'questions';
  }

  /**
   * Add a new question
   */
  addQuestion(studentId, text, studentName) {
    const question = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      studentId,
      studentName: studentName || 'Anonymous',
      text,
      timestamp: Date.now(),
      answered: false
    };
    this.questions.push(question);
    this.updateActivity();
    return question;
  }

  /**
   * Mark a question as answered
   */
  markAnswered(questionId) {
    const question = this.questions.find(q => q.id === questionId);
    if (question) {
      question.answered = true;
      this.updateActivity();
      return true;
    }
    return false;
  }

  /**
   * Delete a question
   */
  deleteQuestion(questionId) {
    const index = this.questions.findIndex(q => q.id === questionId);
    if (index > -1) {
      this.questions.splice(index, 1);
      this.updateActivity();
      return true;
    }
    return false;
  }

  /**
   * Clear all questions
   */
  clearAllQuestions() {
    this.questions = [];
    this.updateActivity();
  }

  /**
   * Get all questions
   */
  getQuestions() {
    return this.questions;
  }

  /**
   * Get unanswered questions
   */
  getUnansweredQuestions() {
    return this.questions.filter(q => !q.answered);
  }

  /**
   * Get answered questions
   */
  getAnsweredQuestions() {
    return this.questions.filter(q => q.answered);
  }

  /**
   * Get question count
   */
  getQuestionCount() {
    return this.questions.length;
  }

  /**
   * Get unanswered question count
   */
  getUnansweredCount() {
    return this.questions.filter(q => !q.answered).length;
  }

  /**
   * Override toJSON to include questions specific data
   */
  toJSON() {
    return {
      ...super.toJSON(),
      questions: this.questions,
      questionCount: this.getQuestionCount(),
      unansweredCount: this.getUnansweredCount()
    };
  }
}

module.exports = QuestionsRoom;