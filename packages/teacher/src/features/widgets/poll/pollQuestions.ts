// Fun default poll questions for new widgets
export interface PollQuestion {
  question: string;
  options: string[];
}

export const classroomPulsePoll: PollQuestion = {
  question: 'How is the lesson for you right now?',
  options: ['Way too fast', 'Too fast', 'Just right', 'Too slow', 'Way too slow']
};

export function getDefaultPollQuestion(): PollQuestion {
  return {
    question: classroomPulsePoll.question,
    options: [...classroomPulsePoll.options]
  };
}


