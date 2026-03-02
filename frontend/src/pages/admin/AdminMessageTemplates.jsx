import { useEffect, useState } from "react";
import { Save, MessageSquare, RefreshCw } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { getSettings, saveSettings, getProperties } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Default message templates
const DEFAULT_TEMPLATES = {
  msg_food_order_staff: `🍽️ *New Food Order #{order_id}*

*Guest:* {guest_name}
*Room:* {room_number}
*Phone:* {whatsapp}

*Order:*
{items_list}

*Total:* ₹{total}
{notes_section}
━━━━━━━━━━━━━━━
↩️ *Reply to this message:*
*1* = ✅ Approve
*2* = ❌ Reject`,

  msg_food_order_guest: `🍽️ *Order Received!*

Hi {guest_name}, your order has been received!

*Order ID:* #{order_id}
*Total:* ₹{total}

Our kitchen is preparing your order. You'll be notified once it's ready.

Thank you for ordering with {property_name}! 🐒`,

  msg_booking_staff: `🎯 *New Experience Booking #{order_id}*

*Experience:* {experience_title}
*Price:* {experience_price}

*Guest:* {guest_name}
*Room:* {room_number}
*Phone:* {whatsapp}
{notes_section}
⚠️ Please check with guest about availability and details.

━━━━━━━━━━━━━━━
↩️ *Reply to this message* with:
*1* = ✅ Approve (sends payment link to guest)
*2* = ❌ Reject`,

  msg_booking_guest_received: `🎯 *Booking Received!*

Hi {guest_name}, thank you for booking *{experience_title}* with {property_name}!

*Booking ID:* #{order_id}

Our team will connect with you shortly to confirm availability and details.

💳 Once confirmed, you will receive a payment link. *Only online payment is accepted.*

Thank you! 🐒`,

  msg_booking_guest_approved: `✅ *Booking Approved!*

Hi {guest_name}, your booking for *{experience_title}* has been approved!

*Booking ID:* #{order_id}
*Amount:* {experience_price}

💳 *Please complete your payment:*
{payment_link}

⏰ Payment link expires in 24 hours.

Once payment is complete, you'll receive a confirmation with scheduling details.

Thank you for choosing {property_name}! 🐒`,

  msg_booking_payment_staff: `💳 *PAYMENT RECEIVED - Booking #{order_id}*

*Experience:* {experience_title}
*Guest:* {guest_name}
*Room:* {room_number}
*Amount Paid:* ₹{amount}

✅ Payment confirmed! Please:
1. Coordinate with guest for scheduling
2. Reply "SCHEDULED" when experience is scheduled

━━━━━━━━━━━━━━━
↩️ Reply *3* or *DONE* when experience is completed.`,

  msg_booking_payment_guest: `💳 *Payment Confirmed!*

Hi {guest_name}, your payment of *₹{amount}* for *{experience_title}* has been received!

*Booking ID:* #{order_id}

Our team will contact you shortly to finalize the schedule.

Enjoy your experience with {property_name}! 🐒`,

  msg_request_staff: `📋 *New Service Request #{order_id}*

*Category:* {category}
*Guest:* {guest_name}
*Room:* {room_number}
*Phone:* {whatsapp}

*Request:*
{message}

━━━━━━━━━━━━━━━
↩️ *Reply to this message* with:
*1* = ✅ Acknowledge (notifies guest)
*3* = ✅ Resolved (closes request)`,

  msg_request_guest_received: `📋 *Request Received!*

Hi {guest_name}, your {category} request has been received!

*Request ID:* #{order_id}

Our team has been notified and will attend to it shortly.

Thank you for staying with {property_name}! 🐒`,

  msg_request_guest_acknowledged: `✅ *Request Acknowledged!*

Hi {guest_name}, our team has acknowledged your request #{order_id}.

*Category:* {category}

We are working on it and will update you once it's resolved.

Thank you for your patience! 🐒`,

  msg_request_guest_resolved: `🎉 *Request Resolved!*

Hi {guest_name}, your {category} request #{order_id} has been resolved.

If you need any further assistance, please don't hesitate to raise another request.

Thank you for staying with {property_name}! 🐒`,
};

const TEMPLATE_CATEGORIES = [
  {
    id: "food",
    title: "Food Orders",
    description: "Messages for food ordering flow",
    templates: [
      { key: "msg_food_order_staff", label: "New Order → Staff (Kitchen)", description: "Sent to kitchen staff when new food order is placed" },
      { key: "msg_food_order_guest", label: "Order Received → Guest", description: "Confirmation sent to guest after ordering" },
    ]
  },
  {
    id: "booking",
    title: "Experience Bookings",
    description: "Messages for experience booking flow",
    templates: [
      { key: "msg_booking_staff", label: "New Booking → Staff (Manager)", description: "Sent to manager for approval" },
      { key: "msg_booking_guest_received", label: "Booking Received → Guest", description: "Initial confirmation to guest" },
      { key: "msg_booking_guest_approved", label: "Booking Approved → Guest", description: "Approval with payment link" },
      { key: "msg_booking_payment_staff", label: "Payment Confirmed → Staff", description: "Notifies manager of payment" },
      { key: "msg_booking_payment_guest", label: "Payment Confirmed → Guest", description: "Payment confirmation to guest" },
    ]
  },
  {
    id: "request",
    title: "Service Requests",
    description: "Messages for guest request flow",
    templates: [
      { key: "msg_request_staff", label: "New Request → Staff (Manager)", description: "Sent to manager when guest raises request" },
      { key: "msg_request_guest_received", label: "Request Received → Guest", description: "Confirmation to guest" },
      { key: "msg_request_guest_acknowledged", label: "Request Acknowledged → Guest", description: "When staff acknowledges" },
      { key: "msg_request_guest_resolved", label: "Request Resolved → Guest", description: "When request is resolved" },
    ]
  },
];

