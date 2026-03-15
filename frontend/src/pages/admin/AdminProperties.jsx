import { useEffect, useState } from "react";
import { Plus, Copy, Building2, ExternalLink, RefreshCw } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { getProperties, cloneProperty, seedData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminProperties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [newPropertyId, setNewPropertyId] = useState("");
  const [cloneSource, setCloneSource] = useState("");
  const [cloneTarget, setCloneTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const data = await getProperties();
      setProperties(data);
    } catch (error) {
      console.error("Error fetching properties:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = async (e) => {
    e.preventDefault();
    if (!newPropertyId.trim()) {
      toast.error("Please enter a property ID");
      return;
    }

    const cleanId = newPropertyId.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    
    setSubmitting(true);
    try {
      await seedData(cleanId);
      toast.success(`Property "${cleanId}" created with sample data!`);
      setShowNewForm(false);
      setNewPropertyId("");
      fetchProperties();
    } catch (error) {
      console.error("Error creating property:", error);
      toast.error("Failed to create property");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClone = async (e) => {
    e.preventDefault();
    if (!cloneSource || !cloneTarget.trim()) {
      toast.error("Please select source and enter target property ID");
      return;
    }

    const cleanTarget = cloneTarget.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    
    setSubmitting(true);
    try {
      const result = await cloneProperty(cloneSource, cleanTarget);
      toast.success(`Property cloned! ${result.experiences_cloned} experiences and ${result.menu_items_cloned} menu items copied.`);
      setShowCloneForm(false);
      setCloneSource("");
      setCloneTarget("");
      fetchProperties();
    } catch (error) {
      console.error("Error cloning property:", error);
      toast.error(error.response?.data?.detail || "Failed to clone property");
    } finally {
      setSubmitting(false);
    }
  };

  const copyQRLink = (propertyId) => {
    const link = `${window.location.origin}/?property=${propertyId}`;
    navigator.clipboard.writeText(link);
    toast.success("QR link copied to clipboard!");
  };

  return (
    <AdminLayout>
      <div data-testid="admin-properties">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl text-[#264653] mb-2">Properties</h1>
            <p className="text-[#6B705C]">Manage multiple properties with their own menus & experiences</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => setShowCloneForm(true)} 
              variant="outline"
              className="flex items-center gap-2 rounded-xl border-[#E0DCD3]"
              data-testid="clone-property"
            >
              <Copy className="w-5 h-5" />
              Clone Property
            </Button>
            <Button 
              onClick={() => setShowNewForm(true)} 
              className="btn-primary flex items-center gap-2"
              data-testid="add-property"
            >
              <Plus className="w-5 h-5" />
              New Property
            </Button>
          </div>
        </div>

        {/* Properties Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <Card className="rounded-2xl border-[#E0DCD3]">
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 text-[#E0DCD3] mx-auto mb-4" />
              <p className="text-[#6B705C] mb-4">No properties configured yet</p>
              <Button onClick={() => setShowNewForm(true)} className="btn-primary">
                Create Your First Property
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <Card 
                key={property.property_id} 
                className="rounded-2xl border-[#E0DCD3] hover:shadow-lg transition-shadow"
                data-testid={`property-card-${property.property_id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-xl bg-[#2A9D8F]/10 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-[#2A9D8F]" />
                    </div>
                    <button
                      onClick={() => copyQRLink(property.property_id)}
                      className="p-2 rounded-lg hover:bg-[#F0EFEB] transition-colors text-[#6B705C]"
                      title="Copy QR Link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                  <CardTitle className="font-serif text-xl text-[#264653] mt-3">
                    {property.property_name}
                  </CardTitle>
                  <CardDescription className="text-[#6B705C]">
                    ID: <code className="bg-[#F0EFEB] px-2 py-0.5 rounded text-xs">{property.property_id}</code>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-[#F9F7F2] rounded-xl p-3">
                      <p className="text-[#6B705C]">Experiences</p>
                      <p className="text-2xl font-bold text-[#2A9D8F]">{property.experiences_count}</p>
                    </div>
                    <div className="bg-[#F9F7F2] rounded-xl p-3">
                      <p className="text-[#6B705C]">Menu Items</p>
                      <p className="text-2xl font-bold text-[#E9C46A]">{property.menu_items_count}</p>
                    </div>
                  </div>
                  {property.staff_whatsapp && (
                    <p className="text-[#6B705C] text-xs mt-3">
                      WhatsApp: {property.staff_whatsapp}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* New Property Dialog */}
        <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-[#264653]">
                Create New Property
              </DialogTitle>
              <DialogDescription className="text-[#6B705C]">
                This will create a new property with sample menu and experiences
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateNew} className="space-y-4 mt-4" data-testid="new-property-form">
              <div>
                <Label htmlFor="property_id" className="text-[#264653]">Property ID *</Label>
                <Input
                  id="property_id"
                  value={newPropertyId}
                  onChange={(e) => setNewPropertyId(e.target.value)}
                  className="hm-input mt-1"
                  placeholder="goa, mumbai, delhi..."
                  data-testid="new-property-id-input"
                />
                <p className="text-[#6B705C] text-xs mt-1">
                  Use lowercase letters, numbers, and hyphens only
                </p>
              </div>

              <Button
                type="submit"
                className="w-full btn-primary"
                disabled={submitting}
                data-testid="create-property-submit"
              >
                {submitting ? "Creating..." : "Create Property with Sample Data"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Clone Property Dialog */}
        <Dialog open={showCloneForm} onOpenChange={setShowCloneForm}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-[#264653]">
                Clone Property
              </DialogTitle>
              <DialogDescription className="text-[#6B705C]">
                Copy all experiences and menu items from an existing property
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleClone} className="space-y-4 mt-4" data-testid="clone-property-form">
              <div>
                <Label htmlFor="clone_source" className="text-[#264653]">Source Property *</Label>
                <Select value={cloneSource} onValueChange={setCloneSource}>
                  <SelectTrigger className="hm-input mt-1" data-testid="clone-source-select">
                    <SelectValue placeholder="Select property to clone from" />
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

              <div>
                <Label htmlFor="clone_target" className="text-[#264653]">New Property ID *</Label>
                <Input
                  id="clone_target"
                  value={cloneTarget}
                  onChange={(e) => setCloneTarget(e.target.value)}
                  className="hm-input mt-1"
                  placeholder="new-property-id"
                  data-testid="clone-target-input"
                />
              </div>

              <Button
                type="submit"
                className="w-full btn-primary"
                disabled={submitting || !cloneSource}
                data-testid="clone-property-submit"
              >
                {submitting ? "Cloning..." : "Clone Property"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
