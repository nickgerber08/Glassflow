import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useJobStore } from '../../stores/jobStore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, isSameDay, parseISO } from 'date-fns';

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
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (sessionToken) {
      fetchJobs();
    }
  }, [sessionToken]);

  // Check for success message from create job
  useEffect(() => {
    if (params.jobCreated === 'true' && params.customerName) {
      setSuccessMessage(`Job created for ${params.customerName}`);
      setShowSuccessModal(true);
      // Auto close after 3 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 3000);
    }
  }, [params]);

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

  // Filter jobs by selected date AND status
  const filteredJobs = jobs.filter((job) => {
    // Filter by date - only show jobs with appointment on selected date
    const matchesDate = job.appointment_time 
      ? isSameDay(parseISO(job.appointment_time), selectedDate)
      : false;
    
    // Filter by status
    const matchesStatus = filter === 'all' || job.status === filter;
    
    return matchesDate && matchesStatus;
  });

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

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
              {format(parseISO(item.appointment_time), 'h:mm a')}
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
          onPress={() => router.push({
            pathname: '/create-job',
            params: { preSelectedDate: selectedDate.toISOString() }
          })}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Date Selector */}
      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.dateNavButton}>
          <Ionicons name="chevron-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.dateDisplay}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar" size={20} color="#2196F3" />
          <Text style={styles.dateText}>
            {format(selectedDate, 'EEE, MMM d, yyyy')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={goToNextDay} style={styles.dateNavButton}>
          <Ionicons name="chevron-forward" size={24} color="#2196F3" />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
          <Text style={styles.todayText}>Today</Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}
          >
            <Text
              style={[styles.filterText, filter === 'all' && styles.filterTextActive]}
            >
              All ({filteredJobs.length})
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
                {filteredJobs.filter((j) => j.status === status).length})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {filteredJobs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="briefcase-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>
            No jobs scheduled for {format(selectedDate, 'MMM d, yyyy')}
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push({
              pathname: '/create-job',
              params: { preSelectedDate: selectedDate.toISOString() }
            })}
          >
            <Text style={styles.emptyButtonText}>Create Job</Text>
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

      {/* Success Modal */}
      <Modal
        transparent={true}
        visible={showSuccessModal}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.checkmarkContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>Job Created!</Text>
            <Text style={styles.successMessage}>{successMessage}</Text>
          </View>
        </View>
      </Modal>
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
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dateNavButton: {
    padding: 8,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 8,
    justifyContent: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
  },
  todayButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  todayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  filterWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 6,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    marginRight: 6,
    height: 26,
  },
  filterChipActive: {
    backgroundColor: '#2196F3',
  },
  filterDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 5,
  },
  filterText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
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
    padding: 18,
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
    marginBottom: 14,
  },
  jobTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  jobTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  jobDetails: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 15,
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
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '80%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  checkmarkContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});