const AVAILABLE_VARIABLES = [
  { name: "{guest_name}", description: "Guest's name" },
  { name: "{room_number}", description: "Room number" },
  { name: "{order_id}", description: "Order/Booking/Request ID" },
  { name: "{property_name}", description: "Property name" },
  { name: "{whatsapp}", description: "Guest's WhatsApp number" },
  { name: "{total}", description: "Order total amount" },
  { name: "{items_list}", description: "List of ordered items" },
  { name: "{notes_section}", description: "Notes if provided" },
  { name: "{experience_title}", description: "Experience name" },
  { name: "{experience_price}", description: "Experience price" },
  { name: "{category}", description: "Request category" },
  { name: "{message}", description: "Request message" },
  { name: "{payment_link}", description: "Razorpay payment link" },
  { name: "{amount}", description: "Payment amount" },
];

export default function AdminMessageTemplates() {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      loadTemplates();
    }
  }, [selectedProperty]);

  const loadProperties = async () => {
    try {
      const data = await getProperties();
      setProperties(data);
      if (data.length > 0) {
        setSelectedProperty(data[0].property_id);
      }
    } catch (error) {
      toast.error("Failed to load properties");
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await getSettings(selectedProperty);
      // Extract template fields, use defaults if not set
      const loadedTemplates = {};
      Object.keys(DEFAULT_TEMPLATES).forEach(key => {
        loadedTemplates[key] = data[key] || DEFAULT_TEMPLATES[key];
      });
      setTemplates(loadedTemplates);
    } catch (error) {
      // Use defaults if settings don't exist
      setTemplates({ ...DEFAULT_TEMPLATES });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({
        property_id: selectedProperty,
        ...templates
      });
      toast.success("Message templates saved!");
    } catch (error) {
      toast.error("Failed to save templates");
    } finally {
      setSaving(false);
    }
  };

  const resetTemplate = (key) => {
    setTemplates(prev => ({
      ...prev,
      [key]: DEFAULT_TEMPLATES[key]
    }));
    toast.success("Template reset to default");
  };

  const resetAllTemplates = () => {
    setTemplates({ ...DEFAULT_TEMPLATES });
    toast.success("All templates reset to defaults");
  };

  return (
    <AdminLayout title="Message Templates">
      <div className="space-y-6" data-testid="admin-message-templates">
        {/* Property Selector & Actions */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
              <div className="w-full md:w-64">
                <Label className="text-[#264653] mb-2 block">Property</Label>
                <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                  <SelectTrigger className="hm-input" data-testid="template-property-select">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map(p => (
                      <SelectItem key={p.property_id} value={p.property_id}>
                        {p.property_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={resetAllTemplates}
                  className="border-[#E76F51] text-[#E76F51] hover:bg-[#E76F51]/10"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset All
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="btn-primary"
                  data-testid="save-templates-btn"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save Templates"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Variables Reference */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-[#0D7377]">Available Variables</CardTitle>
            <CardDescription>Use these placeholders in your templates - they'll be replaced with actual values</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_VARIABLES.map(v => (
                <span 
                  key={v.name} 
                  className="px-3 py-1 bg-[#0D7377]/10 text-[#0D7377] rounded-full text-sm cursor-help"
                  title={v.description}
                >
                  {v.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Templates by Category */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-4">
            {TEMPLATE_CATEGORIES.map(category => (
              <AccordionItem 
                key={category.id} 
                value={category.id}
                className="bg-white rounded-xl border border-[#E0DCD3] overflow-hidden"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-[#F8F7F4]">
                  <div className="flex items-center gap-3 text-left">
                    <MessageSquare className="w-5 h-5 text-[#0D7377]" />
                    <div>
                      <h3 className="font-semibold text-[#264653]">{category.title}</h3>
                      <p className="text-sm text-[#6B705C]">{category.description}</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <div className="space-y-6">
                    {category.templates.map(template => (
                      <div key={template.key} className="border border-[#E0DCD3] rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <Label className="text-[#264653] font-medium">{template.label}</Label>
                            <p className="text-xs text-[#6B705C]">{template.description}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resetTemplate(template.key)}
                            className="text-[#6B705C] hover:text-[#E76F51]"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Reset
                          </Button>
                        </div>
                        <textarea
                          value={templates[template.key] || ""}
                          onChange={(e) => setTemplates(prev => ({ ...prev, [template.key]: e.target.value }))}
                          className="w-full h-48 p-3 border border-[#E0DCD3] rounded-lg font-mono text-sm resize-y focus:ring-2 focus:ring-[#0D7377] focus:border-transparent"
                          placeholder="Enter message template..."
                          data-testid={`template-${template.key}`}
                        />
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </AdminLayout>
  );
}
