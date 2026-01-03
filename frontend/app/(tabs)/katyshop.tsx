import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Switch,
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Time slots for the block schedule (7 AM to 6 PM) - HOURLY
const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

// Height per hour slot (in pixels)
const HOUR_HEIGHT = 70;

const STATUS_COLORS: { [key: string]: string } = {
  scheduled: '#FF9800',
  in_progress: '#9C27B0',
  completed: '#4CAF50',
};

const STATUS_LABELS: { [key: string]: string } = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
};

interface ServiceAdvisor {
  advisor_id: string;
  name: string;
}

interface KatyshopJob {
  job_id: string;
  vehicle_year: string;
  vehicle_model: string;
  vehicle_make?: string;
  part_number: string;
  needs_calibration: boolean;
  customer_type: string;
  service_advisor_id: string;
  service_advisor_name: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  assigned_to: string;
  assigned_to_name: string;
  created_by: string;
  created_by_name?: string;
  notes?: string;
}

export default function KatyshopScreen() {
  const { sessionToken, user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [jobs, setJobs] = useState<KatyshopJob[]>([]);
  const [advisors, setAdvisors] = useState<ServiceAdvisor[]>([]);
  
  // Modal states
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  const [showJobDetailModal, setShowJobDetailModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showFormDatePicker, setShowFormDatePicker] = useState(false);
  const [selectedJob, setSelectedJob] = useState<KatyshopJob | null>(null);
  const [newAdvisorName, setNewAdvisorName] = useState('');
  const [calendarViewMonth, setCalendarViewMonth] = useState(new Date());
  
  // Job form state
  const [formYear, setFormYear] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formMake, setFormMake] = useState('');
  const [formPartNumber, setFormPartNumber] = useState('');
  const [formCalibration, setFormCalibration] = useState(false);
  const [formCustomerType, setFormCustomerType] = useState('waiter');
  const [formAdvisorId, setFormAdvisorId] = useState('');
  const [formAdvisorName, setFormAdvisorName] = useState('');
  const [formDate, setFormDate] = useState(new Date());
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formNotes, setFormNotes] = useState('');
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Swipe gesture for day navigation
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 20;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50) {
          // Swipe right - go to previous day
          changeDate(-1);
        } else if (gestureState.dx < -50) {
          // Swipe left - go to next day
          changeDate(1);
        }
      },
    })
  ).current;

  const fetchJobs = useCallback(async () => {
    try {
      const dateStr = formatDateForApi(selectedDate);
      const response = await fetch(`${BACKEND_URL}/api/katyshop/jobs?date=${dateStr}`, {
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
    }
  }, [selectedDate, sessionToken]);

  const fetchAdvisors = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/service-advisors`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setAdvisors(data);
      }
    } catch (error) {
      console.error('Error fetching advisors:', error);
    }
  }, [sessionToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchJobs(), fetchAdvisors()]);
    setLoading(false);
  }, [fetchJobs, fetchAdvisors]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const formatDateForApi = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const resetForm = () => {
    setFormYear('');
    setFormModel('');
    setFormMake('');
    setFormPartNumber('');
    setFormCalibration(false);
    setFormCustomerType('waiter');
    setFormAdvisorId('');
    setFormAdvisorName('');
    setFormDate(selectedDate);
    setFormStartTime('09:00');
    setFormEndTime('10:00');
    setFormNotes('');
  };

  // Calendar helper functions
  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days = [];
    // Add empty slots for days before the 1st
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const isSameDay = (date1: Date | null, date2: Date) => {
    if (!date1) return false;
    return date1.toDateString() === date2.toDateString();
  };

  const selectCalendarDate = (date: Date) => {
    setSelectedDate(date);
    setShowCalendarModal(false);
  };

  const selectFormDate = (date: Date) => {
    setFormDate(date);
    setShowFormDatePicker(false);
  };

  const changeCalendarMonth = (direction: number) => {
    const newMonth = new Date(calendarViewMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCalendarViewMonth(newMonth);
  };

  const addAdvisor = async () => {
    if (!newAdvisorName.trim()) {
      Alert.alert('Error', 'Please enter advisor name');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/service-advisors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ name: newAdvisorName.trim() }),
      });

      if (response.ok) {
        setNewAdvisorName('');
        await fetchAdvisors();
        Alert.alert('Success', 'Service advisor added');
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to add advisor');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add advisor');
    }
  };

  const deleteAdvisor = async (advisorId: string, name: string) => {
    Alert.alert(
      'Delete Advisor',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${BACKEND_URL}/api/service-advisors/${advisorId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${sessionToken}` },
              });
              await fetchAdvisors();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete advisor');
            }
          },
        },
      ]
    );
  };

  const createJob = async () => {
    if (!formYear || !formModel || !formPartNumber || !formAdvisorId) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/katyshop/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          vehicle_year: formYear,
          vehicle_model: formModel,
          vehicle_make: formMake || null,
          part_number: formPartNumber,
          needs_calibration: formCalibration,
          customer_type: formCustomerType,
          service_advisor_id: formAdvisorId,
          service_advisor_name: formAdvisorName,
          date: formatDateForApi(formDate),
          start_time: formStartTime,
          end_time: formEndTime,
          notes: formNotes || null,
        }),
      });

      if (response.ok) {
        setShowAddJobModal(false);
        resetForm();
        await fetchJobs();
        Alert.alert('Success', 'Job created - Sina has been notified');
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to create job');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create job');
    }
  };

  const updateJobStatus = async (jobId: string, newStatus: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/katyshop/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchJobs();
        setShowJobDetailModal(false);
        if (newStatus === 'completed') {
          Alert.alert('Job Completed', 'Creator has been notified');
        }
      } else {
        Alert.alert('Error', 'Failed to update status');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const deleteJob = async (jobId: string) => {
    Alert.alert(
      'Delete Job',
      'Are you sure you want to delete this job?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${BACKEND_URL}/api/katyshop/jobs/${jobId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${sessionToken}` },
              });
              setShowJobDetailModal(false);
              await fetchJobs();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete job');
            }
          },
        },
      ]
    );
  };

  const selectAdvisor = (advisor: ServiceAdvisor) => {
    setFormAdvisorId(advisor.advisor_id);
    setFormAdvisorName(advisor.name);
  };

  const getJobsForTimeSlot = (time: string) => {
    return jobs.filter(job => {
      const jobStart = job.start_time;
      const jobEnd = job.end_time;
      return time >= jobStart && time < jobEnd;
    });
  };

  // Calculate job position and height based on time
  const getJobPosition = (startTime: string, endTime: string) => {
    const startHour = parseInt(startTime.split(':')[0]);
    const startMin = parseInt(startTime.split(':')[1]);
    const endHour = parseInt(endTime.split(':')[0]);
    const endMin = parseInt(endTime.split(':')[1]);
    
    const firstSlotHour = 7; // 7 AM
    const topOffset = ((startHour - firstSlotHour) + (startMin / 60)) * HOUR_HEIGHT;
    const duration = (endHour - startHour) + ((endMin - startMin) / 60);
    const height = Math.max(duration * HOUR_HEIGHT - 4, 40);
    
    return { topOffset, height };
  };

  // Find jobs that start at or span this hour
  const getJobsStartingAtHour = (hourTime: string) => {
    const hour = parseInt(hourTime.split(':')[0]);
    return jobs.filter(job => {
      const jobStartHour = parseInt(job.start_time.split(':')[0]);
      return jobStartHour === hour;
    });
  };

  const renderTimeBlock = (time: string, index: number) => {
    const startingJobs = getJobsStartingAtHour(time);

    return (
      <View key={time} style={styles.timeRow}>
        <View style={styles.timeLabel}>
          <Text style={styles.timeLabelText}>{formatTime(time)}</Text>
        </View>
        <View style={styles.timeSlotContainer}>
          {startingJobs.length > 0 ? (
            startingJobs.map((job) => {
              const { height } = getJobPosition(job.start_time, job.end_time);

              return (
                <TouchableOpacity
                  key={job.job_id}
                  style={[
                    styles.jobBlock,
                    { 
                      height,
                      backgroundColor: STATUS_COLORS[job.status] + '25',
                      borderLeftColor: STATUS_COLORS[job.status],
                    }
                  ]}
                  onPress={() => {
                    setSelectedJob(job);
                    setShowJobDetailModal(true);
                  }}
                >
                  {/* Row 1: Year Make Model */}
                  <Text style={styles.jobBlockVehicle} numberOfLines={1}>
                    {job.vehicle_year} {job.vehicle_make || ''} {job.vehicle_model}
                  </Text>
                  {/* Row 2: Part # (RED) | ADV: Name | Calibration */}
                  <View style={styles.jobBlockRow}>
                    <Text style={styles.jobBlockPart}>{job.part_number}</Text>
                    <Text style={styles.jobBlockAdvisor}>ADV: {job.service_advisor_name}</Text>
                    {job.needs_calibration && (
                      <Text style={styles.jobBlockCalibration}>Calibration</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptySlot} />
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏪 Katyshop</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowAdvisorModal(true)}
          >
            <Ionicons name="people" size={22} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddJobModal(true)}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Selector */}
      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
          <Ionicons name="chevron-back" size={28} color="#2196F3" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => {
            setCalendarViewMonth(selectedDate);
            setShowCalendarModal(true);
          }} 
          style={styles.dateDisplay}
        >
          <Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
          {isToday(selectedDate) && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>Today</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateArrow}>
          <Ionicons name="chevron-forward" size={28} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {/* Tech Info Banner */}
      <View style={styles.techBanner}>
        <Ionicons name="person" size={18} color="#1976D2" />
        <Text style={styles.techBannerText}>Dedicated Tech: <Text style={styles.techName}>Sina</Text></Text>
        <Text style={styles.jobCount}>{jobs.length} jobs</Text>
      </View>

      {/* Block Schedule with Swipe Gesture */}
      <View style={styles.scheduleWrapper} {...panResponder.panHandlers}>
        <ScrollView
          style={styles.scheduleContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {TIME_SLOTS.map((time, index) => renderTimeBlock(time, index))}
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>

      {/* Add Job Modal */}
      <Modal
        visible={showAddJobModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddJobModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Katyshop Job</Text>
              <TouchableOpacity onPress={() => setShowAddJobModal(false)}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {/* Vehicle Info */}
              <Text style={styles.formSectionTitle}>Vehicle Info</Text>
              <View style={styles.formRow}>
                <View style={styles.formFieldHalf}>
                  <Text style={styles.formLabel}>Year *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formYear}
                    onChangeText={setFormYear}
                    placeholder="2024"
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>
                <View style={styles.formFieldHalf}>
                  <Text style={styles.formLabel}>Model *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formModel}
                    onChangeText={setFormModel}
                    placeholder="Camry"
                  />
                </View>
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Make (optional)</Text>
                <TextInput
                  style={styles.formInput}
                  value={formMake}
                  onChangeText={setFormMake}
                  placeholder="Toyota"
                />
              </View>

              {/* Part Number */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Part Number *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formPartNumber}
                  onChangeText={setFormPartNumber}
                  placeholder="FW-2847"
                />
              </View>

              {/* Calibration */}
              <View style={styles.switchRow}>
                <Text style={styles.formLabel}>Needs Calibration?</Text>
                <Switch
                  value={formCalibration}
                  onValueChange={setFormCalibration}
                  trackColor={{ false: '#e0e0e0', true: '#90CAF9' }}
                  thumbColor={formCalibration ? '#2196F3' : '#f4f3f4'}
                />
              </View>

              {/* Customer Type */}
              <Text style={styles.formSectionTitle}>Customer Type</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeOption, formCustomerType === 'waiter' && styles.typeOptionActive]}
                  onPress={() => setFormCustomerType('waiter')}
                >
                  <Ionicons name="time" size={20} color={formCustomerType === 'waiter' ? '#fff' : '#666'} />
                  <Text style={[styles.typeOptionText, formCustomerType === 'waiter' && styles.typeOptionTextActive]}>
                    Waiter
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeOption, formCustomerType === 'drop_off' && styles.typeOptionActive]}
                  onPress={() => setFormCustomerType('drop_off')}
                >
                  <Ionicons name="car" size={20} color={formCustomerType === 'drop_off' ? '#fff' : '#666'} />
                  <Text style={[styles.typeOptionText, formCustomerType === 'drop_off' && styles.typeOptionTextActive]}>
                    Drop Off
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Service Advisor */}
              <Text style={styles.formSectionTitle}>Service Advisor *</Text>
              {advisors.length === 0 ? (
                <TouchableOpacity 
                  style={styles.noAdvisorsBtn}
                  onPress={() => {
                    setShowAddJobModal(false);
                    setShowAdvisorModal(true);
                  }}
                >
                  <Ionicons name="add-circle" size={20} color="#2196F3" />
                  <Text style={styles.noAdvisorsBtnText}>Add Service Advisors First</Text>
                </TouchableOpacity>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.advisorScroll}>
                  {advisors.map((advisor) => (
                    <TouchableOpacity
                      key={advisor.advisor_id}
                      style={[
                        styles.advisorChip,
                        formAdvisorId === advisor.advisor_id && styles.advisorChipActive
                      ]}
                      onPress={() => selectAdvisor(advisor)}
                    >
                      <Text style={[
                        styles.advisorChipText,
                        formAdvisorId === advisor.advisor_id && styles.advisorChipTextActive
                      ]}>
                        {advisor.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Date Selection */}
              <Text style={styles.formSectionTitle}>Date</Text>
              <TouchableOpacity 
                style={styles.datePickerBtn}
                onPress={() => setShowFormDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color="#2196F3" />
                <Text style={styles.datePickerBtnText}>
                  {formDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#666" />
              </TouchableOpacity>

              {/* Time Block */}
              <Text style={styles.formSectionTitle}>Time Block</Text>
              <View style={styles.formRow}>
                <View style={styles.formFieldHalf}>
                  <Text style={styles.formLabel}>Start Time</Text>
                  <TouchableOpacity 
                    style={styles.timePickerBtn}
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <Text style={styles.timePickerText}>{formatTime(formStartTime)}</Text>
                    <Ionicons name="chevron-down" size={18} color="#666" />
                  </TouchableOpacity>
                </View>
                <View style={styles.formFieldHalf}>
                  <Text style={styles.formLabel}>End Time</Text>
                  <TouchableOpacity 
                    style={styles.timePickerBtn}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <Text style={styles.timePickerText}>{formatTime(formEndTime)}</Text>
                    <Ionicons name="chevron-down" size={18} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Notes */}
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputMultiline]}
                  value={formNotes}
                  onChangeText={setFormNotes}
                  placeholder="Additional notes..."
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity style={styles.submitBtn} onPress={createJob}>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.submitBtnText}>Create Job</Text>
              </TouchableOpacity>

              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal (Start) */}
      <Modal
        visible={showStartTimePicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowStartTimePicker(false)}
      >
        <View style={styles.timePickerOverlay}>
          <View style={styles.timePickerModal}>
            <Text style={styles.timePickerTitle}>Select Start Time</Text>
            <ScrollView style={styles.timePickerScroll}>
              {TIME_SLOTS.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[styles.timePickerOption, formStartTime === time && styles.timePickerOptionActive]}
                  onPress={() => {
                    setFormStartTime(time);
                    setShowStartTimePicker(false);
                  }}
                >
                  <Text style={[styles.timePickerOptionText, formStartTime === time && styles.timePickerOptionTextActive]}>
                    {formatTime(time)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal (End) */}
      <Modal
        visible={showEndTimePicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowEndTimePicker(false)}
      >
        <View style={styles.timePickerOverlay}>
          <View style={styles.timePickerModal}>
            <Text style={styles.timePickerTitle}>Select End Time</Text>
            <ScrollView style={styles.timePickerScroll}>
              {TIME_SLOTS.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[styles.timePickerOption, formEndTime === time && styles.timePickerOptionActive]}
                  onPress={() => {
                    setFormEndTime(time);
                    setShowEndTimePicker(false);
                  }}
                >
                  <Text style={[styles.timePickerOptionText, formEndTime === time && styles.timePickerOptionTextActive]}>
                    {formatTime(time)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Service Advisor Management Modal */}
      <Modal
        visible={showAdvisorModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAdvisorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.advisorModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Service Advisors</Text>
              <TouchableOpacity onPress={() => setShowAdvisorModal(false)}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Add Advisor */}
            <View style={styles.addAdvisorRow}>
              <TextInput
                style={styles.addAdvisorInput}
                value={newAdvisorName}
                onChangeText={setNewAdvisorName}
                placeholder="Add new advisor..."
              />
              <TouchableOpacity style={styles.addAdvisorBtn} onPress={addAdvisor}>
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Advisor List */}
            <ScrollView style={styles.advisorList}>
              {advisors.length === 0 ? (
                <View style={styles.emptyAdvisors}>
                  <Ionicons name="people-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyAdvisorsText}>No advisors yet</Text>
                </View>
              ) : (
                advisors.map((advisor) => (
                  <View key={advisor.advisor_id} style={styles.advisorItem}>
                    <Text style={styles.advisorItemName}>{advisor.name}</Text>
                    <TouchableOpacity onPress={() => deleteAdvisor(advisor.advisor_id, advisor.name)}>
                      <Ionicons name="trash-outline" size={20} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Job Detail Modal */}
      <Modal
        visible={showJobDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowJobDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.jobDetailModal}>
            {selectedJob && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Job Details</Text>
                  <TouchableOpacity onPress={() => setShowJobDetailModal(false)}>
                    <Ionicons name="close-circle" size={28} color="#666" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.jobDetailScroll}>
                  {/* Status Badge */}
                  <View style={[styles.statusBadgeLarge, { backgroundColor: STATUS_COLORS[selectedJob.status] }]}>
                    <Text style={styles.statusBadgeText}>{STATUS_LABELS[selectedJob.status]}</Text>
                  </View>

                  {/* Vehicle Info */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Vehicle</Text>
                    <Text style={styles.detailValue}>
                      {selectedJob.vehicle_year} {selectedJob.vehicle_make || ''} {selectedJob.vehicle_model}
                    </Text>
                  </View>

                  {/* Part Number */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Part Number</Text>
                    <Text style={styles.detailValueHighlight}>{selectedJob.part_number}</Text>
                  </View>

                  {/* Calibration */}
                  {selectedJob.needs_calibration && (
                    <View style={styles.calibrationBadge}>
                      <Ionicons name="construct" size={18} color="#FF9800" />
                      <Text style={styles.calibrationText}>Calibration Required</Text>
                    </View>
                  )}

                  {/* Customer Type & Advisor */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailHalf}>
                      <Text style={styles.detailSectionTitle}>Customer</Text>
                      <Text style={styles.detailValue}>
                        {selectedJob.customer_type === 'waiter' ? '⏳ Waiter' : '🚗 Drop Off'}
                      </Text>
                    </View>
                    <View style={styles.detailHalf}>
                      <Text style={styles.detailSectionTitle}>Advisor</Text>
                      <Text style={styles.detailValue}>{selectedJob.service_advisor_name}</Text>
                    </View>
                  </View>

                  {/* Time */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Time Block</Text>
                    <Text style={styles.detailValue}>
                      {formatTime(selectedJob.start_time)} - {formatTime(selectedJob.end_time)}
                    </Text>
                  </View>

                  {/* Created By */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Created By</Text>
                    <Text style={styles.detailValue}>{selectedJob.created_by_name || 'Unknown'}</Text>
                  </View>

                  {/* Notes */}
                  {selectedJob.notes && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Notes</Text>
                      <Text style={styles.detailValue}>{selectedJob.notes}</Text>
                    </View>
                  )}

                  {/* Status Actions */}
                  <Text style={styles.detailSectionTitle}>Update Status</Text>
                  <View style={styles.statusActions}>
                    {selectedJob.status !== 'scheduled' && (
                      <TouchableOpacity
                        style={[styles.statusBtn, { backgroundColor: STATUS_COLORS.scheduled }]}
                        onPress={() => updateJobStatus(selectedJob.job_id, 'scheduled')}
                      >
                        <Text style={styles.statusBtnText}>Scheduled</Text>
                      </TouchableOpacity>
                    )}
                    {selectedJob.status !== 'in_progress' && (
                      <TouchableOpacity
                        style={[styles.statusBtn, { backgroundColor: STATUS_COLORS.in_progress }]}
                        onPress={() => updateJobStatus(selectedJob.job_id, 'in_progress')}
                      >
                        <Text style={styles.statusBtnText}>In Progress</Text>
                      </TouchableOpacity>
                    )}
                    {selectedJob.status !== 'completed' && (
                      <TouchableOpacity
                        style={[styles.statusBtn, { backgroundColor: STATUS_COLORS.completed }]}
                        onPress={() => updateJobStatus(selectedJob.job_id, 'completed')}
                      >
                        <Text style={styles.statusBtnText}>Complete</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Delete Button */}
                  <TouchableOpacity
                    style={styles.deleteJobBtn}
                    onPress={() => deleteJob(selectedJob.job_id)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#F44336" />
                    <Text style={styles.deleteJobBtnText}>Delete Job</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Calendar Modal for Date Selection */}
      <Modal
        visible={showCalendarModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCalendarModal(false)}
      >
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => changeCalendarMonth(-1)}>
                <Ionicons name="chevron-back" size={28} color="#2196F3" />
              </TouchableOpacity>
              <Text style={styles.calendarMonthTitle}>
                {calendarViewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={() => changeCalendarMonth(1)}>
                <Ionicons name="chevron-forward" size={28} color="#2196F3" />
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.calendarWeekdays}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <Text key={day} style={styles.calendarWeekdayText}>{day}</Text>
              ))}
            </View>

            {/* Calendar days */}
            <View style={styles.calendarDaysGrid}>
              {getMonthDays(calendarViewMonth).map((day, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.calendarDay,
                    day && isSameDay(day, selectedDate) && styles.calendarDaySelected,
                    day && isSameDay(day, new Date()) && styles.calendarDayToday,
                  ]}
                  onPress={() => day && selectCalendarDate(day)}
                  disabled={!day}
                >
                  {day && (
                    <Text
                      style={[
                        styles.calendarDayText,
                        isSameDay(day, selectedDate) && styles.calendarDayTextSelected,
                        isSameDay(day, new Date()) && !isSameDay(day, selectedDate) && styles.calendarDayTextToday,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Quick actions */}
            <View style={styles.calendarQuickActions}>
              <TouchableOpacity 
                style={styles.calendarQuickBtn}
                onPress={() => selectCalendarDate(new Date())}
              >
                <Text style={styles.calendarQuickBtnText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.calendarCloseBtn}
                onPress={() => setShowCalendarModal(false)}
              >
                <Text style={styles.calendarCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Form Date Picker Modal */}
      <Modal
        visible={showFormDatePicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowFormDatePicker(false)}
      >
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => {
                const newMonth = new Date(formDate);
                newMonth.setMonth(newMonth.getMonth() - 1);
                setFormDate(newMonth);
              }}>
                <Ionicons name="chevron-back" size={28} color="#2196F3" />
              </TouchableOpacity>
              <Text style={styles.calendarMonthTitle}>
                {formDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={() => {
                const newMonth = new Date(formDate);
                newMonth.setMonth(newMonth.getMonth() + 1);
                setFormDate(newMonth);
              }}>
                <Ionicons name="chevron-forward" size={28} color="#2196F3" />
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.calendarWeekdays}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <Text key={day} style={styles.calendarWeekdayText}>{day}</Text>
              ))}
            </View>

            {/* Calendar days */}
            <View style={styles.calendarDaysGrid}>
              {getMonthDays(formDate).map((day, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.calendarDay,
                    day && isSameDay(day, formDate) && styles.calendarDaySelected,
                    day && isSameDay(day, new Date()) && styles.calendarDayToday,
                  ]}
                  onPress={() => day && selectFormDate(day)}
                  disabled={!day}
                >
                  {day && (
                    <Text
                      style={[
                        styles.calendarDayText,
                        isSameDay(day, formDate) && styles.calendarDayTextSelected,
                        isSameDay(day, new Date()) && !isSameDay(day, formDate) && styles.calendarDayTextToday,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Done button */}
            <TouchableOpacity 
              style={styles.calendarDoneBtn}
              onPress={() => setShowFormDatePicker(false)}
            >
              <Text style={styles.calendarDoneBtnText}>Done</Text>
            </TouchableOpacity>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBtn: {
    padding: 8,
  },
  addBtn: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  dateArrow: {
    padding: 8,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  todayBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
  },
  techBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  techBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
  },
  techName: {
    fontWeight: '700',
  },
  jobCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  scheduleWrapper: {
    flex: 1,
  },
  scheduleContainer: {
    flex: 1,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  timeRow: {
    flexDirection: 'row',
    height: HOUR_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  timeLabel: {
    width: 75,
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  timeLabelText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  timeSlotContainer: {
    flex: 1,
    position: 'relative',
  },
  emptySlot: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  jobBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 2,
    borderRadius: 8,
    borderLeftWidth: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 10,
    justifyContent: 'center',
  },
  jobBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  jobBlockVehicle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  jobBlockPart: {
    fontSize: 13,
    color: '#E53935',
    fontWeight: '700',
  },
  jobBlockAdvisor: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  jobBlockCalibration: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '700',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  formScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formField: {
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formFieldHalf: {
    flex: 1,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  formInputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  typeOptionActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  typeOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  typeOptionTextActive: {
    color: '#fff',
  },
  noAdvisorsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
  },
  noAdvisorsBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2196F3',
  },
  advisorScroll: {
    marginVertical: 8,
  },
  advisorChip: {
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  advisorChipActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  advisorChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  advisorChipTextActive: {
    color: '#fff',
  },
  timePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  timePickerText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  submitBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  // Time picker modal
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '80%',
    maxHeight: '60%',
    padding: 16,
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  timePickerScroll: {
    maxHeight: 300,
  },
  timePickerOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timePickerOptionActive: {
    backgroundColor: '#E3F2FD',
  },
  timePickerOptionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  timePickerOptionTextActive: {
    color: '#2196F3',
    fontWeight: '600',
  },
  // Advisor modal
  advisorModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 30,
    maxHeight: '70%',
  },
  addAdvisorRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  addAdvisorInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  addAdvisorBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advisorList: {
    paddingHorizontal: 20,
  },
  emptyAdvisors: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyAdvisorsText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  advisorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
  },
  advisorItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  // Job detail modal
  jobDetailModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 30,
    maxHeight: '85%',
  },
  jobDetailScroll: {
    paddingHorizontal: 20,
  },
  statusBadgeLarge: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    marginVertical: 16,
  },
  statusBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  detailSection: {
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
  },
  detailValueHighlight: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF9800',
  },
  calibrationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  calibrationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  detailRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  detailHalf: {
    flex: 1,
  },
  statusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
    marginBottom: 20,
  },
  statusBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  statusBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  deleteJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 20,
  },
  deleteJobBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F44336',
  },
  // Date picker button in form
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  datePickerBtnText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
  },
  // Calendar modal styles
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 360,
    padding: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarMonthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  calendarWeekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  calendarDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  calendarDaySelected: {
    backgroundColor: '#2196F3',
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  calendarDayText: {
    fontSize: 15,
    color: '#333',
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  calendarDayTextToday: {
    color: '#2196F3',
    fontWeight: '600',
  },
  calendarQuickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  calendarQuickBtn: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  calendarQuickBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2196F3',
  },
  calendarCloseBtn: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  calendarCloseBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  calendarDoneBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  calendarDoneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
