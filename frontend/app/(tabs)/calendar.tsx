import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useJobStore } from '../../stores/jobStore';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

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
  const { user, sessionToken } = useAuth();
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
    if (!sessionToken) {
      console.log('No token available for fetching notes');
      return;
    }
    setNotesLoading(true);
    try {
      console.log('Fetching notes from:', `${BACKEND_URL}/api/office-notes`);
      const response = await fetch(`${BACKEND_URL}/api/office-notes`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
      console.log('Notes response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Notes received:', data.length);
        setNotes(data);
      } else {
        const errorText = await response.text();
        console.error('Notes fetch error:', errorText);
        Alert.alert('Error', 'Failed to load notes. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
      Alert.alert('Error', 'Network error loading notes.');
    } finally {
      setNotesLoading(false);
    }
  }, [sessionToken]);

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
    if (!token || !newNoteTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for the note');
      return;
    }
    try {
      console.log('Creating note:', newNoteTitle);
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
      console.log('Create note response:', response.status);
      if (response.ok) {
        setShowAddNote(false);
        setNewNoteTitle('');
        setNewNoteContent('');
        setNewNoteColor('yellow');
        setNewNoteCategory('general');
        fetchNotes();
        Alert.alert('Success', 'Note created!');
      } else {
        const errorText = await response.text();
        console.error('Create note error:', errorText);
        Alert.alert('Error', 'Failed to create note. ' + (errorText.includes('admin') ? 'Admin access required.' : 'Please try again.'));
      }
    } catch (error) {
      console.error('Error creating note:', error);
      Alert.alert('Error', 'Network error creating note.');
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

  // Fetch notes when modal opens
  useEffect(() => {
    if (showNotes) {
      fetchNotes();
    }
  }, [showNotes]);

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
        <TouchableOpacity 
          style={styles.notesButton} 
          onPress={() => setShowNotes(true)}
        >
          <Ionicons name="document-text" size={20} color="#fff" />
          <Text style={styles.notesButtonText}>Jenny's Notes</Text>
        </TouchableOpacity>
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

      {/* Jenny's Notes Modal */}
      <Modal visible={showNotes} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📝 Jenny's Notes</Text>
            <TouchableOpacity onPress={() => setShowNotes(false)} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Category Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Admin Actions */}
          {isAdmin && (
            <View style={styles.adminActions}>
              <TouchableOpacity style={styles.addNoteBtn} onPress={() => setShowAddNote(true)}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addNoteBtnText}>Add Note</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Notes List */}
          {notesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>Loading notes...</Text>
            </View>
          ) : filteredNotes.length === 0 ? (
            <View style={styles.emptyNotesContainer}>
              <Ionicons name="document-text-outline" size={64} color="#ccc" />
              <Text style={styles.emptyNotesText}>No notes in this category</Text>
            </View>
          ) : (
            <ScrollView style={styles.notesList}>
              {filteredNotes.map((note) => {
                const colors = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
                return (
                  <TouchableOpacity
                    key={note.note_id}
                    style={[styles.noteCard, { backgroundColor: colors.bg, borderLeftColor: colors.border }]}
                    onPress={() => isAdmin && openEditNote(note)}
                    activeOpacity={isAdmin ? 0.7 : 1}
                  >
                    <View style={styles.noteHeader}>
                      <Text style={[styles.noteTitle, { color: colors.text }]}>{note.title}</Text>
                      <View style={styles.noteBadge}>
                        <Text style={styles.noteBadgeText}>{note.category}</Text>
                      </View>
                    </View>
                    <Text style={[styles.noteContent, { color: colors.text }]}>{note.content}</Text>
                    {isAdmin && (
                      <View style={styles.noteActions}>
                        <TouchableOpacity onPress={() => openEditNote(note)} style={styles.noteActionBtn}>
                          <Ionicons name="pencil" size={16} color="#666" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteNote(note.note_id)} style={styles.noteActionBtn}>
                          <Ionicons name="trash" size={16} color="#E53935" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Add/Edit Note Modal */}
      <Modal visible={showAddNote || showEditNote} animationType="slide" transparent>
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <Text style={styles.editModalTitle}>{showEditNote ? 'Edit Note' : 'Add New Note'}</Text>
            
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.textInput}
              value={newNoteTitle}
              onChangeText={setNewNoteTitle}
              placeholder="Note title"
              placeholderTextColor="#999"
            />

            <Text style={styles.inputLabel}>Content</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={newNoteContent}
              onChangeText={setNewNoteContent}
              placeholder="Note content"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />

            <Text style={styles.inputLabel}>Color</Text>
            <View style={styles.colorPicker}>
              {Object.keys(NOTE_COLORS).map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: NOTE_COLORS[color].bg, borderColor: NOTE_COLORS[color].border },
                    newNoteColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => setNewNoteColor(color)}
                >
                  {newNoteColor === color && <Ionicons name="checkmark" size={16} color={NOTE_COLORS[color].text} />}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['general', 'parts', 'suppliers', 'vehicles', 'warnings'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryOption, newNoteCategory === cat && styles.categoryOptionSelected]}
                  onPress={() => setNewNoteCategory(cat)}
                >
                  <Text style={[styles.categoryOptionText, newNoteCategory === cat && styles.categoryOptionTextSelected]}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.editModalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowAddNote(false);
                  setShowEditNote(false);
                  setEditingNote(null);
                  setNewNoteTitle('');
                  setNewNoteContent('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={showEditNote ? updateNote : createNote}
              >
                <Text style={styles.saveBtnText}>{showEditNote ? 'Update' : 'Save'}</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  notesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9C27B0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  notesButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 6,
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
  // Jenny's Notes styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  categoryScroll: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    maxHeight: 56,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
  },
  categoryChipActive: {
    backgroundColor: '#9C27B0',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  adminActions: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  addNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 12,
  },
  addNoteBtnText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  seedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  seedBtnText: {
    color: '#2196F3',
    fontWeight: '600',
    marginLeft: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyNotesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyNotesText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  emptyNotesSubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
  notesList: {
    flex: 1,
    padding: 12,
  },
  noteCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  noteBadge: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  noteBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  noteContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  noteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 12,
  },
  noteActionBtn: {
    padding: 8,
  },
  // Edit Modal styles
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  editModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  colorPicker: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginTop: 4,
  },
  categoryOptionSelected: {
    backgroundColor: '#9C27B0',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#666',
  },
  categoryOptionTextSelected: {
    color: '#fff',
  },
  editModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  cancelBtnText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  saveBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});