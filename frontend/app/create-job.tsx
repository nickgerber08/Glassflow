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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
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
  const [partNumber, setPartNumber] = useState('');
  const [omegaInvoice, setOmegaInvoice] = useState('');
  const [paymentType, setPaymentType] = useState<'collect' | 'dealership_po' | ''>('');
  const [amountToCollect, setAmountToCollect] = useState('');
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

  // Saved customers state
  const [savedCustomers, setSavedCustomers] = useState<any[]>([]);
  const [frequentCustomers, setFrequentCustomers] = useState<any[]>([]);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [saveCustomerToggle, setSaveCustomerToggle] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(true);
  
  // VIN Scanner state
  const [showVinModal, setShowVinModal] = useState(false);
  const [vinScanning, setVinScanning] = useState(false);
  const [vinImage, setVinImage] = useState<string | null>(null);
  const [vinResult, setVinResult] = useState<string>('');
  const [vinError, setVinError] = useState<string>('');

  useEffect(() => {
    fetchUsers();
    getCurrentLocation();
    fetchSavedCustomers();
    fetchFrequentCustomers();
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

  const fetchSavedCustomers = async (search?: string) => {
    try {
      const url = search 
        ? `${BACKEND_URL}/api/customers?search=${encodeURIComponent(search)}`
        : `${BACKEND_URL}/api/customers`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSavedCustomers(data);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchFrequentCustomers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/customers/frequent?limit=5`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFrequentCustomers(data);
      }
    } catch (error) {
      console.error('Error fetching frequent customers:', error);
    }
  };

  const selectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setCustomerName(customer.name);
    setPhone(customer.phone);
    setAddress(customer.address);
    setLocation({ lat: customer.lat, lng: customer.lng });
    setIsNewCustomer(false);
    setShowCustomerPicker(false);
    setCustomerSearch('');
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setCustomerName('');
    setPhone('');
    setAddress('');
    setIsNewCustomer(true);
    setSaveCustomerToggle(false);
  };

  const handleCustomerSearch = (text: string) => {
    setCustomerSearch(text);
    if (text.length >= 2) {
      fetchSavedCustomers(text);
    } else if (text.length === 0) {
      fetchSavedCustomers();
    }
  };

  // VIN validation function - uses check digit at position 9
  const validateVin = (vin: string): boolean => {
    if (vin.length !== 17) return false;
    
    // VIN character values for checksum calculation
    const transliteration: { [key: string]: number } = {
      'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
      'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
      'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
      '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
    };
    
    // Position weights for checksum
    const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
    
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      const char = vin[i];
      const value = transliteration[char];
      if (value === undefined) return false; // Invalid character
      sum += value * weights[i];
    }
    
    const checkDigit = sum % 11;
    const checkChar = checkDigit === 10 ? 'X' : checkDigit.toString();
    
    return vin[8] === checkChar;
  };

  // Extract potential VINs from OCR text
  const extractVinCandidates = (text: string): string[] => {
    // Clean the text
    let cleanText = text.toUpperCase();
    
    // Replace common OCR mistakes
    cleanText = cleanText
      .replace(/[oO]/g, '0')  // O -> 0
      .replace(/[iI]/g, '1')  // I -> 1
      .replace(/[qQ]/g, '0'); // Q -> 0
    
    // Find all potential 17-character sequences
    const candidates: string[] = [];
    
    // Method 1: Look for "VIN" label followed by the number
    const vinLabelMatch = cleanText.match(/VIN[:\s#]*([A-HJ-NPR-Z0-9]{17})/);
    if (vinLabelMatch) {
      candidates.push(vinLabelMatch[1]);
    }
    
    // Method 2: Extract all 17-character alphanumeric sequences
    const allText = cleanText.replace(/[^A-HJ-NPR-Z0-9]/g, '');
    for (let i = 0; i <= allText.length - 17; i++) {
      const potential = allText.substring(i, i + 17);
      // Basic VIN format check - first char should be valid country code
      const firstChar = potential[0];
      // Valid first characters: 1-5 (North America), J (Japan), K (Korea), S (UK), W (Germany), etc.
      if (/^[1-5JKLMNPRSTUVWXYZ]/.test(firstChar)) {
        candidates.push(potential);
      }
    }
    
    // Method 3: Look in individual lines for cleaner extraction
    const lines = text.split(/[\r\n]+/);
    for (const line of lines) {
      const cleanLine = line.toUpperCase()
        .replace(/[oO]/g, '0')
        .replace(/[iI]/g, '1')
        .replace(/[qQ]/g, '0')
        .replace(/[^A-HJ-NPR-Z0-9]/g, '');
      
      if (cleanLine.length === 17 && /^[1-5JKLMNPRSTUVWXYZ]/.test(cleanLine[0])) {
        candidates.push(cleanLine);
      }
    }
    
    // Remove duplicates
    return [...new Set(candidates)];
  };

  // VIN Scanner function
  const scanVin = async () => {
    // Reset states
    setVinResult('');
    setVinError('');
    setVinImage(null);
    
    try {
      // Request camera permission
      const permResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permResult.status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to scan VIN');
        return;
      }

      // Launch camera with higher quality for better OCR
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (result.canceled) {
        return;
      }

      if (!result.assets || !result.assets[0]) {
        Alert.alert('Error', 'No image was captured');
        return;
      }

      const imageUri = result.assets[0].uri;
      
      // Show modal immediately with captured image
      setVinImage(imageUri);
      setVinScanning(true);
      setVinResult('Processing image...');
      setShowVinModal(true);

      // Process image: resize for better OCR
      let manipResult;
      try {
        manipResult = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 1400 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
      } catch (manipError: any) {
        setVinScanning(false);
        setVinError(`Image processing failed: ${manipError.message}`);
        return;
      }

      if (!manipResult.base64) {
        setVinScanning(false);
        setVinError('Failed to get image data');
        return;
      }

      const base64Data = manipResult.base64;
      const sizeKB = Math.round(base64Data.length * 0.75 / 1024);
      setVinResult(`Image: ${sizeKB}KB. Scanning for VIN...`);

      // If too large, compress more
      let finalBase64 = base64Data;
      if (sizeKB > 900) {
        try {
          const smallerResult = await ImageManipulator.manipulateAsync(
            imageUri,
            [{ resize: { width: 1000 } }],
            { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );
          if (smallerResult.base64) {
            finalBase64 = smallerResult.base64;
          }
        } catch (e) {}
      }

      setVinResult('Reading text from image...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const base64ImageData = `data:image/jpeg;base64,${finalBase64}`;
      const encodedImage = encodeURIComponent(base64ImageData);
      
      let ocrResponse;
      try {
        ocrResponse = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          headers: {
            'apikey': 'K89622968488957',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `base64Image=${encodedImage}&OCREngine=2&scale=true&isTable=false&detectOrientation=true`,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        setVinScanning(false);
        if (fetchError.name === 'AbortError') {
          setVinError('Request timed out. Please try again.');
        } else {
          setVinError(`Network error: ${fetchError.message}`);
        }
        return;
      }

      setVinResult('Validating VIN...');
      
      let ocrResult;
      try {
        ocrResult = await ocrResponse.json();
      } catch (parseError) {
        setVinScanning(false);
        setVinError('Failed to parse OCR response');
        return;
      }
      
      setVinScanning(false);
      
      if (ocrResult.IsErroredOnProcessing) {
        const errorMsg = ocrResult.ErrorMessage?.[0] || ocrResult.ErrorDetails || 'OCR processing failed';
        setVinError(errorMsg);
        return;
      }
      
      if (ocrResult.ParsedResults && ocrResult.ParsedResults[0]) {
        const text = ocrResult.ParsedResults[0].ParsedText || '';
        
        if (!text.trim()) {
          setVinError('No text detected. Try better lighting or angle.');
          return;
        }

        // Extract VIN candidates
        const candidates = extractVinCandidates(text);
        
        // First, try to find a VIN that passes checksum validation
        for (const candidate of candidates) {
          if (validateVin(candidate)) {
            setVinOrLp(candidate);
            setVinResult(`✓ Valid VIN: ${candidate}`);
            setVinError('');
            setTimeout(() => setShowVinModal(false), 1500);
            return;
          }
        }
        
        // If no checksum-valid VIN found, use the first candidate that looks like a VIN
        if (candidates.length > 0) {
          const bestCandidate = candidates[0];
          setVinOrLp(bestCandidate);
          setVinResult(`VIN Found: ${bestCandidate}`);
          setVinError('Note: Could not verify checksum. Please double-check.');
          setTimeout(() => setShowVinModal(false), 2000);
          return;
        }
        
        // No valid candidates found
        setVinError('No valid VIN found. Tips: Focus camera on VIN only, ensure good lighting.');
        const displayText = text.replace(/[\r\n]+/g, ' ').substring(0, 80);
        setVinResult(`Text found: "${displayText}..."`);
      } else {
        setVinError('No results from OCR. Please try again.');
      }
    } catch (error: any) {
      setVinScanning(false);
      setVinError(`Unexpected error: ${error.message || 'Unknown'}`);
      console.error('VIN scan error:', error);
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

    if (!omegaInvoice || !omegaInvoice.trim()) {
      Alert.alert('Error', 'Omega Invoice # is required');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'Location not available. Please try again.');
      return;
    }

    setLoading(true);

    try {
      // If using existing customer, increment usage count
      if (selectedCustomer) {
        try {
          await fetch(`${BACKEND_URL}/api/customers/${selectedCustomer.customer_id}/increment-usage`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          });
        } catch (e) {
          console.error('Error incrementing customer usage:', e);
        }
      }
      
      // If saving new customer
      if (isNewCustomer && saveCustomerToggle && customerName && phone && address) {
        try {
          await fetch(`${BACKEND_URL}/api/customers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              name: customerName,
              phone: phone,
              address: address,
              lat: location.lat,
              lng: location.lng,
            }),
          });
        } catch (e) {
          console.error('Error saving customer:', e);
        }
      }

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
        part_number: partNumber || null,
        omega_invoice: omegaInvoice || null,
        payment_type: paymentType || null,
        amount_to_collect: paymentType === 'collect' && amountToCollect ? parseFloat(amountToCollect) : null,
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
        
        // Navigate back immediately with success params
        router.replace({
          pathname: '/(tabs)/jobs',
          params: { 
            jobCreated: 'true',
            customerName: customerName 
          }
        });
        
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
        {/* Customer Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          
          {/* Show selected customer or selector button */}
          {selectedCustomer ? (
            <View style={styles.selectedCustomerCard}>
              <View style={styles.selectedCustomerInfo}>
                <Ionicons name="business" size={24} color="#2196F3" />
                <View style={styles.selectedCustomerText}>
                  <Text style={styles.selectedCustomerName}>{selectedCustomer.name}</Text>
                  <Text style={styles.selectedCustomerDetail}>{selectedCustomer.phone}</Text>
                  <Text style={styles.selectedCustomerDetail} numberOfLines={1}>{selectedCustomer.address}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={clearSelectedCustomer} style={styles.clearCustomerBtn}>
                <Ionicons name="close-circle" size={24} color="#F44336" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.customerSelectorBtn}
              onPress={() => setShowCustomerPicker(true)}
            >
              <Ionicons name="search" size={20} color="#2196F3" />
              <Text style={styles.customerSelectorText}>Search saved customers...</Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          )}

          {/* Frequent Customers Quick Select */}
          {!selectedCustomer && frequentCustomers.length > 0 && (
            <View style={styles.frequentSection}>
              <Text style={styles.frequentLabel}>Most Used</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.frequentScroll}>
                {frequentCustomers.map((customer) => (
                  <TouchableOpacity
                    key={customer.customer_id}
                    style={styles.frequentChip}
                    onPress={() => selectCustomer(customer)}
                  >
                    <Ionicons name="star" size={14} color="#FF9800" />
                    <Text style={styles.frequentChipText} numberOfLines={1}>{customer.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* New Customer Toggle */}
          {!selectedCustomer && (
            <TouchableOpacity 
              style={styles.newCustomerToggle}
              onPress={() => setIsNewCustomer(!isNewCustomer)}
            >
              <Ionicons 
                name={isNewCustomer ? "checkbox" : "square-outline"} 
                size={24} 
                color={isNewCustomer ? "#2196F3" : "#666"} 
              />
              <Text style={styles.newCustomerToggleText}>Enter new customer details</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Customer Information - Manual Entry */}
        {(isNewCustomer || selectedCustomer) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {selectedCustomer ? 'Customer Details (from saved)' : 'New Customer Details'}
            </Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Customer Name *</Text>
            <TextInput
              style={[styles.input, selectedCustomer && styles.inputDisabled]}
              value={customerName}
              onChangeText={(text) => {
                setCustomerName(text);
                if (selectedCustomer) {
                  setSelectedCustomer(null);
                  setIsNewCustomer(true);
                }
              }}
              placeholder="Enter customer name"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={[styles.input, selectedCustomer && styles.inputDisabled]}
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (selectedCustomer) {
                  setSelectedCustomer(null);
                  setIsNewCustomer(true);
                }
              }}
              placeholder="Enter phone number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={[styles.input, styles.textArea, selectedCustomer && styles.inputDisabled]}
              value={address}
              onChangeText={(text) => {
                setAddress(text);
                if (selectedCustomer) {
                  setSelectedCustomer(null);
                  setIsNewCustomer(true);
                }
              }}
              placeholder="Enter job address"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Save customer toggle for new customers */}
          {isNewCustomer && !selectedCustomer && (
            <TouchableOpacity 
              style={styles.saveCustomerToggle}
              onPress={() => setSaveCustomerToggle(!saveCustomerToggle)}
            >
              <Ionicons 
                name={saveCustomerToggle ? "checkbox" : "square-outline"} 
                size={22} 
                color={saveCustomerToggle ? "#4CAF50" : "#666"} 
              />
              <Text style={styles.saveCustomerText}>Save customer for future jobs</Text>
            </TouchableOpacity>
          )}
        </View>
        )}

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
            <View style={styles.vinInputRow}>
              <TextInput
                style={[styles.input, styles.vinInput]}
                value={vinOrLp}
                onChangeText={setVinOrLp}
                placeholder="Enter VIN or LP number"
                placeholderTextColor="#999"
                autoCapitalize="characters"
              />
              <TouchableOpacity 
                style={styles.scanVinBtn} 
                onPress={scanVin}
                disabled={vinScanning}
              >
                {vinScanning ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="camera" size={20} color="#fff" />
                    <Text style={styles.scanVinBtnText}>Scan</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Part Number</Text>
            <TextInput
              style={[styles.input, styles.partNumberInput]}
              value={partNumber}
              onChangeText={setPartNumber}
              placeholder="Enter part number (optional)"
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Omega Invoice #</Text>
            <TextInput
              style={[styles.input, styles.omegaInput]}
              value={omegaInvoice}
              onChangeText={setOmegaInvoice}
              placeholder="Enter Omega invoice number (optional)"
              placeholderTextColor="#999"
            />
          </View>

          {/* Payment Collection Section */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Payment Collection</Text>
            <View style={styles.paymentTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.paymentTypeChip,
                  paymentType === 'collect' && styles.paymentTypeChipActive,
                ]}
                onPress={() => setPaymentType('collect')}
              >
                <Ionicons 
                  name="cash" 
                  size={18} 
                  color={paymentType === 'collect' ? '#fff' : '#4CAF50'} 
                />
                <Text style={[
                  styles.paymentTypeText,
                  paymentType === 'collect' && styles.paymentTypeTextActive,
                ]}>
                  Collect Amount
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.paymentTypeChip,
                  paymentType === 'dealership_po' && styles.paymentTypeChipPOActive,
                ]}
                onPress={() => {
                  setPaymentType('dealership_po');
                  setAmountToCollect('');
                }}
              >
                <Ionicons 
                  name="business" 
                  size={18} 
                  color={paymentType === 'dealership_po' ? '#fff' : '#9C27B0'} 
                />
                <Text style={[
                  styles.paymentTypeText,
                  paymentType === 'dealership_po' && styles.paymentTypeTextActive,
                ]}>
                  Dealership PO
                </Text>
              </TouchableOpacity>
            </View>

            {paymentType === 'collect' && (
              <View style={styles.amountInputContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amountToCollect}
                  onChangeText={setAmountToCollect}
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                />
              </View>
            )}
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

      {/* Customer Picker Modal */}
      <Modal
        transparent={true}
        animationType="slide"
        visible={showCustomerPicker}
        onRequestClose={() => setShowCustomerPicker(false)}
      >
        <View style={styles.customerPickerOverlay}>
          <View style={styles.customerPickerModal}>
            <View style={styles.customerPickerHeader}>
              <Text style={styles.customerPickerTitle}>Select Customer</Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowCustomerPicker(false);
                  setCustomerSearch('');
                }}
              >
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.customerSearchContainer}>
              <Ionicons name="search" size={20} color="#999" />
              <TextInput
                style={styles.customerSearchInput}
                value={customerSearch}
                onChangeText={handleCustomerSearch}
                placeholder="Search by name or address..."
                placeholderTextColor="#999"
                autoFocus
              />
              {customerSearch.length > 0 && (
                <TouchableOpacity onPress={() => {
                  setCustomerSearch('');
                  fetchSavedCustomers();
                }}>
                  <Ionicons name="close" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            {/* Customer List */}
            <ScrollView style={styles.customerList} showsVerticalScrollIndicator={false}>
              {savedCustomers.length === 0 ? (
                <View style={styles.noCustomersContainer}>
                  <Ionicons name="people-outline" size={48} color="#ccc" />
                  <Text style={styles.noCustomersText}>
                    {customerSearch ? 'No matching customers found' : 'No saved customers yet'}
                  </Text>
                  <Text style={styles.noCustomersSubtext}>
                    Create jobs and save customers to see them here
                  </Text>
                </View>
              ) : (
                savedCustomers.map((customer) => (
                  <TouchableOpacity
                    key={customer.customer_id}
                    style={styles.customerListItem}
                    onPress={() => selectCustomer(customer)}
                  >
                    <View style={styles.customerListIcon}>
                      <Ionicons name="business" size={24} color="#2196F3" />
                    </View>
                    <View style={styles.customerListInfo}>
                      <Text style={styles.customerListName}>{customer.name}</Text>
                      <Text style={styles.customerListPhone}>{customer.phone}</Text>
                      <Text style={styles.customerListAddress} numberOfLines={1}>{customer.address}</Text>
                    </View>
                    {customer.usage_count > 0 && (
                      <View style={styles.usageCountBadge}>
                        <Text style={styles.usageCountText}>{customer.usage_count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* New Customer Option */}
            <TouchableOpacity 
              style={styles.newCustomerOption}
              onPress={() => {
                setShowCustomerPicker(false);
                setIsNewCustomer(true);
                setCustomerSearch('');
              }}
            >
              <Ionicons name="add-circle" size={24} color="#4CAF50" />
              <Text style={styles.newCustomerOptionText}>Enter new customer manually</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* VIN Scanning Modal */}
      <Modal
        visible={showVinModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowVinModal(false);
          setVinScanning(false);
        }}
      >
        <View style={styles.vinModalOverlay}>
          <View style={styles.vinModalContent}>
            <View style={styles.vinModalHeader}>
              <Text style={styles.vinModalTitle}>
                {vinScanning ? 'Scanning VIN...' : 'VIN Scanner'}
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowVinModal(false);
                  setVinScanning(false);
                }}
              >
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>
            
            {vinImage && (
              <Image source={{ uri: vinImage }} style={styles.vinPreviewImage} />
            )}
            
            {vinScanning ? (
              <View style={styles.vinScanningIndicator}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.vinScanningText}>Reading VIN from image...</Text>
                {vinResult ? <Text style={styles.vinResultText}>{vinResult}</Text> : null}
                <TouchableOpacity 
                  style={styles.vinCancelBtn}
                  onPress={() => {
                    setShowVinModal(false);
                    setVinScanning(false);
                  }}
                >
                  <Text style={styles.vinCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.vinResultContainer}>
                {vinError ? (
                  <View style={styles.vinErrorBox}>
                    <Ionicons name="alert-circle" size={24} color="#F44336" />
                    <Text style={styles.vinErrorText}>{vinError}</Text>
                  </View>
                ) : null}
                
                {vinResult ? (
                  <View style={styles.vinResultBox}>
                    <Text style={styles.vinResultLabel}>Result:</Text>
                    <Text style={styles.vinResultText} selectable>{vinResult}</Text>
                  </View>
                ) : null}
                
                <TouchableOpacity 
                  style={styles.vinCancelBtn}
                  onPress={() => setShowVinModal(false)}
                >
                  <Text style={styles.vinCancelBtnText}>Close</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.vinRetryBtn}
                  onPress={() => {
                    setShowVinModal(false);
                    setTimeout(() => scanVin(), 300);
                  }}
                >
                  <Text style={styles.vinRetryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}
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
  partNumberInput: {
    borderColor: '#FF9800',
    borderWidth: 2,
    backgroundColor: '#FFF3E0',
  },
  omegaInput: {
    borderColor: '#607D8B',
    borderWidth: 2,
    backgroundColor: '#ECEFF1',
  },
  // Payment type styles
  paymentTypeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  paymentTypeChip: {
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
  paymentTypeChipActive: {
    backgroundColor: '#4CAF50',
  },
  paymentTypeChipPOActive: {
    backgroundColor: '#9C27B0',
    borderColor: '#9C27B0',
  },
  paymentTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  paymentTypeTextActive: {
    color: '#fff',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
    paddingHorizontal: 16,
  },
  dollarSign: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 8,
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
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  // Customer Selector Styles
  customerSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 10,
  },
  customerSelectorText: {
    flex: 1,
    fontSize: 16,
    color: '#999',
  },
  selectedCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  selectedCustomerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedCustomerText: {
    flex: 1,
  },
  selectedCustomerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1976D2',
    marginBottom: 2,
  },
  selectedCustomerDetail: {
    fontSize: 13,
    color: '#666',
  },
  clearCustomerBtn: {
    padding: 4,
  },
  frequentSection: {
    marginTop: 12,
  },
  frequentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  frequentScroll: {
    flexDirection: 'row',
  },
  frequentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    gap: 6,
  },
  frequentChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E65100',
    maxWidth: 120,
  },
  newCustomerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  newCustomerToggleText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  saveCustomerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginTop: 8,
  },
  saveCustomerText: {
    fontSize: 15,
    color: '#2E7D32',
    fontWeight: '500',
  },
  inputDisabled: {
    backgroundColor: '#E3F2FD',
    borderColor: '#90CAF9',
  },
  // Customer Picker Modal Styles
  customerPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  customerPickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 16,
    paddingBottom: 30,
  },
  customerPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  customerPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  customerSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  customerSearchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    color: '#333',
  },
  customerList: {
    maxHeight: 350,
    paddingHorizontal: 16,
  },
  noCustomersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noCustomersText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  noCustomersSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  customerListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  customerListIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerListInfo: {
    flex: 1,
    marginLeft: 12,
  },
  customerListName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  customerListPhone: {
    fontSize: 13,
    color: '#666',
  },
  customerListAddress: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  usageCountBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  usageCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  newCustomerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 10,
  },
  newCustomerOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  // VIN Scanner styles
  vinInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vinInput: {
    flex: 1,
  },
  scanVinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  scanVinBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  vinModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  vinModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 350,
  },
  vinModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  vinModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  vinPreviewImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    marginBottom: 16,
  },
  vinScanningIndicator: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  vinScanningText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  vinScanningHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#999',
  },
  vinCancelBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  vinCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  vinResultContainer: {
    padding: 10,
  },
  vinErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  vinErrorText: {
    flex: 1,
    fontSize: 14,
    color: '#D32F2F',
  },
  vinResultBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  vinResultLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  vinResultText: {
    fontSize: 14,
    color: '#333',
  },
  vinRetryBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    alignItems: 'center',
  },
  vinRetryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});