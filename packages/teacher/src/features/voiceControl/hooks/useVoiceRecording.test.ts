import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useVoiceRecording } from './useVoiceRecording';

// Ways the recogniser lifecycle could go wrong:
//  1. Enter is pressed before the first result: the final result that arrives
//     after stop() must still reach the transcript.
//  2. An interim result exists at Enter: the later final correction replaces it.
//  3. Reset after Enter: late events from the aborted recogniser are ignored.

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  onstart: any; onresult: any; onerror: any; onend: any;
  continuous = false; interimResults = false; lang = ''; maxAlternatives = 1;
  constructor() { FakeRecognition.instances.push(this); }
  start() { this.onstart?.(); }
  stop() {}
  abort() {}
  emitResult(transcript: string, isFinal: boolean) {
    const phrase: any = [{ transcript, confidence: 0.9 }];
    phrase.isFinal = isFinal;
    this.onresult?.({ results: [phrase] });
  }
}

describe('useVoiceRecording', () => {
  beforeEach(() => {
    FakeRecognition.instances = [];
    (window as any).SpeechRecognition = FakeRecognition;
  });

  it('keeps the final result that arrives after Enter, before any earlier result', async () => {
    const { result } = renderHook(() => useVoiceRecording());
    await act(async () => { await result.current.startRecording(); });
    const recognition = FakeRecognition.instances[0];

    await act(async () => { await result.current.stopRecording(); });
    act(() => {
      recognition.emitResult('start a timer for five minutes', true);
      recognition.onend?.();
    });

    expect(result.current.transcript).toBe('start a timer for five minutes');
    expect(result.current.isProcessing).toBe(true);
  });

  it('replaces an interim transcript with the late final one', async () => {
    const { result } = renderHook(() => useVoiceRecording());
    await act(async () => { await result.current.startRecording(); });
    const recognition = FakeRecognition.instances[0];

    act(() => recognition.emitResult('start a timer', false));
    await act(async () => { await result.current.stopRecording(); });
    act(() => recognition.emitResult('start a timer for five minutes', true));

    expect(result.current.transcript).toBe('start a timer for five minutes');
  });

  it('ignores late events after a reset', async () => {
    const { result } = renderHook(() => useVoiceRecording());
    await act(async () => { await result.current.startRecording(); });
    const recognition = FakeRecognition.instances[0];

    await act(async () => { await result.current.stopRecording(); });
    act(() => result.current.resetState());
    act(() => {
      recognition.emitResult('old command', true);
      recognition.onend?.();
    });

    expect(result.current.transcript).toBe('');
  });
});
