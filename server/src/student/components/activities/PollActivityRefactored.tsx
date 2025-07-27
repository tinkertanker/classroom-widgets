import React from 'react';
import { BaseActivity, BaseActivityProps, BaseActivityState } from './BaseActivity';
import { Button, Card } from '../common';
import { ActivityType } from '../../types/socket.types';
import { PollData } from '../../types/session.types';

interface PollActivityState extends BaseActivityState {
  data: PollData;
}

export class PollActivityRefactored extends BaseActivity<BaseActivityProps, PollActivityState> {
  getActivityType(): ActivityType {
    return 'poll';
  }
  
  protected getInitialData(): PollData {
    const initialData = this.props.initialData as any;
    return {
      question: initialData?.question || '',
      options: initialData?.options || [],
      isActive: initialData?.isActive || false,
      allowMultiple: initialData?.allowMultiple || false,
      hasVoted: false,
      selectedOption: null,
      results: initialData?.votes ? {
        votes: initialData.votes,
        totalVotes: Object.values(initialData.votes as Record<number, number>).reduce((a, b) => a + b, 0)
      } : undefined
    };
  }
  
  protected setupActivityListeners(): void {
    // Listen for poll updates
    this.socketService.on('poll:updated', (data) => {
      if (this.isRelevantEvent(data)) {
        this.setActivityData({
          question: data.question,
          options: data.options,
          isActive: data.isActive,
          allowMultiple: data.allowMultiple
        });
      }
    });
    
    // Listen for results
    this.socketService.on('poll:results', (data) => {
      if (this.isRelevantEvent(data)) {
        this.setActivityData({
          results: {
            votes: data.votes,
            totalVotes: data.totalVotes
          }
        });
      }
    });
    
    // Listen for vote confirmation
    this.socketService.on('vote:confirmed', (data) => {
      if (data.success) {
        this.setActivityData({ hasVoted: true });
      } else {
        this.setError(data.error || 'Failed to submit vote');
      }
    });
  }
  
  protected cleanupListeners(): void {
    this.socketService.off('poll:updated');
    this.socketService.off('poll:results');
    this.socketService.off('vote:confirmed');
  }
  
  private handleVote = (optionIndex: number) => {
    const { sessionCode, widgetId, isSession } = this.props;
    
    this.setActivityData({ selectedOption: optionIndex });
    
    if (isSession) {
      this.socketService.emit('session:poll:vote', {
        sessionCode,
        optionIndex,
        widgetId
      });
    } else {
      // Legacy support
      this.socketService.emit('vote:confirmed', {
        success: true
      });
    }
  };
  
  protected renderActivityContent(): React.ReactNode {
    const { data } = this.state;
    const { question, options, hasVoted, selectedOption, results, isActive } = data;
    
    if (!question || options.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-warm-gray-600 dark:text-warm-gray-400">
            Waiting for poll to be created...
          </p>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-warm-gray-800 dark:text-warm-gray-200">
          {question}
        </h3>
        
        {!hasVoted && isActive ? (
          // Voting interface
          <div className="space-y-2">
            {options.map((option, index) => (
              <Button
                key={index}
                variant="ghost"
                fullWidth
                onClick={() => this.handleVote(index)}
                className={`text-left justify-start p-3 ${
                  selectedOption === index 
                    ? 'bg-sage-100 dark:bg-sage-900 border-sage-500' 
                    : 'hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700'
                }`}
              >
                {option}
              </Button>
            ))}
          </div>
        ) : (
          // Results display
          <div className="space-y-3">
            {hasVoted && !results && (
              <p className="text-sm text-sage-600 dark:text-sage-400 text-center mb-3">
                Vote submitted! Waiting for results...
              </p>
            )}
            
            {results && options && options.map((option, index) => {
              const votes = results.votes[index] || 0;
              const percentage = results.totalVotes > 0 
                ? Math.round((votes / results.totalVotes) * 100) 
                : 0;
              const isMyVote = selectedOption === index;
              
              return (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className={`${isMyVote ? 'font-semibold' : ''}`}>
                      {option} {isMyVote && '(Your vote)'}
                    </span>
                    <span className="text-warm-gray-600 dark:text-warm-gray-400">
                      {percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-warm-gray-200 dark:bg-warm-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isMyVote 
                          ? 'bg-sage-500' 
                          : 'bg-warm-gray-400 dark:bg-warm-gray-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            
            {results && (
              <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 text-center mt-2">
                Total votes: {results.totalVotes}
              </p>
            )}
          </div>
        )}
        
        {!isActive && !results && (
          <p className="text-sm text-warm-gray-500 dark:text-warm-gray-400 text-center">
            Voting has ended. Waiting for results...
          </p>
        )}
      </div>
    );
  }
}