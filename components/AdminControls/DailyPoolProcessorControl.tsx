"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Play, Square, Zap, Settings, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface ProcessorStatus {
  isRunning: boolean;
  processingIntervalMs: number;
  lastProcessingTime: Date | null;
  nextProcessingTime: Date | null;
  recentErrors: Array<{ timestamp: Date; error: string }>;
}

interface ProcessingStatistics {
  poolSize: number;
  readyForProcessing: number;
  deadlineEntries: number;
  failedEntries: number;
  oldestEntry: Date | null;
  processingNeeded: boolean;
  lastProcessingTime: Date | null;
  nextProcessingTime: Date | null;
  recentErrorCount: number;
}

interface DailyProcessingResult {
  processedCount: number;
  assignedCount: number;
  escalatedCount: number;
  failedCount: number;
  processingTime: number;
  nextScheduledRun: Date;
  batchId: string;
  errors: string[];
}

export default function DailyPoolProcessorControl() {
  const [status, setStatus] = useState<ProcessorStatus | null>(null);
  const [statistics, setStatistics] = useState<ProcessingStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<DailyProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch current status and statistics
  const fetchStatus = async () => {
    try {
      setError(null);
      const response = await fetch('/api/admin/pool/daily-processor');
      const data = await response.json();

      if (data.success) {
        setStatus(data.data.processor?.status || null);
        setStatistics(data.data.statistics || null);
      } else {
        setError(data.error || 'Failed to fetch status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Execute processor action
  const executeAction = async (action: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/pool/daily-processor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (data.success) {
        if (action === 'process_now' && data.data.result) {
          setLastResult(data.data.result);
        }
        await fetchStatus(); // Refresh status
      } else {
        setError(data.error || `Failed to execute ${action}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh status every 30 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30300);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
  };

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getStatusBadge = () => {
    if (!status) return <Badge variant="secondary">Unknown</Badge>;
    
    if (status.isRunning) {
      if (status.recentErrors.length > 0) {
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Running (Errors)</Badge>;
      }
      return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Running</Badge>;
    }
    
    return <Badge variant="secondary"><Square className="w-3 h-3 mr-1" />Stopped</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Daily Pool Processor</h2>
          <p className="text-muted-foreground">Monitor and control the daily pool processing scheduler</p>
        </div>
        <Button onClick={fetchStatus} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center text-destructive">
              <AlertCircle className="w-4 h-4 mr-2" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Processor Status
            {getStatusBadge()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Processing Interval</label>
                  <p className="text-lg">{formatDuration(status.processingIntervalMs)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Recent Errors</label>
                  <p className="text-lg">{status.recentErrors.length}</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Processing</label>
                  <p className="text-sm">{formatDate(status.lastProcessingTime)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Next Processing</label>
                  <p className="text-sm">{formatDate(status.nextProcessingTime)}</p>
                </div>
              </div>

              {/* Recent Errors */}
              {status.recentErrors.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Recent Errors</label>
                  <div className="mt-2 space-y-1">
                    {status.recentErrors.slice(0, 3).map((error, index) => (
                      <div key={index} className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                        <div className="font-medium">{formatDate(error.timestamp)}</div>
                        <div>{error.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Processor status not available</p>
          )}
        </CardContent>
      </Card>

      {/* Statistics Card */}
      <Card>
        <CardHeader>
          <CardTitle>Pool Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {statistics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{statistics.poolSize}</div>
                <div className="text-sm text-muted-foreground">Total in Pool</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{statistics.readyForProcessing}</div>
                <div className="text-sm text-muted-foreground">Ready</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{statistics.deadlineEntries}</div>
                <div className="text-sm text-muted-foreground">Deadline</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{statistics.failedEntries}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Statistics not available</p>
          )}
        </CardContent>
      </Card>

      {/* Last Processing Result */}
      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle>Last Processing Result</CardTitle>
            <CardDescription>Batch ID: {lastResult.batchId}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{lastResult.processedCount}</div>
                <div className="text-sm text-muted-foreground">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{lastResult.assignedCount}</div>
                <div className="text-sm text-muted-foreground">Assigned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{lastResult.escalatedCount}</div>
                <div className="text-sm text-muted-foreground">Escalated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{lastResult.failedCount}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Processing Time: {lastResult.processingTime}ms</span>
              <span>Next Run: {formatDate(lastResult.nextScheduledRun)}</span>
            </div>

            {lastResult.errors.length > 0 && (
              <div className="mt-4">
                <label className="text-sm font-medium text-muted-foreground">Errors</label>
                <div className="mt-2 space-y-1">
                  {lastResult.errors.slice(0, 3).map((error, index) => (
                    <div key={index} className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Control Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => executeAction('initialize')}
              disabled={loading}
              variant="outline"
            >
              <Settings className="w-4 h-4 mr-2" />
              Initialize
            </Button>
            
            <Button
              onClick={() => executeAction('start')}
              disabled={loading || status?.isRunning}
              variant="default"
            >
              <Play className="w-4 h-4 mr-2" />
              Start
            </Button>
            
            <Button
              onClick={() => executeAction('stop')}
              disabled={loading || !status?.isRunning}
              variant="destructive"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop
            </Button>
            
            <Button
              onClick={() => executeAction('process_now')}
              disabled={loading}
              variant="secondary"
            >
              <Zap className="w-4 h-4 mr-2" />
              Process Now
            </Button>
            
            <Button
              onClick={() => executeAction('server_initialize')}
              disabled={loading}
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Initialize Server
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}