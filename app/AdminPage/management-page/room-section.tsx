"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Search, Edit, Trash2, MapPin, Users, Building } from "lucide-react";
import { toast } from "sonner";

interface Room {
  id: number;
  name: string;
  location: string | null;
  capacity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function RoomManagementSection() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    capacity: 1,
    isActive: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBust, setImageBust] = useState<number>(0);

  // Fetch rooms from API
  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/add-room?search=${searchTerm}`);
      const data = await response.json();

      if (data.success) {
        setRooms(data.data.rooms);
      } else {
        toast.error("Failed to fetch rooms");
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Error fetching rooms");
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  // Create new room
  const createRoom = async () => {
    try {
      const response = await fetch("/api/admin/add-room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Room created successfully!");
        const id: number | undefined = data?.data?.id;
        if (id && imageFile) {
          await uploadRoomImage(id);
        }
        setShowCreateDialog(false);
        setFormData({ name: "", location: "", capacity: 1, isActive: true });
        clearImage();
        fetchRooms();
      } else {
        toast.error(data.error || "Failed to create room");
      }
    } catch (error) {
      console.error("Error creating room:", error);
      toast.error("Error creating room");
    }
  };

  // Update room
  const updateRoom = async () => {
    if (!editingRoom) return;

    try {
      const response = await fetch(`/api/admin/add-room/${editingRoom.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Room updated successfully!");
        if (imageFile) {
          await uploadRoomImage(editingRoom.id);
        }
        setEditingRoom(null);
        setFormData({ name: "", location: "", capacity: 1, isActive: true });
        clearImage();
        fetchRooms();
      } else {
        toast.error(data.error || "Failed to update room");
      }
    } catch (error) {
      console.error("Error updating room:", error);
      toast.error("Error updating room");
    }
  };

  const uploadRoomImage = async (roomId: number) => {
    try {
      if (!imageFile) return;
      const fd = new FormData();
      fd.append("image", imageFile);
      const res = await fetch(`/api/admin/room-image/${roomId}`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (json?.success) {
        toast.success("Image uploaded");
        setImageBust(Date.now());
      } else {
        toast.error(json?.error || "Failed to upload image");
      }
    } catch (e) {
      console.error("Upload error", e);
      toast.error("Error uploading image");
    }
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setImageFile(null);
  };

  useEffect(() => {
    if (editingRoom) {
      setImageBust(Date.now());
    }
  }, [editingRoom]);

  // Delete room
  const deleteRoom = async (roomId: number) => {
    if (!confirm("Are you sure you want to delete this room?")) return;

    try {
      const response = await fetch(`/api/admin/add-room/${roomId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Room deleted successfully!");
        fetchRooms();
      } else {
        toast.error(data.error || "Failed to delete room");
      }
    } catch (error) {
      console.error("Error deleting room:", error);
      toast.error("Error deleting room");
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRoom) {
      updateRoom();
    } else {
      createRoom();
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({ name: "", location: "", capacity: 1, isActive: true });
    setEditingRoom(null);
    setShowCreateDialog(false);
    clearImage();
  };

  // Start editing room
  const startEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name,
      location: room.location || "",
      capacity: room.capacity,
      isActive: room.isActive,
    });
  };

  // Load rooms on component mount and when search changes
  useEffect(() => {
    fetchRooms();
  }, [searchTerm, fetchRooms]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Rooms</h2>
          <p className="text-muted-foreground">Manage meeting rooms and their settings</p>
        </div>

        <Dialog
          open={showCreateDialog || !!editingRoom}
          onOpenChange={(open) => {
            if (!open) {
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Room
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingRoom ? "Edit Room" : "Create New Room"}
              </DialogTitle>
              <DialogDescription>
                {editingRoom
                  ? "Update room information"
                  : "Add a new meeting room to the system"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Room Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Conference Room A"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="e.g., Building 1, Floor 2"
                />
              </div>

              {editingRoom && !imagePreview && (
                <div className="space-y-2">
                  <Label>Current Image</Label>
                  <div className="rounded-md overflow-hidden border w-full h-40 bg-gray-100">
                    <img
                      src={`/Room/${editingRoom.id}.jpg?v=${imageBust}`}
                      alt={editingRoom.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        if (!img.dataset.fallback) {
                          img.dataset.fallback = '1';
                          img.src = '/Room/default.jpg';
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="image">Room Image (jpg, png, webp)</Label>
                <input
                  id="image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (!file) {
                      clearImage();
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("Image too large (max 5MB)");
                      return;
                    }
                    const allowed = ["image/jpeg", "image/png", "image/webp"];
                    if (!allowed.includes(file.type)) {
                      toast.error("Only jpg, png, webp allowed");
                      return;
                    }
                    if (imagePreview) URL.revokeObjectURL(imagePreview);
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                {imagePreview ? (
                  <div className="mt-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-40 object-cover rounded-md border"
                    />
                    <div className="flex gap-2 mt-2">
                      <Button type="button" variant="outline" onClick={clearImage}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Optional. Will be resized and optimized.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      capacity: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                />
                <Label htmlFor="isActive">Active</Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingRoom ? "Update Room" : "Create Room"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search rooms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Rooms List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="text-muted-foreground">Loading rooms...</div>
        </div>
      ) : rooms.length === 0 ? (
        <Alert>
          <Building className="h-4 w-4" />
          <AlertDescription>
            No rooms found. Create your first room to get started.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Card key={room.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{room.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {room.location || "No location specified"}
                    </CardDescription>
                  </div>
                  <Badge variant={room.isActive ? "default" : "secondary"}>
                    {room.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Users className="h-4 w-4" />
                  <span>Capacity: {room.capacity} people</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(room)}
                    className="flex-1"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteRoom(room.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}



