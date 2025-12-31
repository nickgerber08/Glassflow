import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useJobStore } from '../../stores/jobStore';
import { useRouter } from 'expo-router';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9800',
  scheduled: '#2196F3',
  in_progress: '#9C27B0',
  completed: '#4CAF50',
  cancelled: '#F44336',
};

export default function CalendarScreen() {
  const { jobs, setSelectedJob } = useJobStore();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const jobsOnSelectedDate = jobs.filter(
    (job) =>
      job.appointment_time &&
      isSameDay(parseISO(job.appointment_time), selectedDate)
  );

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
          <Text style={styles.jobsCount}>{jobsOnSelectedDate.length} jobs</Text>
        </View>

        {jobsOnSelectedDate.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No jobs scheduled for this day</Text>
          </View>
        ) : (
          jobsOnSelectedDate.map((job) => (
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
                  <Text style={styles.jobTitle}>{job.customer_name}</Text>
                  <Text style={styles.jobTime}>
                    {format(parseISO(job.appointment_time!), 'h:mm a')}
                  </Text>
                </View>
                <Text style={styles.jobDetail}>
                  {job.vehicle_year} {job.vehicle_make} {job.vehicle_model}
                </Text>
                <View style={styles.jobRow}>
                  <Ionicons name="location" size={14} color="#666" />
                  <Text style={styles.jobAddress} numberOfLines={1}>
                    {job.address}
                  </Text>
                </View>
                {job.assigned_to_name && (
                  <View style={styles.jobRow}>
                    <Ionicons name="person" size={14} color="#666" />
                    <Text style={styles.jobAssigned}>{job.assigned_to_name}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
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
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  navButton: {
    padding: 8,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  weekDays: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  selectedDay: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  dayText: {
    fontSize: 16,
    color: '#333',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  indicator: {
    position: 'absolute',
    bottom: 4,
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
  jobCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
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
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
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
  jobAddress: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  jobAssigned: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
});