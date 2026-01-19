// Dynamically determine backend URL based on current environment
export const getBackendUrl = (): string => {
  // For web, detect if we're on the deployed domain
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const origin = window.location.origin;
    
    // Log for debugging (remove in production)
    console.log('[Config] Hostname:', hostname, 'Origin:', origin);
    
    // Production deployment on e1ectron.ai
    if (hostname === 'e1ectron.ai' || hostname.endsWith('.e1ectron.ai')) {
      console.log('[Config] Using e1ectron.ai backend');
      return 'https://e1ectron.ai';
    }
    
    // Production deployment on emergentapp.io
    if (hostname.endsWith('.emergentapp.io')) {
      console.log('[Config] Using emergentapp.io backend:', origin);
      return origin;
    }
    
    // Preview environment
    if (hostname.includes('preview.emergentagent.com')) {
      console.log('[Config] Using preview backend:', `https://${hostname}`);
      return `https://${hostname}`;
    }
    
    // Emergent share page - use the origin
    if (hostname.includes('emergent')) {
      console.log('[Config] Using emergent origin:', origin);
      return origin;
    }
    
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
      console.log('[Config] Using localhost backend:', backendUrl);
      return backendUrl;
    }
    
    // Unknown domain - use origin as fallback
    console.log('[Config] Unknown domain, using origin:', origin);
    return origin;
  }
  
  // Fallback to env variable for native apps
  const fallbackUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
  console.log('[Config] Native app fallback:', fallbackUrl);
  return fallbackUrl;
};

export const BACKEND_URL = getBackendUrl();
