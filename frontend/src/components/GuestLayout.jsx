import { useNavigate, useLocation } from "react-router-dom";
import { Home, Compass, UtensilsCrossed, MessageSquare, ShoppingCart } from "lucide-react";
import { getCartCount, getPropertyId } from "@/lib/store";
import { useEffect, useState } from "react";

export const GuestLayout = ({ children, showNav = true }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [cartCount, setCartCount] = useState(0);
  const propertyId = getPropertyId();

  useEffect(() => {
    const updateCartCount = () => {
      setCartCount(getCartCount());
    };
    
    updateCartCount();
    window.addEventListener("storage", updateCartCount);
    
    // Custom event for cart updates
    window.addEventListener("cartUpdated", updateCartCount);
    
    return () => {
      window.removeEventListener("storage", updateCartCount);
      window.removeEventListener("cartUpdated", updateCartCount);
    };
  }, []);

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/experiences", icon: Compass, label: "Explore" },
    { path: "/food", icon: UtensilsCrossed, label: "Food" },
    { path: "/requests", icon: MessageSquare, label: "Request" },
  ];

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-[#FBF9F6]">
      {/* Main Content */}
      <main className={showNav ? "pb-24" : ""}>
        {children}
      </main>

      {/* Floating Bottom Navigation */}
      {showNav && (
        <nav className="floating-dock" data-testid="guest-nav">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(`${item.path}${propertyId ? `?property=${propertyId}` : ""}`)}
              className={`dock-item ${isActive(item.path) ? "active" : ""}`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
          
          {/* Cart Button */}
          <button
            onClick={() => navigate(`/cart${propertyId ? `?property=${propertyId}` : ""}`)}
            className={`dock-item relative ${location.pathname === "/cart" ? "active" : ""}`}
            data-testid="nav-cart"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="text-xs">Cart</span>
            {cartCount > 0 && (
              <span className="cart-badge" data-testid="cart-count">{cartCount}</span>
            )}
          </button>
        </nav>
      )}
    </div>
  );
};

export default GuestLayout;
