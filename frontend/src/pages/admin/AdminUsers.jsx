import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/lib/api";
import { Plus, Trash2, Key, UserCog } from "lucide-react";

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "kitchen",
    property_id: "",
    whatsapp_numbers: []
  });
  
  const [newPassword, setNewPassword] = useState("");
  const [secretKey, setSecretKey] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, propsRes] = await Promise.all([
        api.get("/users"),
        api.get("/settings")
      ]);
      setUsers(usersRes.data);
      setProperties(propsRes.data);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) {
      toast.error("Username and password required");
      return;
    }
    
    try {
      await api.post("/auth/register", newUser);
      toast.success("User created");
      setShowAddDialog(false);
      setNewUser({ username: "", password: "", role: "kitchen", property_id: "", whatsapp_numbers: [] });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create user");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Delete this user?")) return;
    
    try {
      await api.delete(`/users/${userId}`);
      toast.success("User deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword) {
      toast.error("New password required");
      return;
    }
    
    try {
      const payload = { new_password: newPassword };
      if (selectedUser.role === "admin") {
        payload.secret_key = secretKey;
      }
      
      await api.put(`/users/${selectedUser.id}/password`, payload);
      toast.success("Password updated");
      setShowPasswordDialog(false);
      setNewPassword("");
      setSecretKey("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update password");
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      admin: "bg-purple-100 text-purple-800",
      manager: "bg-blue-100 text-blue-800",
      kitchen: "bg-green-100 text-green-800"
    };
    return <Badge className={colors[role] || "bg-gray-100"}>{role}</Badge>;
  };

  return (
    <AdminLayout title="User Management">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-[#264653]">Staff Accounts</h2>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-[#2A9D8F]">
                <Plus className="w-4 h-4 mr-2" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Username</Label>
                  <Input
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Enter password"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin (All Properties)</SelectItem>
                      <SelectItem value="manager">Manager (Staff 2)</SelectItem>
                      <SelectItem value="kitchen">Kitchen (Staff 1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newUser.role !== "admin" && (
                  <div>
                    <Label>Property</Label>
                    <Select value={newUser.property_id} onValueChange={(v) => setNewUser({ ...newUser, property_id: v })}>
                      <SelectTrigger>
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
                )}
                <div>
                  <Label>WhatsApp Numbers (comma separated)</Label>
                  <Input
                    value={newUser.whatsapp_numbers.join(", ")}
                    onChange={(e) => setNewUser({ 
                      ...newUser, 
                      whatsapp_numbers: e.target.value.split(",").map(n => n.trim()).filter(n => n)
                    })}
                    placeholder="+919876543210, +919876543211"
                  />
                </div>
                <Button onClick={handleAddUser} className="w-full bg-[#2A9D8F]">
                  Create User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No users found. Add your first staff member.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {users.map((user) => (
              <Card key={user.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#264653] flex items-center justify-center text-white font-semibold">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{user.username}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getRoleBadge(user.role)}
                        {user.property_id && (
                          <span className="text-sm text-gray-500">{user.property_id}</span>
                        )}
                      </div>
                      {user.whatsapp_numbers?.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          {user.whatsapp_numbers.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowPasswordDialog(true);
                      }}
                    >
                      <Key className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Password Change Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Password for {selectedUser?.username}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              {selectedUser?.role === "admin" && (
                <div>
                  <Label>Admin Secret Key</Label>
                  <Input
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="Enter secret key"
                  />
                  <p className="text-xs text-gray-500 mt-1">Required to change admin password</p>
                </div>
              )}
              <Button onClick={handleChangePassword} className="w-full bg-[#2A9D8F]">
                Update Password
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
