import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { login } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* App Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="car-sport" size={80} color="#2196F3" />
        </View>
        
        {/* Title */}
        <Text style={styles.title}>GlassFlow</Text>
        <Text style={styles.subtitle}>Auto Glass Job Scheduler</Text>
        
        {/* Features */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <Ionicons name="map" size={24} color="#2196F3" />
            <Text style={styles.featureText}>Interactive Map View</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="calendar" size={24} color="#2196F3" />
            <Text style={styles.featureText}>Smart Scheduling</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="people" size={24} color="#2196F3" />
            <Text style={styles.featureText}>Team Management</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="flash" size={24} color="#2196F3" />
            <Text style={styles.featureText}>Real-time Updates</Text>
          </View>
        </View>
        
        {/* Login Button */}
        <TouchableOpacity style={styles.button} onPress={login}>
          <Ionicons name="logo-google" size={24} color="#fff" />
          <Text style={styles.buttonText}>Sign in with Google</Text>
        </TouchableOpacity>
        
        <Text style={styles.disclaimer}>
          By signing in, you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 48,
  },
  features: {
    width: '100%',
    marginBottom: 48,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingLeft: 24,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  disclaimer: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 32,
  },
});