import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { SessionQuestionsSubmittedResponse, SessionLinkShareSubmittedResponse } from '@shared/types/socket.types';

export type TextSubmission =
  | { status: 'idle' | 'sending' | 'acknowledged' | 'uncertain' }
  | { status: 'rejected'; error: string };

/** One card owns one attempt; aggregate/legacy events never confirm its text. */
export function useTextSubmission(socket: Socket, sessionCode: string, widgetId: string | undefined,
  event: 'session:questions:submit' | 'session:linkShare:submit') {
  const [text, setText] = useState('');
  const [submission, setSubmission] = useState<TextSubmission>({ status: 'idle' });
  const [isConnected, setConnected] = useState(socket.connected);
  const [submissionCount, setSubmissionCount] = useState(0);
  const attempt = useRef<{ timer: ReturnType<typeof setTimeout> } | null>(null);

  const abandon = () => {
    if (attempt.current) clearTimeout(attempt.current.timer);
    attempt.current = null;
  };

  useEffect(() => {
    abandon();
    setText('');
    setSubmission({ status: 'idle' });
    setSubmissionCount(0);
    setConnected(socket.connected);
    const disconnect = () => {
      setConnected(false);
      if (attempt.current) {
        clearTimeout(attempt.current.timer);
        setSubmission({ status: 'uncertain' });
      }
    };
    const connect = () => setConnected(true);
    socket.on('disconnect', disconnect);
    socket.on('connect', connect);
    return () => {
      abandon();
      socket.off('disconnect', disconnect);
      socket.off('connect', connect);
    };
  }, [socket, sessionCode, widgetId, event]);

  const edit = (value: string) => {
    if (attempt.current) return;
    setText(value);
    setSubmission({ status: 'idle' });
  };

  const submit = (payload: Record<string, unknown>, validationError?: string) => {
    if (attempt.current) return;
    if (!socket.connected || validationError) {
      setSubmission({ status: 'rejected', error: validationError || 'Connection lost. Wait to reconnect before submitting.' });
      return;
    }
    // Synchronous ownership blocks repeated actions before React renders.
    const pending = { timer: setTimeout(() => {
      if (attempt.current === pending) setSubmission({ status: 'uncertain' });
    }, 10000) };
    attempt.current = pending;
    setSubmission({ status: 'sending' });
    // Keep accepting a late, correlated response after the feedback deadline,
    // but bound Socket.IO callback retention even when no reply ever arrives.
    socket.timeout(60000).emit(event, { ...payload, sessionCode, widgetId }, (error: Error | null,
      response?: SessionQuestionsSubmittedResponse | SessionLinkShareSubmittedResponse) => {
      if (attempt.current !== pending) return;
      clearTimeout(pending.timer);
      if (error || !response) {
        setSubmission({ status: 'uncertain' });
        return;
      }
      attempt.current = null;
      if (response.success) {
        setText('');
        setSubmissionCount(count => count + 1);
        setSubmission({ status: 'acknowledged' });
      } else {
        const message = typeof response.error === 'string' ? response.error : response.error?.message;
        setSubmission({ status: 'rejected', error: message || 'Submission was rejected. Please try again.' });
      }
    });
  };

  const startAnother = () => {
    abandon();
    setText('');
    setSubmission({ status: 'idle' });
  };
  return { text, edit, submission, isConnected, submissionCount, submit, startAnother };
}
