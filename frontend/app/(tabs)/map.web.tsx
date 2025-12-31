import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useJobStore } from '../../stores/jobStore';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9800',
  scheduled: '#2196F3',
  in_progress: '#9C27B0',
  completed: '#4CAF50',
  cancelled: '#F44336',
};

export default function MapScreen() {
  const { sessionToken } = useAuth();
  const { jobs, setSelectedJob } = useJobStore();
  const router = useRouter();
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocation(location);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </SafeAreaView>
    );
  }

  // Web version - show list view with addresses
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Map</Text>
        <View style={styles.legendContainer}>
          <Text style={styles.webNote}>
            Map view is available on mobile devices. Showing list of job locations:
          </Text>
        </View>
      </View>
      <View style={styles.webListContainer}>
        {jobs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="map-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>No jobs to display</Text>
          </View>
        ) : (
          jobs.map((job) => (
            <TouchableOpacity
              key={job.job_id}
              style={styles.webJobCard}
              onPress={() => {
                setSelectedJob(job);
                router.push('/job-details');
              }}
            >
              <View style={[styles.statusIndicator, { backgroundColor: STATUS_COLORS[job.status] }]} />
              <View style={styles.webJobContent}>
                <Text style={styles.webJobTitle}>{job.customer_name}</Text>
                <Text style={styles.webJobAddress}>{job.address}</Text>
                <Text style={styles.webJobCoords}>
                  📍 {job.lat.toFixed(4)}, {job.lng.toFixed(4)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webNote: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  webListContainer: {
    flex: 1,
    padding: 16,
  },
  webJobCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  webJobContent: {
    flex: 1,
  },
  webJobTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  webJobAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  webJobCoords: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
});