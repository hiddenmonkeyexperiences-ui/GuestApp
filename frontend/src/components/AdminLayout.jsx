import { useNavigate, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Compass, 
  UtensilsCrossed, 
  Settings, 
  ClipboardList,
  LogOut,
  Menu,
  X,
  Building2,
  Users,
  Info,
  QrCode,
  Clock,
  FileBarChart,
  MessageSquare
} from "lucide-react";
import { logoutAdmin, isAdminAuthenticated } from "@/lib/store";
import { useEffect, useState } from "react";

export const AdminLayout = ({ children, title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      navigate("/admin");
    }
  }, [navigate]);

  const navItems = [
    { path: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/admin/properties", icon: Building2, label: "Properties" },
    { path: "/admin/experiences", icon: Compass, label: "Experiences" },
    { path: "/admin/menu", icon: UtensilsCrossed, label: "Menu" },
    { path: "/admin/category-settings", icon: Clock, label: "Timings" },
    { path: "/admin/logs", icon: ClipboardList, label: "Logs" },
    { path: "/admin/reports", icon: FileBarChart, label: "Reports" },
    { path: "/admin/users", icon: Users, label: "Staff" },
    { path: "/admin/property-info", icon: Info, label: "Guest Info" },
    { path: "/admin/qr-codes", icon: QrCode, label: "QR Codes" },
    { path: "/admin/message-templates", icon: MessageSquare, label: "Messages" },
    { path: "/admin/settings", icon: Settings, label: "Settings" },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logoutAdmin();
    navigate("/admin");
  };

  return (
    <div className="min-h-screen bg-[#FBF9F6] flex">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-xl bg-[#0D7377] text-white md:hidden shadow-lg"
        data-testid="admin-mobile-menu"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside 
        className={`admin-sidebar fixed md:static inset-y-0 left-0 z-40 transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 transition-transform duration-300`}
        data-testid="admin-sidebar"
      >
        {/* Logo */}
        <div className="mb-6 pt-2 flex flex-col items-center">
          <img 
            src={mascotBase64} 
            alt="Hidden Monkey" 
            className="w-14 h-14 object-contain"
          />
          <h1 className="text-xl text-white font-bold mt-3" style={{fontFamily: "'Quicksand', sans-serif"}}>
            Hidden Monkey
          </h1>
          <p className="text-white/60 text-xs tracking-wider">Admin Portal</p>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setSidebarOpen(false);
              }}
              className={`admin-nav-item ${isActive(item.path) ? "active" : ""}`}
              data-testid={`admin-nav-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="mt-auto pt-8">
          <button
            onClick={handleLogout}
            className="admin-nav-item w-full text-white/70 hover:text-[#FFC107]"
            data-testid="admin-logout"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 ml-0 md:ml-0">
        <div className="max-w-6xl mx-auto">
          {title && (
            <h1 className="text-2xl font-bold text-[#0D7377] mb-6" style={{fontFamily: "'Quicksand', sans-serif"}}>{title}</h1>
          )}
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
