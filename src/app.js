// API Configuration
const API_BASE_URL = 'https://r1iqp059n5.execute-api.eu-west-2.amazonaws.com/dev/items';

class WaterTapAssetManager {
    constructor() {
        this.assets = [];
        this.dashboardData = {};
        this.currentEditingAsset = null;
        this.bulkUploadData = [];
    }

    init() {
        this.setupEventListeners();
        this.loadDashboardData();
        this.loadAssets();
        
        // Show mock data if API is not available
        setTimeout(() => {
            if (this.assets.length === 0) {
                this.showMockData();
            }
        }, 3000);
    }

    setupEventListeners() {
        // Asset management
        const addAssetBtn = document.getElementById('addAssetBtn');
        if (addAssetBtn) {
            addAssetBtn.addEventListener('click', () => this.showAssetModal());
        }
        
        const cancelAsset = document.getElementById('cancelAsset');
        if (cancelAsset) {
            cancelAsset.addEventListener('click', () => this.hideAssetModal());
        }
        
        const assetForm = document.getElementById('assetForm');
        if (assetForm) {
            assetForm.addEventListener('submit', (e) => this.handleSaveAsset(e));
        }
        
        // Search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterAssets(e.target.value);
            });
        }
        
        // Bulk upload
        const bulkUploadBtn = document.getElementById('bulkUploadBtn');
        if (bulkUploadBtn) {
            bulkUploadBtn.addEventListener('click', () => this.showBulkUploadModal());
        }
        
        const cancelBulkUpload = document.getElementById('cancelBulkUpload');
        if (cancelBulkUpload) {
            cancelBulkUpload.addEventListener('click', () => this.hideBulkUploadModal());
        }
        
        const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
        if (downloadTemplateBtn) {
            downloadTemplateBtn.addEventListener('click', () => this.downloadTemplate());
        }
        
        const excelFileInput = document.getElementById('excelFileInput');
        if (excelFileInput) {
            excelFileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }
        
        const importAssetsBtn = document.getElementById('importAssetsBtn');
        if (importAssetsBtn) {
            importAssetsBtn.addEventListener('click', () => this.importAssets());
        }
        
        // Refresh
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshData());
        }
        
        // Close modal when clicking outside
        const assetModal = document.getElementById('assetModal');
        if (assetModal) {
            assetModal.addEventListener('click', (e) => {
                if (e.target.id === 'assetModal') {
                    this.hideAssetModal();
                }
            });
        }
        
        const bulkUploadModal = document.getElementById('bulkUploadModal');
        if (bulkUploadModal) {
            bulkUploadModal.addEventListener('click', (e) => {
                if (e.target.id === 'bulkUploadModal') {
                    this.hideBulkUploadModal();
                }
            });
        }
    }



    async loadDashboardData() {
        try {
            const response = await fetch(`${API_BASE_URL}/dashboard`);
            if (response.ok) {
                this.dashboardData = await response.json();
                this.renderDashboardStats();
            } else {
                console.error('Failed to load dashboard data');
                this.showMockDashboardData();
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showMockDashboardData();
        }
    }

    renderDashboardStats() {
        const stats = this.dashboardData;
        const dashboardContainer = document.getElementById('dashboardStats');
        
        if (dashboardContainer) {
            dashboardContainer.innerHTML = `
                <div class="bg-white overflow-hidden shadow-md rounded-lg card-hover transition-all">
                    <div class="p-5">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-tint text-blue-500 text-2xl"></i>
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
                
                <div class="bg-white overflow-hidden shadow-md rounded-lg card-hover transition-all">
                    <div class="p-5">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-check-circle text-green-500 text-2xl"></i>
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
                
                <div class="bg-white overflow-hidden shadow-md rounded-lg card-hover transition-all">
                    <div class="p-5">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-tools text-yellow-500 text-2xl"></i>
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
                
                <div class="bg-white overflow-hidden shadow-md rounded-lg card-hover transition-all">
                    <div class="p-5">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-filter text-red-500 text-2xl"></i>
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
        
        // Update charts if data is available
        if (stats.statusBreakdown) {
            this.renderStatusChart(stats.statusBreakdown);
        }
        if (stats.assetTypeBreakdown) {
            this.renderAssetTypeChart(stats.assetTypeBreakdown);
        }
        if (stats.wingBreakdown) {
            this.renderWingChart(stats.wingBreakdown);
        }
        if (stats.filterStatus) {
            this.renderFilterChart(stats.filterStatus);
        }
    }

    renderStatusChart(data) {
        // Placeholder for chart rendering
        console.log('Status breakdown:', data);
    }

    renderAssetTypeChart(data) {
        // Placeholder for chart rendering
        console.log('Asset type breakdown:', data);
    }

    renderWingChart(data) {
        // Placeholder for chart rendering
        console.log('Wing breakdown:', data);
    }

    renderFilterChart(data) {
        // Placeholder for chart rendering
        console.log('Filter status:', data);
    }

    async loadAssets() {
        try {
            this.showLoading();
            console.log('Making API call to:', `${API_BASE_URL}/items/assets`);
            const response = await fetch(`${API_BASE_URL}/items/assets`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'cors'
            });
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            if (response.ok) {
                const data = await response.json();
                console.log('API Response data:', data);
                console.log('Data type:', typeof data);
                console.log('Data keys:', Object.keys(data));
                // Handle both old and new data structures
                this.assets = data.items || data.assets || [];
                console.log('Assets array:', this.assets);
                console.log('Assets length:', this.assets.length);
                this.renderAssets();
                this.updateAssetCount();
            } else {
                const errorText = await response.text();
                console.error('Failed to load assets. Status:', response.status, 'Error:', errorText);
                this.showMockAssets();
            }
        } catch (error) {
            console.error('Error loading assets:', error);
            console.error('Error details:', error.message);
            this.showMockAssets();
        } finally {
            this.hideLoading();
        }
    }

    renderAssets(assetsToRender = null) {
        const assets = assetsToRender || this.assets;
        const tableBody = document.getElementById('assetsTableBody');
        
        if (assets.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="23" class="px-6 py-4 text-center text-gray-500">
                        No assets found. <button class="text-blue-600 hover:text-blue-800" onclick="document.getElementById('addAssetBtn').click()">Add your first asset</button>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = assets.map(asset => `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${asset.assetBarcode || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${this.getStatusColor(asset.status)}">
                        ${this.normalizeStatusDisplay(asset.status)}
                    </span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.assetType || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.primaryIdentifier || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.secondaryIdentifier || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.wing || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.wingInShort || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.room || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.floor || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.floorInWords || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.roomNo || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.roomName || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${asset.filterNeeded ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}">
                        ${asset.filterNeeded ? 'Yes' : 'No'}
                    </span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${asset.filtersOn ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                        ${asset.filtersOn ? 'Yes' : 'No'}
                    </span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatDateDDMMYYYY(asset.filterExpiryDate)}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatDateDDMMYYYY(asset.filterInstalledOn)}</td>
                <td class="px-4 py-4 text-sm text-gray-900 max-w-xs truncate" title="${asset.notes || ''}">${asset.notes || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${asset.augmentedCare ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}">
                        ${asset.augmentedCare ? 'Yes' : 'No'}
                    </span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatDateTimeDDMMYYYY(asset.created)}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.createdBy || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatDateTimeDDMMYYYY(asset.modified)}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.modifiedBy || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="window.assetManager.editAsset('${asset.id}')" class="text-indigo-600 hover:text-indigo-900 mr-3">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="window.assetManager.deleteAsset('${asset.id}')" class="text-red-600 hover:text-red-900">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    getStatusColor(status) {
        // Normalize status to uppercase for comparison
        const normalizedStatus = status ? status.toString().toUpperCase() : '';
        switch (normalizedStatus) {
            case 'ACTIVE':
                return 'bg-green-100 text-green-800';
            case 'INACTIVE':
                return 'bg-gray-100 text-gray-800';
            case 'MAINTENANCE':
                return 'bg-yellow-100 text-yellow-800';
            case 'DECOMMISSIONED':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    normalizeStatusDisplay(status) {
        if (!status) return 'ACTIVE';
        // Convert to uppercase for consistent display
        return status.toString().toUpperCase();
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString();
    }

    formatDateDDMMYYYY(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    formatDateTimeDDMMYYYY(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    updateAssetCount() {
        const assetCountElement = document.getElementById('assetCount');
        if (assetCountElement) {
            assetCountElement.textContent = `${this.assets.length} assets`;
        }
    }

    filterAssets(searchTerm) {
        if (!searchTerm) {
            this.renderAssets();
            return;
        }

        const filteredAssets = this.assets.filter(asset => {
            const searchFields = [
                asset.assetBarcode,
                asset.status,
                asset.assetType,
                asset.primaryIdentifier,
                asset.secondaryIdentifier,
                asset.wing,
                asset.wingInShort,
                asset.room,
                asset.floor,
                asset.floorInWords,
                asset.roomNo,
                asset.roomName,
                asset.notes,
                asset.createdBy,
                asset.modifiedBy
            ];
            
            return searchFields.some(field => 
                field && field.toString().toLowerCase().includes(searchTerm.toLowerCase())
            );
        });

        this.renderAssets(filteredAssets);
    }

    showAssetModal(asset = null) {
        this.currentEditingAsset = asset;
        const modal = document.getElementById('assetModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('assetForm');
        
        title.textContent = asset ? 'Edit Asset' : 'Add New Asset';
        
        if (asset) {
            this.populateForm(asset);
        } else {
            form.reset();
            // Set default values
            form.querySelector('[name="status"]').value = 'ACTIVE';
            form.querySelector('[name="filterNeeded"]').value = 'false';
            form.querySelector('[name="filtersOn"]').value = 'false';
            form.querySelector('[name="augmentedCare"]').value = 'false';
        }
        
        modal.classList.remove('hidden');
    }

    hideAssetModal() {
        document.getElementById('assetModal').classList.add('hidden');
        this.currentEditingAsset = null;
    }

    populateForm(asset) {
        const form = document.getElementById('assetForm');
        
        // Populate all form fields with asset data
        const fields = [
            'assetBarcode', 'status', 'assetType', 'primaryIdentifier', 'secondaryIdentifier',
            'wing', 'wingInShort', 'room', 'floor', 'floorInWords', 'roomNo', 'roomName',
            'filterExpiryDate', 'filterInstalledOn', 'notes'
        ];
        
        fields.forEach(field => {
            const input = form.querySelector(`[name="${field}"]`);
            if (input && asset[field] !== undefined) {
                if (input.type === 'date' && asset[field]) {
                    // Convert date to YYYY-MM-DD format for date inputs
                    const date = new Date(asset[field]);
                    input.value = date.toISOString().split('T')[0];
                } else {
                    input.value = asset[field];
                }
            }
        });

        // Handle boolean fields
        form.querySelector('[name="filterNeeded"]').value = asset.filterNeeded ? 'true' : 'false';
        form.querySelector('[name="filtersOn"]').value = asset.filtersOn ? 'true' : 'false';
        form.querySelector('[name="augmentedCare"]').value = asset.augmentedCare ? 'true' : 'false';
    }

    async handleSaveAsset(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const assetData = {};
        
        // Convert form data to object
        for (let [key, value] of formData.entries()) {
            if (key === 'filterNeeded' || key === 'filtersOn' || key === 'augmentedCare') {
                assetData[key] = value === 'true';
            } else {
                assetData[key] = value;
            }
        }

        // Set timestamps
        const now = new Date().toISOString();
        if (this.currentEditingAsset) {
            assetData.modified = now;
            assetData.modifiedBy = 'User';
        } else {
            assetData.created = now;
            assetData.createdBy = 'User';
            assetData.modified = now;
            assetData.modifiedBy = 'User';
        }
        
        try {
            this.showLoading();
            
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

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save asset');
            }

            const savedAsset = await response.json();
            console.log('Asset saved:', savedAsset);

            this.showNotification(
                this.currentEditingAsset ? 'Asset updated successfully!' : 'Asset created successfully!',
                'success'
            );

            this.hideAssetModal();
            this.loadAssets();
            this.loadDashboardData();

        } catch (error) {
            console.error('Error saving asset:', error);
            this.showNotification('Error saving asset: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async editAsset(id) {
        const asset = this.assets.find(a => a.id === id);
        if (asset) {
            this.showAssetModal(asset);
        }
    }

    async deleteAsset(id) {
        if (!confirm('Are you sure you want to delete this asset?')) {
            return;
        }

        try {
            this.showLoading();
            
            const response = await fetch(`${API_BASE_URL}/items/assets/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete asset');
            }

            this.showNotification('Asset deleted successfully!', 'success');
            this.loadAssets();
            this.loadDashboardData();

        } catch (error) {
            console.error('Error deleting asset:', error);
            this.showNotification('Error deleting asset: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    refreshData() {
        this.loadDashboardData();
        this.loadAssets();
    }

    // Test function for debugging
    async testAPI() {
        try {
            console.log('Testing API directly...');
            const response = await fetch(`${API_BASE_URL}/items/assets`);
            console.log('Test API Response status:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('Test API Response data:', data);
                return data;
            } else {
                const errorText = await response.text();
                console.error('Test API Error:', errorText);
                return null;
            }
        } catch (error) {
            console.error('Test API Exception:', error);
            return null;
        }
    }

    showMockDashboardData() {
        this.dashboardData = {
            totalAssets: 4,
            activeAssets: 3,
            maintenanceAssets: 1,
            filtersNeeded: 2
        };
        this.renderDashboardStats();
    }

    showMockAssets() {
        this.assets = [
            {
                id: '1',
                assetBarcode: 'WT001',
                status: 'ACTIVE',
                assetType: 'Water Tap',
                primaryIdentifier: 'TAP-001',
                secondaryIdentifier: 'SEC-001',
                wing: 'North Wing',
                wingInShort: 'N',
                room: 'Kitchen',
                floor: '1',
                floorInWords: 'Ground Floor',
                roomNo: '101',
                roomName: 'Main Kitchen',
                filterNeeded: true,
                filtersOn: false,
                filterExpiryDate: '2024-12-31',
                filterInstalledOn: '2024-01-15',
                notes: 'Regular maintenance required',
                augmentedCare: true,
                created: '2024-01-01T10:00:00Z',
                createdBy: 'Admin',
                modified: '2024-01-15T14:30:00Z',
                modifiedBy: 'Admin'
            },
            {
                id: '2',
                assetBarcode: 'WT002',
                status: 'ACTIVE',
                assetType: 'Drinking Fountain',
                primaryIdentifier: 'DF-001',
                secondaryIdentifier: '',
                wing: 'South Wing',
                wingInShort: 'S',
                room: 'Lobby',
                floor: '1',
                floorInWords: 'Ground Floor',
                roomNo: '102',
                roomName: 'Main Lobby',
                filterNeeded: false,
                filtersOn: false,
                filterExpiryDate: '',
                filterInstalledOn: '',
                notes: '',
                augmentedCare: false,
                created: '2024-01-02T09:00:00Z',
                createdBy: 'Admin',
                modified: '2024-01-02T09:00:00Z',
                modifiedBy: 'Admin'
            }
        ];
        this.renderAssets();
        this.updateAssetCount();
    }

    showMockData() {
        this.showMockDashboardData();
        this.showMockAssets();
    }

    showLoading() {
        document.getElementById('loadingOverlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }

    showNotification(message, type) {
        const notification = document.getElementById('notification');
        const messageEl = document.getElementById('notificationMessage');
        const iconEl = document.getElementById('notificationIcon');
        
        messageEl.textContent = message;
        
        // Set icon and colors based on type
        if (type === 'success') {
            iconEl.className = 'fas fa-check-circle h-6 w-6 text-green-400';
            notification.className = notification.className.replace(/bg-\w+-50/, 'bg-green-50');
        } else if (type === 'error') {
            iconEl.className = 'fas fa-exclamation-circle h-6 w-6 text-red-400';
            notification.className = notification.className.replace(/bg-\w+-50/, 'bg-red-50');
        }
        
        notification.classList.remove('hidden');
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 5000);
    }

    downloadTemplate() {
        // Create Excel template with new schema
        const headers = [
            'assetBarcode', 'status', 'assetType', 'primaryIdentifier', 'secondaryIdentifier',
            'wing', 'wingInShort', 'room', 'floor', 'floorInWords', 'roomNo', 'roomName',
            'filterNeeded', 'filtersOn', 'filterExpiryDate', 'filterInstalledOn', 'notes', 'augmentedCare'
        ];

        const sampleData = [
            [
                'WT001', 'ACTIVE', 'Water Tap', 'TAP-001', 'SEC-001', 'North Wing', 'N',
                'Kitchen', '1', 'Ground Floor', '101', 'Main Kitchen', 'true', 'false',
                '31/12/2024', '15/01/2024', 'Regular maintenance required', 'true'
            ]
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        
        // Set column widths
        ws['!cols'] = headers.map(() => ({ width: 15 }));
        
        XLSX.utils.book_append_sheet(wb, ws, 'Assets');
        XLSX.writeFile(wb, 'water_tap_assets_template.xlsx');
    }

    showBulkUploadModal() {
        document.getElementById('bulkUploadModal').classList.remove('hidden');
        this.resetBulkUploadForm();
    }

    hideBulkUploadModal() {
        document.getElementById('bulkUploadModal').classList.add('hidden');
        this.resetBulkUploadForm();
    }

    resetBulkUploadForm() {
        document.getElementById('excelFileInput').value = '';
        document.getElementById('previewContainer').classList.add('hidden');
        document.getElementById('importAssetsBtn').disabled = true;
        this.bulkUploadData = [];
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.showLoading();
            const data = await this.readExcelFile(file);
            this.bulkUploadData = this.processExcelData(data);
            this.showPreview(this.bulkUploadData);
            document.getElementById('importAssetsBtn').disabled = false;
        } catch (error) {
            console.error('Error processing file:', error);
            this.showNotification('Error processing file: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }

    processExcelData(data) {
        if (data.length < 2) {
            throw new Error('File must contain at least a header row and one data row');
        }

        const headers = data[0];
        const expectedHeaders = [
            'assetBarcode', 'status', 'assetType', 'primaryIdentifier', 'secondaryIdentifier',
            'wing', 'wingInShort', 'room', 'floor', 'floorInWords', 'roomNo', 'roomName',
            'filterNeeded', 'filtersOn', 'filterExpiryDate', 'filterInstalledOn', 'notes', 'augmentedCare'
        ];

        // Validate headers (allow for some flexibility in naming)
        const headerMap = {};
        expectedHeaders.forEach((expected, index) => {
            const found = headers.findIndex(h => 
                h && h.toString().toLowerCase().replace(/[^a-z]/g, '') === 
                expected.toLowerCase().replace(/[^a-z]/g, '')
            );
            if (found >= 0) {
                headerMap[expected] = found;
            }
        });

        const processedAssets = [];
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const asset = {
                assetBarcode: this.getCellValue(row, headerMap['assetBarcode']),
                status: this.getCellValue(row, headerMap['status']) || 'ACTIVE',
                assetType: this.getCellValue(row, headerMap['assetType']),
                primaryIdentifier: this.getCellValue(row, headerMap['primaryIdentifier']),
                secondaryIdentifier: this.getCellValue(row, headerMap['secondaryIdentifier']),
                wing: this.getCellValue(row, headerMap['wing']),
                wingInShort: this.getCellValue(row, headerMap['wingInShort']),
                room: this.getCellValue(row, headerMap['room']),
                floor: this.getCellValue(row, headerMap['floor']),
                floorInWords: this.getCellValue(row, headerMap['floorInWords']),
                roomNo: this.getCellValue(row, headerMap['roomNo']),
                roomName: this.getCellValue(row, headerMap['roomName']),
                filterNeeded: this.parseBoolean(this.getCellValue(row, headerMap['filterNeeded'])),
                filtersOn: this.parseBoolean(this.getCellValue(row, headerMap['filtersOn'])),
                filterExpiryDate: this.parseDate(this.getCellValue(row, headerMap['filterExpiryDate'])),
                filterInstalledOn: this.parseDate(this.getCellValue(row, headerMap['filterInstalledOn'])),
                notes: this.getCellValue(row, headerMap['notes']),
                augmentedCare: this.parseBoolean(this.getCellValue(row, headerMap['augmentedCare'])),
                created: new Date().toISOString(),
                createdBy: 'Bulk Upload',
                modified: new Date().toISOString(),
                modifiedBy: 'Bulk Upload'
            };

            // Validate required fields
            if (!asset.assetBarcode) {
                throw new Error(`Row ${i + 1}: assetBarcode is required`);
            }
            if (!asset.assetType) {
                throw new Error(`Row ${i + 1}: assetType is required`);
            }
            if (!asset.primaryIdentifier) {
                throw new Error(`Row ${i + 1}: primaryIdentifier is required`);
            }

            processedAssets.push(asset);
        }

        return processedAssets;
    }

    getCellValue(row, index) {
        if (index === undefined || index < 0 || index >= row.length) return '';
        const value = row[index];
        return value !== null && value !== undefined ? value.toString().trim() : '';
    }

    parseBoolean(value, defaultValue = false) {
        if (!value) return defaultValue;
        const str = value.toString().toLowerCase();
        return str === 'true' || str === '1' || str === 'yes' || str === 'y';
    }

    parseDate(value) {
        if (!value) return '';
        try {
            const date = new Date(value);
            return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
        } catch {
            return '';
        }
    }

    showPreview(assets) {
        const container = document.getElementById('previewContainer');
        const table = document.getElementById('previewTable');
        
        // Show only first 5 rows for preview
        const previewAssets = assets.slice(0, 5);
        
        const headers = [
            'assetBarcode', 'status', 'assetType', 'primaryIdentifier', 'secondaryIdentifier',
            'wing', 'wingInShort', 'room', 'floor', 'floorInWords', 'roomNo', 'roomName',
            'filterNeeded', 'filtersOn', 'filterExpiryDate', 'filterInstalledOn', 'notes', 'augmentedCare'
        ];

        table.innerHTML = `
            <thead class="bg-gray-50">
                <tr>
                    ${headers.map(header => `<th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">${header}</th>`).join('')}
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${previewAssets.map(asset => `
                    <tr>
                        <td class="px-2 py-2 text-xs">${asset.assetBarcode}</td>
                        <td class="px-2 py-2 text-xs">${asset.status}</td>
                        <td class="px-2 py-2 text-xs">${asset.assetType}</td>
                        <td class="px-2 py-2 text-xs">${asset.primaryIdentifier}</td>
                        <td class="px-2 py-2 text-xs">${asset.secondaryIdentifier || '-'}</td>
                        <td class="px-2 py-2 text-xs">${asset.wing}</td>
                        <td class="px-2 py-2 text-xs">${asset.wingInShort}</td>
                        <td class="px-2 py-2 text-xs">${asset.room}</td>
                        <td class="px-2 py-2 text-xs">${asset.floor}</td>
                        <td class="px-2 py-2 text-xs">${asset.floorInWords}</td>
                        <td class="px-2 py-2 text-xs">${asset.roomNo}</td>
                        <td class="px-2 py-2 text-xs">${asset.roomName}</td>
                        <td class="px-2 py-2 text-xs">${asset.filterNeeded ? 'Yes' : 'No'}</td>
                        <td class="px-2 py-2 text-xs">${asset.filtersOn ? 'Yes' : 'No'}</td>
                        <td class="px-2 py-2 text-xs">${this.formatDateDDMMYYYY(asset.filterExpiryDate)}</td>
                        <td class="px-2 py-2 text-xs">${this.formatDateDDMMYYYY(asset.filterInstalledOn)}</td>
                        <td class="px-2 py-2 text-xs">${asset.notes || '-'}</td>
                        <td class="px-2 py-2 text-xs">${asset.augmentedCare ? 'Yes' : 'No'}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        container.classList.remove('hidden');
    }

    async importAssets() {
        if (this.bulkUploadData.length === 0) {
            this.showNotification('No data to import', 'error');
            return;
        }

        try {
            this.showLoading();
            
            let successCount = 0;
            let errorCount = 0;
            const errors = [];

            for (let i = 0; i < this.bulkUploadData.length; i++) {
                try {
                    const response = await fetch(`${API_BASE_URL}/items/assets`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(this.bulkUploadData[i])
                    });

                    if (response.ok) {
                        successCount++;
                    } else {
                        const errorData = await response.json();
                        errors.push(`Row ${i + 2}: ${errorData.error}`);
                        errorCount++;
                    }
                } catch (error) {
                    errors.push(`Row ${i + 2}: ${error.message}`);
                    errorCount++;
                }
            }

            let message = `Import completed: ${successCount} assets imported`;
            if (errorCount > 0) {
                message += `, ${errorCount} errors`;
                console.error('Import errors:', errors);
            }

            this.showNotification(message, errorCount === 0 ? 'success' : 'error');
            
            if (successCount > 0) {
                this.hideBulkUploadModal();
                this.loadAssets();
                this.loadDashboardData();
            }

        } catch (error) {
            console.error('Error importing assets:', error);
            this.showNotification('Error importing assets: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.assetManager = new WaterTapAssetManager();
    window.assetManager.init();
});

console.log('Water Tap Asset Management System loaded');
console.log('API Base URL:', API_BASE_URL); 