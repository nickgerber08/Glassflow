import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useJobStore } from '../../stores/jobStore';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_BACKEND_URL || '';

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9800',
  scheduled: '#2196F3',
  in_progress: '#9C27B0',
  completed: '#4CAF50',
  cancelled: '#F44336',
};

const NOTE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  yellow: { bg: '#FFF9C4', text: '#5D4037', border: '#FBC02D' },
  red: { bg: '#FFCDD2', text: '#B71C1C', border: '#E53935' },
  green: { bg: '#C8E6C9', text: '#1B5E20', border: '#43A047' },
  cyan: { bg: '#B2EBF2', text: '#006064', border: '#00ACC1' },
  magenta: { bg: '#F8BBD9', text: '#880E4F', border: '#D81B60' },
};

interface OfficeNote {
  note_id: string;
  title: string;
  content: string;
  color: string;
  category: string;
  order: number;
}

// Helper function to group jobs by location
function groupJobsByLocation(jobs: any[]) {
  const groups: { [key: string]: any[] } = {};
  
  jobs.forEach(job => {
    // Use address as the grouping key (you could also use lat/lng with rounding)
    const locationKey = job.address;
    if (!groups[locationKey]) {
      groups[locationKey] = [];
    }
    groups[locationKey].push(job);
  });
  
  return groups;
}

