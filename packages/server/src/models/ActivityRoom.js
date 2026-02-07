const Room = require('./Room');

/**
 * Room class to manage interactive activity sessions
 * Supports fill-in-the-blank, sorting, sequencing, and matching activities
 */
class ActivityRoom extends Room {
  constructor(code, widgetId = null) {
    super(code, widgetId);
    this.activityType = null; // 'fill-blank' | 'sorting' | 'sequencing' | 'matching'
    this.activity = null; // Full activity definition with UI recipe
    this.responses = new Map(); // socketId -> { answers, results, submittedAt }
    this.showImmediateFeedback = true;
    this.allowRetry = true;
    this.answersRevealed = false;
  }

  getType() {
    return 'activity';
  }

  /**
   * Set activity data from teacher
   */
  setActivity(activityData) {
    this.activityType = activityData.type;
    this.activity = {
      id: activityData.id || `activity-${Date.now()}`,
      type: activityData.type,
      title: activityData.title || '',
      instructions: activityData.instructions || '',
      items: activityData.items || [],
      targets: activityData.targets || [],
      uiRecipe: activityData.uiRecipe || [],
      showImmediateFeedback: activityData.showImmediateFeedback !== false,
      allowRetry: activityData.allowRetry !== false,
      shuffleItems: activityData.shuffleItems || false
    };
    this.showImmediateFeedback = this.activity.showImmediateFeedback;
    this.allowRetry = this.activity.allowRetry;
    this.answersRevealed = false;
    this.updateActivity();
  }

  /**
   * Update activity data (partial updates)
   */
  updateActivityData(updates) {
    if (!this.activity) return;

    this.activity = {
      ...this.activity,
      ...updates
    };

    if (updates.showImmediateFeedback !== undefined) {
      this.showImmediateFeedback = updates.showImmediateFeedback;
    }
    if (updates.allowRetry !== undefined) {
      this.allowRetry = updates.allowRetry;
    }

    this.updateActivity();
  }

  /**
   * Record a student's submission and evaluate it
   */
  submitAnswer(socketId, answers) {
    if (!this.isActive || !this.activity) {
      return { success: false, error: 'Activity not active' };
    }

    // Evaluate the submission
    const results = this.evaluateAnswers(answers);

    // Store the response
    this.responses.set(socketId, {
      answers,
      results,
      submittedAt: Date.now()
    });

    this.updateActivity();

    return {
      success: true,
      results,
      showFeedback: this.showImmediateFeedback
    };
  }

  /**
   * Evaluate student answers against correct answers
   */
  evaluateAnswers(answers) {
    if (!this.activity) {
      return { score: 0, total: 0, correct: [], incorrect: [], submitted: true };
    }

    const { placements = [], textInputs = {} } = answers;
    const correct = [];
    const incorrect = [];
    const isCodeActivity = this.activity.type === 'code-fill-blank';

    // Evaluate drag-drop placements
    for (const target of this.activity.targets) {
      const placement = placements.find(p => p.targetId === target.id);

      if (placement) {
        // Check if the placed item is in the accepts list
        if (target.accepts.includes(placement.itemId)) {
          correct.push(target.id);
        } else {
          incorrect.push(target.id);
        }
      } else if (textInputs[target.id] !== undefined && textInputs[target.id] !== '') {
        // Check text input
        const userInput = textInputs[target.id];
        const correctItems = target.accepts.map(itemId => {
          const item = this.activity.items.find(i => i.id === itemId);
          return item?.content || '';
        });

        // Use evaluation mode if specified, otherwise default based on activity type
        const evalMode = target.evaluationMode || (isCodeActivity ? 'whitespace-flexible' : 'exact');
        const isCorrect = this.evaluateTextInput(userInput, correctItems, evalMode);

        if (isCorrect) {
          correct.push(target.id);
        } else {
          incorrect.push(target.id);
        }
      } else {
        // No answer provided
        incorrect.push(target.id);
      }
    }

    return {
      score: correct.length,
      total: this.activity.targets.length,
      correct,
      incorrect,
      submitted: true
    };
  }

  /**
   * Evaluate a text input against correct answers using the specified mode
   * @param {string} userInput - The student's input
   * @param {string[]} correctAnswers - Array of accepted correct answers
   * @param {string} mode - Evaluation mode: 'exact', 'whitespace-flexible', 'case-insensitive'
   * @returns {boolean} Whether the input is correct
   */
  evaluateTextInput(userInput, correctAnswers, mode = 'exact') {
    let normalized = userInput.trim();

    switch (mode) {
      case 'whitespace-flexible':
        // Normalize whitespace: collapse multiple spaces/newlines to single space
        normalized = normalized.replace(/\s+/g, ' ');
        return correctAnswers.some(answer => {
          const normalizedAnswer = answer.trim().replace(/\s+/g, ' ');
          return normalized === normalizedAnswer;
        });

      case 'case-insensitive':
        normalized = normalized.toLowerCase();
        return correctAnswers.some(answer => {
          return normalized === answer.trim().toLowerCase();
        });

      case 'exact':
      default:
        return correctAnswers.some(answer => normalized === answer.trim());
    }
  }

  /**
   * Get correct answers mapping (for revealing)
   */
  getCorrectAnswers() {
    if (!this.activity) return {};

    const correctAnswers = {};
    for (const target of this.activity.targets) {
      // Return the first correct item for each target
      if (target.accepts.length > 0) {
        correctAnswers[target.id] = target.accepts[0];
      }
    }
    return correctAnswers;
  }

  /**
   * Reveal answers to students
   */
  revealAnswers(reveal = true) {
    this.answersRevealed = reveal;
    this.updateActivity();
  }

  /**
   * Reset all student responses
   */
  reset() {
    this.responses.clear();
    this.answersRevealed = false;
    this.updateActivity();
  }

  /**
   * Clear a specific student's response
   */
  clearStudentResponse(socketId) {
    this.responses.delete(socketId);
    this.updateActivity();
  }

  /**
   * Get available actions for a student based on current state
   */
  getActions(socketId) {
    const hasSubmitted = this.responses.has(socketId);
    const response = this.responses.get(socketId);

    const actions = [
      {
        type: 'submit',
        enabled: this.isActive && !hasSubmitted,
        label: 'Check Answers'
      }
    ];

    if (this.allowRetry && hasSubmitted) {
      actions.push({
        type: 'retry',
        enabled: this.isActive && this.allowRetry,
        label: 'Try Again'
      });
    }

    return actions;
  }

  /**
   * Get state for a specific student
   */
  getStateForStudent(socketId) {
    const response = this.responses.get(socketId);

    return {
      activity: this.activity,
      isActive: this.isActive,
      actions: this.getActions(socketId),
      results: response?.results || null,
      correctAnswers: this.answersRevealed ? this.getCorrectAnswers() : null
    };
  }

  /**
   * Get response count
   */
  getResponseCount() {
    return this.responses.size;
  }

  /**
   * Get all responses (for teacher view)
   */
  getAllResponses() {
    const responses = [];
    this.responses.forEach((data, socketId) => {
      responses.push({
        socketId,
        ...data
      });
    });
    return responses;
  }

  /**
   * Override toJSON to include activity-specific data
   */
  toJSON() {
    return {
      ...super.toJSON(),
      activityType: this.activityType,
      activity: this.activity,
      responseCount: this.getResponseCount(),
      answersRevealed: this.answersRevealed,
      showImmediateFeedback: this.showImmediateFeedback,
      allowRetry: this.allowRetry,
      // Include default actions for initial state (without specific student context)
      actions: this.getActions(null)
    };
  }
}

module.exports = ActivityRoom;
