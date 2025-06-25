// API Configuration
const API_BASE_URL = 'https://uliwzluwwi.execute-api.eu-west-2.amazonaws.com/dev';

class WaterTapAssetManager {
    constructor() {
        this.assets = [];
        this.dashboardData = {};
        this.currentEditingAsset = null;
        
        this.init();
    }

    init() {
        console.log('Initializing Water Tap Asset Manager...');
        this.setupEventListeners();
        this.loadDashboardData();
        this.loadAssets();
        console.log('Initialization complete');
    }

    setupEventListeners() {
        // Add Asset Button
        document.getElementById('addAssetBtn').addEventListener('click', () => {
            this.showAssetModal();
        });

        // Modal Controls
        document.getElementById('cancelAsset').addEventListener('click', () => {
            this.hideAssetModal();
        });

        document.getElementById('assetForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSaveAsset(e);
        });

        // Refresh Button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterAssets(e.target.value);
        });

        document.getElementById('searchBtn').addEventListener('click', () => {
            const searchTerm = document.getElementById('searchInput').value;
            this.filterAssets(searchTerm);
        });

        // Close modal on background click
        document.getElementById('assetModal').addEventListener('click', (e) => {
            if (e.target.id === 'assetModal') {
                this.hideAssetModal();
            }
        });
    }

    async loadDashboardData() {
        try {
            console.log('Loading dashboard data...');
            this.showLoading();
            
            const response = await fetch(`${API_BASE_URL}/items/dashboard`);
            console.log('Dashboard response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`Failed to load dashboard data: ${response.status}`);
            }

            this.dashboardData = await response.json();
            console.log('Dashboard data loaded:', this.dashboardData);
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
            console.log('Loading assets...');
            this.showLoading();
            
            const response = await fetch(`${API_BASE_URL}/items/assets`);
            console.log('Assets response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`Failed to load assets: ${response.status}`);
            }

            const data = await response.json();
            console.log('Assets data loaded:', data);
            this.assets = data.assets || [];
            this.renderAssets();
            this.updateAssetCount();
        } catch (error) {
            console.error('Error loading assets:', error);
            this.showMockAssets();
        } finally {
            this.hideLoading();
        }
    }

    renderAssets(assetsToRender = null) {
        const tbody = document.getElementById('assetsTableBody');
        const assets = assetsToRender || this.assets;
        
        if (assets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="14" class="px-4 py-8 text-center text-gray-500">
                        <i class="fas fa-tint text-gray-300 text-4xl mb-4"></i>
                        <p>No assets found. Click "Add Asset" to get started.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = assets.map(asset => `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${asset.assetBarcode || '-'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${asset.assetType || '-'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${asset.primaryIdentifier || '-'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${this.getStatusColor(asset.status)}">
                        ${asset.status || 'ACTIVE'}
                    </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${asset.building || '-'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${asset.floor || '-'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${asset.room || '-'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${asset.filterNeeded ? 
                        `<span class="text-orange-600"><i class="fas fa-exclamation-triangle mr-1"></i>Required</span>` : 
                        '<span class="text-green-600"><i class="fas fa-check mr-1"></i>Not Required</span>'
                    }
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${asset.filterType || '-'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${asset.lastMaintenanceDate ? this.formatDate(asset.lastMaintenanceDate) : '-'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${asset.nextMaintenanceDate ? this.formatDate(asset.nextMaintenanceDate) : '-'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${asset.installationDate ? this.formatDate(asset.installationDate) : '-'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${asset.warrantyExpiry ? this.formatDate(asset.warrantyExpiry) : '-'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <button class="text-indigo-600 hover:text-indigo-900 mr-3" onclick="app.editAsset('${asset.id}')" title="Edit Asset">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-600 hover:text-red-900" onclick="app.deleteAsset('${asset.id}')" title="Delete Asset">
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
            case 'DECOMMISSIONED':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-green-100 text-green-800';
        }
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    updateAssetCount() {
        const count = this.assets.length;
        document.getElementById('assetCount').textContent = `${count} asset${count !== 1 ? 's' : ''}`;
    }

    filterAssets(searchTerm) {
        if (!searchTerm.trim()) {
            this.renderAssets();
            return;
        }

        const filtered = this.assets.filter(asset => {
            const searchLower = searchTerm.toLowerCase();
            return (
                (asset.assetBarcode && asset.assetBarcode.toLowerCase().includes(searchLower)) ||
                (asset.assetType && asset.assetType.toLowerCase().includes(searchLower)) ||
                (asset.primaryIdentifier && asset.primaryIdentifier.toLowerCase().includes(searchLower)) ||
                (asset.building && asset.building.toLowerCase().includes(searchLower)) ||
                (asset.floor && asset.floor.toLowerCase().includes(searchLower)) ||
                (asset.room && asset.room.toLowerCase().includes(searchLower)) ||
                (asset.status && asset.status.toLowerCase().includes(searchLower))
            );
        });

        this.renderAssets(filtered);
    }

    showAssetModal(asset = null) {
        this.currentEditingAsset = asset;
        const modal = document.getElementById('assetModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('assetForm');
        
        if (asset) {
            title.textContent = 'Edit Asset';
            this.populateForm(asset);
        } else {
            title.textContent = 'Add New Asset';
            form.reset();
        }
        
        modal.classList.remove('hidden');
    }

    hideAssetModal() {
        document.getElementById('assetModal').classList.add('hidden');
        document.getElementById('assetForm').reset();
        this.currentEditingAsset = null;
    }

    populateForm(asset) {
        const form = document.getElementById('assetForm');
        const formData = new FormData();
        
        // Populate form fields with asset data
        Object.keys(asset).forEach(key => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = asset[key];
                } else {
                    input.value = asset[key] || '';
                }
            }
        });
    }

    async handleSaveAsset(event) {
        const formData = new FormData(event.target);
        const assetData = {
            assetBarcode: formData.get('assetBarcode'),
            assetType: formData.get('assetType'),
            primaryIdentifier: formData.get('primaryIdentifier'),
            status: formData.get('status') || 'ACTIVE',
            building: formData.get('building'),
            floor: formData.get('floor'),
            room: formData.get('room'),
            filterNeeded: formData.get('filterNeeded') === 'on',
            filterType: formData.get('filterType'),
            lastMaintenanceDate: formData.get('lastMaintenanceDate'),
            nextMaintenanceDate: formData.get('nextMaintenanceDate'),
            installationDate: formData.get('installationDate'),
            warrantyExpiry: formData.get('warrantyExpiry'),
            notes: formData.get('notes')
        };

        try {
            this.showLoading();
            console.log('Saving asset:', assetData);

            let response;
            if (this.currentEditingAsset) {
                // Update existing asset
                response = await fetch(`${API_BASE_URL}/items/assets/${this.currentEditingAsset.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(assetData)
                });
            } else {
                // Create new asset
                response = await fetch(`${API_BASE_URL}/items/assets`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(assetData)
                });
            }

            console.log('Save response status:', response.status);

            if (!response.ok) {
                throw new Error(`Failed to save asset: ${response.status}`);
            }

            const savedAsset = await response.json();
            console.log('Asset saved:', savedAsset);

            if (this.currentEditingAsset) {
                // Update existing asset in the array
                const index = this.assets.findIndex(a => a.id === this.currentEditingAsset.id);
                if (index !== -1) {
                    this.assets[index] = savedAsset;
                }
            } else {
                // Add new asset to the array
                this.assets.push(savedAsset);
            }

            this.renderAssets();
            this.updateAssetCount();
            this.hideAssetModal();
            this.loadDashboardData(); // Refresh dashboard stats
            this.showNotification(
                this.currentEditingAsset ? 'Asset updated successfully!' : 'Asset added successfully!', 
                'success'
            );
            
        } catch (error) {
            console.error('Error saving asset:', error);
            this.showNotification('Failed to save asset. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async editAsset(id) {
        const asset = this.assets.find(a => a.id === id);
        if (asset) {
            this.showAssetModal(asset);
        } else {
            console.error('Asset not found:', id);
        }
    }

    async deleteAsset(id) {
        if (confirm('Are you sure you want to delete this asset?')) {
            try {
                this.showLoading();
                console.log('Deleting asset:', id);
                
                const response = await fetch(`${API_BASE_URL}/items/assets/${id}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error(`Failed to delete asset: ${response.status}`);
                }

                // Remove from local array
                this.assets = this.assets.filter(asset => asset.id !== id);
                this.renderAssets();
                this.updateAssetCount();
                this.loadDashboardData(); // Refresh dashboard stats
                this.showNotification('Asset deleted successfully!', 'success');
                
            } catch (error) {
                console.error('Error deleting asset:', error);
                this.showNotification('Failed to delete asset. Please try again.', 'error');
            } finally {
                this.hideLoading();
            }
        }
    }

    refreshData() {
        console.log('Refreshing all data...');
        this.loadDashboardData();
        this.loadAssets();
    }

    // Mock data for fallback
    showMockDashboardData() {
        this.dashboardData = {
            totalAssets: 0,
            activeAssets: 0,
            maintenanceAssets: 0,
            inactiveAssets: 0,
            filtersNeeded: 0
        };
        this.renderDashboardStats();
    }

    showMockAssets() {
        this.assets = [];
        this.renderAssets();
        this.updateAssetCount();
    }

    showLoading() {
        document.getElementById('loadingSpinner').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingSpinner').classList.add('hidden');
    }

    showNotification(message, type) {
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
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WaterTapAssetManager();
});

console.log('Water Tap Asset Management System loaded');
console.log('API Base URL:', API_BASE_URL); 