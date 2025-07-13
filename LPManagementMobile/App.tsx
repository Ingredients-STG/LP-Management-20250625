import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';

interface Asset {
  id: string;
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
  filterNeeded: boolean;
  filtersOn: boolean;
  filterExpiryDate: string;
  filterInstalledOn: string;
  filterType: string;
  needFlushing: boolean;
  notes: string;
  augmentedCare: boolean;
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;
}

interface DashboardStats {
  totalAssets: number;
  availableAssets: number;
  inUseAssets: number;
  maintenanceAssets: number;
  recentAssets: Asset[];
}

// API Configuration - production only
const API_BASE_URL = 'https://d25j5qt77sjegi.amplifyapp.com/api';

// Debug function to test API connectivity
const testApiConnection = async (url: string) => {
  try {
    console.log('Testing API connection to:', url);
    const response = await fetch(`${url}/assets`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('API Response status:', response.status);
    return response.ok;
  } catch (error) {
    console.error('API Connection test failed:', error);
    return false;
  }
};

// Function to get working API URL
const getWorkingApiUrl = async () => {
  // Try production URL
  if (await testApiConnection(API_BASE_URL)) {
    console.log('Using production API URL');
    return API_BASE_URL;
  }
  
  throw new Error('Production API is not available. Please check the deployment status.');
};

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string>(API_BASE_URL);

  const fetchAssets = async () => {
    try {
      setError(null);
      console.log('Fetching assets from:', `${apiUrl}/assets`);
      
      const response = await fetch(`${apiUrl}/assets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setAssets(result.data.items || []);
        console.log(`Successfully fetched ${result.data.items?.length || 0} assets`);
      } else {
        throw new Error(result.error || 'Failed to fetch assets');
      }
    } catch (err) {
      console.error('Error fetching assets:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch assets';
      setError(`Network Error: ${errorMessage}. Please check your connection and try again.`);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      console.log('Fetching dashboard stats from:', `${apiUrl}/dashboard`);
      
      const response = await fetch(`${apiUrl}/dashboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setDashboardStats(result.data);
        console.log('Successfully fetched dashboard stats');
      } else {
        throw new Error(result.error || 'Failed to fetch dashboard stats');
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      // Don't set error for dashboard stats as it's not critical
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchAssets(), fetchDashboardStats()]);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAssets(), fetchDashboardStats()]);
    setRefreshing(false);
  };

  useEffect(() => {
    const initializeApp = async () => {
      console.log('App starting...');
      console.log('Development mode:', __DEV__);
      
      try {
        // Get working API URL
        const workingUrl = await getWorkingApiUrl();
        setApiUrl(workingUrl);
        console.log('Using API URL:', workingUrl);
        
        // Load data with working URL
        await loadData();
      } catch (error) {
        console.error('Failed to find working API:', error);
        setError('Unable to connect to any server. Please check your internet connection and try again.');
        setLoading(false);
      }
    };
    
    initializeApp();
  }, []);

  const handleScanAsset = () => {
    Alert.alert('Scan Asset', 'Barcode scanner functionality will be implemented here');
  };

  const handleAddAsset = () => {
    Alert.alert('Add Asset', 'Add new asset form will be implemented here');
  };

  const handleViewAssets = () => {
    Alert.alert('View Assets', `Total assets: ${assets.length}`);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
        return styles.statusAvailable;
      case 'in use':
        return styles.statusInUse;
      case 'maintenance':
        return styles.statusMaintenance;
      default:
        return styles.statusAvailable;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getAssetDisplayName = (asset: Asset) => {
    return asset.primaryIdentifier || asset.assetBarcode || 'Unnamed Asset';
  };

  const getAssetLocation = (asset: Asset) => {
    const parts = [];
    if (asset.wing) parts.push(asset.wing);
    if (asset.floor) parts.push(asset.floor);
    if (asset.room) parts.push(asset.room);
    return parts.join(', ') || 'Location not specified';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading LP Management...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LP Management</Text>
        <Text style={styles.headerSubtitle}>Asset Management System</Text>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleScanAsset}>
              <Text style={styles.actionButtonText}>📱 Scan Asset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleAddAsset}>
              <Text style={styles.actionButtonText}>➕ Add Asset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleViewAssets}>
              <Text style={styles.actionButtonText}>📋 View All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Assets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Assets</Text>
          {assets.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No assets found</Text>
              <Text style={styles.emptyStateSubtext}>Add your first asset to get started</Text>
            </View>
          ) : (
            assets.slice(0, 5).map((asset) => (
              <View key={asset.id} style={styles.assetCard}>
                <View style={styles.assetHeader}>
                  <Text style={styles.assetName}>{getAssetDisplayName(asset)}</Text>
                  <View style={[styles.statusBadge, getStatusColor(asset.status)]}>
                    <Text style={styles.statusText}>{asset.status}</Text>
                  </View>
                </View>
                <Text style={styles.assetLocation}>📍 {getAssetLocation(asset)}</Text>
                <Text style={styles.assetDate}>Updated: {formatDate(asset.modified)}</Text>
                {asset.assetBarcode && (
                  <Text style={styles.assetBarcode}>Barcode: {asset.assetBarcode}</Text>
                )}
              </View>
            ))
          )}
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{assets.length}</Text>
              <Text style={styles.statLabel}>Total Assets</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {assets.filter(a => a.status.toLowerCase() === 'available').length}
              </Text>
              <Text style={styles.statLabel}>Available</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {assets.filter(a => a.status.toLowerCase() === 'in use').length}
              </Text>
              <Text style={styles.statLabel}>In Use</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#2563eb',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 15,
    margin: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#1f2937',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 5,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  assetCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusAvailable: {
    backgroundColor: '#dcfce7',
  },
  statusInUse: {
    backgroundColor: '#fef3c7',
  },
  statusMaintenance: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  assetLocation: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 5,
  },
  assetDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 3,
  },
  assetBarcode: {
    fontSize: 11,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
});
