import { create } from 'zustand';
import io, { Socket } from 'socket.io-client';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Job {
  job_id: string;
  customer_name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  job_type: string;
  status: string;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  appointment_time?: string | null;
  notes?: string | null;
  photos: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface JobStore {
  jobs: Job[];
  selectedJob: Job | null;
  socket: Socket | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  setJobs: (jobs: Job[]) => void;
  setSelectedJob: (job: Job | null) => void;
  addJob: (job: Job) => void;
  updateJob: (jobId: string, updates: Partial<Job>) => void;
  removeJob: (jobId: string) => void;
  initializeSocket: (token: string) => void;
  disconnectSocket: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  selectedJob: null,
  socket: null,
  loading: false,
  error: null,

  setJobs: (jobs) => set({ jobs }),
  
  setSelectedJob: (job) => set({ selectedJob: job }),
  
  addJob: (job) => set((state) => ({
    jobs: [job, ...state.jobs]
  })),
  
  updateJob: (jobId, updates) => set((state) => ({
    jobs: state.jobs.map((job) =>
      job.job_id === jobId ? { ...job, ...updates } : job
    ),
    selectedJob: state.selectedJob?.job_id === jobId
      ? { ...state.selectedJob, ...updates }
      : state.selectedJob
  })),
  
  removeJob: (jobId) => set((state) => ({
    jobs: state.jobs.filter((job) => job.job_id !== jobId),
    selectedJob: state.selectedJob?.job_id === jobId ? null : state.selectedJob
  })),
  
  initializeSocket: (token) => {
    const socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('job_created', (job: Job) => {
      get().addJob(job);
    });

    socket.on('job_updated', (job: Job) => {
      get().updateJob(job.job_id, job);
    });

    socket.on('job_deleted', ({ job_id }: { job_id: string }) => {
      get().removeJob(job_id);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    set({ socket });
  },
  
  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error })
}));