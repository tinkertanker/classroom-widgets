const Room = require('./Room');

/**
 * Room class to manage poll sessions
 */
class PollRoom extends Room {
  constructor(code, widgetId = null) {
    super(code, widgetId);
    this.pollData = {
      question: '',
      options: [],
      votes: {}
    };
    // Track who has voted by socket ID
    this.voters = new Set();
  }

  getType() {
    return 'poll';
  }

  /**
   * Set poll data and manage vote reset logic
   */
  setPollData(data) {
    // Only reset votes if options changed or if votes don't exist
    const shouldResetVotes = !this.pollData.votes || 
                           (data.options && JSON.stringify(data.options) !== JSON.stringify(this.pollData.options));
    
    this.pollData = {
      ...this.pollData,
      ...data
    };
    
    // Initialize or reset vote counts if needed
    if (shouldResetVotes) {
      this.pollData.votes = {};
      if (this.pollData.options) {
        this.pollData.options.forEach((_, index) => {
          this.pollData.votes[index] = 0;
        });
      }
    }
    
    this.updateActivity();
  }

  /**
   * Record a vote from a participant
   */
  vote(participantId, optionIndex) {
    if (!this.isActive) return false;
    
    // Check if participant already voted using our voters Set
    if (this.voters.has(participantId)) return false;

    // Record vote
    if (this.pollData.votes[optionIndex] !== undefined) {
      this.pollData.votes[optionIndex]++;
      this.voters.add(participantId);
      this.updateActivity();
      return true;
    }
    return false;
  }

  /**
   * Clear all votes when restarting a poll
   */
  clearVotes() {
    // Clear the voters Set
    this.voters.clear();

    // Reset vote counts
    if (this.pollData.options) {
      this.pollData.votes = {};
      this.pollData.options.forEach((_, index) => {
        this.pollData.votes[index] = 0;
      });
    }
    
    this.updateActivity();
  }

  /**
   * Get formatted results
   */
  getResults() {
    return {
      question: this.pollData.question,
      options: this.pollData.options,
      votes: this.pollData.votes || {},
      totalVotes: this.getTotalVotes(),
      participantCount: this.participants.size
    };
  }
  
  /**
   * Get vote counts
   */
  getVoteCounts() {
    return this.pollData.votes || {};
  }
  
  /**
   * Get total number of votes
   */
  getTotalVotes() {
    return Object.values(this.pollData.votes || {}).reduce((a, b) => a + b, 0);
  }

  /**
   * Reset poll votes
   */
  reset() {
    console.log('[PollRoom] Resetting votes');
    this.clearVotes();
  }
  
  /**
   * Get update data for emitting after reset
   */
  getUpdateData() {
    return {
      votes: {},
      totalVotes: 0
    };
  }

  /**
   * Override toJSON to include poll-specific data
   */
  toJSON() {
    return {
      ...super.toJSON(),
      pollData: this.pollData,
      results: this.getResults()
    };
  }
}

module.exports = PollRoom;