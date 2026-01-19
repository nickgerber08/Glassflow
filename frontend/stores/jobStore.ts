import { create } from 'zustand';
import { BACKEND_URL } from '../utils/config';

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
  loading: boolean;
  error: string | null;
  
  // Actions
  setJobs: (jobs: Job[]) => void;
  setSelectedJob: (job: Job | null) => void;
  addJob: (job: Job) => void;
  updateJob: (jobId: string, updates: Partial<Job>) => void;
  removeJob: (jobId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  selectedJob: null,
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
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error })
}));