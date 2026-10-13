import React from 'react';
import { renderHook, render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useVoiceRecording } from './useVoiceRecording';
import VoiceInterface from '../components/VoiceInterface';
import type { VoiceCommandResponse } from '../types/voiceControl';

// Ways the recogniser lifecycle could go wrong:
//  1. Enter is pressed before the first result: the final result that arrives
//     after stop() must still reach the transcript.
//  2. An interim result exists at Enter: the later final correction replaces it.
//  3. Reset after Enter: late events from the aborted recogniser are ignored.
//  4. Enter with an interim result: do not execute that command and then a
//     second corrected command when the recogniser delivers its final result.

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
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
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
    act(() => {
      recognition.emitResult('start a timer for five minutes', true);
      recognition.onend?.();
    });

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

  it('executes only the final command when Enter precedes a corrected result', async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const executed: string[] = [];
    render(React.createElement(VoiceInterface, {
      isOpen: true,
      onClose: () => {},
      onTranscriptComplete: async (transcript: string): Promise<VoiceCommandResponse> => {
        executed.push(transcript);
        return {
          success: true,
          command: { action: 'create', target: 'timer', parameters: {}, confidence: 0.9 },
          feedback: { message: 'Timer created', type: 'success', shouldSpeak: false }
        };
      }
    }));
    await act(async () => { vi.advanceTimersByTime(300); });
    const recognition = FakeRecognition.instances.at(-1)!;
    act(() => recognition.emitResult('start a timer for five minutes', false));
    await act(async () => { fireEvent.keyDown(document, { key: 'Enter' }); });
    expect(executed).toEqual([]);
    await act(async () => {
      recognition.emitResult('start a timer for nine minutes', true);
      recognition.onend?.();
    });
    expect(executed).toEqual(['start a timer for nine minutes']);
  });
});
