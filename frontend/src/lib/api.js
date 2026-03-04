import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// API timeout in milliseconds
const API_TIMEOUT = 8000;

// Create axios instance with timeout and interceptors
const api = axios.create({
  baseURL: API,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// Track if we've shown a network error toast recently (prevent spam)
let lastNetworkErrorTime = 0;
const NETWORK_ERROR_COOLDOWN = 5000; // 5 seconds between toasts

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const now = Date.now();
    
    // Determine error type
    let errorMessage = "Something went wrong";
    let isNetworkError = false;
    
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      errorMessage = "Request timed out. Please check your connection.";
      isNetworkError = true;
    } else if (!error.response) {
      // Network error (no response from server)
      errorMessage = "Poor Network Connection";
      isNetworkError = true;
    } else if (error.response.status >= 500) {
      errorMessage = "Server error. Please try again later.";
      isNetworkError = true;
    } else if (error.response.status === 404) {
      errorMessage = "Resource not found";
    } else if (error.response.status === 401) {
      errorMessage = "Authentication required";
    } else if (error.response.status === 403) {
      errorMessage = "Access denied";
    }
    
    // Show toast for network errors (with cooldown to prevent spam)
    if (isNetworkError && (now - lastNetworkErrorTime > NETWORK_ERROR_COOLDOWN)) {
      lastNetworkErrorTime = now;
      toast.error(errorMessage, {
        duration: 5000,
        style: {
          background: "#DC2626",
          color: "white",
          fontWeight: "600",
          fontSize: "16px",
        },
        icon: "📶",
      });
    }
    
    // Always reject with enhanced error
    return Promise.reject({
      ...error,
      isNetworkError,
      userMessage: errorMessage,
    });
  }
);

// Request interceptor to add timestamp (useful for debugging)
api.interceptors.request.use(
  (config) => {
    config.metadata = { startTime: Date.now() };
    return config;
  },
  (error) => Promise.reject(error)
);

// ==================== Safe API wrapper ====================
// Wraps API calls to prevent UI freezing on errors
const safeApiCall = async (apiPromise, fallbackValue = null) => {
  try {
    const response = await apiPromise;
    return response.data;
  } catch (error) {
    console.error("API Error:", error.userMessage || error.message);
    return fallbackValue;
  }
};

// ==================== Experiences ====================
export const getExperiences = async (propertyId = null, activeOnly = true) => {
  let url = `/experiences?active_only=${activeOnly}`;
  if (propertyId) url += `&property_id=${propertyId}`;
  const response = await api.get(url);
  return response.data;
};

export const getExperience = async (id) => {
  const response = await api.get(`/experiences/${id}`);
  return response.data;
};

export const createExperience = async (data) => {
  const response = await api.post("/experiences", data);
  return response.data;
};

export const updateExperience = async (id, data) => {
  const response = await api.put(`/experiences/${id}`, data);
  return response.data;
};

export const deleteExperience = async (id) => {
  const response = await api.delete(`/experiences/${id}`);
  return response.data;
};

// ==================== Menu ====================
export const getMenuItems = async (propertyId = null, category = null, availableOnly = true) => {
  let url = `/menu?available_only=${availableOnly}`;
  if (propertyId) url += `&property_id=${propertyId}`;
  if (category) url += `&category=${category}`;
  const response = await api.get(url);
  return response.data;
};

export const getMenuItem = async (id) => {
  const response = await api.get(`/menu/${id}`);
  return response.data;
};

export const createMenuItem = async (data) => {
  const response = await api.post("/menu", data);
  return response.data;
};

export const updateMenuItem = async (id, data) => {
  const response = await api.put(`/menu/${id}`, data);
  return response.data;
};

export const deleteMenuItem = async (id) => {
  const response = await api.delete(`/menu/${id}`);
  return response.data;
};

// ==================== Active Menu (time-based) ====================
export const getActiveMenuItems = async (propertyId) => {
  const response = await api.get(`/menu-active?property_id=${propertyId}`);
  return response.data;
};

// ==================== Guest Requests ====================
export const createRequest = async (data) => {
  const response = await api.post("/requests", data);
  return response.data;
};

export const getRequests = async (propertyId = null, status = null) => {
  let url = "/requests?";
  if (propertyId) url += `property_id=${propertyId}&`;
  if (status) url += `status=${status}`;
  const response = await api.get(url);
  return response.data;
};

export const updateRequestStatus = async (id, status) => {
  const response = await api.put(`/requests/${id}/status?status=${status}`);
  return response.data;
};

// ==================== Experience Bookings ====================
export const createBooking = async (data) => {
  const response = await api.post("/bookings", data);
  return response.data;
};

