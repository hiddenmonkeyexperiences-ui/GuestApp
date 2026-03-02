import { useEffect, useState } from "react";
import { ClipboardList, MessageCircle, RefreshCw } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { getLogs, updateRequestStatus, updateBookingStatus, updateOrderStatus, generateWhatsAppLink, getSettings, getProperties } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      fetchLogs();
      fetchSettings();
    }
  }, [selectedProperty]);

  const fetchProperties = async () => {
    try {
      const data = await getProperties();
      setProperties(data);
      if (data.length > 0) {
        setSelectedProperty(data[0].property_id);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getLogs(selectedProperty, 100);
      setLogs(data);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await getSettings(selectedProperty);
      setSettings(data);
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (typeFilter !== "all" && log.type !== typeFilter) return false;
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    return true;
  });

  const updateStatus = async (log, newStatus) => {
    try {
      if (log.type === "request") {
        await updateRequestStatus(log.id, newStatus);
      } else if (log.type === "booking") {
        await updateBookingStatus(log.id, newStatus);
      } else if (log.type === "order") {
        await updateOrderStatus(log.id, newStatus);
      }
      
      toast.success("Status updated");
      fetchLogs();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const openGuestWhatsApp = (whatsapp, guestName) => {
    const message = `Hi ${guestName}, this is Hidden Monkey Stays. `;
    const link = generateWhatsAppLink(whatsapp, message);
    window.open(link, "_blank");
  };

  const getStatusOptions = (type) => {
    if (type === "order") {
      return ["pending", "preparing", "delivered"];
    }
    return ["pending", "in_progress", "completed"];
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return "status-pending";
      case "in_progress":
      case "preparing": return "status-in_progress";
      case "completed":
      case "delivered": return "status-completed";
      default: return "status-pending";
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case "order": return "Food Order";
      case "booking": return "Booking";
      case "request": return "Request";
      default: return type;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "order": return "bg-[#E76F51]/10 text-[#E76F51]";
      case "booking": return "bg-[#2A9D8F]/10 text-[#2A9D8F]";
      case "request": return "bg-[#E9C46A]/10 text-[#E9C46A]";
      default: return "bg-[#6B705C]/10 text-[#6B705C]";
    }
  };

  return (
    <AdminLayout>
      <div data-testid="admin-logs">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl text-[#264653] mb-2">Activity Logs</h1>
            <p className="text-[#6B705C]">Track all guest submissions and their status</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Property Selector */}
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="w-48 rounded-xl border-[#E0DCD3]" data-testid="logs-property-selector">
                <SelectValue placeholder="Select Property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.property_id} value={p.property_id}>
                    {p.property_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={fetchLogs} 
              variant="outline" 
              className="flex items-center gap-2 rounded-xl border-[#E0DCD3]"
              data-testid="refresh-logs"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-[#6B705C] text-sm">Type:</span>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36 rounded-xl border-[#E0DCD3]" data-testid="filter-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="order">Orders</SelectItem>
                <SelectItem value="booking">Bookings</SelectItem>
                <SelectItem value="request">Requests</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[#6B705C] text-sm">Status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 rounded-xl border-[#E0DCD3]" data-testid="filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Logs List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="rounded-2xl border-[#E0DCD3]">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-1/3 mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#E0DCD3]">
            <ClipboardList className="w-12 h-12 text-[#E0DCD3] mx-auto mb-4" />
            <p className="text-[#6B705C]">No logs found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <Card key={log.id} className="rounded-2xl border-[#E0DCD3] overflow-hidden" data-testid={`log-card-${log.id}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    {/* Type & Basic Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(log.type)}`}>
                          {getTypeLabel(log.type)}
                        </span>
                        <span className={`status-badge ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </div>
                      
                      <h3 className="font-semibold text-[#264653] text-lg">
                        {log.guest_name} • Room {log.room_number}
                      </h3>
                      
                      <p className="text-[#6B705C] text-sm mt-1">
                        {new Date(log.created_at).toLocaleString()}
                      </p>

                      {/* Details based on type */}
                      <div className="mt-3 p-3 bg-[#F9F7F2] rounded-xl">
                        {log.type === "booking" && (
                          <p className="text-[#264653]">
                            <strong>Experience:</strong> {log.experience_title}
                            {log.notes && <><br /><strong>Notes:</strong> {log.notes}</>}
                          </p>
                        )}
                        {log.type === "order" && (
                          <div>
                            <p className="text-[#264653] font-semibold mb-2">Order Items:</p>
                            {log.items?.map((item, idx) => (
                              <p key={idx} className="text-[#6B705C] text-sm">
                                • {item.name} x{item.quantity} - ₹{item.price * item.quantity}
                              </p>
                            ))}
                            <p className="text-[#2A9D8F] font-bold mt-2">Total: ₹{log.total}</p>
                            {log.notes && <p className="text-[#6B705C] mt-2"><strong>Notes:</strong> {log.notes}</p>}
                          </div>
                        )}
                        {log.type === "request" && (
                          <p className="text-[#264653]">
                            <strong>Category:</strong> {log.category}
                            <br />
                            <strong>Message:</strong> {log.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-row md:flex-col gap-2 md:min-w-[160px]">
                      <Select 
                        value={log.status} 
                        onValueChange={(value) => updateStatus(log, value)}
                      >
                        <SelectTrigger className="rounded-xl border-[#E0DCD3]" data-testid={`status-select-${log.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getStatusOptions(log.type).map((status) => (
                            <SelectItem key={status} value={status} className="capitalize">
                              {status.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        className="whatsapp-btn text-sm"
                        onClick={() => openGuestWhatsApp(log.whatsapp, log.guest_name)}
                        data-testid={`whatsapp-${log.id}`}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span className="hidden md:inline">Message Guest</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
