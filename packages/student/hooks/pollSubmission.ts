/** Local intent is not proof that the server counted a vote. */
export type PollSubmission = {
  // The wire confirmation has no attempt/generation ID. After an unresolved
  // reset, even a success may belong to the previous poll: fail closed.
  confirmationSafe: boolean;
} & (
  | { status: 'idle' | 'rejected'; optionIndex: null }
  | { status: 'sending' | 'acknowledged' | 'uncertain'; optionIndex: number }
);

export type PollSubmissionEvent =
  | { type: 'submit'; optionIndex: number }
  | { type: 'confirmed'; success: boolean }
  | { type: 'timeout' }
  | { type: 'disconnected' }
  | { type: 'reset' };

export const initialPollSubmission: PollSubmission = {
  status: 'idle', optionIndex: null, confirmationSafe: true
};

export function pollSubmissionReducer(state: PollSubmission, event: PollSubmissionEvent): PollSubmission {
  const pending = state.status === 'sending' || state.status === 'uncertain';
  switch (event.type) {
    case 'submit':
      if (state.status !== 'idle' && state.status !== 'rejected') return state;
      return { ...state, status: 'sending', optionIndex: event.optionIndex };
    case 'confirmed':
      if (!pending) return state;
      if (!state.confirmationSafe) return { ...state, status: 'uncertain' };
      return event.success
        ? { ...state, status: 'acknowledged' }
        : { ...state, status: 'rejected', optionIndex: null };
    case 'timeout':
      return state.status === 'sending' ? { ...state, status: 'uncertain' } : state;
    case 'disconnected':
      // A new socket identity cannot prove what the old connection counted.
      return pending ? { ...state, status: 'uncertain', confirmationSafe: false } : state;
    case 'reset':
      return { status: 'idle', optionIndex: null, confirmationSafe: state.confirmationSafe && !pending };
  }
}
