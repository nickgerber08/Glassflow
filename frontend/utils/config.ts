// Dynamically determine backend URL based on current environment
export const getBackendUrl = (): string => {
  // For web, detect if we're on the deployed domain
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production deployment on e1ectron.ai
    if (hostname === 'e1ectron.ai' || hostname.endsWith('.e1ectron.ai')) {
      return 'https://e1ectron.ai';
    }
    
    // Preview environment
    if (hostname.includes('preview.emergentagent.com')) {
      return `https://${hostname}`;
    }
    
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
    }
  }
  
  // Fallback to env variable for native apps
  return process.env.EXPO_PUBLIC_BACKEND_URL || '';
};

export const BACKEND_URL = getBackendUrl();
