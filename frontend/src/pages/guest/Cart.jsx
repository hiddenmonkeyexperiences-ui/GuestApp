import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, Send, WifiOff, RefreshCw } from "lucide-react";
import GuestLayout from "@/components/GuestLayout";
import { createOrder, getSettings, generateWhatsAppLink } from "@/lib/api";
import { 
  getPropertyId, 
  getCart, 
  updateCartQuantity, 
  removeFromCart, 
  clearCart, 
  getCartTotal,
  getGuestInfo,
  setGuestInfo,
  savePendingOrder,
  getPendingOrder,
  clearPendingOrder
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Cart() {
  const navigate = useNavigate();
  const propertyId = getPropertyId();
  const [cart, setCart] = useState([]);
  const [settings, setSettings] = useState(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);

  const savedInfo = getGuestInfo();
  const [formData, setFormData] = useState({
    guest_name: savedInfo.name || "",
    room_number: savedInfo.room || "",
    whatsapp: savedInfo.whatsapp || "",
    notes: "",
  });

  useEffect(() => {
    setCart(getCart());
    
    // Check for pending order (crash recovery)
    const pending = getPendingOrder();
    if (pending) {
      setPendingOrder(pending);
      toast.info("You have a pending order. Would you like to retry?", {
        duration: 8000,
      });
    }
    
    const fetchSettings = async () => {
      try {
        const data = await getSettings(propertyId);
        setSettings(data);
        setNetworkError(false);
      } catch (error) {
        console.error("Error fetching settings:", error);
        if (error.isNetworkError) {
          setNetworkError(true);
        }
      }
    };
    fetchSettings();
  }, [propertyId]);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleUpdateQuantity = (itemId, quantity) => {
    const newCart = updateCartQuantity(itemId, quantity);
    setCart(newCart);
    window.dispatchEvent(new Event("cartUpdated"));
  };

  const handleRemove = (itemId) => {
    const newCart = removeFromCart(itemId);
    setCart(newCart);
    window.dispatchEvent(new Event("cartUpdated"));
    toast.success("Item removed from cart");
  };

  const handleRetryConnection = async () => {
    setNetworkError(false);
    try {
      const data = await getSettings(propertyId);
      setSettings(data);
      toast.success("Connection restored!");
    } catch (error) {
      if (error.isNetworkError) {
        setNetworkError(true);
      }
    }
  };

  const handleRetryPendingOrder = async () => {
    if (!pendingOrder) return;
    
    setSubmitting(true);
    try {
      await createOrder(pendingOrder);
      clearPendingOrder();
      setPendingOrder(null);
      clearCart();
      setCart([]);
      window.dispatchEvent(new Event("cartUpdated"));
      toast.success("Order placed successfully!");
      navigate(`/?property=${propertyId}`);
    } catch (error) {
      console.error("Error retrying order:", error);
      if (error.isNetworkError) {
        toast.error("Still no connection. Your order is saved locally.");
      } else {
        toast.error("Failed to place order. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearPendingOrder = () => {
    clearPendingOrder();
    setPendingOrder(null);
    toast.success("Pending order cleared");
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    if (!formData.guest_name || !formData.room_number || !formData.whatsapp) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Save guest info immediately
    setGuestInfo({
      name: formData.guest_name,
      room: formData.room_number,
      whatsapp: formData.whatsapp,
    });

    // Prepare order data
    const orderData = {
      guest_name: formData.guest_name,
      room_number: formData.room_number,
      whatsapp: formData.whatsapp,
      items: cart.map((item) => ({
        item_id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      total: total,
      property_id: propertyId,
      notes: formData.notes,
    };

    // Save as pending order before attempting (crash recovery)
    savePendingOrder(orderData);

    setSubmitting(true);
    try {
      // Create order in backend
      await createOrder(orderData);

      // Success - clear pending order
      clearPendingOrder();

      // Generate WhatsApp message
      const itemsList = cart.map((item) => 
        `  • ${item.name} x${item.quantity} - ₹${item.price * item.quantity}`
      ).join("\n");

      const message = `🍽️ *New Food Order*\n\n` +
        `*Guest:* ${formData.guest_name}\n` +
        `*Room:* ${formData.room_number}\n` +
        `*WhatsApp:* ${formData.whatsapp}\n\n` +
        `*Order:*\n${itemsList}\n\n` +
        `*Total:* ₹${total}\n` +
        `${formData.notes ? `\n*Notes:* ${formData.notes}` : ""}` +
        `\n\n_Sent via Hidden Monkey Stays_`;

      // Open WhatsApp
      if (settings?.staff_whatsapp) {
        const waLink = generateWhatsAppLink(settings.staff_whatsapp, message);
        window.open(waLink, "_blank");
      }

      // Clear cart
      clearCart();
      setCart([]);
      window.dispatchEvent(new Event("cartUpdated"));

      toast.success("Order placed! We'll deliver it to your room shortly.");
      setShowOrderForm(false);
      navigate(`/?property=${propertyId}`);
    } catch (error) {
      console.error("Error placing order:", error);
      if (error.isNetworkError) {
        toast.error("Network issue! Your order is saved. Retry when connected.", {
          duration: 6000,
        });
        setShowOrderForm(false);
        setPendingOrder(orderData);
      } else {
        toast.error("Failed to place order. Please try again.");
        // Keep pending order for retry
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GuestLayout>
      <div className="min-h-screen" data-testid="cart-page">
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
              onClick={handleRetryConnection}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {/* Pending Order Recovery Banner */}
        {pendingOrder && (
          <div className="bg-amber-500 text-white px-4 py-3" data-testid="pending-order-banner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <span className="font-medium">You have an unsent order (₹{pendingOrder.total})</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-white text-amber-600 hover:bg-amber-50"
                  onClick={handleRetryPendingOrder}
                  disabled={submitting}
                >
                  {submitting ? "Sending..." : "Retry Order"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-amber-600"
                  onClick={handleClearPendingOrder}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="page-header bg-white border-b border-[#E0DCD3]">
          <button
            onClick={() => navigate(`/food?property=${propertyId}`)}
            className="flex items-center gap-2 text-[#6B705C] mb-4 hover:text-[#2A9D8F] transition-colors"
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Menu</span>
          </button>
          <h1 data-testid="page-title">Your Cart</h1>
          <p>{cart.length} {cart.length === 1 ? "item" : "items"}</p>
        </div>

        {/* Cart Items */}
        <div className="p-6">
          {cart.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 text-[#E0DCD3] mx-auto mb-4" />
              <h3 className="font-serif text-2xl text-[#264653] mb-2">Your cart is empty</h3>
              <p className="text-[#6B705C] mb-6">Add some delicious items from our menu</p>
              <Button
                onClick={() => navigate(`/food?property=${propertyId}`)}
                className="btn-primary"
                data-testid="browse-menu"
              >
                Browse Menu
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-8">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#E0DCD3]/50"
                    data-testid={`cart-item-${item.id}`}
                  >
                    {/* Image */}
                    {item.image_url && (
                      <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-[#264653]">{item.name}</h3>
                      <p className="text-[#2A9D8F] font-bold">
                        ₹{item.price * item.quantity}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 bg-[#F0EFEB] rounded-xl p-1">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#264653] hover:bg-[#E0DCD3] transition-colors"
                          data-testid={`cart-decrease-${item.id}`}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-semibold text-[#264653]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#264653] hover:bg-[#E0DCD3] transition-colors"
                          data-testid={`cart-increase-${item.id}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemove(item.id)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-[#F9A825] hover:bg-[#F9A825]/10 transition-colors"
                        data-testid={`cart-remove-${item.id}`}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="bg-white rounded-2xl p-6 border border-[#E0DCD3]/50">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[#6B705C]">Subtotal</span>
                  <span className="font-semibold text-[#264653]">₹{total}</span>
                </div>
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#E0DCD3]">
                  <span className="text-[#264653] font-semibold">Total</span>
                  <span className="font-bold text-2xl text-[#2A9D8F]">₹{total}</span>
                </div>
                
                <Button
                  className="w-full btn-primary flex items-center justify-center gap-2"
                  onClick={() => setShowOrderForm(true)}
                  data-testid="place-order"
                >
                  <Send className="w-5 h-5" />
                  Place Order
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Order Form Dialog */}
        <Dialog open={showOrderForm} onOpenChange={setShowOrderForm}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-[#264653]">
                Complete Your Order
              </DialogTitle>
              <DialogDescription className="text-[#6B705C]">
                Fill in your details for delivery
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handlePlaceOrder} className="space-y-4 mt-4" data-testid="order-form">
              <div>
                <Label htmlFor="guest_name" className="text-[#264653]">Your Name *</Label>
                <Input
                  id="guest_name"
                  value={formData.guest_name}
                  onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                  className="hm-input mt-1"
                  placeholder="John Doe"
                  required
                  data-testid="order-input-guest-name"
                />
              </div>

              <div>
                <Label htmlFor="room_number" className="text-[#264653]">Room Number *</Label>
                <Input
                  id="room_number"
                  value={formData.room_number}
                  onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                  className="hm-input mt-1"
                  placeholder="101"
                  required
                  data-testid="order-input-room-number"
                />
              </div>

              <div>
                <Label htmlFor="whatsapp" className="text-[#264653]">WhatsApp Number *</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  className="hm-input mt-1"
                  placeholder="+91 98765 43210"
                  required
                  data-testid="order-input-whatsapp"
                />
              </div>

              <div>
                <Label htmlFor="notes" className="text-[#264653]">Special Instructions</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="hm-input mt-1 min-h-[80px]"
                  placeholder="Any dietary requirements or preferences..."
                  data-testid="order-input-notes"
                />
              </div>

              <div className="pt-2">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[#264653] font-semibold">Order Total</span>
                  <span className="font-bold text-xl text-[#2A9D8F]">₹{total}</span>
                </div>
                
                <Button
                  type="submit"
                  className="w-full btn-primary"
                  disabled={submitting}
                  data-testid="submit-order"
                >
                  {submitting ? "Placing Order..." : "Confirm & Send Order"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </GuestLayout>
  );
}
