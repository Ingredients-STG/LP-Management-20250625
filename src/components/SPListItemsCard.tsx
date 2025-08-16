'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Title,
  Text,
  Group,
  Stack,
  Badge,
  Grid,
  Loader,
  ThemeIcon,
  Progress,
  Tooltip,
  ScrollArea,
  Divider,
  ActionIcon,
  Select
} from '@mantine/core';
import { BarChart, LineChart, PieChart } from '@mantine/charts';
import {
  IconFilter,
  IconMapPin,
  IconCalendar,
  IconTrendingUp,
  IconRefresh,
  IconChartBar,
  IconLocation
} from '@tabler/icons-react';

// Helper function to get color for filter types
function getFilterTypeColor(type: string): string {
  const colors = [
    'blue.6', 'green.6', 'orange.6', 'red.6', 'purple.6', 
    'teal.6', 'yellow.6', 'pink.6', 'indigo.6', 'cyan.6'
  ];
  const index = type.length % colors.length;
  return colors[index];
}

// Helper function to get color for wings
function getWingColor(wing: string, index: number): string {
  const colors = [
    'blue.6', 'green.6', 'orange.6', 'red.6', 'purple.6', 
    'teal.6', 'yellow.6', 'pink.6', 'indigo.6', 'cyan.6',
    'lime.6', 'amber.6', 'violet.6', 'emerald.6', 'rose.6'
  ];
  return colors[index % colors.length];
}

interface SPListItem {
  id: string;
  Location: string;
  FilterInstalledDate: string;
  FilterType?: string;
  AssetBarcode?: string;
  status?: string;
  updatedAt?: string;
  modifiedBy?: string;
  reconciliationStatus?: 'pending' | 'synced' | 'failed';
  reconciliationTimestamp?: string;
  reconciledBy?: string;
}

interface SPListAnalytics {
  totalChanges: number;
  locationBreakdown: { [key: string]: number };
  wingBreakdown: { [key: string]: number };
  filterTypeBreakdown: { [key: string]: number };
  changesOverTime: { date: string; count: number }[];
  topLocations: { location: string; count: number }[];
  topWings: { wing: string; count: number }[];
  recentChanges: SPListItem[];
}

interface SPListData {
  items: SPListItem[];
  analytics: SPListAnalytics;
  period: number;
  totalCount: number;
  filteredCount: number;
}

interface SPListItemsCardProps {
  data?: SPListData | null;
  loading?: boolean;
  onRefresh?: () => void;
}

