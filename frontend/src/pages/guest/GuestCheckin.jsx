import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { getPropertyInfo } from "@/lib/api";
import { ClipboardCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mascotBase64 } from "@/assets/mascotBase64";

export default function GuestCheckin() {
  const { slug } = useParams();
  const [propertyInfo, setPropertyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Map slug to property_id
  const propertyMap = {
    VaranasiHostel: "varanasi",
    DarjeelingHostel: "darjeeling_hostel",
    DarjeelingHome: "darjeeling_home",
  };

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const propertyId = propertyMap[slug] || slug;
        const data = await getPropertyInfo(propertyId);
        setPropertyInfo(data);
      } catch (err) {
        setError("Property not found");
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0D7377] to-[#14919B] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
      </div>
    );
  }

  if (error || !propertyInfo?.checkin_form_url) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0D7377] to-[#14919B] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <ClipboardCheck className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-700 mb-2">Check-in Form Not Available</h2>
            <p className="text-gray-500 mb-6">
              {error || "The check-in form has not been configured for this property yet."}
            </p>
            <Button onClick={() => window.history.back()} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D7377] to-[#14919B]">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <img src={mascotBase64} alt="Hidden Monkey" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="text-white font-bold text-xl">Guest Check-in</h1>
            <p className="text-white/70 text-sm">Hidden Monkey Stays</p>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className="max-w-4xl mx-auto p-4">
        <Card className="overflow-hidden shadow-2xl">
          <CardContent className="p-0">
            {/* Info Banner */}
            <div className="bg-gradient-to-r from-[#FFC107] to-[#F9A825] p-4 text-white">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-8 h-8" />
                <div>
                  <h2 className="font-bold text-lg">Welcome! Please complete your check-in</h2>
                  <p className="text-sm opacity-90">Fill in the form below to complete your registration</p>
                </div>
              </div>
            </div>
            
            {/* Embedded Google Form */}
            <div className="w-full" style={{ minHeight: "80vh" }}>
              <iframe
                src={propertyInfo.checkin_form_url}
                width="100%"
                height="100%"
                frameBorder="0"
                marginHeight="0"
                marginWidth="0"
                title="Check-in Form"
                style={{ minHeight: "80vh" }}
              >
                Loading form...
              </iframe>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-white/60 text-sm">
          <p>Need help? Contact the front desk</p>
          {propertyInfo.contact_phone && (
            <p className="mt-1">📞 {propertyInfo.contact_phone}</p>
          )}
        </div>
      </div>
    </div>
  );
}
