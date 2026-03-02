import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, UtensilsCrossed, ClipboardList, TrendingUp, Users, Calendar } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { getExperiences, getMenuItems, getLogs } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    experiences: 0,
    menuItems: 0,
    recentLogs: [],
    todayOrders: 0,
    todayBookings: 0,
    todayRequests: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [experiences, menuItems, logs] = await Promise.all([
          getExperiences(false),
          getMenuItems(null, false),
          getLogs(null, 20),
        ]);

        // Count today's submissions
        const today = new Date().toDateString();
        const todayLogs = logs.filter((log) => {
          const logDate = new Date(log.created_at).toDateString();
          return logDate === today;
        });

        setStats({
          experiences: experiences.length,
          menuItems: menuItems.length,
          recentLogs: logs.slice(0, 5),
          todayOrders: todayLogs.filter((l) => l.type === "order").length,
          todayBookings: todayLogs.filter((l) => l.type === "booking").length,
          todayRequests: todayLogs.filter((l) => l.type === "request").length,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const quickStats = [
    { label: "Experiences", value: stats.experiences, icon: Compass, color: "text-[#2A9D8F]", bg: "bg-[#2A9D8F]/10" },
    { label: "Menu Items", value: stats.menuItems, icon: UtensilsCrossed, color: "text-[#E9C46A]", bg: "bg-[#E9C46A]/10" },
    { label: "Today's Orders", value: stats.todayOrders, icon: ClipboardList, color: "text-[#E76F51]", bg: "bg-[#E76F51]/10" },
    { label: "Today's Bookings", value: stats.todayBookings, icon: Calendar, color: "text-[#264653]", bg: "bg-[#264653]/10" },
  ];

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
      case "booking": return "Experience Booking";
      case "request": return "Guest Request";
      default: return type;
    }
  };

  return (
    <AdminLayout>
      <div data-testid="admin-dashboard">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-[#264653] mb-2">Dashboard</h1>
          <p className="text-[#6B705C]">Welcome back! Here's what's happening today.</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <Card key={i} className="rounded-2xl border-[#E0DCD3]">
                <CardContent className="p-6">
                  <Skeleton className="h-12 w-12 rounded-xl mb-4" />
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))
          ) : (
            quickStats.map((stat) => (
              <Card key={stat.label} className="rounded-2xl border-[#E0DCD3] hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center mb-4`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <p className="text-3xl font-bold text-[#264653]">{stat.value}</p>
                  <p className="text-[#6B705C] text-sm">{stat.label}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Recent Activity */}
        <Card className="rounded-2xl border-[#E0DCD3]">
          <CardHeader className="border-b border-[#E0DCD3] pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-xl text-[#264653]">Recent Activity</CardTitle>
              <button
                onClick={() => navigate("/admin/logs")}
                className="text-[#2A9D8F] text-sm font-semibold hover:underline"
                data-testid="view-all-logs"
              >
                View All
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats.recentLogs.length === 0 ? (
              <div className="p-12 text-center">
                <ClipboardList className="w-12 h-12 text-[#E0DCD3] mx-auto mb-4" />
                <p className="text-[#6B705C]">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E0DCD3]">
                {stats.recentLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-[#F9F7F2] transition-colors" data-testid={`log-item-${log.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-[#264653]">{log.guest_name}</span>
                          <span className="text-[#6B705C] text-sm">• Room {log.room_number}</span>
                        </div>
                        <p className="text-[#6B705C] text-sm">
                          {getTypeLabel(log.type)}
                          {log.type === "booking" && log.experience_title && `: ${log.experience_title}`}
                          {log.type === "order" && log.items && `: ${log.items.length} items`}
                          {log.type === "request" && log.category && `: ${log.category}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`status-badge ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                        <p className="text-[#6B705C] text-xs mt-1">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
