import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Leaf } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem, getProperties } from "@/lib/api";
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
  name: "",
  description: "",
  category: "breakfast",
  categories: [],
  price: "",
  image_url: "",
  is_available: true,
  is_vegetarian: false,
  property_id: "",
};

export default function AdminMenu() {
  const [menuItems, setMenuItems] = useState([]);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");

  const categories = ["breakfast", "lunch", "dinner", "snacks", "beverages", "desserts"];

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      fetchMenuItems();
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

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const data = await getMenuItems(selectedProperty, null, false);
      setMenuItems(data);
    } catch (error) {
      console.error("Error fetching menu items:", error);
      toast.error("Failed to load menu items");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = activeCategory === "all"
    ? menuItems
    : menuItems.filter((item) => item.category === activeCategory);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.description || !formData.price) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const submitData = {
        ...formData,
        price: parseFloat(formData.price),
        property_id: selectedProperty,
      };

      if (editingId) {
        await updateMenuItem(editingId, submitData);
        toast.success("Menu item updated successfully");
      } else {
        await createMenuItem(submitData);
        toast.success("Menu item created successfully");
      }
      
      setShowForm(false);
      setEditingId(null);
      setFormData({ ...defaultFormData, property_id: selectedProperty });
      fetchMenuItems();
    } catch (error) {
      console.error("Error saving menu item:", error);
      toast.error("Failed to save menu item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    // Ensure categories array includes at least the primary category
    const categories = item.categories && item.categories.length > 0 
      ? item.categories 
      : [item.category];
    
    setFormData({
      name: item.name,
      description: item.description,
      category: item.category,
      categories: categories,
      price: item.price.toString(),
      image_url: item.image_url || "",
      is_available: item.is_available,
      is_vegetarian: item.is_vegetarian,
      property_id: item.property_id || selectedProperty,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      await deleteMenuItem(deleteId);
      toast.success("Menu item deleted successfully");
      fetchMenuItems();
    } catch (error) {
      console.error("Error deleting menu item:", error);
      toast.error("Failed to delete menu item");
    } finally {
      setDeleteId(null);
    }
  };

  const openNewForm = () => {
    setFormData({ ...defaultFormData, property_id: selectedProperty, categories: ["breakfast"] });
    setEditingId(null);
    setShowForm(true);
  };

  return (
    <AdminLayout>
      <div data-testid="admin-menu">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl text-[#264653] mb-2">Menu Items</h1>
            <p className="text-[#6B705C]">Manage your food and beverages menu</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Property Selector */}
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="w-48 rounded-xl border-[#E0DCD3]" data-testid="menu-property-selector">
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
            <Button onClick={openNewForm} className="btn-primary flex items-center gap-2" data-testid="add-menu-item" disabled={!selectedProperty}>
              <Plus className="w-5 h-5" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Categories Filter */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveCategory("all")}
            className={`category-pill whitespace-nowrap ${activeCategory === "all" ? "active" : ""}`}
            data-testid="filter-all"
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`category-pill whitespace-nowrap capitalize ${activeCategory === cat ? "active" : ""}`}
              data-testid={`filter-${cat}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Menu Items Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#E0DCD3] overflow-hidden">
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="w-16 h-16 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-1/3 mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#E0DCD3]">
            <p className="text-[#6B705C] mb-4">No menu items found</p>
            <Button onClick={openNewForm} className="btn-primary">
              Add Your First Item
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E0DCD3] overflow-hidden">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} data-testid={`menu-item-row-${item.id}`}>
                    <td>
                      <div className="flex items-center gap-4">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-12 h-12 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-[#F0EFEB] flex items-center justify-center">
                            <span className="text-[#6B705C] text-lg">🍽️</span>
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-[#264653] flex items-center gap-1">
                            {item.name}
                            {item.is_vegetarian && <Leaf className="w-4 h-4 text-green-600" />}
                          </p>
                          <p className="text-[#6B705C] text-sm line-clamp-1">{item.description}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="capitalize text-[#264653]">{item.category}</span>
                    </td>
                    <td>
                      <span className="font-bold text-[#2A9D8F]">₹{item.price}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${item.is_available ? "status-completed" : "status-pending"}`}>
                        {item.is_available ? "Available" : "Unavailable"}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B705C] hover:bg-[#F0EFEB] transition-colors"
                          data-testid={`edit-menu-item-${item.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-[#E76F51] hover:bg-[#E76F51]/10 transition-colors"
                          data-testid={`delete-menu-item-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-lg bg-white rounded-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-[#264653]">
                {editingId ? "Edit Menu Item" : "Add Menu Item"}
              </DialogTitle>
              <DialogDescription className="text-[#6B705C]">
                {editingId ? "Update the menu item details" : "Add a new item to your menu"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4" data-testid="menu-item-form">
              <div>
                <Label htmlFor="name" className="text-[#264653]">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="hm-input mt-1"
                  placeholder="Masala Chai"
                  required
                  data-testid="menu-name-input"
                />
              </div>

              <div>
                <Label htmlFor="category" className="text-[#264653]">Primary Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => {
                    const newCategories = formData.categories.includes(value) 
                      ? formData.categories 
                      : [...formData.categories, value];
                    setFormData({ ...formData, category: value, categories: newCategories });
                  }}
                >
                  <SelectTrigger className="hm-input mt-1" data-testid="menu-category-select">
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
                <Label className="text-[#264653]">Additional Categories (Multi-select)</Label>
                <p className="text-xs text-[#6B705C] mb-2">Item will show when any selected category is active</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {categories.map((cat) => (
                    <label
                      key={cat}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        formData.categories.includes(cat)
                          ? "bg-[#2A9D8F] text-white border-[#2A9D8F]"
                          : "bg-white text-[#264653] border-[#E0DCD3] hover:border-[#2A9D8F]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.categories.includes(cat)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, categories: [...formData.categories, cat] });
                          } else {
                            // Don't allow unchecking primary category
                            if (cat === formData.category) return;
                            setFormData({ 
                              ...formData, 
                              categories: formData.categories.filter(c => c !== cat) 
                            });
                          }
                        }}
                        className="sr-only"
                        data-testid={`category-checkbox-${cat}`}
                      />
                      <span className="capitalize text-sm">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="text-[#264653]">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="hm-input mt-1 min-h-[80px]"
                  placeholder="Traditional spiced tea..."
                  required
                  data-testid="menu-description-input"
                />
              </div>

              <div>
                <Label htmlFor="price" className="text-[#264653]">Price (₹) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="hm-input mt-1"
                  placeholder="50"
                  required
                  data-testid="menu-price-input"
                />
              </div>

              <div>
                <Label htmlFor="image_url" className="text-[#264653]">Image URL (optional)</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="hm-input mt-1"
                  placeholder="https://example.com/image.jpg"
                  data-testid="menu-image-input"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <Label htmlFor="is_vegetarian" className="text-[#264653]">Vegetarian</Label>
                <Switch
                  id="is_vegetarian"
                  checked={formData.is_vegetarian}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_vegetarian: checked })}
                  data-testid="menu-vegetarian-switch"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <Label htmlFor="is_available" className="text-[#264653]">Available</Label>
                <Switch
                  id="is_available"
                  checked={formData.is_available}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
                  data-testid="menu-available-switch"
                />
              </div>

              <Button
                type="submit"
                className="w-full btn-primary"
                disabled={submitting}
                data-testid="save-menu-item"
              >
                {submitting ? "Saving..." : (editingId ? "Update Item" : "Add Item")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent className="bg-white rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-serif text-xl text-[#264653]">
                Delete Menu Item?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[#6B705C]">
                This action cannot be undone. This will permanently delete the menu item.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="btn-destructive"
                data-testid="confirm-delete-menu"
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
