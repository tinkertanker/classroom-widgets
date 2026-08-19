import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoiceCommandResponse } from '../types/voiceControl';

// Drives the mocked useVoiceRecording hook from the test body so we can replay
// the exact recognition sequence (gather -> final transcript) that the real
// Web Speech API produces.
const recorder = vi.hoisted(() => {
  const emptyState = {
    isListening: false,
    isProcessing: false,
    isGathering: false,
    transcript: '',
    confidence: 0,
    error: null as string | null
  };

  let snapshot = emptyState;
  let isRecording = false;
  let preserveProcessingOnReset = false;
  const subscribers = new Set<() => void>();

  const publish = (next: typeof emptyState) => {
    snapshot = next;
    subscribers.forEach((notify) => notify());
  };

  return {
    subscribe: (notify: () => void) => {
      subscribers.add(notify);
      return () => {
        subscribers.delete(notify);
      };
    },
    getSnapshot: () => snapshot,
    reset: () => {
      isRecording = false;
      preserveProcessingOnReset = false;
      publish(emptyState);
    },
    // Mirrors useVoiceRecording.startRecording: begins gathering input.
    startRecording: async () => {
      isRecording = true;
      publish({ ...emptyState, isListening: true, isGathering: true });
    },
    // Mirrors useVoiceRecording.stopRecording: only meaningful while recording,
    // and flips isProcessing on regardless of what the transcript contains.
    stopRecording: async () => {
      if (!isRecording) return;
      isRecording = false;
      publish({ ...snapshot, isListening: false, isGathering: false, isProcessing: true });
    },
    // After the 20s watchdog the real recorder can still have isProcessing
    // true; retry's resetState may not clear it before 'activating' commits.
    preserveProcessingOnReset: (value: boolean) => {
      preserveProcessingOnReset = value;
    },
    // Mirrors useVoiceRecording.resetState.
    resetState: () => {
      isRecording = false;
      publish(preserveProcessingOnReset
        ? { ...emptyState, isProcessing: true }
        : emptyState);
    },
    // Mirrors recognition.onend with a captured transcript.
    finishWithTranscript: (transcript: string, confidence = 0.9) => {
      isRecording = false;
      publish({
        isListening: false,
        isGathering: false,
        isProcessing: true,
        transcript,
        confidence,
        error: null
      });
    }
  };
});

vi.mock('../hooks/useVoiceRecording', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useVoiceRecording: () => ({
      ...useSyncExternalStore(recorder.subscribe, recorder.getSnapshot),
      startRecording: recorder.startRecording,
      stopRecording: recorder.stopRecording,
      resetState: recorder.resetState
    })
  };
});

vi.mock('../hooks/useVoiceFeedbackSound', () => ({
  useVoiceFeedbackSound: () => ({ playFeedback: vi.fn(), stopFeedback: vi.fn() })
}));

import VoiceInterface from './VoiceInterface';

const PROCESSING_TIMEOUT_MS = 20000;
const TRANSCRIPT = 'create a poll';

const buildResponse = (overrides: Partial<VoiceCommandResponse> = {}): VoiceCommandResponse => ({
  success: true,
  command: { action: 'create', target: 'poll', parameters: {}, confidence: 0.9 },
  feedback: { message: 'Created a poll', type: 'success', shouldSpeak: false },
  ...overrides
});

const failureResponse = buildResponse({
  success: false,
  feedback: { message: 'Could not understand that', type: 'not_understood', shouldSpeak: false }
});

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

// The interface waits 300ms before arming the microphone.
const armMicrophone = async () => {
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
};

const speak = async (transcript = TRANSCRIPT) => {
  await act(async () => {
    recorder.finishWithTranscript(transcript);
  });
  await flush();
};

