import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useJobStore } from '../../stores/jobStore';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9800',
  scheduled: '#2196F3',
  in_progress: '#9C27B0',
  completed: '#4CAF50',
  cancelled: '#F44336',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function JobsScreen() {
  const { sessionToken, user } = useAuth();
  const { jobs, setJobs, setSelectedJob } = useJobStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (sessionToken) {
      fetchJobs();
    }
  }, [sessionToken]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/jobs`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setJobs(data);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  }, []);

  const filteredJobs = filter === 'all' ? jobs : jobs.filter((job) => job.status === filter);

  const renderJob = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.jobCard}
      onPress={() => {
        setSelectedJob(item);
        router.push('/job-details');
      }}
    >
      <View style={styles.jobHeader}>
        <View style={styles.jobTitleRow}>
          <Ionicons name="car-sport" size={20} color="#2196F3" />
          <Text style={styles.jobTitle} numberOfLines={1}>
            {item.customer_name}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: STATUS_COLORS[item.status] },
          ]}
        >
          <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
        </View>
      </View>

      <View style={styles.jobDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color="#666" />
          <Text style={styles.detailText} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="car" size={16} color="#666" />
          <Text style={styles.detailText}>
            {item.vehicle_year} {item.vehicle_make} {item.vehicle_model}
          </Text>
        </View>
        {item.assigned_to_name && (
          <View style={styles.detailRow}>
            <Ionicons name="person" size={16} color="#666" />
            <Text style={styles.detailText}>{item.assigned_to_name}</Text>
          </View>
        )}
        {item.appointment_time && (
          <View style={styles.detailRow}>
            <Ionicons name="time" size={16} color="#666" />
            <Text style={styles.detailText}>
              {new Date(item.appointment_time).toLocaleString()}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Jobs</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jobs</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/create-job')}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[styles.filterText, filter === 'all' && styles.filterTextActive]}
          >
            All ({jobs.length})
          </Text>
        </TouchableOpacity>
        {Object.keys(STATUS_COLORS).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              filter === status && styles.filterChipActive,
            ]}
            onPress={() => setFilter(status)}
          >
            <View
              style={[
                styles.filterDot,
                { backgroundColor: STATUS_COLORS[status] },
              ]}
            />
            <Text
              style={[
                styles.filterText,
                filter === status && styles.filterTextActive,
              ]}
            >
              {STATUS_LABELS[status]} (
              {jobs.filter((j) => j.status === status).length})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filteredJobs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="briefcase-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No jobs found</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/create-job')}
          >
            <Text style={styles.emptyButtonText}>Create First Job</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlashList
          data={filteredJobs}
          renderItem={renderJob}
          keyExtractor={(item) => item.job_id}
          estimatedItemSize={120}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: '#2196F3',
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  filterText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  jobDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});