import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, ArrowLeft, Send, ShieldCheck } from "lucide-react";
import { requestOTP, verifyOTPAndResetPassword, resendOTP } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("return") || "/admin";
  const prefilledUsername = searchParams.get("username") || "";
  
  const [step, setStep] = useState(1); // 1: Enter username, 2: Enter OTP & new password
  const [username, setUsername] = useState(prefilledUsername);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const startCountdown = () => {
    setCanResend(false);
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast.error("Please enter your username");
      return;
    }

    setLoading(true);
    try {
      const result = await requestOTP(username.trim());
      toast.success(result.message);
      setStep(2);
      startCountdown();
    } catch (error) {
      console.error("OTP request error:", error);
      toast.error(error.response?.data?.detail || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      const result = await resendOTP(username.trim());
      toast.success(result.message);
      startCountdown();
    } catch (error) {
      console.error("Resend OTP error:", error);
      toast.error(error.response?.data?.detail || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (!otp.trim()) {
      toast.error("Please enter the OTP");
      return;
    }
    
    if (otp.length !== 6) {
      toast.error("OTP must be 6 digits");
      return;
    }

    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await verifyOTPAndResetPassword(username.trim(), otp.trim(), newPassword);
      toast.success("Password reset successfully!");
      navigate(returnTo);
    } catch (error) {
      console.error("Reset password error:", error);
      toast.error(error.response?.data?.detail || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen hm-gradient-bg flex items-center justify-center p-6 relative overflow-hidden" data-testid="forgot-password">
      {/* Decorative circles */}
      <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] rounded-full bg-white/5"></div>
      <div className="absolute bottom-[-150px] left-[-150px] w-[400px] h-[400px] rounded-full bg-white/5"></div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-6">
          <img 
            src={mascotBase64} 
            alt="Hidden Monkey Stays" 
            className="w-20 h-20 mx-auto object-contain"
          />
          <h1 className="font-bold text-2xl text-white mt-3 tracking-wide" style={{fontFamily: "'Quicksand', sans-serif"}}>
            Password Reset
          </h1>
        </div>

        {/* Reset Card */}
        <div className="bg-white rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
          <div className="w-14 h-14 rounded-2xl bg-[#FFC107]/20 flex items-center justify-center mx-auto mb-5">
            {step === 1 ? (
              <KeyRound className="w-7 h-7 text-[#FFC107]" />
            ) : (
              <ShieldCheck className="w-7 h-7 text-[#0D7377]" />
            )}
          </div>

          {step === 1 ? (
            <>
              <h2 className="text-xl text-[#0D7377] text-center mb-2 font-bold" style={{fontFamily: "'Quicksand', sans-serif"}}>
                Forgot Password?
              </h2>
              <p className="text-[#636E72] text-center mb-6 text-sm">
                Enter your username and we'll send an OTP to your registered WhatsApp
              </p>

              <form onSubmit={handleRequestOTP} className="space-y-4" data-testid="otp-request-form">
                <div>
                  <Label htmlFor="username" className="text-[#2D3436] font-medium">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="hm-input mt-1"
                    placeholder="Enter your username (e.g., admin, staff1)"
                    data-testid="otp-username"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full btn-primary h-11"
                  disabled={loading}
                  data-testid="otp-request-submit"
                >
                  {loading ? (
                    "Sending OTP..."
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send OTP via WhatsApp
                    </>
                  )}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl text-[#0D7377] text-center mb-2 font-bold" style={{fontFamily: "'Quicksand', sans-serif"}}>
                Enter OTP
              </h2>
              <p className="text-[#636E72] text-center mb-6 text-sm">
                Check your WhatsApp for the 6-digit OTP
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4" data-testid="otp-verify-form">
                <div>
                  <Label htmlFor="otp" className="text-[#2D3436] font-medium">OTP Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="hm-input mt-1 text-center text-2xl tracking-[0.5em]"
                    placeholder="000000"
                    maxLength={6}
                    data-testid="otp-code"
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword" className="text-[#2D3436] font-medium">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="hm-input mt-1"
                    placeholder="Enter new password"
                    data-testid="otp-new-password"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-[#2D3436] font-medium">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="hm-input mt-1"
                    placeholder="Confirm new password"
                    data-testid="otp-confirm-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full btn-primary h-11"
                  disabled={loading}
                  data-testid="otp-verify-submit"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={!canResend || loading}
                    className="text-[#0D7377] text-sm hover:underline disabled:opacity-50 disabled:no-underline"
                    data-testid="otp-resend"
                  >
                    {countdown > 0 ? `Resend OTP in ${countdown}s` : "Resend OTP"}
                  </button>
                </div>
              </form>
            </>
          )}

          <div className="mt-6 pt-4 border-t border-[#E8E4D9]">
            <button
              onClick={() => step === 1 ? navigate(returnTo) : setStep(1)}
              className="flex items-center justify-center w-full text-[#636E72] hover:text-[#0D7377] text-sm"
              data-testid="back-button"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {step === 1 ? "Back to Login" : "Change Username"}
            </button>
          </div>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          OTP will be sent to your registered WhatsApp
        </p>
      </div>
    </div>
  );
}
