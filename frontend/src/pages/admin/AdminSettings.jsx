import { useEffect, useState } from "react";
import { Save, MessageCircle, Mail, CreditCard, Users, ToggleLeft, ToggleRight } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { getSettings, saveSettings, getProperties } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function AdminSettings() {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [settings, setSettings] = useState({
    property_id: "",
    property_name: "",
    staff_whatsapp: "",
    staff1_whatsapp: "",
    staff2_whatsapp: "",
    notification_email: "",
    upi_id: "",
    payment_qr_url: "",
    currency: "INR",
    experiences_enabled: true,
    requests_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      fetchSettings();
    }
  }, [selectedProperty]);

  const fetchProperties = async () => {
    try {
      const data = await getProperties();
      setProperties(data);
      if (data.length > 0) {
        setSelectedProperty(data[0].property_id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await getSettings(selectedProperty);
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!settings.property_name) {
      toast.error("Please fill in property name");
      return;
    }

    setSaving(true);
    try {
      await saveSettings({
        ...settings,
        property_id: selectedProperty,
      });
      toast.success("Settings saved successfully");
      fetchProperties(); // Refresh properties list to show updated name
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="max-w-2xl">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-8" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-2xl" data-testid="admin-settings">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl text-[#264653] mb-2">Settings</h1>
            <p className="text-[#6B705C]">Configure your property details</p>
          </div>
          {/* Property Selector */}
          <Select value={selectedProperty} onValueChange={setSelectedProperty}>
            <SelectTrigger className="w-48 rounded-xl border-[#E0DCD3]" data-testid="settings-property-selector">
              <SelectValue placeholder="Select Property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.property_id} value={p.property_id}>
                  {p.property_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {properties.length === 0 ? (
          <Card className="rounded-2xl border-[#E0DCD3]">
            <CardContent className="py-12 text-center">
              <p className="text-[#6B705C] mb-4">No properties configured yet</p>
              <p className="text-[#6B705C] text-sm">Go to Properties page to create your first property</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Settings Form */}
            <Card className="rounded-2xl border-[#E0DCD3]">
              <CardHeader>
                <CardTitle className="font-serif text-xl text-[#264653]">Property Configuration</CardTitle>
                <CardDescription className="text-[#6B705C]">
                  Settings for <strong>{selectedProperty}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-6" data-testid="settings-form">
                  <div>
                    <Label htmlFor="property_name" className="text-[#264653]">Property Name *</Label>
                    <Input
                      id="property_name"
                      value={settings.property_name}
                      onChange={(e) => setSettings({ ...settings, property_name: e.target.value })}
                      className="hm-input mt-1"
                      placeholder="Hidden Monkey Stays - Varanasi"
                      required
                      data-testid="settings-property-name"
                    />
                  </div>

                  {/* Staff Notifications Section */}
                  <div className="border-t border-[#E0DCD3] pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-[#2A9D8F]" />
                      <h3 className="font-semibold text-[#264653]">Staff Notifications</h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="staff1_whatsapp" className="text-[#264653] flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-[#25D366]" />
                          Staff 1 - Manager/Kitchen (Approves Orders)
                        </Label>
                        <Input
                          id="staff1_whatsapp"
                          value={settings.staff1_whatsapp}
                          onChange={(e) => setSettings({ ...settings, staff1_whatsapp: e.target.value })}
                          className="hm-input mt-1"
                          placeholder="+91 98765 43210"
                          data-testid="settings-staff1-whatsapp"
                        />
                        <p className="text-[#6B705C] text-xs mt-1">
                          Receives new orders and can approve/reject via WhatsApp reply
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="staff2_whatsapp" className="text-[#264653] flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-[#25D366]" />
                          Staff 2 - Billing/Accounts (Handles Payment)
                        </Label>
                        <Input
                          id="staff2_whatsapp"
                          value={settings.staff2_whatsapp}
                          onChange={(e) => setSettings({ ...settings, staff2_whatsapp: e.target.value })}
                          className="hm-input mt-1"
                          placeholder="+91 98765 43211"
                          data-testid="settings-staff2-whatsapp"
                        />
                        <p className="text-[#6B705C] text-xs mt-1">
                          Notified when orders are approved to add to guest bill
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="notification_email" className="text-[#264653] flex items-center gap-2">
                          <Mail className="w-4 h-4 text-[#E76F51]" />
                          Backup Email (Optional)
                        </Label>
                        <Input
                          id="notification_email"
                          type="email"
                          value={settings.notification_email}
                          onChange={(e) => setSettings({ ...settings, notification_email: e.target.value })}
                          className="hm-input mt-1"
                          placeholder="manager@hiddenmonkey.com"
                          data-testid="settings-notification-email"
                        />
                        <p className="text-[#6B705C] text-xs mt-1">
                          Email notifications as backup to WhatsApp
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Section */}
                  <div className="border-t border-[#E0DCD3] pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard className="w-5 h-5 text-[#E9C46A]" />
                      <h3 className="font-semibold text-[#264653]">Payment Information</h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="upi_id" className="text-[#264653]">UPI ID</Label>
                        <Input
                          id="upi_id"
                          value={settings.upi_id}
                          onChange={(e) => setSettings({ ...settings, upi_id: e.target.value })}
                          className="hm-input mt-1"
                          placeholder="hiddenmonkey@upi"
                          data-testid="settings-upi-id"
                        />
                        <p className="text-[#6B705C] text-xs mt-1">
                          Shown to guests in order confirmation for payment
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="payment_qr_url" className="text-[#264653]">Payment QR Image URL (Optional)</Label>
                        <Input
                          id="payment_qr_url"
                          value={settings.payment_qr_url}
                          onChange={(e) => setSettings({ ...settings, payment_qr_url: e.target.value })}
                          className="hm-input mt-1"
                          placeholder="https://example.com/payment-qr.png"
                          data-testid="settings-payment-qr"
                        />
                      </div>

                      <div>
                        <Label htmlFor="currency" className="text-[#264653]">Currency</Label>
                        <Input
                          id="currency"
                          value={settings.currency}
                          onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                          className="hm-input mt-1"
                          placeholder="INR"
                          data-testid="settings-currency"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Feature Toggles Section */}
                  <div className="border-t border-[#E0DCD3] pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ToggleLeft className="w-5 h-5 text-[#0D7377]" />
                      <h3 className="font-semibold text-[#264653]">Feature Toggles</h3>
                    </div>
                    <p className="text-[#6B705C] text-sm mb-4">
                      Enable or disable features on the guest portal
                    </p>

                    <div className="space-y-4">
                      {/* Experiences Toggle */}
                      <div className="flex items-center justify-between p-4 bg-[#F0EFEB] rounded-xl">
                        <div>
                          <p className="font-medium text-[#264653]">Experiences & Activities</p>
                          <p className="text-sm text-[#6B705C]">Allow guests to browse and book experiences</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, experiences_enabled: !settings.experiences_enabled })}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            settings.experiences_enabled ? 'bg-[#0D7377]' : 'bg-gray-300'
                          }`}
                          data-testid="toggle-experiences"
                        >
                          <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                            settings.experiences_enabled ? 'translate-x-6' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      {/* Requests Toggle */}
                      <div className="flex items-center justify-between p-4 bg-[#F0EFEB] rounded-xl">
                        <div>
                          <p className="font-medium text-[#264653]">Guest Requests</p>
                          <p className="text-sm text-[#6B705C]">Allow guests to submit service requests</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, requests_enabled: !settings.requests_enabled })}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            settings.requests_enabled ? 'bg-[#0D7377]' : 'bg-gray-300'
                          }`}
                          data-testid="toggle-requests"
                        >
                          <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                            settings.requests_enabled ? 'translate-x-6' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full btn-primary flex items-center justify-center gap-2"
                    disabled={saving}
                    data-testid="save-settings"
                  >
                    <Save className="w-5 h-5" />
                    {saving ? "Saving..." : "Save Settings"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Webhook Info for Twilio */}
            <Card className="rounded-2xl border-[#E0DCD3] mt-6">
              <CardHeader>
                <CardTitle className="font-serif text-xl text-[#264653]">WhatsApp Webhook URL</CardTitle>
                <CardDescription className="text-[#6B705C]">
                  Configure this URL in your Twilio WhatsApp Sandbox settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-[#F0EFEB] rounded-xl p-4 mb-3">
                  <p className="text-[#264653] font-mono text-sm break-all">
                    {process.env.REACT_APP_BACKEND_URL}/api/webhook/whatsapp
                  </p>
                </div>
                <p className="text-[#6B705C] text-xs">
                  Staff can reply "1" to accept or "2" to reject orders directly from WhatsApp
                </p>
              </CardContent>
            </Card>

            {/* QR Code Info */}
            <Card className="rounded-2xl border-[#E0DCD3] mt-6">
              <CardHeader>
                <CardTitle className="font-serif text-xl text-[#264653]">Guest Portal QR Code</CardTitle>
                <CardDescription className="text-[#6B705C]">
                  Generate a QR code for guests to access this property's portal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-[#F0EFEB] rounded-xl p-4">
                  <p className="text-[#264653] font-mono text-sm break-all">
                    {window.location.origin}/?property={selectedProperty}
                  </p>
                </div>
                <p className="text-[#6B705C] text-xs mt-3">
                  Use this URL to generate a QR code. Guests scanning this QR will see menu and experiences for <strong>{selectedProperty}</strong>.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
