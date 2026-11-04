import type { TextSubmission } from '../hooks/useTextSubmission';

export default function SubmissionFeedback({ submission, isConnected, onStartAnother }: {
  submission: TextSubmission;
  isConnected: boolean;
  onStartAnother: () => void;
}) {
  return (
    <div className="mt-3 text-sm space-y-2">
      {!isConnected && <p role="status" className="text-warm-gray-600 dark:text-warm-gray-300">Connection lost. Waiting to reconnect…</p>}
      {submission.status === 'rejected' && (
        <p role="alert" className="p-2 rounded-md bg-dusty-rose-50 dark:bg-dusty-rose-900/30 text-dusty-rose-700 dark:text-dusty-rose-300">{submission.error}</p>
      )}
      {submission.status === 'sending' && <p role="status">Sending your submission…</p>}
      {submission.status === 'acknowledged' && (
        <p role="status" className="p-2 rounded-md bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300">✓ Submitted successfully!</p>
      )}
      {submission.status === 'uncertain' && (
        <>
          <p role="status" className="text-warm-gray-600 dark:text-warm-gray-300">
            We couldn’t confirm your submission. It may have been received. Check with your teacher before submitting again.
          </p>
          <button type="button" onClick={onStartAnother} disabled={!isConnected}
            className="underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            Teacher checked — write another
          </button>
        </>
      )}
    </div>
  );
}
