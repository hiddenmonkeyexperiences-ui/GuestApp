import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Sparkles, Wrench, Bed, Coffee, HelpCircle } from "lucide-react";
import GuestLayout from "@/components/GuestLayout";
import { createRequest, getSettings, generateWhatsAppLink } from "@/lib/api";
import { getPropertyId, getGuestInfo, setGuestInfo } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function Requests() {
  const navigate = useNavigate();
  const propertyId = getPropertyId();
  const [settings, setSettings] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const savedInfo = getGuestInfo();
  const [formData, setFormData] = useState({
    guest_name: savedInfo.name || "",
    room_number: savedInfo.room || "",
    whatsapp: savedInfo.whatsapp || "",
    message: "",
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getSettings(propertyId);
        setSettings(data);
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, [propertyId]);

  const categories = [
    { id: "housekeeping", label: "Housekeeping", icon: Sparkles, color: "bg-[#2A9D8F]" },
    { id: "maintenance", label: "Maintenance", icon: Wrench, color: "bg-[#E9C46A]" },
    { id: "amenities", label: "Amenities", icon: Coffee, color: "bg-[#264653]" },
    { id: "room_service", label: "Room Service", icon: Bed, color: "bg-[#F9A825]" },
    { id: "other", label: "Other", icon: HelpCircle, color: "bg-[#6B705C]" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCategory) {
      toast.error("Please select a category");
      return;
    }

    if (!formData.guest_name || !formData.room_number || !formData.whatsapp || !formData.message) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      // Save guest info
      setGuestInfo({
        name: formData.guest_name,
        room: formData.room_number,
        whatsapp: formData.whatsapp,
      });

      // Create request in backend
      await createRequest({
        guest_name: formData.guest_name,
        room_number: formData.room_number,
        whatsapp: formData.whatsapp,
        category: selectedCategory,
        message: formData.message,
        property_id: propertyId,
      });

      // Generate WhatsApp message
      const categoryLabel = categories.find((c) => c.id === selectedCategory)?.label || selectedCategory;
      const message = `📋 *New Guest Request*\n\n` +
        `*Category:* ${categoryLabel}\n` +
        `*Guest:* ${formData.guest_name}\n` +
        `*Room:* ${formData.room_number}\n` +
        `*WhatsApp:* ${formData.whatsapp}\n\n` +
        `*Request:*\n${formData.message}\n` +
        `\n_Sent via Hidden Monkey Stays_`;

      // Open WhatsApp
      if (settings?.staff_whatsapp) {
        const waLink = generateWhatsAppLink(settings.staff_whatsapp, message);
        window.open(waLink, "_blank");
      }

      toast.success("Request sent! Our team will assist you shortly.");
      
      // Reset form
      setSelectedCategory(null);
      setFormData({ ...formData, message: "" });
    } catch (error) {
      console.error("Error creating request:", error);
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GuestLayout>
      <div className="min-h-screen" data-testid="requests-page">
        {/* Header */}
        <div className="page-header bg-white border-b border-[#E0DCD3]">
          <button
            onClick={() => navigate(`/?property=${propertyId}`)}
            className="flex items-center gap-2 text-[#6B705C] mb-4 hover:text-[#2A9D8F] transition-colors"
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 data-testid="page-title">Requests</h1>
          <p>What can we do for you?</p>
        </div>

        {/* Categories */}
        <div className="p-6">
          <p className="text-[#6B705C] mb-4">Select a category:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-8">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 ${
                  selectedCategory === category.id
                    ? "border-[#2A9D8F] bg-[#2A9D8F]/5"
                    : "border-[#E0DCD3] bg-white hover:border-[#E9C46A]"
                }`}
                data-testid={`category-${category.id}`}
              >
                <div className={`w-12 h-12 rounded-xl ${category.color} flex items-center justify-center`}>
                  <category.icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-medium text-[#264653]">{category.label}</span>
              </button>
            ))}
          </div>

          {/* Request Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 border border-[#E0DCD3]/50" data-testid="request-form">
            <h3 className="font-serif text-xl text-[#264653] mb-6">Your Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="guest_name" className="text-[#264653]">Your Name *</Label>
                <Input
                  id="guest_name"
                  value={formData.guest_name}
                  onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                  className="hm-input mt-1"
                  placeholder="John Doe"
                  required
                  data-testid="request-input-guest-name"
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
                  data-testid="request-input-room-number"
                />
              </div>
            </div>

            <div className="mb-4">
              <Label htmlFor="whatsapp" className="text-[#264653]">WhatsApp Number *</Label>
              <Input
                id="whatsapp"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                className="hm-input mt-1"
                placeholder="+91 98765 43210"
                required
                data-testid="request-input-whatsapp"
              />
            </div>

            <div className="mb-6">
              <Label htmlFor="message" className="text-[#264653]">How can we help? *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="hm-input mt-1 min-h-[120px]"
                placeholder="Describe your request in detail..."
                required
                data-testid="request-input-message"
              />
            </div>

            <Button
              type="submit"
              className="w-full btn-primary flex items-center justify-center gap-2"
              disabled={submitting || !selectedCategory}
              data-testid="submit-request"
            >
              <Send className="w-5 h-5" />
              {submitting ? "Sending..." : "Send Request"}
            </Button>
          </form>
        </div>
      </div>
    </GuestLayout>
  );
}
