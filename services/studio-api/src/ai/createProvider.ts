import type { StudioEnv } from '../env';
import { FixtureModelProvider } from './fixtureProvider';
import { OpenAiCompatibleProvider } from './openAiCompatibleProvider';
import type { ModelProvider } from './provider';
import { ModelProviderError } from './provider';

class UnavailableModelProvider implements ModelProvider {
  readonly name = 'unavailable';

  constructor(private readonly reason: string) {}

  generate(): Promise<never> {
    return Promise.reject(new ModelProviderError(this.reason, true));
  }

  patch(): Promise<never> {
    return Promise.reject(new ModelProviderError(this.reason, true));
  }

  repair(): Promise<never> {
    return Promise.reject(new ModelProviderError(this.reason, true));
  }

  moderate(): Promise<never> {
    return Promise.reject(new ModelProviderError(this.reason, true));
  }
}

export function createModelProvider(env: StudioEnv): ModelProvider {
  if (env.AI_PROVIDER === 'fixture') return new FixtureModelProvider();

  if (env.AI_PROVIDER === 'openai-compatible') {
    if (!env.AI_API_KEY) {
      return new UnavailableModelProvider('The configured model provider has no API key.');
    }
    return new OpenAiCompatibleProvider({
      baseUrl: env.AI_BASE_URL,
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL,
    });
  }

  return new UnavailableModelProvider(`Unsupported AI provider: ${env.AI_PROVIDER}`);
}
