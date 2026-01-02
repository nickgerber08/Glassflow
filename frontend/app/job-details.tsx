import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useJobStore } from '../stores/jobStore';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay } from 'date-fns';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Default technicians - must match create-job.tsx
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

export default function JobDetailsScreen() {
  const { sessionToken, user } = useAuth();
  const { selectedJob, updateJob } = useJobStore();
  const router = useRouter();
  const [job, setJob] = useState(selectedJob);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [allTechnicians, setAllTechnicians] = useState<any[]>(DEFAULT_TECHNICIANS);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempAppointmentTime, setTempAppointmentTime] = useState<Date | null>(null);
  const [showTechModal, setShowTechModal] = useState(false);
  const [partNumber, setPartNumber] = useState(selectedJob?.part_number || '');
  const [editingPartNumber, setEditingPartNumber] = useState(false);
  const [paymentType, setPaymentType] = useState<string>(selectedJob?.payment_type || '');
  const [amountToCollect, setAmountToCollect] = useState<string>(
    selectedJob?.amount_to_collect ? selectedJob.amount_to_collect.toString() : ''
  );
  const [omegaInvoice, setOmegaInvoice] = useState<string>(selectedJob?.omega_invoice || '');
  const [editingOmega, setEditingOmega] = useState(false);
  const [isFirstStop, setIsFirstStop] = useState<boolean>(selectedJob?.is_first_stop || false);
  const [firstStopCount, setFirstStopCount] = useState<number>(0);
  const [showRescheduleCalendar, setShowRescheduleCalendar] = useState(false);
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(
    selectedJob?.appointment_time ? new Date(selectedJob.appointment_time) : new Date()
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(
    selectedJob?.appointment_time && new Date(selectedJob.appointment_time).getHours() < 12 ? 'morning' : 'afternoon'
  );
  
  // Customer editing state
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerName, setCustomerName] = useState(selectedJob?.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(selectedJob?.phone || '');
  const [customerAddress, setCustomerAddress] = useState(selectedJob?.address || '');

  // Calendar days for the reschedule modal
  const calendarDays = eachDayOfInterval({
    start: startOfMonth(calendarViewMonth),
    end: endOfMonth(calendarViewMonth),
  });
  const startDayOfWeek = startOfMonth(calendarViewMonth).getDay();

  useEffect(() => {
    if (job) {
      fetchComments();
      fetchUsers();
      if (job.appointment_time) {
        checkFirstStopCount(job.appointment_time);
      }
    }
  }, [job]);

  const checkFirstStopCount = async (dateStr: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/jobs/first-stop-count?date=${dateStr}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFirstStopCount(data.count);
      }
    } catch (error) {
      console.error('Error checking first stop count:', error);
    }
  };

  if (!job) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text>Job not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/users`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
        // Combine default technicians with database users
        setAllTechnicians([...DEFAULT_TECHNICIANS, ...data]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/jobs/${job.job_id}/comments`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const updateJobStatus = async (newStatus: string) => {
    setJob({ ...job, status: newStatus });
    setHasChanges(true);
  };

  const updateJobAssignment = async (techId: string, techName: string) => {
    setJob({ 
      ...job, 
      assigned_to: techId,
      assigned_to_name: techName || null 
    });
    setHasChanges(true);
    setShowTechModal(false);
  };

  const updatePartNumber = (newPartNumber: string) => {
    setPartNumber(newPartNumber);
    setJob({ ...job, part_number: newPartNumber });
    setHasChanges(true);
  };

  const updatePayment = (type: string, amount?: string) => {
    setPaymentType(type);
    if (amount !== undefined) {
      setAmountToCollect(amount);
    }
    setJob({ 
      ...job, 
      payment_type: type,
      amount_to_collect: type === 'collect' && amount ? parseFloat(amount) : null
    });
    setHasChanges(true);
  };

  const updateJobAppointment = (date: Date) => {
    setJob({ ...job, appointment_time: date.toISOString() });
    setHasChanges(true);
  };

  const toggleFirstStop = async () => {
    // If trying to enable, check limit
    if (!isFirstStop) {
      // Check if we're at max (3) and this job isn't already counted
      if (firstStopCount >= 3) {
        Alert.alert('Limit Reached', 'Maximum 3 first stops already scheduled for this day. Remove a first stop from another job first.');
        return;
      }
    }
    setIsFirstStop(!isFirstStop);
    setHasChanges(true);
  };

  const saveChanges = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/jobs/${job.job_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ 
          status: job.status,
          assigned_to: job.assigned_to,
          assigned_to_name: job.assigned_to_name,
          appointment_time: job.appointment_time,
          part_number: partNumber || null,
          omega_invoice: omegaInvoice || null,
          payment_type: paymentType || null,
          amount_to_collect: paymentType === 'collect' && amountToCollect ? parseFloat(amountToCollect) : null,
          is_first_stop: isFirstStop,
          customer_name: customerName,
          phone: customerPhone,
          address: customerAddress,
        }),
      });

      if (response.ok) {
        const updatedJob = await response.json();
        setJob(updatedJob);
        updateJob(job.job_id, updatedJob);
        setHasChanges(false);
        setEditingPartNumber(false);
        setEditingCustomer(false);
        Alert.alert('Success', 'Job updated successfully');
      }
    } catch (error) {
      console.error('Error updating job:', error);
      Alert.alert('Error', 'Failed to update job');
    } finally {
      setLoading(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/jobs/${job.job_id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ comment: newComment }),
      });

      if (response.ok) {
        const comment = await response.json();
        setComments([...comments, comment]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll permission is required');
      return;
    }

    const result = await ImagePicker.launchImagePickerAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      uploadPhoto(result.assets[0].base64);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      uploadPhoto(result.assets[0].base64);
    }
  };

  const uploadPhoto = async (base64: string) => {
    try {
      setUploading(true);
      const photos = [...(job.photos || []), `data:image/jpeg;base64,${base64}`];

      const response = await fetch(`${BACKEND_URL}/api/jobs/${job.job_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ photos }),
      });

      if (response.ok) {
        const updatedJob = await response.json();
        setJob(updatedJob);
        Alert.alert('Success', 'Photo uploaded');
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const openNavigation = () => {
    const scheme = Platform.select({
      ios: 'maps:',
      android: 'geo:',
    });
    const url = Platform.select({
      ios: `${scheme}?q=${job.lat},${job.lng}`,
      android: `${scheme}${job.lat},${job.lng}`,
    });

    if (url) {
      Linking.openURL(url);
    }
  };

  const callCustomer = () => {
    Linking.openURL(`tel:${job.phone}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={{ width: 40 }} />
      </View>

      {hasChanges && (
        <View style={styles.saveBar}>
          <Text style={styles.saveBarText}>You have unsaved changes</Text>
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={saveChanges}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.jobId}>#{job.job_id.slice(-8)}</Text>
              <Text style={styles.customerName}>{job.customer_name}</Text>
            </View>
            <View
              style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[job.status] }]}
            >
              <Text style={styles.statusText}>{STATUS_LABELS[job.status]}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailSection}>
            <View style={styles.detailRow}>
              <Ionicons name="call" size={20} color="#2196F3" />
              <TouchableOpacity onPress={callCustomer} style={styles.detailTextContainer}>
                <Text style={styles.detailText}>{job.phone}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="location" size={20} color="#2196F3" />
              <TouchableOpacity onPress={openNavigation} style={styles.detailTextContainer}>
                <Text style={styles.detailText}>{job.address}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="car" size={20} color="#2196F3" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailText}>
                  {job.vehicle_year} {job.vehicle_make} {job.vehicle_model}
                </Text>
              </View>
            </View>

            {job.vin_or_lp && (
              <View style={styles.detailRow}>
                <Ionicons name="barcode" size={20} color="#2196F3" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailText}>{job.vin_or_lp}</Text>
                </View>
              </View>
            )}

            {/* Technician Assignment - Always show */}
            <View style={styles.detailRow}>
              <Ionicons name="person" size={20} color="#2196F3" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Technician</Text>
                <Text style={styles.detailTextBold}>
                  {job.assigned_to_name || 'Not Assigned'}
                </Text>
              </View>
            </View>

            {/* Appointment Time Window - Always show */}
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={20} color="#2196F3" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Appointment</Text>
                {job.appointment_time ? (
                  <View>
                    <Text style={styles.detailTextBold}>
                      {format(parseISO(job.appointment_time), 'EEEE, MMM dd, yyyy')}
                    </Text>
                    <Text style={styles.timeWindowText}>
                      {new Date(job.appointment_time).getHours() < 12 
                        ? '9-12 AM' 
                        : '1-4 PM'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.detailText}>Not Scheduled</Text>
                )}
              </View>
            </View>

            {job.notes && (
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>Notes:</Text>
                <Text style={styles.notesText}>{job.notes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Scheduling Card - Reschedule and 1st Stop */}
        <View style={styles.schedulingCard}>
          <View style={styles.schedulingHeader}>
            <Ionicons name="calendar-outline" size={24} color="#2196F3" />
            <Text style={styles.schedulingTitle}>Scheduling</Text>
          </View>

          {/* Reschedule Button */}
          <TouchableOpacity 
            style={styles.rescheduleButton}
            onPress={() => setShowRescheduleCalendar(true)}
          >
            <Ionicons name="calendar" size={20} color="#2196F3" />
            <View style={styles.rescheduleInfo}>
              <Text style={styles.rescheduleLabel}>Appointment Date</Text>
              <Text style={styles.rescheduleDate}>
                {job.appointment_time 
                  ? format(parseISO(job.appointment_time), 'EEE, MMM dd, yyyy')
                  : 'Not scheduled'}
              </Text>
            </View>
            <Text style={styles.rescheduleAction}>Change</Text>
          </TouchableOpacity>

          {/* Time Slot Selection */}
          <View style={styles.timeSlotSection}>
            <Text style={styles.timeSlotLabel}>Time Window</Text>
            <View style={styles.timeSlotButtons}>
              <TouchableOpacity
                style={[
                  styles.timeSlotBtn,
                  selectedTimeSlot === 'morning' && styles.timeSlotBtnActive
                ]}
                onPress={() => {
                  setSelectedTimeSlot('morning');
                  if (job.appointment_time) {
                    const date = new Date(job.appointment_time);
                    date.setHours(9, 0, 0, 0);
                    setJob({ ...job, appointment_time: date.toISOString() });
                    setHasChanges(true);
                  }
                }}
              >
                <Text style={[
                  styles.timeSlotBtnText,
                  selectedTimeSlot === 'morning' && styles.timeSlotBtnTextActive
                ]}>9-12 AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.timeSlotBtn,
                  selectedTimeSlot === 'afternoon' && styles.timeSlotBtnActive
                ]}
                onPress={() => {
                  setSelectedTimeSlot('afternoon');
                  if (job.appointment_time) {
                    const date = new Date(job.appointment_time);
                    date.setHours(13, 0, 0, 0);
                    setJob({ ...job, appointment_time: date.toISOString() });
                    setHasChanges(true);
                  }
                }}
              >
                <Text style={[
                  styles.timeSlotBtnText,
                  selectedTimeSlot === 'afternoon' && styles.timeSlotBtnTextActive
                ]}>1-4 PM</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 1st Stop Toggle */}
          <TouchableOpacity 
            style={[
              styles.firstStopToggle,
              isFirstStop && styles.firstStopToggleActive
            ]}
            onPress={toggleFirstStop}
          >
            <View style={styles.firstStopLeft}>
              <Ionicons 
                name={isFirstStop ? "flag" : "flag-outline"} 
                size={24} 
                color={isFirstStop ? "#fff" : "#E53935"} 
              />
              <View>
                <Text style={[
                  styles.firstStopTitle,
                  isFirstStop && styles.firstStopTitleActive
                ]}>1ST STOP</Text>
                <Text style={[
                  styles.firstStopSubtitle,
                  isFirstStop && styles.firstStopSubtitleActive
                ]}>
                  {isFirstStop ? 'This is a first stop job' : 'Mark as first stop of the day'}
                </Text>
              </View>
            </View>
            <View style={[
              styles.firstStopCheckbox,
              isFirstStop && styles.firstStopCheckboxActive
            ]}>
              {isFirstStop && <Ionicons name="checkmark" size={18} color="#fff" />}
            </View>
          </TouchableOpacity>
          
          <Text style={styles.firstStopCounter}>
            {firstStopCount}/3 first stops scheduled for this day
          </Text>
        </View>

        {/* Reschedule Date Picker Modal */}
        {showRescheduleCalendar && (
          <Modal
            visible={showRescheduleCalendar}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowRescheduleCalendar(false)}
          >
            <View style={styles.rescheduleModalOverlay}>
              <View style={styles.rescheduleModalContent}>
                <View style={styles.rescheduleModalHeader}>
                  <Text style={styles.rescheduleModalTitle}>Reschedule Job</Text>
                  <TouchableOpacity onPress={() => setShowRescheduleCalendar(false)}>
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

                {/* Quick Jump */}
                <View style={styles.quickJumpRow}>
                  <TouchableOpacity 
                    style={styles.quickJumpBtn}
                    onPress={() => {
                      const today = new Date();
                      const hour = selectedTimeSlot === 'morning' ? 9 : 13;
                      today.setHours(hour, 0, 0, 0);
                      setJob({ ...job, appointment_time: today.toISOString() });
                      setHasChanges(true);
                      checkFirstStopCount(today.toISOString());
                      setShowRescheduleCalendar(false);
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
                  {calendarDays.map((day) => {
                    const isSelected = job.appointment_time && isSameDay(day, new Date(job.appointment_time));
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <TouchableOpacity
                        key={day.toISOString()}
                        style={[
                          styles.calendarDayCell,
                          isSelected && styles.calendarDaySelected,
                          isToday && !isSelected && styles.calendarDayToday,
                        ]}
                        onPress={() => {
                          const newDate = new Date(day);
                          const hour = selectedTimeSlot === 'morning' ? 9 : 13;
                          newDate.setHours(hour, 0, 0, 0);
                          setJob({ ...job, appointment_time: newDate.toISOString() });
                          setHasChanges(true);
                          checkFirstStopCount(newDate.toISOString());
                          setShowRescheduleCalendar(false);
                        }}
                      >
                        <Text style={[
                          styles.calendarDayText,
                          isSelected && styles.calendarDayTextSelected,
                          isToday && !isSelected && styles.calendarDayTextToday,
                        ]}>
                          {format(day, 'd')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </Modal>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Update Status</Text>
          <View style={styles.statusButtons}>
            {Object.keys(STATUS_COLORS).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusButton,
                  { borderColor: STATUS_COLORS[status] },
                  job.status === status && { backgroundColor: STATUS_COLORS[status] },
                ]}
                onPress={() => updateJobStatus(status)}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    { color: STATUS_COLORS[status] },
                    job.status === status && { color: '#fff' },
                  ]}
                >
                  {STATUS_LABELS[status]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Technician & Part Number Card - Combined for prominence */}
        <View style={styles.techPartCard}>
          <View style={styles.techPartHeader}>
            <Text style={styles.techPartTitle}>Assigned Tech & Part</Text>
          </View>
          
          {/* Technician Section */}
          <TouchableOpacity
            style={styles.techSelector}
            onPress={() => setShowTechModal(true)}
          >
            <View style={styles.techRow}>
              <Ionicons name="person-circle" size={40} color="#2196F3" />
              <View style={styles.techInfo}>
                <Text style={styles.techLabel}>Technician</Text>
                <Text style={styles.techName}>
                  {job.assigned_to_name || 'Tap to assign'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </View>
          </TouchableOpacity>

          {/* Part Number Section */}
          <View style={styles.partNumberSection}>
            <View style={styles.partNumberHeader}>
              <Ionicons name="construct" size={24} color="#FF9800" />
              <Text style={styles.partNumberLabel}>Part Number</Text>
            </View>
            {editingPartNumber ? (
              <View style={styles.partNumberEditRow}>
                <TextInput
                  style={styles.partNumberInput}
                  value={partNumber}
                  onChangeText={(text) => {
                    setPartNumber(text);
                    setJob({ ...job, part_number: text });
                    setHasChanges(true);
                  }}
                  placeholder="Enter part number"
                  placeholderTextColor="#999"
                  autoFocus
                />
                <TouchableOpacity 
                  style={styles.partNumberDoneBtn}
                  onPress={() => setEditingPartNumber(false)}
                >
                  <Ionicons name="checkmark" size={24} color="#4CAF50" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.partNumberDisplay}
                onPress={() => setEditingPartNumber(true)}
              >
                <Text style={[
                  styles.partNumberValue,
                  !partNumber && styles.partNumberPlaceholder
                ]}>
                  {partNumber || 'Tap to add part number'}
                </Text>
                <Ionicons name="pencil" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Payment Collection Card */}
        <View style={styles.paymentCard}>
          <View style={styles.paymentHeader}>
            <Ionicons name="cash" size={24} color="#4CAF50" />
            <Text style={styles.paymentTitle}>Payment Collection</Text>
          </View>
          
          <View style={styles.paymentOptions}>
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentType === 'collect' && styles.paymentOptionActive
              ]}
              onPress={() => updatePayment('collect', amountToCollect)}
            >
              <Ionicons 
                name="cash" 
                size={20} 
                color={paymentType === 'collect' ? '#fff' : '#4CAF50'} 
              />
              <Text style={[
                styles.paymentOptionText,
                paymentType === 'collect' && styles.paymentOptionTextActive
              ]}>Collect Amount</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentType === 'dealership_po' && styles.paymentOptionPOActive
              ]}
              onPress={() => updatePayment('dealership_po', '')}
            >
              <Ionicons 
                name="business" 
                size={20} 
                color={paymentType === 'dealership_po' ? '#fff' : '#9C27B0'} 
              />
              <Text style={[
                styles.paymentOptionText,
                paymentType === 'dealership_po' && styles.paymentOptionTextActive
              ]}>Dealership PO</Text>
            </TouchableOpacity>
          </View>

          {paymentType === 'collect' && (
            <View style={styles.amountContainer}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amountToCollect}
                onChangeText={(text) => updatePayment('collect', text)}
                placeholder="0.00"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            </View>
          )}

          {paymentType === 'dealership_po' && (
            <View style={styles.poDisplay}>
              <Ionicons name="business" size={32} color="#9C27B0" />
              <Text style={styles.poText}>Dealership Purchase Order</Text>
              <Text style={styles.poSubtext}>No collection required</Text>
            </View>
          )}
        </View>

        {/* Omega Invoice Card - Only in job details, not on main page */}
        <View style={styles.omegaCard}>
          <View style={styles.omegaHeader}>
            <Ionicons name="document-text" size={24} color="#607D8B" />
            <Text style={styles.omegaTitle}>Omega Invoice #</Text>
          </View>
          
          {editingOmega ? (
            <View style={styles.omegaEditRow}>
              <TextInput
                style={styles.omegaInput}
                value={omegaInvoice}
                onChangeText={(text) => {
                  setOmegaInvoice(text);
                  setHasChanges(true);
                }}
                placeholder="Enter invoice number"
                placeholderTextColor="#999"
                autoFocus
              />
              <TouchableOpacity 
                style={styles.omegaDoneBtn}
                onPress={() => setEditingOmega(false)}
              >
                <Ionicons name="checkmark" size={24} color="#4CAF50" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.omegaDisplay}
              onPress={() => setEditingOmega(true)}
            >
              <Text style={[
                styles.omegaValue,
                !omegaInvoice && styles.omegaPlaceholder
              ]}>
                {omegaInvoice || 'Tap to add invoice number'}
              </Text>
              <Ionicons name="pencil" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Technician Selection Modal */}
        <Modal
          visible={showTechModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowTechModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.techModalContent}>
              <View style={styles.techModalHeader}>
                <Text style={styles.techModalTitle}>Select Technician</Text>
                <TouchableOpacity onPress={() => setShowTechModal(false)}>
                  <Ionicons name="close" size={28} color="#333" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.techList}>
                {/* Unassigned Option */}
                <TouchableOpacity
                  style={[
                    styles.techOption,
                    !job.assigned_to && styles.techOptionSelected
                  ]}
                  onPress={() => updateJobAssignment('', '')}
                >
                  <Ionicons name="person-outline" size={32} color="#999" />
                  <Text style={styles.techOptionName}>Unassigned</Text>
                  {!job.assigned_to && (
                    <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                  )}
                </TouchableOpacity>

                {/* All Technicians */}
                {allTechnicians.map((tech) => (
                  <TouchableOpacity
                    key={tech.user_id}
                    style={[
                      styles.techOption,
                      job.assigned_to === tech.user_id && styles.techOptionSelected
                    ]}
                    onPress={() => updateJobAssignment(tech.user_id, tech.name)}
                  >
                    <Ionicons name="person-circle" size={32} color="#2196F3" />
                    <Text style={styles.techOptionName}>{tech.name}</Text>
                    {job.assigned_to === tech.user_id && (
                      <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Appointment Time</Text>
          <TouchableOpacity
            style={styles.appointmentSelector}
            onPress={() => {
              setTempAppointmentTime(
                job.appointment_time ? new Date(job.appointment_time) : new Date()
              );
              setShowDatePicker(true);
            }}
          >
            <View style={styles.appointmentContent}>
              <Ionicons name="calendar" size={20} color="#2196F3" />
              <Text style={styles.appointmentText}>
                {job.appointment_time
                  ? format(parseISO(job.appointment_time), 'MMM dd, yyyy h:mm a')
                  : 'No appointment scheduled'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#999" />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={tempAppointmentTime || new Date()}
              mode="datetime"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  updateJobAppointment(selectedDate);
                }
              }}
            />
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Photos</Text>
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.photoActionButton}
                onPress={takePhoto}
                disabled={uploading}
              >
                <Ionicons name="camera" size={20} color="#2196F3" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoActionButton}
                onPress={pickImage}
                disabled={uploading}
              >
                <Ionicons name="images" size={20} color="#2196F3" />
              </TouchableOpacity>
            </View>
          </View>

          {uploading && (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color="#2196F3" />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          )}

          {job.photos && job.photos.length > 0 ? (
            <View style={styles.photoGrid}>
              {job.photos.map((photo, index) => (
                <Image key={index} source={{ uri: photo }} style={styles.photo} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyPhotos}>
              <Ionicons name="images-outline" size={48} color="#ccc" />
              <Text style={styles.emptyPhotosText}>No photos yet</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Comments</Text>

          <View style={styles.commentInput}>
            <TextInput
              style={styles.input}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Add a comment..."
              placeholderTextColor="#999"
              multiline
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={addComment}
              disabled={!newComment.trim()}
            >
              <Ionicons
                name="send"
                size={20}
                color={newComment.trim() ? '#2196F3' : '#ccc'}
              />
            </TouchableOpacity>
          </View>

          {comments.length > 0 ? (
            <View style={styles.commentsList}>
              {comments.map((comment) => (
                <View key={comment.comment_id} style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>{comment.user_name}</Text>
                    <Text style={styles.commentTime}>
                      {format(parseISO(comment.created_at), 'MMM dd, h:mm a')}
                    </Text>
                  </View>
                  <Text style={styles.commentText}>{comment.comment}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyComments}>
              <Text style={styles.emptyCommentsText}>No comments yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFB74D',
  },
  saveBarText: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginTop: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  jobId: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginBottom: 16,
  },
  detailSection: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  detailText: {
    fontSize: 16,
    color: '#333',
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  detailTextBold: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  timeWindowText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
    marginTop: 2,
  },
  notesSection: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  assignmentSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  assignmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  assignmentText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  appointmentSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  appointmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appointmentText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
  },
  photoActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  uploadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  emptyPhotos: {
    alignItems: 'center',
    padding: 32,
  },
  emptyPhotosText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  commentsList: {
    gap: 12,
  },
  commentItem: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  emptyComments: {
    alignItems: 'center',
    padding: 24,
  },
  emptyCommentsText: {
    fontSize: 14,
    color: '#999',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 16,
    color: '#2196F3',
    marginTop: 16,
  },
  // Tech & Part Number Card Styles
  techPartCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  techPartHeader: {
    marginBottom: 16,
  },
  techPartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  techSelector: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  techInfo: {
    flex: 1,
    marginLeft: 12,
  },
  techLabel: {
    fontSize: 12,
    color: '#666',
  },
  techName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2196F3',
  },
  partNumberSection: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 12,
  },
  partNumberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  partNumberLabel: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  partNumberEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partNumberInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 24,
    fontWeight: '700',
    color: '#FF9800',
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  partNumberDoneBtn: {
    marginLeft: 12,
    padding: 8,
  },
  partNumberDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partNumberValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF9800',
  },
  partNumberPlaceholder: {
    fontSize: 16,
    fontWeight: '400',
    color: '#999',
  },
  // Tech Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  techModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
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
  techList: {
    padding: 16,
  },
  techOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  techOptionSelected: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  techOptionName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginLeft: 12,
  },
  // Payment Card Styles
  paymentCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginLeft: 10,
  },
  paymentOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
    gap: 8,
  },
  paymentOptionActive: {
    backgroundColor: '#4CAF50',
  },
  paymentOptionPOActive: {
    backgroundColor: '#9C27B0',
    borderColor: '#9C27B0',
  },
  paymentOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  paymentOptionTextActive: {
    color: '#fff',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
    paddingHorizontal: 16,
  },
  dollarSign: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4CAF50',
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  poDisplay: {
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    borderRadius: 8,
    padding: 16,
  },
  poText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9C27B0',
    marginTop: 8,
  },
  poSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  // Omega Invoice Card Styles
  omegaCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#607D8B',
  },
  omegaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  omegaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginLeft: 10,
  },
  omegaEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  omegaInput: {
    flex: 1,
    backgroundColor: '#ECEFF1',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#607D8B',
    borderWidth: 2,
    borderColor: '#607D8B',
  },
  omegaDoneBtn: {
    marginLeft: 12,
    padding: 8,
  },
  omegaDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECEFF1',
    borderRadius: 8,
    padding: 12,
  },
  omegaValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#607D8B',
  },
  omegaPlaceholder: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999',
  },
  // Scheduling Card Styles
  schedulingCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  schedulingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  schedulingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginLeft: 10,
  },
  rescheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  rescheduleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  rescheduleLabel: {
    fontSize: 12,
    color: '#666',
  },
  rescheduleDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  rescheduleAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  timeSlotSection: {
    marginBottom: 16,
  },
  timeSlotLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  timeSlotButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  timeSlotBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  timeSlotBtnActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  timeSlotBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  timeSlotBtnTextActive: {
    color: '#fff',
  },
  firstStopToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFEBEE',
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E53935',
  },
  firstStopToggleActive: {
    backgroundColor: '#E53935',
  },
  firstStopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  firstStopTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E53935',
  },
  firstStopTitleActive: {
    color: '#fff',
  },
  firstStopSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  firstStopSubtitleActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  firstStopCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  firstStopCheckboxActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  firstStopCounter: {
    fontSize: 12,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  rescheduleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  rescheduleModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 380,
    padding: 16,
  },
  rescheduleModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 16,
  },
  rescheduleModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  // Calendar styles for reschedule modal
  calendarMonthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
});