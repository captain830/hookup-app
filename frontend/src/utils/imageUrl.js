const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Gets the base URL without /api
const getBaseUrl = () => {
  return API_URL.replace('/api', '');
};

// Fix any image URL
export const fixImageUrl = (url) => {
  if (!url) return null;
  
  // Already a full URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Starts with /uploads/
  if (url.startsWith('/uploads/')) {
    return `${getBaseUrl()}${url}`;
  }
  
  // Just a filename
  return `${getBaseUrl()}/uploads/${url}`;
};