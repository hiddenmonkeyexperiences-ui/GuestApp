import { useState, useRef } from "react";
import { Upload, X, Loader2, Image as ImageIcon, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import api from "@/lib/api";

/**
 * ImageUpload Component
 * 
 * Supports both:
 * 1. Direct file upload to Cloudinary
 * 2. Pasting external URLs (Unsplash, Pexels, etc.)
 * 
 * Props:
 * - value: Current image URL
 * - onChange: Callback when image URL changes
 * - folder: Cloudinary folder (default: "hidden_monkey")
 * - label: Label text
 * - placeholder: Placeholder text
 */
export default function ImageUpload({ 
  value = "", 
  onChange, 
  folder = "hidden_monkey",
  label = "Image",
  placeholder = "Upload or paste image URL"
}) {
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState("upload"); // "upload" or "url"
  const [urlInput, setUrlInput] = useState(value || "");
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    setUploading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result;
        
        // Upload to Cloudinary via backend
        const response = await api.post("/cloudinary/upload", {
          image: base64,
          folder: folder,
        });

        if (response.data.success) {
          onChange(response.data.url);
          toast.success("Image uploaded!");
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) {
      toast.error("Please enter an image URL");
      return;
    }
    
    // Basic URL validation
    if (!urlInput.startsWith("http")) {
      toast.error("Please enter a valid URL starting with http:// or https://");
      return;
    }

    onChange(urlInput.trim());
    toast.success("Image URL saved!");
  };

  const handleClear = () => {
    onChange("");
    setUrlInput("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#264653]">{label}</label>
      
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex items-center gap-1 px-3 py-1 text-sm rounded-lg transition-colors ${
            mode === "upload" 
              ? "bg-[#0D7377] text-white" 
              : "bg-[#F0EFEB] text-[#636E72] hover:bg-[#E0DCD3]"
          }`}
        >
          <Upload className="w-3 h-3" />
          Upload
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex items-center gap-1 px-3 py-1 text-sm rounded-lg transition-colors ${
            mode === "url" 
              ? "bg-[#0D7377] text-white" 
              : "bg-[#F0EFEB] text-[#636E72] hover:bg-[#E0DCD3]"
          }`}
        >
          <Link className="w-3 h-3" />
          URL
        </button>
      </div>

      {mode === "upload" ? (
        /* File Upload Mode */
        <div className="space-y-2">
          <div 
            className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
              uploading ? "border-[#0D7377] bg-[#0D7377]/5" : "border-[#E0DCD3] hover:border-[#0D7377]"
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <Loader2 className="w-8 h-8 text-[#0D7377] animate-spin" />
                <span className="text-sm text-[#636E72]">Uploading...</span>
              </div>
            ) : (
              <label className="cursor-pointer block py-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="w-8 h-8 mx-auto text-[#636E72] mb-2" />
                <p className="text-sm text-[#636E72]">
                  Click to upload or drag & drop
                </p>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  PNG, JPG, WebP up to 10MB
                </p>
              </label>
            )}
          </div>
        </div>
      ) : (
        /* URL Input Mode */
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={placeholder}
            className="flex-1"
          />
          <Button 
            type="button" 
            onClick={handleUrlSubmit}
            className="btn-primary"
          >
            Save
          </Button>
        </div>
      )}

      {/* Preview */}
      {value && (
        <div className="relative mt-2">
          <img 
            src={value} 
            alt="Preview" 
            className="w-full h-32 object-cover rounded-lg border border-[#E0DCD3]"
            onError={(e) => {
              e.target.style.display = 'none';
              toast.error("Failed to load image preview");
            }}
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <p className="text-xs text-[#9CA3AF] mt-1 truncate">{value}</p>
        </div>
      )}
    </div>
  );
}
