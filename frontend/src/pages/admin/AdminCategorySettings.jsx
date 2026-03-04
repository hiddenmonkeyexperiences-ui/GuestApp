import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import api from "@/lib/api";
import { Clock, Coffee, Sun, Moon, Cookie, Wine, Cake, Check, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const categoryIcons = {
  breakfast: Sun,
  lunch: Coffee,
  dinner: Moon,
  snacks: Cookie,
  beverages: Wine,
  desserts: Cake,
};

const categoryColors = {
  breakfast: "from-orange-400 to-yellow-400",
  lunch: "from-green-400 to-emerald-400",
  dinner: "from-purple-400 to-indigo-400",
  snacks: "from-pink-400 to-rose-400",
  beverages: "from-blue-400 to-cyan-400",
  desserts: "from-red-400 to-orange-400",
};

export default function AdminCategorySettings() {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

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
      const res = await api.get("/settings");
      setProperties(res.data);
      if (res.data.length > 0) {
        setSelectedProperty(res.data[0].property_id);
      }
    } catch (error) {
      toast.error("Failed to load properties");
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/category-settings/${selectedProperty}`);
      setSettings(res.data);
    } catch (error) {
      toast.error("Failed to load category settings");
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (category, updates) => {
    const currentSetting = settings.find(s => s.category === category);
    const newSetting = { ...currentSetting, ...updates, property_id: selectedProperty };
    
    setSaving(prev => ({ ...prev, [category]: true }));
    try {
      await api.post("/category-settings", newSetting);
      await fetchSettings();
      toast.success(`${category} settings updated`);
    } catch (error) {
      toast.error("Failed to update settings");
    } finally {
      setSaving(prev => ({ ...prev, [category]: false }));
    }
  };

  const handleTimingChange = (category, field, value) => {
    setSettings(prev => prev.map(s => 
      s.category === category 
        ? { ...s, timing: { ...s.timing, [field]: value } }
        : s
    ));
  };

  const saveTiming = (category) => {
    const setting = settings.find(s => s.category === category);
    updateSetting(category, { timing: setting.timing });
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-category-settings">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-serif text-[#264653]">Category Timings</h1>
            <p className="text-[#6B705C]">Control when each menu category is available</p>
          </div>
          
          <Select value={selectedProperty} onValueChange={setSelectedProperty}>
            <SelectTrigger className="w-[250px] hm-input" data-testid="property-select">
              <SelectValue placeholder="Select property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((prop) => (
                <SelectItem key={prop.property_id} value={prop.property_id}>
                  {prop.property_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2A9D8F]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {settings.map((setting) => {
              const Icon = categoryIcons[setting.category] || Clock;
              const colorClass = categoryColors[setting.category] || "from-gray-400 to-gray-500";
              
              return (
                <Card key={setting.category} className="overflow-hidden">
                  <CardHeader className={`bg-gradient-to-r ${colorClass} text-white py-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="w-6 h-6" />
                        <CardTitle className="text-lg capitalize">{setting.category}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {setting.is_active ? (
                          <span className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs bg-black/20 px-2 py-1 rounded-full">
                            <X className="w-3 h-3" /> Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {/* Enable/Disable Toggle */}
                    <div className="flex items-center justify-between">
                      <Label className="text-[#264653] font-medium">Enabled</Label>
                      <Switch
                        checked={setting.is_enabled}
                        onCheckedChange={(checked) => updateSetting(setting.category, { is_enabled: checked })}
                        disabled={saving[setting.category]}
                        data-testid={`toggle-${setting.category}`}
                      />
                    </div>

                    {/* Use Timing Toggle */}
                    <div className="flex items-center justify-between">
                      <Label className="text-[#264653]">Use Time Restrictions</Label>
                      <Switch
                        checked={setting.use_timing}
                        onCheckedChange={(checked) => updateSetting(setting.category, { use_timing: checked })}
                        disabled={saving[setting.category] || !setting.is_enabled}
                        data-testid={`timing-toggle-${setting.category}`}
                      />
                    </div>

                    {/* Timing Inputs */}
                    {setting.use_timing && setting.is_enabled && (
                      <div className="space-y-3 pt-2 border-t">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Label className="text-xs text-[#6B705C]">Start Time</Label>
                            <Input
                              type="time"
                              value={setting.timing?.start_time || "00:00"}
                              onChange={(e) => handleTimingChange(setting.category, "start_time", e.target.value)}
                              className="hm-input mt-1"
                              data-testid={`start-time-${setting.category}`}
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs text-[#6B705C]">End Time</Label>
                            <Input
                              type="time"
                              value={setting.timing?.end_time || "23:59"}
                              onChange={(e) => handleTimingChange(setting.category, "end_time", e.target.value)}
                              className="hm-input mt-1"
                              data-testid={`end-time-${setting.category}`}
                            />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => saveTiming(setting.category)}
                          disabled={saving[setting.category]}
                          className="w-full bg-[#2A9D8F] hover:bg-[#238577]"
                          data-testid={`save-timing-${setting.category}`}
                        >
                          {saving[setting.category] ? "Saving..." : "Save Timing"}
                        </Button>
                      </div>
                    )}

                    {/* Status Info */}
                    <div className="text-xs text-[#6B705C] pt-2 border-t">
                      {!setting.is_enabled ? (
                        <p>Category is disabled - items won't show to guests</p>
                      ) : setting.use_timing ? (
                        <p>Active from {setting.timing?.start_time || "00:00"} to {setting.timing?.end_time || "23:59"} IST</p>
                      ) : (
                        <p>Always available (no time restrictions)</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info Card */}
        <Card className="bg-[#F8F9FA]">
          <CardContent className="py-6">
            <h3 className="font-semibold text-[#264653] mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#2A9D8F]" />
              How Category Timings Work
            </h3>
            <ul className="space-y-2 text-sm text-[#6B705C]">
              <li>• <strong>Enabled:</strong> Toggle to completely show/hide a category</li>
              <li>• <strong>Time Restrictions:</strong> Items only show during specified hours (IST)</li>
              <li>• <strong>Multi-Category Items:</strong> If an item belongs to multiple categories, it shows if ANY category is active</li>
              <li>• <strong>Example:</strong> Paratha in both Breakfast (7-11 AM) and Dinner (7-11 PM) will show during both windows</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