export default function CalendarScreen() {
  const { jobs, setSelectedJob } = useJobStore();
  const { user, token } = useAuth();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Jenny's Notes state
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<OfficeNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddNote, setShowAddNote] = useState(false);
  const [showEditNote, setShowEditNote] = useState(false);
  const [editingNote, setEditingNote] = useState<OfficeNote | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteColor, setNewNoteColor] = useState('yellow');
  const [newNoteCategory, setNewNoteCategory] = useState('general');

  const isAdmin = user?.role === 'admin';

  const fetchNotes = useCallback(async () => {
    if (!token) return;
    setNotesLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/office-notes`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setNotesLoading(false);
    }
  }, [token]);

  const seedNotes = async () => {
    if (!token || !isAdmin) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/office-notes/seed`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        fetchNotes();
        Alert.alert('Success', 'Notes have been loaded!');
      }
    } catch (error) {
      console.error('Error seeding notes:', error);
    }
  };

  const createNote = async () => {
    if (!token || !newNoteTitle.trim()) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/office-notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newNoteTitle,
          content: newNoteContent,
          color: newNoteColor,
          category: newNoteCategory,
        }),
      });
      if (response.ok) {
        setShowAddNote(false);
        setNewNoteTitle('');
        setNewNoteContent('');
        setNewNoteColor('yellow');
        setNewNoteCategory('general');
        fetchNotes();
      }
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  const updateNote = async () => {
    if (!token || !editingNote) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/office-notes/${editingNote.note_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newNoteTitle,
          content: newNoteContent,
          color: newNoteColor,
          category: newNoteCategory,
        }),
      });
      if (response.ok) {
        setShowEditNote(false);
        setEditingNote(null);
        fetchNotes();
      }
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!token) return;
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(`${BACKEND_URL}/api/office-notes/${noteId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
              fetchNotes();
            }
          } catch (error) {
            console.error('Error deleting note:', error);
          }
        },
      },
    ]);
  };

  const openEditNote = (note: OfficeNote) => {
    setEditingNote(note);
    setNewNoteTitle(note.title);
    setNewNoteContent(note.content);
    setNewNoteColor(note.color);
    setNewNoteCategory(note.category);
    setShowEditNote(true);
  };

  useEffect(() => {
    if (showNotes && notes.length === 0) {
      fetchNotes();
    }
  }, [showNotes, fetchNotes]);

  const filteredNotes = selectedCategory === 'all' 
    ? notes 
    : notes.filter(n => n.category === selectedCategory);

  const categories = ['all', 'general', 'parts', 'suppliers', 'vehicles', 'warnings'];

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const jobsOnSelectedDate = jobs.filter(
    (job) =>
      job.appointment_time &&
      isSameDay(parseISO(job.appointment_time), selectedDate)
  );

  // Group jobs by location
  const groupedJobs = groupJobsByLocation(jobsOnSelectedDate);
  const locations = Object.keys(groupedJobs);

  const hasJobsOnDay = (day: Date) => {
    return jobs.some(
      (job) => job.appointment_time && isSameDay(parseISO(job.appointment_time), day)
    );
  };

  const goToPreviousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendar</Text>
      </View>

      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.monthText}>{format(currentMonth, 'MMMM yyyy')}</Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      <View style={styles.weekDays}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <Text key={day} style={styles.weekDayText}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.calendar}>
        {daysInMonth.map((day, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dayCell,
              isSameDay(day, selectedDate) && styles.selectedDay,
            ]}
            onPress={() => setSelectedDate(day)}
          >
            <Text
              style={[
                styles.dayText,
                isSameDay(day, selectedDate) && styles.selectedDayText,
              ]}
            >
              {format(day, 'd')}
            </Text>
            {hasJobsOnDay(day) && (
              <View style={styles.indicator} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.divider} />

      <ScrollView style={styles.jobsList}>
        <View style={styles.jobsListHeader}>
          <Text style={styles.jobsListTitle}>
            Jobs on {format(selectedDate, 'MMM dd, yyyy')}
          </Text>
          <Text style={styles.jobsCount}>
            {jobsOnSelectedDate.length} job{jobsOnSelectedDate.length !== 1 ? 's' : ''}
            {locations.length > 1 && ` at ${locations.length} locations`}
          </Text>
        </View>

        {jobsOnSelectedDate.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No jobs scheduled for this day</Text>
          </View>
        ) : (
          locations.map((location) => (
            <View key={location} style={styles.locationGroup}>
              {/* Location Header */}
              <View style={styles.locationHeader}>
                <Ionicons name="location" size={20} color="#2196F3" />
                <View style={styles.locationHeaderText}>
                  <Text style={styles.locationAddress}>{location}</Text>
                  <Text style={styles.locationCount}>
                    {groupedJobs[location].length} job{groupedJobs[location].length !== 1 ? 's' : ''} at this location
                  </Text>
                </View>
              </View>

              {/* Jobs at this location */}
              {groupedJobs[location].map((job) => (
                <TouchableOpacity
                  key={job.job_id}
                  style={styles.jobCard}
                  onPress={() => {
                    setSelectedJob(job);
                    router.push('/job-details');
                  }}
                >
                  <View
                    style={[
                      styles.jobColorBar,
                      { backgroundColor: STATUS_COLORS[job.status] },
                    ]}
                  />
                  <View style={styles.jobContent}>
                    <View style={styles.jobHeader}>
                      <View style={styles.jobTitleContainer}>
                        <Ionicons name="person" size={16} color="#666" />
                        <Text style={styles.jobTitle}>{job.customer_name}</Text>
                        {job.part_number && (
                          <View style={styles.partNumberBadge}>
                            <Text style={styles.partNumberText}>{job.part_number}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.jobTime}>
                        {format(parseISO(job.appointment_time!), 'h:mm a')}
                      </Text>
                    </View>
                    <Text style={styles.jobDetail}>
                      {job.vehicle_year} {job.vehicle_make} {job.vehicle_model}
                    </Text>
                    <View style={styles.jobRow}>
                      <Ionicons name="construct" size={14} color="#666" />
                      <Text style={styles.jobType}>{job.job_type.replace('_', ' ')}</Text>
                    </View>
                    {job.assigned_to_name && (
                      <View style={styles.jobRow}>
                        <Ionicons name="person-circle" size={14} color="#666" />
                        <Text style={styles.jobAssigned}>{job.assigned_to_name}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  navButton: {
    padding: 6,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  weekDays: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    color: '#999',
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  dayCell: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  selectedDay: {
    backgroundColor: '#2196F3',
    borderRadius: 6,
  },
  dayText: {
    fontSize: 13,
    color: '#333',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  indicator: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2196F3',
  },
  divider: {
    height: 8,
    backgroundColor: '#e0e0e0',
  },
  jobsList: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  jobsListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  jobsListTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  jobsCount: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
  locationGroup: {
    marginBottom: 24,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  locationHeaderText: {
    flex: 1,
    marginLeft: 8,
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 2,
  },
  locationCount: {
    fontSize: 12,
    color: '#1976D2',
  },
  jobCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  jobColorBar: {
    width: 4,
  },
  jobContent: {
    flex: 1,
    padding: 16,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  partNumberBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  partNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  jobTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  jobDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  jobType: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  jobAssigned: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
});