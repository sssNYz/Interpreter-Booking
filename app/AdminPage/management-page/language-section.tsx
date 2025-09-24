'use client';

import React, { useState, useEffect } from "react";
import { Languages, Plus, Edit3, Trash2, Search, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

// Types
interface Language {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LanguageFormData {
  code: string;
  name: string;
  isActive: boolean;
}

// Language Management Component
export default function LanguageManagement() {
  // Data state
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<Language | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<LanguageFormData>({
    code: "",
    name: "",
    isActive: true,
  });

  // Load languages on component mount
  useEffect(() => {
    loadLanguages();
  }, []);

  // Load languages from API
  const loadLanguages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/language');
      if (!response.ok) {
        throw new Error('Failed to load languages');
      }
      const data = await response.json();
      setLanguages(data);
    } catch (error) {
      console.error('Error loading languages:', error);
      toast.error('Failed to load languages');
    } finally {
      setLoading(false);
    }
  };

  // Filter languages based on search term and status
  const filteredLanguages = languages
    .filter(lang =>
      lang.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(lang => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return lang.isActive;
      return !lang.isActive;
    });

  // Handle form input changes
  const handleInputChange = (field: keyof LanguageFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      isActive: true,
    });
  };

  // Handle add language
  const handleAddLanguage = async () => {
    try {
      if (!formData.code.trim() || !formData.name.trim()) {
        toast.error('Code and name are required');
        return;
      }

      const response = await fetch('/api/language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add language');
      }

      toast.success('Language added successfully');
      setIsAddDialogOpen(false);
      resetForm();
      loadLanguages();
    } catch (error: unknown) {
      console.error('Error adding language:', error);
      const message = error instanceof Error ? error.message : 'Failed to add language';
      toast.error(message);
    }
  };

  // Handle edit language
  const handleEditLanguage = async () => {
    try {
      if (!editingLanguage || !formData.code.trim() || !formData.name.trim()) {
        toast.error('Code and name are required');
        return;
      }

      const response = await fetch('/api/language', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingLanguage.id,
          ...formData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update language');
      }

      toast.success('Language updated successfully');
      setIsEditDialogOpen(false);
      setEditingLanguage(null);
      resetForm();
      loadLanguages();
    } catch (error: unknown) {
      console.error('Error updating language:', error);
      const message = error instanceof Error ? error.message : 'Failed to update language';
      toast.error(message);
    }
  };

  // Quick toggle active state from the table
  const handleToggleActive = async (language: Language) => {
    try {
      const response = await fetch('/api/language', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: language.id, isActive: !language.isActive }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update status');
      }
      // Optimistic update
      setLanguages(prev => prev.map(l => l.id === language.id ? { ...l, isActive: !l.isActive } : l));
      toast.success(`Language ${!language.isActive ? 'activated' : 'deactivated'}`);
    } catch (error: unknown) {
      console.error('Error toggling language status:', error);
      const message = error instanceof Error ? error.message : 'Failed to update status';
      toast.error(message);
    }
  };

  // Handle delete language
  const handleDeleteLanguage = async (id: number) => {
    if (!confirm('Are you sure you want to delete this language?')) {
      return;
    }

    try {
      const response = await fetch(`/api/language?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete language');
      }

      toast.success('Language deleted successfully');
      loadLanguages();
    } catch (error: unknown) {
      console.error('Error deleting language:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete language';
      toast.error(message);
    }
  };

  // Open edit dialog
  const openEditDialog = (language: Language) => {
    setEditingLanguage(language);
    setFormData({
      code: language.code,
      name: language.name,
      isActive: language.isActive,
    });
    setIsEditDialogOpen(true);
  };

  // Stats
  const totalLanguages = languages.length;
  const activeLanguages = languages.filter(lang => lang.isActive).length;
  const inactiveLanguages = totalLanguages - activeLanguages;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Languages</p>
                <p className="text-3xl font-bold">{totalLanguages}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 grid place-items-center">
                <Languages className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Languages</p>
                <p className="text-3xl font-bold text-green-600">{activeLanguages}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 grid place-items-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Inactive Languages</p>
                <p className="text-3xl font-bold text-red-600">{inactiveLanguages}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 grid place-items-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Languages Section */}
      <Card className="shadow-sm rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Languages</CardTitle>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Language
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Language</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="code">Language Code</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => handleInputChange('code', e.target.value)}
                      placeholder="e.g., EN, JP, TH"
                      className="uppercase"
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">Language Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="e.g., English, Japanese, Thai"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddLanguage}>
                      Add Language
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filter */}
          <div className="mb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative md:w-1/2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search languages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => setStatusFilter('all')}>All</Button>
                <Button variant={statusFilter === 'active' ? 'default' : 'outline'} onClick={() => setStatusFilter('active')}>Active</Button>
                <Button variant={statusFilter === 'inactive' ? 'default' : 'outline'} onClick={() => setStatusFilter('inactive')}>Inactive</Button>
              </div>
            </div>
          </div>

          {/* Languages Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading languages...
                    </TableCell>
                  </TableRow>
                ) : filteredLanguages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      No languages found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLanguages.map((language) => (
                    <TableRow key={language.id} className="border-b hover:bg-gray-50">
                      <TableCell className="font-medium">{language.code}</TableCell>
                      <TableCell>{language.name}</TableCell>
                      <TableCell>
                        <Badge
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            language.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {language.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(language.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Switch
                            checked={language.isActive}
                            onCheckedChange={() => handleToggleActive(language)}
                            aria-label="Toggle active"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(language)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteLanguage(language.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Language</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-code">Language Code</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value)}
                placeholder="e.g., EN, JP, TH"
                className="uppercase"
              />
            </div>
            <div>
              <Label htmlFor="edit-name">Language Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., English, Japanese, Thai"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditLanguage}>
                Update Language
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
