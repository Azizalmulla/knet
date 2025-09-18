'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, RefreshCw, TrendingUp, Users } from 'lucide-react';

interface FieldAreaCombo {
  field_of_study: string;
  area_of_interest: string;
  count: number;
  percentage: number;
}

interface TelemetryData {
  combos: FieldAreaCombo[];
  totalSubmissions: number;
  limit: number;
  generatedAt: string;
}

export default function TelemetryDashboard() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchTelemetryData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/telemetry/top?limit=10');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setLastRefresh(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch telemetry data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetryData();
  }, []);

  const handleRefresh = () => {
    fetchTelemetryData();
  };

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading telemetry data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Telemetry Error</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={handleRefresh} size="sm" variant="outline">
              <RefreshCw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const topCombo = data.combos[0];
  const maxCount = Math.max(...data.combos.map(c => c.count));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Field & Interest Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Top combinations from {data.totalSubmissions} submissions
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={loading}
          size="sm"
          variant="outline"
          data-testid="refresh-telemetry"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Submissions</p>
                <p className="text-2xl font-bold">{data.totalSubmissions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-sm text-muted-foreground">Most Popular</p>
                <p className="text-lg font-semibold truncate">
                  {topCombo ? `${topCombo.percentage}%` : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <BarChart3 className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Unique Combos</p>
                <p className="text-2xl font-bold">{data.combos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Combinations Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Top {data.limit} Field & Interest Combinations
          </CardTitle>
          {lastRefresh && (
            <p className="text-xs text-muted-foreground">
              Last updated: {lastRefresh.toLocaleString()}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.combos.map((combo, index) => {
              const barWidth = (combo.count / maxCount) * 100;
              
              return (
                <div 
                  key={`${combo.field_of_study}-${combo.area_of_interest}`}
                  className="space-y-2"
                  data-testid={`combo-item-${index}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="flex items-center justify-center w-6 h-6 bg-secondary text-secondary-foreground text-xs font-semibold rounded-full">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-sm text-foreground">
                            {combo.field_of_study}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            → {combo.area_of_interest}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{combo.count} submissions</p>
                      <p className="text-xs text-muted-foreground">{combo.percentage}%</p>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all duration-300"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          
          {data.combos.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>No combination data available yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
