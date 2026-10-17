import type { VoiceCommand } from '../../types/voiceControl';

// Command parameters come from the server's pattern matcher or an LLM, so each
// is checked for the type a handler needs before use. A value of the wrong type
// reads as absent and the handler falls back to its default.

type Parameters = VoiceCommand['parameters'];

const parametersOf = (command: VoiceCommand): Parameters =>
  command.parameters && typeof command.parameters === 'object' ? command.parameters : {};

export const numberParam = (command: VoiceCommand, key: string): number | undefined => {
  const value: unknown = parametersOf(command)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

export const stringParam = (command: VoiceCommand, key: string): string | undefined => {
  const value: unknown = parametersOf(command)[key];
  return typeof value === 'string' ? value : undefined;
};

/** The string entries of an array parameter, or undefined when it is not an array */
export const stringArrayParam = (command: VoiceCommand, key: string): string[] | undefined => {
  const value: unknown = parametersOf(command)[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
};

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';
