const Room = require('./Room');

const MAX_TEXT_INPUT_LENGTH = 2000;
const MAX_ANSWER_ID_LENGTH = 100;

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

    // One answer per student until a retry clears it, so allowRetry holds and
    // the teacher is not sent the same student's response again
    if (this.responses.has(socketId)) {
      return { success: false, error: 'Already submitted' };
    }

    // Keep only the fields grading reads, capped to this activity's targets,
    // so a student cannot park megabytes of junk in server memory.
    const normalized = this.normalizeAnswers(answers);

    // Evaluate the submission
    const results = this.evaluateAnswers(normalized);

    // Store the response
    this.responses.set(socketId, {
      answers: normalized,
      results,
      submittedAt: Date.now()
    });

    this.updateActivity();

    return {
      success: true,
      answers: normalized,
      results,
      showFeedback: this.showImmediateFeedback
    };
  }

  /**
   * Reduce a student's submission to `{ placements, textInputs }` with one
   * placement and one text input per known target, and bounded text.
   */
  normalizeAnswers(answers) {
    const source = answers && typeof answers === 'object' ? answers : {};
    const targets = this.activity && Array.isArray(this.activity.targets) ? this.activity.targets : [];
    const targetIds = new Set(targets.map(target => target && target.id).filter(id => typeof id === 'string'));

    const placements = [];
    const placedTargets = new Set();
    for (const p of Array.isArray(source.placements) ? source.placements : []) {
      if (placements.length >= targetIds.size) break;
      if (!p || typeof p.itemId !== 'string' || typeof p.targetId !== 'string') continue;
      if (!targetIds.has(p.targetId) || placedTargets.has(p.targetId)) continue;
      placedTargets.add(p.targetId);
      placements.push({ itemId: p.itemId.slice(0, MAX_ANSWER_ID_LENGTH), targetId: p.targetId });
    }

    const textInputs = {};
    const rawInputs = source.textInputs && typeof source.textInputs === 'object' ? source.textInputs : {};
    for (const id of targetIds) {
      if (Object.prototype.hasOwnProperty.call(rawInputs, id) && typeof rawInputs[id] === 'string') {
        textInputs[id] = rawInputs[id].slice(0, MAX_TEXT_INPUT_LENGTH);
      }
    }

    return { placements, textInputs };
  }

  /**
   * The activity as students may see it: targets without the `accepts`
   * answer key. Grading and reveals stay on the server.
   */
  getStudentActivity() {
    if (!this.activity) return this.activity;
    const targets = Array.isArray(this.activity.targets) ? this.activity.targets : [];
    return {
      ...this.activity,
      targets: targets.map(target => {
        if (!target || typeof target !== 'object') return target;
        const { accepts, ...rest } = target;
        return rest;
      })
    };
  }

  /**
   * Evaluate student answers against correct answers
   */
  evaluateAnswers(answers) {
    if (!this.activity) {
      return { score: 0, total: 0, correct: [], incorrect: [], submitted: true };
    }

    // `answers` comes straight from a student socket - never trust its shape.
    // An uncaught throw here would crash the whole server process.
    const source = answers && typeof answers === 'object' ? answers : {};
    const placements = Array.isArray(source.placements) ? source.placements : [];
    const textInputs = source.textInputs && typeof source.textInputs === 'object'
      ? source.textInputs
      : {};
    const targets = Array.isArray(this.activity.targets) ? this.activity.targets : [];
    const items = Array.isArray(this.activity.items) ? this.activity.items : [];
    const correct = [];
    const incorrect = [];
    const isCodeActivity = this.activity.type === 'code-fill-blank';

    // Index once so each target is a constant-time lookup; first match wins.
    const placementByTarget = new Map();
    for (const p of placements) {
      if (p != null && !placementByTarget.has(p.targetId)) {
        placementByTarget.set(p.targetId, p);
      }
    }
    const itemById = new Map();
    for (const item of items) {
      if (item != null && !itemById.has(item.id)) {
        itemById.set(item.id, item);
      }
    }

    // Evaluate drag-drop placements
    for (const target of targets) {
      const accepts = Array.isArray(target.accepts) ? target.accepts : [];
      const placement = placementByTarget.get(target.id);
      const textInput = Object.prototype.hasOwnProperty.call(textInputs, target.id)
        ? textInputs[target.id]
        : undefined;

      if (placement) {
        // Check if the placed item is in the accepts list
        if (accepts.includes(placement.itemId)) {
          correct.push(target.id);
        } else {
          incorrect.push(target.id);
        }
      } else if (typeof textInput === 'string' && textInput !== '') {
        // Check text input
        const userInput = textInput;
        const correctItems = accepts.map(itemId => itemById.get(itemId)?.content || '');

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
      total: targets.length,
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
    const targets = Array.isArray(this.activity.targets) ? this.activity.targets : [];
    for (const target of targets) {
      // Return the first correct item for each target
      if (Array.isArray(target.accepts) && target.accepts.length > 0) {
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

    // Without a student (a broadcast to the whole room), offer retry whenever
    // it is allowed: students who have results show it, the rest ignore it
    if (this.allowRetry && (hasSubmitted || socketId === null)) {
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
      activity: this.getStudentActivity(),
      isActive: this.isActive,
      actions: this.getActions(socketId),
      // Results are only shown to students when immediate feedback is on
      results: this.showImmediateFeedback ? response?.results || null : null,
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

  toStudentJSON() {
    return { ...this.toJSON(), activity: this.getStudentActivity() };
  }
}

module.exports = ActivityRoom;
