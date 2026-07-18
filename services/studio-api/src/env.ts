export interface StudioEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  PLAYER_ASSETS: Fetcher;
  AI: Ai;
  AI_PROVIDER: string;
  AI_MODEL: string;
  AI_BASE_URL: string;
  AI_API_KEY?: string;
  DEVICE_TOKEN_SIGNING_SECRET?: string;
  PUBLIC_PLAYER_ORIGIN: string;
  ALLOWED_ORIGINS: string;
  DAILY_GENERATION_LIMIT: string;
  DAILY_NETWORK_GENERATION_LIMIT: string;
  DAILY_SAFETY_REVIEW_LIMIT: string;
  DAILY_NETWORK_SAFETY_REVIEW_LIMIT: string;
  DAILY_NETWORK_UPLOAD_LIMIT: string;
  DAILY_NETWORK_UPLOAD_BYTES: string;
  DAILY_DRAFT_CREATION_LIMIT: string;
  DAILY_NETWORK_DRAFT_CREATION_LIMIT: string;
  DAILY_NETWORK_REGISTRATION_LIMIT: string;
  MAXIMUM_DRAFTS_PER_OWNER: string;
  PUBLICATION_TTL_DAYS: string;
}

export interface StudioConfig {
  publicPlayerOrigin: string;
  allowedOrigins: ReadonlySet<string>;
  dailyGenerationLimit: number;
  dailyNetworkGenerationLimit: number;
  dailySafetyReviewLimit: number;
  dailyNetworkSafetyReviewLimit: number;
  dailyNetworkUploadLimit: number;
  dailyNetworkUploadBytes: number;
  dailyDraftCreationLimit: number;
  dailyNetworkDraftCreationLimit: number;
  maximumDraftsPerOwner: number;
  dailyNetworkRegistrationLimit: number;
  publicationTtlDays: number;
  deviceTokenSigningSecret: string;
}

function boundedInteger(value: string, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function readConfig(env: StudioEnv): StudioConfig {
  if (!env.DEVICE_TOKEN_SIGNING_SECRET || env.DEVICE_TOKEN_SIGNING_SECRET.length < 32) {
    throw new Error('DEVICE_TOKEN_SIGNING_SECRET must be configured with at least 32 characters.');
  }
  return {
    publicPlayerOrigin: env.PUBLIC_PLAYER_ORIGIN.replace(/\/$/, ''),
    allowedOrigins: new Set(
      env.ALLOWED_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
    dailyGenerationLimit: boundedInteger(env.DAILY_GENERATION_LIMIT, 20, 1, 500),
    dailyNetworkGenerationLimit: boundedInteger(
      env.DAILY_NETWORK_GENERATION_LIMIT,
      1_000,
      20,
      10_000,
    ),
    dailySafetyReviewLimit: boundedInteger(env.DAILY_SAFETY_REVIEW_LIMIT, 50, 5, 500),
    dailyNetworkSafetyReviewLimit: boundedInteger(
      env.DAILY_NETWORK_SAFETY_REVIEW_LIMIT,
      1_000,
      20,
      10_000,
    ),
    dailyNetworkUploadLimit: boundedInteger(env.DAILY_NETWORK_UPLOAD_LIMIT, 200, 20, 2_000),
    dailyNetworkUploadBytes: boundedInteger(
      env.DAILY_NETWORK_UPLOAD_BYTES,
      200_000_000,
      20_000_000,
      1_000_000_000,
    ),
    dailyDraftCreationLimit: boundedInteger(env.DAILY_DRAFT_CREATION_LIMIT, 50, 5, 500),
    dailyNetworkDraftCreationLimit: boundedInteger(
      env.DAILY_NETWORK_DRAFT_CREATION_LIMIT,
      500,
      20,
      5_000,
    ),
    maximumDraftsPerOwner: boundedInteger(env.MAXIMUM_DRAFTS_PER_OWNER, 100, 10, 1_000),
    dailyNetworkRegistrationLimit: boundedInteger(
      env.DAILY_NETWORK_REGISTRATION_LIMIT,
      50,
      5,
      500,
    ),
    publicationTtlDays: boundedInteger(env.PUBLICATION_TTL_DAYS, 90, 1, 365),
    deviceTokenSigningSecret: env.DEVICE_TOKEN_SIGNING_SECRET,
  };
}
