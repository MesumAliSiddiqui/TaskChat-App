import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setOnAuthFailure } from '../api/client';
import {
  setAuthTokens,
  getAuthTokens,
  getRefreshToken,
  clearAuthTokens,
} from '../utils/secureStorage';
import {
  registerDeviceToken,
  unregisterDeviceToken,
} from '../services/pushNotificationService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    try {
      await unregisterDeviceToken().catch(() => {});
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }).catch(() => {});
      }
      await clearAuthTokens();
      await AsyncStorage.removeItem('user');
    } catch (err) {
      console.warn('Logout storage clear failed:', err.message);
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    // Register the logout callback with client.jsx for 401 refresh failure
    setOnAuthFailure(logout);

    const restoreSession = async () => {
      try {
        const { token: savedToken } = await getAuthTokens();
        const savedUser = await AsyncStorage.getItem('user');
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          registerDeviceToken().catch(() => {});
        }
      } catch (err) {
        console.warn('Failed to restore session:', err);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    await setAuthTokens(data.token, data.refreshToken);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    registerDeviceToken().catch(() => {});
    return data.user;
  };

  const signup = async (payload) => {
    const { data } = await api.post('/auth/signup', payload);
    await setAuthTokens(data.token, data.refreshToken);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    registerDeviceToken().catch(() => {});
    return data.user;
  };

  // Called after the native Google Sign-In SDK returns an idToken.
  // Returns { ...user, needsPhone } so the caller can redirect to the
  // AddPhone screen when the backend flags a placeholder phone number.
  const loginWithGoogle = async (idToken) => {
    const { data } = await api.post('/auth/google', { idToken });
    await setAuthTokens(data.token, data.refreshToken);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    registerDeviceToken().catch(() => {});
    return { ...data.user, needsPhone: data.needsPhone };
  };

  // Called after the native Facebook SDK returns an accessToken.
  const loginWithFacebook = async (accessToken) => {
    const { data } = await api.post('/auth/facebook', { accessToken });
    await setAuthTokens(data.token, data.refreshToken);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    registerDeviceToken().catch(() => {});
    return { ...data.user, needsPhone: data.needsPhone };
  };

  // Saves the real phone number after a social signup that started with a
  // placeholder. Called from the AddPhone screen.
  const savePhoneNumber = async (phone) => {
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
    const { data } = await api.patch('/users/me/phone', { phone: trimmedPhone });
    const newPhone = data?.phone || trimmedPhone;

    // Retrieve fresh user object from storage to avoid any stale closure
    let baseUser = user;
    try {
      const stored = await AsyncStorage.getItem('user');
      if (stored) {
        baseUser = { ...JSON.parse(stored), ...(baseUser || {}) };
      }
    } catch (e) {
      console.warn('Failed to parse stored user in savePhoneNumber:', e);
    }

    const updatedUser = {
      ...(baseUser || {}),
      phone: newPhone,
    };

    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

    // Functional update guarantees React receives the latest prev state and
    // forces immediate re-evaluation in consumers like AppNavigator
    setUser((prev) => ({
      ...(prev || {}),
      ...updatedUser,
      phone: newPhone,
    }));

    return updatedUser;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        signup,
        loginWithGoogle,
        loginWithFacebook,
        savePhoneNumber,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);