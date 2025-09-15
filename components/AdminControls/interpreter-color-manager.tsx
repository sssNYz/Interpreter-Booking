"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Save, Palette } from "lucide-react";

interface Interpreter {
  id: string;
  name: string;
  type?: "current" | "historic";
}

interface ColorData {
  [interpreterId: string]: string;
}

const COLOR_PALETTE = [
  // Blues (light to dark)
  "#8ecae6", "#219ebc", "#126782", "#023047",
  // Teals/Greens (light to dark)
  "#2a9d8f", "#287271", "#264653", "#8ab17d",
  // Yellows/Oranges (light to dark)
  "#babb74", "#e9c46a", "#ffb703", "#fd9e02",
  // Oranges/Reds (light to dark)
  "#efb366", "#f4a261", "#fb8500", "#bb3e03",
  // Reds (light to dark)
  "#ee8959", "#e76f51", "#ae2012", "#9b2226"
];

export default function InterpreterColorManager() {
  const [currentInterpreters, setCurrentInterpreters] = useState<Interpreter[]>([]);
  const [historicInterpreters, setHistoricInterpreters] = useState<Interpreter[]>([]);
  const [colors, setColors] = useState<ColorData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch interpreters and current colors
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [interpretersRes, colorsRes] = await Promise.all([
          fetch("/api/admin/interpreters?includeHistoric=1"),
          fetch("/api/admin/interpreter-colors"),
        ]);

        if (!interpretersRes.ok || !colorsRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const interpretersData = await interpretersRes.json();
        const colorsData = await colorsRes.json();

        // Handle new API structure with current and historic sections
        if (interpretersData.data.current && interpretersData.data.historic) {
          setCurrentInterpreters(interpretersData.data.current);
          setHistoricInterpreters(interpretersData.data.historic);
        } else {
          // Fallback for old API structure (backward compatibility)
          setCurrentInterpreters(interpretersData.data);
          setHistoricInterpreters([]);
        }
        setColors(colorsData.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleColorChange = (interpreterId: string, color: string) => {
    setColors(prev => ({
      ...prev,
      [interpreterId]: color,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const allInterpreters = [...currentInterpreters, ...historicInterpreters];
      const updates = allInterpreters.map(interpreter => ({
        interpreterId: interpreter.id,
        color: colors[interpreter.id] || null,
      }));

      const response = await fetch("/api/admin/interpreter-colors", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        throw new Error("Failed to save colors");
      }

      const result = await response.json();
      setColors(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save colors");
    } finally {
      setSaving(false);
    }
  };

  const getInterpreterColor = (interpreterId: string) => {
    return colors[interpreterId] || "#e5e7eb"; // gray-200 as default
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading interpreters...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">Error: {error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-2"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">

        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-neutral-600 hover:bg-neutral-900"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? "Saving..." : "Save Colors"}
        </Button>
      </div>

      {/* Current Interpreters Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-gray-900">Current Interpreters</h2>
          <Badge variant="default" className="bg-green-100 text-green-800">
            {currentInterpreters.length}
          </Badge>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {currentInterpreters.map((interpreter) => (
            <InterpreterCard 
              key={interpreter.id} 
              interpreter={interpreter} 
              colors={colors}
              onColorChange={handleColorChange}
              getInterpreterColor={getInterpreterColor}
            />
          ))}
        </div>
      </div>

      {/* Historic Interpreters Section */}
      {historicInterpreters.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">Historic Interpreters</h2>
            <Badge variant="secondary" className="bg-gray-100 text-gray-800">
              {historicInterpreters.length}
            </Badge>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {historicInterpreters.map((interpreter) => (
              <InterpreterCard 
                key={interpreter.id} 
                interpreter={interpreter} 
                colors={colors}
                onColorChange={handleColorChange}
                getInterpreterColor={getInterpreterColor}
                isHistoric={true}
              />
            ))}
          </div>
        </div>
      )}

      {currentInterpreters.length === 0 && historicInterpreters.length === 0 && (
        <div className="text-center py-8">
          <Palette className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No interpreters found</p>
        </div>
      )}
    </div>
  );
}

// Separate component for interpreter cards
function InterpreterCard({ 
  interpreter, 
  colors, 
  onColorChange, 
  getInterpreterColor, 
  isHistoric = false 
}: {
  interpreter: Interpreter;
  colors: ColorData;
  onColorChange: (id: string, color: string) => void;
  getInterpreterColor: (id: string) => string;
  isHistoric?: boolean;
}) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  return (
    <Card className={`relative ${isHistoric ? 'opacity-75' : ''}`}>
      
        <CardContent className="py-3">
          <div className="flex justify-between items-center">
            {/* Left side - Name and ID */}
            <div>
              <p className="text-lg font-semibold text-gray-900">{interpreter.name}</p>
              <Badge variant="outline" className="w-fit">
          ID: {interpreter.id}
        </Badge>
            </div>
            
            {/* Right side - Just color */}
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <button className="p-1 rounded-lg hover:bg-gray-50 transition-colors">
                  <div
                    className="w-8 h-8 rounded-full border border-gray-300 cursor-pointer hover:scale-105 transition-transform"
                    style={{ backgroundColor: getInterpreterColor(interpreter.id) }}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-900">Choose Color</h4>
                  
                  {/* Color Palette */}
                  <div className="grid grid-cols-4 gap-2">
                    {COLOR_PALETTE.map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          onColorChange(interpreter.id, color);
                          setIsPopoverOpen(false);
                        }}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                          colors[interpreter.id] === color
                            ? "border-gray-900 ring-2 ring-gray-300"
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>

                  {/* Clear Color Button */}
                  {colors[interpreter.id] && (
                    <Button
                      onClick={() => {
                        onColorChange(interpreter.id, "");
                        setIsPopoverOpen(false);
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Use Auto Color
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
    </Card>
  );
}
