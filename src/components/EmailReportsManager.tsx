'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Text,
  Button,
  TextInput,
  Select,
  Checkbox,
  Group,
  Stack,
  Grid,
  Badge,
  ActionIcon,
  Modal,
  Alert,
  Divider,
  Paper,
  Title,
  Box,
  ScrollArea,
  Tabs,
  ThemeIcon,
  Tooltip,
  LoadingOverlay,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useDisclosure } from '@mantine/hooks';
import {
  IconMail,
  IconClock,
  IconDatabase,
  IconUsers,
  IconPlus,
  IconTrash,
  IconPlayerPlay,
  IconPlayerPause,
  IconSettings,
  IconCalendar,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconInfoCircle,
  IconRefresh,
} from '@tabler/icons-react';

interface ScheduledReport {
  id: string;
  name: string;
  databases: string[];
  frequency: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  recipients: string[];
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

interface DatabaseOption {
  id: string;
  name: string;
  displayName: string;
  description: string;
}

const DATABASE_OPTIONS: DatabaseOption[] = [
  { id: 'water-tap-assets', name: 'water-tap-assets', displayName: 'Assets', description: 'All water tap assets and their details' },
  { id: 'AssetAuditLogs', name: 'AssetAuditLogs', displayName: 'Audit Logs', description: 'Asset audit and maintenance logs' },
  { id: 'AssetTypes', name: 'AssetTypes', displayName: 'Asset Types', description: 'Asset type definitions and configurations' },
  { id: 'LPItems', name: 'LPItems', displayName: 'LP Items', description: 'Legionella prevention items and test results' },
  { id: 'FilterTypes', name: 'FilterTypes', displayName: 'Filter Types', description: 'Filter type definitions and specifications' },
  { id: 'SPListItems', name: 'SPListItems', displayName: 'Filter Changed Items', description: 'Filter reconciliation data' }
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily', description: 'Every day at 9:00 AM' },
  { value: 'weekly', label: 'Weekly', description: 'Every week on the same day at 9:00 AM' },
  { value: 'monthly', label: 'Monthly', description: 'Every month on the same date at 9:00 AM' }
];

export default function EmailReportsManager() {
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('create');
  
  // Form for creating new reports
  const form = useForm({
    initialValues: {
      name: '',
      databases: [] as string[],
      frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
      startDate: new Date(),
      recipients: [] as string[],
      newRecipient: ''
    },
    validate: {
      name: (value) => (!value ? 'Report name is required' : null),
      databases: (value) => (value.length === 0 ? 'Select at least one database' : null),
      recipients: (value) => (value.length === 0 ? 'Add at least one recipient' : null),
    },
  });

  // Load scheduled reports on component mount
  useEffect(() => {
    loadScheduledReports();
  }, []);

  const loadScheduledReports = async () => {
    setLoadingReports(true);
    try {
      const response = await fetch('/api/scheduled-reports');
      if (response.ok) {
        const reports = await response.json();
        setScheduledReports(reports);
        console.log('Loaded reports:', reports);
      } else {
        notifications.show({
          title: 'Error',
          message: 'Failed to load scheduled reports',
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    } catch (err) {
      console.error('Failed to load scheduled reports:', err);
      notifications.show({
        title: 'Error',
        message: 'Failed to load scheduled reports',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoadingReports(false);
    }
  };

  const handleCreateReport = async (values: typeof form.values) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/scheduled-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          databases: values.databases,
          frequency: values.frequency,
          startDate: values.startDate.toISOString(),
          recipients: values.recipients
        }),
      });

      const result = await response.json();

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: 'Scheduled report created successfully!',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        form.reset();
        loadScheduledReports();
        setActiveTab('manage');
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to create scheduled report',
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: 'Failed to create scheduled report. Please try again.',
        color: 'red',
        icon: <IconX size={16} />,
      });
      console.error('Create report error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    modals.openConfirmModal({
      title: 'Delete Scheduled Report',
      children: (
        <Text size="sm">
          Are you sure you want to delete this scheduled report? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/scheduled-reports/${reportId}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            notifications.show({
              title: 'Success',
              message: 'Scheduled report deleted successfully!',
              color: 'green',
              icon: <IconCheck size={16} />,
            });
            loadScheduledReports();
          } else {
            notifications.show({
              title: 'Error',
              message: 'Failed to delete scheduled report',
              color: 'red',
              icon: <IconX size={16} />,
            });
          }
        } catch (err) {
          notifications.show({
            title: 'Error',
            message: 'Failed to delete scheduled report. Please try again.',
            color: 'red',
            icon: <IconX size={16} />,
          });
          console.error('Delete report error:', err);
        }
      },
    });
  };

  const handleToggleReport = async (reportId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/scheduled-reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: `Report ${!isActive ? 'activated' : 'deactivated'} successfully!`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        loadScheduledReports();
      } else {
        notifications.show({
          title: 'Error',
          message: 'Failed to update report status',
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update report status. Please try again.',
        color: 'red',
        icon: <IconX size={16} />,
      });
      console.error('Toggle report error:', err);
    }
  };

  const addRecipient = () => {
    const email = form.values.newRecipient.trim();
    if (email && !form.values.recipients.includes(email)) {
      form.setFieldValue('recipients', [...form.values.recipients, email]);
      form.setFieldValue('newRecipient', '');
    }
  };

  const removeRecipient = (email: string) => {
    form.setFieldValue('recipients', form.values.recipients.filter(r => r !== email));
  };

  const sendTestReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/scheduled-reports/${reportId}/test`, {
        method: 'POST',
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: 'Test report sent successfully!',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        notifications.show({
          title: 'Error',
          message: 'Failed to send test report',
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: 'Failed to send test report. Please try again.',
        color: 'red',
        icon: <IconX size={16} />,
      });
      console.error('Test report error:', err);
    }
  };

  return (
    <Stack spacing="lg">
      <Card withBorder shadow="sm" p="lg">
        <Group mb="md">
          <ThemeIcon size="lg" color="blue" variant="light">
            <IconMail size={24} />
          </ThemeIcon>
          <div>
            <Title order={2}>Email Reports</Title>
            <Text color="dimmed" size="sm">
              Create automated email reports with custom schedules, database selections, and recipient lists.
            </Text>
          </div>
        </Group>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="create" leftSection={<IconPlus size={16} />}>
              Create Report
            </Tabs.Tab>
            <Tabs.Tab value="manage" leftSection={<IconSettings size={16} />}>
              Manage Reports
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="create" pt="md">
            <form onSubmit={form.onSubmit(handleCreateReport)}>
              <Grid>
                <Grid.Col span={12} md={6}>
                  <Card withBorder p="md">
                    <Group mb="md">
                      <ThemeIcon color="blue" variant="light">
                        <IconDatabase size={20} />
                      </ThemeIcon>
                      <Title order={4}>Report Configuration</Title>
                    </Group>
                    
                    <Stack spacing="md">
                      <TextInput
                        label="Report Name"
                        placeholder="Enter report name"
                        required
                        {...form.getInputProps('name')}
                      />

                      <div>
                        <Text size="sm" fw={500} mb="xs">Select Databases</Text>
                        <ScrollArea h={200} type="scroll">
                          <Stack spacing="sm">
                            {DATABASE_OPTIONS.map((db) => (
                              <Checkbox
                                key={db.id}
                                label={
                                  <div>
                                    <Text size="sm" fw={500}>{db.displayName}</Text>
                                    <Text size="xs" color="dimmed">{db.description}</Text>
                                  </div>
                                }
                                checked={form.values.databases.includes(db.id)}
                                onChange={(event) => {
                                  const checked = event.currentTarget.checked;
                                  const databases = checked
                                    ? [...form.values.databases, db.id]
                                    : form.values.databases.filter(d => d !== db.id);
                                  form.setFieldValue('databases', databases);
                                }}
                              />
                            ))}
                          </Stack>
                        </ScrollArea>
                        {form.errors.databases && (
                          <Text size="xs" color="red" mt="xs">{form.errors.databases}</Text>
                        )}
                      </div>
                    </Stack>
                  </Card>
                </Grid.Col>

                <Grid.Col span={12} md={6}>
                  <Card withBorder p="md">
                    <Group mb="md">
                      <ThemeIcon color="green" variant="light">
                        <IconClock size={20} />
                      </ThemeIcon>
                      <Title order={4}>Schedule Configuration</Title>
                    </Group>
                    
                    <Stack spacing="md">
                      <Select
                        label="Frequency"
                        placeholder="Select frequency"
                        data={FREQUENCY_OPTIONS.map(option => ({
                          value: option.value,
                          label: option.label,
                          description: option.description
                        }))}
                        {...form.getInputProps('frequency')}
                      />

                      <DateInput
                        label="Start Date"
                        placeholder="Select start date"
                        {...form.getInputProps('startDate')}
                      />
                    </Stack>
                  </Card>
                </Grid.Col>
              </Grid>

              <Card withBorder p="md" mt="md">
                <Group mb="md">
                  <ThemeIcon color="orange" variant="light">
                    <IconUsers size={20} />
                  </ThemeIcon>
                  <Title order={4}>Recipients</Title>
                </Group>
                
                <Stack spacing="md">
                  <Group>
                    <TextInput
                      placeholder="Enter email address"
                      style={{ flex: 1 }}
                      {...form.getInputProps('newRecipient')}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
                    />
                    <Button onClick={addRecipient} leftSection={<IconPlus size={16} />}>
                      Add
                    </Button>
                  </Group>

                  {form.values.recipients.length > 0 && (
                    <div>
                      <Text size="sm" fw={500} mb="xs">
                        Recipients ({form.values.recipients.length})
                      </Text>
                      <Group spacing="xs">
                        {form.values.recipients.map((email) => (
                          <Badge
                            key={email}
                            variant="light"
                            color="blue"
                            rightSection={
                              <ActionIcon
                                size="xs"
                                color="blue"
                                variant="transparent"
                                onClick={() => removeRecipient(email)}
                              >
                                <IconX size={12} />
                              </ActionIcon>
                            }
                          >
                            {email}
                          </Badge>
                        ))}
                      </Group>
                    </div>
                  )}
                  {form.errors.recipients && (
                    <Text size="xs" color="red">{form.errors.recipients}</Text>
                  )}
                </Stack>
              </Card>

              <Group justify="flex-end" mt="md">
                <Button
                  type="submit"
                  loading={isLoading}
                  leftSection={<IconPlus size={16} />}
                >
                  Create Scheduled Report
                </Button>
              </Group>
            </form>
          </Tabs.Panel>

          <Tabs.Panel value="manage" pt="md">
            <Card withBorder p="md">
              <Group mb="md" justify="space-between">
                <Title order={4}>Scheduled Reports</Title>
                <Button
                  variant="light"
                  leftSection={<IconRefresh size={16} />}
                  onClick={loadScheduledReports}
                  loading={loadingReports}
                >
                  Refresh
                </Button>
              </Group>
              
              <LoadingOverlay visible={loadingReports} />
              
              {scheduledReports.length === 0 ? (
                <Paper p="xl" ta="center">
                  <ThemeIcon size="xl" color="gray" variant="light" mx="auto" mb="md">
                    <IconMail size={32} />
                  </ThemeIcon>
                  <Text color="dimmed" size="lg">
                    No scheduled reports found
                  </Text>
                  <Text color="dimmed" size="sm" mt="xs">
                    Create your first report to get started
                  </Text>
                </Paper>
              ) : (
                <Stack spacing="md">
                  {scheduledReports.map((report) => (
                    <Card key={report.id} withBorder p="md">
                      <Group justify="space-between" align="flex-start">
                        <div style={{ flex: 1 }}>
                          <Group mb="xs">
                            <Text fw={500} size="lg">{report.name}</Text>
                            <Badge
                              color={report.isActive ? 'green' : 'gray'}
                              variant="light"
                            >
                              {report.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </Group>
                          
                          <Grid mb="sm">
                            <Grid.Col span={4}>
                              <Text size="sm" color="dimmed">
                                <strong>Databases:</strong> {report.databases.map(dbId => {
                                  const db = DATABASE_OPTIONS.find(d => d.id === dbId);
                                  return db ? db.displayName : dbId;
                                }).join(', ')}
                              </Text>
                            </Grid.Col>
                            <Grid.Col span={4}>
                              <Text size="sm" color="dimmed">
                                <strong>Frequency:</strong> {report.frequency}
                              </Text>
                            </Grid.Col>
                            <Grid.Col span={4}>
                              <Text size="sm" color="dimmed">
                                <strong>Recipients:</strong> {report.recipients.join(', ')}
                              </Text>
                            </Grid.Col>
                          </Grid>
                          
                          <Stack spacing="xs">
                            <Text size="sm" color="dimmed">
                              <strong>Next run:</strong> {report.nextRun ? new Date(report.nextRun).toLocaleString() : 'Not scheduled'}
                            </Text>
                            {report.lastRun && (
                              <Text size="sm" color="dimmed">
                                <strong>Last run:</strong> {new Date(report.lastRun).toLocaleString()}
                              </Text>
                            )}
                          </Stack>
                        </div>
                        
                        <Group spacing="xs">
                          <Tooltip label="Send test report">
                            <ActionIcon
                              color="blue"
                              variant="light"
                              onClick={() => sendTestReport(report.id)}
                            >
                              <IconPlayerPlay size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={report.isActive ? 'Deactivate' : 'Activate'}>
                            <ActionIcon
                              color={report.isActive ? 'orange' : 'green'}
                              variant="light"
                              onClick={() => handleToggleReport(report.id, report.isActive)}
                            >
                              {report.isActive ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete report">
                            <ActionIcon
                              color="red"
                              variant="light"
                              onClick={() => handleDeleteReport(report.id)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              )}
            </Card>
          </Tabs.Panel>
        </Tabs>
      </Card>
    </Stack>
  );
}
