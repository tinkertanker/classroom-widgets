// The host reconnect token issued by session:create responses, persisted
// together with the session code it belongs to.

const HOST_TOKEN_STORAGE_KEY = 'classroom-widgets:hostToken';
// The session code the stored host token belongs to. Tabs share storage, so a
// token is only ever sent with the code it was issued for.
const HOST_TOKEN_CODE_STORAGE_KEY = 'classroom-widgets:hostTokenCode';

export const readStoredHostToken = (): string | null =>
  localStorage.getItem(HOST_TOKEN_STORAGE_KEY);

export const writeStoredHostToken = (token: string | null, code?: string | null): void => {
  if (token) {
    localStorage.setItem(HOST_TOKEN_STORAGE_KEY, token);
    if (code) localStorage.setItem(HOST_TOKEN_CODE_STORAGE_KEY, code);
  } else {
    localStorage.removeItem(HOST_TOKEN_STORAGE_KEY);
    localStorage.removeItem(HOST_TOKEN_CODE_STORAGE_KEY);
  }
};

/**
 * The token to send when reclaiming `code`: this tab's own token, or a newer
 * one another tab stored for the same session since this one loaded. Never
 * another session's.
 */
export const hostTokenForCode = (code: string, ownToken: string | null): string | null => {
  const storedToken = readStoredHostToken();
  return storedToken && localStorage.getItem(HOST_TOKEN_CODE_STORAGE_KEY) === code
    ? storedToken
    : ownToken;
};
