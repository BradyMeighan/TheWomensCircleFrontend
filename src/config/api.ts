// API Configuration for The Woman's Circle

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://thewomenscirclebackend-production.up.railway.app';

// Track if we're currently refreshing the token to avoid multiple refresh requests
let isRefreshingToken = false;
let refreshPromise: Promise<string> | null = null;

// Debug logging (remove in production)
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:', {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    API_BASE_URL,
    isDev: import.meta.env.DEV
  });
}

export const api = {
  baseURL: API_BASE_URL,
  endpoints: {
    // Authentication
    register: '/api/auth/register',
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    refresh: '/api/auth/refresh',
    
    // User management
    profile: '/api/user/profile',
    updateProfile: '/api/user/profile',
    changePassword: '/api/user/password',
    deleteAccount: '/api/user/account',
    
    // Health check
    health: '/health'
  }
};

// Refresh the authentication token
const refreshAuthToken = async (): Promise<string> => {
  // If already refreshing, return the existing promise
  if (isRefreshingToken && refreshPromise) {
    return refreshPromise;
  }

  isRefreshingToken = true;
  refreshPromise = (async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No token to refresh');
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      const newToken = data.data.token;
      
      // Update stored token
      localStorage.setItem('authToken', newToken);
      
      // Update stored user data if available
      if (data.data.user) {
        const currentUser = localStorage.getItem('rememberedUser');
        if (currentUser) {
          const userData = JSON.parse(currentUser);
          userData._id = data.data.user._id;
          userData.username = data.data.user.firstName + ' ' + data.data.user.lastName;
          userData.email = data.data.user.email;
          userData.isAdmin = data.data.user.isAdmin;
          localStorage.setItem('rememberedUser', JSON.stringify(userData));
        }
      }

      console.log('✅ Token refreshed successfully');
      return newToken;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      // Clear auth data on refresh failure
      localStorage.removeItem('authToken');
      localStorage.removeItem('rememberedUser');
      throw error;
    } finally {
      isRefreshingToken = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// Helper function to make API calls with timeout and automatic token refresh
export const apiCall = async (
  endpoint: string, 
  method: string = 'GET',
  data?: any,
  timeoutMs: number = 30000, // 30 second default timeout
  isRetry: boolean = false // Internal flag to prevent infinite retry loops
): Promise<any> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Don't set Content-Type for FormData - let browser set it automatically
  const isFormData = data instanceof FormData;
  
  const config: RequestInit = {
    method,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(data ? { body: isFormData ? data : JSON.stringify(data) } : {}),
  };

  // Add auth token if available
  const token = localStorage.getItem('authToken');
  if (token && config.headers) {
    (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  try {
    if (import.meta.env.DEV) {
      console.log('🌐 API Call:', { url, method: config.method || 'GET' });
    }
    
    // Add timeout to fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, {
      ...config,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      
      // Handle token expiration with automatic refresh
      if (response.status === 401 && errorData.code === 'TOKEN_EXPIRED' && !isRetry) {
        console.log('🔄 Token expired, attempting refresh...');
        
        try {
          // Try to refresh the token
          await refreshAuthToken();
          
          // Retry the original request with the new token
          return await apiCall(endpoint, method, data, timeoutMs, true);
        } catch (refreshError) {
          // If refresh fails, show clear message and redirect to login
          console.error('❌ Token refresh failed, logging out');
          
          // Dispatch custom event for app to handle logout
          window.dispatchEvent(new CustomEvent('auth:session-expired', {
            detail: { message: 'Your session has expired. Please log in again.' }
          }));
          
          throw new Error('Your session has expired. Please log in again.');
        }
      }
      
      // Handle other auth errors
      if (response.status === 401) {
        console.error('❌ Authentication error:', errorData);
        
        // Dispatch custom event for app to handle logout
        window.dispatchEvent(new CustomEvent('auth:error', {
          detail: { message: errorData.error || 'Authentication failed' }
        }));
      }
      
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('API call failed:', error);
    
    // Provide user-friendly error messages
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your internet connection and try again.');
    } else if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    
    throw error;
  }
};

// Proactively refresh token before it expires
// Call this function after successful login to start automatic refresh
export const startTokenRefreshTimer = () => {
  // Clear any existing interval
  stopTokenRefreshTimer();
  
  // Refresh token every 7 days (token expires in 30 days, so we have plenty of buffer)
  const REFRESH_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  
  const refreshInterval = setInterval(async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.log('⏹️ No token found, stopping refresh timer');
      stopTokenRefreshTimer();
      return;
    }
    
    try {
      console.log('🔄 Proactively refreshing token...');
      await refreshAuthToken();
    } catch (error) {
      console.error('❌ Proactive token refresh failed:', error);
      // Don't clear the interval - the token might still be valid for a while
      // The apiCall function will handle expiration when it happens
    }
  }, REFRESH_INTERVAL);
  
  // Store interval ID in window so we can clear it later
  (window as any).__tokenRefreshInterval = refreshInterval;
  
  console.log('✅ Token refresh timer started (every 7 days)');
};

// Stop the automatic token refresh timer
export const stopTokenRefreshTimer = () => {
  const intervalId = (window as any).__tokenRefreshInterval;
  if (intervalId) {
    clearInterval(intervalId);
    (window as any).__tokenRefreshInterval = null;
    console.log('⏹️ Token refresh timer stopped');
  }
};

export default api;