export default function SPListItemsCard({ data, loading = false, onRefresh }: SPListItemsCardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30');
  const [localData, setLocalData] = useState<SPListData | null>(data || null);
  const [localLoading, setLocalLoading] = useState(loading);

  // Fetch data when period changes
  const fetchData = async (period: string = selectedPeriod) => {
    setLocalLoading(true);
    try {
      const response = await fetch(`/api/splist-items?period=${period}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setLocalData(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching SPListItems data:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  useEffect(() => {
    if (!data && !loading) {
      fetchData();
    }
  }, []);

  useEffect(() => {
    // Only use passed data if we haven't fetched our own data yet
    if (data && !localData) {
      setLocalData(data);
    }
  }, [data]);

  useEffect(() => {
    setLocalLoading(loading);
  }, [loading]);

  const handlePeriodChange = (period: string | null) => {
    if (period) {
      setSelectedPeriod(period);
      fetchData(period);
    }
  };

  const currentData = localData || data;
  const isLoading = localLoading || loading;

  if (isLoading) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder style={{ minHeight: '400px' }}>
        <Group justify="center" style={{ height: '100%' }}>
          <Loader size="lg" />
        </Group>
      </Card>
    );
  }

  if (!currentData) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder style={{ minHeight: '400px' }}>
        <Stack align="center" justify="center" style={{ height: '100%' }}>
          <ThemeIcon size={60} color="gray" variant="light">
            <IconFilter size={30} />
          </ThemeIcon>
          <Text size="lg" fw={500} c="dimmed">Filter Changes</Text>
          <Text size="sm" c="dimmed" ta="center">
            No filter change data available
          </Text>
        </Stack>
      </Card>
    );
  }

  const { analytics } = currentData;

  // Prepare chart data for wings (pie chart)
  const wingChartData = analytics.topWings.map((item, index) => ({
    name: `${item.wing} (${item.count})`,
    value: item.count,
    color: getWingColor(item.wing, index),
    key: `wing-${item.wing}-${index}` // Add unique key
  }));



  const filterTypeChartData = Object.entries(analytics.filterTypeBreakdown).map(([type, count], index) => ({
    name: `${type} (${count})`, // PieChart expects 'name' property and show count in label
    value: count, // PieChart expects 'value' property
    color: getFilterTypeColor(type),
    key: `filter-${type}-${index}` // Add unique key
  }));

  const formatChartDate = (dateStr: string, period: string) => {
    const date = new Date(dateStr);
    
    // Handle "All Time" period
    if (period === 'all') {
      // Monthly format for All Time: "Jan 2024"
      return date.toLocaleDateString('en-GB', { 
        month: 'short',
        year: 'numeric'
      });
    }
    
    const periodNum = parseInt(period);
    
    if (periodNum <= 7) {
      // Daily format for 7 days: "Mon 15"
      return date.toLocaleDateString('en-GB', { 
        weekday: 'short',
        day: 'numeric'
      });
    } else if (periodNum <= 30) {
      // Daily format for 30 days: "15/01"
      return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit' 
      });
    } else if (periodNum <= 90) {
      // Weekly format for 90 days: "Week of 15/01"
      return `Week ${date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit' 
      })}`;
    } else {
      // Monthly format for 365 days: "Jan 2024"
      return date.toLocaleDateString('en-GB', { 
        month: 'short',
        year: 'numeric'
      });
    }
  };

  // Create unique time series data with proper keys
  const timeSeriesData = analytics.changesOverTime.reduce((acc, item, index) => {
    const formattedDate = formatChartDate(item.date, selectedPeriod);
    const uniqueKey = `${item.date}-${index}`;
    
    // Check if we already have this formatted date
    const existingIndex = acc.findIndex(existing => existing.date === formattedDate);
    
    if (existingIndex >= 0) {
      // Aggregate the count if same formatted date exists
      acc[existingIndex].changes += item.count;
    } else {
      // Add new entry
      acc.push({
        date: formattedDate,
        changes: item.count,
        key: uniqueKey
      });
    }
    
    return acc;
  }, [] as Array<{ date: string; changes: number; key: string }>);

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="xs" mb="xs">
              <ThemeIcon color="blue" variant="light" size="sm">
                <IconFilter size={16} />
              </ThemeIcon>
              <Title order={4}>Filter Changes</Title>
            </Group>
            <Text size="sm" c="dimmed">
              Filter replacement activity across locations
            </Text>
          </div>
          <Group gap="xs">
            <Select
              size="xs"
              value={selectedPeriod}
              onChange={handlePeriodChange}
              data={[
                { value: '7', label: '7 days' },
                { value: '30', label: '30 days' },
                { value: '90', label: '90 days' },
                { value: '365', label: '1 year' },
                { value: 'all', label: 'All Time' }
              ]}
              w={100}
            />
            <Tooltip label="Refresh Data">
              <ActionIcon 
                variant="light" 
                color="blue" 
                onClick={() => {
                  fetchData();
                  if (onRefresh) {
                    onRefresh();
                  }
                }}
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Key Stats */}
        <Grid gutter="md">
          <Grid.Col span={3}>
            <Card padding="sm" withBorder>
              <Group gap="xs">
                <ThemeIcon color="blue" variant="light" size="sm">
                  <IconTrendingUp size={14} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">Total Changes</Text>
                  <Text size="lg" fw={700}>{analytics.totalChanges}</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={3}>
            <Card padding="sm" withBorder>
              <Group gap="xs">
                <ThemeIcon color="green" variant="light" size="sm">
                  <IconLocation size={14} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">Wings</Text>
                  <Text size="lg" fw={700}>{Object.keys(analytics.wingBreakdown).length}</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={3}>
            <Card padding="sm" withBorder>
              <Group gap="xs">
                <ThemeIcon color="orange" variant="light" size="sm">
                  <IconFilter size={14} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">Filter Types</Text>
                  <Text size="lg" fw={700}>{Object.keys(analytics.filterTypeBreakdown).length}</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={3}>
            <Card padding="sm" withBorder>
              <Group gap="xs">
                <ThemeIcon color="purple" variant="light" size="sm">
                  <IconCalendar size={14} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">Period</Text>
                  <Text size="lg" fw={700}>
                    {typeof currentData.period === 'string' ? currentData.period : `${currentData.period}d`}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Changes Over Time Chart - Full Width */}
        <Grid gutter="md">
          <Grid.Col span={12}>
            <Card padding="sm" withBorder>
              <Title order={6} mb="sm">Changes Over Time</Title>
              {timeSeriesData.length > 0 ? (
                <LineChart
                  h={200}
                  data={timeSeriesData}
                  dataKey="date"
                  series={[{ name: 'changes', color: 'blue.6' }]}
                  curveType="linear"
                  strokeWidth={2}
                  dotProps={{ r: 3, strokeWidth: 2 }}
                  gridAxis="xy"
                />
              ) : (
                <Text size="sm" c="dimmed" ta="center" py="lg">
                  No data available for selected period
                </Text>
              )}
            </Card>
          </Grid.Col>
        </Grid>

        {/* Filter Changes by Wing - Full Width */}
        <Grid gutter="md">
          <Grid.Col span={12}>
            <Card padding="sm" withBorder>
              <Title order={6} mb="sm">Filter Changes by Wing</Title>
              {wingChartData.length > 0 ? (
                <BarChart
                  h={200}
                  data={wingChartData}
                  dataKey="name"
                  series={[{ name: 'value', color: 'teal.6' }]}
                  tickLine="xy"
                  gridAxis="xy"
                />
              ) : (
                <Text size="sm" c="dimmed" ta="center" py="lg">
                  No wing data available
                </Text>
              )}
            </Card>
          </Grid.Col>
        </Grid>

        {/* Filter Types and Recent Changes */}
        <Grid gutter="md">
          {/* Filter Types Breakdown */}
          <Grid.Col span={6}>
            <Card padding="sm" withBorder>
              <Title order={6} mb="sm">Filter Types</Title>
              {filterTypeChartData.length > 0 ? (
                <BarChart
                  h={180}
                  data={filterTypeChartData}
                  dataKey="name"
                  series={[{ name: 'value', color: 'blue.6' }]}
                  tickLine="xy"
                  gridAxis="xy"
                />
              ) : (
                <Text size="sm" c="dimmed" ta="center" py="lg">
                  No filter type data available
                </Text>
              )}
            </Card>
          </Grid.Col>

          {/* Recent Changes */}
          <Grid.Col span={6}>
            <Card padding="sm" withBorder>
              <Title order={6} mb="sm">Recent Changes</Title>
              <ScrollArea h={180}>
                <Stack gap="xs">
                  {analytics.recentChanges.slice(0, 5).map((item) => (
                    <div key={item.id}>
                      <Group justify="space-between" wrap="nowrap">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text size="xs" fw={500} truncate>
                            {item.Location}
                          </Text>
                          <Group gap={4}>
                            <Text size="xs" c="dimmed">
                              Filter: {(() => {
                                const parseDate = (dateStr: string): Date | null => {
                                  if (!dateStr) return null;
                                  if (dateStr.includes('/')) {
                                    const [day, month, year] = dateStr.split('/');
                                    const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                    return isNaN(parsedDate.getTime()) ? null : parsedDate;
                                  }
                                  const parsedDate = new Date(dateStr);
                                  return isNaN(parsedDate.getTime()) ? null : parsedDate;
                                };
                                const parsedDate = parseDate(item.FilterInstalledDate);
                                return parsedDate ? parsedDate.toLocaleDateString('en-GB') : 'Invalid Date';
                              })()}
                            </Text>
                            {item.updatedAt && (
                              <Text size="xs" c="dimmed">
                                • Updated: {new Date(item.updatedAt).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </Text>
                            )}
                          </Group>
                          <Group gap={4} mt={2}>
                            {item.FilterType && item.FilterType !== 'Not set' && (
                              <Badge size="xs" color="blue" variant="dot">
                                {item.FilterType}
                              </Badge>
                            )}
                            {item.modifiedBy && (
                              <Badge size="xs" color="gray" variant="outline">
                                {item.modifiedBy}
                              </Badge>
                            )}
                          </Group>
                        </div>
                      </Group>
                      <Divider size="xs" my={4} />
                    </div>
                  ))}
                  {analytics.recentChanges.length === 0 && (
                    <Text size="sm" c="dimmed" ta="center">
                      No recent changes available
                    </Text>
                  )}
                </Stack>
              </ScrollArea>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </Card>
  );
}