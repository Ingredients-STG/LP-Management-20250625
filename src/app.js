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
    }

    async loadAssets() {
        try {
            this.showLoading();
            const response = await fetch(`${API_BASE_URL}/assets`);
            if (response.ok) {
                const data = await response.json();
                this.assets = data.items || data.assets || [];
                this.renderAssets();
                this.updateAssetCount();
                this.clearSearch();
            } else {
                console.error('Failed to load assets');
                this.showMockAssets();
            }
        } catch (error) {
            console.error('Error loading assets:', error);
            this.showMockAssets();
        } finally {
            this.hideLoading();
        }
    }

    renderAssets(assetsToRender = null) {
        const assets = assetsToRender || this.assets;
        const tableBody = document.getElementById('assetsTableBody');
        const emptyState = document.getElementById('emptyState');
        
        if (!tableBody) return;
        
        if (assets.length === 0) {
            tableBody.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }
        
        if (emptyState) emptyState.classList.add('hidden');
        
        tableBody.innerHTML = assets.map(asset => `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${asset.assetBarcode || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${this.getStatusColor(asset.status)}">
                        ${this.normalizeStatusDisplay(asset.status)}
                    </span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.outletType || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.tapType || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.spareColumn || ''}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.wing || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.buildingCode || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.roomId || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.floorNumber || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.floorName || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.roomNumber || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.roomName || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs ${asset.hasFilter ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                        ${asset.hasFilter ? 'Yes' : 'No'}
                    </span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs ${asset.filterNeeded ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}">
                        ${asset.filterNeeded ? 'Yes' : 'No'}
                    </span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatDateDDMMYYYY(asset.filterExpiryDate)}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatDateDDMMYYYY(asset.filterInstalledDate)}</td>
                <td class="px-4 py-4 text-sm text-gray-900 max-w-xs truncate">${asset.maintenanceNotes || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs ${asset.inUse ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                        ${asset.inUse ? 'Yes' : 'No'}
                    </span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatDateTimeDDMMYYYY(asset.createdAt)}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.createdBy || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatDateTimeDDMMYYYY(asset.modifiedAt)}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.modifiedBy || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="assetManager.editAsset('${asset.id}')" class="text-blue-600 hover:text-blue-900 mr-3">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="assetManager.deleteAsset('${asset.id}')" class="text-red-600 hover:text-red-900">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    getStatusColor(status) {
        switch (status?.toUpperCase()) {
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
        return status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 'Unknown';
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    formatDateDDMMYYYY(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    formatDateTimeDDMMYYYY(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    updateAssetCount() {
        const countElement = document.getElementById('assetCount');
        if (countElement) {
            countElement.textContent = this.assets.length;
        }
    }

    clearSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }
    }

    filterAssets(searchTerm) {
        if (!searchTerm.trim()) {
            this.renderAssets();
            return;
        }
        
        const filtered = this.assets.filter(asset => {
            const searchFields = [
                asset.assetBarcode,
                asset.status,
                asset.outletType,
                asset.tapType,
                asset.wing,
                asset.buildingCode,
                asset.roomId,
                asset.floorNumber,
                asset.floorName,
                asset.roomNumber,
                asset.roomName,
                asset.maintenanceNotes,
                asset.createdBy,
                asset.modifiedBy
            ];
            
            return searchFields.some(field => 
                field && field.toString().toLowerCase().includes(searchTerm.toLowerCase())
            );
        });
        
        this.renderAssets(filtered);
    }

    showAssetModal(asset = null) {
        const modal = document.getElementById('assetModal');
        const modalTitle = document.getElementById('modalTitle');
        
        if (modal && modalTitle) {
            this.currentEditingAsset = asset;
            modalTitle.textContent = asset ? 'Edit Asset' : 'Add New Asset';
            
            if (asset) {
                this.populateForm(asset);
            } else {
                document.getElementById('assetForm').reset();
            }
            
            modal.classList.remove('hidden');
        }
    }

    hideAssetModal() {
        const modal = document.getElementById('assetModal');
        if (modal) {
            modal.classList.add('hidden');
            this.currentEditingAsset = null;
        }
    }

    populateForm(asset) {
        const form = document.getElementById('assetForm');
        if (!form) return;
        
        // Map the 22 fields to form inputs
        const fieldMappings = {
            'assetBarcode': 'assetBarcode',
            'status': 'status',
            'outletType': 'outletType',
            'tapType': 'tapType',
            'spareColumn': 'spareColumn',
            'wing': 'wing',
            'buildingCode': 'buildingCode',
            'roomId': 'roomId',
            'floorNumber': 'floorNumber',
            'floorName': 'floorName',
            'roomNumber': 'roomNumber',
            'roomName': 'roomName',
            'hasFilter': 'hasFilter',
            'filterNeeded': 'filterNeeded',
            'filterExpiryDate': 'filterExpiryDate',
            'filterInstalledDate': 'filterInstalledDate',
            'maintenanceNotes': 'maintenanceNotes',
            'inUse': 'inUse',
            'createdBy': 'createdBy'
        };
        
        Object.keys(fieldMappings).forEach(field => {
            const input = form.querySelector(`[name="${fieldMappings[field]}"]`);
            if (input && asset.hasOwnProperty(field)) {
                if (input.type === 'checkbox') {
                    input.checked = Boolean(asset[field]);
                } else {
                    input.value = asset[field] || '';
                }
            }
        });
    }

    async handleSaveAsset(event) {
        event.preventDefault();
        
        try {
            const formData = new FormData(event.target);
            const assetData = {};
            
            // Extract all 22 fields from form
            const fieldMappings = {
                'assetBarcode': 'assetBarcode',
                'status': 'status',
                'outletType': 'outletType',
                'tapType': 'tapType',
                'spareColumn': 'spareColumn',
                'wing': 'wing',
                'buildingCode': 'buildingCode',
                'roomId': 'roomId',
                'floorNumber': 'floorNumber',
                'floorName': 'floorName',
                'roomNumber': 'roomNumber',
                'roomName': 'roomName',
                'hasFilter': 'hasFilter',
                'filterNeeded': 'filterNeeded',
                'filterExpiryDate': 'filterExpiryDate',
                'filterInstalledDate': 'filterInstalledDate',
                'maintenanceNotes': 'maintenanceNotes',
                'inUse': 'inUse',
                'createdBy': 'createdBy'
            };
            
            Object.keys(fieldMappings).forEach(field => {
                const formField = fieldMappings[field];
                if (field === 'hasFilter' || field === 'filterNeeded' || field === 'inUse') {
                    assetData[field] = formData.has(formField);
                } else {
                    const value = formData.get(formField);
                    assetData[field] = value || null;
                }
            });
            
            let response;
            if (this.currentEditingAsset) {
                // Update existing asset
                response = await fetch(`${API_BASE_URL}/assets/${this.currentEditingAsset.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(assetData)
                });
            } else {
                // Create new asset
                response = await fetch(`${API_BASE_URL}/assets`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(assetData)
                });
            }
            
            if (response.ok) {
                this.showNotification(
                    this.currentEditingAsset ? 'Asset updated successfully!' : 'Asset created successfully!',
                    'success'
                );
                this.hideAssetModal();
                this.loadAssets();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save asset');
            }
        } catch (error) {
            console.error('Error saving asset:', error);
            this.showNotification('Error saving asset: ' + error.message, 'error');
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
            const response = await fetch(`${API_BASE_URL}/assets/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showNotification('Asset deleted successfully!', 'success');
                this.loadAssets();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete asset');
            }
        } catch (error) {
            console.error('Error deleting asset:', error);
            this.showNotification('Error deleting asset: ' + error.message, 'error');
        }
    }

    refreshData() {
        this.loadDashboardData();
        this.loadAssets();
        this.showNotification('Data refreshed successfully!', 'success');
    }

    showMockDashboardData() {
        this.dashboardData = {
            totalAssets: 10,
            activeAssets: 8,
            maintenanceAssets: 1,
            filtersNeeded: 3
        };
        this.renderDashboardStats();
    }

    showMockAssets() {
        this.assets = [
            {
                id: '1',
                assetBarcode: 'WT001',
                status: 'ACTIVE',
                outletType: 'Water Tap',
                tapType: 'Push Button',
                spareColumn: '',
                wing: 'North',
                buildingCode: 'B1',
                roomId: 'R101',
                floorNumber: '1',
                floorName: 'Ground Floor',
                roomNumber: '101',
                roomName: 'Reception',
                hasFilter: true,
                filterNeeded: false,
                filterExpiryDate: '2024-12-31',
                filterInstalledDate: '2024-01-15',
                maintenanceNotes: 'Regular maintenance required',
                inUse: true,
                createdAt: '2024-01-01T10:00:00Z',
                createdBy: 'Admin',
                modifiedAt: '2024-01-15T14:30:00Z',
                modifiedBy: 'Admin'
            },
            {
                id: '2',
                assetBarcode: 'WT002',
                status: 'MAINTENANCE',
                outletType: 'Drinking Fountain',
                tapType: 'Sensor',
                spareColumn: '',
                wing: 'South',
                buildingCode: 'B2',
                roomId: 'R205',
                floorNumber: '2',
                floorName: 'Second Floor',
                roomNumber: '205',
                roomName: 'Cafeteria',
                hasFilter: true,
                filterNeeded: true,
                filterExpiryDate: '2024-06-30',
                filterInstalledDate: '2023-12-01',
                maintenanceNotes: 'Filter replacement needed',
                inUse: false,
                createdAt: '2024-01-02T11:00:00Z',
                createdBy: 'Admin',
                modifiedAt: '2024-01-16T09:15:00Z',
                modifiedBy: 'Technician'
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
        const loadingState = document.getElementById('loadingState');
        if (loadingState) loadingState.classList.remove('hidden');
    }

    hideLoading() {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) loadingState.classList.add('hidden');
    }

    showNotification(message, type) {
        const notification = document.getElementById('notification');
        const notificationMessage = document.getElementById('notificationMessage');
        const notificationIcon = document.getElementById('notificationIcon');
        
        if (notification && notificationMessage && notificationIcon) {
            notificationMessage.textContent = message;
            
            // Update icon based on type
            if (type === 'success') {
                notificationIcon.className = 'fas fa-check-circle text-green-400';
            } else if (type === 'error') {
                notificationIcon.className = 'fas fa-exclamation-circle text-red-400';
            } else {
                notificationIcon.className = 'fas fa-info-circle text-blue-400';
            }
            
            notification.classList.add('show');
            
            // Auto hide after 5 seconds
            setTimeout(() => {
                notification.classList.remove('show');
            }, 5000);
        }
    }

    downloadTemplate() {
        // Create Excel template with 22 fields
        const headers = [
            'assetBarcode', 'status', 'outletType', 'tapType', 'spareColumn', 'wing', 'buildingCode', 'roomId', 'floorNumber', 
            'floorName', 'roomNumber', 'roomName', 'hasFilter', 'filterNeeded', 'filterExpiryDate', 
            'filterInstalledDate', 'maintenanceNotes', 'inUse', 'createdBy', 'modifiedBy'
        ];
        
        const sampleData = [
            ['WT001', 'ACTIVE', 'Water Tap', 'Push Button', '', 'North', 'B1', 'R101', '1', 'Ground Floor', '101', 'Reception', 'TRUE', 'FALSE', '2024-12-31', '2024-01-15', 'Regular maintenance', 'TRUE', 'Admin', 'Admin']
        ];
        
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Assets');
        
        XLSX.writeFile(wb, 'water_tap_assets_template.xlsx');
        
        this.showNotification('Template downloaded successfully!', 'success');
    }

    showBulkUploadModal() {
        const modal = document.getElementById('bulkUploadModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideBulkUploadModal() {
        const modal = document.getElementById('bulkUploadModal');
        if (modal) {
            modal.classList.add('hidden');
            this.resetBulkUploadForm();
        }
    }

    resetBulkUploadForm() {
        const fileInput = document.getElementById('excelFileInput');
        const preview = document.getElementById('uploadPreview');
        if (fileInput) fileInput.value = '';
        if (preview) preview.classList.add('hidden');
        this.bulkUploadData = [];
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const data = await this.readExcelFile(file);
            this.bulkUploadData = this.processExcelData(data);
            this.showPreview(this.bulkUploadData);
        } catch (error) {
            console.error('Error processing file:', error);
            this.showNotification('Error processing file: ' + error.message, 'error');
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
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    processExcelData(data) {
        if (data.length < 2) {
            throw new Error('Excel file must contain headers and at least one data row');
        }
        
        const headers = data[0];
        const expectedHeaders = [
            'assetBarcode', 'status', 'outletType', 'tapType', 'spareColumn', 'wing', 'buildingCode', 'roomId', 'floorNumber', 
            'floorName', 'roomNumber', 'roomName', 'hasFilter', 'filterNeeded', 'filterExpiryDate', 
            'filterInstalledDate', 'maintenanceNotes', 'inUse', 'createdBy', 'modifiedBy'
        ];
        
        // Create header mapping
        const headerMap = {};
        expectedHeaders.forEach(expected => {
            const index = headers.findIndex(h => h && h.toString().toLowerCase() === expected.toLowerCase());
            if (index !== -1) {
                headerMap[expected] = index;
            }
        });
        
        const assets = [];
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            
            try {
                const asset = {
                    assetBarcode: this.getCellValue(row, headerMap['assetBarcode']),
                    status: (this.getCellValue(row, headerMap['status']) || 'ACTIVE').toUpperCase(),
                    outletType: this.getCellValue(row, headerMap['outletType']),
                    tapType: this.getCellValue(row, headerMap['tapType']),
                    spareColumn: this.getCellValue(row, headerMap['spareColumn']),
                    wing: this.getCellValue(row, headerMap['wing']),
                    buildingCode: this.getCellValue(row, headerMap['buildingCode']),
                    roomId: this.getCellValue(row, headerMap['roomId']),
                    floorNumber: this.getCellValue(row, headerMap['floorNumber']),
                    floorName: this.getCellValue(row, headerMap['floorName']),
                    roomNumber: this.getCellValue(row, headerMap['roomNumber']),
                    roomName: this.getCellValue(row, headerMap['roomName']),
                    hasFilter: this.parseBoolean(this.getCellValue(row, headerMap['hasFilter'])),
                    filterNeeded: this.parseBoolean(this.getCellValue(row, headerMap['filterNeeded'])),
                    filterExpiryDate: this.parseDate(this.getCellValue(row, headerMap['filterExpiryDate'])),
                    filterInstalledDate: this.parseDate(this.getCellValue(row, headerMap['filterInstalledDate'])),
                    maintenanceNotes: this.getCellValue(row, headerMap['maintenanceNotes']),
                    inUse: this.parseBoolean(this.getCellValue(row, headerMap['inUse']), true),
                    createdBy: this.getCellValue(row, headerMap['createdBy']) || 'Bulk Import',
                    modifiedBy: this.getCellValue(row, headerMap['modifiedBy']) || 'Bulk Import'
                };
                
                // Validate required fields
                if (!asset.assetBarcode) {
                    throw new Error(`Row ${i + 1}: assetBarcode is required`);
                }
                if (!asset.outletType) {
                    throw new Error(`Row ${i + 1}: outletType is required`);
                }
                if (!asset.tapType) {
                    throw new Error(`Row ${i + 1}: tapType is required`);
                }
                if (!asset.wing) {
                    throw new Error(`Row ${i + 1}: wing is required`);
                }
                
                assets.push(asset);
            } catch (error) {
                console.error(`Error processing row ${i + 1}:`, error);
                throw error;
            }
        }
        
        return assets;
    }

    getCellValue(row, index) {
        return (index !== undefined && row[index] !== undefined) ? row[index].toString().trim() : '';
    }

    parseBoolean(value, defaultValue = false) {
        if (!value) return defaultValue;
        const str = value.toString().toLowerCase();
        return str === 'true' || str === '1' || str === 'yes';
    }

    parseDate(value) {
        if (!value) return null;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    }

    showPreview(assets) {
        const preview = document.getElementById('uploadPreview');
        const previewHeaders = document.getElementById('previewHeaders');
        const previewBody = document.getElementById('previewBody');
        
        if (!preview || !previewHeaders || !previewBody) return;
        
        // Show headers for all 22 fields
        const headers = [
            'assetBarcode', 'status', 'outletType', 'tapType', 'spareColumn', 'wing', 'buildingCode', 'roomId', 'floorNumber', 
            'floorName', 'roomNumber', 'roomName', 'hasFilter', 'filterNeeded', 'filterExpiryDate', 
            'filterInstalledDate', 'maintenanceNotes', 'inUse', 'createdBy', 'modifiedBy'
        ];
        
        previewHeaders.innerHTML = headers.map(header => 
            `<th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">${header}</th>`
        ).join('');
        
        // Show first 5 rows
        const previewAssets = assets.slice(0, 5);
        previewBody.innerHTML = previewAssets.map(asset => `
            <tr class="border-t">
                <td class="px-2 py-2 text-xs">${asset.assetBarcode}</td>
                <td class="px-2 py-2 text-xs">${asset.status}</td>
                <td class="px-2 py-2 text-xs">${asset.outletType}</td>
                <td class="px-2 py-2 text-xs">${asset.tapType}</td>
                <td class="px-2 py-2 text-xs">${asset.spareColumn}</td>
                <td class="px-2 py-2 text-xs">${asset.wing}</td>
                <td class="px-2 py-2 text-xs">${asset.buildingCode}</td>
                <td class="px-2 py-2 text-xs">${asset.roomId}</td>
                <td class="px-2 py-2 text-xs">${asset.floorNumber}</td>
                <td class="px-2 py-2 text-xs">${asset.floorName}</td>
                <td class="px-2 py-2 text-xs">${asset.roomNumber}</td>
                <td class="px-2 py-2 text-xs">${asset.roomName}</td>
                <td class="px-2 py-2 text-xs">${asset.hasFilter ? 'Yes' : 'No'}</td>
                <td class="px-2 py-2 text-xs">${asset.filterNeeded ? 'Yes' : 'No'}</td>
                <td class="px-2 py-2 text-xs">${asset.filterExpiryDate || '-'}</td>
                <td class="px-2 py-2 text-xs">${asset.filterInstalledDate || '-'}</td>
                <td class="px-2 py-2 text-xs max-w-xs truncate">${asset.maintenanceNotes || '-'}</td>
                <td class="px-2 py-2 text-xs">${asset.inUse ? 'Yes' : 'No'}</td>
                <td class="px-2 py-2 text-xs">${asset.createdBy}</td>
                <td class="px-2 py-2 text-xs">${asset.modifiedBy}</td>
            </tr>
        `).join('');
        
        preview.classList.remove('hidden');
        this.showNotification(`${assets.length} assets ready for import`, 'success');
    }

    async importAssets() {
        if (this.bulkUploadData.length === 0) {
            this.showNotification('No data to import', 'error');
            return;
        }
        
        try {
            let successCount = 0;
            let errorCount = 0;
            
            for (const asset of this.bulkUploadData) {
                try {
                    const response = await fetch(`${API_BASE_URL}/assets`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(asset)
                    });
                    
                    if (response.ok) {
                        successCount++;
                    } else {
                        errorCount++;
                        console.error('Failed to import asset:', asset.assetBarcode);
                    }
                } catch (error) {
                    errorCount++;
                    console.error('Error importing asset:', asset.assetBarcode, error);
                }
            }
            
            this.showNotification(
                `Import completed: ${successCount} successful, ${errorCount} failed`,
                errorCount === 0 ? 'success' : 'error'
            );
            
            this.hideBulkUploadModal();
            this.loadAssets();
        } catch (error) {
            console.error('Error during bulk import:', error);
            this.showNotification('Error during bulk import: ' + error.message, 'error');
        }
    }
}

// Global instance
const assetManager = new WaterTapAssetManager();

console.log('Water Tap Asset Management System loaded');
console.log('API Base URL:', API_BASE_URL); 