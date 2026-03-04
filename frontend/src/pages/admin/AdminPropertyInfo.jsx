import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import api from "@/lib/api";
import { Plus, Trash2, Clock, Wifi, Calendar, MapPin, Coffee, Image, ClipboardCheck } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";

export default function AdminPropertyInfo() {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [info, setInfo] = useState({
    property_id: "",
    checkin_time: "2:00 PM",
    checkout_time: "11:00 AM",
    wifi_name: "",
    wifi_password: "",
    welcome_message: "Welcome to Hidden Monkey Stays!",
    contact_phone: "",
    emergency_phone: "",
    today_events: [],
    things_to_do: [],
    food_to_try: [],
    // Header Images
    header_image: "",
    food_header_image: "",
    experiences_header_image: "",
    requests_header_image: "",
    // Check-in Form
    checkin_form_url: "",
  });

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      fetchPropertyInfo(selectedProperty);
    }
  }, [selectedProperty]);

  const fetchProperties = async () => {
    try {
      const res = await api.get("/settings");
      setProperties(res.data);
      if (res.data.length > 0) {
        setSelectedProperty(res.data[0].property_id);
      }
    } catch (error) {
      toast.error("Failed to load properties");
    } finally {
      setLoading(false);
    }
  };

  const fetchPropertyInfo = async (propertyId) => {
    try {
      const res = await api.get(`/property-info/${propertyId}`);
      setInfo({ ...info, ...res.data, property_id: propertyId });
    } catch (error) {
      setInfo({ ...info, property_id: propertyId });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/property-info", { ...info, property_id: selectedProperty });
      toast.success("Property info saved!");
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const addEvent = () => {
    setInfo({
      ...info,
      today_events: [...info.today_events, { title: "", time: "", description: "" }]
    });
  };

  const updateEvent = (index, field, value) => {
    const events = [...info.today_events];
    events[index][field] = value;
    setInfo({ ...info, today_events: events });
  };

  const removeEvent = (index) => {
    setInfo({
      ...info,
      today_events: info.today_events.filter((_, i) => i !== index)
    });
  };

  const addThingToDo = () => {
    setInfo({
      ...info,
      things_to_do: [...info.things_to_do, { title: "", description: "", image_url: "" }]
    });
  };

  const updateThingToDo = (index, field, value) => {
    const items = [...info.things_to_do];
    items[index][field] = value;
    setInfo({ ...info, things_to_do: items });
  };

  const removeThingToDo = (index) => {
    setInfo({
      ...info,
      things_to_do: info.things_to_do.filter((_, i) => i !== index)
    });
  };

  const addFoodToTry = () => {
    setInfo({
      ...info,
      food_to_try: [...info.food_to_try, { title: "", description: "", image_url: "" }]
    });
  };

  const updateFoodToTry = (index, field, value) => {
    const items = [...info.food_to_try];
    items[index][field] = value;
    setInfo({ ...info, food_to_try: items });
  };

  const removeFoodToTry = (index) => {
    setInfo({
      ...info,
      food_to_try: info.food_to_try.filter((_, i) => i !== index)
    });
  };

  return (
    <AdminLayout title="Property Info">
      <div className="space-y-6 max-w-3xl">
        {/* Property Selector */}
        <div>
          <Label>Select Property</Label>
          <Select value={selectedProperty} onValueChange={setSelectedProperty}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Select property" />
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

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" /> Basic Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Check-in Time</Label>
                <Input
                  value={info.checkin_time}
                  onChange={(e) => setInfo({ ...info, checkin_time: e.target.value })}
                  placeholder="2:00 PM"
                />
              </div>
              <div>
                <Label>Check-out Time</Label>
                <Input
                  value={info.checkout_time}
                  onChange={(e) => setInfo({ ...info, checkout_time: e.target.value })}
                  placeholder="11:00 AM"
                />
              </div>
            </div>
            <div>
              <Label>Welcome Message</Label>
              <Input
                value={info.welcome_message}
                onChange={(e) => setInfo({ ...info, welcome_message: e.target.value })}
                placeholder="Welcome to Hidden Monkey Stays!"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contact Phone</Label>
                <Input
                  value={info.contact_phone}
                  onChange={(e) => setInfo({ ...info, contact_phone: e.target.value })}
                  placeholder="+91..."
                />
              </div>
              <div>
                <Label>Emergency Phone</Label>
                <Input
                  value={info.emergency_phone}
                  onChange={(e) => setInfo({ ...info, emergency_phone: e.target.value })}
                  placeholder="+91..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WiFi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="w-5 h-5" /> WiFi Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>WiFi Name</Label>
                <Input
                  value={info.wifi_name}
                  onChange={(e) => setInfo({ ...info, wifi_name: e.target.value })}
                  placeholder="HiddenMonkey_Guest"
                />
              </div>
              <div>
                <Label>WiFi Password</Label>
                <Input
                  value={info.wifi_password}
                  onChange={(e) => setInfo({ ...info, wifi_password: e.target.value })}
                  placeholder="password123"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Header Images */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" /> Header Images
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-gray-500">
              Upload images or paste URLs from Unsplash, Pexels, etc. Images are automatically optimized.
            </p>
            
            <ImageUpload
              label="Main Property Banner"
              value={info.header_image}
              onChange={(url) => setInfo({ ...info, header_image: url })}
              folder={`hidden_monkey/${selectedProperty}/headers`}
              placeholder="https://images.unsplash.com/..."
            />
            
            <ImageUpload
              label="Food & Drinks Header"
              value={info.food_header_image}
              onChange={(url) => setInfo({ ...info, food_header_image: url })}
              folder={`hidden_monkey/${selectedProperty}/headers`}
              placeholder="https://images.pexels.com/..."
            />
            
            <ImageUpload
              label="Experiences Header"
              value={info.experiences_header_image}
              onChange={(url) => setInfo({ ...info, experiences_header_image: url })}
              folder={`hidden_monkey/${selectedProperty}/headers`}
              placeholder="https://images.unsplash.com/..."
            />
            
            <ImageUpload
              label="Requests Header"
              value={info.requests_header_image}
              onChange={(url) => setInfo({ ...info, requests_header_image: url })}
              folder={`hidden_monkey/${selectedProperty}/headers`}
              placeholder="https://images.pexels.com/..."
            />
          </CardContent>
        </Card>

        {/* Check-in Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" /> Check-in Form
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Paste your Google Form embed URL. Guests can fill this form during check-in.
              Manager will be notified via WhatsApp when a guest checks in.
            </p>
            <div>
              <Label>Google Form Embed URL</Label>
              <Input
                value={info.checkin_form_url || ""}
                onChange={(e) => setInfo({ ...info, checkin_form_url: e.target.value })}
                placeholder="https://docs.google.com/forms/d/e/xxxxx/viewform?embedded=true"
              />
              <p className="text-xs text-gray-400 mt-1">
                To get embed URL: Open Google Form → Send → Embed → Copy the src URL
              </p>
            </div>
            {info.checkin_form_url && (
              <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
                ✓ Check-in form is configured. Guests can access it at: <br />
                <code className="bg-green-100 px-2 py-1 rounded">/{selectedProperty?.replace(/_/g, '')}/checkin</code>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" /> Today's Events
            </CardTitle>
            <Button size="sm" onClick={addEvent} variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Add Event
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {info.today_events?.length === 0 ? (
              <p className="text-gray-500 text-sm">No events added</p>
            ) : (
              info.today_events?.map((event, i) => (
                <div key={i} className="flex gap-4 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={event.title}
                      onChange={(e) => updateEvent(i, "title", e.target.value)}
                      placeholder="Event title"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={event.time}
                        onChange={(e) => updateEvent(i, "time", e.target.value)}
                        placeholder="6:00 PM"
                        className="w-32"
                      />
                      <Input
                        value={event.description}
                        onChange={(e) => updateEvent(i, "description", e.target.value)}
                        placeholder="Description (optional)"
                      />
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeEvent(i)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Things to Do */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" /> Things to Do
            </CardTitle>
            <Button size="sm" onClick={addThingToDo} variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {info.things_to_do?.length === 0 ? (
              <p className="text-gray-500 text-sm">No recommendations added</p>
            ) : (
              info.things_to_do?.map((item, i) => (
                <div key={i} className="flex gap-4 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={item.title}
                      onChange={(e) => updateThingToDo(i, "title", e.target.value)}
                      placeholder="Place/Activity name"
                    />
                    <Textarea
                      value={item.description}
                      onChange={(e) => updateThingToDo(i, "description", e.target.value)}
                      placeholder="Description"
                      rows={2}
                    />
                    <Input
                      value={item.image_url}
                      onChange={(e) => updateThingToDo(i, "image_url", e.target.value)}
                      placeholder="Image URL (optional)"
                    />
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeThingToDo(i)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Food to Try */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Coffee className="w-5 h-5" /> Food to Try
            </CardTitle>
            <Button size="sm" onClick={addFoodToTry} variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {info.food_to_try?.length === 0 ? (
              <p className="text-gray-500 text-sm">No recommendations added</p>
            ) : (
              info.food_to_try?.map((item, i) => (
                <div key={i} className="flex gap-4 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={item.title}
                      onChange={(e) => updateFoodToTry(i, "title", e.target.value)}
                      placeholder="Dish name"
                    />
                    <Textarea
                      value={item.description}
                      onChange={(e) => updateFoodToTry(i, "description", e.target.value)}
                      placeholder="Description"
                      rows={2}
                    />
                    <Input
                      value={item.image_url}
                      onChange={(e) => updateFoodToTry(i, "image_url", e.target.value)}
                      placeholder="Image URL (optional)"
                    />
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeFoodToTry(i)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-full bg-[#2A9D8F]" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </AdminLayout>
  );
}
