import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";

// Guest Pages
import GuestHome from "@/pages/guest/GuestHome";
import ExperiencesList from "@/pages/guest/ExperiencesList";
import ExperienceDetail from "@/pages/guest/ExperienceDetail";
import FoodMenu from "@/pages/guest/FoodMenu";
import Cart from "@/pages/guest/Cart";
import Requests from "@/pages/guest/Requests";

// Staff Pages
import StaffLogin from "@/pages/staff/StaffLogin";
import StaffDashboard from "@/pages/staff/StaffDashboard";

// Admin Pages
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminExperiences from "@/pages/admin/AdminExperiences";
import AdminMenu from "@/pages/admin/AdminMenu";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminLogs from "@/pages/admin/AdminLogs";
import AdminProperties from "@/pages/admin/AdminProperties";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminPropertyInfo from "@/pages/admin/AdminPropertyInfo";
import AdminQRCodes from "@/pages/admin/AdminQRCodes";
import AdminCategorySettings from "@/pages/admin/AdminCategorySettings";
import AdminReports from "@/pages/admin/AdminReports";
import AdminMessageTemplates from "@/pages/admin/AdminMessageTemplates";

// Shared Pages
import ForgotPassword from "@/pages/ForgotPassword";

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <BrowserRouter>
          <Routes>
            {/* Guest Routes - Property URL patterns */}
            <Route path="/" element={<GuestHome />} />
            <Route path="/VaranasiHostel" element={<GuestHome />} />
            <Route path="/DarjeelingHostel" element={<GuestHome />} />
            <Route path="/DarjeelingHome" element={<GuestHome />} />
            
            <Route path="/experiences" element={<ExperiencesList />} />
            <Route path="/experiences/:id" element={<ExperienceDetail />} />
            <Route path="/food" element={<FoodMenu />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/requests" element={<Requests />} />
            
            {/* Staff Routes */}
            <Route path="/staff/login" element={<StaffLogin />} />
            <Route path="/staff/dashboard" element={<StaffDashboard />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/properties" element={<AdminProperties />} />
            <Route path="/admin/experiences" element={<AdminExperiences />} />
            <Route path="/admin/menu" element={<AdminMenu />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/logs" element={<AdminLogs />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/property-info" element={<AdminPropertyInfo />} />
            <Route path="/admin/qr-codes" element={<AdminQRCodes />} />
            <Route path="/admin/category-settings" element={<AdminCategorySettings />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/message-templates" element={<AdminMessageTemplates />} />
            
            {/* Shared Routes */}
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </div>
    </ErrorBoundary>
  );
}

export default App;
