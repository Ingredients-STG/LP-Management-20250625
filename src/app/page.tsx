'use client';

import { useState, useEffect, useRef } from 'react';
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
  MultiSelect,
  Textarea,
  Checkbox,
  Pagination,
  Tooltip,
  ScrollArea,
  Collapse,
  Divider,
  Box,
  FileInput,
  Drawer,
} from '@mantine/core';
import { DateInput, DatePickerInput } from '@mantine/dates';
import { BarChart, PieChart } from '@mantine/charts';
import { Spotlight } from '@mantine/spotlight';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { spotlight } from '@mantine/spotlight';
import BarcodeScanner from '@/components/BarcodeScanner';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

import { getCurrentUser, formatTimestamp } from '@/lib/utils';
import * as XLSX from 'xlsx';
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
  IconPaperclip,
  IconScan,
  IconMenu2,
  IconLogout,
  IconFileSpreadsheet,
  IconBarcode,
  IconFileReport,
  IconChevronUp,
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
  needFlushing: boolean | string;
  filterType: string;
  notes: string;
  augmentedCare: boolean | string;
  attachments?: Array<{
    fileName: string;
    fileType: string;
    s3Url: string;
    uploadedAt: string;
  }>;
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

// Add a helper for safe date parsing
function safeDate(val: any): Date | null {
  if (!val) return null;
  try {
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    if (typeof val === 'string' && val.trim() !== '') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
    }
  } catch {}
  return null;
}

// Helper to get date and time string in YYYY-MM-DD_HHMMSS format
const getDateTimeString = () => {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now
    .toTimeString()
    .split(' ')[0]
    .replace(/:/g, ''); // HHMMSS
  return `${date}_${time}`;
};

