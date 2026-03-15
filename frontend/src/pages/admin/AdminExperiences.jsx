import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { getExperiences, createExperience, updateExperience, deleteExperience, getProperties } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const defaultFormData = {
  title: "",
  description: "",
  category: "wellness",
  image_url: "",
  brochure_url: "",
  duration: "",
  price: "",
  is_active: true,
  property_id: "",
};

export default function AdminExperiences() {
  const [experiences, setExperiences] = useState([]);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [submitting, setSubmitting] = useState(false);

  const categories = ["wellness", "culture", "adventure", "dining", "entertainment"];

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      fetchExperiences();
    }
  }, [selectedProperty]);

  const fetchProperties = async () => {
    try {
      const data = await getProperties();
      setProperties(data);
      if (data.length > 0) {
        setSelectedProperty(data[0].property_id);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  };

  const fetchExperiences = async () => {
    setLoading(true);
    try {
      const data = await getExperiences(selectedProperty, false);
      setExperiences(data);
    } catch (error) {
      console.error("Error fetching experiences:", error);
      toast.error("Failed to load experiences");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.image_url) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const submitData = { ...formData, property_id: selectedProperty };
      
      if (editingId) {
        await updateExperience(editingId, submitData);
        toast.success("Experience updated successfully");
      } else {
        await createExperience(submitData);
        toast.success("Experience created successfully");
      }
      
      setShowForm(false);
      setEditingId(null);
      setFormData({ ...defaultFormData, property_id: selectedProperty });
      fetchExperiences();
    } catch (error) {
      console.error("Error saving experience:", error);
      toast.error("Failed to save experience");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (experience) => {
    setFormData({
      title: experience.title,
      description: experience.description,
      category: experience.category,
      image_url: experience.image_url,
      brochure_url: experience.brochure_url || "",
      duration: experience.duration || "",
      price: experience.price || "",
      is_active: experience.is_active,
      property_id: experience.property_id || selectedProperty,
    });
    setEditingId(experience.id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      await deleteExperience(deleteId);
      toast.success("Experience deleted successfully");
      fetchExperiences();
    } catch (error) {
      console.error("Error deleting experience:", error);
      toast.error("Failed to delete experience");
    } finally {
      setDeleteId(null);
    }
  };

  const openNewForm = () => {
    setFormData({ ...defaultFormData, property_id: selectedProperty });
    setEditingId(null);
    setShowForm(true);
  };

  return (
    <AdminLayout>
      <div data-testid="admin-experiences">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl text-[#264653] mb-2">Experiences</h1>
            <p className="text-[#6B705C]">Manage curated activities and adventures</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Property Selector */}
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="w-48 rounded-xl border-[#E0DCD3]" data-testid="property-selector">
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
            <Button onClick={openNewForm} className="btn-primary flex items-center gap-2" data-testid="add-experience" disabled={!selectedProperty}>
              <Plus className="w-5 h-5" />
              Add Experience
            </Button>
          </div>
        </div>

        {/* Experiences List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-[#E0DCD3]">
                <Skeleton className="h-48 w-full" />
                <div className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : experiences.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#E0DCD3]">
            <p className="text-[#6B705C] mb-4">No experiences yet</p>
            <Button onClick={openNewForm} className="btn-primary">
              Add Your First Experience
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {experiences.map((experience) => (
              <div
                key={experience.id}
                className={`bg-white rounded-2xl overflow-hidden border border-[#E0DCD3] ${
                  !experience.is_active ? "opacity-60" : ""
                }`}
                data-testid={`experience-item-${experience.id}`}
              >
                {/* Image */}
                <div className="relative h-48">
                  <img
                    src={experience.image_url}
                    alt={experience.title}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-white/90 text-[#264653] text-xs font-semibold uppercase">
                    {experience.category}
                  </span>
                  {!experience.is_active && (
                    <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-[#F9A825] text-white text-xs font-semibold">
                      Inactive
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-[#264653] mb-1">{experience.title}</h3>
                  <p className="text-[#6B705C] text-sm line-clamp-2 mb-3">{experience.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[#2A9D8F] font-bold">{experience.price || "Free"}</span>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(experience)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B705C] hover:bg-[#F0EFEB] transition-colors"
                        data-testid={`edit-experience-${experience.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(experience.id)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-[#F9A825] hover:bg-[#F9A825]/10 transition-colors"
                        data-testid={`delete-experience-${experience.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-lg bg-white rounded-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-[#264653]">
                {editingId ? "Edit Experience" : "Add Experience"}
              </DialogTitle>
              <DialogDescription className="text-[#6B705C]">
                {editingId ? "Update the experience details" : "Create a new experience for guests"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4" data-testid="experience-form">
              <div>
                <Label htmlFor="title" className="text-[#264653]">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="hm-input mt-1"
                  placeholder="Morning Yoga Session"
                  required
                  data-testid="experience-title-input"
                />
              </div>

              <div>
                <Label htmlFor="category" className="text-[#264653]">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="hm-input mt-1" data-testid="experience-category-select">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat} className="capitalize">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description" className="text-[#264653]">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="hm-input mt-1 min-h-[100px]"
                  placeholder="Describe the experience..."
                  required
                  data-testid="experience-description-input"
                />
              </div>

              <div>
                <Label htmlFor="image_url" className="text-[#264653]">Image URL *</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="hm-input mt-1"
                  placeholder="https://example.com/image.jpg"
                  required
                  data-testid="experience-image-input"
                />
              </div>

              <div>
                <Label htmlFor="brochure_url" className="text-[#264653]">Brochure URL (optional)</Label>
                <Input
                  id="brochure_url"
                  value={formData.brochure_url}
                  onChange={(e) => setFormData({ ...formData, brochure_url: e.target.value })}
                  className="hm-input mt-1"
                  placeholder="https://example.com/brochure.pdf"
                  data-testid="experience-brochure-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duration" className="text-[#264653]">Duration</Label>
                  <Input
                    id="duration"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="hm-input mt-1"
                    placeholder="2 hours"
                    data-testid="experience-duration-input"
                  />
                </div>
                <div>
                  <Label htmlFor="price" className="text-[#264653]">Price</Label>
                  <Input
                    id="price"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="hm-input mt-1"
                    placeholder="₹500"
                    data-testid="experience-price-input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <Label htmlFor="is_active" className="text-[#264653]">Active</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  data-testid="experience-active-switch"
                />
              </div>

              <Button
                type="submit"
                className="w-full btn-primary"
                disabled={submitting}
                data-testid="save-experience"
              >
                {submitting ? "Saving..." : (editingId ? "Update Experience" : "Create Experience")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent className="bg-white rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-serif text-xl text-[#264653]">
                Delete Experience?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[#6B705C]">
                This action cannot be undone. This will permanently delete the experience.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="btn-destructive"
                data-testid="confirm-delete"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
