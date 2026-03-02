import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { adminAuth } from "@/lib/api";
import { setAdminAuthenticated } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!password) {
      toast.error("Please enter the password");
      return;
    }

    setLoading(true);
    try {
      await adminAuth(password);
      setAdminAuthenticated(true);
      toast.success("Welcome to Admin Portal");
      navigate("/admin/dashboard");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Invalid password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen hm-gradient-bg flex items-center justify-center p-6 relative overflow-hidden" data-testid="admin-login">
      {/* Decorative circles */}
      <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] rounded-full bg-white/5"></div>
      <div className="absolute bottom-[-150px] left-[-150px] w-[400px] h-[400px] rounded-full bg-white/5"></div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo & Mascot */}
        <div className="text-center mb-6">
          <img 
            src="/mascot.png" 
            alt="Hidden Monkey Stays" 
            className="w-28 h-28 mx-auto object-contain mascot-float"
          />
          <h1 className="font-bold text-3xl text-white mt-4 tracking-wide" style={{fontFamily: "'Quicksand', sans-serif"}}>
            HIDDEN MONKEY STAYS
          </h1>
          <p className="text-white/70 text-sm tracking-widest mt-1">EXPLORE | CONNECT | BELONG</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
          <div className="text-center mb-6">
            <h2 className="text-2xl text-[#0D7377] font-bold" style={{fontFamily: "'Quicksand', sans-serif"}}>
              Admin Portal
            </h2>
            <p className="text-[#636E72] text-sm mt-1">
              Enter your password to continue
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="password" className="text-[#2D3436] font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="hm-input mt-1"
                placeholder="Enter admin password"
                data-testid="login-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full btn-primary h-12 text-base"
              disabled={loading}
              data-testid="login-submit"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#E8E4D9]">
            <p className="text-center text-[#636E72] text-sm">
              Default: <code className="bg-[#F5F0E8] px-2 py-1 rounded text-[#0D7377]">hiddenmonkey2024</code>
            </p>
            
            <div className="text-center mt-3">
              <Link 
                to="/forgot-password?return=/admin&username=admin" 
                className="text-[#E76F51] text-sm hover:underline font-medium"
                data-testid="forgot-password-link"
              >
                Forgot Password?
              </Link>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <p className="text-center text-white/50 text-xs mt-6">
          www.hiddenmonkeystays.com
        </p>
      </div>
    </div>
  );
}
