import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

WebBrowser.maybeCompleteAuthSession();

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  sessionToken: string | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  // Handle deep links and web URL params
  useEffect(() => {
    const handleUrl = async (url: string) => {
      const sessionId = extractSessionId(url);
      if (sessionId) {
        console.log('Found session_id, exchanging...');
        await exchangeSessionId(sessionId);
      }
    };

    // On web, check the current URL directly
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const currentUrl = window.location.href;
      if (currentUrl.includes('session_id=')) {
        handleUrl(currentUrl);
        return;
      }
    }

    // Check initial URL (cold start) - for native apps
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      }
    });

    // Listen for URL changes (hot link)
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const checkExistingSession = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (token) {
        setSessionToken(token);
        await fetchUser(token);
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractSessionId = (url: string): string | null => {
    // Check hash first (#session_id=...)
    const hashMatch = url.match(/#session_id=([^&]+)/);
    if (hashMatch) {
      return hashMatch[1];
    }
    
    // Check query string (?session_id=...)
    const queryMatch = url.match(/[?&]session_id=([^&]+)/);
    if (queryMatch) {
      return queryMatch[1];
    }
    
    return null;
  };

  const exchangeSessionId = async (sessionId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
        method: 'POST',
        headers: {
          'X-Session-ID': sessionId,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to exchange session ID');
      }

      const data = await response.json();
      const token = data.session_token;
      
      await AsyncStorage.setItem('session_token', token);
      setSessionToken(token);
      setUser(data.user);
    } catch (error) {
      console.error('Error exchanging session ID:', error);
    } finally {
      setLoading(false);
    }
  };

  const registerPushToken = async (token: string) => {
    try {
      // Only register on physical devices
      if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return;
      }

      // Get push token
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted');
        return;
      }

      // Get Expo push token - handle missing projectId gracefully
      let pushToken: string;
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const pushTokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        pushToken = pushTokenData.data;
      } catch (pushError) {
        // Push notifications may not work in Expo Go with SDK 53+
        console.log('Push token not available in this environment');
        return;
      }

      // Register token with backend
      await fetch(`${BACKEND_URL}/api/push-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ push_token: pushToken }),
      });

      console.log('Push token registered:', pushToken);
    } catch (error) {
      // Non-critical error - don't show to user
      console.log('Push token registration skipped');
    }
  };

  const fetchUser = async (token: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        // Register push token after successful user fetch
        registerPushToken(token);
      } else {
        // Session expired or invalid
        await AsyncStorage.removeItem('session_token');
        setSessionToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const login = async () => {
    try {
      let redirectUrl: string;
      
      if (Platform.OS === 'web') {
        // Use full current URL for web to work with deployed apps at paths like /share?app=xxx
        if (typeof window !== 'undefined') {
          // For e1ectron.ai deployed apps, we need to preserve the full URL including path and query
          const currentUrl = new URL(window.location.href);
          // Remove any existing session_id params to avoid confusion
          currentUrl.searchParams.delete('session_id');
          currentUrl.hash = '';
          redirectUrl = currentUrl.toString();
        } else {
          redirectUrl = `${BACKEND_URL}/`;
        }
      } else {
        redirectUrl = Linking.createURL('/');
      }

      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          const sessionId = extractSessionId(result.url);
          if (sessionId) {
            await exchangeSessionId(sessionId);
          }
        }
      }
    } catch (error) {
      console.error('Error during login:', error);
    }
  };

  const logout = async () => {
    try {
      if (sessionToken) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      await AsyncStorage.removeItem('session_token');
      setSessionToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    if (sessionToken) {
      await fetchUser(sessionToken);
    }
  };

  return (
    <AuthContext.Provider value={{ user, sessionToken, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}