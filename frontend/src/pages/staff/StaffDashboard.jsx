import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/lib/api";
import { LogOut, RefreshCw, CheckCircle, XCircle, Clock, Truck } from "lucide-react";

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyId = searchParams.get("property") || "varanasi";
  
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("orders");

  useEffect(() => {
    const staffUser = localStorage.getItem("staffUser");
    if (!staffUser) {
      navigate(`/staff/login?property=${propertyId}`);
      return;
    }
    setUser(JSON.parse(staffUser));
    fetchData();
  }, [propertyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, bookingsRes, requestsRes] = await Promise.all([
        api.get(`/orders?property_id=${propertyId}`),
        api.get(`/bookings?property_id=${propertyId}`),
        api.get(`/requests?property_id=${propertyId}`)
      ]);
      setOrders(ordersRes.data);
      setBookings(bookingsRes.data);
      setRequests(requestsRes.data);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("staffUser");
    navigate(`/?property=${propertyId}`);
  };

  const updateStatus = async (type, id, status) => {
    try {
      await api.put(`/${type}/${id}/status?status=${status}`);
      toast.success(`Status updated to ${status}`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-blue-100 text-blue-800",
      paid: "bg-green-100 text-green-800",
      delivered: "bg-emerald-100 text-emerald-800",
      rejected: "bg-red-100 text-red-800"
    };
    return <Badge className={colors[status] || "bg-gray-100"}>{status}</Badge>;
  };

  const renderOrders = () => (
    <div className="space-y-4">
      {orders.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No orders yet</p>
      ) : (
        orders.map((order) => (
          <Card key={order.id} className="border-l-4 border-l-[#FFC107]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold">{order.guest_name} - Room {order.room_number}</p>
                  <p className="text-sm text-gray-500">{order.id.slice(0, 8).toUpperCase()}</p>
                </div>
                {getStatusBadge(order.status)}
              </div>
              <div className="text-sm mb-2">
                {order.items?.map((item, i) => (
                  <p key={i}>{item.name} x{item.quantity} - ₹{item.price * item.quantity}</p>
                ))}
                <p className="font-semibold mt-1">Total: ₹{order.total}</p>
              </div>
              {user?.role === "kitchen" && order.status === "pending" && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => updateStatus("orders", order.id, "approved")} className="bg-green-600">
                    <CheckCircle className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => updateStatus("orders", order.id, "rejected")}>
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
              {user?.role === "kitchen" && order.status === "paid" && (
                <Button size="sm" onClick={() => updateStatus("orders", order.id, "delivered")} className="bg-emerald-600 mt-3">
                  <Truck className="w-4 h-4 mr-1" /> Mark Delivered
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const renderBookings = () => (
    <div className="space-y-4">
      {bookings.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No bookings yet</p>
      ) : (
        bookings.map((booking) => (
          <Card key={booking.id} className="border-l-4 border-l-[#2A9D8F]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold">{booking.experience_title}</p>
                  <p className="text-sm">{booking.guest_name} - Room {booking.room_number}</p>
                </div>
                {getStatusBadge(booking.status)}
              </div>
              {user?.role === "kitchen" && booking.status === "pending" && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => updateStatus("bookings", booking.id, "approved")} className="bg-green-600">
                    <CheckCircle className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => updateStatus("bookings", booking.id, "rejected")}>
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const renderRequests = () => (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No requests yet</p>
      ) : (
        requests.map((req) => (
          <Card key={req.id} className="border-l-4 border-l-[#F9A825]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold">{req.category}</p>
                  <p className="text-sm">{req.guest_name} - Room {req.room_number}</p>
                </div>
                {getStatusBadge(req.status)}
              </div>
              <p className="text-sm text-gray-600 mt-2">{req.message}</p>
              {user?.role === "kitchen" && req.status === "pending" && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => updateStatus("requests", req.id, "approved")} className="bg-green-600">
                    <CheckCircle className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => updateStatus("requests", req.id, "rejected")}>
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      {/* Header */}
      <header className="bg-[#264653] text-white p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold">Staff Dashboard</h1>
            <p className="text-sm opacity-80">{user.username} ({user.role})</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={fetchData} className="text-white">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleLogout} className="text-white">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex gap-2 mb-4 overflow-x-auto">
          <Button
            variant={activeTab === "orders" ? "default" : "outline"}
            onClick={() => setActiveTab("orders")}
            className={activeTab === "orders" ? "bg-[#FFC107]" : ""}
          >
            Orders ({orders.filter(o => o.status === "pending" || o.status === "paid").length})
          </Button>
          <Button
            variant={activeTab === "bookings" ? "default" : "outline"}
            onClick={() => setActiveTab("bookings")}
            className={activeTab === "bookings" ? "bg-[#2A9D8F]" : ""}
          >
            Bookings ({bookings.filter(b => b.status === "pending").length})
          </Button>
          <Button
            variant={activeTab === "requests" ? "default" : "outline"}
            onClick={() => setActiveTab("requests")}
            className={activeTab === "requests" ? "bg-[#F9A825]" : ""}
          >
            Requests ({requests.filter(r => r.status === "pending").length})
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <>
            {activeTab === "orders" && renderOrders()}
            {activeTab === "bookings" && renderBookings()}
            {activeTab === "requests" && renderRequests()}
          </>
        )}
      </div>
    </div>
  );
}
