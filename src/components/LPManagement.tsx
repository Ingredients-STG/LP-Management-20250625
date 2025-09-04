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
  Modal,
  TextInput,
  Textarea,
  Select,
  Grid,
  Divider,
  ActionIcon,
  Tooltip,
  Paper,
  Title,
  ScrollArea,
} from '@mantine/core';
import {
  IconRefresh,
  IconPlus,
  IconEdit,
  IconTrash,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconEye,
  IconDownload,
  IconDatabase,
  IconSearch,
  IconFilter,
  IconCalendar,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { DatePickerInput } from '@mantine/dates';

interface LPItem {
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
  // System fields
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  modifiedBy: string;
  syncedAt?: string;
  reconciliationStatus?: string;
}

interface LPManagementProps {}

export default function LPManagement({}: LPManagementProps) {
  const [lpItems, setLpItems] = useState<LPItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LPItem | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [viewModalOpened, setViewModalOpened] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    woNumber: '',
    room: '',
    location: '',
    wing: '',
    assetBarcode: '',
    positiveCountPre: '',
    positiveCountPost: '',
    sampleNumber: '',
    labName: '',
    certificateNumber: '',
    sampleType: '',
    testType: '',
    sampleTemperature: '',
    bacteriaVariant: '',
    sampledOn: '',
    nextResampleDate: '',
  });

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSampleType, setFilterSampleType] = useState<string>('');
  const [filterTestType, setFilterTestType] = useState<string>('');
  const [filterWing, setFilterWing] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [singleDate, setSingleDate] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const sampleTypes = ['Original', 'Resample', 'Follow-up', 'Remedial'];
  const testTypes = ['LA', 'PA', 'Total Viable Count', 'Other'];
  const bacteriaVariants = ['SPP', 'SG1', 'SG2', 'SG3', 'Other'];
  const wings = ['LNS', 'ROS', 'MXF', 'STJ', 'Other'];

  // Filter function
  const filteredLPItems = lpItems.filter((item) => {
    // Search query - searches across all text fields
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const searchableFields = [
        item.assetBarcode,
        item.woNumber,
        item.room,
        item.location,
        item.wing,
        item.sampleNumber,
        item.labName,
        item.certificateNumber,
        item.sampleType,
        item.testType,
        item.bacteriaVariant,
        item.positiveCountPre,
        item.positiveCountPost,
        item.sampleTemperature
      ];
      
      const matchesSearch = searchableFields.some(field => 
        field?.toLowerCase().includes(query)
      );
      
      if (!matchesSearch) return false;
    }

    // Sample Type filter
    if (filterSampleType && item.sampleType !== filterSampleType) {
      return false;
    }

    // Test Type filter
    if (filterTestType && item.testType !== filterTestType) {
      return false;
    }

    // Wing filter
    if (filterWing && item.wing !== filterWing) {
      return false;
    }

    // Date range filter (sampled on date)
    if (dateRange[0] || dateRange[1]) {
      const sampledDate = item.sampledOn ? new Date(item.sampledOn) : null;
      if (!sampledDate) return false;
      
      if (dateRange[0] && sampledDate < dateRange[0]) return false;
      if (dateRange[1] && sampledDate > dateRange[1]) return false;
    }

    // Single date filter
    if (singleDate) {
      const sampledDate = item.sampledOn ? new Date(item.sampledOn) : null;
      if (!sampledDate) return false;
      
      const singleDateString = singleDate.toDateString();
      const sampledDateString = sampledDate.toDateString();
      if (singleDateString !== sampledDateString) return false;
    }

    return true;
  });

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setFilterSampleType('');
    setFilterTestType('');
    setFilterWing('');
    setDateRange([null, null]);
    setSingleDate(null);
  };

  // Fetch LP items from API
  const fetchLPItems = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/lp-items');
      if (!response.ok) {
        throw new Error('Failed to fetch LP items');
      }
      const data = await response.json();
      setLpItems(data.items || []);
    } catch (error) {
      console.error('Error fetching LP items:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch LP items',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchLPItems();
  }, []);

  // Handle form submission
  const handleSubmit = async () => {
    try {
      const url = isEditing ? `/api/lp-items/${selectedItem?.id}` : '/api/lp-items';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          modifiedBy: 'current-user', // This should come from auth context
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} LP item`);
      }

      notifications.show({
        title: 'Success',
        message: `LP item ${isEditing ? 'updated' : 'created'} successfully`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      handleCloseModal();
      fetchLPItems();
    } catch (error) {
      console.error('Error saving LP item:', error);
      notifications.show({
        title: 'Error',
        message: `Failed to ${isEditing ? 'update' : 'create'} LP item`,
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this LP item?')) {
      return;
    }

    try {
      const response = await fetch(`/api/lp-items/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete LP item');
      }

      notifications.show({
        title: 'Success',
        message: 'LP item deleted successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      fetchLPItems();
    } catch (error) {
      console.error('Error deleting LP item:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete LP item',
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  // Modal handlers
  const handleOpenModal = (item?: LPItem) => {
    if (item) {
      setIsEditing(true);
      setSelectedItem(item);
      setFormData({
        woNumber: item.woNumber,
        room: item.room,
        location: item.location,
        wing: item.wing,
        assetBarcode: item.assetBarcode,
        positiveCountPre: item.positiveCountPre,
        positiveCountPost: item.positiveCountPost,
        sampleNumber: item.sampleNumber,
        labName: item.labName,
        certificateNumber: item.certificateNumber,
        sampleType: item.sampleType,
        testType: item.testType,
        sampleTemperature: item.sampleTemperature,
        bacteriaVariant: item.bacteriaVariant,
        sampledOn: item.sampledOn ? item.sampledOn.split('T')[0] : '',
        nextResampleDate: item.nextResampleDate ? item.nextResampleDate.split('T')[0] : '',
      });
    } else {
      setIsEditing(false);
      setSelectedItem(null);
      setFormData({
        woNumber: '',
        room: '',
        location: '',
        wing: '',
        assetBarcode: '',
        positiveCountPre: '',
        positiveCountPost: '',
        sampleNumber: '',
        labName: '',
        certificateNumber: '',
        sampleType: '',
        testType: '',
        sampleTemperature: '',
        bacteriaVariant: '',
        sampledOn: '',
        nextResampleDate: '',
      });
    }
    setModalOpened(true);
  };

  const handleCloseModal = () => {
    setModalOpened(false);
    setSelectedItem(null);
    setIsEditing(false);
  };

  const handleViewItem = (item: LPItem) => {
    setSelectedItem(item);
    setViewModalOpened(true);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'green';
      case 'inactive': return 'gray';
      case 'pending': return 'yellow';
      case 'archived': return 'red';
      default: return 'blue';
    }
  };

  if (loading) {
    return (
      <Stack align="center" justify="center" h={400}>
        <Loader size="lg" />
        <Text>Loading LP Management data...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {/* Header */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Group>
            <IconDatabase size={24} />
            <div>
              <Title order={2}>LP Management</Title>
              <Text size="sm" c="dimmed">
                Manage LP items synced from SharePoint
              </Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={fetchLPItems}
              loading={refreshing}
            >
              Refresh
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => handleOpenModal()}
            >
              Add LP Item
            </Button>
          </Group>
        </Group>

        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          This data is synchronized from SharePoint using Power Automate. 
          Manual changes will be reflected in the system immediately.
        </Alert>
      </Card>

      {/* Statistics */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">Total Items</Text>
            <Text fw={700} size="xl">{filteredLPItems.length}</Text>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">Original Samples</Text>
            <Text fw={700} size="xl" c="blue">
              {filteredLPItems.filter(item => item.sampleType === 'Original').length}
            </Text>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">Resamples</Text>
            <Text fw={700} size="xl" c="orange">
              {filteredLPItems.filter(item => item.sampleType === 'Resample').length}
            </Text>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">High Risk (>100 CFU)</Text>
            <Text fw={700} size="xl" c="red">
              {filteredLPItems.filter(item => 
                parseInt(item.positiveCountPost) > 100 || parseInt(item.positiveCountPre) > 100
              ).length}
            </Text>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Search and Filter Section */}
      <Card shadow="sm" padding="lg" radius="md" withBorder mb="md">
        <Stack gap="md">
          {/* Search Bar */}
          <Group>
            <TextInput
              placeholder="Search across all fields..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftSection={<IconSearch size={16} />}
              style={{ flex: 1 }}
            />
            <Button
              variant={showFilters ? "filled" : "outline"}
              leftSection={<IconFilter size={16} />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
            {(searchQuery || filterSampleType || filterTestType || filterWing || dateRange[0] || dateRange[1] || singleDate) && (
              <Button
                variant="light"
                color="gray"
                leftSection={<IconX size={16} />}
                onClick={clearFilters}
              >
                Clear All
              </Button>
            )}
          </Group>

          {/* Filter Panel */}
          {showFilters && (
            <Card withBorder p="md" bg="gray.0">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Select
                    label="Sample Type"
                    placeholder="All sample types"
                    value={filterSampleType}
                    onChange={(value) => setFilterSampleType(value || '')}
                    data={[
                      { value: '', label: 'All sample types' },
                      ...sampleTypes.map(type => ({ value: type, label: type }))
                    ]}
                    clearable
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Select
                    label="Test Type"
                    placeholder="All test types"
                    value={filterTestType}
                    onChange={(value) => setFilterTestType(value || '')}
                    data={[
                      { value: '', label: 'All test types' },
                      ...testTypes.map(type => ({ value: type, label: type }))
                    ]}
                    clearable
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Select
                    label="Wing"
                    placeholder="All wings"
                    value={filterWing}
                    onChange={(value) => setFilterWing(value || '')}
                    data={[
                      { value: '', label: 'All wings' },
                      ...wings.map(wing => ({ value: wing, label: wing }))
                    ]}
                    clearable
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <DatePickerInput
                    type="single"
                    label="Single Date"
                    placeholder="Select date"
                    value={singleDate}
                    onChange={setSingleDate}
                    leftSection={<IconCalendar size={16} />}
                    clearable
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <DatePickerInput
                    type="range"
                    label="Date Range (Sampled On)"
                    placeholder="Select date range"
                    value={dateRange}
                    onChange={setDateRange}
                    leftSection={<IconCalendar size={16} />}
                    clearable
                  />
                </Grid.Col>
              </Grid>
            </Card>
          )}
        </Stack>
      </Card>

      {/* LP Items Table */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={500}>LP Items ({filteredLPItems.length} of {lpItems.length})</Text>
        </Group>

        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Asset Barcode</Table.Th>
                <Table.Th>WO Number</Table.Th>
                <Table.Th>Wing</Table.Th>
                <Table.Th>Sample Type</Table.Th>
                <Table.Th>Test Type</Table.Th>
                <Table.Th>Pre Count</Table.Th>
                <Table.Th>Post Count</Table.Th>
                <Table.Th>Sampled On</Table.Th>
                <Table.Th>Next Resample</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredLPItems.length > 0 ? (
                filteredLPItems.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <Text fw={500}>{item.assetBarcode}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{parseFloat(item.woNumber).toString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={500}>{item.wing}</Text>
                        <Text size="xs" c="dimmed">{item.location}</Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={item.sampleType === 'Original' ? 'blue' : 'orange'}>
                        {item.sampleType}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge 
                        variant="light" 
                        color={item.testType === 'LA' ? 'teal' : item.testType === 'PA' ? 'violet' : 'gray'}
                      >
                        {item.testType || 'N/A'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={parseInt(item.positiveCountPre) > 100 ? 'red' : 'green'}>
                        {item.positiveCountPre} CFU
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={parseInt(item.positiveCountPost) > 100 ? 'red' : 'green'}>
                        {item.positiveCountPost} CFU
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {item.sampledOn ? new Date(item.sampledOn).toLocaleDateString('en-GB') : 'N/A'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {item.nextResampleDate ? new Date(item.nextResampleDate).toLocaleDateString('en-GB') : 'N/A'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Tooltip label="View Details">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => handleViewItem(item)}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Edit">
                          <ActionIcon
                            variant="subtle"
                            color="orange"
                            onClick={() => handleOpenModal(item)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDelete(item.id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={10}>
                    <Stack align="center" gap="xs" py="xl">
                      <IconDatabase size={48} color="gray" />
                      <Text c="dimmed">
                        {lpItems.length === 0 
                          ? "No LP items found" 
                          : "No LP items match the current filters"
                        }
                      </Text>
                      {lpItems.length === 0 ? (
                        <Button 
                          variant="light" 
                          onClick={() => handleOpenModal()}
                          leftSection={<IconPlus size={16} />}
                        >
                          Add First LP Item
                        </Button>
                      ) : (
                        <Button 
                          variant="light"
                          color="gray"
                          onClick={clearFilters}
                          leftSection={<IconX size={16} />}
                        >
                          Clear Filters
                        </Button>
                      )}
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={handleCloseModal}
        title={isEditing ? 'Edit LP Item' : 'Add LP Item'}
        size="60%"
      >
        <Stack gap="md">
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Asset Barcode"
                placeholder="Enter asset barcode"
                value={formData.assetBarcode}
                onChange={(e) => setFormData({ ...formData, assetBarcode: e.target.value })}
                required
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="WO Number"
                placeholder="Enter work order number"
                value={formData.woNumber}
                onChange={(e) => setFormData({ ...formData, woNumber: e.target.value })}
                required
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Room/Ward"
                placeholder="Enter room or ward name"
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Location"
                placeholder="Enter specific location (e.g., LNS-5.077)"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Wing"
                placeholder="Enter wing (e.g., LNS, ROS, MXF)"
                value={formData.wing}
                onChange={(e) => setFormData({ ...formData, wing: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Sample Number"
                placeholder="Enter sample number"
                value={formData.sampleNumber}
                onChange={(e) => setFormData({ ...formData, sampleNumber: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Lab Name"
                placeholder="Enter lab name"
                value={formData.labName}
                onChange={(e) => setFormData({ ...formData, labName: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Certificate Number"
                placeholder="Enter certificate number"
                value={formData.certificateNumber}
                onChange={(e) => setFormData({ ...formData, certificateNumber: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Sample Type"
                placeholder="Select sample type"
                data={sampleTypes}
                value={formData.sampleType}
                onChange={(value) => setFormData({ ...formData, sampleType: value || '' })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Test Type"
                placeholder="Select test type"
                data={testTypes}
                value={formData.testType}
                onChange={(value) => setFormData({ ...formData, testType: value || '' })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Positive Count (Pre)"
                placeholder="CFU count before"
                value={formData.positiveCountPre}
                onChange={(e) => setFormData({ ...formData, positiveCountPre: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Positive Count (Post)"
                placeholder="CFU count after"
                value={formData.positiveCountPost}
                onChange={(e) => setFormData({ ...formData, positiveCountPost: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Sample Temperature"
                placeholder="Enter temperature"
                value={formData.sampleTemperature}
                onChange={(e) => setFormData({ ...formData, sampleTemperature: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Bacteria Variant"
                placeholder="Select bacteria variant"
                data={bacteriaVariants}
                value={formData.bacteriaVariant}
                onChange={(value) => setFormData({ ...formData, bacteriaVariant: value || '' })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Sampled On"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.sampledOn}
                onChange={(e) => setFormData({ ...formData, sampledOn: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Next Resample Date"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.nextResampleDate}
                onChange={(e) => setFormData({ ...formData, nextResampleDate: e.target.value })}
              />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* View Details Modal */}
      <Modal
        opened={viewModalOpened}
        onClose={() => setViewModalOpened(false)}
        title="LP Item Details"
        size="60%"
      >
        {selectedItem && (
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600} size="lg">Asset: {selectedItem.assetBarcode}</Text>
              <Badge 
                variant="light" 
                color={selectedItem.sampleType === 'Original' ? 'blue' : 'orange'}
              >
                {selectedItem.sampleType}
              </Badge>
            </Group>

            <Divider />

            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Asset Barcode</Text>
                <Text fw={500}>{selectedItem.assetBarcode}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">WO Number</Text>
                <Text fw={500}>{parseFloat(selectedItem.woNumber).toString()}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Room/Ward</Text>
                <Text fw={500}>{selectedItem.room || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Location</Text>
                <Text fw={500}>{selectedItem.location || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Wing</Text>
                <Text fw={500}>{selectedItem.wing || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Sample Number</Text>
                <Text fw={500}>{selectedItem.sampleNumber || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Lab Name</Text>
                <Text fw={500}>{selectedItem.labName || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Certificate Number</Text>
                <Text fw={500}>{selectedItem.certificateNumber || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Sample Type</Text>
                <Badge variant="light" color={selectedItem.sampleType === 'Original' ? 'blue' : 'orange'}>
                  {selectedItem.sampleType || 'N/A'}
                </Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Test Type</Text>
                <Badge 
                  variant="light" 
                  color={selectedItem.testType === 'LA' ? 'teal' : selectedItem.testType === 'PA' ? 'violet' : 'gray'}
                >
                  {selectedItem.testType || 'N/A'}
                </Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Positive Count (Pre)</Text>
                <Badge variant="light" color={parseInt(selectedItem.positiveCountPre) > 100 ? 'red' : 'green'}>
                  {selectedItem.positiveCountPre} CFU
                </Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Positive Count (Post)</Text>
                <Badge variant="light" color={parseInt(selectedItem.positiveCountPost) > 100 ? 'red' : 'green'}>
                  {selectedItem.positiveCountPost} CFU
                </Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Sample Temperature</Text>
                <Text fw={500}>{selectedItem.sampleTemperature || 'N/A'}°C</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Bacteria Variant</Text>
                <Text fw={500}>{selectedItem.bacteriaVariant || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Sampled On</Text>
                <Text fw={500}>
                  {selectedItem.sampledOn ? new Date(selectedItem.sampledOn).toLocaleDateString('en-GB') : 'N/A'}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Next Resample Date</Text>
                <Text fw={500}>
                  {selectedItem.nextResampleDate ? new Date(selectedItem.nextResampleDate).toLocaleDateString('en-GB') : 'N/A'}
                </Text>
              </Grid.Col>
            </Grid>

            <Divider />

            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Created</Text>
                <Text fw={500}>
                  {new Date(selectedItem.createdAt).toLocaleString('en-GB')}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Last Modified</Text>
                <Text fw={500}>
                  {new Date(selectedItem.updatedAt).toLocaleString('en-GB')}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Created By</Text>
                <Text fw={500}>{selectedItem.createdBy}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Modified By</Text>
                <Text fw={500}>{selectedItem.modifiedBy}</Text>
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="md">
              <Button 
                variant="subtle" 
                onClick={() => setViewModalOpened(false)}
              >
                Close
              </Button>
              <Button 
                onClick={() => {
                  setViewModalOpened(false);
                  handleOpenModal(selectedItem);
                }}
                leftSection={<IconEdit size={16} />}
              >
                Edit
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
