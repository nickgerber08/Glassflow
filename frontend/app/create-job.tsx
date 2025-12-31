import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const JOB_TYPES = [
  { label: 'Windshield Replacement', value: 'windshield' },
  { label: 'Side Window', value: 'side_window' },
  { label: 'Rear Window', value: 'rear_window' },
  { label: 'Chip Repair', value: 'chip_repair' },
];

const TIME_SLOTS = [
  { label: '9:00 AM - 12:00 PM', value: 'morning' },
  { label: '1:00 PM - 4:00 PM', value: 'afternoon' },
];

// Default technicians
const DEFAULT_TECHNICIANS = [
  { name: 'Iman', user_id: 'default_iman' },
  { name: 'Enrique', user_id: 'default_enrique' },
  { name: 'Alan', user_id: 'default_alan' },
];

export default function CreateJobScreen() {
  const { sessionToken, user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [allTechnicians, setAllTechnicians] = useState<any[]>(DEFAULT_TECHNICIANS);
  
  // Get pre-selected date from navigation params
  const preSelectedDate = params.preSelectedDate 
    ? new Date(params.preSelectedDate as string)
    : null;
  
  // Form state
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vinOrLp, setVinOrLp] = useState('');
  const [jobType, setJobType] = useState('windshield');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedToName, setAssignedToName] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(preSelectedDate);
  const [timeSlot, setTimeSlot] = useState('morning');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCustomTechModal, setShowCustomTechModal] = useState(false);
  const [customTechName, setCustomTechName] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    fetchUsers();
    getCurrentLocation();
  }, []);

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
        // Combine default techs with database techs
        setAllTechnicians([...DEFAULT_TECHNICIANS, ...data]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      // Default location if error
      setLocation({ lat: 37.78825, lng: -122.4324 });
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate && event.type !== 'dismissed') {
      setSelectedDate(selectedDate);
    }
  };

  const confirmIOSDate = () => {
    setShowDatePicker(false);
  };

  const getAppointmentDateTime = () => {
    if (!selectedDate) return null;
    
    const date = new Date(selectedDate);
    if (timeSlot === 'morning') {
      date.setHours(9, 0, 0, 0);
    } else {
      date.setHours(13, 0, 0, 0);
    }
    return date;
  };

  const handleTechSelection = (tech: any) => {
    if (tech.user_id === 'other') {
      setShowCustomTechModal(true);
    } else {
      setAssignedTo(tech.user_id);
      setAssignedToName(tech.name);
    }
  };

  const handleCustomTechSubmit = () => {
    if (customTechName.trim()) {
      const customId = `custom_${Date.now()}`;
      setAssignedTo(customId);
      setAssignedToName(customTechName.trim());
      setShowCustomTechModal(false);
      setCustomTechName('');
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!customerName || !phone || !address || !vehicleMake || !vehicleModel || !vehicleYear) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'Location not available. Please try again.');
      return;
    }

    setLoading(true);

    try {
      const appointmentDateTime = getAppointmentDateTime();
      
      const jobData = {
        customer_name: customerName,
        phone: phone,
        address: address,
        lat: location.lat,
        lng: location.lng,
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_year: vehicleYear,
        vin_or_lp: vinOrLp || null,
        job_type: jobType,
        status: 'pending',
        assigned_to: assignedTo || null,
        assigned_to_name: assignedToName || null,
        appointment_time: appointmentDateTime ? appointmentDateTime.toISOString() : null,
        notes: notes || null,
        photos: [],
      };

      const response = await fetch(`${BACKEND_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(jobData),
      });

      if (response.ok) {
        const createdJob = await response.json();
        console.log('Job created successfully:', createdJob);
        
        // Clear loading first
        setLoading(false);
        
        // Show success alert with better visibility
        setTimeout(() => {
          Alert.alert(
            '✓ Success!', 
            `Job created for ${customerName} on ${selectedDate?.toLocaleDateString()}`,
            [
              {
                text: 'View Jobs',
                onPress: () => {
                  router.back();
                },
                style: 'default'
              },
            ],
            { cancelable: false }
          );
        }, 100);
        
        return; // Prevent further execution
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to create job');
      }
    } catch (error) {
      console.error('Error creating job:', error);
      Alert.alert('Error', 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Job</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Customer Name *</Text>
            <TextInput
              style={styles.input}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Enter customer name"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter phone number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter job address"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Make *</Text>
            <TextInput
              style={styles.input}
              value={vehicleMake}
              onChangeText={setVehicleMake}
              placeholder="e.g., Toyota"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Model *</Text>
            <TextInput
              style={styles.input}
              value={vehicleModel}
              onChangeText={setVehicleModel}
              placeholder="e.g., Camry"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Year *</Text>
            <TextInput
              style={styles.input}
              value={vehicleYear}
              onChangeText={setVehicleYear}
              placeholder="e.g., 2020"
              placeholderTextColor="#999"
              keyboardType="numeric"
              maxLength={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>VIN or License Plate</Text>
            <TextInput
              style={styles.input}
              value={vinOrLp}
              onChangeText={setVinOrLp}
              placeholder="Enter VIN or LP number (optional)"
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Job Type *</Text>
            <View style={styles.jobTypeContainer}>
              {JOB_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.jobTypeChip,
                    jobType === type.value && styles.jobTypeChipActive,
                  ]}
                  onPress={() => setJobType(type.value)}
                >
                  <Text
                    style={[
                      styles.jobTypeText,
                      jobType === type.value && styles.jobTypeTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Assign To Technician</Text>
            <View style={styles.techGrid}>
              {allTechnicians.map((tech) => (
                <TouchableOpacity
                  key={tech.user_id}
                  style={[
                    styles.techChip,
                    assignedTo === tech.user_id && styles.techChipActive,
                  ]}
                  onPress={() => handleTechSelection(tech)}
                >
                  <Ionicons 
                    name="person" 
                    size={16} 
                    color={assignedTo === tech.user_id ? '#fff' : '#2196F3'} 
                  />
                  <Text
                    style={[
                      styles.techChipText,
                      assignedTo === tech.user_id && styles.techChipTextActive,
                    ]}
                  >
                    {tech.name}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  styles.techChip,
                  styles.techChipOther,
                ]}
                onPress={() => setShowCustomTechModal(true)}
              >
                <Ionicons name="add-circle" size={16} color="#FF9800" />
                <Text style={styles.techChipOtherText}>Other</Text>
              </TouchableOpacity>
            </View>
            {assignedToName && !allTechnicians.find(t => t.user_id === assignedTo) && (
              <Text style={styles.selectedCustomTech}>Selected: {assignedToName}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Appointment Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={20} color="#2196F3" />
              <Text style={[styles.dateButtonText, selectedDate && styles.dateButtonTextSelected]}>
                {selectedDate
                  ? selectedDate.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })
                  : 'Tap to select date'}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate || new Date()}
              mode="date"
              display="default"
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Time Window</Text>
            <View style={styles.timeSlotContainer}>
              {TIME_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot.value}
                  style={[
                    styles.timeSlotChip,
                    timeSlot === slot.value && styles.timeSlotChipActive,
                  ]}
                  onPress={() => setTimeSlot(slot.value)}
                >
                  <Ionicons 
                    name="time" 
                    size={16} 
                    color={timeSlot === slot.value ? '#fff' : '#2196F3'} 
                  />
                  <Text
                    style={[
                      styles.timeSlotText,
                      timeSlot === slot.value && styles.timeSlotTextActive,
                    ]}
                  >
                    {slot.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any additional notes"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.submitButtonText}>Creating Job...</Text>
            </View>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.submitButtonText}>Create Job</Text>
            </>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* Date Picker Modal */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}
      
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Select Appointment Date</Text>
                <TouchableOpacity 
                  onPress={() => setShowDatePicker(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close-circle" size={32} color="#666" />
                </TouchableOpacity>
              </View>
              
              <DateTimePicker
                value={selectedDate || new Date()}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                minimumDate={new Date()}
                style={styles.iosDatePicker}
              />
              
              {selectedDate && (
                <View style={styles.selectedDateDisplay}>
                  <Ionicons name="calendar-outline" size={20} color="#2196F3" />
                  <Text style={styles.selectedDateText}>
                    {selectedDate.toLocaleDateString('en-US', { 
                      weekday: 'long',
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </Text>
                </View>
              )}
              
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={confirmIOSDate}
              >
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.confirmButtonText}>Confirm Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Custom Tech Modal */}
      <Modal
        transparent={true}
        animationType="fade"
        visible={showCustomTechModal}
        onRequestClose={() => setShowCustomTechModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.customTechModal}>
            <Text style={styles.modalTitle}>Enter Technician Name</Text>
            <TextInput
              style={styles.modalInput}
              value={customTechName}
              onChangeText={setCustomTechName}
              placeholder="Enter name"
              placeholderTextColor="#999"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowCustomTechModal(false);
                  setCustomTechName('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleCustomTechSubmit}
              >
                <Text style={styles.modalButtonConfirmText}>Add</Text>
              </TouchableOpacity>
            </View>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  jobTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  jobTypeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  jobTypeChipActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  jobTypeText: {
    fontSize: 14,
    color: '#666',
  },
  jobTypeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  techGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  techChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#2196F3',
    gap: 6,
  },
  techChipActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  techChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  techChipTextActive: {
    color: '#fff',
  },
  techChipOther: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  techChipOtherText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  selectedCustomTech: {
    marginTop: 8,
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  dateButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#999',
    marginLeft: 12,
  },
  dateButtonTextSelected: {
    color: '#333',
    fontWeight: '600',
  },
  timeSlotContainer: {
    gap: 8,
  },
  timeSlotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#2196F3',
    gap: 8,
  },
  timeSlotChipActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  timeSlotText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2196F3',
  },
  timeSlotTextActive: {
    color: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  datePickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  calendarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 10,
  },
  selectedDateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  selectedDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  datePickerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 10,
  },
  datePicker: {
    width: '100%',
    height: 240,
  },
  iosDatePicker: {
    width: '100%',
    height: 216,
  },
  confirmButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
    gap: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  customTechModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f5f5f5',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalButtonConfirm: {
    backgroundColor: '#2196F3',
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});