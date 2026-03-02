import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "@/lib/api";
import { QrCode, Download, ExternalLink, Copy } from "lucide-react";

export default function AdminQRCodes() {
  const [qrCodes, setQrCodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQRCodes();
  }, []);

  const fetchQRCodes = async () => {
    try {
      const res = await api.get("/qr-codes");
      setQrCodes(res.data);
    } catch (error) {
      toast.error("Failed to load QR codes");
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = async (slug, propertyName) => {
    try {
      const response = await api.get(`/qr/${slug}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${slug}_qr.png`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded QR for ${propertyName}`);
    } catch (error) {
      // Fallback: open QR in new tab for manual download
      window.open(`${BACKEND_URL}/api/qr/${slug}`, '_blank');
      toast.info("QR code opened in new tab - right-click to save");
    }
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard");
  };

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-qr-codes">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-serif text-[#264653]">QR Codes</h1>
            <p className="text-[#6B705C]">Generate QR codes for guest check-in</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2A9D8F]"></div>
          </div>
        ) : qrCodes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <QrCode className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No properties with URL slugs found.</p>
              <p className="text-sm text-gray-400 mt-2">Add property slugs in Settings to generate QR codes.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {qrCodes.map((qr) => (
              <Card key={qr.property_id} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-[#2A9D8F]/10 to-[#F4A261]/10">
                  <CardTitle className="text-lg font-serif text-[#264653]">
                    {qr.property_name}
                  </CardTitle>
                  <p className="text-sm text-[#6B705C]">/{qr.property_slug}</p>
                </CardHeader>
                <CardContent className="p-6">
                  {/* QR Code Preview */}
                  <div className="bg-white rounded-lg p-4 mb-4 flex justify-center border">
                    <img 
                      src={`${BACKEND_URL}/api/qr/${qr.property_slug}`}
                      alt={`QR Code for ${qr.property_name}`}
                      className="w-48 h-48"
                      data-testid={`qr-image-${qr.property_slug}`}
                    />
                  </div>
                  
                  {/* Property URL */}
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Guest URL</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm text-[#264653] flex-1 truncate">
                        {qr.property_url}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyUrl(qr.property_url)}
                        data-testid={`copy-url-${qr.property_slug}`}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-[#2A9D8F] hover:bg-[#238577]"
                      onClick={() => downloadQR(qr.property_slug, qr.property_name)}
                      data-testid={`download-qr-${qr.property_slug}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(qr.property_url, '_blank')}
                      data-testid={`open-url-${qr.property_slug}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Usage Instructions */}
        <Card className="bg-[#F8F9FA]">
          <CardContent className="py-6">
            <h3 className="font-semibold text-[#264653] mb-3 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#2A9D8F]" />
              How to Use QR Codes
            </h3>
            <ul className="space-y-2 text-sm text-[#6B705C]">
              <li>• <strong>Print & Display:</strong> Download and print QR codes for each property</li>
              <li>• <strong>Room Placement:</strong> Place in rooms, reception, or common areas</li>
              <li>• <strong>Guest Access:</strong> Guests scan to access property info, menu, and services</li>
              <li>• <strong>No App Required:</strong> Works with any smartphone camera</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
