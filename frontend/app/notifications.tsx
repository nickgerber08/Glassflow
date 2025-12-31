import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useJobStore } from '../stores/jobStore';
import { formatDistanceToNow } from 'date-fns';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function NotificationsScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const { setSelectedJob, jobs, fetchJobs } = useJobStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      setNotifications(prev =>
        prev.map(n =>
          n.notification_id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationPress = async (notification: any) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.notification_id);
    }

    // Navigate to job if it's a job notification
    if (notification.data?.job_id) {
      const job = jobs.find(j => j.job_id === notification.data.job_id);
      if (job) {
        setSelectedJob(job);
        router.push('/job-details');
      } else {
        // Fetch jobs and try again
        await fetchJobs();
        const refreshedJob = jobs.find(j => j.job_id === notification.data.job_id);
        if (refreshedJob) {
          setSelectedJob(refreshedJob);
          router.push('/job-details');
        }
      }
    }
  };

  useEffect(() => {
    if (sessionToken) {
      fetchNotifications();
    }
  }, [sessionToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, []);

  const renderNotification = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        !item.read && styles.unreadCard,
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationIcon}>
        <Ionicons
          name={item.data?.type === 'new_job' ? 'car' : 'notifications'}
          size={24}
          color={item.read ? '#999' : '#2196F3'}
        />
      </View>
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationTitle, !item.read && styles.unreadText]}>
          {item.title}
        </Text>
        <Text style={styles.notificationBody}>{item.body}</Text>
        <Text style={styles.notificationTime}>
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
        </Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.some(n => !n.read) && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>
            You'll see new job alerts here
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.notification_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  markAllButton: {
    padding: 8,
  },
  markAllText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  unreadCard: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: '700',
  },
  notificationBody: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});
