"use client";

import React, { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send } from "lucide-react";

interface Environment {
  id: number;
  name: string;
}

interface ForwardBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: number;
  onForwardComplete: () => void;
}

export default function ForwardBookingDialog({
  open,
  onOpenChange,
  bookingId,
  onForwardComplete,
}: ForwardBookingDialogProps) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvIds, setSelectedEnvIds] = useState<number[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingEnvs, setLoadingEnvs] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  // Load available environments when dialog opens
  useEffect(() => {
    if (!open) return;

    const loadEnvironments = async () => {
      try {
        setLoadingEnvs(true);
        
        // Get all environments
        const envsRes = await fetch(`/api/environments`);
        if (!envsRes.ok) {
          throw new Error(`Failed to load environments (${envsRes.status})`);
        }
        const allEnvs = await envsRes.json();

        // Get current user's admin environments
        const meRes = await fetch(`/api/auth/me`, { cache: 'no-store' });
        if (!meRes.ok) {
          throw new Error('Failed to get user info');
        }
        const meData = await meRes.json();
        const myEnvIds = new Set<number>((meData?.adminEnvIds ?? []) as number[]);

        // Filter out user's own environments
        const availableEnvs = (allEnvs as Environment[]).filter(
          (env) => !myEnvIds.has(env.id)
        );

        setEnvironments(availableEnvs);
      } catch (error) {
        console.error('Failed to load environments:', error);
        alert('Failed to load environments. Please try again.');
      } finally {
        setLoadingEnvs(false);
      }
    };

    loadEnvironments();
  }, [open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedEnvIds([]);
      setReason("");
      setSelectAll(false);
    }
  }, [open]);

  // Handle select all toggle
  const handleSelectAllChange = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedEnvIds(environments.map(env => env.id));
    } else {
      setSelectedEnvIds([]);
    }
  };

  // Handle individual environment selection
  const handleEnvironmentToggle = (envId: number) => {
    setSelectedEnvIds(prev => {
      const newSelection = prev.includes(envId)
        ? prev.filter(id => id !== envId)
        : [...prev, envId];
      
      // Update select all state
      setSelectAll(newSelection.length === environments.length);
      
      return newSelection;
    });
  };

  // Handle form submission
  const handleForward = async () => {
    if (selectedEnvIds.length === 0) {
      alert('Please select at least one environment to forward to.');
      return;
    }

    if (!reason.trim()) {
      alert('Please provide a reason for forwarding.');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`/api/admin/bookings/${bookingId}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          environmentIds: selectedEnvIds, 
          note: reason.trim() 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Forward failed (${response.status})`);
      }

      // Success
      onForwardComplete();
      onOpenChange(false);
      
    } catch (error) {
      console.error('Forward error:', error);
      alert((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Forward Booking Request
          </AlertDialogTitle>
          <AlertDialogDescription>
            Select the environments to forward this booking request to and provide a reason.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-6 py-4">
          {/* Environment Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-900">
              Forward to Environments:
            </Label>
            
            {loadingEnvs ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-gray-600">Loading environments...</span>
              </div>
            ) : environments.length === 0 ? (
              <div className="text-sm text-gray-500 py-4">
                No other environments available to forward to.
              </div>
            ) : (
              <div className="space-y-2">
                {/* Select All Option */}
                <div className="flex items-center space-x-2 p-2 border rounded-lg bg-gray-50">
                  <Checkbox
                    id="select-all"
                    checked={selectAll}
                    onCheckedChange={handleSelectAllChange}
                  />
                  <Label htmlFor="select-all" className="font-medium">
                    Select All ({environments.length} environments)
                  </Label>
                </div>

                {/* Individual Environment Options */}
                <div className="max-h-40 overflow-y-auto border rounded-lg">
                  {environments.map((env) => (
                    <div
                      key={env.id}
                      className="flex items-center space-x-2 p-3 hover:bg-gray-50 border-b last:border-b-0"
                    >
                      <Checkbox
                        id={`env-${env.id}`}
                        checked={selectedEnvIds.includes(env.id)}
                        onCheckedChange={() => handleEnvironmentToggle(env.id)}
                      />
                      <Label htmlFor={`env-${env.id}`} className="flex-1 cursor-pointer">
                        <span className="font-medium">{env.name}</span>
                        <span className="text-sm text-gray-500 ml-2">(ID: {env.id})</span>
                      </Label>
                    </div>
                  ))}
                </div>

                {/* Selection Summary */}
                {selectedEnvIds.length > 0 && (
                  <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                    Selected: {selectedEnvIds.length} environment{selectedEnvIds.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-semibold text-gray-900">
              Reason for Forwarding: <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Please explain why you are forwarding this booking request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <div className="text-xs text-gray-500">
              This reason will be visible to the receiving administrators.
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleForward}
            disabled={loading || selectedEnvIds.length === 0 || !reason.trim()}
            className="min-w-[100px]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Forwarding...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Forward
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