export default function HomePage() {
  const { user, signOut } = useAuth();
  const [opened, { toggle }] = useDisclosure();

  // Handle unhandled promise rejections for Safari compatibility
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault(); // Prevent the default browser behavior
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
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
  // Filter UI states (non-functional for now)
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [wingFilter, setWingFilter] = useState<string[]>([]);
  const [floorFilter, setFloorFilter] = useState<string[]>([]);
  const [filterTypeFilter, setFilterTypeFilter] = useState<string[]>([]);
  const [needFlushingFilter, setNeedFlushingFilter] = useState<string[]>([]);
  const [filterNeededFilter, setFilterNeededFilter] = useState<string[]>([]);
  const [filtersOnFilter, setFiltersOnFilter] = useState<string[]>([]);
  const [augmentedCareFilter, setAugmentedCareFilter] = useState<string[]>([]);
  const [filterExpiryRange, setFilterExpiryRange] = useState<[Date | null, Date | null]>([null, null]);
  const [filterExpiryStatus, setFilterExpiryStatus] = useState<string>('');
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage({ key: 'sidebarCollapsed', defaultValue: false });
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [showAuditModal, { open: openAuditModal, close: closeAuditModal }] = useDisclosure(false);
  const [selectedAssetAudit, setSelectedAssetAudit] = useState<string>('');
  const [showViewModal, { open: openViewModal, close: closeViewModal }] = useDisclosure(false);
  const [assetTypes, setAssetTypes] = useState<string[]>(['Water Tap', 'Water Cooler', 'LNS Outlet - TMT', 'LNS Shower - TMT']);
  const [showNewAssetTypeInput, setShowNewAssetTypeInput] = useState(false);
  const [newAssetType, setNewAssetType] = useState('');
  const [filterTypes, setFilterTypes] = useState<string[]>(['Standard', 'Advanced', 'Premium', 'Basic']);
  const [showNewFilterTypeInput, setShowNewFilterTypeInput] = useState(false);
  const [newFilterType, setNewFilterType] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResults, setUploadResults] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [assetFiles, setAssetFiles] = useState<File[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  const [showAuditDrawer, { open: openAuditDrawer, close: closeAuditDrawer }] = useDisclosure(false);
  const [globalAuditLog, setGlobalAuditLog] = useState<AuditLogEntry[]>([]);
  
  // Pagination states for audit logs
  const [auditLogPagination, setAuditLogPagination] = useState<{
    hasMore: boolean;
    lastEvaluatedKey: string | null;
    loading: boolean;
  }>({
    hasMore: false,
    lastEvaluatedKey: null,
    loading: false
  });
  
  const [globalAuditLogPagination, setGlobalAuditLogPagination] = useState<{
    hasMore: boolean;
    lastEvaluatedKey: string | null;
    loading: boolean;
  }>({
    hasMore: false,
    lastEvaluatedKey: null,
    loading: false
  });
  
  // Debug: Monitor auditLog state changes
  useEffect(() => {
    console.log('Frontend: auditLog state changed:', auditLog.length, 'entries');
    if (auditLog.length > 0) {
      console.log('Frontend: First audit entry:', auditLog[0]);
    }
  }, [auditLog]);
  
  // Bulk Update states
  const [bulkUpdateFile, setBulkUpdateFile] = useState<File | null>(null);
  const [bulkUpdateLoading, setBulkUpdateLoading] = useState(false);
  const [bulkUpdateResults, setBulkUpdateResults] = useState<any>(null);

  const [filtersCollapsed, setFiltersCollapsed] = useLocalStorage({ key: 'filtersCollapsed', defaultValue: false });

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
      const auditData = {
        assetId: asset.id || '',
        user: user?.email || user?.username || 'Unknown User', // Get current user from authentication
        action,
        details: {
          assetBarcode: asset.assetBarcode,
          assetName: asset.primaryIdentifier,
          changes,
        },
      };
      
      console.log('Creating audit log entry:', {
        assetId: auditData.assetId,
        action: auditData.action,
        changesCount: changes.length
      });
      
      const response = await fetch('/api/log-audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(auditData),
      });

      if (!response.ok) {
        console.error('Failed to log audit entry');
      } else {
        console.log('Audit log entry created successfully');
      }
    } catch (error) {
      console.error('Error creating audit log entry:', error);
    }
  };

  // Fetch audit logs for a specific asset with pagination
  const fetchAuditLogs = async (assetId: string, loadMore: boolean = false) => {
    try {
      if (loadMore && auditLogPagination.loading) return;
      
      const params = new URLSearchParams({
        assetId,
        limit: '100'
      });
      
      if (loadMore && auditLogPagination.lastEvaluatedKey) {
        params.append('lastEvaluatedKey', auditLogPagination.lastEvaluatedKey);
      }
      
      console.log('Frontend: Fetching audit logs for asset:', assetId, loadMore ? '(loading more)' : '');
      console.log('Frontend: Using params:', params.toString());
      const response = await fetch(`/api/audit-entries?${params}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('Frontend: Received audit log data:', result.data.length, 'entries');
          console.log('Frontend: Pagination info:', result.pagination);
          
          if (loadMore) {
            // Append new entries to existing ones
            setAuditLog(prev => [...prev, ...result.data]);
          } else {
            // Replace existing entries
            setAuditLog(result.data);
          }
          
          // Update pagination state
          setAuditLogPagination({
            hasMore: result.pagination.hasMore,
            lastEvaluatedKey: result.pagination.lastEvaluatedKey,
            loading: false
          });
          
          console.log('Frontend: Audit log state updated');
        } else {
          console.log('Frontend: API returned success: false');
        }
      } else {
        console.log('Frontend: API response not ok:', response.status);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setAuditLogPagination(prev => ({ ...prev, loading: false }));
    }
  };

  // Fetch global audit logs with pagination
  const fetchGlobalAuditLogs = async (loadMore: boolean = false) => {
    try {
      if (loadMore && globalAuditLogPagination.loading) return;
      
      const params = new URLSearchParams({
        limit: '100'
      });
      
      if (loadMore && globalAuditLogPagination.lastEvaluatedKey) {
        params.append('lastEvaluatedKey', globalAuditLogPagination.lastEvaluatedKey);
      }
      
      console.log('Frontend: Fetching global audit logs', loadMore ? '(loading more)' : '');
      const response = await fetch(`/api/audit-entries?${params}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('Frontend: Received global audit log data:', result.data.length, 'entries');
          console.log('Frontend: Pagination info:', result.pagination);
          
          if (loadMore) {
            // Append new entries to existing ones
            setGlobalAuditLog(prev => [...prev, ...result.data]);
          } else {
            // Replace existing entries
            setGlobalAuditLog(result.data);
          }
          
          // Update pagination state
          setGlobalAuditLogPagination({
            hasMore: result.pagination.hasMore,
            lastEvaluatedKey: result.pagination.lastEvaluatedKey,
            loading: false
          });
        }
      }
    } catch (error) {
      console.error('Error fetching global audit logs:', error);
      setGlobalAuditLogPagination(prev => ({ ...prev, loading: false }));
    }
  };

  // Load more audit logs for specific asset
  const loadMoreAuditLogs = async () => {
    if (!selectedAssetAudit) return;
    
    const asset = assets.find(a => a.assetBarcode === selectedAssetAudit);
    if (asset?.id) {
      setAuditLogPagination(prev => ({ ...prev, loading: true }));
      await fetchAuditLogs(asset.id, true);
    }
  };

  // Load more global audit logs
  const loadMoreGlobalAuditLogs = async () => {
    setGlobalAuditLogPagination(prev => ({ ...prev, loading: true }));
    await fetchGlobalAuditLogs(true);
  };

  // Fetch asset types from database
  const fetchAssetTypes = async () => {
    try {
      const response = await fetch('/api/asset-types');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const typeLabels = result.data.map((type: any) => type.label).filter(Boolean);
          // Remove duplicates using Set
          const uniqueTypeLabels = [...new Set(typeLabels)] as string[];
          setAssetTypes(uniqueTypeLabels);
        }
      }
    } catch (error) {
      console.error('Error fetching asset types:', error);
    }
  };

  const fetchFilterTypes = async () => {
    try {
      const response = await fetch('/api/filter-types');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Remove duplicates using Set and filter out any null/undefined values
          const uniqueFilterTypes = [...new Set(result.data.filter(Boolean))] as string[];
          setFilterTypes(uniqueFilterTypes);
        }
      }
    } catch (error) {
      console.error('Error fetching filter types:', error);
    }
  };

  // Handle adding new asset type
  const handleAddNewAssetType = async () => {
    if (newAssetType.trim() && !assetTypes.includes(newAssetType.trim())) {
      try {
        const response = await fetch('/api/asset-types', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            label: newAssetType.trim(),
            createdBy: 'user',
          }),
        });

        if (response.ok) {
          await fetchAssetTypes(); // Refresh the list
          form.setFieldValue('assetType', newAssetType.trim());
          setNewAssetType('');
          setShowNewAssetTypeInput(false);
          
          notifications.show({
            title: 'Success',
            message: `Asset type "${newAssetType.trim()}" added successfully!`,
            color: 'green',
            icon: <IconCheck size={16} />,
          });
        }
      } catch (error) {
        console.error('Error adding asset type:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to add asset type',
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    }
  };

  // Handle deleting asset type
  const handleDeleteAssetType = (typeLabel: string) => {
    modals.openConfirmModal({
      title: 'Delete Asset Type',
      children: (
        <Text size="sm">
          Are you sure you want to delete asset type <strong>{typeLabel}</strong>? 
          This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await fetch('/api/asset-types', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ label: typeLabel }),
          });

          if (response.ok) {
            await fetchAssetTypes(); // Refresh the list
            notifications.show({
              title: 'Success',
              message: `Asset type "${typeLabel}" deleted successfully!`,
              color: 'green',
              icon: <IconCheck size={16} />,
            });
          } else {
            throw new Error('Failed to delete asset type');
          }
        } catch (error) {
          console.error('Error deleting asset type:', error);
          notifications.show({
            title: 'Error',
            message: 'Failed to delete asset type',
            color: 'red',
            icon: <IconX size={16} />,
          });
        }
      },
    });
  };

  // Filter Type Management Functions
  const handleAddNewFilterType = async () => {
    if (!newFilterType.trim()) return;

    try {
      const response = await fetch('/api/filter-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ label: newFilterType.trim() }),
      });

      if (response.ok) {
        setFilterTypes(prev => [...prev, newFilterType.trim()]);
        setNewFilterType('');
        setShowNewFilterTypeInput(false);
        
        notifications.show({
          title: 'Success',
          message: 'Filter type added successfully!',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        throw new Error('Failed to create filter type');
      }
    } catch (error) {
      console.error('Error adding filter type:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to add filter type',
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const handleDeleteFilterType = (typeLabel: string) => {
    modals.openConfirmModal({
      title: 'Delete Filter Type',
      children: (
        <Text size="sm">
          Are you sure you want to delete filter type <strong>{typeLabel}</strong>? 
          This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await fetch('/api/filter-types', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ label: typeLabel }),
          });

          if (response.ok) {
            setFilterTypes(prev => prev.filter(type => type !== typeLabel));
            
            notifications.show({
              title: 'Success',
              message: `Filter type "${typeLabel}" deleted successfully!`,
              color: 'green',
              icon: <IconCheck size={16} />,
            });
          } else {
            throw new Error('Failed to delete filter type');
          }
        } catch (error) {
          console.error('Error deleting filter type:', error);
          notifications.show({
            title: 'Error',
            message: 'Failed to delete filter type',
            color: 'red',
            icon: <IconX size={16} />,
          });
        }
      },
    });
  };

  const handleFilterTypeSelect = (value: string | null) => {
    if (value === 'ADD_NEW') {
      setShowNewFilterTypeInput(true);
      setNewFilterType('');
    } else if (value) {
      form.setFieldValue('filterType', value);
      setShowNewFilterTypeInput(false);
    }
  };

  // Handle file upload for assets
  const handleFileUpload = async (file: File, assetId: string) => {
    try {
      setIsUploadingFile(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('assetId', assetId);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const result = await response.json();
      if (result.success) {
        notifications.show({
          title: 'Success',
          message: `File "${file.name}" uploaded successfully!`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        return result.data;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      notifications.show({
        title: 'Error',
        message: `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        color: 'red',
        icon: <IconX size={16} />,
      });
      return null;
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Handle file deletion
  const handleFileDelete = async (s3Url: string, fileName: string) => {
    try {
      const response = await fetch('/api/upload', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ s3Url }),
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: `File "${fileName}" deleted successfully!`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        return true;
      } else {
        throw new Error('Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      notifications.show({
        title: 'Error',
        message: `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        color: 'red',
        icon: <IconX size={16} />,
      });
      return false;
    }
  };

  // Barcode scanner functions
  const startBarcodeScanner = () => {
    if (!showBarcodeScanner) { // Prevent multiple modals
      setShowBarcodeScanner(true);
    }
  };

  const stopBarcodeScanner = () => {
    setShowBarcodeScanner(false);
  };

  const handleBarcodeScan = (result: string) => {
    setSearchTerm(result);
    stopBarcodeScanner();
    notifications.show({
      title: 'Barcode Scanned',
      message: `Found barcode: ${result}`,
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  const handleScannerError = (error: string) => {
    // Only show error notification once, don't repeat
    if (!showBarcodeScanner) return;
    
    console.error('Barcode scanner error:', error);
    // Don't show notification for camera errors - the component handles it
  };

  // Handle asset type selection
  const handleAssetTypeSelect = (value: string | null) => {
    if (value === 'ADD_NEW') {
      setShowNewAssetTypeInput(true);
      setNewAssetType('');
    } else if (value) {
      form.setFieldValue('assetType', value);
      setShowNewAssetTypeInput(false);
    }
  };



  // Handle bulk upload
  const handleBulkUpload = async () => {
    if (!uploadFile) {
      notifications.show({
        title: 'Error',
        message: 'Please select a file to upload',
        color: 'red',
        icon: <IconX size={16} />,
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await fetch('/api/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        if (response.status === 504) {
          throw new Error('Request timeout. The file may be too large or the server is busy. Please try with a smaller file or try again later.');
        }
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText || 'Unknown error'}`);
      }

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        throw new Error('Invalid response from server. Please try again.');
      }
      
      if (result.success) {
        setUploadResults(result.results);
        notifications.show({
          title: 'Upload Complete',
          message: `Successfully uploaded ${result.results.success} assets`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        
        // Refresh data
        await fetchData();
      } else {
        notifications.show({
          title: 'Upload Failed',
          message: result.error || 'Upload failed. Please check the file and try again.',
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      notifications.show({
        title: 'Upload Error',
        message: error instanceof Error ? error.message : 'An error occurred during upload',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Download template
  const downloadTemplate = async (format: 'csv' | 'excel' = 'csv') => {
    try {
      const response = await fetch(`/api/bulk-upload?format=${format}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateTimeStr = getDateTimeString();
        a.download = `bulk-upload-template_${dateTimeStr}.${format === 'excel' ? 'xlsx' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        notifications.show({
          title: 'Template Downloaded',
          message: `Bulk upload template (${format.toUpperCase()}) has been downloaded successfully`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        throw new Error('Failed to download template');
      }
    } catch (error) {
      console.error('Download error:', error);
      notifications.show({
        title: 'Download Error',
        message: 'Failed to download template',
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  // Bulk Update Functions
  const downloadBulkUpdateTemplate = async (format: 'csv' | 'excel' = 'csv', includeData: boolean = false) => {
    try {
      const response = await fetch(`/api/bulk-update-template?format=${format}&includeData=${includeData}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateTimeStr = getDateTimeString();
        const suffix = includeData ? 'with-data' : 'template';
        a.download = `bulk-update-${suffix}_${dateTimeStr}.${format === 'excel' ? 'xlsx' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        notifications.show({
          title: 'Template Downloaded',
          message: `Bulk update ${includeData ? 'template with current data' : 'template'} has been downloaded successfully`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        throw new Error('Failed to download template');
      }
    } catch (error) {
      console.error('Error downloading bulk update template:', error);
      notifications.show({
        title: 'Download Failed',
        message: 'Failed to download bulk update template',
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const handleBulkUpdate = async () => {
    if (!bulkUpdateFile) {
      notifications.show({
        title: 'No File Selected',
        message: 'Please select a file to upload',
        color: 'orange',
        icon: <IconExclamationMark size={16} />,
      });
      return;
    }

    setBulkUpdateLoading(true);
    setBulkUpdateResults(null);

    try {
      const formData = new FormData();
      formData.append('file', bulkUpdateFile);
      // Add current user info for audit logging
      formData.append('user', user?.email || user?.username || 'Unknown User');

      const response = await fetch('/api/bulk-update', {
        method: 'POST',
        body: formData,
      });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        if (response.status === 504) {
          throw new Error('Request timeout. The file may be too large or the server is busy. Please try with a smaller file or try again later.');
        }
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText || 'Unknown error'}`);
      }

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        throw new Error('Invalid response from server. Please try again.');
      }

      if (result.success) {
        setBulkUpdateResults(result.results);
        
        // Show success notification
        notifications.show({
          title: 'Bulk Update Complete',
          message: `Updated ${result.results.updated} assets successfully`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });

        // Refresh data
        await fetchData();
        
        // Clear file input
        setBulkUpdateFile(null);
      } else {
        throw new Error(result.error || 'Bulk update failed');
      }
    } catch (error) {
      console.error('Error during bulk update:', error);
      notifications.show({
        title: 'Bulk Update Failed',
        message: error instanceof Error ? error.message : 'An error occurred during bulk update',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setBulkUpdateLoading(false);
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
      filterType: 'Filter Type',
      needFlushing: 'Needs Flushing',
      notes: 'Notes',
      augmentedCare: 'Augmented Care',
      created: 'Created',
      createdBy: 'Created By',
      modified: 'Modified',
      modifiedBy: 'Modified By',
    };
    return fieldNames[field] || field;
  };

  const formatValue = (value: any, isOldValue = false): string => {
    if (value === undefined && isOldValue) {
      return 'Not previously set';
    }
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
    // Handle YYYY-MM-DD date format
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      try {
        const [year, month, day] = value.split('-');
        return `${day}/${month}/${year}`;
      } catch {
        return value;
      }
    }
    return String(value).trim();
  };

  /**
   * Auto-calculate Filter Expiry Date (exactly 3 months later)
   * If the resulting date doesn't exist (e.g., 30th Feb), shift to next valid date
   */
  const calculateFilterExpiry = (installedDate: Date): Date => {
    const expiry = new Date(installedDate);
    
    // Get the original day of the month
    const originalDay = installedDate.getDate();
    
    // Add exactly 3 months
    expiry.setMonth(expiry.getMonth() + 3);
    
    // Handle edge cases where the day doesn't exist in the target month
    // Example: Nov 30 + 3 months = Feb 30 (doesn't exist) -> Mar 1
    if (expiry.getDate() !== originalDay) {
      // The date was automatically adjusted by JavaScript (e.g., Feb 30 -> Mar 2)
      // Set to the 1st day of the next month as per your requirement
      expiry.setDate(1);
    }
    
    return expiry;
  };

  // Field sanitization function
  const sanitizeField = (value: any, fieldName: string): any => {
    if (value === null || value === undefined) return value;
    
    const stringValue = String(value).trim();
    
    // Special handling for asset barcode - always uppercase
    if (fieldName === 'assetBarcode') {
      return stringValue.toUpperCase();
    }
    
    return stringValue;
  };

  // Helper function to check filter expiry status
  const getFilterExpiryStatus = (expiryDate: string | null, installedDate?: string | null) => {
    if (!expiryDate) return { status: 'unknown', color: 'gray', text: 'N/A' };
    
    // Parse the date with explicit timezone handling to avoid timezone shifts
    const expiry = new Date(expiryDate.includes('T') ? expiryDate : expiryDate + 'T00:00:00.000Z');
    const today = new Date();
    
    // Set today to start of day in UTC to match the expiry date format
    const todayUTC = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const daysUntilExpiry = Math.ceil((expiry.getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { 
        status: 'expired', 
        color: 'red', 
        text: `Expired ${Math.abs(daysUntilExpiry)} days ago`,
        daysUntilExpiry 
      };
    } else if (daysUntilExpiry <= 7) {
      return { 
        status: 'expiring-soon', 
        color: 'orange', 
        text: `Expires in ${daysUntilExpiry} days`,
        daysUntilExpiry 
      };
    } else if (daysUntilExpiry <= 30) {
      return { 
        status: 'expiring-month', 
        color: 'yellow', 
        text: `Expires in ${daysUntilExpiry} days`,
        daysUntilExpiry 
      };
    } else {
      return { 
        status: 'good', 
        color: 'green', 
        text: `Expires in ${daysUntilExpiry} days`,
        daysUntilExpiry 
      };
    }
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
    needFlushing: boolean;
    filterType: string;
    notes: string;
    augmentedCare: boolean;
  }>({
    mode: 'uncontrolled',
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
      needFlushing: false,
      filterType: '',
      notes: '',
      augmentedCare: false,
    },
    validate: {
      assetBarcode: (value) => {
        if (!value || value.trim() === '') {
          return 'Asset barcode is required';
        }
        return null;
      },
      primaryIdentifier: (value) => {
        if (!value || value.trim() === '') {
          return 'Primary identifier is required';
        }
        return null;
      },
    },
  });

  useEffect(() => {
    const initializeData = async () => {
      try {
        await Promise.all([
          fetchData(),
          fetchAssetTypes(),
          fetchFilterTypes()
        ]);
      } catch (error) {
        console.error('Error initializing data:', error);
        // Error handling is already done in individual functions
      }
    };
    
    initializeData();
  }, []);

  useEffect(() => {
    // Filter by search term and active filters
    setFilteredAssets(assets.filter(asset => {
      // Search term filter
      const matchesSearch = searchTerm ? Object.values(asset).some(value =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      ) : true;
      
      // Status filter
      const matchesStatus = statusFilter.length > 0 ? statusFilter.includes(asset.status) : true;
      
      // Type filter
      const matchesType = typeFilter.length > 0 ? typeFilter.includes(asset.assetType) : true;
      
      // Wing filter
      const matchesWing = wingFilter.length > 0 ? wingFilter.includes(asset.wing) : true;
      
      // Floor filter
      const matchesFloor = floorFilter.length > 0 ? floorFilter.includes(asset.floor) : true;
      
      // Filter Type filter
      const matchesFilterType = filterTypeFilter.length > 0 ? filterTypeFilter.includes(asset.filterType) : true;
      
      // Need Flushing filter
      const assetNeedFlushing = (typeof asset.needFlushing === 'boolean' ? asset.needFlushing : asset.needFlushing?.toString().toLowerCase() === 'yes' || asset.needFlushing?.toString().toLowerCase() === 'true');
      const matchesNeedFlushing = needFlushingFilter.length > 0 ? needFlushingFilter.includes(assetNeedFlushing ? 'Yes' : 'No') : true;
      // Filter Needed filter
      const assetFilterNeeded = (typeof asset.filterNeeded === 'boolean' ? asset.filterNeeded : asset.filterNeeded?.toString().toLowerCase() === 'yes' || asset.filterNeeded?.toString().toLowerCase() === 'true');
      const matchesFilterNeeded = filterNeededFilter.length > 0 ? filterNeededFilter.includes(assetFilterNeeded ? 'Yes' : 'No') : true;
      // Filters On filter
      const assetFiltersOn = (typeof asset.filtersOn === 'boolean' ? asset.filtersOn : asset.filtersOn?.toString().toLowerCase() === 'yes' || asset.filtersOn?.toString().toLowerCase() === 'true');
      const matchesFiltersOn = filtersOnFilter.length > 0 ? filtersOnFilter.includes(assetFiltersOn ? 'Yes' : 'No') : true;
      // Filter Expiry date range filter
      let matchesFilterExpiry = true;
      if (filterExpiryRange[0] && filterExpiryRange[1]) {
        const expiryDate = safeDate(asset.filterExpiryDate);
        if (expiryDate) {
          matchesFilterExpiry = expiryDate >= filterExpiryRange[0]! && expiryDate <= filterExpiryRange[1]!;
        } else {
          matchesFilterExpiry = false;
        }
      }
      // Augmented Care filter
      const assetAugmentedCare = (typeof asset.augmentedCare === 'boolean' ? asset.augmentedCare : asset.augmentedCare?.toString().toLowerCase() === 'yes' || asset.augmentedCare?.toString().toLowerCase() === 'true');
      const matchesAugmentedCare = augmentedCareFilter.length > 0 ? augmentedCareFilter.includes(assetAugmentedCare ? 'Yes' : 'No') : true;
      
      // Filter Expiry Status filter
      let matchesFilterExpiryStatus = true;
      if (filterExpiryStatus) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const expiryDate = safeDate(asset.filterExpiryDate);
        
        if (expiryDate) {
          switch (filterExpiryStatus) {
            case 'expired':
              matchesFilterExpiryStatus = expiryDate < today;
              break;
            case 'this-week':
              const thisWeekStart = new Date(today);
              const day = today.getDay();
              const diff = today.getDate() - day + (day === 0 ? -6 : 1);
              thisWeekStart.setDate(diff);
              const thisWeekEnd = new Date(thisWeekStart);
              thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
              matchesFilterExpiryStatus = expiryDate >= thisWeekStart && expiryDate <= thisWeekEnd;
              break;
            case 'next-week':
              const nextWeekStart = new Date(today);
              const nextDay = today.getDay();
              const nextDiff = today.getDate() - nextDay + (nextDay === 0 ? -6 : 1) + 7;
              nextWeekStart.setDate(nextDiff);
              const nextWeekEnd = new Date(nextWeekStart);
              nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
              matchesFilterExpiryStatus = expiryDate >= nextWeekStart && expiryDate <= nextWeekEnd;
              break;
            case 'this-month':
              const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
              const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
              matchesFilterExpiryStatus = expiryDate >= thisMonthStart && expiryDate <= thisMonthEnd;
              break;
            case 'next-month':
              const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
              const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
              matchesFilterExpiryStatus = expiryDate >= nextMonthStart && expiryDate <= nextMonthEnd;
              break;
          }
        } else {
          matchesFilterExpiryStatus = false;
        }
      }
      
      return matchesSearch && matchesStatus && matchesType && matchesWing && matchesFloor && matchesFilterType && matchesNeedFlushing && matchesFilterNeeded && matchesFiltersOn && matchesAugmentedCare && matchesFilterExpiry && matchesFilterExpiryStatus;
    }));
    setCurrentPage(1);
  }, [assets, searchTerm, statusFilter, typeFilter, wingFilter, floorFilter, filterTypeFilter, needFlushingFilter, filterNeededFilter, filtersOnFilter, augmentedCareFilter, filterExpiryRange, filterExpiryStatus]);

  // Track previous installed date to prevent infinite loops
  const prevInstalledDateRef = useRef<Date | null>(null);
  
  // Auto-calculate Filter Expiry Date when Filter Installed On changes (Add/Edit UI only)
  useEffect(() => {
    const installedDate = form.values.filterInstalledOn;
    if (installedDate && installedDate instanceof Date && !isNaN(installedDate.getTime())) {
      // Only update if the installed date has actually changed
      if (!prevInstalledDateRef.current || prevInstalledDateRef.current.getTime() !== installedDate.getTime()) {
        const expiryDate = calculateFilterExpiry(installedDate);
        form.setFieldValue('filterExpiryDate', expiryDate);
        prevInstalledDateRef.current = installedDate;
      }
    } else {
      prevInstalledDateRef.current = null;
    }
  }, [form.values.filterInstalledOn]);

  // Fetch audit logs when audit modal opens
  useEffect(() => {
    if (showAuditModal && selectedAssetAudit) {
      const asset = assets.find(a => a.assetBarcode === selectedAssetAudit);
      console.log('Found asset for audit:', {
        selectedAssetAudit,
        assetId: asset?.id,
        assetBarcode: asset?.assetBarcode
      });
      if (asset?.id) {
        const loadAuditLogs = async () => {
          try {
            await fetchAuditLogs(asset.id!);
          } catch (error) {
            console.error('Error loading audit logs:', error);
          }
        };
        loadAuditLogs();
      } else {
        console.log('No asset found or asset has no ID');
      }
    }
  }, [showAuditModal, selectedAssetAudit, assets]);

  // Fetch global audit logs when audit drawer opens
  useEffect(() => {
    if (showAuditDrawer) {
      fetchGlobalAuditLogs();
    }
  }, [showAuditDrawer]);

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
        message: 'Asset data loaded successfully!',
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

  // Removed broken filterAssets function - filtering now handled in useEffect

  const handleAddAsset = async (values: any) => {
    try {
      // Sanitize all fields
      const sanitizedValues = { ...values };
      Object.keys(sanitizedValues).forEach(key => {
        sanitizedValues[key] = sanitizeField(sanitizedValues[key], key);
      });

      // Helper function to safely convert date to ISO string
      const formatDateForAPI = (dateValue: any) => {
        if (!dateValue) return '';
        
        // If it's already a Date object, use it directly
        if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
          return dateValue.toISOString().split('T')[0];
        }
        
        // If it's a string in DD/MM/YYYY format, parse it
        if (typeof dateValue === 'string' && dateValue.includes('/')) {
          const [day, month, year] = dateValue.split('/');
          const parsedDate = new Date(`${year}-${month}-${day}`);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString().split('T')[0];
          }
        }
        
        // Try to parse as a regular date string
        const parsedDate = new Date(dateValue);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString().split('T')[0];
        }
        
        return '';
      };

      // Ensure filter expiry date is calculated if filter installed date is provided
      let finalFilterExpiryDate = sanitizedValues.filterExpiryDate;
      
      // Handle both Date objects and date strings
      if (sanitizedValues.filterInstalledOn) {
        let installedDate = null;
        
        if (sanitizedValues.filterInstalledOn instanceof Date && !isNaN(sanitizedValues.filterInstalledOn.getTime())) {
          installedDate = sanitizedValues.filterInstalledOn;
        } else if (typeof sanitizedValues.filterInstalledOn === 'string' && sanitizedValues.filterInstalledOn.trim() !== '') {
          // Parse string date (could be YYYY-MM-DD or other formats)
          installedDate = new Date(sanitizedValues.filterInstalledOn);
          if (isNaN(installedDate.getTime())) {
            installedDate = null;
          }
        }
        
        if (installedDate) {
          // Always recalculate expiry date to ensure it's correct
          finalFilterExpiryDate = calculateFilterExpiry(installedDate);
        }
      }

      const assetData = {
        ...sanitizedValues,
        filterExpiryDate: formatDateForAPI(finalFilterExpiryDate),
        filterInstalledOn: formatDateForAPI(sanitizedValues.filterInstalledOn),
      };



      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...assetData,
          createdBy: user?.email || user?.username || 'Unknown User',
          modifiedBy: user?.email || user?.username || 'Unknown User',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create asset');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create asset');
      }

      // Upload files if any are selected
      let uploadedAttachments: any[] = [];
      if (assetFiles.length > 0 && result.data.id) {
        setIsUploadingFile(true);
        try {
          for (const file of assetFiles) {
            const uploadResult = await handleFileUpload(file, result.data.id);
            if (uploadResult) {
              uploadedAttachments.push(uploadResult);
            }
          }
          
          // Update the asset with the uploaded attachments
          if (uploadedAttachments.length > 0) {
            const updateResponse = await fetch(`/api/assets/${result.data.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...result.data,
                attachments: uploadedAttachments,
                modifiedBy: user?.email || user?.username || 'Unknown User',
              }),
            });
            
            if (updateResponse.ok) {
              const updateResult = await updateResponse.json();
              if (updateResult.success) {
                result.data = updateResult.data;
              }
            }
          }
        } catch (uploadError) {
          console.error('Error uploading files:', uploadError);
          notifications.show({
            title: 'Warning',
            message: 'Asset created but some files failed to upload',
            color: 'yellow',
            icon: <IconX size={16} />,
          });
        } finally {
          setIsUploadingFile(false);
        }
      }

      // Update local state with the new asset from DynamoDB
      setAssets(prev => [...prev, result.data]);
      
      // Create audit log entry for asset creation
      console.log('About to create audit log entry for asset creation:', {
        assetId: result.data.id,
        assetBarcode: result.data.assetBarcode,
        action: 'CREATE'
      });
      await createAuditLogEntry(result.data, 'CREATE');
      
      form.reset();
      setAssetFiles([]); // Clear uploaded files
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

      // Sanitize all fields
      const sanitizedValues = { ...values };
      Object.keys(sanitizedValues).forEach(key => {
        sanitizedValues[key] = sanitizeField(sanitizedValues[key], key);
      });

      // Helper function to safely convert date to ISO string
      const formatDateForAPI = (dateValue: any) => {
        if (!dateValue) return '';
        if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
          return dateValue.toISOString().split('T')[0];
        }
        if (typeof dateValue === 'string' && dateValue.includes('/')) {
          const [day, month, year] = dateValue.split('/');
          const parsedDate = new Date(`${year}-${month}-${day}`);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString().split('T')[0];
          }
        }
        const parsedDate = new Date(dateValue);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString().split('T')[0];
        }
        return '';
      };

      // Always recalculate expiry date from installed date
      let installedDateObj = sanitizedValues.filterInstalledOn;
      if (typeof installedDateObj === 'string' && installedDateObj.includes('/')) {
        const [day, month, year] = installedDateObj.split('/');
        installedDateObj = new Date(`${year}-${month}-${day}`);
      } else if (typeof installedDateObj === 'string') {
        installedDateObj = new Date(installedDateObj);
      }
      let expiryDate = null;
      if (installedDateObj instanceof Date && !isNaN(installedDateObj.getTime())) {
        expiryDate = calculateFilterExpiry(installedDateObj);
      }

      // Upload new files if any are selected
      let newAttachments: any[] = [];
      if (assetFiles.length > 0) {
        setIsUploadingFile(true);
        try {
          for (const file of assetFiles) {
            const uploadResult = await handleFileUpload(file, selectedAsset.id);
            if (uploadResult) {
              newAttachments.push(uploadResult);
            }
          }
        } catch (uploadError) {
          console.error('Error uploading files:', uploadError);
          notifications.show({
            title: 'Warning',
            message: 'Some files failed to upload',
            color: 'yellow',
            icon: <IconX size={16} />,
          });
        } finally {
          setIsUploadingFile(false);
        }
      }

      const updateData = {
        ...sanitizedValues,
        filterExpiryDate: expiryDate ? formatDateForAPI(expiryDate) : '',
        filterInstalledOn: formatDateForAPI(sanitizedValues.filterInstalledOn),
        attachments: [...(selectedAsset?.attachments || []), ...newAttachments], // Merge existing and new attachments
        modifiedBy: user?.email || user?.username || 'Unknown User',
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
        console.log('About to create audit log entry for asset update:', {
          assetId: result.data.id,
          assetBarcode: result.data.assetBarcode,
          action: 'UPDATE'
        });
        await createAuditLogEntry(result.data as Asset, "UPDATE", selectedAsset);
      }

      // Update local state with the updated asset from DynamoDB
      setAssets(prev => prev.map(asset => 
        asset.id === selectedAsset?.id ? result.data : asset
      ));
      closeEditModal();
      setSelectedAsset(null);
      setAssetFiles([]); // Clear uploaded files
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
  // Handle removing filter from asset
  const handleRemoveFilter = (asset: Asset) => {
    modals.openConfirmModal({
      title: 'Remove Filter',
      children: (
        <Text size="sm">
          Are you sure you want to remove the filter from asset <strong>{asset.primaryIdentifier}</strong>? 
          This will reset all filter-related information including:
          <br />• Filter Needed
          <br />• Filters On
          <br />• Filter Installation Date
          <br />• Filter Expiry Date
          <br />• Filter Type
          <br /><br />
          This action will be logged in the audit trail.
        </Text>
      ),
      labels: { confirm: 'Remove Filter', cancel: 'Cancel' },
      confirmProps: { color: 'orange' },
      onConfirm: async () => {
        try {
          if (!asset.id) {
            throw new Error('Asset ID is required for filter removal');
          }

          // Store old values for audit log
          const oldAsset = { ...asset };

          // Create updated asset with filter fields reset
          const updatedAssetData = {
            ...asset,
            filterNeeded: false,
            filtersOn: false,
            filterInstalledOn: '',
            filterExpiryDate: '',
            filterType: '',
            modifiedBy: user?.email || user?.username || 'Unknown User',
          };

          const response = await fetch(`/api/assets/${asset.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedAssetData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to remove filter');
          }

          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to remove filter');
          }

          // Create audit log entry for filter removal
          await createAuditLogEntry(result.data, 'UPDATE', oldAsset);
        
          // Update local state
          setAssets(prev => prev.map(a => 
            a.id === asset.id ? result.data : a
          ));
          
          // Update selectedAsset if it's the same asset being edited
          if (selectedAsset && selectedAsset.id === asset.id) {
            setSelectedAsset(result.data);
            
            // Update form values to reflect the changes
            form.setValues({
              ...form.values,
              filterNeeded: false,
              filtersOn: false,
              filterInstalledOn: null,
              filterExpiryDate: null,
              filterType: '',
            });
          }
          
          notifications.show({
            title: 'Success',
            message: 'Filter removed successfully!',
            color: 'green',
            icon: <IconCheck size={16} />,
          });
        } catch (error) {
          console.error("Error removing filter:", error);
          notifications.show({
            title: 'Error',
            message: `Failed to remove filter: ${error instanceof Error ? error.message : "Unknown error"}`,
            color: 'red',
            icon: <IconX size={16} />,
          });
        }
      },
    });
  };

  const handleDeleteAsset = (asset: Asset) => {
    modals.openConfirmModal({
      title: 'Delete Asset',
      children: (
        <Text size="sm">
          Are you sure you want to delete asset <strong>{asset.primaryIdentifier}</strong>? 
          This action cannot be undone and will also delete all associated files.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          if (!asset.id) {
            throw new Error('Asset ID is required for deletion');
          }

          // Delete associated S3 files first
          if (asset.attachments && asset.attachments.length > 0) {
            for (const attachment of asset.attachments) {
              try {
                await handleFileDelete(attachment.s3Url, attachment.fileName);
              } catch (fileError) {
                console.warn(`Failed to delete file ${attachment.fileName}:`, fileError);
                // Continue with asset deletion even if file deletion fails
              }
            }
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
            message: 'Asset and associated files deleted successfully!',
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

  const exportData = (format: 'csv' | 'excel' = 'csv') => {
    if (filteredAssets.length === 0) {
      notifications.show({
        title: 'No Data',
        message: 'No assets to export',
        color: 'orange',
        icon: <IconExclamationMark size={16} />,
      });
      return;
    }

    try {
      // Define all possible fields in the order we want them exported
      const allFields = [
        'assetBarcode',
        'primaryIdentifier', 
        'secondaryIdentifier',
        'assetType',
        'status',
        'wing',
        'wingInShort',
        'room',
        'floor',
        'floorInWords',
        'roomNo',
        'roomName',
        'filterNeeded',
        'filtersOn',
        'filterInstalledOn',
        'filterExpiryDate',
        'filterType',
        'needFlushing',
        'notes',
        'augmentedCare',
        'created',
        'createdBy',
        'modified',
        'modifiedBy'
      ];

      // Create headers with user-friendly names
      const headers = allFields.map(field => getFieldDisplayName(field));
      
      // Format data for export
      const exportData = filteredAssets.map(asset => {
        return allFields.map(field => {
          let value = asset[field as keyof Asset];
          
          // Special handling for filterExpiryDate: if missing but filterInstalledOn is present, auto-calculate
          if (field === 'filterExpiryDate') {
            if ((!value || value === 'N/A') && asset.filterInstalledOn) {
              // Try to parse the installed date
              const installed = new Date(asset.filterInstalledOn);
              if (!isNaN(installed.getTime())) {
                // Calculate expiry as 3 months after installation
                const expiry = new Date(installed);
                expiry.setMonth(expiry.getMonth() + 3);
                // Preserve the original day if possible
                const originalDay = installed.getDate();
                if (expiry.getDate() !== originalDay) {
                  expiry.setDate(1);
                }
                value = expiry.toISOString().split('T')[0];
              }
            }
            
            // Format as DD/MM/YYYY if valid date
            if (value && value !== 'N/A' && typeof value === 'string') {
              const d = new Date(value);
              if (!isNaN(d.getTime())) {
                value = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
              } else {
                value = 'N/A';
              }
            } else {
              value = 'N/A';
            }
          }
          
          // Special handling for filterInstalledOn: format as DD/MM/YYYY if valid
          if (field === 'filterInstalledOn') {
            if (value && value !== 'N/A' && typeof value === 'string') {
              const d = new Date(value);
              if (!isNaN(d.getTime())) {
                value = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
              } else {
                value = 'N/A';
              }
            } else {
              value = 'N/A';
            }
          }
          const formattedValue = formatValue(value);
          // Special handling for asset barcode - always uppercase and trimmed
          if (field === 'assetBarcode') {
            return formattedValue.toString().trim().toUpperCase();
          }
          return formattedValue;
        });
      });

      const dateTimeStr = getDateTimeString();
      
      if (format === 'excel') {
        // Create Excel workbook
        const workbook = XLSX.utils.book_new();
        
        // Create worksheet data with headers
        const worksheetData = [headers, ...exportData];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        
        // Set column widths for better readability
        const columnWidths = headers.map(header => ({ 
          width: Math.max(header.length, 15) 
        }));
        worksheet['!cols'] = columnWidths;
        
        // Add the worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');
        
        // Generate Excel file
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const blob = new Blob([buffer], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `assets-export_${dateTimeStr}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        
      } else {
        // Create CSV
        const csvContent = [
          headers.join(','),
          ...exportData.map(row => 
            row.map(cell => {
              // Escape cells that contain commas, quotes, or newlines
              const cellStr = String(cell);
              if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
              }
              return cellStr;
            }).join(',')
          )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `assets-export_${dateTimeStr}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }

      notifications.show({
        title: 'Export Successful',
        message: `${filteredAssets.length} assets exported as ${format.toUpperCase()}`,
        color: 'green',
        icon: <IconDownload size={16} />,
      });
      
    } catch (error) {
      console.error('Export error:', error);
      notifications.show({
        title: 'Export Failed',
        message: 'Failed to export data',
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
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
    <Card 
      shadow="sm" 
      padding="lg" 
      radius="md" 
      withBorder 
      className="hover:shadow-lg transition-shadow"
      style={{ 
        minHeight: '120px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      <Group justify="apart" align="flex-start" wrap="nowrap">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text c="dimmed" size="sm" fw={500} mb="xs">
            {title}
          </Text>
          <Text fw={700} size="xl" mb="xs" className="stat-value">
            {loading ? <Loader size="sm" /> : value.toLocaleString()}
          </Text>
          {description && (
            <Text c="dimmed" size="xs" mb="xs" style={{ lineHeight: 1.2 }}>
              {description}
            </Text>
          )}
          {trend && (
            <Group gap={4} wrap="nowrap">
              <IconTrendingUp size={12} color={trend > 0 ? 'green' : 'red'} />
              <Text size="xs" c={trend > 0 ? 'green' : 'red'} style={{ whiteSpace: 'nowrap' }}>
                {trend > 0 ? '+' : ''}{trend}%
              </Text>
            </Group>
          )}
        </div>
        <ThemeIcon 
          color={color} 
          size={38} 
          radius="md"
          style={{ flexShrink: 0 }}
          className="stat-icon"
        >
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
      <Table.Tr 
        key={asset.assetBarcode}
        style={{
          backgroundColor: (() => {
            const needsFlushing = typeof asset.needFlushing === 'boolean' ? 
              asset.needFlushing : 
              asset.needFlushing?.toString().toLowerCase() === 'yes' || asset.needFlushing?.toString().toLowerCase() === 'true';
            return needsFlushing ? 'rgba(255, 0, 0, 0.05)' : undefined;
          })(),
          borderLeft: (() => {
            const needsFlushing = typeof asset.needFlushing === 'boolean' ? 
              asset.needFlushing : 
              asset.needFlushing?.toString().toLowerCase() === 'yes' || asset.needFlushing?.toString().toLowerCase() === 'true';
            return needsFlushing ? '3px solid red' : undefined;
          })()
        }}
      >
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
            <div>
              <Text fz="sm" fw={500}>
              {asset.assetBarcode}
              </Text>
              <Text fz="xs" c="dimmed">
              {asset.room}
              </Text>
            </div>
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
          <Group gap="xs">
            <IconCalendar size={14} />
            <Text size="sm">
              {(() => { 
                const d = safeDate(asset.filterInstalledOn); 
                return d ? d.toLocaleDateString('en-GB') : 'Not installed'; 
              })()}
            </Text>
          </Group>
        </Table.Td>
        <Table.Td>
          <Stack gap="xs">
            <Group gap="xs" align="center">
              {(() => {
                const expiryStatus = getFilterExpiryStatus(asset.filterExpiryDate, asset.filterInstalledOn);
                return (
                  <>
                    <Badge 
                      color={expiryStatus.color} 
                      variant="light" 
                      size="xs"
                    >
                      {expiryStatus.text}
                    </Badge>
                    <Text size="sm" c="dimmed">
                      {(() => { 
                        const d = safeDate(asset.filterExpiryDate); 
                        return d ? d.toLocaleDateString('en-GB') : 'N/A'; 
                      })()}
                    </Text>
                  </>
                );
              })()}
            </Group>
            {/* Need Flushing Alert */}
            {(() => {
              const needsFlushing = typeof asset.needFlushing === 'boolean' ? 
                asset.needFlushing : 
                asset.needFlushing?.toString().toLowerCase() === 'yes' || asset.needFlushing?.toString().toLowerCase() === 'true';
              
              return needsFlushing ? (
                <Badge 
                  color="red" 
                  variant="filled" 
                  size="xs"
                  leftSection={<IconAlertTriangle size={10} />}
                >
                  NEEDS FLUSHING
                </Badge>
              ) : null;
            })()}
          </Stack>
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
                            console.log('Frontend: Opening audit modal for asset:', asset.assetBarcode);
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
                            try {
                              setSelectedAsset(asset);
                              form.setValues({
                                assetBarcode: asset.assetBarcode || '',
                                primaryIdentifier: asset.primaryIdentifier || '',
                                secondaryIdentifier: asset.secondaryIdentifier || '',
                                assetType: asset.assetType || '',
                                status: asset.status || 'ACTIVE',
                                wing: asset.wing || '',
                                wingInShort: asset.wingInShort || '',
                                room: asset.room || '',
                                floor: asset.floor || '',
                                floorInWords: asset.floorInWords || '',
                                roomNo: asset.roomNo || '',
                                roomName: asset.roomName || '',
                                filterNeeded: typeof asset.filterNeeded === 'boolean' ? asset.filterNeeded : (asset.filterNeeded?.toString().toLowerCase() === 'true' || asset.filterNeeded?.toString().toLowerCase() === 'yes'),
                                filtersOn: typeof asset.filtersOn === 'boolean' ? asset.filtersOn : (asset.filtersOn?.toString().toLowerCase() === 'true' || asset.filtersOn?.toString().toLowerCase() === 'yes'),
                                filterExpiryDate: safeDate(asset.filterExpiryDate),
                                filterInstalledOn: safeDate(asset.filterInstalledOn),
                                needFlushing: typeof asset.needFlushing === 'boolean' ? asset.needFlushing : (asset.needFlushing?.toString().toLowerCase() === 'true' || asset.needFlushing?.toString().toLowerCase() === 'yes'),
                                filterType: asset.filterType || '',
                                notes: asset.notes || '',
                                augmentedCare: typeof asset.augmentedCare === 'boolean' ? asset.augmentedCare : (asset.augmentedCare?.toString().toLowerCase() === 'true' || asset.augmentedCare?.toString().toLowerCase() === 'yes'),
                              });
                              setAssetFiles([]);
                              openEditModal();
                            } catch (error) {
                              console.error('Error setting form values:', error);
                              notifications.show({
                                title: 'Error',
                                message: 'Failed to load asset data for editing',
                                color: 'red',
                                icon: <IconX size={16} />,
                              });
                            }
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
                  <Grid.Col span={{ base: 12, sm: 6 }}>
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
                  
                  <Grid.Col span={{ base: 12, sm: 6 }}>
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
                        <Text size="sm" fw={500}>{asset.roomNo !== null && asset.roomNo !== undefined && asset.roomNo !== '' ? asset.roomNo : 'N/A'}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Floor:</Text>
                        <Text size="sm" fw={500}>{asset.floor !== null && asset.floor !== undefined && asset.floor !== '' ? asset.floor : 'N/A'}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Floor (Words):</Text>
                        <Text size="sm" fw={500}>{asset.floorInWords || 'N/A'}</Text>
                      </Group>
                    </Stack>
                  </Grid.Col>
                  
                  <Grid.Col span={{ base: 12, sm: 6 }}>
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
                      <Group justify="space-between" align="flex-start">
                        <Text size="sm">Filter Expiry:</Text>
                        <div style={{ textAlign: 'right' }}>
                          <Group gap="xs" justify="flex-end">
                            {safeDate(asset.filterExpiryDate) && (
                              <Badge 
                                color={getFilterExpiryStatus(asset.filterExpiryDate, asset.filterInstalledOn).color} 
                                variant="light" 
                                size="xs"
                                mt={4}
                              >
                                {getFilterExpiryStatus(asset.filterExpiryDate, asset.filterInstalledOn).text}
                              </Badge>
                            )}
                            <Text size="sm" fw={500}>
                              {(() => { const d = safeDate(asset.filterExpiryDate); return d ? d.toLocaleDateString('en-GB') : 'N/A'; })()}
                            </Text>
                          </Group>
                        </div>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Filter Installed:</Text>
                        <Text size="sm" fw={500}>
                          {(() => { const d = safeDate(asset.filterInstalledOn); return d ? d.toLocaleDateString('en-GB') : 'N/A'; })()}
                        </Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Filter Type:</Text>
                        <Text size="sm" fw={500}>
                          {asset.filterType || 'N/A'}
                        </Text>
                      </Group>
                    </Stack>
                  </Grid.Col>
                  
                  <Grid.Col span={{ base: 12, sm: 6 }}>
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
                        <Text size="sm">Need Flushing:</Text>
                        <Badge 
                          color={(() => {
                            if (typeof asset.needFlushing === 'boolean') {
                              return asset.needFlushing ? 'orange' : 'gray';
                            }
                            const needFlushingStr = asset.needFlushing?.toString().toLowerCase();
                            return needFlushingStr === 'yes' || needFlushingStr === 'true' ? 'orange' : 'gray';
                          })()} 
                          variant="light" 
                          size="sm"
                        >
                          {(() => {
                            if (typeof asset.needFlushing === 'boolean') {
                              return asset.needFlushing ? 'Yes' : 'No';
                            }
                            const needFlushingStr = asset.needFlushing?.toString().toLowerCase();
                            return needFlushingStr === 'yes' || needFlushingStr === 'true' ? 'Yes' : 'No';
                          })()}
                        </Badge>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Created:</Text>
                        <Text size="sm" fw={500}>
                          {asset.created ? formatTimestamp(asset.created) : 'N/A'}
                        </Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Created By:</Text>
                        <Text size="sm" fw={500}>{asset.createdBy || 'N/A'}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">Modified:</Text>
                        <Text size="sm" fw={500}>
                          {asset.modified ? formatTimestamp(asset.modified) : 'N/A'}
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
  const wingChartData = Object.entries(assets.reduce((acc, asset) => {
    const wingShort = asset.wingInShort || asset.wing || 'Unknown';
    acc[wingShort] = (acc[wingShort] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number })).map(([wingShort, count]) => ({
    wing: wingShort,
    count
  }));

  const typeChartData = Object.entries(stats.assetTypeBreakdown || {}).map(([type, count]) => ({
    type,
    count
  }));

  const renderDashboard = () => (
    <div className="dashboard-outer-container">
      <Stack gap="lg" className="dashboard-container">
        {/* Stats Row */}
        <div className="dashboard-stats-row">
          <StatCard
            className="stat-card"
            title="Total Assets"
            value={stats.totalAssets}
            icon={<IconDroplet size={20} />}
            color="blue"
            description="All registered assets"
            trend={2.5}
          />
          <StatCard
            className="stat-card"
            title="Active Assets"
            value={stats.activeAssets}
            icon={<IconCheck size={20} />}
            color="green"
            description="Currently operational"
            trend={5.2}
          />
          <StatCard
            className="stat-card"
            title="Flushing Needed"
            value={assets.filter(a => {
              if (typeof a.needFlushing === 'boolean') {
                return a.needFlushing;
              }
              const needFlushingStr = a.needFlushing?.toString().toLowerCase();
              return needFlushingStr === 'true' || needFlushingStr === 'yes';
            }).length}
            icon={<IconDroplet size={20} />}
            color="orange"
            description="Requires flushing"
            trend={0.5}
          />
          <StatCard
            className="stat-card"
            title="Filters Needed"
            value={stats.filtersNeeded}
            icon={<IconFilter size={20} />}
            color="red"
            description="Filter replacement due"
            trend={0.8}
          />
        </div>

        {/* Filter Expiration Statistics */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={4} mb="md">Filter Expiration Overview</Title>
          <Grid gutter="md">
            {(() => {
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              
              // Helper function to parse date and check if it's valid
              const parseDate = (dateStr: string) => {
                if (!dateStr) return null;
                const date = new Date(dateStr);
                return isNaN(date.getTime()) ? null : date;
              };
              
              // Helper function to get week start (Monday)
              const getWeekStart = (date: Date) => {
                const day = date.getDay();
                const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
                return new Date(date.setDate(diff));
              };
              
              // Helper function to get month start
              const getMonthStart = (date: Date) => {
                return new Date(date.getFullYear(), date.getMonth(), 1);
              };
              
              // Helper function to get month end
              const getMonthEnd = (date: Date) => {
                return new Date(date.getFullYear(), date.getMonth() + 1, 0);
              };
              
              // Calculate date ranges
              const thisWeekStart = getWeekStart(new Date(today));
              const thisWeekEnd = new Date(thisWeekStart);
              thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
              
              const nextWeekStart = new Date(thisWeekStart);
              nextWeekStart.setDate(thisWeekStart.getDate() + 7);
              const nextWeekEnd = new Date(nextWeekStart);
              nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
              
              const thisMonthStart = getMonthStart(today);
              const thisMonthEnd = getMonthEnd(today);
              
              const nextMonthStart = new Date(thisMonthStart);
              nextMonthStart.setMonth(thisMonthStart.getMonth() + 1);
              const nextMonthEnd = getMonthEnd(nextMonthStart);
              
              // Filter assets with valid expiry dates
              const assetsWithExpiry = assets.filter(asset => {
                const expiryDate = parseDate(asset.filterExpiryDate);
                return expiryDate !== null;
              });
              
              // Calculate statistics
              const expiredFilters = assetsWithExpiry.filter(asset => {
                const expiryDate = parseDate(asset.filterExpiryDate)!;
                return expiryDate < today;
              }).length;
              
              const expiringThisWeek = assetsWithExpiry.filter(asset => {
                const expiryDate = parseDate(asset.filterExpiryDate)!;
                return expiryDate >= thisWeekStart && expiryDate <= thisWeekEnd;
              }).length;
              
              const expiringNextWeek = assetsWithExpiry.filter(asset => {
                const expiryDate = parseDate(asset.filterExpiryDate)!;
                return expiryDate >= nextWeekStart && expiryDate <= nextWeekEnd;
              }).length;
              
              const expiringThisMonth = assetsWithExpiry.filter(asset => {
                const expiryDate = parseDate(asset.filterExpiryDate)!;
                return expiryDate >= thisMonthStart && expiryDate <= thisMonthEnd;
              }).length;
              
              const expiringNextMonth = assetsWithExpiry.filter(asset => {
                const expiryDate = parseDate(asset.filterExpiryDate)!;
                return expiryDate >= nextMonthStart && expiryDate <= nextMonthEnd;
              }).length;
              
              return (
                <>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <Card shadow="sm" padding="md" radius="md" withBorder>
                      <Group gap="sm">
                        <ThemeIcon color="red" size={32} radius="md">
                          <IconAlertTriangle size={16} />
                        </ThemeIcon>
                        <div>
                          <Text size="xs" c="dimmed">Expired Filters</Text>
                          <Text fw={700} size="lg">{expiredFilters}</Text>
                        </div>
                      </Group>
                    </Card>
                  </Grid.Col>
                  
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <Card shadow="sm" padding="md" radius="md" withBorder>
                      <Group gap="sm">
                        <ThemeIcon color="orange" size={32} radius="md">
                          <IconClock size={16} />
                        </ThemeIcon>
                        <div>
                          <Text size="xs" c="dimmed">Expiring This Week</Text>
                          <Text fw={700} size="lg">{expiringThisWeek}</Text>
                        </div>
                      </Group>
                    </Card>
                  </Grid.Col>
                  
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <Card shadow="sm" padding="md" radius="md" withBorder>
                      <Group gap="sm">
                        <ThemeIcon color="yellow" size={32} radius="md">
                          <IconCalendar size={16} />
                        </ThemeIcon>
                        <div>
                          <Text size="xs" c="dimmed">Expiring Next Week</Text>
                          <Text fw={700} size="lg">{expiringNextWeek}</Text>
                        </div>
                      </Group>
                    </Card>
                  </Grid.Col>
                  
                  <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
                    <Card shadow="sm" padding="md" radius="md" withBorder>
                      <Group gap="sm">
                        <ThemeIcon color="blue" size={32} radius="md">
                          <IconCalendar size={16} />
                        </ThemeIcon>
                        <div>
                          <Text size="xs" c="dimmed">Expiring This Month</Text>
                          <Text fw={700} size="lg">{expiringThisMonth}</Text>
                        </div>
                      </Group>
                    </Card>
                  </Grid.Col>
                  
                  <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
                    <Card shadow="sm" padding="md" radius="md" withBorder>
                      <Group gap="sm">
                        <ThemeIcon color="green" size={32} radius="md">
                          <IconCalendar size={16} />
                        </ThemeIcon>
                        <div>
                          <Text size="xs" c="dimmed">Expiring Next Month</Text>
                          <Text fw={700} size="lg">{expiringNextMonth}</Text>
                        </div>
                      </Group>
                    </Card>
                  </Grid.Col>
                </>
              );
            })()}
          </Grid>
        </Card>

        {/* Charts */}
        <div className="dashboard-charts-row">
          <Card shadow="sm" padding="lg" radius="md" withBorder className="chart-card">
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
          <Card shadow="sm" padding="lg" radius="md" withBorder className="chart-card">
            <Title order={4} mb="md">Wing Distribution (Total: {wingChartData.reduce((sum, item) => sum + item.count, 0)})</Title>
            {wingChartData.length > 0 && (
              <BarChart
                h={300}
                data={wingChartData}
                dataKey="wing"
                series={[{ name: 'count', color: 'blue.6' }]}
              />
            )}
          </Card>
          <Card shadow="sm" padding="lg" radius="md" withBorder className="chart-card">
            <Title order={4} mb="md">Filters to be Removed (Total: {(() => {
              const filtersToRemove = assets.filter(a => {
                const filterNeeded = typeof a.filterNeeded === 'boolean' ? a.filterNeeded : (a.filterNeeded?.toString().toLowerCase() === 'true' || a.filterNeeded?.toString().toLowerCase() === 'yes');
                const filtersOn = typeof a.filtersOn === 'boolean' ? a.filtersOn : (a.filtersOn?.toString().toLowerCase() === 'true' || a.filtersOn?.toString().toLowerCase() === 'yes');
                return !filterNeeded && filtersOn;
              });
              return filtersToRemove.length;
            })()})</Title>
            {(() => {
              const filtersToRemove = assets.filter(a => {
                const filterNeeded = typeof a.filterNeeded === 'boolean' ? a.filterNeeded : (a.filterNeeded?.toString().toLowerCase() === 'true' || a.filterNeeded?.toString().toLowerCase() === 'yes');
                const filtersOn = typeof a.filtersOn === 'boolean' ? a.filtersOn : (a.filtersOn?.toString().toLowerCase() === 'true' || a.filtersOn?.toString().toLowerCase() === 'yes');
                return !filterNeeded && filtersOn;
              });
              
              // Group by wingInShort
              const filtersToRemoveByWing = filtersToRemove.reduce((acc, asset) => {
                const wingShort = asset.wingInShort || asset.wing || 'Unknown';
                acc[wingShort] = (acc[wingShort] || 0) + 1;
                return acc;
              }, {} as { [key: string]: number });
              
              const filtersToRemoveData = Object.entries(filtersToRemoveByWing).map(([wingShort, count]) => ({
                wing: wingShort,
                count
              }));
              
              return filtersToRemoveData.length > 0 ? (
                <BarChart
                  h={300}
                  data={filtersToRemoveData}
                  dataKey="wing"
                  series={[{ name: 'count', color: 'red.6' }]}
                />
              ) : (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text c="dimmed">No filters to remove</Text>
                </div>
              );
            })()}
          </Card>
        </div>
      </Stack>
    </div>
  );

  const renderAssets = () => (
    <Stack gap="lg" className="asset-management-container">
      {/* Filters and Actions */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
                    <Group justify="space-between" wrap="wrap" gap="md" align="center" className="asset-action-bar">
            <Title order={3} style={{ marginBottom: 0 }}>Asset Management</Title>
            
            {/* Responsive button layout */}
            <div className="action-buttons-container">
              {/* Desktop: Single row layout */}
              <div className="desktop-buttons">
                <Group gap="xs" wrap="wrap" style={{ minHeight: '44px' }} className="action-buttons-group">
                  <Button
                    leftSection={<IconRefresh size={16} />}
                    variant="light"
                    onClick={fetchData}
                    loading={loading}
                    size="md"
                    style={{ minHeight: '44px', minWidth: '44px', flexShrink: 0 }}
                    className="action-button"
                  >
                    Refresh
                  </Button>
                  <Menu shadow="md" width={200}>
                    <Menu.Target>
                      <Button
                        leftSection={<IconDownload size={16} />}
                        variant="outline"
                        rightSection={<IconChevronDown size={16} />}
                        size="md"
                        style={{ minHeight: '44px', minWidth: '44px', flexShrink: 0 }}
                        className="action-button"
                      >
                        Export
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconFileText size={16} />}
                        onClick={() => exportData('csv')}
                      >
                        Export as CSV
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconFileSpreadsheet size={16} />}
                        onClick={() => exportData('excel')}
                      >
                        Export as Excel
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                  <Button
                    leftSection={filtersCollapsed ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
                    variant="subtle"
                    color="blue"
                    size="md"
                    style={{ minHeight: '44px', minWidth: '44px', flexShrink: 0 }}
                    onClick={() => setFiltersCollapsed((prev: boolean) => !prev)}
                  >
                    {filtersCollapsed ? 'Show Filters' : 'Hide Filters'}
                  </Button>
                  <Button
                    leftSection={<IconPlus size={16} />}
                    size="md"
                    style={{ minHeight: '44px', minWidth: '44px', flexShrink: 0 }}
                    className="action-button"
                    onClick={openModal}
                  >
                    Add Asset
                  </Button>
                </Group>
              </div>
              
              {/* Mobile: 2x2 grid layout */}
              <div className="mobile-buttons">
                <Grid gutter="xs" style={{ width: '100%' }}>
                  <Grid.Col span={6}>
                    <Button
                      leftSection={<IconRefresh size={16} />}
                      variant="light"
                      onClick={fetchData}
                      loading={loading}
                      size="md"
                      style={{ width: '100%', minHeight: '44px' }}
                      className="action-button"
                    >
                      Refresh
                    </Button>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Menu shadow="md" width={200}>
                      <Menu.Target>
                        <Button
                          leftSection={<IconDownload size={16} />}
                          variant="outline"
                          rightSection={<IconChevronDown size={16} />}
                          size="md"
                          style={{ width: '100%', minHeight: '44px' }}
                          className="action-button"
                        >
                          Export
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconFileText size={16} />}
                          onClick={() => exportData('csv')}
                        >
                          Export as CSV
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconFileSpreadsheet size={16} />}
                          onClick={() => exportData('excel')}
                        >
                          Export as Excel
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Button
                      leftSection={filtersCollapsed ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
                      variant="subtle"
                      color="blue"
                      size="md"
                      style={{ width: '100%', minHeight: '44px' }}
                      onClick={() => setFiltersCollapsed((prev: boolean) => !prev)}
                    >
                      {filtersCollapsed ? 'Show Filters' : 'Hide Filters'}
                    </Button>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Button
                      leftSection={<IconPlus size={16} />}
                      size="md"
                      style={{ width: '100%', minHeight: '44px' }}
                      className="action-button"
                      onClick={openModal}
                    >
                      Add Asset
                    </Button>
                  </Grid.Col>
                </Grid>
              </div>
            </div>
          </Group>
          {/* Search bar always visible */}
          <TextInput
            placeholder="Search assets..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="sm"
            styles={{ input: { fontSize: '16px' } }}
          />
          {/* Collapsible filter panel */}
          <Collapse in={!filtersCollapsed} transitionDuration={200}>
            {/* Mobile filter stack */}
            <Stack gap="sm" hiddenFrom="md" className="mobile-filter-stack">
              {/* Row 1: Status, Type */}
              <Group gap="xs" grow>
                <MultiSelect
                  placeholder="Status"
                  data={Array.from(new Set(assets.map(a => a.status))).filter(Boolean)}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  clearable
                  size="sm"
                  styles={{ input: { fontSize: '16px' } }}
                />
                <MultiSelect
                  placeholder="Type"
                  data={Array.from(new Set(assets.map(a => a.assetType))).filter(Boolean)}
                  value={typeFilter}
                  onChange={setTypeFilter}
                  clearable
                  size="sm"
                  styles={{ input: { fontSize: '16px' } }}
                />
              </Group>
              
              {/* Row 2: Floor, Wing */}
              <Group gap="xs" grow>
                <MultiSelect
                  placeholder="Floor"
                  data={Array.from(new Set(assets.map(a => a.floor))).filter(Boolean)}
                  value={floorFilter}
                  onChange={setFloorFilter}
                  clearable
                  size="sm"
                  styles={{ input: { fontSize: '16px' } }}
                />
                <MultiSelect
                  placeholder="Wing"
                  data={Array.from(new Set(assets.map(a => a.wing))).filter(Boolean)}
                  value={wingFilter}
                  onChange={setWingFilter}
                  clearable
                  size="sm"
                  styles={{ input: { fontSize: '16px' } }}
                />
              </Group>
              
              {/* Row 3: Filter Type */}
              <MultiSelect
                placeholder="Filter Type"
                data={Array.from(new Set(assets.map(a => a.filterType))).filter(Boolean)}
                value={filterTypeFilter}
                onChange={setFilterTypeFilter}
                clearable
                size="sm"
                styles={{ input: { fontSize: '16px' } }}
              />
              
              {/* Row 4: Boolean filters - 2 per row */}
              <Group gap="xs" grow>
                <MultiSelect
                  placeholder="Need Flushing"
                  data={['Yes', 'No']}
                  value={needFlushingFilter}
                  onChange={setNeedFlushingFilter}
                  clearable
                  size="sm"
                  styles={{ input: { fontSize: '16px' } }}
                />
                <MultiSelect
                  placeholder="Filter Needed"
                  data={['Yes', 'No']}
                  value={filterNeededFilter}
                  onChange={setFilterNeededFilter}
                  clearable
                  size="sm"
                  styles={{ input: { fontSize: '16px' } }}
                />
              </Group>
              
              {/* Row 5: More boolean filters */}
              <Group gap="xs" grow>
                <MultiSelect
                  placeholder="Filters On"
                  data={['Yes', 'No']}
                  value={filtersOnFilter}
                  onChange={setFiltersOnFilter}
                  clearable
                  size="sm"
                  styles={{ input: { fontSize: '16px' } }}
                />
                <MultiSelect
                  placeholder="Augmented Care"
                  data={['Yes', 'No']}
                  value={augmentedCareFilter}
                  onChange={setAugmentedCareFilter}
                  clearable
                  size="sm"
                  styles={{ input: { fontSize: '16px' } }}
                />
              </Group>
              
              {/* Row 6: Date Range - Full width */}
              <DatePickerInput
                type="range"
                placeholder="Filter Expiry Range"
                value={filterExpiryRange}
                onChange={(val) => {
                  const toDate = (v: string | Date | null) => {
                    if (!v) return null;
                    if (v instanceof Date) return v;
                    const d = new Date(v);
                    return isNaN(d.getTime()) ? null : d;
                  };
                  setFilterExpiryRange([
                    toDate(val[0]),
                    toDate(val[1])
                  ]);
                }}
                size="sm"
                styles={{ input: { fontSize: '16px' } }}
                clearable
              />
              
              {/* Row 7: Filter Expiry Status - Full width */}
              <Select
                placeholder="Filter Expiry Status"
                data={[
                  { value: 'expired', label: 'Filter Expired' },
                  { value: 'this-week', label: 'Expiring This Week' },
                  { value: 'next-week', label: 'Expiring Next Week' },
                  { value: 'this-month', label: 'Expiring This Month' },
                  { value: 'next-month', label: 'Expiring Next Month' }
                ]}
                value={filterExpiryStatus}
                onChange={(value) => setFilterExpiryStatus(value || '')}
                clearable
                size="sm"
                styles={{ input: { fontSize: '16px' } }}
              />
              
              {/* Clear Filters Button */}
              <Button variant="outline" color="gray" size="sm" onClick={clearAllFilters} fullWidth>
                Clear All Filters
              </Button>
            </Stack>
            {/* Desktop filter layout */}
            <Grid visibleFrom="md">
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <MultiSelect
                  placeholder="Filter by Status"
                  data={Array.from(new Set(assets.map(a => a.status))).filter(Boolean)}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <MultiSelect
                  placeholder="Filter by Type"
                  data={Array.from(new Set(assets.map(a => a.assetType))).filter(Boolean)}
                  value={typeFilter}
                  onChange={setTypeFilter}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <MultiSelect
                  placeholder="Filter by Floor"
                  data={Array.from(new Set(assets.map(a => a.floor))).filter(Boolean)}
                  value={floorFilter}
                  onChange={setFloorFilter}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <MultiSelect
                  placeholder="Filter by Filter Type"
                  data={Array.from(new Set(assets.map(a => a.filterType))).filter(Boolean)}
                  value={filterTypeFilter}
                  onChange={setFilterTypeFilter}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <MultiSelect
                  placeholder="Need Flushing?"
                  data={['Yes', 'No']}
                  value={needFlushingFilter}
                  onChange={setNeedFlushingFilter}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <MultiSelect
                  placeholder="Filter Needed?"
                  data={['Yes', 'No']}
                  value={filterNeededFilter}
                  onChange={setFilterNeededFilter}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <MultiSelect
                  placeholder="Filters On?"
                  data={['Yes', 'No']}
                  value={filtersOnFilter}
                  onChange={setFiltersOnFilter}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <MultiSelect
                  placeholder="Augmented Care?"
                  data={['Yes', 'No']}
                  value={augmentedCareFilter}
                  onChange={setAugmentedCareFilter}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <DatePickerInput
                  type="range"
                  placeholder="Filter Expiry Range"
                  value={filterExpiryRange}
                  onChange={(val) => {
                    const toDate = (v: string | Date | null) => {
                      if (!v) return null;
                      if (v instanceof Date) return v;
                      const d = new Date(v);
                      return isNaN(d.getTime()) ? null : d;
                    };
                    setFilterExpiryRange([
                      toDate(val[0]),
                      toDate(val[1])
                    ]);
                  }}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <MultiSelect
                  placeholder="Filter by Wing"
                  data={Array.from(new Set(assets.map(a => a.wing))).filter(Boolean)}
                  value={wingFilter}
                  onChange={setWingFilter}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  placeholder="Filter Expiry Status"
                  data={[
                    { value: 'expired', label: 'Filter Expired' },
                    { value: 'this-week', label: 'Expiring This Week' },
                    { value: 'next-week', label: 'Expiring Next Week' },
                    { value: 'this-month', label: 'Expiring This Month' },
                    { value: 'next-month', label: 'Expiring Next Month' }
                  ]}
                  value={filterExpiryStatus}
                  onChange={(value) => setFilterExpiryStatus(value || '')}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Group mt="xs" gap="xs">
                  <Button variant="outline" color="gray" size="sm" onClick={clearAllFilters}>
                    Clear Filters
                  </Button>
                </Group>
              </Grid.Col>
            </Grid>
          </Collapse>
        </Stack>
      </Card>

      {/* Visual separator for mobile */}
      <Divider hiddenFrom="md" size="xs" color="gray.3" />

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
            hiddenFrom="sm"
          />
        </Group>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader size="lg" />
            <Text>Loading assets...</Text>
          </Group>
        ) : (
          <>
            {/* Desktop Table View */}
            <Box visibleFrom="md">
              <ScrollArea>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>View</Table.Th>
                      <Table.Th>Asset</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Location</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Installed</Table.Th>
                      <Table.Th>Filter Expiry</Table.Th>
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
            </Box>

            {/* Mobile Card View */}
            <Box hiddenFrom="md" className="mobile-asset-cards">
              <Stack gap="xs">
                {paginatedAssets.length > 0 ? (
                  paginatedAssets.map((asset) => (
                    <Card 
                      key={asset.assetBarcode} 
                      shadow="sm" 
                      padding="sm" 
                      radius="md" 
                      withBorder
                      style={{ 
                        cursor: 'pointer',
                        backgroundColor: (() => {
                          const needsFlushing = typeof asset.needFlushing === 'boolean' ? 
                            asset.needFlushing : 
                            asset.needFlushing?.toString().toLowerCase() === 'yes' || asset.needFlushing?.toString().toLowerCase() === 'true';
                          return needsFlushing ? 'rgba(255, 0, 0, 0.05)' : undefined;
                        })(),
                        borderLeft: (() => {
                          const needsFlushing = typeof asset.needFlushing === 'boolean' ? 
                            asset.needFlushing : 
                            asset.needFlushing?.toString().toLowerCase() === 'yes' || asset.needFlushing?.toString().toLowerCase() === 'true';
                          return needsFlushing ? '3px solid red' : undefined;
                        })()
                      }}
                      onClick={() => {
                        setSelectedAsset(asset);
                        openViewModal();
                      }}
                    >
                      <Stack gap="xs">
                        <Group justify="space-between" align="flex-start">
                          <div>
                            <Text fw={600} size="sm">{asset.assetBarcode}</Text>
                            <Text size="xs" c="dimmed">{asset.room}</Text>
                          </div>
                          <Badge color={getStatusColor(asset.status)} variant="light" size="sm">
                            {asset.status}
                          </Badge>
                        </Group>
                        
                        <Group justify="space-between">
                          <div>
                            <Text size="xs" c="dimmed">Type</Text>
                            <Text size="sm">{asset.assetType}</Text>
                          </div>
                                                      <div>
                              <Text size="xs" c="dimmed">Installed</Text>
                              <Text size="sm">
                                {(() => { 
                                  const d = safeDate(asset.filterInstalledOn); 
                                  return d ? d.toLocaleDateString('en-GB') : 'Not installed'; 
                                })()}
                              </Text>
                            </div>
                        </Group>
                        
                        <Group justify="space-between" align="center">
                          <Stack gap="xs" style={{ flex: 1 }}>
                            <Group gap="xs">
                              <Text size="xs" c="dimmed">Filter Expiry:</Text>
                              {(() => {
                                const expiryStatus = getFilterExpiryStatus(asset.filterExpiryDate, asset.filterInstalledOn);
                                return (
                                  <>
                                    <Badge 
                                      color={expiryStatus.color} 
                                      variant="light" 
                                      size="xs"
                                    >
                                      {expiryStatus.text}
                                    </Badge>
                                    <Text size="xs" c="dimmed">
                                      {(() => { 
                                        const d = safeDate(asset.filterExpiryDate); 
                                        return d ? d.toLocaleDateString('en-GB') : 'N/A'; 
                                      })()}
                                    </Text>
                                  </>
                                );
                              })()}
                            </Group>
                            {/* Need Flushing Alert for Mobile */}
                            {(() => {
                              const needsFlushing = typeof asset.needFlushing === 'boolean' ? 
                                asset.needFlushing : 
                                asset.needFlushing?.toString().toLowerCase() === 'yes' || asset.needFlushing?.toString().toLowerCase() === 'true';
                              
                              return needsFlushing ? (
                                <Badge 
                                  color="red" 
                                  variant="filled" 
                                  size="xs"
                                  leftSection={<IconAlertTriangle size={10} />}
                                >
                                  NEEDS FLUSHING
                                </Badge>
                              ) : null;
                            })()}
                          </Stack>
                          <Group gap="xs">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAssetAudit(asset.assetBarcode);
                                openAuditModal();
                              }}
                            >
                              <IconHistory size={14} />
                            </ActionIcon>
                            <ActionIcon
                              variant="light"
                              color="yellow"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                try {
                                  setSelectedAsset(asset);
                                  form.setValues({
                                    assetBarcode: asset.assetBarcode || '',
                                    primaryIdentifier: asset.primaryIdentifier || '',
                                    secondaryIdentifier: asset.secondaryIdentifier || '',
                                    assetType: asset.assetType || '',
                                    status: asset.status || 'ACTIVE',
                                    wing: asset.wing || '',
                                    wingInShort: asset.wingInShort || '',
                                    room: asset.room || '',
                                    floor: asset.floor || '',
                                    floorInWords: asset.floorInWords || '',
                                    roomNo: asset.roomNo || '',
                                    roomName: asset.roomName || '',
                                    filterNeeded: typeof asset.filterNeeded === 'boolean' ? asset.filterNeeded : (asset.filterNeeded?.toString().toLowerCase() === 'true' || asset.filterNeeded?.toString().toLowerCase() === 'yes'),
                                    filtersOn: typeof asset.filtersOn === 'boolean' ? asset.filtersOn : (asset.filtersOn?.toString().toLowerCase() === 'true' || asset.filtersOn?.toString().toLowerCase() === 'yes'),
                                    filterExpiryDate: safeDate(asset.filterExpiryDate),
                                    filterInstalledOn: safeDate(asset.filterInstalledOn),
                                    needFlushing: typeof asset.needFlushing === 'boolean' ? asset.needFlushing : (asset.needFlushing?.toString().toLowerCase() === 'true' || asset.needFlushing?.toString().toLowerCase() === 'yes'),
                                    filterType: asset.filterType || '',
                                    notes: asset.notes || '',
                                    augmentedCare: typeof asset.augmentedCare === 'boolean' ? asset.augmentedCare : (asset.augmentedCare?.toString().toLowerCase() === 'true' || asset.augmentedCare?.toString().toLowerCase() === 'yes'),
                                  });
                                  setAssetFiles([]);
                                  openEditModal();
                                } catch (error) {
                                  console.error('Error setting form values:', error);
                                  notifications.show({
                                    title: 'Error',
                                    message: 'Failed to load asset data for editing',
                                    color: 'red',
                                    icon: <IconX size={16} />,
                                  });
                                }
                              }}
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                            <ActionIcon
                              variant="light"
                              color="red"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAsset(asset);
                              }}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Stack>
                    </Card>
                  ))
                ) : (
                  <Group justify="center" py="xl">
                    <Stack align="center" gap="xs">
                      <IconDroplet size={48} color="gray" />
                      <Text c="dimmed">No assets found matching your criteria.</Text>
                    </Stack>
                  </Group>
                )}
              </Stack>
            </Box>
          </>
        )}

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination
              total={totalPages}
              value={currentPage}
              onChange={setCurrentPage}
              size="sm"
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

  const handleSystemReset = () => {
    modals.openConfirmModal({
      title: (
        <Group>
          <IconAlertTriangle size={20} color="red" />
          <Text fw={600} c="red">System Reset Options</Text>
        </Group>
      ),
      children: (
        <Stack gap="md">
          <Text size="sm">
            Choose what to reset from the system:
          </Text>
          <Box pl="md">
            <Text size="sm" c="red">• All assets ({assets.length} assets) - ALWAYS CLEARED</Text>
            <Text size="sm" c="orange">• Audit logs (optional)</Text>
            <Text size="sm" c="orange">• Asset types and filter types (optional, will be left <b>empty</b> after reset)</Text>
            <Text size="sm" c="orange">• All uploaded files (optional)</Text>
          </Box>
          <Text size="sm" fw={500}>
            This action CANNOT be undone. The system will be restored to its initial state. If you clear asset types and filter types, they will be left <b>empty</b> after reset.
          </Text>
          <Text size="sm" c="dimmed">
            To confirm, please type: <Text span fw={600} c="red">RESET ALL DATA</Text>
          </Text>
        </Stack>
      ),
      labels: { confirm: 'I understand, reset system', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        // Open a second modal for final confirmation with text input and options
        modals.open({
          title: (
            <Group>
              <IconAlertTriangle size={20} color="red" />
              <Text fw={600} c="red">Final Confirmation Required</Text>
            </Group>
          ),
          children: (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const confirmationText = formData.get('confirmation') as string;
              const clearAuditLogs = (formData.get('clearAuditLogs') as string) === 'true';
              const clearAssetTypes = (formData.get('clearAssetTypes') as string) === 'true';
              const clearS3Files = (formData.get('clearS3Files') as string) === 'true';
              
              if (confirmationText === 'RESET ALL DATA') {
                executeSystemReset({
                  clearAuditLogs,
                  clearAssetTypes,
                  clearFilterTypes: clearAssetTypes, // Clear filter types if asset types are cleared
                  clearS3Files
                });
                modals.closeAll();
              } else {
                notifications.show({
                  title: 'Invalid confirmation',
                  message: 'Please type "RESET ALL DATA" exactly as shown.',
                  color: 'red',
                });
              }
            }}>
              <Stack gap="md">
                <Text size="sm">
                  Type <Text span fw={600} c="red">RESET ALL DATA</Text> to confirm:
                </Text>
                <TextInput
                  name="confirmation"
                  placeholder="Type confirmation text here"
                  required
                  autoFocus
                />
                
                <Divider />
                
                <Text size="sm" fw={500}>Optional Reset Options:</Text>
                
                <Checkbox
                  name="clearAuditLogs"
                  value="true"
                  defaultChecked
                  label="Clear audit logs (recommended)"
                />
                
                <Checkbox
                  name="clearAssetTypes"
                  value="true"
                  defaultChecked={false}
                  label="Clear asset types and filter types (will be left empty after reset)"
                />
                
                <Checkbox
                  name="clearS3Files"
                  value="true"
                  defaultChecked
                  label="Clear uploaded files"
                />
                
                <Group justify="flex-end" gap="xs">
                  <Button variant="outline" onClick={() => modals.closeAll()}>
                    Cancel
                  </Button>
                  <Button type="submit" color="red">
                    Reset System
                  </Button>
                </Group>
              </Stack>
            </form>
          ),
          closeOnClickOutside: false,
          closeOnEscape: false,
        });
      },
    });
  };

  const executeSystemReset = async (resetOptions?: {
    clearAuditLogs?: boolean;
    clearAssetTypes?: boolean;
    clearFilterTypes?: boolean;
    clearS3Files?: boolean;
  }) => {
    try {
      setLoading(true);
      
      notifications.show({
        id: 'system-reset',
        title: 'System Reset in Progress',
        message: 'Deleting data... This may take a few moments.',
        color: 'orange',
        loading: true,
        autoClose: false,
      });

      const response = await fetch('/api/reset-system', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmationText: 'RESET ALL DATA',
          confirmed: true,
          resetOptions: {
            clearAssets: true, // Always clear assets
            clearAuditLogs: resetOptions?.clearAuditLogs ?? true,
            clearAssetTypes: resetOptions?.clearAssetTypes ?? false,
            clearFilterTypes: resetOptions?.clearFilterTypes ?? false,
            clearS3Files: resetOptions?.clearS3Files ?? true,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        const totalRecords = Object.values(result.data.tables).reduce((acc: number, table: any) => acc + (table.deleted || 0), 0);
        const totalFiles = result.data.s3?.deleted || 0;
        
        notifications.update({
          id: 'system-reset',
          title: 'System Reset Completed',
          message: `Successfully reset system. Deleted ${totalRecords} database records and ${totalFiles} files.`,
          color: 'green',
          loading: false,
          autoClose: 5000,
        });

        // Refresh the page data
        await fetchData();
      } else {
        throw new Error(result.error || 'Reset failed');
      }
    } catch (error) {
      console.error('System reset error:', error);
      notifications.update({
        id: 'system-reset',
        title: 'System Reset Failed',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        color: 'red',
        loading: false,
        autoClose: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const renderBulkUpdate = () => (
    <Stack gap="lg">
      <Title order={2}>Bulk Update Assets</Title>
      <Text c="dimmed">Update multiple assets at once using a CSV or Excel file with your modifications.</Text>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">
          <Group gap="sm">
            <IconFileSpreadsheet size={20} />
            Download Template
          </Group>
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          Download a template with all asset fields. You can choose to include current data or get an empty template.
        </Text>
        
        <Stack gap="md">
          <Group wrap="wrap">
            <Button
              leftSection={<IconDownload size={16} />}
              variant="outline"
              onClick={() => downloadBulkUpdateTemplate('csv', false)}
              size="sm"
            >
              Empty Template (CSV)
            </Button>
            <Button
              leftSection={<IconDownload size={16} />}
              variant="outline"
              onClick={() => downloadBulkUpdateTemplate('excel', false)}
              size="sm"
            >
              Empty Template (Excel)
            </Button>
            <Button
              leftSection={<IconDownload size={16} />}
              variant="filled"
              onClick={() => downloadBulkUpdateTemplate('csv', true)}
              size="sm"
            >
              With Current Data (CSV)
            </Button>
            <Button
              leftSection={<IconDownload size={16} />}
              variant="filled"
              onClick={() => downloadBulkUpdateTemplate('excel', true)}
              size="sm"
            >
              With Current Data (Excel)
            </Button>
          </Group>
          
          <Text size="xs" c="dimmed">
            <strong>Tip:</strong> Download "With Current Data" to get a pre-filled template with all your existing assets. 
            You can then modify only the fields you want to update and upload the file back.
          </Text>
        </Stack>
      </Card>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">
          <Group gap="sm">
            <IconUpload size={20} />
            Upload Updated Data
          </Group>
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          Upload your modified CSV or Excel file to update assets. The system will identify assets by their barcode and update the provided fields.
        </Text>
        
        <Stack gap="md">
          <FileInput
            label="Select CSV/Excel file"
            placeholder="Choose file to upload"
            value={bulkUpdateFile}
            onChange={setBulkUpdateFile}
            accept=".csv,.xlsx,.xls"
            leftSection={<IconUpload size={16} />}
          />
          
          <Group wrap="wrap" gap="xs">
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={handleBulkUpdate}
              loading={bulkUpdateLoading}
              disabled={!bulkUpdateFile}
              size="sm"
            >
              Update Assets
            </Button>
            {bulkUpdateFile && (
              <Button
                variant="outline"
                onClick={() => {
                  setBulkUpdateFile(null);
                  setBulkUpdateResults(null);
                }}
                size="sm"
              >
                Clear
              </Button>
            )}
          </Group>
          
          {bulkUpdateResults && (
            <Card withBorder p="md" bg="gray.0">
              <Title order={5} mb="sm">Update Results</Title>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm">Total Records:</Text>
                  <Badge color="blue">{bulkUpdateResults.total}</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Successfully Updated:</Text>
                  <Badge color="green">{bulkUpdateResults.updated}</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Assets Not Found:</Text>
                  <Badge color="orange">{bulkUpdateResults.notFound}</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Errors:</Text>
                  <Badge color="red">{bulkUpdateResults.errors}</Badge>
                </Group>
                
                {bulkUpdateResults.newAssetTypes && bulkUpdateResults.newAssetTypes.length > 0 && (
                  <div>
                    <Text size="sm" fw={500} mt="md" mb="xs" c="green">Auto-Created Asset Types:</Text>
                    <Group gap="xs">
                      {bulkUpdateResults.newAssetTypes.map((type: string, index: number) => (
                        <Badge key={index} color="green" variant="light" size="sm">
                          {type}
                        </Badge>
                      ))}
                    </Group>
                  </div>
                )}
                
                {bulkUpdateResults.newFilterTypes && bulkUpdateResults.newFilterTypes.length > 0 && (
                  <div>
                    <Text size="sm" fw={500} mt="md" mb="xs" c="green">Auto-Created Filter Types:</Text>
                    <Group gap="xs">
                      {bulkUpdateResults.newFilterTypes.map((type: string, index: number) => (
                        <Badge key={index} color="green" variant="light" size="sm">
                          {type}
                        </Badge>
                      ))}
                    </Group>
                  </div>
                )}
                
                {bulkUpdateResults.notFoundBarcodes && bulkUpdateResults.notFoundBarcodes.length > 0 && (
                  <div>
                    <Text size="sm" fw={500} mt="md" mb="xs" c="orange">Assets Not Found (Barcodes):</Text>
                    <Group gap="xs">
                      {bulkUpdateResults.notFoundBarcodes.map((barcode: string, index: number) => (
                        <Badge key={index} color="orange" variant="light" size="sm">
                          {barcode}
                        </Badge>
                      ))}
                    </Group>
                  </div>
                )}
                
                {bulkUpdateResults.errorDetails && bulkUpdateResults.errorDetails.length > 0 && (
                  <div>
                    <Text size="sm" fw={500} mt="md" mb="xs" c="red">Error Details:</Text>
                    <Stack gap="xs">
                      {bulkUpdateResults.errorDetails.map((error: string, index: number) => (
                        <Text key={index} size="xs" c="red" bg="red.0" p="xs" style={{ borderRadius: 4 }}>
                          {error}
                        </Text>
                      ))}
                    </Stack>
                  </div>
                )}
              </Stack>
            </Card>
          )}
        </Stack>
      </Card>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">
          <Group gap="sm">
            <IconInfoCircle size={20} />
            How It Works
          </Group>
        </Title>
        <Stack gap="md">
          <div>
            <Text size="sm" fw={500} mb="xs">1. Download Template</Text>
            <Text size="xs" c="dimmed">
              Download a template with all asset fields. Choose "With Current Data" to get pre-filled data that you can modify.
            </Text>
          </div>
          
          <div>
            <Text size="sm" fw={500} mb="xs">2. Modify Data</Text>
            <Text size="xs" c="dimmed">
              Edit the CSV/Excel file with your changes. You only need to fill in the fields you want to update. 
              The Asset Barcode column is required to identify each asset.
            </Text>
          </div>
          
          <div>
            <Text size="sm" fw={500} mb="xs">3. Upload File</Text>
            <Text size="xs" c="dimmed">
              Upload your modified file. The system will identify assets by barcode and update only the provided fields.
            </Text>
          </div>
          
          <div>
            <Text size="sm" fw={500} mb="xs">4. Review Results</Text>
            <Text size="xs" c="dimmed">
              Check the results to see how many assets were updated successfully and any errors that occurred.
            </Text>
          </div>
        </Stack>
      </Card>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">
          <Group gap="sm">
            <IconAlertTriangle size={20} />
            Important Notes
          </Group>
        </Title>
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            • <strong>Asset Barcode</strong> is required to identify each asset for updates
          </Text>
          <Text size="xs" c="dimmed">
            • Only fill in fields you want to update - empty fields will be ignored
          </Text>
          <Text size="xs" c="dimmed">
            • Date fields should be in DD/MM/YYYY format
          </Text>
          <Text size="xs" c="dimmed">
            • Boolean fields accept: TRUE/FALSE, YES/NO, 1/0
          </Text>
          <Text size="xs" c="dimmed">
            • New Asset Types and Filter Types will be created automatically
          </Text>
          <Text size="xs" c="dimmed">
            • Assets with non-matching barcodes will be reported as "Not Found"
          </Text>
        </Stack>
      </Card>
    </Stack>
  );

  const renderSettings = () => (
    <Stack gap="lg">
      <Title order={2}>Settings</Title>
      <Text c="dimmed">Configure your water asset management system.</Text>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">
          <Group gap="sm">
            <IconPlus size={20} />
            Bulk Upload New Assets
          </Group>
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          Create multiple new assets at once using a CSV or Excel file. Download the template to get started with the correct format.
        </Text>
        
        <Stack gap="md">
          <Group wrap="wrap">
            <Button
              leftSection={<IconDownload size={16} />}
              variant="outline"
              onClick={() => downloadTemplate('csv')}
              size="sm"
            >
              Download Template (CSV)
            </Button>
            <Button
              leftSection={<IconDownload size={16} />}
              variant="outline"
              onClick={() => downloadTemplate('excel')}
              size="sm"
            >
              Download Template (Excel)
            </Button>
          </Group>
          
          <Text size="xs" c="dimmed">
            <strong>Tip:</strong> Download the template (CSV or Excel) to see the exact format required for bulk uploading new assets.
          </Text>
          
          <FileInput
            label="Select CSV/Excel file"
            placeholder="Choose file to upload"
            value={uploadFile}
            onChange={setUploadFile}
            accept=".csv,.xlsx,.xls"
            leftSection={<IconUpload size={16} />}
          />
          
          <Group wrap="wrap" gap="xs">
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={handleBulkUpload}
              loading={isUploading}
              disabled={!uploadFile}
              size="sm"
            >
              Upload New Assets
            </Button>
            {uploadFile && (
              <Button
                variant="outline"
                onClick={() => {
                  setUploadFile(null);
                  setUploadResults(null);
                }}
                size="sm"
              >
                Clear
              </Button>
            )}
          </Group>
          
          {uploadResults && (
            <Card withBorder p="md" bg="gray.0">
              <Title order={5} mb="sm">Upload Results</Title>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm">Total Records:</Text>
                  <Badge color="blue">{uploadResults.total}</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Successfully Created:</Text>
                  <Badge color="green">{uploadResults.success}</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Failed:</Text>
                  <Badge color="red">{uploadResults.failed}</Badge>
                </Group>
                
                {uploadResults.newAssetTypes && uploadResults.newAssetTypes.length > 0 && (
                  <div>
                    <Text size="sm" fw={500} mt="md" mb="xs" c="green">Auto-Created Asset Types:</Text>
                    <Group gap="xs">
                      {uploadResults.newAssetTypes.map((type: string, index: number) => (
                        <Badge key={index} color="green" variant="light" size="sm">
                          {type}
                        </Badge>
                      ))}
                    </Group>
                  </div>
                )}
                
                {uploadResults.duplicateBarcodes && uploadResults.duplicateBarcodes.length > 0 && (
                  <div>
                    <Text size="sm" fw={500} mt="md" mb="xs" c="orange">Duplicate Barcodes Found:</Text>
                    <Group gap="xs">
                      {uploadResults.duplicateBarcodes.map((barcode: string, index: number) => (
                        <Badge key={index} color="orange" variant="light" size="sm">
                          {barcode}
                        </Badge>
                      ))}
                    </Group>
                  </div>
                )}
                
                {uploadResults.errors && uploadResults.errors.length > 0 && (
                  <div>
                    <Text size="sm" fw={500} mt="md" mb="xs" c="red">Error Details:</Text>
                    <Stack gap="xs">
                      {uploadResults.errors.map((error: string, index: number) => (
                        <Text key={index} size="xs" c="red" bg="red.0" p="xs" style={{ borderRadius: 4 }}>
                          {error}
                        </Text>
                      ))}
                    </Stack>
                  </div>
                )}
              </Stack>
            </Card>
          )}
        </Stack>
      </Card>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">
          <Group gap="sm">
            <IconInfoCircle size={20} />
            Bulk Upload Guide
          </Group>
        </Title>
        <Stack gap="md">
          <div>
            <Text size="sm" fw={500} mb="xs">1. Download Template</Text>
            <Text size="xs" c="dimmed">
              Download the CSV or Excel template to see the exact format and required fields for creating new assets.
            </Text>
          </div>
          
          <div>
            <Text size="sm" fw={500} mb="xs">2. Fill Asset Data</Text>
            <Text size="xs" c="dimmed">
              Complete the template with your asset information. All required fields must be filled to create assets successfully.
            </Text>
          </div>
          
          <div>
            <Text size="sm" fw={500} mb="xs">3. Upload File</Text>
            <Text size="xs" c="dimmed">
              Upload your completed CSV or Excel file. The system will create new assets and validate all data.
            </Text>
          </div>
          
          <div>
            <Text size="sm" fw={500} mb="xs">4. Review Results</Text>
            <Text size="xs" c="dimmed">
              Check the results to see how many assets were created successfully and any errors that occurred.
            </Text>
          </div>
        </Stack>
      </Card>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">
          <Group gap="sm">
            <IconAlertTriangle size={20} />
            Important Notes
          </Group>
        </Title>
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            • <strong>Asset Barcode</strong> must be unique - duplicates will be rejected
          </Text>
          <Text size="xs" c="dimmed">
            • <strong>Primary Identifier</strong> is required for all assets
          </Text>
          <Text size="xs" c="dimmed">
            • Date fields should be in DD/MM/YYYY format
          </Text>
          <Text size="xs" c="dimmed">
            • Boolean fields accept: TRUE/FALSE, YES/NO, 1/0
          </Text>
          <Text size="xs" c="dimmed">
            • New Asset Types will be created automatically if they don't exist
          </Text>
          <Text size="xs" c="dimmed">
            • Filter expiry dates are auto-calculated when installation date is provided
          </Text>
        </Stack>
      </Card>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Asset Types Management</Title>
        <Text size="sm" c="dimmed" mb="md">
          Manage available asset types for your water management system.
        </Text>
        
        <Stack gap="md">
          <div>
            <Text size="sm" fw={500} mb="xs">Current Asset Types:</Text>
            <Group gap="xs">
              {assetTypes.map((type, index) => (
                <Group key={index} gap={4}>
                  <Badge variant="light" color="blue">
                    {type}
                  </Badge>
                  <ActionIcon
                    size="sm"
                    color="red"
                    variant="subtle"
                    onClick={() => handleDeleteAssetType(type)}
                    title={`Delete ${type}`}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                </Group>
              ))}
            </Group>
          </div>
          
          {showNewAssetTypeInput ? (
            <Group>
              <TextInput
                placeholder="Enter new asset type"
                value={newAssetType}
                onChange={(e) => setNewAssetType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddNewAssetType();
                  }
                  if (e.key === 'Escape') {
                    setShowNewAssetTypeInput(false);
                    setNewAssetType('');
                  }
                }}
                autoFocus
                size="sm"
                style={{ flex: 1 }}
              />
              <Button size="sm" onClick={handleAddNewAssetType} disabled={!newAssetType.trim()}>
                Add
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowNewAssetTypeInput(false);
                  setNewAssetType('');
                }}
              >
                Cancel
              </Button>
            </Group>
          ) : (
            <Button
              size="sm"
              variant="outline"
              leftSection={<IconPlus size={16} />}
              onClick={() => setShowNewAssetTypeInput(true)}
            >
              Add New Asset Type
            </Button>
          )}
        </Stack>
      </Card>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Filter Types Management</Title>
        <Text size="sm" c="dimmed" mb="md">
          Manage available filter types for your water management system.
        </Text>
        
        <Stack gap="md">
          <div>
            <Text size="sm" fw={500} mb="xs">Current Filter Types:</Text>
            <Group gap="xs">
              {filterTypes.map((type, index) => (
                <Group key={index} gap={4}>
                  <Badge variant="light" color="green">
                    {type}
                  </Badge>
                  <ActionIcon
                    size="sm"
                    color="red"
                    variant="subtle"
                    onClick={() => handleDeleteFilterType(type)}
                    title={`Delete ${type}`}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                </Group>
              ))}
            </Group>
          </div>
          
          {showNewFilterTypeInput ? (
            <Group>
              <TextInput
                placeholder="Enter new filter type"
                value={newFilterType}
                onChange={(e) => setNewFilterType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddNewFilterType();
                  }
                  if (e.key === 'Escape') {
                    setShowNewFilterTypeInput(false);
                    setNewFilterType('');
                  }
                }}
                autoFocus
                size="sm"
                style={{ flex: 1 }}
              />
              <Button size="sm" onClick={handleAddNewFilterType} disabled={!newFilterType.trim()}>
                Add
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowNewFilterTypeInput(false);
                  setNewFilterType('');
                }}
              >
                Cancel
              </Button>
            </Group>
          ) : (
            <Button
              size="sm"
              variant="outline"
              leftSection={<IconPlus size={16} />}
              onClick={() => setShowNewFilterTypeInput(true)}
            >
              Add New Filter Type
            </Button>
          )}
        </Stack>
      </Card>
      
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

      <Card shadow="sm" padding="lg" radius="md" withBorder style={{ borderColor: '#ff6b6b' }}>
        <Title order={4} mb="md" c="red">
          <Group>
            <IconAlertTriangle size={20} />
            Danger Zone
          </Group>
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          This action will permanently delete all data from the system. This includes all assets, 
          audit logs, and uploaded files. The database tables will remain but will be empty.
        </Text>
        <Text size="sm" c="red" mb="md" fw={500}>
          ⚠️ This action cannot be undone. Please make sure you have backups if needed.
        </Text>
        
        <Button
          color="red"
          variant="outline"
          leftSection={<IconTrash size={16} />}
          onClick={handleSystemReset}
          size="sm"
        >
          Master Reset System
        </Button>
      </Card>
    </Stack>
  );

  const handleSignOut = async () => {
    try {
      await signOut();
      notifications.show({
        title: 'Signed out',
        message: 'You have been successfully signed out.',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to sign out. Please try again.',
        color: 'red',
      });
    }
  };

  // Sort audit log entries by timestamp descending before rendering
  const sortedAuditLog = [...auditLog].sort((a, b) => {
    const aTime = new Date(a.timestamp.split('Z')[0] + 'Z').getTime();
    const bTime = new Date(b.timestamp.split('Z')[0] + 'Z').getTime();
    return bTime - aTime;
  });

  // Add a function to clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter([]);
    setTypeFilter([]);
    setWingFilter([]);
    setFloorFilter([]);
    setFilterTypeFilter([]);
    setNeedFlushingFilter([]);
    setFilterNeededFilter([]);
    setFiltersOnFilter([]);
    setAugmentedCareFilter([]);
    setFilterExpiryRange([null, null]);
    setFilterExpiryStatus('');
  };

  return (
    <ProtectedRoute>
      <AppShell
        header={{ height: 60 }}
        navbar={{ 
          width: 300, 
          breakpoint: 'sm', 
          collapsed: { 
            mobile: !opened,
            desktop: sidebarCollapsed
          } 
        }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between" className="main-header">
            <Group className="header-left-section" style={{ flex: 1, minWidth: 0 }}>
              <ActionIcon 
                variant="subtle" 
                onClick={toggle} 
                hiddenFrom="sm" 
                size="sm"
                title="Toggle Mobile Menu"
              >
                <IconMenu2 size={18} />
              </ActionIcon>
              <ActionIcon 
                variant="subtle" 
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)} 
                visibleFrom="sm" 
                size="sm"
                title={sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
                style={{ 
                  backgroundColor: sidebarCollapsed ? 'var(--mantine-color-blue-light)' : 'transparent',
                  color: sidebarCollapsed ? 'var(--mantine-color-blue-6)' : 'inherit'
                }}
              >
                <IconMenu2 size={18} />
              </ActionIcon>
              <div className="title-section">
                <Title order={3} c="blue" className="main-title">Water Safety Management</Title>
                <Text size="sm" c="dimmed" className="subtitle">St Georges University Hospital</Text>
              </div>
            </Group>
            
            <Group gap="xs" className="header-right-section">
              <ActionIcon
                variant="light"
                color="blue"
                size="lg"
                onClick={openAuditDrawer}
                title="System Audit Trail"
                className="audit-icon"
              >
                <IconHistory size={18} />
              </ActionIcon>
              <Menu>
                <Menu.Target>
                  <Button 
                    variant="subtle" 
                    leftSection={<IconUser size={16} />}
                    className="username-button"
                    style={{ 
                      minWidth: 'fit-content',
                      maxWidth: 'none'
                    }}
                  >
                    <span className="username-text">{user?.email || 'User'}</span>
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconLogout size={16} />}
                    onClick={handleSignOut}
                  >
                    Sign Out
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </AppShell.Header>

                <AppShell.Navbar p="md">
          <Stack gap="xs">
            <Button
              variant={activeTab === 'dashboard' ? 'filled' : 'subtle'}
              leftSection={<IconDashboard size={16} />}
              justify="start"
              onClick={() => {
                setActiveTab('dashboard');
                if (opened) toggle(); // Close mobile menu after selection
              }}
            >
              Dashboard
            </Button>
            <Button
              variant={activeTab === 'assets' ? 'filled' : 'subtle'}
              leftSection={<IconDroplet size={16} />}
              justify="start"
              onClick={() => {
                setActiveTab('assets');
                if (opened) toggle(); // Close mobile menu after selection
              }}
            >
              Assets
            </Button>
            <Button
              variant={activeTab === 'reports' ? 'filled' : 'subtle'}
              leftSection={<IconReport size={16} />}
              justify="start"
              onClick={() => {
                setActiveTab('reports');
                if (opened) toggle(); // Close mobile menu after selection
              }}
            >
              Reports
            </Button>
            <Button
              variant={activeTab === 'bulk-update' ? 'filled' : 'subtle'}
              leftSection={<IconUpload size={16} />}
              justify="start"
              onClick={() => {
                setActiveTab('bulk-update');
                if (opened) toggle(); // Close mobile menu after selection
              }}
            >
              Bulk Update
            </Button>
            <Button
              variant={activeTab === 'settings' ? 'filled' : 'subtle'}
              leftSection={<IconSettings size={16} />}
              justify="start"
              onClick={() => {
                setActiveTab('settings');
                if (opened) toggle(); // Close mobile menu after selection
              }}
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

        <AppShell.Main className="main-shell">
          <div className="responsive-container">


            
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'assets' && renderAssets()}
            {activeTab === 'reports' && renderReports()}
            {activeTab === 'bulk-update' && renderBulkUpdate()}
            {activeTab === 'settings' && renderSettings()}
          </div>
        </AppShell.Main>
      </AppShell>

      {/* Add Asset Modal */}
      <Modal 
        opened={modalOpened} 
        onClose={closeModal} 
        title="Add New Asset" 
        size="xl"
        fullScreen
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <form onSubmit={form.onSubmit(handleAddAsset)}>
          <Stack gap="lg">
            {/* Basic Information */}
            <div>
              <Title order={5} mb="sm">Basic Information</Title>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Asset Barcode"
                    placeholder="Enter barcode"
                    inputMode="text"
                    required
                    {...form.getInputProps('assetBarcode')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Primary Identifier"
                    placeholder="Enter identifier"
                    required
                    inputMode="text"
                    {...form.getInputProps('primaryIdentifier')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Secondary Identifier"
                    placeholder="Enter secondary identifier"
                    {...form.getInputProps('secondaryIdentifier')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap="xs">
                  <Select
                    label="Asset Type"
                    placeholder="Select type"
                      data={[...assetTypes.filter(type => type !== 'ADD_NEW'), { value: 'ADD_NEW', label: '+ Add New...' }]}
                    required
                      value={form.values.assetType}
                      onChange={handleAssetTypeSelect}
                    />
                    {showNewAssetTypeInput && (
                      <Group gap="xs">
                        <TextInput
                          placeholder="Enter new asset type"
                          value={newAssetType}
                          onChange={(e) => setNewAssetType(e.currentTarget.value)}
                          style={{ flex: 1 }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddNewAssetType();
                            }
                          }}
                  />
                        <Button size="xs" onClick={handleAddNewAssetType}>
                          Add
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => setShowNewAssetTypeInput(false)}>
                          Cancel
                        </Button>
                      </Group>
                    )}
                  </Stack>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Status"
                    data={['ACTIVE', 'INACTIVE', 'MAINTENANCE']}
                    required
                    {...form.getInputProps('status')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Checkbox
                    label="Augmented Care"
                    description="Requires special care or attention"
                    {...form.getInputProps('augmentedCare', { type: 'checkbox' })}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Checkbox
                    label="Need Flushing"
                    description="Asset requires flushing"
                    {...form.getInputProps('needFlushing', { type: 'checkbox' })}
                  />
                </Grid.Col>
              </Grid>
    </div>

            <Divider />

            {/* Location Information */}
            <div>
              <Title order={5} mb="sm">Location Information</Title>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Wing"
                    placeholder="Enter wing"
                    {...form.getInputProps('wing')}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      form.setFieldValue('wing', value);
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Wing (Short)"
                    placeholder="Enter wing abbreviation"
                    {...form.getInputProps('wingInShort')}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      form.setFieldValue('wingInShort', value);
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Room"
                    placeholder="Enter room"
                    {...form.getInputProps('room')}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      form.setFieldValue('room', value);
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Room Name"
                    placeholder="Enter room name"
                    {...form.getInputProps('roomName')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Room Number"
                    placeholder="Enter room number"
                    {...form.getInputProps('roomNo')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Floor"
                    placeholder="Enter floor"
                    {...form.getInputProps('floor')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
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
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Checkbox
                    label="Filter Needed"
                    {...form.getInputProps('filterNeeded', { type: 'checkbox' })}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Checkbox
                    label="Filters On"
                    {...form.getInputProps('filtersOn', { type: 'checkbox' })}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <DateInput
                    label="Filter Installed On"
                    placeholder="Select installation date"
                    {...form.getInputProps('filterInstalledOn')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <DateInput
                    label="Filter Expiry Date"
                    placeholder="Auto-calculated from installation date"
                    readOnly
                    disabled
                    {...form.getInputProps('filterExpiryDate')}
                    styles={{
                      input: {
                        backgroundColor: '#f8f9fa',
                        color: '#6c757d',
                        cursor: 'not-allowed'
                      }
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap="xs">
                    <Select
                      label="Filter Type"
                      placeholder="Select filter type"
                      data={[...filterTypes.filter(type => type !== 'ADD_NEW'), { value: 'ADD_NEW', label: '+ Add New...' }]}
                      value={form.values.filterType}
                      onChange={handleFilterTypeSelect}
                    />
                    {showNewFilterTypeInput && (
                      <Group gap="xs">
                        <TextInput
                          placeholder="Enter new filter type"
                          value={newFilterType}
                          onChange={(e) => setNewFilterType(e.currentTarget.value)}
                          style={{ flex: 1 }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddNewFilterType();
                            }
                          }}
                        />
                        <Button size="xs" onClick={handleAddNewFilterType}>
                          Add
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => setShowNewFilterTypeInput(false)}>
                          Cancel
                        </Button>
                      </Group>
                    )}
                  </Stack>
                </Grid.Col>
              </Grid>
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

            <Divider />

            {/* File Attachments */}
            <div>
              <Title order={5} mb="sm">File Attachments</Title>
              <Text size="sm" c="dimmed" mb="md">
                Upload documents, images, or other files related to this asset.
              </Text>
              
              <FileInput
                label="Upload Files"
                placeholder="Choose files to upload"
                multiple
                value={assetFiles}
                onChange={setAssetFiles}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt"
                leftSection={<IconUpload size={16} />}
                description="Supported formats: PDF, DOC, DOCX, JPG, PNG, GIF, TXT"
              />
              
              {assetFiles.length > 0 && (
                <Stack gap="xs" mt="sm">
                  <Text size="sm" fw={500}>Selected Files:</Text>
                  {assetFiles.map((file, index) => (
                    <Group key={index} justify="space-between" p="xs" bg="gray.0" style={{ borderRadius: '4px' }}>
                      <Group gap="xs">
                        <IconPaperclip size={14} />
                        <Text size="sm">{file.name}</Text>
                        <Text size="xs" c="dimmed">({Math.round(file.size / 1024)} KB)</Text>
                      </Group>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => {
                          setAssetFiles(prev => prev.filter((_, i) => i !== index));
                        }}
                      >
                        <IconX size={12} />
                      </ActionIcon>
                    </Group>
                  ))}
                </Stack>
              )}
            </div>

            <Group justify="flex-end" mt="lg">
              <Button variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" loading={isUploadingFile}>
                Add Asset
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Edit Asset Modal */}
      <Modal 
        opened={editModalOpened} 
        onClose={closeEditModal} 
        title="Edit Asset" 
        size="xl"
        fullScreen
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <form onSubmit={form.onSubmit(handleEditAsset)}>
          <Stack gap="lg">
            {/* Basic Information */}
            <div>
              <Title order={5} mb="sm">Basic Information</Title>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Asset Barcode"
                    placeholder="Enter barcode"
                    required
                    {...form.getInputProps('assetBarcode')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Primary Identifier"
                    placeholder="Enter identifier"
                    required
                    {...form.getInputProps('primaryIdentifier')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Secondary Identifier"
                    placeholder="Enter secondary identifier"
                    {...form.getInputProps('secondaryIdentifier')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap="xs">
                  <Select
                    label="Asset Type"
                    placeholder="Select type"
                      data={[...assetTypes.filter(type => type !== 'ADD_NEW'), { value: 'ADD_NEW', label: '+ Add New...' }]}
                    required
                      value={form.values.assetType}
                      onChange={handleAssetTypeSelect}
                    />
                    {showNewAssetTypeInput && (
                      <Group gap="xs">
                        <TextInput
                          placeholder="Enter new asset type"
                          value={newAssetType}
                          onChange={(e) => setNewAssetType(e.currentTarget.value)}
                          style={{ flex: 1 }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddNewAssetType();
                            }
                          }}
                  />
                        <Button size="xs" onClick={handleAddNewAssetType}>
                          Add
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => setShowNewAssetTypeInput(false)}>
                          Cancel
                        </Button>
                      </Group>
                    )}
                  </Stack>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Status"
                    data={['ACTIVE', 'INACTIVE', 'MAINTENANCE']}
                    required
                    {...form.getInputProps('status')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Checkbox
                    label="Augmented Care"
                    description="Requires special care or attention"
                    {...form.getInputProps('augmentedCare', { type: 'checkbox' })}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Checkbox
                    label="Need Flushing"
                    description="Asset requires flushing"
                    {...form.getInputProps('needFlushing', { type: 'checkbox' })}
                  />
                </Grid.Col>
              </Grid>
            </div>

            <Divider />

            {/* Location Information */}
            <div>
              <Title order={5} mb="sm">Location Information</Title>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Wing"
                    placeholder="Enter wing"
                    {...form.getInputProps('wing')}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      form.setFieldValue('wing', value);
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Wing (Short)"
                    placeholder="Enter wing abbreviation"
                    {...form.getInputProps('wingInShort')}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      form.setFieldValue('wingInShort', value);
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Room"
                    placeholder="Enter room"
                    {...form.getInputProps('room')}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      form.setFieldValue('room', value);
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Room Name"
                    placeholder="Enter room name"
                    {...form.getInputProps('roomName')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Room Number"
                    placeholder="Enter room number"
                    {...form.getInputProps('roomNo')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    label="Floor"
                    placeholder="Enter floor"
                    {...form.getInputProps('floor')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
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
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Checkbox
                    label="Filter Needed"
                    {...form.getInputProps('filterNeeded', { type: 'checkbox' })}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Checkbox
                    label="Filters On"
                    {...form.getInputProps('filtersOn', { type: 'checkbox' })}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <DateInput
                    label="Filter Installed On"
                    placeholder="Select installation date"
                    {...form.getInputProps('filterInstalledOn')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <DateInput
                    label="Filter Expiry Date"
                    placeholder="Auto-calculated from installation date"
                    readOnly
                    disabled
                    {...form.getInputProps('filterExpiryDate')}
                    styles={{
                      input: {
                        backgroundColor: '#f8f9fa',
                        color: '#6c757d',
                        cursor: 'not-allowed'
                      }
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap="xs">
                    <Select
                      label="Filter Type"
                      placeholder="Select filter type"
                      data={[...filterTypes.filter(type => type !== 'ADD_NEW'), { value: 'ADD_NEW', label: '+ Add New...' }]}
                      value={form.values.filterType}
                      onChange={handleFilterTypeSelect}
                    />
                    {showNewFilterTypeInput && (
                      <Group gap="xs">
                        <TextInput
                          placeholder="Enter new filter type"
                          value={newFilterType}
                          onChange={(e) => setNewFilterType(e.currentTarget.value)}
                          style={{ flex: 1 }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddNewFilterType();
                            }
                          }}
                        />
                        <Button size="xs" onClick={handleAddNewFilterType}>
                          Add
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => setShowNewFilterTypeInput(false)}>
                          Cancel
                        </Button>
                      </Group>
                    )}
                  </Stack>
                </Grid.Col>
              </Grid>
              
              {/* Remove Filter Button */}
              <Group justify="center" mt="md">
                <Button
                  variant="outline"
                  color="orange"
                  size="sm"
                  leftSection={<IconX size={16} />}
                  onClick={() => selectedAsset && handleRemoveFilter(selectedAsset)}
                  disabled={!selectedAsset || (!selectedAsset.filterNeeded && !selectedAsset.filtersOn && !selectedAsset.filterType)}
                >
                  Remove Filter
                </Button>
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

            {/* File Attachments */}
            <div>
              <Title order={5} mb="sm">File Attachments</Title>
              <Text size="sm" c="dimmed" mb="md">
                Upload documents, images, or other files related to this asset.
              </Text>
              
              <FileInput
                label="Upload Files"
                placeholder="Choose files to upload"
                multiple
                value={assetFiles}
                onChange={setAssetFiles}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt"
                leftSection={<IconUpload size={16} />}
                description="Supported formats: PDF, DOC, DOCX, JPG, PNG, GIF, TXT"
              />
              
              {assetFiles.length > 0 && (
                <Stack gap="xs" mt="sm">
                  <Text size="sm" fw={500}>Selected Files:</Text>
                  {assetFiles.map((file, index) => (
                    <Group key={index} justify="space-between" p="xs" bg="gray.0" style={{ borderRadius: '4px' }}>
                      <Group gap="xs">
                        <IconPaperclip size={14} />
                        <Text size="sm">{file.name}</Text>
                        <Text size="xs" c="dimmed">({Math.round(file.size / 1024)} KB)</Text>
                      </Group>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => {
                          setAssetFiles(prev => prev.filter((_, i) => i !== index));
                        }}
                      >
                        <IconX size={12} />
                      </ActionIcon>
                    </Group>
                  ))}
                </Stack>
              )}

              {/* Show existing attachments for edit mode */}
              {selectedAsset && selectedAsset.attachments && selectedAsset.attachments.length > 0 && (
                <div>
                  <Text size="sm" fw={500} mt="md" mb="xs">Current Attachments:</Text>
                  <Stack gap="xs">
                    {selectedAsset.attachments.map((attachment, index) => (
                      <Group key={index} justify="space-between" p="xs" bg="blue.0" style={{ borderRadius: '4px' }}>
                        <Group gap="xs">
                          <IconPaperclip size={14} />
                          <Text size="sm">{attachment.fileName}</Text>
                        </Group>
                        <Group gap="xs">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="blue"
                            onClick={() => window.open(attachment.s3Url, '_blank')}
                            title="View file"
                          >
                            <IconEye size={12} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="green"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = attachment.s3Url;
                              link.download = attachment.fileName;
                              link.click();
                            }}
                            title="Download file"
                          >
                            <IconDownload size={12} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={async () => {
                              const success = await handleFileDelete(attachment.s3Url, attachment.fileName);
                              if (success && selectedAsset) {
                                // Update the selectedAsset to remove the deleted attachment
                                const updatedAsset = {
                                  ...selectedAsset,
                                  attachments: selectedAsset.attachments?.filter(a => a.s3Url !== attachment.s3Url) || []
                                };
                                setSelectedAsset(updatedAsset);
                                
                                // Also update the assets list
                                setAssets(prev => prev.map(asset => 
                                  asset.id === selectedAsset.id ? updatedAsset : asset
                                ));
                              }
                            }}
                            title="Delete file"
                          >
                            <IconTrash size={12} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                </div>
              )}
            </div>

            <Group justify="flex-end" mt="lg">
              <Button variant="outline" onClick={closeEditModal}>
                Cancel
              </Button>
              <Button type="submit" loading={isUploadingFile}>
                Update Asset
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* View Asset Modal */}
      <Modal 
        opened={showViewModal} 
        onClose={closeViewModal} 
        title="Asset Details" 
        size="lg"
        fullScreen
        scrollAreaComponent={ScrollArea.Autosize}
      >
        {selectedAsset && (
          <Stack gap="lg">
            {/* Basic Information */}
            <div>
              <Text fw={600} mb="sm" c="blue">Basic Information</Text>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Asset Barcode</Text>
                  <Text fw={500} size="sm">{selectedAsset.assetBarcode || 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Status</Text>
                  <Badge color={getStatusColor(selectedAsset.status)} variant="light" size="sm">
                    {selectedAsset.status}
                  </Badge>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Primary Identifier</Text>
                  <Text fw={500} size="sm">{selectedAsset.primaryIdentifier}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Secondary Identifier</Text>
                  <Text size="sm">{selectedAsset.secondaryIdentifier || 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Asset Type</Text>
                  <Text size="sm">{selectedAsset.assetType}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Augmented Care</Text>
                  <Badge 
                    color={(typeof selectedAsset.augmentedCare === 'boolean' ? selectedAsset.augmentedCare : selectedAsset.augmentedCare === 'true') ? 'blue' : 'gray'} 
                    variant="light" 
                    size="sm"
                  >
                    {(typeof selectedAsset.augmentedCare === 'boolean' ? selectedAsset.augmentedCare : selectedAsset.augmentedCare === 'true') ? 'Yes' : 'No'}
                  </Badge>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Need Flushing</Text>
                  <Badge 
                    color={(typeof selectedAsset.needFlushing === 'boolean' ? selectedAsset.needFlushing : selectedAsset.needFlushing === 'true') ? 'orange' : 'gray'} 
                    variant="light" 
                    size="sm"
                  >
                    {(typeof selectedAsset.needFlushing === 'boolean' ? selectedAsset.needFlushing : selectedAsset.needFlushing === 'true') ? 'Yes' : 'No'}
                  </Badge>
                </Grid.Col>
              </Grid>
            </div>

            <Divider />

            {/* Location Information */}
            <div>
              <Text fw={600} mb="sm" c="blue">Location Information</Text>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Wing</Text>
                  <Text size="sm">{selectedAsset.wing || 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Wing (Short)</Text>
                  <Text size="sm">{selectedAsset.wingInShort || 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Room</Text>
                  <Text size="sm">{selectedAsset.room || 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Room Name</Text>
                  <Text size="sm">{selectedAsset.roomName || 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Room Number</Text>
                  <Text size="sm">{selectedAsset.roomNo !== null && selectedAsset.roomNo !== undefined && selectedAsset.roomNo !== '' ? selectedAsset.roomNo : 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Floor</Text>
                  <Text size="sm">{selectedAsset.floor !== null && selectedAsset.floor !== undefined && selectedAsset.floor !== '' ? selectedAsset.floor : 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Floor (In Words)</Text>
                  <Text size="sm">{selectedAsset.floorInWords || 'N/A'}</Text>
                </Grid.Col>
              </Grid>
            </div>

            <Divider />

            {/* Filter Information */}
            <div>
              <Text fw={600} mb="sm" c="blue">Filter Information</Text>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Filter Needed</Text>
                  <Badge 
                    color={(typeof selectedAsset.filterNeeded === 'boolean' ? selectedAsset.filterNeeded : selectedAsset.filterNeeded === 'true') ? 'orange' : 'green'} 
                    variant="light" 
                    size="sm"
                  >
                    {(typeof selectedAsset.filterNeeded === 'boolean' ? selectedAsset.filterNeeded : selectedAsset.filterNeeded === 'true') ? 'Yes' : 'No'}
                  </Badge>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Filters On</Text>
                  <Badge 
                    color={(typeof selectedAsset.filtersOn === 'boolean' ? selectedAsset.filtersOn : (selectedAsset.filtersOn?.toString().toLowerCase() === 'true' || selectedAsset.filtersOn?.toString().toLowerCase() === 'yes')) ? 'green' : 'red'} 
                    variant="light" 
                    size="sm"
                  >
                    {(typeof selectedAsset.filtersOn === 'boolean' ? selectedAsset.filtersOn : (selectedAsset.filtersOn?.toString().toLowerCase() === 'true' || selectedAsset.filtersOn?.toString().toLowerCase() === 'yes')) ? 'Yes' : 'No'}
                  </Badge>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Filter Installed On</Text>
                  <Text size="sm">{(() => { const d = safeDate(selectedAsset.filterInstalledOn); return d ? d.toLocaleDateString('en-GB') : 'N/A'; })()}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Filter Expiry</Text>
                  <div>
                    <Text size="sm">{(() => { const d = safeDate(selectedAsset.filterExpiryDate); return d ? d.toLocaleDateString('en-GB') : 'N/A'; })()}</Text>
                    {safeDate(selectedAsset.filterExpiryDate) && (
                      <Badge 
                        color={getFilterExpiryStatus(selectedAsset.filterExpiryDate, selectedAsset.filterInstalledOn).color} 
                        variant="light" 
                        size="xs"
                        mt={4}
                      >
                        {getFilterExpiryStatus(selectedAsset.filterExpiryDate, selectedAsset.filterInstalledOn).text}
                      </Badge>
                    )}
                  </div>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Filter Type</Text>
                  <Text size="sm">{selectedAsset.filterType || 'N/A'}</Text>
                </Grid.Col>
              </Grid>
            </div>

            {selectedAsset.notes && (
              <>
                <Divider />
                <div>
                  <Text fw={600} mb="sm" c="blue">Notes</Text>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{selectedAsset.notes}</Text>
                </div>
              </>
            )}

            {/* Metadata */}
            <Divider />
            <div>
              <Text fw={600} mb="sm" c="blue">Metadata</Text>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Created</Text>
                  <Text size="sm">{selectedAsset.created ? formatTimestamp(selectedAsset.created) : 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Created By</Text>
                  <Text size="sm">{selectedAsset.createdBy || 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Modified</Text>
                  <Text size="sm">{selectedAsset.modified ? formatTimestamp(selectedAsset.modified) : 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="sm" c="dimmed">Modified By</Text>
                  <Text size="sm">{selectedAsset.modifiedBy || 'N/A'}</Text>
                </Grid.Col>
              </Grid>
                         </div>

            {selectedAsset.attachments && selectedAsset.attachments.length > 0 && (
              <>
                <Divider />
                <div>
                  <Text fw={600} mb="sm" c="blue">Attachments</Text>
                  <Stack gap="xs">
                    {selectedAsset.attachments.map((attachment, index) => (
                      <Group key={index} justify="space-between" p="sm" bg="gray.0" style={{ borderRadius: '8px' }}>
                        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                          <IconPaperclip size={16} />
                          <Text size="sm" truncate style={{ flex: 1 }}>{attachment.fileName}</Text>
                        </Group>
                        <Group gap="xs" style={{ flexShrink: 0 }}>
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="blue"
                            onClick={() => window.open(attachment.s3Url, '_blank')}
                            title="View file"
                          >
                            <IconEye size={12} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="green"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = attachment.s3Url;
                              link.download = attachment.fileName;
                              link.click();
                            }}
                            title="Download file"
                          >
                            <IconDownload size={12} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                </div>
              </>
            )}

            <Group justify="flex-end" mt="lg">
              <Button variant="outline" onClick={closeViewModal}>
                Close
              </Button>
              <Button
                onClick={() => {
                  try {
                    closeViewModal();
                    form.setValues({
                      assetBarcode: selectedAsset.assetBarcode || '',
                      primaryIdentifier: selectedAsset.primaryIdentifier || '',
                      secondaryIdentifier: selectedAsset.secondaryIdentifier || '',
                      assetType: selectedAsset.assetType || '',
                      status: selectedAsset.status || 'ACTIVE',
                      wing: selectedAsset.wing || '',
                      wingInShort: selectedAsset.wingInShort || '',
                      room: selectedAsset.room || '',
                      floor: selectedAsset.floor || '',
                      floorInWords: selectedAsset.floorInWords || '',
                      roomNo: selectedAsset.roomNo || '',
                      roomName: selectedAsset.roomName || '',
                      filterNeeded: typeof selectedAsset.filterNeeded === 'boolean' ? selectedAsset.filterNeeded : (selectedAsset.filterNeeded?.toString().toLowerCase() === 'true' || selectedAsset.filterNeeded?.toString().toLowerCase() === 'yes'),
                      filtersOn: typeof selectedAsset.filtersOn === 'boolean' ? selectedAsset.filtersOn : (selectedAsset.filtersOn?.toString().toLowerCase() === 'true' || selectedAsset.filtersOn?.toString().toLowerCase() === 'yes'),
                      filterExpiryDate: safeDate(selectedAsset.filterExpiryDate),
                      filterInstalledOn: safeDate(selectedAsset.filterInstalledOn),
                      needFlushing: typeof selectedAsset.needFlushing === 'boolean' ? selectedAsset.needFlushing : (selectedAsset.needFlushing?.toString().toLowerCase() === 'true' || selectedAsset.needFlushing?.toString().toLowerCase() === 'yes'),
                      filterType: selectedAsset.filterType || '',
                      notes: selectedAsset.notes || '',
                      augmentedCare: typeof selectedAsset.augmentedCare === 'boolean' ? selectedAsset.augmentedCare : (selectedAsset.augmentedCare?.toString().toLowerCase() === 'true' || selectedAsset.augmentedCare?.toString().toLowerCase() === 'yes'),
                    });
                    setAssetFiles([]);
                    openEditModal();
                  } catch (error) {
                    console.error('Error setting form values:', error);
                    notifications.show({
                      title: 'Error',
                      message: 'Failed to load asset data for editing',
                      color: 'red',
                      icon: <IconX size={16} />,
                    });
                  }
                }}
              >
                Edit Asset
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Audit Log Modal */}
      <Modal 
        opened={showAuditModal} 
        onClose={closeAuditModal} 
        title="Asset Audit Log" 
        size="xl"
        fullScreen
        scrollAreaComponent={ScrollArea.Autosize}
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
                  {sortedAuditLog.map((entry, index) => (
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
                                {formatTimestamp(entry.timestamp)}
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
                                          {formatValue(change.oldValue, true)}
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
                  {/* Load More Button */}
                  {auditLogPagination.hasMore && (
                    <Group justify="center" py="md">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadMoreAuditLogs}
                        loading={auditLogPagination.loading}
                        leftSection={<IconDownload size={14} />}
                      >
                        Load More Entries
                      </Button>
                    </Group>
                  )}
                  
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

      {/* Barcode Scanner */}
      <BarcodeScanner
        opened={showBarcodeScanner}
        onClose={stopBarcodeScanner}
        onScan={handleBarcodeScan}
        onError={handleScannerError}
      />

      {/* Global Audit Trail Drawer */}
      <Drawer
        opened={showAuditDrawer}
        onClose={closeAuditDrawer}
        title="System Audit Trail"
        position="right"
        size="xl"
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Recent system activities across all assets
            </Text>
            <Badge color="blue" variant="light">
              {globalAuditLog.length} entries
            </Badge>
          </Group>

          <ScrollArea h="calc(100vh - 200px)">
            <Stack gap="sm">
              {/* Real data from DynamoDB - sorted by timestamp descending */}
              {[...globalAuditLog].sort((a, b) => {
                const aTime = new Date(a.timestamp.split('Z')[0] + 'Z').getTime();
                const bTime = new Date(b.timestamp.split('Z')[0] + 'Z').getTime();
                return bTime - aTime; // Descending order (newest first)
              }).map((entry, index) => (
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
                          {entry.details?.assetName || 'Unknown Asset'}
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {formatTimestamp(entry.timestamp)}
                      </Text>
                    </Group>
                    
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">Asset:</Text>
                      <Text size="xs" fw={500}>{entry.details?.assetBarcode || 'Unknown'}</Text>
                      <Text size="xs" c="dimmed">•</Text>
                      <Text size="xs" c="dimmed">by {entry.user}</Text>
                    </Group>

                    {entry.details?.changes && entry.details.changes.length > 0 && (
                      <div>
                        <Text size="xs" fw={500} mb="xs" c="dimmed">Changes:</Text>
                        <Stack gap="xs">
                          {entry.details.changes.map((change: any, changeIndex: number) => (
                            <Paper key={changeIndex} p="xs" bg="gray.0" radius="sm">
                              <Group justify="space-between" wrap="nowrap">
                                <Text size="xs" fw={500} style={{ minWidth: '80px' }}>
                                  {getFieldDisplayName(change.field)}
                                </Text>
                                <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
                                  <Text size="xs" c="red" truncate style={{ flex: 1 }}>
                                    {formatValue(change.oldValue, true)}
                                  </Text>
                                  <Text size="xs">→</Text>
                                  <Text size="xs" c="green" truncate style={{ flex: 1 }}>
                                    {change.newValue !== null ? formatValue(change.newValue) : 'N/A'}
                                  </Text>
                                </Group>
                              </Group>
                            </Paper>
                          ))}
                        </Stack>
                      </div>
                    )}

                    {entry.action === 'DELETE' && (
                      <Paper p="xs" bg="red.0" radius="sm">
                        <Text size="xs" c="red" fw={500}>Asset permanently removed from system</Text>
                      </Paper>
                    )}
                  </Stack>
                </Card>
              ))}

              {/* Load More Button for Global Audit Log */}
              {globalAuditLogPagination.hasMore && (
                <Group justify="center" py="md">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreGlobalAuditLogs}
                    loading={globalAuditLogPagination.loading}
                    leftSection={<IconDownload size={14} />}
                  >
                    Load More Entries
                  </Button>
                </Group>
              )}
              
              {globalAuditLog.length === 0 && (
                <Group justify="center" py="xl">
                  <Stack align="center" gap="xs">
                    <IconHistory size={48} color="gray" />
                    <Text c="dimmed">No audit entries found.</Text>
                    <Text size="xs" c="dimmed">System activities will appear here as they occur.</Text>
                  </Stack>
                </Group>
              )}
            </Stack>
          </ScrollArea>

          <Group justify="space-between" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
            <Text size="xs" c="dimmed">
              Last updated: {new Date().toLocaleTimeString()}
            </Text>
            <Button 
              size="xs" 
              variant="subtle" 
              onClick={() => fetchGlobalAuditLogs()}
              leftSection={<IconRefresh size={14} />}
            >
              Refresh
            </Button>
          </Group>
        </Stack>
      </Drawer>

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
    </ProtectedRoute>
  );
}
