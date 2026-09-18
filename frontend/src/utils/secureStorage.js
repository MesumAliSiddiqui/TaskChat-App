import * as Keychain from 'react-native-keychain';

const KEYCHAIN_SERVICE = 'com.taskchat.auth';

/**
 * Stores accessToken and refreshToken securely in hardware-backed keystore / keychain.
 */
export const setAuthTokens = async (token, refreshToken) => {
  try {
    const payload = JSON.stringify({ token: token || '', refreshToken: refreshToken || '' });
    await Keychain.setGenericPassword('auth_session', payload, {
      service: KEYCHAIN_SERVICE,
    });
  } catch (error) {
    console.warn('Failed to save tokens to secure keychain:', error);
  }
};

/**
 * Retrieves both accessToken and refreshToken from keychain.
 */
export const getAuthTokens = async () => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE,
    });
    if (credentials && credentials.password) {
      return JSON.parse(credentials.password);
    }
  } catch (error) {
    console.warn('Failed to retrieve tokens from keychain:', error);
  }
  return { token: null, refreshToken: null };
};

/**
 * Convenience helper to get only the active access token.
 */
export const getAccessToken = async () => {
  const tokens = await getAuthTokens();
  return tokens?.token || null;
};

/**
 * Convenience helper to get only the active refresh token.
 */
export const getRefreshToken = async () => {
  const tokens = await getAuthTokens();
  return tokens?.refreshToken || null;
};

/**
 * Resets / removes the stored tokens from the secure keychain on logout.
 */
export const clearAuthTokens = async () => {
  try {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  } catch (error) {
    console.warn('Failed to clear keychain tokens:', error);
  }
};