export const getBookings = async (propertyId = null, status = null) => {
  let url = "/bookings?";
  if (propertyId) url += `property_id=${propertyId}&`;
  if (status) url += `status=${status}`;
  const response = await api.get(url);
  return response.data;
};

export const updateBookingStatus = async (id, status) => {
  const response = await api.put(`/bookings/${id}/status?status=${status}`);
  return response.data;
};

// ==================== Food Orders ====================
export const createOrder = async (data) => {
  const response = await api.post("/orders", data);
  return response.data;
};

export const getOrders = async (propertyId = null, status = null) => {
  let url = "/orders?";
  if (propertyId) url += `property_id=${propertyId}&`;
  if (status) url += `status=${status}`;
  const response = await api.get(url);
  return response.data;
};

export const updateOrderStatus = async (id, status) => {
  const response = await api.put(`/orders/${id}/status?status=${status}`);
  return response.data;
};

// ==================== Settings ====================
export const getSettings = async (propertyId) => {
  const response = await api.get(`/settings/${propertyId}`);
  return response.data;
};

export const saveSettings = async (data) => {
  const response = await api.post("/settings", data);
  return response.data;
};

// ==================== Admin ====================
export const adminAuth = async (password) => {
  const response = await api.post("/admin/auth", { password });
  return response.data;
};

// ==================== Reports ====================
export const getMonthlyReport = async (propertyId, month, year) => {
  const response = await api.get(`/reports/monthly?property_id=${propertyId}&month=${month}&year=${year}`);
  return response.data;
};

export const getSalesReport = async (propertyId, month, year) => {
  const response = await api.get(`/reports/sales?property_id=${propertyId}&month=${month}&year=${year}`);
  return response.data;
};

// ==================== OTP Password Reset ====================
export const requestOTP = async (username) => {
  const response = await api.post("/auth/request-otp", { username });
  return response.data;
};

export const verifyOTPAndResetPassword = async (username, otp, newPassword) => {
  const response = await api.post("/auth/verify-otp", { 
    username, 
    otp, 
    new_password: newPassword 
  });
  return response.data;
};

export const resendOTP = async (username) => {
  const response = await api.post("/auth/resend-otp", { username });
  return response.data;
};

export const getLogs = async (propertyId = null, limit = 50) => {
  let url = `/logs?limit=${limit}`;
  if (propertyId) url += `&property_id=${propertyId}`;
  const response = await api.get(url);
  return response.data;
};

// ==================== Seed ====================
export const seedData = async (propertyId = "varanasi") => {
  const response = await api.post(`/seed?property_id=${propertyId}`);
  return response.data;
};

// ==================== Properties ====================
export const getProperties = async () => {
  const response = await api.get("/properties");
  return response.data;
};

export const cloneProperty = async (sourcePropertyId, targetPropertyId) => {
  const response = await api.post(`/properties/clone?source_property_id=${sourcePropertyId}&target_property_id=${targetPropertyId}`);
  return response.data;
};

// ==================== Property Info ====================
export const getPropertyInfo = async (propertyId) => {
  const response = await api.get(`/property-info/${propertyId}`);
  return response.data;
};

export const savePropertyInfo = async (data) => {
  const response = await api.post("/property-info", data);
  return response.data;
};

// ==================== Category Settings ====================
export const getCategorySettings = async (propertyId) => {
  const response = await api.get(`/category-settings/${propertyId}`);
  return response.data;
};

export const saveCategorySetting = async (data) => {
  const response = await api.post("/category-settings", data);
  return response.data;
};

// ==================== Users/Staff ====================
export const getUsers = async (propertyId = null) => {
  let url = "/users";
  if (propertyId) url += `?property_id=${propertyId}`;
  const response = await api.get(url);
  return response.data;
};

export const createUser = async (data) => {
  const response = await api.post("/auth/register", data);
  return response.data;
};

export const updateUser = async (userId, data) => {
  const response = await api.put(`/users/${userId}`, data);
  return response.data;
};

export const deleteUser = async (userId) => {
  const response = await api.delete(`/users/${userId}`);
  return response.data;
};

export const staffLogin = async (username, password) => {
  const response = await api.post("/auth/login", { username, password });
  return response.data;
};

// ==================== WhatsApp Helper ====================
export const generateWhatsAppLink = (phone, message) => {
  const cleanPhone = phone.replace(/\D/g, "");
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
};

// ==================== QR Code ====================
export const getQRCode = (propertySlug) => {
  return `${BACKEND_URL}/api/qr/${propertySlug}`;
};

// Export safe wrapper for components that need graceful fallback
export { safeApiCall };

export default api;
