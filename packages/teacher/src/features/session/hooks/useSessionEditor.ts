import { useCallback, useRef } from 'react';
import { useSession } from '../../../contexts/SessionContext';

export type SessionEditorScope = Pick<ReturnType<typeof useSession>,
  'sessionCode' | 'isCurrentSession' | 'canEditSession'>;

// The owner passes the same scope as its retained onSave callback. Subscribe
// to current phase changes, but never rebind an open draft to a new classroom.
export function useSessionEditor(scope?: SessionEditorScope) {
  const session = useSession();
  const opening = useRef(scope ?? session).current;
  const retryInFlight = useRef(false);
  const identityChanged = !opening.isCurrentSession();
  const recovering = session.connectionPhase === 'recovering';
  const deferred = session.connectionPhase === 'recovery-deferred';

  const retry = useCallback(async () => {
    if (!opening.sessionCode || !opening.isCurrentSession() || !deferred || retryInFlight.current) return;
    retryInFlight.current = true;
    try {
      await session.recoverSession(opening.sessionCode);
    } finally {
      retryInFlight.current = false;
    }
  }, [opening, deferred, session.recoverSession]);

  return {
    canSave: opening.canEditSession,
    identityChanged,
    recovering,
    showRetry: !identityChanged && Boolean(opening.sessionCode) && (deferred || recovering),
    retry
  };
}
