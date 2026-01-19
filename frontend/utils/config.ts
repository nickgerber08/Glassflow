// Backend URL configuration
// Always use the preview backend as it's the only working backend for both preview and deployed Expo Go apps
const PREVIEW_BACKEND = 'https://glassflow-4.preview.emergentagent.com';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || PREVIEW_BACKEND;

// Force use preview backend if the env var points to e1ectron.ai (which doesn't have a backend)
export const getBackendUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
  
  // If env points to e1ectron.ai (no backend there), use preview instead
  if (envUrl.includes('e1ectron.ai') || envUrl === '' || !envUrl.includes('preview.emergentagent.com')) {
    return PREVIEW_BACKEND;
  }
  
  return envUrl;
};

// Use the safe backend URL
export const SAFE_BACKEND_URL = getBackendUrl();
