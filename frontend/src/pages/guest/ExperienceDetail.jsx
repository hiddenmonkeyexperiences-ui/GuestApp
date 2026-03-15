import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Download, Send } from "lucide-react";
import GuestLayout from "@/components/GuestLayout";
import { getExperience, createBooking, getSettings, generateWhatsAppLink } from "@/lib/api";
import { getPropertyId, getGuestInfo, setGuestInfo } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ExperienceDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const propertyId = getPropertyId();
  const [experience, setExperience] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const savedInfo = getGuestInfo();
  const [formData, setFormData] = useState({
    guest_name: savedInfo.name || "",
    room_number: savedInfo.room || "",
    whatsapp: savedInfo.whatsapp || "",
    notes: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [expData, settingsData] = await Promise.all([
          getExperience(id),
          getSettings(propertyId),
        ]);
        setExperience(expData);
        setSettings(settingsData);
      } catch (error) {
        console.error("Error fetching experience:", error);
        toast.error("Experience not found");
        navigate(`/experiences?property=${propertyId}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, propertyId, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.guest_name || !formData.room_number || !formData.whatsapp) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      // Save guest info for future use
      setGuestInfo({
        name: formData.guest_name,
        room: formData.room_number,
        whatsapp: formData.whatsapp,
      });

      // Create booking in backend
      await createBooking({
        ...formData,
        experience_id: experience.id,
        experience_title: experience.title,
        property_id: propertyId,
      });

      // Generate WhatsApp message
      const message = `🎯 *New Experience Booking Request*\n\n` +
        `*Experience:* ${experience.title}\n` +
        `*Guest:* ${formData.guest_name}\n` +
        `*Room:* ${formData.room_number}\n` +
        `*WhatsApp:* ${formData.whatsapp}\n` +
        `${formData.notes ? `*Notes:* ${formData.notes}\n` : ""}` +
        `\n_Sent via Hidden Monkey Stays_`;

      // Open WhatsApp
      if (settings?.staff_whatsapp) {
        const waLink = generateWhatsAppLink(settings.staff_whatsapp, message);
        window.open(waLink, "_blank");
      }

      toast.success("Booking request sent! We'll contact you shortly.");
      setShowBookingForm(false);
    } catch (error) {
      console.error("Error creating booking:", error);
      toast.error("Failed to submit booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <GuestLayout>
        <div className="min-h-screen">
          <Skeleton className="h-[50vh] w-full" />
          <div className="p-6">
            <Skeleton className="h-8 w-3/4 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </GuestLayout>
    );
  }

  if (!experience) return null;

  return (
    <GuestLayout>
      <div className="min-h-screen" data-testid="experience-detail">
        {/* Hero Image */}
        <div className="relative h-[50vh] min-h-[350px]">
          <img
            src={experience.image_url}
            alt={experience.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#264653]/80 via-[#264653]/30 to-transparent" />
          
          {/* Back Button */}
          <button
            onClick={() => navigate(`/experiences?property=${propertyId}`)}
            className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Category & Price */}
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
            <div>
              <span className="px-3 py-1 rounded-full bg-white/90 text-[#264653] text-xs font-semibold uppercase tracking-wider">
                {experience.category}
              </span>
            </div>
            {experience.price && (
              <span className="px-4 py-2 rounded-full bg-[#E9C46A] text-[#264653] font-bold text-lg">
                {experience.price}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-12 bg-white rounded-t-3xl -mt-6 relative z-10">
          <h1 className="font-serif text-3xl md:text-4xl text-[#264653] mb-4" data-testid="experience-title">
            {experience.title}
          </h1>

          {experience.duration && (
            <div className="flex items-center gap-2 text-[#6B705C] mb-6">
              <Clock className="w-5 h-5" />
              <span>{experience.duration}</span>
            </div>
          )}

          <p className="text-[#6B705C] text-lg leading-relaxed mb-8" data-testid="experience-description">
            {experience.description}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            {experience.brochure_url && (
              <Button
                variant="outline"
                className="flex items-center gap-2 rounded-xl border-[#E0DCD3] text-[#264653] hover:bg-[#F0EFEB]"
                onClick={() => window.open(experience.brochure_url, "_blank")}
                data-testid="download-brochure"
              >
                <Download className="w-5 h-5" />
                Download Brochure
              </Button>
            )}
            
            <Button
              className="flex-1 sm:flex-none btn-primary flex items-center justify-center gap-2"
              onClick={() => setShowBookingForm(true)}
              data-testid="request-booking"
            >
              <Send className="w-5 h-5" />
              Request Booking
            </Button>
          </div>
        </div>

        {/* Booking Form Dialog */}
        <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-[#264653]">
                Request Booking
              </DialogTitle>
              <DialogDescription className="text-[#6B705C]">
                Fill in your details and we'll confirm your booking via WhatsApp
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4" data-testid="booking-form">
              <div>
                <Label htmlFor="guest_name" className="text-[#264653]">Your Name *</Label>
                <Input
                  id="guest_name"
                  value={formData.guest_name}
                  onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                  className="hm-input mt-1"
                  placeholder="John Doe"
                  required
                  data-testid="input-guest-name"
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
                  data-testid="input-room-number"
                />
              </div>

              <div>
                <Label htmlFor="whatsapp" className="text-[#264653]">WhatsApp Number *</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  className="hm-input mt-1"
                  placeholder="+91 98765 43210"
                  required
                  data-testid="input-whatsapp"
                />
              </div>

              <div>
                <Label htmlFor="notes" className="text-[#264653]">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="hm-input mt-1 min-h-[80px]"
                  placeholder="Any special requests or preferences..."
                  data-testid="input-notes"
                />
              </div>

              <Button
                type="submit"
                className="w-full btn-primary"
                disabled={submitting}
                data-testid="submit-booking"
              >
                {submitting ? "Sending..." : "Send Booking Request"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </GuestLayout>
  );
}
