'use client';

import { useState, useEffect } from 'react';
import {
  AppShell,
  Title,
  Text,
  Button,
  Card,
  Grid,
  Group,
  Stack,
  Badge,
  Table,
  TextInput,
  ActionIcon,
  Loader,
  Paper,
  ThemeIcon,
  Progress,
  Container,
  Avatar,
  Menu,
  Indicator,
  Modal,
  Select,
  Textarea,
  Checkbox,
  Pagination,
  Tooltip,
  ScrollArea,
  Collapse,
  Divider,
  Box,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { BarChart, PieChart } from '@mantine/charts';
import { Spotlight } from '@mantine/spotlight';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { spotlight } from '@mantine/spotlight';
import {
  IconDroplet,
  IconFilter,
  IconSettings,
  IconBell,
  IconUser,
  IconSearch,
  IconDownload,
  IconPlus,
  IconChartBar,
  IconHome,
  IconFileText,
  IconRefresh,
  IconMapPin,
  IconCalendar,
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconTrendingUp,
  IconX,
  IconEdit,
  IconTrash,
  IconEye,
  IconUpload,
  IconPrinter,
  IconMail,
  IconPhone,
  IconBuilding,
  IconTools,
  IconHistory,
  IconReport,
  IconDashboard,
  IconFilterSearch,
  IconExclamationMark,
  IconChevronDown,
  IconChevronRight,
  IconInfoCircle,
} from '@tabler/icons-react';

interface Asset {
  id?: string;
  assetBarcode: string;
  status: string;
  assetType: string;
  primaryIdentifier: string;
  secondaryIdentifier: string;
  wing: string;
  wingInShort: string;
  room: string;
  floor: string;
  floorInWords: string;
  roomNo: string;
  roomName: string;
  filterNeeded: boolean | string;
  filtersOn: boolean | string;
  filterExpiryDate: string;
  filterInstalledOn: string;
  notes: string;
  augmentedCare: boolean | string;
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;
}

interface DashboardStats {
  totalAssets: number;
  activeAssets: number;
  maintenanceAssets: number;
  filtersNeeded: number;
  statusBreakdown?: { [key: string]: number };
  assetTypeBreakdown?: { [key: string]: number };
  wingBreakdown?: { [key: string]: number };
}

interface AuditLogEntry {
  assetId: string;
  timestamp: string;
  user: string;
  action: string;
  details: {
    assetBarcode: string;
    assetName: string;
    changes: {
      field: string;
      oldValue: any;
      newValue: any;
    }[];
  };
}

export default function HomePage() {
  const [opened, { toggle }] = useDisclosure();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalAssets: 0,
    activeAssets: 0,
    maintenanceAssets: 0,
    filtersNeeded: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useLocalStorage({ key: 'activeTab', defaultValue: 'dashboard' });
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [wingFilter, setWingFilter] = useState<string>('');
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [hideTabContainer, setHideTabContainer] = useLocalStorage({ key: 'hideTabContainer', defaultValue: false });
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [showAuditModal, { open: openAuditModal, close: closeAuditModal }] = useDisclosure(false);
  const [selectedAssetAudit, setSelectedAssetAudit] = useState<string>('');

  // Toggle asset expansion
  const toggleAssetExpansion = (assetBarcode: string) => {
    const newExpandedAssets = new Set(expandedAssets);
    if (newExpandedAssets.has(assetBarcode)) {
      newExpandedAssets.delete(assetBarcode);
    } else {
      newExpandedAssets.add(assetBarcode);
    }
    setExpandedAssets(newExpandedAssets);
  };

  // Audit log helper functions
  const createAuditLogEntry = async (
    asset: Asset,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    oldAsset?: Asset
  ) => {
    const now = new Date();
    const changes: { field: string; oldValue: any; newValue: any }[] = [];

    // Fields to exclude from audit log (system-generated fields)
    const excludeFields = ['id', 'created', 'createdBy', 'modified', 'modifiedBy'];

    if (action === 'UPDATE' && oldAsset) {
      // Compare old and new values, excluding system fields
      Object.keys(asset).forEach((key) => {
        if (excludeFields.includes(key)) return;
        
        const oldValue = oldAsset[key as keyof Asset];
        const newValue = asset[key as keyof Asset];
        
        // More precise comparison for different data types
        const isChanged = (() => {
          // Handle null/undefined/empty string cases
          const normalizeValue = (val: any) => {
            if (val === null || val === undefined) return null;
            if (typeof val === 'string' && val.trim() === '') return null;
            if (val === '') return null;
            return val;
          };
          
          const normalizedOld = normalizeValue(oldValue);
          const normalizedNew = normalizeValue(newValue);
          
          // Both are null/empty - no change
          if (normalizedOld === null && normalizedNew === null) return false;
          
          // One is null/empty, other is not - change
          if ((normalizedOld === null) !== (normalizedNew === null)) return true;
          
          // For dates, normalize to date strings for comparison
          if (typeof normalizedOld === 'string' && typeof normalizedNew === 'string') {
            // Check if both look like dates (contain T and Z or are ISO format)
            const isOldDate = normalizedOld.includes('T') || normalizedOld.match(/^\d{4}-\d{2}-\d{2}$/);
            const isNewDate = normalizedNew.includes('T') || normalizedNew.match(/^\d{4}-\d{2}-\d{2}$/);
            
            if (isOldDate && isNewDate) {
              try {
                const oldDate = new Date(normalizedOld);
                const newDate = new Date(normalizedNew);
                
                // Compare as date strings (YYYY-MM-DD)
                const oldDateStr = oldDate.toISOString().split('T')[0];
                const newDateStr = newDate.toISOString().split('T')[0];
                
                return oldDateStr !== newDateStr;
              } catch {
                return normalizedOld !== normalizedNew;
              }
            }
          }
          
          // For booleans, ensure both are compared as same type
          if (typeof normalizedOld === 'boolean' || typeof normalizedNew === 'boolean') {
            return Boolean(normalizedOld) !== Boolean(normalizedNew);
          }
          
          // Regular comparison
          return String(normalizedOld) !== String(normalizedNew);
        })();
        
        if (isChanged) {
          changes.push({
            field: key,
            oldValue: oldValue,
            newValue: newValue,
          });
        }
      });
    } else if (action === 'CREATE') {
      // For create, show all non-empty fields as new (excluding system fields)
      Object.keys(asset).forEach((key) => {
        if (excludeFields.includes(key)) return;
        
        const value = asset[key as keyof Asset];
        if (value && value !== '') {
          changes.push({
            field: key,
            oldValue: null,
            newValue: value,
          });
        }
      });
    } else if (action === 'DELETE') {
      // For delete, show all fields as removed (excluding system fields)
      Object.keys(asset).forEach((key) => {
        if (excludeFields.includes(key)) return;
        
        const value = asset[key as keyof Asset];
        if (value && value !== '') {
          changes.push({
            field: key,
            oldValue: value,
            newValue: null,
          });
        }
      });
    }

    // Send audit entry to API
    try {
      const response = await fetch('/api/log-audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetId: asset.id || '',
          user: 'Current User', // In a real app, this would come from authentication
          action,
          details: {
            assetBarcode: asset.assetBarcode,
            assetName: asset.primaryIdentifier,
            changes,
          },
        }),
      });

      if (!response.ok) {
        console.error('Failed to log audit entry');
      }
    } catch (error) {
      console.error('Error creating audit log entry:', error);
    }
  };

  // Fetch audit logs for a specific asset
  const fetchAuditLogs = async (assetId: string) => {
    try {
      const response = await fetch(`/api/audit-entries?assetId=${assetId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAuditLog(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  };

  const getFieldDisplayName = (field: string): string => {
    const fieldNames: { [key: string]: string } = {
      assetBarcode: 'Asset Barcode',
      primaryIdentifier: 'Primary Identifier',
      secondaryIdentifier: 'Secondary Identifier',
      assetType: 'Asset Type',
      status: 'Status',
      wing: 'Wing',
      wingInShort: 'Wing (Short)',
      room: 'Room',
      floor: 'Floor',
      floorInWords: 'Floor (Words)',
      roomNo: 'Room Number',
      roomName: 'Room Name',
      filterNeeded: 'Filter Needed',
      filtersOn: 'Filters On',
      filterExpiryDate: 'Filter Expiry Date',
      filterInstalledOn: 'Filter Installed On',
      notes: 'Notes',
      augmentedCare: 'Augmented Care',
      created: 'Created',
      createdBy: 'Created By',
      modified: 'Modified',
      modifiedBy: 'Modified By',
    };
    return fieldNames[field] || field;
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'string' && value.includes('T') && value.includes('Z')) {
      // Looks like an ISO date string
      try {
        return new Date(value).toLocaleDateString('en-GB');
      } catch {
        return value;
      }
    }
    return String(value);
  };

  // Form for adding/editing assets
  const form = useForm<{
    assetBarcode: string;
    primaryIdentifier: string;
    secondaryIdentifier: string;
    assetType: string;
    status: string;
    wing: string;
    wingInShort: string;
    room: string;
    floor: string;
    floorInWords: string;
    roomNo: string;
    roomName: string;
    filterNeeded: boolean;
    filtersOn: boolean;
    filterExpiryDate: Date | null;
    filterInstalledOn: Date | null;
    notes: string;
    augmentedCare: boolean;
  }>({
    initialValues: {
      assetBarcode: '',
      primaryIdentifier: '',
      secondaryIdentifier: '',
      assetType: '',
      status: 'ACTIVE',
      wing: '',
      wingInShort: '',
      room: '',
      floor: '',
      floorInWords: '',
      roomNo: '',
      roomName: '',
      filterNeeded: false,
      filtersOn: false,
      filterExpiryDate: null,
      filterInstalledOn: null,
      notes: '',
      augmentedCare: false,
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterAssets();
  }, [assets, searchTerm, statusFilter, typeFilter, wingFilter]);

  // Fetch audit logs when audit modal opens
  useEffect(() => {
    if (showAuditModal && selectedAssetAudit) {
      const asset = assets.find(a => a.assetBarcode === selectedAssetAudit);
      if (asset?.id) {
        fetchAuditLogs(asset.id);
      }
    }
  }, [showAuditModal, selectedAssetAudit, assets]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assetsResponse, dashboardResponse] = await Promise.all([
        fetch('/api/assets'),
        fetch('/api/dashboard')
      ]);
      
      // Handle assets response
      if (assetsResponse.ok) {
        const assetsData = await assetsResponse.json();
        if (assetsData.success && assetsData.data) {
          const assets = assetsData.data.items || assetsData.data.assets || [];
          setAssets(assets);
        }
      } else {
        throw new Error('Failed to fetch assets');
      }
      
      // Handle dashboard response
      if (dashboardResponse.ok) {
        const dashboardData = await dashboardResponse.json();
        if (dashboardData.success && dashboardData.data) {
          setStats(dashboardData.data);
        }
      } else {
        throw new Error('Failed to fetch dashboard stats');
      }

      notifications.show({
        title: 'Success',
        message: 'Data loaded successfully from DynamoDB!',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load data from DynamoDB. Please try again.',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAssets = () => {
    let filtered = assets;

    if (searchTerm) {
      filtered = filtered.filter(asset =>
        Object.values(asset).some(value =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(asset => asset.status === statusFilter);
    }

    if (typeFilter) {
      filtered = filtered.filter(asset => asset.assetType === typeFilter);
    }

    if (wingFilter) {
      filtered = filtered.filter(asset => asset.wing === wingFilter);
    }

    setFilteredAssets(filtered);
    setCurrentPage(1);
  };

  const handleAddAsset = async (values: any) => {
    try {
      const assetData = {
        ...values,
        assetBarcode: values.assetBarcode || `AUTO-${Date.now()}`,
        filterExpiryDate: values.filterExpiryDate ? values.filterExpiryDate.toISOString() : '',
        filterInstalledOn: values.filterInstalledOn ? values.filterInstalledOn.toISOString() : '',
      };



      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assetData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create asset');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create asset');
      }

      // Update local state with the new asset from DynamoDB
      setAssets(prev => [...prev, result.data]);
      
      // Create audit log entry for asset creation
      await createAuditLogEntry(result.data, 'CREATE');
      
      form.reset();
      closeModal();
      
      notifications.show({
        title: 'Success',
        message: 'Asset added successfully to DynamoDB!',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      console.error("Error creating asset:", error);
      notifications.show({
        title: 'Error',
        message: `Failed to add asset: ${error instanceof Error ? error.message : "Unknown error"}`,
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const handleEditAsset = async (values: any) => {
    try {
      if (!selectedAsset?.id) {
        throw new Error('No asset selected for update');
      }

      const updateData = {
        ...values,
        filterExpiryDate: values.filterExpiryDate ? values.filterExpiryDate.toISOString() : (selectedAsset?.filterExpiryDate || ""),
        filterInstalledOn: values.filterInstalledOn ? values.filterInstalledOn.toISOString() : (selectedAsset?.filterInstalledOn || ""),
      };



      const response = await fetch(`/api/assets/${selectedAsset.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update asset');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update asset');
      }

      // Create audit log entry using only user-modified fields for comparison
      if (selectedAsset) {
        await createAuditLogEntry(result.data as Asset, "UPDATE", selectedAsset);
      }

      // Update local state with the updated asset from DynamoDB
      setAssets(prev => prev.map(asset => 
        asset.id === selectedAsset?.id ? result.data : asset
      ));
      
      closeEditModal();
      setSelectedAsset(null);
      form.reset();
      
      notifications.show({
        title: "Success",
        message: "Asset updated successfully in DynamoDB!",
        color: "green",
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      console.error("Error updating asset:", error);
      notifications.show({
        title: "Error",
        message: `Failed to update asset: ${error instanceof Error ? error.message : "Unknown error"}`,
        color: "red",
        icon: <IconX size={16} />,
      });
    }
  };
  const handleDeleteAsset = (asset: Asset) => {
    modals.openConfirmModal({
      title: 'Delete Asset',
      children: (
        <Text size="sm">
          Are you sure you want to delete asset <strong>{asset.primaryIdentifier}</strong>? 
          This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          if (!asset.id) {
            throw new Error('Asset ID is required for deletion');
          }

    

          const response = await fetch(`/api/assets/${asset.id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete asset');
          }

          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to delete asset');
          }

          // Create audit log entry for asset deletion
          await createAuditLogEntry(asset, 'DELETE');
          
          // Update local state
          setAssets(prev => prev.filter(a => a.id !== asset.id));
          
          notifications.show({
            title: 'Success',
            message: 'Asset deleted successfully from DynamoDB!',
            color: 'green',
            icon: <IconCheck size={16} />,
          });
        } catch (error) {
          console.error("Error deleting asset:", error);
          notifications.show({
            title: 'Error',
            message: `Failed to delete asset: ${error instanceof Error ? error.message : "Unknown error"}`,
            color: 'red',
            icon: <IconX size={16} />,
          });
        }
      },
    });
  };

  const exportData = () => {
    const csvContent = [
      Object.keys(filteredAssets[0] || {}).join(','),
      ...filteredAssets.map(asset => Object.values(asset).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assets-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    notifications.show({
      title: 'Success',
      message: 'Data exported successfully!',
      color: 'green',
      icon: <IconDownload size={16} />,
    });
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'active' || statusLower === 'operational') {
      return 'green';
    } else if (statusLower.includes('maintenance') || statusLower.includes('repair')) {
      return 'yellow';
    } else {
      return 'gray';
    }
  };

  const StatCard = ({ title, value, icon, color, description, trend }: any) => (
    <Card shadow="sm" padding="lg" radius="md" withBorder className="hover:shadow-lg transition-shadow">
      <Group justify="apart">
        <div>
          <Text c="dimmed" size="sm" fw={500}>
            {title}
          </Text>
          <Text fw={700} size="xl">
            {loading ? <Loader size="sm" /> : value.toLocaleString()}
          </Text>
          {description && (
            <Text c="dimmed" size="xs" mt={4}>
              {description}
            </Text>
          )}
          {trend && (
            <Group gap={4} mt={4}>
              <IconTrendingUp size={12} color={trend > 0 ? 'green' : 'red'} />
              <Text size="xs" c={trend > 0 ? 'green' : 'red'}>
                {trend > 0 ? '+' : ''}{trend}%
              </Text>
            </Group>
          )}
        </div>
        <ThemeIcon color={color} size={38} radius="md">
          {icon}
        </ThemeIcon>
      </Group>
    </Card>
  );

  // Pagination
  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
  const paginatedAssets = filteredAssets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const rows = paginatedAssets.flatMap((asset) => {
    const isExpanded = expandedAssets.has(asset.assetBarcode);
    
    return [
      // Main row
      <Table.Tr key={asset.assetBarcode}>
        <Table.Td>
          <Tooltip label={isExpanded ? "Collapse Details" : "View Details"}>
            <ActionIcon
              variant="subtle"
              color="blue"
              onClick={() => toggleAssetExpansion(asset.assetBarcode)}
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
        </Table.Td>
        <Table.Td>
          <Group gap="sm">
            <ThemeIcon color="blue" size={30} radius="md">
              <IconDroplet size={16} />
            </ThemeIcon>
            <div>
              <Text fz="sm" fw={500}>
                {asset.primaryIdentifier}
              </Text>
              <Text fz="xs" c="dimmed">
                {asset.assetBarcode}
              </Text>
            </div>
          </Group>
        </Table.Td>
        <Table.Td>
          <Badge color={getStatusColor(asset.status)} variant="light">
            {asset.status || 'Unknown'}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Group gap="xs">
            <IconMapPin size={14} />
            <Text size="sm">
              {asset.wing} - {asset.roomName}
            </Text>
          </Group>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{asset.assetType}</Text>
        </Table.Td>
        <Table.Td>
          {(() => {
            if (typeof asset.filterNeeded === 'boolean') {
              return asset.filterNeeded ? (
                <Group gap="xs">
                  <IconClock size={14} color="orange" />
                  <Text size="sm" c="orange">Needed</Text>
                </Group>
              ) : (
                <Group gap="xs">
                  <IconCheck size={14} color="green" />
                  <Text size="sm" c="green">Good</Text>
                </Group>
              );
            }
            const filterNeededStr = asset.filterNeeded?.toString().toLowerCase();
            return filterNeededStr === 'yes' || filterNeededStr === 'true' ? (
              <Group gap="xs">
                <IconClock size={14} color="orange" />
                <Text size="sm" c="orange">Needed</Text>
              </Group>
            ) : (
              <Group gap="xs">
                <IconCheck size={14} color="green" />
                <Text size="sm" c="green">Good</Text>
              </Group>
            );
          })()}
        </Table.Td>
        <Table.Td>
          <Group gap="xs">
            <IconCalendar size={14} />
            <Text size="sm" c="dimmed">
              {asset.modified ? new Date(asset.modified).toLocaleDateString() : 'N/A'}
            </Text>
          </Group>
        </Table.Td>
      </Table.Tr>,
      
      // Expanded details row
      ...(isExpanded ? [
        <Table.Tr key={`${asset.assetBarcode}-details`}>
          <Table.Td colSpan={7}>
            <Box p="md" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
              <Stack gap="md">
                                  <Group justify="space-between">
                    <Title order={5}>Asset Details</Title>
                    <Group gap="xs">
                      <Tooltip label="View Audit Log">
                        <ActionIcon
                          variant="filled"
                          color="blue"
                          onClick={() => {
                            setSelectedAssetAudit(asset.assetBarcode);
                            openAuditModal();
                          }}
                        >
                          <IconHistory size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Edit Asset">
                        <ActionIcon
                          variant="filled"
                          color="yellow"
                          onClick={() => {
                            setSelectedAsset(asset);
                            form.setValues({
                              assetBarcode: asset.assetBarcode,
                              primaryIdentifier: asset.primaryIdentifier,
                              secondaryIdentifier: asset.secondaryIdentifier,
                              assetType: asset.assetType,
                              status: asset.status,
                              wing: asset.wing,
                              wingInShort: asset.wingInShort,
                              room: asset.room,
                              floor: asset.floor,
                              floorInWords: asset.floorInWords,
                              roomNo: asset.roomNo,
                              roomName: asset.roomName,
                              filterNeeded: typeof asset.filterNeeded === 'boolean' ? asset.filterNeeded : asset.filterNeeded === 'true',
                              filtersOn: typeof asset.filtersOn === 'boolean' ? asset.filtersOn : asset.filtersOn === 'true',
                              filterExpiryDate: asset.filterExpiryDate ? new Date(asset.filterExpiryDate) : null,
                              filterInstalledOn: asset.filterInstalledOn ? new Date(asset.filterInstalledOn) : null,
                              notes: asset.notes,
                              augmentedCare: typeof asset.augmentedCare === 'boolean' ? asset.augmentedCare : asset.augmentedCare === 'true',
                            });
                            openEditModal();
                          }}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete Asset">
                        <ActionIcon
                          variant="filled"
                          color="red"
                          onClick={() => handleDeleteAsset(asset)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>
                
                <Divider />
                
                <Grid>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Stack gap="xs">
                      <Text size="sm" fw={600} c="dimmed">BASIC INFORMATION</Text>
                      <Group justify="space-between">
                        <Text size="sm">Asset Barcode:</Text>
                        <Text size="sm" fw={500}>{asset.assetBarcode}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Primary ID:</Text>
                        <Text size="sm" fw={500}>{asset.primaryIdentifier}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Secondary ID:</Text>
                        <Text size="sm" fw={500}>{asset.secondaryIdentifier || 'N/A'}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Asset Type:</Text>
                        <Text size="sm" fw={500}>{asset.assetType}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Status:</Text>
                        <Badge color={getStatusColor(asset.status)} variant="light" size="sm">
                          {asset.status || 'Unknown'}
                        </Badge>
                      </Group>
                    </Stack>
                  </Grid.Col>
                  
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Stack gap="xs">
                      <Text size="sm" fw={600} c="dimmed">LOCATION DETAILS</Text>
                      <Group justify="space-between">
                        <Text size="sm">Wing:</Text>
                        <Text size="sm" fw={500}>{asset.wing}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Wing (Short):</Text>
                        <Text size="sm" fw={500}>{asset.wingInShort || 'N/A'}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Room:</Text>
                        <Text size="sm" fw={500}>{asset.room || 'N/A'}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Room Name:</Text>
                        <Text size="sm" fw={500}>{asset.roomName}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Room No:</Text>
                        <Text size="sm" fw={500}>{asset.roomNo || 'N/A'}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Floor:</Text>
                        <Text size="sm" fw={500}>{asset.floor || 'N/A'}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Floor (Words):</Text>
                        <Text size="sm" fw={500}>{asset.floorInWords || 'N/A'}</Text>
                      </Group>
                    </Stack>
                  </Grid.Col>
                  
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Stack gap="xs">
                      <Text size="sm" fw={600} c="dimmed">FILTER INFORMATION</Text>
                      <Group justify="space-between">
                        <Text size="sm">Filter Needed:</Text>
                        <Badge 
                          color={(() => {
                            if (typeof asset.filterNeeded === 'boolean') {
                              return asset.filterNeeded ? 'orange' : 'green';
                            }
                            const filterNeededStr = asset.filterNeeded?.toString().toLowerCase();
                            return filterNeededStr === 'yes' || filterNeededStr === 'true' ? 'orange' : 'green';
                          })()} 
                          variant="light" 
                          size="sm"
                        >
                          {(() => {
                            if (typeof asset.filterNeeded === 'boolean') {
                              return asset.filterNeeded ? 'Yes' : 'No';
                            }
                            const filterNeededStr = asset.filterNeeded?.toString().toLowerCase();
                            return filterNeededStr === 'yes' || filterNeededStr === 'true' ? 'Yes' : 'No';
                          })()}
                        </Badge>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Filters On:</Text>
                        <Badge 
                          color={(() => {
                            if (typeof asset.filtersOn === 'boolean') {
                              return asset.filtersOn ? 'green' : 'red';
                            }
                            const filtersOnStr = asset.filtersOn?.toString().toLowerCase();
                            return filtersOnStr === 'yes' || filtersOnStr === 'true' ? 'green' : 'red';
                          })()} 
                          variant="light" 
                          size="sm"
                        >
                          {(() => {
                            if (typeof asset.filtersOn === 'boolean') {
                              return asset.filtersOn ? 'Yes' : 'No';
                            }
                            const filtersOnStr = asset.filtersOn?.toString().toLowerCase();
                            return filtersOnStr === 'yes' || filtersOnStr === 'true' ? 'Yes' : 'No';
                          })()}
                        </Badge>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Filter Expiry:</Text>
                        <Text size="sm" fw={500}>
                          {asset.filterExpiryDate ? new Date(asset.filterExpiryDate).toLocaleDateString() : 'N/A'}
                        </Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Filter Installed:</Text>
                        <Text size="sm" fw={500}>
                          {asset.filterInstalledOn ? new Date(asset.filterInstalledOn).toLocaleDateString() : 'N/A'}
                        </Text>
                      </Group>
                    </Stack>
                  </Grid.Col>
                  
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Stack gap="xs">
                      <Text size="sm" fw={600} c="dimmed">ADDITIONAL INFO</Text>
                      <Group justify="space-between">
                        <Text size="sm">Augmented Care:</Text>
                        <Badge 
                          color={(() => {
                            if (typeof asset.augmentedCare === 'boolean') {
                              return asset.augmentedCare ? 'blue' : 'gray';
                            }
                            const augmentedCareStr = asset.augmentedCare?.toString().toLowerCase();
                            return augmentedCareStr === 'yes' || augmentedCareStr === 'true' ? 'blue' : 'gray';
                          })()} 
                          variant="light" 
                          size="sm"
                        >
                          {(() => {
                            if (typeof asset.augmentedCare === 'boolean') {
                              return asset.augmentedCare ? 'Yes' : 'No';
                            }
                            const augmentedCareStr = asset.augmentedCare?.toString().toLowerCase();
                            return augmentedCareStr === 'yes' || augmentedCareStr === 'true' ? 'Yes' : 'No';
                          })()}
                        </Badge>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Created:</Text>
                        <Text size="sm" fw={500}>
                          {asset.created ? new Date(asset.created).toLocaleDateString() : 'N/A'}
                        </Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Created By:</Text>
                        <Text size="sm" fw={500}>{asset.createdBy || 'N/A'}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Modified:</Text>
                        <Text size="sm" fw={500}>
                          {asset.modified ? new Date(asset.modified).toLocaleDateString() : 'N/A'}
                        </Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Modified By:</Text>
                        <Text size="sm" fw={500}>{asset.modifiedBy || 'N/A'}</Text>
                      </Group>
                    </Stack>
                  </Grid.Col>
                </Grid>
                
                {asset.notes && (
                  <>
                    <Divider />
                    <Stack gap="xs">
                      <Text size="sm" fw={600} c="dimmed">NOTES</Text>
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {asset.notes}
                      </Text>
                    </Stack>
                  </>
                )}
              </Stack>
            </Box>
          </Table.Td>
        </Table.Tr>
      ] : [])
    ];
  });

  // Chart data
  const statusChartData = Object.entries(stats.statusBreakdown || {}).map(([status, count]) => ({
    name: status,
    value: count,
    color: getStatusColor(status)
  }));

  const typeChartData = Object.entries(stats.assetTypeBreakdown || {}).map(([type, count]) => ({
    type,
    count
  }));

  const renderDashboard = () => (
    <Stack gap="lg">
      {/* Stats Grid */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Total Assets"
            value={stats.totalAssets}
            icon={<IconDroplet size={20} />}
            color="blue"
            description="All registered assets"
            trend={2.5}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Active Assets"
            value={stats.activeAssets}
            icon={<IconCheck size={20} />}
            color="green"
            description="Currently operational"
            trend={5.2}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Under Maintenance"
            value={stats.maintenanceAssets}
            icon={<IconAlertTriangle size={20} />}
            color="yellow"
            description="Requires attention"
            trend={-1.2}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatCard
            title="Filters Needed"
            value={stats.filtersNeeded}
            icon={<IconFilter size={20} />}
            color="red"
            description="Filter replacement due"
            trend={0.8}
          />
        </Grid.Col>
      </Grid>

      {/* Charts */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={4} mb="md">Asset Types Distribution</Title>
            {typeChartData.length > 0 && (
                             <BarChart
                 h={300}
                 data={typeChartData}
                 dataKey="type"
                 series={[{ name: 'count', color: 'blue.6' }]}
               />
            )}
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={4} mb="md">Status Overview</Title>
            {statusChartData.length > 0 && (
              <PieChart
                h={300}
                data={statusChartData}
                withTooltip
                tooltipDataSource="segment"
              />
            )}
          </Card>
        </Grid.Col>
      </Grid>

      {/* Recent Activity */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Recent Activity</Title>
        <Stack gap="xs">
          {assets.slice(0, 5).map((asset, index) => (
            <Group key={index} justify="space-between" p="xs" style={{ borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
              <Group gap="sm">
                <ThemeIcon color="blue" size={24} radius="md">
                  <IconDroplet size={12} />
                </ThemeIcon>
                <div>
                  <Text size="sm" fw={500}>{asset.primaryIdentifier}</Text>
                  <Text size="xs" c="dimmed">Last modified by {asset.modifiedBy}</Text>
                </div>
              </Group>
              <Text size="xs" c="dimmed">
                {asset.modified ? new Date(asset.modified).toLocaleDateString() : 'N/A'}
              </Text>
            </Group>
          ))}
        </Stack>
      </Card>
    </Stack>
  );

  const renderAssets = () => (
    <Stack gap="lg">
      {/* Filters and Actions */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Asset Management</Title>
          <Group>
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={fetchData}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              leftSection={<IconDownload size={16} />}
              variant="outline"
              onClick={exportData}
            >
              Export
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              gradient={{ from: 'blue', to: 'cyan' }}
              variant="gradient"
              onClick={openModal}
            >
              Add Asset
            </Button>
          </Group>
        </Group>

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <TextInput
              placeholder="Search assets..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              placeholder="Filter by status"
              data={['ACTIVE', 'INACTIVE', 'MAINTENANCE']}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || '')}
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              placeholder="Filter by type"
              data={Array.from(new Set(assets.map(a => a.assetType))).filter(Boolean)}
              value={typeFilter}
              onChange={(value) => setTypeFilter(value || '')}
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              placeholder="Filter by wing"
              data={Array.from(new Set(assets.map(a => a.wing))).filter(Boolean)}
              value={wingFilter}
              onChange={(value) => setWingFilter(value || '')}
              clearable
            />
          </Grid.Col>
        </Grid>
      </Card>

      {/* Assets Table */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={500}>
            Showing {paginatedAssets.length} of {filteredAssets.length} assets
          </Text>
          <Pagination
            total={totalPages}
            value={currentPage}
            onChange={setCurrentPage}
            size="sm"
          />
        </Group>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader size="lg" />
            <Text>Loading assets...</Text>
          </Group>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>View</Table.Th>
                  <Table.Th>Asset</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Location</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Filter Status</Table.Th>
                  <Table.Th>Last Updated</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.length > 0 ? rows : (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Group justify="center" py="xl">
                        <Stack align="center" gap="xs">
                          <IconDroplet size={48} color="gray" />
                          <Text c="dimmed">No assets found matching your criteria.</Text>
                        </Stack>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination
              total={totalPages}
              value={currentPage}
              onChange={setCurrentPage}
            />
          </Group>
        )}
      </Card>
    </Stack>
  );

  const renderReports = () => (
    <Stack gap="lg">
      <Title order={2}>Reports & Analytics</Title>
      <Text c="dimmed">Comprehensive reporting and analytics for your water tap assets.</Text>
      
      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={4}>Maintenance Schedule</Title>
              <Button size="xs" variant="light">View All</Button>
            </Group>
            <Text c="dimmed" size="sm">
              Track upcoming maintenance tasks and filter replacements.
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={4}>Performance Metrics</Title>
              <Button size="xs" variant="light">Generate Report</Button>
            </Group>
            <Text c="dimmed" size="sm">
              Asset performance and operational efficiency metrics.
            </Text>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );

  const renderSettings = () => (
    <Stack gap="lg">
      <Title order={2}>Settings</Title>
      <Text c="dimmed">Configure your water tap management system.</Text>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">System Configuration</Title>
        <Stack gap="md">
          <Checkbox label="Enable automatic notifications" defaultChecked />
          <Checkbox label="Send email alerts for filter replacements" defaultChecked />
          <Checkbox label="Generate weekly reports" />
          <Select
            label="Default view"
            placeholder="Select default view"
            data={['Dashboard', 'Assets', 'Reports']}
            defaultValue="Dashboard"
          />
        </Stack>
      </Card>
    </Stack>
  );

  return (
    <>
      <AppShell
        header={{ height: 70 }}
        navbar={hideTabContainer ? undefined : { width: 280, breakpoint: 'sm', collapsed: { mobile: !opened } }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group>
              <ActionIcon
                onClick={toggle}
                hiddenFrom="sm"
                size="lg"
                variant="subtle"
              >
                <IconHome size={18} />
              </ActionIcon>
              <Group gap="sm">
                <ThemeIcon color="blue" size={40} radius="md">
                  <IconDroplet size={24} />
                </ThemeIcon>
                <div>
                  <Title order={3} c="blue">AquaTrack Pro</Title>
                  <Text size="xs" c="dimmed">Water Tap Management</Text>
        </div>
              </Group>
            </Group>

            <Group>
              <Tooltip label={hideTabContainer ? "Show Navigation" : "Hide Navigation"}>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  onClick={() => setHideTabContainer(!hideTabContainer)}
                >
                  {hideTabContainer ? <IconChevronRight size={18} /> : <IconChevronDown size={18} />}
                </ActionIcon>
              </Tooltip>
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={() => spotlight.open()}
              >
                <IconSearch size={18} />
              </ActionIcon>
              <ActionIcon variant="subtle" size="lg">
                <Indicator color="red" size={8}>
                  <IconBell size={18} />
                </Indicator>
              </ActionIcon>
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <ActionIcon variant="subtle" size="lg">
                    <Avatar size={32} color="blue">
                      <IconUser size={18} />
                    </Avatar>
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<IconUser size={14} />}>
                    Profile
                  </Menu.Item>
                  <Menu.Item leftSection={<IconSettings size={14} />}>
                    Settings
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item leftSection={<IconMail size={14} />}>
                    Support
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </AppShell.Header>

{!hideTabContainer && (
          <AppShell.Navbar p="md">
            <Stack gap="xs">
              <Button
                variant={activeTab === 'dashboard' ? 'filled' : 'subtle'}
                leftSection={<IconDashboard size={16} />}
                justify="start"
                onClick={() => setActiveTab('dashboard')}
              >
                Dashboard
              </Button>
              <Button
                variant={activeTab === 'assets' ? 'filled' : 'subtle'}
                leftSection={<IconDroplet size={16} />}
                justify="start"
                onClick={() => setActiveTab('assets')}
              >
                Assets
              </Button>
              <Button
                variant={activeTab === 'reports' ? 'filled' : 'subtle'}
                leftSection={<IconReport size={16} />}
                justify="start"
                onClick={() => setActiveTab('reports')}
              >
                Reports
              </Button>
              <Button
                variant={activeTab === 'settings' ? 'filled' : 'subtle'}
                leftSection={<IconSettings size={16} />}
                justify="start"
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </Button>
            </Stack>

            <Paper p="md" mt="auto" withBorder>
              <Stack gap="xs">
                <Text size="sm" fw={500}>System Status</Text>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Operational</Text>
                  <Badge color="green" size="xs">98.5%</Badge>
                </Group>
                <Progress value={98.5} color="green" size="xs" />
                <Text size="xs" c="dimmed">Last updated: Just now</Text>
              </Stack>
            </Paper>
          </AppShell.Navbar>
        )}

        <AppShell.Main>
          <Container size="xl">

            {hideTabContainer && (
              <Card shadow="sm" padding="md" radius="md" withBorder mb="lg">
                <Group>
                  <Button
                    variant={activeTab === 'dashboard' ? 'filled' : 'subtle'}
                    leftSection={<IconDashboard size={16} />}
                    onClick={() => setActiveTab('dashboard')}
                    size="sm"
                  >
                    Dashboard
                  </Button>
                  <Button
                    variant={activeTab === 'assets' ? 'filled' : 'subtle'}
                    leftSection={<IconDroplet size={16} />}
                    onClick={() => setActiveTab('assets')}
                    size="sm"
                  >
                    Assets
                  </Button>
                  <Button
                    variant={activeTab === 'reports' ? 'filled' : 'subtle'}
                    leftSection={<IconReport size={16} />}
                    onClick={() => setActiveTab('reports')}
                    size="sm"
                  >
                    Reports
                  </Button>
                  <Button
                    variant={activeTab === 'settings' ? 'filled' : 'subtle'}
                    leftSection={<IconSettings size={16} />}
                    onClick={() => setActiveTab('settings')}
                    size="sm"
                  >
                    Settings
                  </Button>
                </Group>
              </Card>
            )}
            
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'assets' && renderAssets()}
            {activeTab === 'reports' && renderReports()}
            {activeTab === 'settings' && renderSettings()}
          </Container>
        </AppShell.Main>
      </AppShell>

      {/* Add Asset Modal */}
      <Modal opened={modalOpened} onClose={closeModal} title="Add New Asset" size="xl">
        <form onSubmit={form.onSubmit(handleAddAsset)}>
          <Stack gap="lg">
            {/* Basic Information */}
            <div>
              <Title order={5} mb="sm">Basic Information</Title>
              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="Asset Barcode"
                    placeholder="Enter barcode"
                    {...form.getInputProps('assetBarcode')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Primary Identifier"
                    placeholder="Enter identifier"
                    required
                    {...form.getInputProps('primaryIdentifier')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Secondary Identifier"
                    placeholder="Enter secondary identifier"
                    {...form.getInputProps('secondaryIdentifier')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label="Asset Type"
                    placeholder="Select type"
                    data={['Water Tap', 'Water Cooler', 'LNS Outlet - TMT', 'LNS Shower - TMT']}
                    required
                    {...form.getInputProps('assetType')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label="Status"
                    data={['ACTIVE', 'INACTIVE', 'MAINTENANCE']}
                    required
                    {...form.getInputProps('status')}
                  />
                </Grid.Col>
              </Grid>
    </div>

            <Divider />

            {/* Location Information */}
            <div>
              <Title order={5} mb="sm">Location Information</Title>
              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="Wing"
                    placeholder="Enter wing"
                    {...form.getInputProps('wing')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Wing (Short)"
                    placeholder="Enter wing abbreviation"
                    {...form.getInputProps('wingInShort')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Room"
                    placeholder="Enter room"
                    {...form.getInputProps('room')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Room Name"
                    placeholder="Enter room name"
                    {...form.getInputProps('roomName')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Room Number"
                    placeholder="Enter room number"
                    {...form.getInputProps('roomNo')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Floor"
                    placeholder="Enter floor"
                    {...form.getInputProps('floor')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Floor (In Words)"
                    placeholder="Enter floor in words"
                    {...form.getInputProps('floorInWords')}
                  />
                </Grid.Col>
              </Grid>
            </div>

            <Divider />

            {/* Filter Information */}
            <div>
              <Title order={5} mb="sm">Filter Information</Title>
              <Grid>
                <Grid.Col span={6}>
                  <DateInput
                    label="Filter Expiry Date"
                    placeholder="Select expiry date"
                    {...form.getInputProps('filterExpiryDate')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <DateInput
                    label="Filter Installed On"
                    placeholder="Select installation date"
                    {...form.getInputProps('filterInstalledOn')}
                  />
                </Grid.Col>
              </Grid>
              <Group mt="md">
                <Checkbox
                  label="Filter Needed"
                  {...form.getInputProps('filterNeeded', { type: 'checkbox' })}
                />
                <Checkbox
                  label="Filters On"
                  {...form.getInputProps('filtersOn', { type: 'checkbox' })}
                />
                <Checkbox
                  label="Augmented Care"
                  {...form.getInputProps('augmentedCare', { type: 'checkbox' })}
                />
              </Group>
            </div>

            <Divider />

            {/* Notes */}
            <div>
              <Title order={5} mb="sm">Additional Notes</Title>
              <Textarea
                label="Notes"
                placeholder="Additional notes and comments"
                rows={4}
                {...form.getInputProps('notes')}
              />
            </div>

            <Group justify="flex-end" mt="lg">
              <Button variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit">
                Add Asset
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Edit Asset Modal */}
      <Modal opened={editModalOpened} onClose={closeEditModal} title="Edit Asset" size="xl">
        <form onSubmit={form.onSubmit(handleEditAsset)}>
          <Stack gap="lg">
            {/* Basic Information */}
            <div>
              <Title order={5} mb="sm">Basic Information</Title>
              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="Asset Barcode"
                    placeholder="Enter barcode"
                    {...form.getInputProps('assetBarcode')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Primary Identifier"
                    placeholder="Enter identifier"
                    required
                    {...form.getInputProps('primaryIdentifier')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Secondary Identifier"
                    placeholder="Enter secondary identifier"
                    {...form.getInputProps('secondaryIdentifier')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label="Asset Type"
                    placeholder="Select type"
                    data={['Water Tap', 'Water Cooler', 'LNS Outlet - TMT', 'LNS Shower - TMT']}
                    required
                    {...form.getInputProps('assetType')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label="Status"
                    data={['ACTIVE', 'INACTIVE', 'MAINTENANCE']}
                    required
                    {...form.getInputProps('status')}
                  />
                </Grid.Col>
              </Grid>
            </div>

            <Divider />

            {/* Location Information */}
            <div>
              <Title order={5} mb="sm">Location Information</Title>
              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="Wing"
                    placeholder="Enter wing"
                    {...form.getInputProps('wing')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Wing (Short)"
                    placeholder="Enter wing abbreviation"
                    {...form.getInputProps('wingInShort')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Room"
                    placeholder="Enter room"
                    {...form.getInputProps('room')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Room Name"
                    placeholder="Enter room name"
                    {...form.getInputProps('roomName')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Room Number"
                    placeholder="Enter room number"
                    {...form.getInputProps('roomNo')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Floor"
                    placeholder="Enter floor"
                    {...form.getInputProps('floor')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Floor (In Words)"
                    placeholder="Enter floor in words"
                    {...form.getInputProps('floorInWords')}
                  />
                </Grid.Col>
              </Grid>
            </div>

            <Divider />

            {/* Filter Information */}
            <div>
              <Title order={5} mb="sm">Filter Information</Title>
              <Grid>
                <Grid.Col span={6}>
                  <DateInput
                    label="Filter Expiry Date"
                    placeholder="Select expiry date"
                    {...form.getInputProps('filterExpiryDate')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <DateInput
                    label="Filter Installed On"
                    placeholder="Select installation date"
                    {...form.getInputProps('filterInstalledOn')}
                  />
                </Grid.Col>
              </Grid>
              <Group mt="md">
                <Checkbox
                  label="Filter Needed"
                  {...form.getInputProps('filterNeeded', { type: 'checkbox' })}
                />
                <Checkbox
                  label="Filters On"
                  {...form.getInputProps('filtersOn', { type: 'checkbox' })}
                />
                <Checkbox
                  label="Augmented Care"
                  {...form.getInputProps('augmentedCare', { type: 'checkbox' })}
                />
              </Group>
            </div>

            <Divider />

            {/* Notes */}
            <div>
              <Title order={5} mb="sm">Additional Notes</Title>
              <Textarea
                label="Notes"
                placeholder="Additional notes and comments"
                rows={4}
                {...form.getInputProps('notes')}
              />
            </div>

            <Group justify="flex-end" mt="lg">
              <Button variant="outline" onClick={closeEditModal}>
                Cancel
              </Button>
              <Button type="submit">
                Update Asset
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Audit Log Modal */}
      <Modal 
        opened={showAuditModal} 
        onClose={closeAuditModal} 
        title="Asset Audit Log" 
        size="xl"
      >
        <Stack gap="md">
          {selectedAssetAudit && (
            <>
              <Group justify="space-between">
                <Group>
                  <Text fw={500}>Asset: {selectedAssetAudit}</Text>
                  <Badge color="blue" variant="light">
                    {auditLog.length} entries
                  </Badge>
                </Group>
              </Group>
              
              <ScrollArea h={500}>
                <Stack gap="sm">
                  {auditLog.map((entry, index) => (
                    <Card key={`${entry.assetId}-${entry.timestamp}-${index}`} shadow="sm" padding="md" radius="md" withBorder>
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Group gap="xs">
                            <Badge 
                              color={
                                entry.action === 'CREATE' ? 'green' : 
                                entry.action === 'UPDATE' ? 'blue' : 'red'
                              }
                              variant="light"
                            >
                              {entry.action}
                            </Badge>
                            <Text size="sm" fw={500}>
                              {entry.action === 'CREATE' ? 'Asset Created' :
                               entry.action === 'UPDATE' ? 'Asset Updated' : 'Asset Deleted'}
                            </Text>
                          </Group>
                          <Group gap="xs">
                            <Text size="xs" c="dimmed">
                              {new Date(entry.timestamp).toLocaleDateString('en-GB')} at {new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour12: false })}
                            </Text>
                            <Text size="xs" c="dimmed">
                              by {entry.user}
                            </Text>
                          </Group>
                        </Group>
                        
                        {entry.details?.changes && entry.details.changes.length > 0 && (
                          <div>
                            <Text size="sm" fw={500} mb="xs">Changes:</Text>
                            <Stack gap="xs">
                              {entry.details.changes.map((change: any, changeIndex: number) => (
                                <Paper key={changeIndex} p="xs" bg="gray.0" radius="sm">
                                  <Grid>
                                    <Grid.Col span={3}>
                                      <Text size="xs" fw={500}>
                                        {getFieldDisplayName(change.field)}
                                      </Text>
                                    </Grid.Col>
                                    <Grid.Col span={4}>
                                      <Text size="xs" c="red">
                                        {change.oldValue !== null ? formatValue(change.oldValue) : 'N/A'}
                                      </Text>
                                    </Grid.Col>
                                    <Grid.Col span={1}>
                                      <Text size="xs" ta="center">→</Text>
                                    </Grid.Col>
                                    <Grid.Col span={4}>
                                      <Text size="xs" c="green">
                                        {change.newValue !== null ? formatValue(change.newValue) : 'N/A'}
                                      </Text>
                                    </Grid.Col>
                                  </Grid>
                                </Paper>
                              ))}
                            </Stack>
                          </div>
                        )}
                      </Stack>
                    </Card>
                  ))}
                  
                  {auditLog.length === 0 && (
                    <Group justify="center" py="xl">
                      <Stack align="center" gap="xs">
                        <IconHistory size={48} color="gray" />
                        <Text c="dimmed">No audit entries found for this asset.</Text>
                      </Stack>
                    </Group>
                  )}
                </Stack>
              </ScrollArea>
            </>
          )}
        </Stack>
      </Modal>

      {/* Spotlight Search */}
      <Spotlight
        actions={assets.map(asset => ({
          id: asset.assetBarcode,
          label: asset.primaryIdentifier,
          description: `${asset.assetType} - ${asset.wing}`,
          onClick: () => {
            setActiveTab('assets');
            setSearchTerm(asset.primaryIdentifier);
          },
          leftSection: <IconDroplet size={18} />,
        }))}
        searchProps={{
          leftSection: <IconSearch size={20} />,
          placeholder: 'Search assets...',
        }}
      />
    </>
  );
}
