'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  Info,
  History,
  TrendingUp,
  Users
} from 'lucide-react';
import { ConfigValidationPanel } from './ConfigValidationPanel';
import { RealTimeConfigFeedback } from './RealTimeConfigFeedback';
import type { AssignmentPolicy } from '@/types/assignment';

interface ConfigValidationUIProps {
  initialConfig?: Partial<AssignmentPolicy>;
  onConfigChange?: (config: Partial<AssignmentPolicy>) => void;
  onSave?: (config: Partial<AssignmentPolicy>) => Promise<void>;
}

interface ConfigRecommendations {
  mode: AssignmentPolicy['mode'];
  recommendations: {
    description: string;
    recommendedPenalty: number;
    keyFeatures: string[];
    bestUseCases: string[];
    potentialIssues: string[];
  };
  defaults: {
    fairnessWindowDays: number;
    maxGapHours: number;
    drConsecutivePenalty: number;
    w_fair: number;
    w_urgency: number;
    w_lrs: number;
  };
}

export function ConfigValidationUI({ 
  initialConfig = {}, 
  onConfigChange, 
  onSave 
}: ConfigValidationUIProps) {
  const [config, setConfig] = useState<Partial<AssignmentPolicy>>(initialConfig);
  const [currentConfig, setCurrentConfig] = useState<AssignmentPolicy>({
    autoAssignEnabled: true,
    mode: 'NORMAL',
    fairnessWindowDays: 30,
    maxGapHours: 5,
    w_fair: 1.2,
    w_urgency: 0.8,
    w_lrs: 0.3,
    drConsecutivePenalty: -0.5
  });
  const [recommendations, setRecommendations] = useState<ConfigRecommendations | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changeHistory, setChangeHistory] = useState<any[]>([]);

  // Load current configuration on mount
  useEffect(() => {
    loadCurrentConfig();
    loadChangeHistory();
  }, []);

  // Load recommendations when mode changes
  useEffect(() => {
    if (config.mode) {
      loadRecommendations(config.mode);
    }
  }, [config.mode]);

  const loadCurrentConfig = async () => {
    try {
      const response = await fetch('/api/admin/config/auto-assign');
      if (response.ok) {
        const data = await response.json();
        setCurrentConfig(data.policy);
      }
    } catch (err) {
      console.error('Error loading current config:', err);
    }
  };

  const loadRecommendations = async (mode: AssignmentPolicy['mode']) => {
    try {
      const response = await fetch(`/api/admin/config/validate/recommendations?mode=${mode}`);
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data);
      }
    } catch (err) {
      console.error('Error loading recommendations:', err);
    }
  };

  const loadChangeHistory = async () => {
    try {
      const response = await fetch('/api/admin/config/change-log?limit=10');
      if (response.ok) {
        const data = await response.json();
        setChangeHistory(data.logs || []);
      }
    } catch (err) {
      console.error('Error loading change history:', err);
    }
  };

  const handleConfigChange = (field: keyof AssignmentPolicy, value: any) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const applyRecommendedDefaults = () => {
    if (!recommendations) return;

    const newConfig = {
      ...config,
      ...recommendations.defaults
    };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    setError(null);

    try {
      await onSave(config);
      await loadCurrentConfig();
      await loadChangeHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    setConfig({});
    onConfigChange?.({});
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Pool Configuration Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="configuration" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="configuration">Configuration</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="configuration" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Basic Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Basic Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mode">Assignment Mode</Label>
                      <Select
                        value={config.mode || currentConfig.mode}
                        onValueChange={(value) => handleConfigChange('mode', value as AssignmentPolicy['mode'])}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NORMAL">Normal</SelectItem>
                          <SelectItem value="BALANCE">Balance</SelectItem>
                          <SelectItem value="URGENT">Urgent</SelectItem>
                          <SelectItem value="CUSTOM">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fairnessWindow">Fairness Window (days)</Label>
                      <Input
                        id="fairnessWindow"
                        type="number"
                        min="7"
                        max="90"
                        value={config.fairnessWindowDays ?? currentConfig.fairnessWindowDays}
                        onChange={(e) => handleConfigChange('fairnessWindowDays', parseInt(e.target.value))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxGap">Max Gap Hours</Label>
                      <Input
                        id="maxGap"
                        type="number"
                        min="1"
                        max="100"
                        value={config.maxGapHours ?? currentConfig.maxGapHours}
                        onChange={(e) => handleConfigChange('maxGapHours', parseInt(e.target.value))}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Scoring Weights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Scoring Weights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="wFair">Fairness Weight</Label>
                      <Input
                        id="wFair"
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value={config.w_fair ?? currentConfig.w_fair}
                        onChange={(e) => handleConfigChange('w_fair', parseFloat(e.target.value))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wUrgency">Urgency Weight</Label>
                      <Input
                        id="wUrgency"
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value={config.w_urgency ?? currentConfig.w_urgency}
                        onChange={(e) => handleConfigChange('w_urgency', parseFloat(e.target.value))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wLrs">LRS Weight</Label>
                      <Input
                        id="wLrs"
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value={config.w_lrs ?? currentConfig.w_lrs}
                        onChange={(e) => handleConfigChange('w_lrs', parseFloat(e.target.value))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="drPenalty">DR Consecutive Penalty</Label>
                      <Input
                        id="drPenalty"
                        type="number"
                        min="-2"
                        max="0"
                        step="0.1"
                        value={config.drConsecutivePenalty ?? currentConfig.drConsecutivePenalty}
                        onChange={(e) => handleConfigChange('drConsecutivePenalty', parseFloat(e.target.value))}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Real-time feedback */}
              <RealTimeConfigFeedback
                config={config}
                currentConfig={currentConfig}
              />

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Configuration
                    </>
                  )}
                </Button>
                
                {recommendations && (
                  <Button variant="outline" onClick={applyRecommendedDefaults}>
                    Apply Recommended Defaults
                  </Button>
                )}
                
                <Button variant="outline" onClick={resetToDefaults}>
                  Reset to Current
                </Button>
              </div>

              {error && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="validation">
              <ConfigValidationPanel
                config={config}
                autoValidate={true}
              />
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-4">
              {recommendations ? (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {recommendations.mode} Mode Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-600">
                        {recommendations.recommendations.description}
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">Key Features</h4>
                          <ul className="text-sm space-y-1">
                            {recommendations.recommendations.keyFeatures.map((feature, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <CheckCircle className="h-3 w-3 mt-1 text-green-500 flex-shrink-0" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Best Use Cases</h4>
                          <ul className="text-sm space-y-1">
                            {recommendations.recommendations.bestUseCases.map((useCase, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <TrendingUp className="h-3 w-3 mt-1 text-blue-500 flex-shrink-0" />
                                {useCase}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {recommendations.recommendations.potentialIssues.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Potential Issues</h4>
                          <ul className="text-sm space-y-1">
                            {recommendations.recommendations.potentialIssues.map((issue, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <AlertTriangle className="h-3 w-3 mt-1 text-yellow-500 flex-shrink-0" />
                                {issue}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="pt-4 border-t">
                        <h4 className="font-medium mb-2">Recommended Settings</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Fairness Window:</span>
                            <div className="font-medium">{recommendations.defaults.fairnessWindowDays} days</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Max Gap:</span>
                            <div className="font-medium">{recommendations.defaults.maxGapHours} hours</div>
                          </div>
                          <div>
                            <span className="text-gray-600">DR Penalty:</span>
                            <div className="font-medium">{recommendations.defaults.drConsecutivePenalty}</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Info className="h-12 w-12 mx-auto mb-2" />
                  <p>Select a mode to see recommendations</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Configuration Change History</h3>
                <Button variant="outline" size="sm" onClick={loadChangeHistory}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {changeHistory.length > 0 ? (
                <div className="space-y-2">
                  {changeHistory.map((change, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            <span className="font-medium">{change.changeType || 'Configuration Change'}</span>
                            <Badge variant="outline">
                              {new Date(change.timestamp).toLocaleDateString()}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            {new Date(change.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          {change.reason || 'No reason provided'}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <History className="h-12 w-12 mx-auto mb-2" />
                  <p>No configuration changes recorded</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}