import React, { useState } from 'react';
import { useSessionEditor } from '../../../session/hooks/useSessionEditor';
import { buttons } from '@shared/utils/styles';

interface SessionEditorRecoveryProps {
  editor: ReturnType<typeof useSessionEditor>;
  draft: string;
}

export function SessionEditorRecovery({ editor, draft }: SessionEditorRecoveryProps) {
  const [copyStatus, setCopyStatus] = useState('');
  if (editor.canSave()) return null;

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopyStatus('Draft copied.');
    } catch {
      setCopyStatus('Could not copy. Select and copy the draft fields instead.');
    }
  };

  return (
    <div className="space-y-2 text-sm text-amber-700 dark:text-amber-400">
      <p role="status">
        {editor.identityChanged
          ? 'The classroom or connection changed. This draft has not been saved. Copy it before cancelling, then reopen the editor for the current classroom.'
          : editor.recovering
          ? 'Reconnecting to the session. Your draft is kept here; wait before saving.'
          : 'Session not ready. Your draft is kept here; recover the session before saving.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {editor.showRetry && (
          <button
            type="button"
            aria-label="Retry session recovery from editor"
            disabled={editor.recovering}
            onClick={editor.retry}
            className={`${buttons.secondary} px-3 py-2 disabled:opacity-50 disabled:cursor-wait`}
          >
            {editor.recovering ? 'Reconnecting…' : 'Retry recovery'}
          </button>
        )}
        <button type="button" onClick={copyDraft} className={`${buttons.secondary} px-3 py-2`}>
          Copy draft
        </button>
      </div>
      {copyStatus && <p role="status">{copyStatus}</p>}
    </div>
  );
}