describe('VoiceInterface', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    recorder.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('re-processes the same phrase after a retry instead of sticking on "Processing command..."', async () => {
    const onTranscriptComplete = vi
      .fn<(transcript: string) => Promise<VoiceCommandResponse>>()
      .mockResolvedValueOnce(failureResponse)
      .mockResolvedValueOnce(buildResponse());

    render(
      <VoiceInterface isOpen onClose={vi.fn()} onTranscriptComplete={onTranscriptComplete} />
    );

    await armMicrophone();
    expect(screen.getByText('Listening...')).toBeInTheDocument();

    await speak();
    expect(onTranscriptComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Could not understand that')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
    });
    await armMicrophone();

    // Same phrase as before: previously the dedup guard swallowed it while the
    // recording hook still flipped isProcessing, wedging the UI on 'processing'.
    await speak();

    expect(onTranscriptComplete).toHaveBeenCalledTimes(2);
    expect(onTranscriptComplete).toHaveBeenNthCalledWith(2, TRANSCRIPT);
    expect(screen.queryByText('Processing command...')).not.toBeInTheDocument();
    expect(screen.getByText('Created a poll')).toBeInTheDocument();
  });

  it('leaves "processing" for the success state when the command resolves', async () => {
    const onTranscriptComplete = vi.fn().mockResolvedValue(buildResponse());

    render(
      <VoiceInterface isOpen onClose={vi.fn()} onTranscriptComplete={onTranscriptComplete} />
    );

    await armMicrophone();
    await speak();

    expect(screen.queryByText('Processing command...')).not.toBeInTheDocument();
    expect(screen.getByText('Created a poll')).toBeInTheDocument();
  });

  it('leaves "processing" for the error state when the command rejects', async () => {
    const onTranscriptComplete = vi.fn().mockRejectedValue(new Error('network down'));

    render(
      <VoiceInterface isOpen onClose={vi.fn()} onTranscriptComplete={onTranscriptComplete} />
    );

    await armMicrophone();
    await speak();

    expect(screen.queryByText('Processing command...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
  });

  it('forces an exit from "processing" when the command never settles', async () => {
    const onTranscriptComplete = vi.fn().mockReturnValue(new Promise<VoiceCommandResponse>(() => {}));

    render(
      <VoiceInterface isOpen onClose={vi.fn()} onTranscriptComplete={onTranscriptComplete} />
    );

    await armMicrophone();
    await speak();
    expect(screen.getByText('Processing command...')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(PROCESSING_TIMEOUT_MS);
    });

    expect(screen.queryByText('Processing command...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
  });

  it('ignores a command that settles after the processing timeout', async () => {
    let resolveCommand: (value: VoiceCommandResponse) => void = () => {};
    const onTranscriptComplete = vi.fn().mockReturnValue(
      new Promise<VoiceCommandResponse>((resolve) => {
        resolveCommand = resolve;
      })
    );
    const onClose = vi.fn();

    render(
      <VoiceInterface isOpen onClose={onClose} onTranscriptComplete={onTranscriptComplete} />
    );

    await armMicrophone();
    await speak();
    expect(screen.getByText('Processing command...')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(PROCESSING_TIMEOUT_MS);
    });
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();

    await act(async () => {
      resolveCommand(buildResponse());
    });
    await flush();

    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    expect(screen.queryByText('Created a poll')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not auto-close from a command that finishes after the user has retried', async () => {
    let resolveFirst: (value: VoiceCommandResponse) => void = () => {};
    const onTranscriptComplete = vi.fn()
      .mockImplementationOnce(() => new Promise<VoiceCommandResponse>((resolve) => {
        resolveFirst = resolve;
      }))
      .mockReturnValue(new Promise<VoiceCommandResponse>(() => {}));
    const onClose = vi.fn();

    render(
      <VoiceInterface isOpen onClose={onClose} onTranscriptComplete={onTranscriptComplete} />
    );

    await armMicrophone();
    await speak();

    await act(async () => {
      vi.advanceTimersByTime(PROCESSING_TIMEOUT_MS);
    });
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
    });
    await armMicrophone();
    await speak('trigger the randomiser');

    await act(async () => {
      resolveFirst(buildResponse());
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Processing command...')).toBeInTheDocument();
  });

  it('starts clean after close and reopen, so a repeated phrase is processed again', async () => {
    const onTranscriptComplete = vi
      .fn<(transcript: string) => Promise<VoiceCommandResponse>>()
      .mockResolvedValueOnce(failureResponse)
      .mockResolvedValueOnce(buildResponse());
    const onClose = vi.fn();

    const { rerender } = render(
      <VoiceInterface isOpen onClose={onClose} onTranscriptComplete={onTranscriptComplete} />
    );

    await armMicrophone();
    await speak();
    expect(onTranscriptComplete).toHaveBeenCalledTimes(1);

    await act(async () => {
      // The footer button; the header's icon button is labelled just "Close".
      fireEvent.click(screen.getByRole('button', { name: 'Close Esc' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <VoiceInterface isOpen={false} onClose={onClose} onTranscriptComplete={onTranscriptComplete} />
    );
    rerender(
      <VoiceInterface isOpen onClose={onClose} onTranscriptComplete={onTranscriptComplete} />
    );

    await armMicrophone();
    await speak();

    expect(onTranscriptComplete).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Processing command...')).not.toBeInTheDocument();
    expect(screen.getByText('Created a poll')).toBeInTheDocument();
  });

  it('does not auto-close from a command that settles after the parent closes without handleClose', async () => {
    let resolveCommand: (value: VoiceCommandResponse) => void = () => {};
    const onTranscriptComplete = vi.fn().mockReturnValue(
      new Promise<VoiceCommandResponse>((resolve) => {
        resolveCommand = resolve;
      })
    );
    const onClose = vi.fn();
    const speakUtterance = vi.fn();
    const cancelSpeech = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak: speakUtterance, cancel: cancelSpeech });

    const { rerender } = render(
      <VoiceInterface isOpen onClose={onClose} onTranscriptComplete={onTranscriptComplete} />
    );

    await armMicrophone();
    await speak();
    expect(screen.getByText('Processing command...')).toBeInTheDocument();

    rerender(
      <VoiceInterface isOpen={false} onClose={onClose} onTranscriptComplete={onTranscriptComplete} />
    );

    await act(async () => {
      resolveCommand(buildResponse({
        feedback: { message: 'Created a poll', type: 'success', shouldSpeak: true }
      }));
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(speakUtterance).not.toHaveBeenCalled();

    rerender(
      <VoiceInterface isOpen onClose={onClose} onTranscriptComplete={onTranscriptComplete} />
    );
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('re-arms listening for a low-quality transcript instead of sticking on processing', async () => {
    const onTranscriptComplete = vi.fn().mockResolvedValue(buildResponse());

    render(
      <VoiceInterface isOpen onClose={vi.fn()} onTranscriptComplete={onTranscriptComplete} />
    );

    await armMicrophone();
    await speak('hi');

    expect(onTranscriptComplete).not.toHaveBeenCalled();
    expect(screen.queryByText('Processing command...')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText('Listening...')).toBeInTheDocument();
  });

  it('does not snap back to processing when retrying after a timeout while the recorder is still processing', async () => {
    const onTranscriptComplete = vi.fn().mockReturnValue(new Promise<VoiceCommandResponse>(() => {}));

    render(
      <VoiceInterface isOpen onClose={vi.fn()} onTranscriptComplete={onTranscriptComplete} />
    );

    await armMicrophone();
    await speak();
    await act(async () => {
      vi.advanceTimersByTime(PROCESSING_TIMEOUT_MS);
    });
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();

    recorder.preserveProcessingOnReset(true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
    });

    expect(screen.queryByText('Processing command...')).not.toBeInTheDocument();
    expect(screen.getByText('Activating microphone...')).toBeInTheDocument();

    await armMicrophone();
    expect(screen.getByText('Listening...')).toBeInTheDocument();
  });
});
