import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import api from "@/lib/api";

export default function StaffLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyId = searchParams.get("property") || "varanasi";
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await api.post("/auth/login", { username, password });
      if (response.data.success) {
        const user = response.data.user;
        localStorage.setItem("staffUser", JSON.stringify(user));
        
        toast.success(`Welcome, ${user.username}!`);
        
        // Redirect based on role
        if (user.role === "admin") {
          navigate("/admin/dashboard");
        } else {
          navigate(`/staff/dashboard?property=${user.property_id || propertyId}`);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F7F2] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-[#264653]">Staff Login</CardTitle>
          <p className="text-sm text-gray-500 mt-2">Hidden Monkey Stays</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                data-testid="staff-username-input"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="staff-password-input"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#2A9D8F] hover:bg-[#238b7e]"
              disabled={loading}
              data-testid="staff-login-btn"
            >
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
          
          <div className="mt-4 text-center space-y-2">
            <Link
              to={`/forgot-password?return=/staff/login&username=${username || ''}`}
              className="text-sm text-[#E9C46A] hover:underline block"
              data-testid="staff-forgot-password"
            >
              Forgot Password?
            </Link>
            <a
              href={`/?property=${propertyId}`}
              className="text-sm text-[#2A9D8F] hover:underline block"
            >
              Back to Guest Portal
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
