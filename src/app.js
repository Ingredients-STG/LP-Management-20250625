// API Configuration - Updated with new API Gateway URL
const API_BASE_URL = 'https://uliwzluwwi.execute-api.eu-west-2.amazonaws.com/dev';

class AssetManagementApp {
    constructor() {
        this.currentTab = 'assets';
        this.assets = [];
        this.maintenance = [];
        this.locations = [];
        this.dashboardData = {};
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDashboardData();
        this.loadAssets();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Modal controls
        document.getElementById('addAssetBtn').addEventListener('click', () => {
            this.showModal('addAssetModal');
        });

        document.getElementById('cancelAddAsset').addEventListener('click', () => {
            this.hideModal('addAssetModal');
        });

        document.getElementById('addAssetForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddAsset(e);
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshAllData();
        });

        // Close modal on background click
        document.getElementById('addAssetModal').addEventListener('click', (e) => {
            if (e.target.id === 'addAssetModal') {
                this.hideModal('addAssetModal');
            }
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
            btn.classList.add('border-transparent', 'text-gray-500');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active', 'border-blue-500', 'text-blue-600');
        document.querySelector(`[data-tab="${tabName}"]`).classList.remove('border-transparent', 'text-gray-500');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        document.getElementById(`${tabName}-tab`).classList.remove('hidden');
        this.currentTab = tabName;

        // Load data for the active tab
        switch (tabName) {
            case 'assets':
                this.loadAssets();
                break;
            case 'maintenance':
                this.loadMaintenance();
                break;
            case 'locations':
                this.loadLocations();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    }

    async loadDashboardData() {
        try {
            this.showLoading();
            
            const response = await fetch(`${API_BASE_URL}/items/dashboard`);
            
            if (!response.ok) {
                throw new Error('Failed to load dashboard data');
            }

            this.dashboardData = await response.json();
            this.renderDashboardStats();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showMockDashboardData();
        } finally {
            this.hideLoading();
        }
    }

    renderDashboardStats() {
        const statsContainer = document.getElementById('dashboardStats');
        const stats = this.dashboardData;

        statsContainer.innerHTML = `
            <div class="bg-white overflow-hidden shadow rounded-lg card-hover transition-all">
                <div class="p-5">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-tint text-blue-600 text-2xl"></i>
                        </div>
                        <div class="ml-5 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">Total Assets</dt>
                                <dd class="text-lg font-medium text-gray-900">${stats.totalAssets || 0}</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>
            <div class="bg-white overflow-hidden shadow rounded-lg card-hover transition-all">
                <div class="p-5">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-check-circle text-green-600 text-2xl"></i>
                        </div>
                        <div class="ml-5 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">Active Assets</dt>
                                <dd class="text-lg font-medium text-gray-900">${stats.activeAssets || 0}</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>
            <div class="bg-white overflow-hidden shadow rounded-lg card-hover transition-all">
                <div class="p-5">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-tools text-orange-600 text-2xl"></i>
                        </div>
                        <div class="ml-5 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">Maintenance</dt>
                                <dd class="text-lg font-medium text-gray-900">${stats.maintenanceAssets || 0}</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>
            <div class="bg-white overflow-hidden shadow rounded-lg card-hover transition-all">
                <div class="p-5">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-filter text-purple-600 text-2xl"></i>
                        </div>
                        <div class="ml-5 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">Filters Needed</dt>
                                <dd class="text-lg font-medium text-gray-900">${stats.filtersNeeded || 0}</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadAssets() {
        try {
            this.showLoading();
            
            const response = await fetch(`${API_BASE_URL}/items/assets`);
            
            if (!response.ok) {
                throw new Error('Failed to load assets');
            }

            const data = await response.json();
            this.assets = data.assets || [];
            this.renderAssets();
        } catch (error) {
            console.error('Error loading assets:', error);
            this.showMockAssets();
        } finally {
            this.hideLoading();
        }
    }

    renderAssets() {
        const tbody = document.getElementById('assetsTableBody');
        
        if (this.assets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                        No assets found. Click "Add Asset" to get started.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.assets.map(asset => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${asset.assetBarcode}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${asset.assetType}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${asset.floor ? `Floor ${asset.floor}` : ''} ${asset.room ? `- ${asset.room}` : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${this.getStatusColor(asset.status)}">
                        ${asset.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${asset.filterNeeded ? 
                        `<span class="text-orange-600"><i class="fas fa-exclamation-triangle mr-1"></i>Required</span>` : 
                        '<span class="text-green-600"><i class="fas fa-check mr-1"></i>Not Required</span>'
                    }
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="text-indigo-600 hover:text-indigo-900 mr-3" onclick="app.editAsset('${asset.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-600 hover:text-red-900" onclick="app.deleteAsset('${asset.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    getStatusColor(status) {
        switch (status) {
            case 'ACTIVE':
                return 'bg-green-100 text-green-800';
            case 'MAINTENANCE':
                return 'bg-orange-100 text-orange-800';
            case 'INACTIVE':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    async handleAddAsset(event) {
        const formData = new FormData(event.target);
        const assetData = {
            assetBarcode: formData.get('assetBarcode'),
            assetType: formData.get('assetType'),
            primaryIdentifier: formData.get('primaryIdentifier'),
            floor: formData.get('floor'),
            room: formData.get('room'),
            filterNeeded: formData.get('filterNeeded') === 'on',
            status: 'ACTIVE'
        };

        try {
            this.showLoading();
            const response = await fetch(`${API_BASE_URL}/items/assets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(assetData)
            });

            if (!response.ok) {
                throw new Error('Failed to create asset');
            }

            const newAsset = await response.json();
            this.assets.push(newAsset);
            this.renderAssets();
            this.hideModal('addAssetModal');
            event.target.reset();
            this.showNotification('Asset added successfully!', 'success');
        } catch (error) {
            console.error('Error adding asset:', error);
            this.showNotification('Failed to add asset. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadMaintenance() {
        try {
            const response = await fetch(`${API_BASE_URL}/items/maintenance`);
            
            if (!response.ok) {
                throw new Error('Failed to load maintenance records');
            }

            const data = await response.json();
            this.maintenance = data.maintenanceRecords || [];
            this.renderMaintenance();
        } catch (error) {
            console.error('Error loading maintenance:', error);
            this.showMockMaintenance();
        }
    }

    renderMaintenance() {
        const container = document.getElementById('maintenanceList');
        
        if (this.maintenance.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-tools text-gray-400 text-4xl mb-4"></i>
                    <p class="text-gray-500">No maintenance records found.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.maintenance.map(record => `
            <div class="bg-gray-50 rounded-lg p-4 mb-4">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-medium text-gray-900">${record.maintenanceType}</h4>
                        <p class="text-sm text-gray-500">Asset ID: ${record.assetId}</p>
                        <p class="text-sm text-gray-500">Scheduled: ${record.scheduledDate}</p>
                    </div>
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${this.getMaintenanceStatusColor(record.status)}">
                        ${record.status}
                    </span>
                </div>
                ${record.notes ? `<p class="mt-2 text-sm text-gray-600">${record.notes}</p>` : ''}
            </div>
        `).join('');
    }

    getMaintenanceStatusColor(status) {
        switch (status) {
            case 'COMPLETED':
                return 'bg-green-100 text-green-800';
            case 'IN_PROGRESS':
                return 'bg-blue-100 text-blue-800';
            case 'SCHEDULED':
                return 'bg-yellow-100 text-yellow-800';
            case 'CANCELLED':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    async loadLocations() {
        try {
            const response = await fetch(`${API_BASE_URL}/items/locations`);
            
            if (!response.ok) {
                throw new Error('Failed to load locations');
            }

            const data = await response.json();
            this.locations = data.locations || [];
            this.renderLocations();
        } catch (error) {
            console.error('Error loading locations:', error);
            this.showMockLocations();
        }
    }

    renderLocations() {
        const container = document.getElementById('locationsList');
        
        if (this.locations.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <i class="fas fa-map-marker-alt text-gray-400 text-4xl mb-4"></i>
                    <p class="text-gray-500">No locations found.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.locations.map(location => `
            <div class="bg-white rounded-lg shadow p-4 card-hover transition-all">
                <div class="flex items-center mb-2">
                    <i class="fas fa-building text-blue-600 mr-2"></i>
                    <h4 class="font-medium text-gray-900">${location.building}</h4>
                </div>
                <p class="text-sm text-gray-500">Floor: ${location.floor}</p>
                <p class="text-sm text-gray-500">Room: ${location.room}</p>
                ${location.description ? `<p class="text-sm text-gray-600 mt-2">${location.description}</p>` : ''}
            </div>
        `).join('');
    }

    async loadAnalytics() {
        this.loadDashboardData();
    }

    // Mock data for testing without backend
    showMockDashboardData() {
        this.dashboardData = {
            totalAssets: 25,
            activeAssets: 20,
            maintenanceAssets: 3,
            inactiveAssets: 2,
            filtersNeeded: 8,
            assetsByFloor: {
                'Ground': 10,
                'First': 8,
                'Second': 7
            },
            assetsByType: {
                'Water Tap': 15,
                'Drinking Fountain': 6,
                'Water Cooler': 4
            }
        };
        this.renderDashboardStats();
    }

    showMockAssets() {
        this.assets = [
            {
                id: '1',
                assetBarcode: 'WT001',
                assetType: 'Water Tap',
                primaryIdentifier: 'Main Hall Tap',
                floor: 'Ground',
                room: 'Main Hall',
                status: 'ACTIVE',
                filterNeeded: true
            },
            {
                id: '2',
                assetBarcode: 'DF002',
                assetType: 'Drinking Fountain',
                primaryIdentifier: 'Cafeteria Fountain',
                floor: 'First',
                room: 'Cafeteria',
                status: 'ACTIVE',
                filterNeeded: false
            }
        ];
        this.renderAssets();
    }

    showMockMaintenance() {
        this.maintenance = [
            {
                id: '1',
                assetId: '1',
                maintenanceType: 'FILTER_REPLACEMENT',
                scheduledDate: '2024-01-15',
                status: 'SCHEDULED',
                notes: 'Replace water filter'
            }
        ];
        this.renderMaintenance();
    }

    showMockLocations() {
        this.locations = [
            {
                id: '1',
                building: 'Main Building',
                floor: 'Ground',
                room: 'Main Hall',
                description: 'Main entrance hall'
            }
        ];
        this.renderLocations();
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }

    showLoading() {
        document.getElementById('loadingSpinner').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingSpinner').classList.add('hidden');
    }

    showNotification(message, type) {
        // Simple notification - you can enhance this
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    refreshAllData() {
        this.loadDashboardData();
        switch (this.currentTab) {
            case 'assets':
                this.loadAssets();
                break;
            case 'maintenance':
                this.loadMaintenance();
                break;
            case 'locations':
                this.loadLocations();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    }

    editAsset(id) {
        // Implement edit functionality
        console.log('Edit asset:', id);
    }

    deleteAsset(id) {
        if (confirm('Are you sure you want to delete this asset?')) {
            // Implement delete functionality
            console.log('Delete asset:', id);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AssetManagementApp();
});

// Update API URL after deployment
console.log('Water Tap Asset Management System initialized');
console.log('API Base URL:', API_BASE_URL);
console.log('Note: Update API_BASE_URL after deploying to AWS'); 