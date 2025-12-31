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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useJobStore } from '../stores/jobStore';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { format, parseISO } from 'date-fns';

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

export default function JobDetailsScreen() {
  const { sessionToken, user } = useAuth();
  const { selectedJob } = useJobStore();
  const router = useRouter();
  const [job, setJob] = useState(selectedJob);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (job) {
      fetchComments();
    }
  }, [job]);

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
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/jobs/${job.job_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const updatedJob = await response.json();
        setJob(updatedJob);
        Alert.alert('Success', 'Job status updated');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
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

            {job.assigned_to_name && (
              <View style={styles.detailRow}>
                <Ionicons name="person" size={20} color="#2196F3" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailText}>{job.assigned_to_name}</Text>
                </View>
              </View>
            )}

            {job.appointment_time && (
              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={20} color="#2196F3" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailText}>
                    {format(parseISO(job.appointment_time), 'MMM dd, yyyy h:mm a')}
                  </Text>
                </View>
              </View>
            )}

            {job.notes && (
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>Notes:</Text>
                <Text style={styles.notesText}>{job.notes}</Text>
              </View>
            )}
          </View>
        </View>

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
                disabled={loading}
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
});
