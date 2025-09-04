'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Text,
  Button,
  Table,
  Group,
  Stack,
  Badge,
  Loader,
  Alert,
  ScrollArea,
  Divider,
  Paper,
  Title,
} from '@mantine/core';
import {
  IconRefresh,
  IconAlertCircle,
  IconCheck,
  IconFlask,
  IconCalendar,
  IconTestPipe,
} from '@tabler/icons-react';

interface LPHistoryItem {
  id: string;
  itemInternalId: string;
  woNumber: string;
  createdDate: string;
  room: string;
  location: string;
  wing: string;
  assetBarcode: string;
  positiveCountPre: string;
  positiveCountPost: string;
  sampleNumber: string;
  labName: string;
  certificateNumber: string;
  sampleType: string;
  testType: string;
  sampleTemperature: string;
  bacteriaVariant: string;
  sampledOn: string;
  nextResampleDate: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  reconciliationStatus?: string;
}

interface LPHistoryCardProps {
  assetBarcode: string;
}

export default function LPHistoryCard({ assetBarcode }: LPHistoryCardProps) {
  const [lpHistory, setLpHistory] = useState<LPHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch LP history for the asset
  const fetchLPHistory = async () => {
    try {
      setRefreshing(true);
      setError(null);
      
      const response = await fetch(`/api/lp-history/${assetBarcode}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setLpHistory(data.items || []);
      } else {
        throw new Error(data.error || 'Failed to fetch LP history');
      }
    } catch (error) {
      console.error('Error fetching LP history:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setLpHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (assetBarcode) {
      fetchLPHistory();
    }
  }, [assetBarcode]);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB');
    } catch {
      return dateString;
    }
  };



  if (loading) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="center" p="xl">
          <Loader size="md" />
          <Text>Loading LP history...</Text>
        </Group>
      </Card>
    );
  }

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Group>
          <IconTestPipe size={20} />
          <Title order={4}>LP Test History</Title>
          <Badge variant="light" color="blue">{lpHistory.length} tests</Badge>
        </Group>
        <Button
          variant="light"
          size="sm"
          leftSection={<IconRefresh size={16} />}
          onClick={fetchLPHistory}
          loading={refreshing}
        >
          Refresh
        </Button>
      </Group>

      {error && (
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          title="Error" 
          color="red" 
          mb="md"
        >
          {error}
        </Alert>
      )}

      {lpHistory.length === 0 ? (
        <Paper p="xl" bg="gray.0" radius="md">
          <Stack align="center" gap="sm">
            <IconFlask size={48} color="gray" />
            <Text size="lg" fw={500} c="dimmed">No LP test history</Text>
            <Text size="sm" c="dimmed" ta="center">
              No Legionella Pneumophila test results found for asset {assetBarcode}
            </Text>
          </Stack>
        </Paper>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Test Date</Table.Th>
                <Table.Th>WO Number</Table.Th>
                <Table.Th>Test Details</Table.Th>
                <Table.Th>CFU Count</Table.Th>
                <Table.Th>Certificate No</Table.Th>
                <Table.Th>Next Test</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lpHistory.map((item) => {
                return (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconCalendar size={14} color="gray" />
                        <Text size="sm" fw={500}>
                          {formatDate(item.sampledOn)}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {parseFloat(item.woNumber).toString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <div>
                        <Badge 
                          variant="light" 
                          color={item.testType === 'LA' ? 'teal' : item.testType === 'PA' ? 'violet' : 'gray'}
                          size="sm"
                          mb="xs"
                        >
                          {item.testType}
                        </Badge>
                        <br />
                        <Badge 
                          variant="light" 
                          color={item.sampleType === 'Original' ? 'blue' : 'orange'}
                          size="sm"
                          mb="xs"
                        >
                          {item.sampleType}
                        </Badge>
                        <br />
                        <Badge 
                          variant="outline" 
                          color="gray"
                          size="xs"
                        >
                          {item.bacteriaVariant || 'N/A'}
                        </Badge>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <div>
                        <Text size="xs" c="dimmed" mb={2}>Pre</Text>
                        <Badge variant="outline" size="sm" mb="xs">
                          {item.positiveCountPre || '0'} CFU
                        </Badge>
                        <br />
                        <Text size="xs" c="dimmed" mb={2}>Post</Text>
                        <Badge variant="outline" size="sm">
                          {item.positiveCountPost || '0'} CFU
                        </Badge>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {item.certificateNumber || 'N/A'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {formatDate(item.nextResampleDate)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Card>
  );
}
