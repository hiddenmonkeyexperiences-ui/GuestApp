// Simple state management using localStorage
// Cart persists across browser refresh and app crashes

// ==================== Cart ====================
// Cart is stored per-property to prevent cross-property cart issues
const getCartKey = (propertyId) => `hm_cart_${propertyId || 'default'}`;

// Get current property for cart operations
const getCurrentPropertyForCart = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const propertyFromUrl = urlParams.get("property");
  if (propertyFromUrl) return propertyFromUrl;
  
  // Check URL path for slug
  const pathname = window.location.pathname;
  const slug = pathname.replace("/", "").split("?")[0];
  const PROPERTY_SLUGS = {
    "VaranasiHostel": "varanasi",
    "DarjeelingHostel": "darjeeling-hostel",
    "DarjeelingHome": "darjeeling-home"
  };
  if (PROPERTY_SLUGS[slug]) return PROPERTY_SLUGS[slug];
  
  return localStorage.getItem("hm_property") || "varanasi";
};

export const getCart = (propertyId = null) => {
  try {
    const pid = propertyId || getCurrentPropertyForCart();
    const cart = localStorage.getItem(getCartKey(pid));
    const parsed = cart ? JSON.parse(cart) : [];
    // Validate cart structure
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && item.id && item.quantity > 0);
  } catch (error) {
    console.error("Error reading cart:", error);
    return [];
  }
};

const saveCart = (cart, propertyId = null) => {
  try {
    const pid = propertyId || getCurrentPropertyForCart();
    localStorage.setItem(getCartKey(pid), JSON.stringify(cart));
    // Also save timestamp for debugging
    localStorage.setItem(`${getCartKey(pid)}_updated`, new Date().toISOString());
  } catch (error) {
    console.error("Error saving cart:", error);
  }
};

export const addToCart = (item, propertyId = null) => {
  const cart = getCart(propertyId);
  const existingIndex = cart.findIndex((i) => i.id === item.id);
  
  if (existingIndex >= 0) {
    cart[existingIndex].quantity += 1;
  } else {
    cart.push({ 
      id: item.id,
      name: item.name,
      price: item.price,
      image_url: item.image_url,
      description: item.description,
      is_vegetarian: item.is_vegetarian,
      quantity: 1 
    });
  }
  
  saveCart(cart, propertyId);
  return cart;
};

export const updateCartQuantity = (itemId, quantity, propertyId = null) => {
  const cart = getCart(propertyId);
  const index = cart.findIndex((i) => i.id === itemId);
  
  if (index >= 0) {
    if (quantity <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index].quantity = quantity;
    }
  }
  
  saveCart(cart, propertyId);
  return cart;
};

export const removeFromCart = (itemId, propertyId = null) => {
  const cart = getCart(propertyId).filter((i) => i.id !== itemId);
  saveCart(cart, propertyId);
  return cart;
};

export const clearCart = (propertyId = null) => {
  const pid = propertyId || getCurrentPropertyForCart();
  localStorage.removeItem(getCartKey(pid));
  return [];
};

export const getCartTotal = (propertyId = null) => {
  const cart = getCart(propertyId);
  return cart.reduce((total, item) => total + (item.price || 0) * (item.quantity || 0), 0);
};

export const getCartCount = (propertyId = null) => {
  const cart = getCart(propertyId);
  return cart.reduce((count, item) => count + (item.quantity || 0), 0);
};

// ==================== Property ====================
const PROPERTY_KEY = "hm_property";

// URL slug to property ID mapping
const PROPERTY_SLUGS = {
  "VaranasiHostel": "varanasi",
  "DarjeelingHostel": "darjeeling-hostel",
  "DarjeelingHome": "darjeeling-home"
};

export const getPropertyId = () => {
  // First check URL path for slug (e.g., /VaranasiHostel)
  const pathname = window.location.pathname;
  const slug = pathname.replace("/", "").split("?")[0];
  if (PROPERTY_SLUGS[slug]) {
    const propertyId = PROPERTY_SLUGS[slug];
    localStorage.setItem(PROPERTY_KEY, propertyId);
    return propertyId;
  }
  
  // Check URL params
  const urlParams = new URLSearchParams(window.location.search);
  const propertyFromUrl = urlParams.get("property");
  
  if (propertyFromUrl) {
    localStorage.setItem(PROPERTY_KEY, propertyFromUrl);
    return propertyFromUrl;
  }
  
  // Fall back to localStorage
  return localStorage.getItem(PROPERTY_KEY) || "varanasi";
};

export const setPropertyId = (propertyId) => {
  localStorage.setItem(PROPERTY_KEY, propertyId);
};

export const getPropertySlug = (propertyId) => {
  // Reverse lookup
  for (const [slug, id] of Object.entries(PROPERTY_SLUGS)) {
    if (id === propertyId) return slug;
  }
  return propertyId;
};

// ==================== Admin Auth ====================
const ADMIN_AUTH_KEY = "hm_admin_auth";

export const isAdminAuthenticated = () => {
  return localStorage.getItem(ADMIN_AUTH_KEY) === "true";
};

export const setAdminAuthenticated = (value) => {
  if (value) {
    localStorage.setItem(ADMIN_AUTH_KEY, "true");
  } else {
    localStorage.removeItem(ADMIN_AUTH_KEY);
  }
};

export const logoutAdmin = () => {
  localStorage.removeItem(ADMIN_AUTH_KEY);
};

// ==================== Staff Auth ====================
const STAFF_AUTH_KEY = "hm_staff_auth";

export const getStaffAuth = () => {
  try {
    const auth = localStorage.getItem(STAFF_AUTH_KEY);
    return auth ? JSON.parse(auth) : null;
  } catch {
    return null;
  }
};

export const setStaffAuth = (user) => {
  if (user) {
    localStorage.setItem(STAFF_AUTH_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STAFF_AUTH_KEY);
  }
};

export const logoutStaff = () => {
  localStorage.removeItem(STAFF_AUTH_KEY);
};

// ==================== Guest Info (persistent storage) ====================
const GUEST_INFO_KEY = "hm_guest_info";

export const getGuestInfo = () => {
  try {
    const info = localStorage.getItem(GUEST_INFO_KEY);
    return info ? JSON.parse(info) : { name: "", room: "", whatsapp: "" };
  } catch {
    return { name: "", room: "", whatsapp: "" };
  }
};

export const setGuestInfo = (info) => {
  try {
    localStorage.setItem(GUEST_INFO_KEY, JSON.stringify(info));
  } catch (error) {
    console.error("Error saving guest info:", error);
  }
};

// ==================== Pending Order (for crash recovery) ====================
const PENDING_ORDER_KEY = "hm_pending_order";

export const savePendingOrder = (orderData) => {
  try {
    localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({
      ...orderData,
      savedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error("Error saving pending order:", error);
  }
};

export const getPendingOrder = () => {
  try {
    const order = localStorage.getItem(PENDING_ORDER_KEY);
    if (!order) return null;
    
    const parsed = JSON.parse(order);
    // Expire after 24 hours
    const savedAt = new Date(parsed.savedAt);
    const now = new Date();
    if (now - savedAt > 24 * 60 * 60 * 1000) {
      clearPendingOrder();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearPendingOrder = () => {
  localStorage.removeItem(PENDING_ORDER_KEY);
};
