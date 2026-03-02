import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Minus, Leaf, ShoppingCart, WifiOff, RefreshCw } from "lucide-react";
import GuestLayout from "@/components/GuestLayout";
import { getMenuItems } from "@/lib/api";
import { getPropertyId, addToCart, getCart, updateCartQuantity } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function FoodMenu() {
  const navigate = useNavigate();
  const propertyId = getPropertyId();
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [networkError, setNetworkError] = useState(false);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    setNetworkError(false);
    try {
      const data = await getMenuItems(propertyId);
      setMenuItems(data);
    } catch (error) {
      console.error("Error fetching menu:", error);
      if (error.isNetworkError) {
        setNetworkError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchMenu();
    setCart(getCart());
  }, [fetchMenu]);

  const categories = ["all", ...new Set(menuItems.map((item) => item.category))];
  
  const filteredItems = activeCategory === "all"
    ? menuItems
    : menuItems.filter((item) => item.category === activeCategory);

  const getItemQuantity = (itemId) => {
    const cartItem = cart.find((i) => i.id === itemId);
    return cartItem ? cartItem.quantity : 0;
  };

  const handleAddToCart = (item) => {
    const newCart = addToCart(item);
    setCart(newCart);
    window.dispatchEvent(new Event("cartUpdated"));
    toast.success(`${item.name} added to cart`);
  };

  const handleUpdateQuantity = (itemId, quantity) => {
    const newCart = updateCartQuantity(itemId, quantity);
    setCart(newCart);
    window.dispatchEvent(new Event("cartUpdated"));
  };

  return (
    <GuestLayout>
      <div className="min-h-screen" data-testid="food-menu">
        {/* Network Error Banner */}
        {networkError && (
          <div className="bg-red-500 text-white px-4 py-3 flex items-center justify-between" data-testid="network-error-banner">
            <div className="flex items-center gap-2">
              <WifiOff className="w-5 h-5" />
              <span className="font-medium">Poor Network Connection</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-red-600"
              onClick={fetchMenu}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="page-header bg-white border-b border-[#E0DCD3]">
          <button
            onClick={() => navigate(`/?property=${propertyId}`)}
            className="flex items-center gap-2 text-[#6B705C] mb-4 hover:text-[#2A9D8F] transition-colors"
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 data-testid="page-title">Food & Drinks</h1>
          <p>Fresh, local, delicious</p>
        </div>

        {/* Categories */}
        <div className="px-6 py-4 overflow-x-auto bg-white sticky top-0 z-20 border-b border-[#E0DCD3]">
          <div className="flex gap-3" data-testid="category-filters">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`category-pill whitespace-nowrap capitalize ${
                  activeCategory === category ? "active" : ""
                }`}
                data-testid={`category-${category}`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Grid */}
        <div className="p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-4 p-4 bg-white rounded-2xl">
                  <Skeleton className="w-24 h-24 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-12 h-12 text-[#E9C46A] mx-auto mb-4" />
              <p className="text-[#6B705C]">No items available in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {filteredItems.map((item) => {
                const quantity = getItemQuantity(item.id);
                
                return (
                  <div
                    key={item.id}
                    className="flex gap-4 p-4 bg-white rounded-2xl border border-[#E0DCD3]/50 shadow-[0_4px_20px_rgba(0,0,0,0.03)] animate-fade-in"
                    data-testid={`menu-item-${item.id}`}
                  >
                    {/* Image */}
                    {item.image_url && (
                      <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-[#264653]">
                          {item.name}
                          {item.is_vegetarian && (
                            <Leaf className="inline w-4 h-4 ml-1 text-green-600" />
                          )}
                        </h3>
                      </div>
                      
                      <p className="text-[#6B705C] text-sm mt-1 line-clamp-2 flex-1">
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between mt-3">
                        <span className="font-bold text-[#2A9D8F]">
                          ₹{item.price}
                        </span>

                        {quantity === 0 ? (
                          <Button
                            size="sm"
                            className="rounded-xl bg-[#2A9D8F] hover:bg-[#238a7e] text-white px-4"
                            onClick={() => handleAddToCart(item)}
                            data-testid={`add-to-cart-${item.id}`}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2 bg-[#F0EFEB] rounded-xl p-1">
                            <button
                              onClick={() => handleUpdateQuantity(item.id, quantity - 1)}
                              className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#264653] hover:bg-[#E0DCD3] transition-colors"
                              data-testid={`decrease-${item.id}`}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-semibold text-[#264653]" data-testid={`quantity-${item.id}`}>
                              {quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, quantity + 1)}
                              className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#264653] hover:bg-[#E0DCD3] transition-colors"
                              data-testid={`increase-${item.id}`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </GuestLayout>
  );
}
