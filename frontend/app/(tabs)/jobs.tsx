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
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth } from 'date-fns';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Default technicians - must match other pages
const DEFAULT_TECHNICIANS = [
  { name: 'Iman', user_id: 'default_iman' },
  { name: 'Enrique', user_id: 'default_enrique' },
  { name: 'Alan', user_id: 'default_alan' },
];

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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedTech, setSelectedTech] = useState<string>('all');
  const [showTechFilter, setShowTechFilter] = useState(false);
  const [allTechnicians, setAllTechnicians] = useState<any[]>(DEFAULT_TECHNICIANS);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarViewMonth, setCalendarViewMonth] = useState(new Date());

  // Get days for calendar view
  const calendarDays = eachDayOfInterval({
    start: startOfMonth(calendarViewMonth),
    end: endOfMonth(calendarViewMonth),
  });

  // Get the day of week the month starts on (0 = Sunday)
  const startDayOfWeek = startOfMonth(calendarViewMonth).getDay();

  // Check if a day has jobs
  const hasJobsOnDay = (day: Date) => {
    return jobs.some(
      (job) => job.appointment_time && isSameDay(parseISO(job.appointment_time), day)
    );
  };

  useEffect(() => {
    if (sessionToken) {
      fetchJobs();
      fetchTechnicians();
    }
  }, [sessionToken]);

  // Check for success message from create job - only trigger once
  useEffect(() => {
    if (params.jobCreated === 'true' && params.customerName && !showSuccessModal) {
      setSuccessMessage(`Job created for ${params.customerName}`);
      setShowSuccessModal(true);
      // Refresh jobs list
      fetchJobs();
      // Clear the params by navigating without them
      router.setParams({ jobCreated: '', customerName: '' });
    }
  }, [params.jobCreated, params.customerName]);

  const fetchTechnicians = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/users`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAllTechnicians([...DEFAULT_TECHNICIANS, ...data]);
      }
    } catch (error) {
      console.error('Error fetching technicians:', error);
    }
  };

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

  // Filter jobs by selected date, status, AND technician
  const filteredJobs = jobs.filter((job) => {
    // Filter by date - only show jobs with appointment on selected date
    const matchesDate = job.appointment_time 
      ? isSameDay(parseISO(job.appointment_time), selectedDate)
      : false;
    
    // Filter by status
    const matchesStatus = filter === 'all' || job.status === filter;
    
    // Filter by technician
    const matchesTech = selectedTech === 'all' || job.assigned_to_name === selectedTech;
    
    return matchesDate && matchesStatus && matchesTech;
  });

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
          {item.part_number && (
            <View style={styles.partNumberBadge}>
              <Text style={styles.partNumberText}>{item.part_number}</Text>
            </View>
          )}
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
          onPress={() => {
            setCalendarViewMonth(selectedDate);
            setShowCalendarModal(true);
          }}
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

      {/* Full Calendar Modal */}
      <Modal
        visible={showCalendarModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCalendarModal(false)}
      >
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalContent}>
            {/* Calendar Header */}
            <View style={styles.calendarModalHeader}>
              <Text style={styles.calendarModalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowCalendarModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Month Navigation */}
            <View style={styles.calendarMonthNav}>
              <TouchableOpacity 
                onPress={() => setCalendarViewMonth(subMonths(calendarViewMonth, 1))}
                style={styles.calendarNavBtn}
              >
                <Ionicons name="chevron-back" size={28} color="#2196F3" />
              </TouchableOpacity>
              <Text style={styles.calendarMonthText}>
                {format(calendarViewMonth, 'MMMM yyyy')}
              </Text>
              <TouchableOpacity 
                onPress={() => setCalendarViewMonth(addMonths(calendarViewMonth, 1))}
                style={styles.calendarNavBtn}
              >
                <Ionicons name="chevron-forward" size={28} color="#2196F3" />
              </TouchableOpacity>
            </View>

            {/* Quick Jump Buttons */}
            <View style={styles.quickJumpRow}>
              <TouchableOpacity 
                style={styles.quickJumpBtn}
                onPress={() => {
                  setSelectedDate(new Date());
                  setShowCalendarModal(false);
                }}
              >
                <Text style={styles.quickJumpText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickJumpBtn}
                onPress={() => setCalendarViewMonth(new Date())}
              >
                <Text style={styles.quickJumpText}>This Month</Text>
              </TouchableOpacity>
            </View>

            {/* Week Days Header */}
            <View style={styles.calendarWeekDays}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <Text key={day} style={styles.calendarWeekDayText}>{day}</Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
              {/* Empty cells for days before month starts */}
              {Array.from({ length: startDayOfWeek }).map((_, index) => (
                <View key={`empty-${index}`} style={styles.calendarDayCell} />
              ))}
              
              {/* Actual days */}
              {calendarDays.map((day) => (
                <TouchableOpacity
                  key={day.toISOString()}
                  style={[
                    styles.calendarDayCell,
                    isSameDay(day, selectedDate) && styles.calendarDaySelected,
                    isSameDay(day, new Date()) && styles.calendarDayToday,
                  ]}
                  onPress={() => {
                    setSelectedDate(day);
                    setShowCalendarModal(false);
                  }}
                >
                  <Text style={[
                    styles.calendarDayText,
                    isSameDay(day, selectedDate) && styles.calendarDayTextSelected,
                    isSameDay(day, new Date()) && !isSameDay(day, selectedDate) && styles.calendarDayTextToday,
                  ]}>
                    {format(day, 'd')}
                  </Text>
                  {hasJobsOnDay(day) && (
                    <View style={[
                      styles.calendarDayDot,
                      isSameDay(day, selectedDate) && styles.calendarDayDotSelected
                    ]} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

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

      {/* Technician Filter */}
      <View style={styles.techFilterWrapper}>
        <TouchableOpacity 
          style={styles.techFilterButton}
          onPress={() => setShowTechFilter(true)}
        >
          <Ionicons name="person" size={18} color={selectedTech === 'all' ? '#666' : '#2196F3'} />
          <Text style={[
            styles.techFilterText,
            selectedTech !== 'all' && styles.techFilterTextActive
          ]}>
            {selectedTech === 'all' ? 'All Techs' : selectedTech}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Technician Filter Modal */}
      <Modal
        visible={showTechFilter}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTechFilter(false)}
      >
        <View style={styles.techModalOverlay}>
          <View style={styles.techModalContent}>
            <View style={styles.techModalHeader}>
              <Text style={styles.techModalTitle}>Filter by Technician</Text>
              <TouchableOpacity onPress={() => setShowTechFilter(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.techModalList}>
              {/* All option */}
              <TouchableOpacity
                style={[
                  styles.techModalOption,
                  selectedTech === 'all' && styles.techModalOptionSelected
                ]}
                onPress={() => {
                  setSelectedTech('all');
                  setShowTechFilter(false);
                }}
              >
                <Ionicons name="people" size={24} color={selectedTech === 'all' ? '#2196F3' : '#666'} />
                <Text style={[
                  styles.techModalOptionText,
                  selectedTech === 'all' && styles.techModalOptionTextActive
                ]}>All Technicians</Text>
                {selectedTech === 'all' && (
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                )}
              </TouchableOpacity>

              {/* Individual technicians */}
              {allTechnicians.map((tech) => (
                <TouchableOpacity
                  key={tech.user_id}
                  style={[
                    styles.techModalOption,
                    selectedTech === tech.name && styles.techModalOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedTech(tech.name);
                    setShowTechFilter(false);
                  }}
                >
                  <Ionicons name="person-circle" size={24} color={selectedTech === tech.name ? '#2196F3' : '#666'} />
                  <Text style={[
                    styles.techModalOptionText,
                    selectedTech === tech.name && styles.techModalOptionTextActive
                  ]}>{tech.name}</Text>
                  {selectedTech === tech.name && (
                    <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSuccessModal(false)}
        >
          <View style={styles.successModal}>
            <View style={styles.checkmarkContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>Job Created!</Text>
            <Text style={styles.successMessage}>{successMessage}</Text>
            <TouchableOpacity 
              style={styles.dismissButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.dismissButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
  techFilterWrapper: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  techFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  techFilterText: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 8,
  },
  techFilterTextActive: {
    color: '#2196F3',
    fontWeight: '600',
  },
  techModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  techModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
  },
  techModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  techModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  techModalList: {
    padding: 16,
  },
  techModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  techModalOptionSelected: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  techModalOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  techModalOptionTextActive: {
    fontWeight: '600',
    color: '#2196F3',
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
  partNumberBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  partNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
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
  dismissButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Calendar Modal Styles
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 380,
    padding: 16,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 12,
  },
  calendarModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  calendarMonthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarNavBtn: {
    padding: 8,
  },
  calendarMonthText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  quickJumpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  quickJumpBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 20,
  },
  quickJumpText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  calendarDaySelected: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 20,
  },
  calendarDayText: {
    fontSize: 16,
    color: '#333',
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  calendarDayTextToday: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  calendarDayDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2196F3',
  },
  calendarDayDotSelected: {
    backgroundColor: '#fff',
  },
});