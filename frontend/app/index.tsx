import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [processingAuth, setProcessingAuth] = useState(true);

  useEffect(() => {
    // On web, check if we have a session_id in the URL (returning from OAuth)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = window.location.href;
      const hasSessionId = url.includes('session_id=');
      
      if (hasSessionId) {
        // Give AuthContext time to process the session_id
        // The AuthContext's useEffect will handle extracting and exchanging it
        console.log('Session ID detected in URL, waiting for auth processing...');
        // Wait a bit longer for the auth to process
        const timer = setTimeout(() => {
          setProcessingAuth(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
    setProcessingAuth(false);
  }, []);

  useEffect(() => {
    // Don't redirect while still processing auth callback
    if (processingAuth) return;
    
    if (!loading) {
      if (user) {
        // Clear any session_id from URL on web before navigating
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          if (url.searchParams.has('session_id') || url.hash.includes('session_id')) {
            window.history.replaceState({}, '', url.pathname);
          }
        }
        router.replace('/(tabs)/jobs');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, processingAuth]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2196F3" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});