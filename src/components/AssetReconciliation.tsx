'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Title,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  Table,
  TextInput,
  ActionIcon,
  Loader,
  Paper,
  Progress,
  Container,
  Select,
  Tooltip,
  Alert,
  Checkbox,
  Modal,
  Grid
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconRefresh,
  IconSearch,
  IconBarcode,
  IconMapPin,
  IconCalendar,
  IconInfoCircle,
  IconExclamationMark,
  IconTrash
} from '@tabler/icons-react';

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
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;
}

interface ReconciliationItem {
  spListItem: SPListItem;
  matchedAsset?: Asset;
  isLocationMatch: boolean;
  isBarcodeMatch: boolean;
  userConfirmed: boolean;
  selectedBarcode?: string;
  reconciliationStatus: 'pending' | 'confirmed' | 'mismatch' | 'not_found';
}

export default function AssetReconciliation() {
  const [spListItems, setSPListItems] = useState<SPListItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [reconciliationItems, setReconciliationItems] = useState<ReconciliationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [confirmModalOpened, { open: openConfirmModal, close: closeConfirmModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [selectedItem, setSelectedItem] = useState<ReconciliationItem | null>(null);
  const [selectedItemForDelete, setSelectedItemForDelete] = useState<ReconciliationItem | null>(null);
  const [processing, setProcessing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [showReconciled, setShowReconciled] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Refetch data when date range changes
  useEffect(() => {
    if (dateRange[0] && dateRange[1]) {
      try {
        const startDate = dateRange[0] instanceof Date ? dateRange[0] : new Date(dateRange[0]);
        const endDate = dateRange[1] instanceof Date ? dateRange[1] : new Date(dateRange[1]);
        
        // Only fetch if both dates are valid
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          fetchData();
        }
      } catch (error) {
        console.error('Error validating date range:', error);
      }
    }
  }, [dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Build SPListItems URL with date range if provided
      let spListUrl = '/api/splist-items';
      const params = new URLSearchParams();
      
      if (dateRange[0] && dateRange[1]) {
        try {
          const startDate = dateRange[0] instanceof Date ? dateRange[0] : new Date(dateRange[0]);
          const endDate = dateRange[1] instanceof Date ? dateRange[1] : new Date(dateRange[1]);
          
          // Check if dates are valid
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            params.append('startDate', startDate.toISOString().split('T')[0]);
            params.append('endDate', endDate.toISOString().split('T')[0]);
          } else {
            params.append('period', 'all');
          }
        } catch (error) {
          console.error('Error parsing date range:', error);
          params.append('period', 'all');
        }
      } else {
        params.append('period', 'all');
      }
      
      spListUrl += '?' + params.toString();
      
      // Fetch SPListItems and Assets in parallel
      const [spListResponse, assetsResponse] = await Promise.all([
        fetch(spListUrl),
        fetch('/api/assets')
      ]);

      if (!spListResponse.ok || !assetsResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const spListData = await spListResponse.json();
      const assetsData = await assetsResponse.json();

      if (spListData.success && assetsData.success) {
        const spItems = spListData.data.items || [];
        const assetItems = assetsData.data.items || assetsData.data.assets || [];
        
        setSPListItems(spItems);
        setAssets(assetItems);
        
        // Create reconciliation items (but don't auto-process them)
        createReconciliationItems(spItems, assetItems);
      } else {
        throw new Error('API returned unsuccessful response');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch reconciliation data',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const createReconciliationItems = (spItems: SPListItem[], assetItems: Asset[]) => {
    const reconciliationData: ReconciliationItem[] = spItems
      .filter(spItem => {
        // Filter out already reconciled items unless user wants to see them
        if (!showReconciled && spItem.reconciliationStatus === 'synced') {
          return false;
        }
        return true;
      })
      .map(spItem => {
        // Try to find matching asset by barcode first
        let matchedAsset = spItem.AssetBarcode ? 
          assetItems.find(asset => asset.assetBarcode === spItem.AssetBarcode) : 
          undefined;

        // If no barcode match, try to find by location similarity
        if (!matchedAsset) {
          matchedAsset = assetItems.find(asset => {
            // Simple location matching - you can make this more sophisticated
            const spLocation = spItem.Location?.toLowerCase() || '';
            const assetWing = asset.wing?.toLowerCase() || '';
            const assetRoom = asset.room?.toLowerCase() || '';
            const assetRoomName = asset.roomName?.toLowerCase() || '';
            const assetLocation = `${assetWing}-${assetRoom}`;
            
            return spLocation.includes(assetWing) || 
                   assetLocation.includes(spLocation) ||
                   assetRoomName.includes(spLocation);
          });
        }

        const isBarcodeMatch = spItem.AssetBarcode ? 
          (matchedAsset?.assetBarcode === spItem.AssetBarcode) : false;
        
        const isLocationMatch = matchedAsset ? 
          checkLocationMatch(spItem, matchedAsset) : false;

        // Manual reconciliation - don't auto-confirm anything
        let status: 'pending' | 'confirmed' | 'mismatch' | 'not_found' = 'pending';
        if (spItem.reconciliationStatus === 'synced') {
          status = 'confirmed'; // Already reconciled
        } else if (!matchedAsset) {
          status = 'not_found';
        } else if (!isBarcodeMatch || !isLocationMatch) {
          status = 'mismatch';
        }

        return {
          spListItem: spItem,
          matchedAsset,
          isLocationMatch,
          isBarcodeMatch,
          userConfirmed: spItem.reconciliationStatus === 'synced',
          selectedBarcode: spItem.AssetBarcode || matchedAsset?.assetBarcode,
          reconciliationStatus: status
        };
      });

    setReconciliationItems(reconciliationData);
  };

  const checkLocationMatch = (spItem: SPListItem, asset: Asset): boolean => {
    const spLocation = spItem.Location?.toLowerCase() || '';
    const assetWing = asset.wing?.toLowerCase() || '';
    const assetRoom = asset.room?.toLowerCase() || '';
    const assetRoomName = asset.roomName?.toLowerCase() || '';
    
    return spLocation.includes(assetWing) || 
           assetRoom.includes(spLocation) ||
           assetRoomName.includes(spLocation) ||
           spLocation.includes(assetRoom);
  };

  const handleBarcodeChange = (itemId: string, newBarcode: string) => {
    setReconciliationItems(prev => prev.map(item => {
      if (item.spListItem.id === itemId) {
        // Find asset with new barcode
        const newMatchedAsset = assets.find(asset => asset.assetBarcode === newBarcode);
        const isBarcodeMatch = newMatchedAsset?.assetBarcode === newBarcode;
        const isLocationMatch = newMatchedAsset ? checkLocationMatch(item.spListItem, newMatchedAsset) : false;
        
        let status: 'pending' | 'confirmed' | 'mismatch' | 'not_found' = 'pending';
        if (!newMatchedAsset) {
          status = 'not_found';
        } else if (isBarcodeMatch && isLocationMatch) {
          status = 'confirmed';
        } else if (!isBarcodeMatch || !isLocationMatch) {
          status = 'mismatch';
        }

        return {
          ...item,
          matchedAsset: newMatchedAsset,
          selectedBarcode: newBarcode,
          isBarcodeMatch,
          isLocationMatch,
          userConfirmed: false,
          reconciliationStatus: status
        };
      }
      return item;
    }));
  };

  const handleConfirmItem = (item: ReconciliationItem) => {
    setSelectedItem(item);
    openConfirmModal();
  };

  const handleDeleteItem = (item: ReconciliationItem) => {
    setSelectedItemForDelete(item);
    openDeleteModal();
  };

  const confirmDeleteItem = async () => {
    if (!selectedItemForDelete) return;

    try {
      setDeleting(true);
      
      // Delete the SPListItem
      const response = await fetch('/api/splist-items', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedItemForDelete.spListItem.id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete SPListItem');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete SPListItem');
      }

      // Remove the item from local state
      setReconciliationItems(prev => 
        prev.filter(item => item.spListItem.id !== selectedItemForDelete.spListItem.id)
      );

      // Also remove from SPListItems state
      setSPListItems(prev => 
        prev.filter(item => item.id !== selectedItemForDelete.spListItem.id)
      );

      // Log audit entry for deletion
      try {
        await fetch('/api/log-audit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assetId: selectedItemForDelete.matchedAsset?.id || 'N/A',
            user: 'Filter Reconciliation System',
            action: 'DELETE_SPLIST_ITEM',
            details: {
              spListItemId: selectedItemForDelete.spListItem.id,
              spListLocation: selectedItemForDelete.spListItem.Location,
              assetBarcode: selectedItemForDelete.spListItem.AssetBarcode || 'N/A',
              filterInstalledDate: selectedItemForDelete.spListItem.FilterInstalledDate,
                                  reason: 'Deleted via Filter Reconciliation interface'
            }
          }),
        });
      } catch (auditError) {
        console.error('Failed to log audit entry for deletion:', auditError);
        // Don't fail the deletion if audit logging fails
      }

      notifications.show({
        title: 'Success',
        message: 'SPListItem record deleted successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      closeDeleteModal();
    } catch (error) {
      console.error('Error deleting SPListItem:', error);
      notifications.show({
        title: 'Error',
        message: `Failed to delete record: ${error instanceof Error ? error.message : 'Unknown error'}`,
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all reconcilable items (those with matched assets and not already synced)
      const reconcilableIds = filteredItems
        .filter(item => 
          item.matchedAsset && 
          item.spListItem.reconciliationStatus !== 'synced' &&
          item.selectedBarcode
        )
        .map(item => item.spListItem.id);
      setSelectedItems(new Set(reconcilableIds));
    } else {
      setSelectedItems(new Set());
    }
  };

  const bulkReconcileItems = async () => {
    const itemsToReconcile = filteredItems.filter(item => 
      selectedItems.has(item.spListItem.id) && 
      item.matchedAsset &&
      item.spListItem.reconciliationStatus !== 'synced'
    );

    if (itemsToReconcile.length === 0) {
      notifications.show({
        title: 'No Items Selected',
        message: 'Please select items to reconcile',
        color: 'orange',
        icon: <IconExclamationMark size={16} />,
      });
      return;
    }

    setBulkProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const item of itemsToReconcile) {
        try {
          // Calculate filter expiry date (3 months from installation date)
          const calculateFilterExpiry = (installedDate: string): string => {
            const installed = new Date(installedDate);
            const expiry = new Date(installed);
            expiry.setMonth(expiry.getMonth() + 3);
            
            // Handle edge cases where the day doesn't exist in the target month
            const originalDay = installed.getDate();
            if (expiry.getDate() !== originalDay) {
              expiry.setDate(1);
            }
            
            return expiry.toISOString().split('T')[0];
          };

          // Update the asset with SPListItem data
          const updateData = {
            ...item.matchedAsset,
            filterInstalledOn: item.spListItem.FilterInstalledDate,
            filterExpiryDate: calculateFilterExpiry(item.spListItem.FilterInstalledDate),
            filterType: item.spListItem.FilterType || item.matchedAsset.filterType,
            filtersOn: true,
            filterNeeded: true,
            modifiedBy: 'Filter Reconciliation System',
          };

          // Update asset and SPListItem in parallel
          const [assetResponse, spListResponse] = await Promise.all([
            fetch(`/api/assets/${item.matchedAsset.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updateData),
            }),
            fetch('/api/splist-items', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                id: item.spListItem.id,
                reconciliationStatus: 'synced',
                reconciledBy: 'Filter Reconciliation System (Bulk)'
              }),
            })
          ]);

          if (assetResponse.ok && spListResponse.ok) {
            const [assetResult, spListResult] = await Promise.all([
              assetResponse.json(),
              spListResponse.json()
            ]);

            if (assetResult.success && spListResult.success) {
              successCount++;
              
              // Log audit entry for this item
              try {
                const auditChanges = [
                  {
                    field: 'filterInstalledOn',
                    oldValue: item.matchedAsset.filterInstalledOn || 'Not set',
                    newValue: item.spListItem.FilterInstalledDate
                  },
                  {
                    field: 'filterExpiryDate', 
                    oldValue: item.matchedAsset.filterExpiryDate || 'Not set',
                    newValue: calculateFilterExpiry(item.spListItem.FilterInstalledDate)
                  },
                  {
                    field: 'filterType',
                    oldValue: item.matchedAsset.filterType || 'Not set',
                    newValue: item.spListItem.FilterType || item.matchedAsset.filterType
                  },
                  {
                    field: 'filtersOn',
                    oldValue: item.matchedAsset.filtersOn?.toString() || 'false',
                    newValue: 'true'
                  },
                  {
                    field: 'reconciliationStatus',
                    oldValue: 'Not synced',
                    newValue: 'Synced via Bulk Filter Reconciliation'
                  }
                ];

                await fetch('/api/log-audit', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    assetId: item.matchedAsset.id,
                    user: 'Filter Reconciliation System (Bulk)',
                    action: 'BULK_RECONCILIATION',
                    details: {
                      assetBarcode: item.matchedAsset.assetBarcode,
                      assetName: item.matchedAsset.primaryIdentifier || 'Unknown',
                      spListItemId: item.spListItem.id,
                      spListLocation: item.spListItem.Location,
                      changes: auditChanges
                    }
                  }),
                });
              } catch (auditError) {
                console.error(`Failed to log audit entry for item ${item.spListItem.id}:`, auditError);
                // Don't fail the reconciliation if audit logging fails
              }
            } else {
              errorCount++;
            }
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error(`Error reconciling item ${item.spListItem.id}:`, error);
          errorCount++;
        }
      }

      // Update local state for successfully reconciled items
      setReconciliationItems(prev => prev.map(item => 
        selectedItems.has(item.spListItem.id) && item.matchedAsset
          ? { 
              ...item, 
              userConfirmed: true, 
              reconciliationStatus: 'confirmed' as const,
              spListItem: {
                ...item.spListItem,
                reconciliationStatus: 'synced',
                reconciliationTimestamp: new Date().toISOString(),
                reconciledBy: 'Filter Reconciliation System (Bulk)'
              }
            }
          : item
      ));

      // Clear selections
      setSelectedItems(new Set());

      // Show results
      notifications.show({
        title: 'Bulk Reconciliation Complete',
        message: `Successfully reconciled ${successCount} items${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        color: errorCount > 0 ? 'yellow' : 'green',
        icon: <IconCheck size={16} />,
      });

    } catch (error) {
      console.error('Error in bulk reconciliation:', error);
      notifications.show({
        title: 'Bulk Reconciliation Failed',
        message: 'An error occurred during bulk reconciliation',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setBulkProcessing(false);
    }
  };

  const confirmReconciliation = async () => {
    if (!selectedItem || !selectedItem.matchedAsset) return;

    try {
      setProcessing(true);
      
      // Calculate filter expiry date (3 months from installation date)
      const calculateFilterExpiry = (installedDate: string): string => {
        const installed = new Date(installedDate);
        const expiry = new Date(installed);
        expiry.setMonth(expiry.getMonth() + 3);
        
        // Handle edge cases where the day doesn't exist in the target month
        const originalDay = installed.getDate();
        if (expiry.getDate() !== originalDay) {
          expiry.setDate(1);
        }
        
        return expiry.toISOString().split('T')[0];
      };

      // Update the asset with SPListItem data
      const updateData = {
        ...selectedItem.matchedAsset,
        filterInstalledOn: selectedItem.spListItem.FilterInstalledDate,
        filterExpiryDate: calculateFilterExpiry(selectedItem.spListItem.FilterInstalledDate),
        filterType: selectedItem.spListItem.FilterType || selectedItem.matchedAsset.filterType,
        filtersOn: true,
        filterNeeded: true,
        modifiedBy: 'Filter Reconciliation System',
      };

      // Update asset in parallel with SPListItem reconciliation status
      const [assetResponse, spListResponse] = await Promise.all([
        fetch(`/api/assets/${selectedItem.matchedAsset.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        }),
        fetch('/api/splist-items', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: selectedItem.spListItem.id,
            reconciliationStatus: 'synced',
            reconciledBy: 'Filter Reconciliation System'
          }),
        })
      ]);

      if (!assetResponse.ok || !spListResponse.ok) {
        throw new Error('Failed to update asset or SPListItem');
      }

      const [assetResult, spListResult] = await Promise.all([
        assetResponse.json(),
        spListResponse.json()
      ]);

      if (!assetResult.success || !spListResult.success) {
        throw new Error(assetResult.error || spListResult.error || 'Failed to update records');
      }

      // Log the reconciliation action to audit trail
      const auditChanges = [
        {
          field: 'filterInstalledOn',
          oldValue: selectedItem.matchedAsset.filterInstalledOn || 'Not set',
          newValue: selectedItem.spListItem.FilterInstalledDate
        },
        {
          field: 'filterExpiryDate', 
          oldValue: selectedItem.matchedAsset.filterExpiryDate || 'Not set',
          newValue: calculateFilterExpiry(selectedItem.spListItem.FilterInstalledDate)
        },
        {
          field: 'filterType',
          oldValue: selectedItem.matchedAsset.filterType || 'Not set',
          newValue: selectedItem.spListItem.FilterType || selectedItem.matchedAsset.filterType
        },
        {
          field: 'filtersOn',
          oldValue: selectedItem.matchedAsset.filtersOn?.toString() || 'false',
          newValue: 'true'
        },
        {
          field: 'reconciliationStatus',
          oldValue: 'Not synced',
          newValue: 'Synced via Filter Reconciliation'
        }
      ];

      // Log audit entry
      try {
        await fetch('/api/log-audit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assetId: selectedItem.matchedAsset.id,
            user: 'Filter Reconciliation System',
            action: 'RECONCILIATION',
            details: {
              assetBarcode: selectedItem.matchedAsset.assetBarcode,
              assetName: selectedItem.matchedAsset.primaryIdentifier || 'Unknown',
              spListItemId: selectedItem.spListItem.id,
              spListLocation: selectedItem.spListItem.Location,
              changes: auditChanges
            }
          }),
        });
      } catch (auditError) {
        console.error('Failed to log audit entry:', auditError);
        // Don't fail the reconciliation if audit logging fails
      }

      // Update local state
      setReconciliationItems(prev => prev.map(item => 
        item.spListItem.id === selectedItem.spListItem.id 
          ? { 
              ...item, 
              userConfirmed: true, 
              reconciliationStatus: 'confirmed' as const,
              spListItem: {
                ...item.spListItem,
                reconciliationStatus: 'synced',
                reconciliationTimestamp: new Date().toISOString(),
                reconciledBy: 'Filter Reconciliation System'
              }
            }
          : item
      ));

      notifications.show({
        title: 'Success',
        message: 'Filter reconciled successfully and marked as synced',
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      closeConfirmModal();
    } catch (error) {
      console.error('Error confirming reconciliation:', error);
      notifications.show({
        title: 'Error',
        message: `Failed to reconcile filter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'green';
      case 'mismatch': return 'yellow';
      case 'not_found': return 'red';
      default: return 'blue';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Ready to Confirm';
      case 'mismatch': return 'Needs Review';
      case 'not_found': return 'Asset Not Found';
      default: return 'Pending';
    }
  };

  // Filter items based on search and status
  const filteredItems = reconciliationItems.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.spListItem.Location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.spListItem.AssetBarcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.matchedAsset?.assetBarcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.matchedAsset?.primaryIdentifier?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = selectedStatus === 'all' || item.reconciliationStatus === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: reconciliationItems.length,
    synced: reconciliationItems.filter(item => item.spListItem.reconciliationStatus === 'synced').length,
    confirmed: reconciliationItems.filter(item => item.reconciliationStatus === 'confirmed').length,
    mismatch: reconciliationItems.filter(item => item.reconciliationStatus === 'mismatch').length,
    notFound: reconciliationItems.filter(item => item.reconciliationStatus === 'not_found').length,
    pending: reconciliationItems.filter(item => item.reconciliationStatus === 'pending').length,
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Group justify="center">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={2}>Filter Reconciliation</Title>
            <Text size="sm" c="dimmed">
              Reconcile SPListItems data with Main Asset register
            </Text>
          </div>
          <Button leftSection={<IconRefresh size={16} />} onClick={fetchData}>
            Refresh Data
          </Button>
        </Group>

        {/* Date Range Filter */}
        <Card withBorder p="md">
          <Group>
            <DatePickerInput
              type="range"
              label="Filter Date Range"
              placeholder="Select date range for filter installation"
              value={dateRange}
              onChange={setDateRange}
              clearable
              style={{ minWidth: 300 }}
            />
            <Checkbox
              label="Show already reconciled items"
              checked={showReconciled}
              onChange={(event) => {
                setShowReconciled(event.currentTarget.checked);
                // Refresh data to apply filter
                createReconciliationItems(spListItems, assets);
              }}
              mt="xl"
            />
            <Button 
              leftSection={<IconRefresh size={16} />} 
              onClick={fetchData}
              variant="outline"
              mt="xl"
            >
              Refresh
            </Button>
          </Group>
        </Card>

        {/* Stats Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
            <Paper p="md" withBorder>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total Items</Text>
              <Text size="xl" fw={700}>{stats.total}</Text>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
            <Paper p="md" withBorder>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Already Synced</Text>
              <Text size="xl" fw={700} c="teal">{stats.synced}</Text>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
            <Paper p="md" withBorder>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Ready to Confirm</Text>
              <Text size="xl" fw={700} c="green">{stats.confirmed}</Text>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
            <Paper p="md" withBorder>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Needs Review</Text>
              <Text size="xl" fw={700} c="yellow">{stats.mismatch}</Text>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
            <Paper p="md" withBorder>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Not Found</Text>
              <Text size="xl" fw={700} c="red">{stats.notFound}</Text>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
            <Paper p="md" withBorder>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Pending</Text>
              <Text size="xl" fw={700} c="blue">{stats.pending}</Text>
            </Paper>
          </Grid.Col>
        </Grid>

        {/* Progress Bar */}
        <Card withBorder p="md">
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>Reconciliation Progress</Text>
            <Text size="sm" c="dimmed">
              {stats.synced} of {stats.total} synced ({Math.round(stats.total > 0 ? (stats.synced / stats.total) * 100 : 0)}%)
            </Text>
          </Group>
          <Progress value={stats.total > 0 ? (stats.synced / stats.total) * 100 : 0} color="teal" />
        </Card>

        {/* Filters */}
        <Card withBorder p="md">
          <Group>
            <TextInput
              placeholder="Search by location, barcode, or asset name..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="Filter by status"
              value={selectedStatus}
              onChange={(value) => setSelectedStatus(value || 'all')}
              data={[
                { value: 'all', label: 'All Status' },
                { value: 'confirmed', label: 'Ready to Confirm' },
                { value: 'mismatch', label: 'Needs Review' },
                { value: 'not_found', label: 'Asset Not Found' },
                { value: 'pending', label: 'Pending' },
              ]}
              w={200}
            />
          </Group>
        </Card>

        {/* Bulk Actions */}
        {selectedItems.size > 0 && (
          <Card withBorder p="md" style={{ backgroundColor: '#f8f9fa' }}>
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
              </Text>
              <Group>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedItems(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  color="green"
                  size="sm"
                  onClick={bulkReconcileItems}
                  loading={bulkProcessing}
                  leftSection={<IconCheck size={16} />}
                >
                  Bulk Reconcile Selected
                </Button>
              </Group>
            </Group>
          </Card>
        )}

        {/* Reconciliation Table */}
        <Card withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <Checkbox
                    checked={
                      filteredItems.filter(item => 
                        item.matchedAsset && 
                        item.spListItem.reconciliationStatus !== 'synced' &&
                        item.selectedBarcode
                      ).length > 0 &&
                      filteredItems
                        .filter(item => 
                          item.matchedAsset && 
                          item.spListItem.reconciliationStatus !== 'synced' &&
                          item.selectedBarcode
                        )
                        .every(item => selectedItems.has(item.spListItem.id))
                    }
                    indeterminate={
                      selectedItems.size > 0 && 
                      !filteredItems
                        .filter(item => 
                          item.matchedAsset && 
                          item.spListItem.reconciliationStatus !== 'synced' &&
                          item.selectedBarcode
                        )
                        .every(item => selectedItems.has(item.spListItem.id))
                    }
                    onChange={(event) => handleSelectAll(event.currentTarget.checked)}
                  />
                </Table.Th>
                <Table.Th>SPList Location</Table.Th>
                <Table.Th>Filter Date</Table.Th>
                <Table.Th>SPList Barcode</Table.Th>
                <Table.Th>Asset Barcode</Table.Th>
                <Table.Th>Asset Location</Table.Th>
                <Table.Th>Match Status</Table.Th>
                <Table.Th>Reconciliation Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredItems.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={9} ta="center" py="xl">
                    <Text c="dimmed">No reconciliation items found</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredItems.map((item) => (
                <Table.Tr key={item.spListItem.id}>
                  <Table.Td>
                    <Checkbox
                      checked={selectedItems.has(item.spListItem.id)}
                      onChange={(event) => handleSelectItem(item.spListItem.id, event.currentTarget.checked)}
                      disabled={
                        !item.matchedAsset || 
                        item.spListItem.reconciliationStatus === 'synced' ||
                        !item.selectedBarcode
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <IconMapPin size={14} />
                      <Text size="sm" fw={500}>
                        {item.spListItem.Location || 'Unknown Location'}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <IconCalendar size={14} />
                      <Text size="sm">
                        {item.spListItem.FilterInstalledDate ? 
                          new Date(item.spListItem.FilterInstalledDate).toLocaleDateString('en-GB') : 
                          'No date'
                        }
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      size="xs"
                      value={item.spListItem.AssetBarcode || ''}
                      placeholder="No barcode"
                      readOnly
                      leftSection={<IconBarcode size={14} />}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      size="xs"
                      value={item.selectedBarcode || ''}
                      onChange={(e) => handleBarcodeChange(item.spListItem.id, e.currentTarget.value)}
                      placeholder="Enter barcode"
                      leftSection={<IconBarcode size={14} />}
                      style={{
                        backgroundColor: item.isBarcodeMatch ? '#e6ffed' : 
                                       item.selectedBarcode && !item.isBarcodeMatch ? '#ffe6e6' : undefined
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    {item.matchedAsset ? (
                      <Text size="sm">
                        {item.matchedAsset.wing || 'Unknown Wing'} - {item.matchedAsset.roomName || 'Unknown Room'}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">Not found</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Stack gap="xs">
                      <Badge 
                        color={getStatusColor(item.reconciliationStatus)} 
                        variant="light"
                        size="sm"
                      >
                        {getStatusText(item.reconciliationStatus)}
                      </Badge>
                      {item.matchedAsset && (
                        <Group gap={4}>
                          <Badge 
                            size="xs" 
                            color={item.isBarcodeMatch ? 'green' : 'red'}
                            variant="dot"
                          >
                            Barcode: {item.isBarcodeMatch ? 'Match' : 'Mismatch'}
                          </Badge>
                          <Badge 
                            size="xs" 
                            color={item.isLocationMatch ? 'green' : 'orange'}
                            variant="dot"
                          >
                            Location: {item.isLocationMatch ? 'Match' : 'Similar'}
                          </Badge>
                        </Group>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap="xs">
                      <Badge 
                        color={
                          item.spListItem.reconciliationStatus === 'synced' ? 'teal' :
                          item.spListItem.reconciliationStatus === 'failed' ? 'red' : 'gray'
                        } 
                        variant="light"
                        size="sm"
                      >
                        {item.spListItem.reconciliationStatus === 'synced' ? 'Synced' :
                         item.spListItem.reconciliationStatus === 'failed' ? 'Failed' : 'Not Synced'}
                      </Badge>
                      {item.spListItem.reconciliationTimestamp && (
                        <Text size="xs" c="dimmed">
                          {new Date(item.spListItem.reconciliationTimestamp).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Text>
                      )}
                      {item.spListItem.reconciledBy && (
                        <Text size="xs" c="dimmed">
                          By: {item.spListItem.reconciledBy}
                        </Text>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {item.matchedAsset && !item.userConfirmed && item.spListItem.reconciliationStatus !== 'synced' && (
                        <Button
                          size="xs"
                          color={item.reconciliationStatus === 'confirmed' ? 'green' : 'blue'}
                          onClick={() => handleConfirmItem(item)}
                          disabled={!item.selectedBarcode}
                        >
                          {item.reconciliationStatus === 'confirmed' ? 'Confirm Sync' : 'Force Sync'}
                        </Button>
                      )}
                      {item.spListItem.reconciliationStatus === 'synced' && (
                        <Badge color="teal" variant="filled" size="sm">
                          <IconCheck size={12} style={{ marginRight: 4 }} />
                          Already Synced
                        </Badge>
                      )}
                      {!item.matchedAsset && (
                        <Text size="xs" c="dimmed">No asset found</Text>
                      )}
                      
                      {/* Delete button - always available */}
                      <Tooltip label="Delete this SPListItem record">
                        <ActionIcon
                          size="sm"
                          color="red"
                          variant="light"
                          onClick={() => handleDeleteItem(item)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>


        </Card>

        {/* Confirmation Modal */}
        <Modal
          opened={confirmModalOpened}
          onClose={closeConfirmModal}
          title="Confirm Filter Reconciliation"
          size="lg"
        >
          {selectedItem && (
            <Stack gap="md">
              <Alert icon={<IconInfoCircle size={16} />} color="blue">
                You are about to update the asset register with SPListItem data.
              </Alert>

              <Grid>
                <Grid.Col span={6}>
                  <Paper p="md" withBorder>
                    <Title order={6} mb="xs">SPListItem Data</Title>
                    <Stack gap="xs">
                      <Text size="sm"><strong>Location:</strong> {selectedItem.spListItem.Location}</Text>
                      <Text size="sm"><strong>Filter Date:</strong> {new Date(selectedItem.spListItem.FilterInstalledDate).toLocaleDateString('en-GB')}</Text>
                      <Text size="sm"><strong>Filter Type:</strong> {selectedItem.spListItem.FilterType || 'Not specified'}</Text>
                      <Text size="sm"><strong>Barcode:</strong> {selectedItem.spListItem.AssetBarcode || 'Not specified'}</Text>
                    </Stack>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Paper p="md" withBorder>
                    <Title order={6} mb="xs">Asset Data</Title>
                    {selectedItem.matchedAsset && (
                      <Stack gap="xs">
                        <Text size="sm"><strong>Asset:</strong> {selectedItem.matchedAsset.primaryIdentifier}</Text>
                        <Text size="sm"><strong>Location:</strong> {selectedItem.matchedAsset.wing} - {selectedItem.matchedAsset.roomName}</Text>
                        <Text size="sm"><strong>Barcode:</strong> {selectedItem.matchedAsset.assetBarcode}</Text>
                        <Text size="sm"><strong>Current Filter:</strong> {selectedItem.matchedAsset.filterType || 'None'}</Text>
                      </Stack>
                    )}
                  </Paper>
                </Grid.Col>
              </Grid>

              <Group justify="flex-end">
                <Button variant="outline" onClick={closeConfirmModal}>
                  Cancel
                </Button>
                <Button 
                  color="green" 
                  onClick={confirmReconciliation}
                  loading={processing}
                >
                  Confirm Filter Reconciliation
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          opened={deleteModalOpened}
          onClose={closeDeleteModal}
          title="Delete SPListItem Record"
          size="md"
          centered
        >
          {selectedItemForDelete && (
            <Stack gap="md">
              <Alert icon={<IconAlertTriangle size={16} />} color="red">
                <strong>Warning:</strong> This action cannot be undone. You are about to permanently delete this SPListItem record.
              </Alert>

              <Paper p="md" withBorder>
                <Title order={6} mb="xs">Record to Delete</Title>
                <Stack gap="xs">
                  <Text size="sm"><strong>Location:</strong> {selectedItemForDelete.spListItem.Location}</Text>
                  <Text size="sm"><strong>Filter Date:</strong> {new Date(selectedItemForDelete.spListItem.FilterInstalledDate).toLocaleDateString('en-GB')}</Text>
                  <Text size="sm"><strong>Filter Type:</strong> {selectedItemForDelete.spListItem.FilterType || 'Not specified'}</Text>
                  <Text size="sm"><strong>Barcode:</strong> {selectedItemForDelete.spListItem.AssetBarcode || 'Not specified'}</Text>
                  <Text size="sm"><strong>Status:</strong> {selectedItemForDelete.spListItem.reconciliationStatus || 'Not synced'}</Text>
                </Stack>
              </Paper>

              <Group justify="flex-end">
                <Button variant="outline" onClick={closeDeleteModal}>
                  Cancel
                </Button>
                <Button 
                  color="red" 
                  onClick={confirmDeleteItem}
                  loading={deleting}
                  leftSection={<IconTrash size={16} />}
                >
                  Delete Record
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
      </Stack>
    </Container>
  );
}