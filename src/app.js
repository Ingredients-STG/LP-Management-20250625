// API Configuration
const API_BASE_URL = 'https://r1iqp059n5.execute-api.eu-west-2.amazonaws.com/dev';

class WaterTapAssetManager {
    constructor() {
        this.assets = [];
        this.dashboardData = {};
        this.currentEditingAsset = null;
        this.bulkUploadData = [];
        
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

        // Bulk upload functionality
        document.getElementById('downloadTemplateBtn').addEventListener('click', () => {
            this.downloadTemplate();
        });

        document.getElementById('bulkUploadBtn').addEventListener('click', () => {
            this.showBulkUploadModal();
        });

        document.getElementById('cancelBulkUpload').addEventListener('click', () => {
            this.hideBulkUploadModal();
        });

        document.getElementById('excelFileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e);
        });

        document.getElementById('importAssetsBtn').addEventListener('click', () => {
            this.importAssets();
        });

        // Close bulk upload modal on background click
        document.getElementById('bulkUploadModal').addEventListener('click', (e) => {
            if (e.target.id === 'bulkUploadModal') {
                this.hideBulkUploadModal();
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
        const assets = assetsToRender || this.assets;
        const tableBody = document.getElementById('assetsTableBody');
        
        if (assets.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="22" class="px-6 py-4 text-center text-gray-500">
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
                        ${asset.status || 'ACTIVE'}
                    </span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.outletType || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.tapType || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.wing || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.buildingCode || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.roomId || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.floorNumber || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.floorName || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.roomNumber || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.roomName || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${asset.hasFilter ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                        ${asset.hasFilter ? 'Yes' : 'No'}
                    </span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${asset.filterNeeded ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}">
                        ${asset.filterNeeded ? 'Yes' : 'No'}
                    </span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatDate(asset.filterExpiryDate)}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatDate(asset.filterInstalledDate)}</td>
                <td class="px-4 py-4 text-sm text-gray-900 max-w-xs truncate" title="${asset.maintenanceNotes || ''}">${asset.maintenanceNotes || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${asset.inUse ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                        ${asset.inUse ? 'Yes' : 'No'}
                    </span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatDate(asset.createdAt)}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${asset.createdBy || '-'}</td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatDate(asset.modifiedAt)}</td>
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
        switch (status) {
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

    formatDate(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString();
    }

    updateAssetCount() {
        document.getElementById('assetCount').textContent = `${this.assets.length} assets`;
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
                asset.outletType,
                asset.tapType,
                asset.wing,
                asset.buildingCode,
                asset.roomId,
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
            form.querySelector('[name="hasFilter"]').value = 'false';
            form.querySelector('[name="filterNeeded"]').value = 'false';
            form.querySelector('[name="inUse"]').value = 'true';
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
            'assetBarcode', 'status', 'outletType', 'tapType', 'wing', 'buildingCode',
            'roomId', 'floorNumber', 'floorName', 'roomNumber', 'roomName',
            'filterExpiryDate', 'filterInstalledDate', 'maintenanceNotes',
            'createdBy', 'modifiedBy'
        ];
        
        fields.forEach(field => {
            const input = form.querySelector(`[name="${field}"]`);
            if (input && asset[field] !== undefined) {
                input.value = asset[field];
            }
        });

        // Handle boolean fields
        form.querySelector('[name="hasFilter"]').value = asset.hasFilter ? 'true' : 'false';
        form.querySelector('[name="filterNeeded"]').value = asset.filterNeeded ? 'true' : 'false';
        form.querySelector('[name="inUse"]').value = asset.inUse ? 'true' : 'false';
    }

    async handleSaveAsset(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const assetData = {};
        
        // Convert form data to object
        for (let [key, value] of formData.entries()) {
            if (key === 'hasFilter' || key === 'filterNeeded' || key === 'inUse') {
                assetData[key] = value === 'true';
            } else if (key === 'floorNumber') {
                assetData[key] = value ? parseInt(value) : 0;
            } else {
                assetData[key] = value;
            }
        }

        // Set modification data
        assetData.modifiedBy = assetData.modifiedBy || 'User';
        
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
                assetData.createdBy = assetData.createdBy || 'User';
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

    showMockDashboardData() {
        this.dashboardData = {
            totalAssets: 0,
            activeAssets: 0,
            maintenanceAssets: 0,
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
        document.getElementById('loadingOverlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }

    showNotification(message, type) {
        const notification = document.getElementById('notification');
        const icon = document.getElementById('notificationIcon');
        const messageEl = document.getElementById('notificationMessage');
        
        messageEl.textContent = message;
        
        if (type === 'success') {
            icon.className = 'fas fa-check-circle text-green-500 h-6 w-6';
        } else {
            icon.className = 'fas fa-exclamation-circle text-red-500 h-6 w-6';
        }
        
        notification.classList.remove('hidden');
        
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 5000);
    }

    downloadTemplate() {
        // Create Excel template with new schema
        const headers = [
            'Asset Barcode', 'Status', 'Outlet Type', 'Tap Type', 'Wing', 'Building Code',
            'Room ID', 'Floor Number', 'Floor Name', 'Room Number', 'Room Name',
            'Has Filter', 'Filter Needed', 'Filter Expiry Date', 'Filter Installed Date',
            'Maintenance Notes', 'In Use', 'Created By', 'Modified By'
        ];

        const sampleData = [
            [
                'WT001', 'ACTIVE', 'Wall Mounted', 'Push Button', 'North Wing', 'B001',
                'R101', '1', 'Ground Floor', '101', 'Reception', 'true', 'false',
                '2024-12-31', '2024-01-15', 'Regular maintenance required', 'true', 'Admin', 'Admin'
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
            'Asset Barcode', 'Status', 'Outlet Type', 'Tap Type', 'Wing', 'Building Code',
            'Room ID', 'Floor Number', 'Floor Name', 'Room Number', 'Room Name',
            'Has Filter', 'Filter Needed', 'Filter Expiry Date', 'Filter Installed Date',
            'Maintenance Notes', 'In Use', 'Created By', 'Modified By'
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
                assetBarcode: this.getCellValue(row, headerMap['Asset Barcode']),
                status: this.getCellValue(row, headerMap['Status']) || 'ACTIVE',
                outletType: this.getCellValue(row, headerMap['Outlet Type']),
                tapType: this.getCellValue(row, headerMap['Tap Type']),
                wing: this.getCellValue(row, headerMap['Wing']),
                buildingCode: this.getCellValue(row, headerMap['Building Code']),
                roomId: this.getCellValue(row, headerMap['Room ID']),
                floorNumber: this.parseNumber(this.getCellValue(row, headerMap['Floor Number'])),
                floorName: this.getCellValue(row, headerMap['Floor Name']),
                roomNumber: this.getCellValue(row, headerMap['Room Number']),
                roomName: this.getCellValue(row, headerMap['Room Name']),
                hasFilter: this.parseBoolean(this.getCellValue(row, headerMap['Has Filter'])),
                filterNeeded: this.parseBoolean(this.getCellValue(row, headerMap['Filter Needed'])),
                filterExpiryDate: this.parseDate(this.getCellValue(row, headerMap['Filter Expiry Date'])),
                filterInstalledDate: this.parseDate(this.getCellValue(row, headerMap['Filter Installed Date'])),
                maintenanceNotes: this.getCellValue(row, headerMap['Maintenance Notes']),
                inUse: this.parseBoolean(this.getCellValue(row, headerMap['In Use']), true),
                createdBy: this.getCellValue(row, headerMap['Created By']) || 'Bulk Upload',
                modifiedBy: this.getCellValue(row, headerMap['Modified By']) || 'Bulk Upload'
            };

            // Validate required fields
            if (!asset.assetBarcode) {
                throw new Error(`Row ${i + 1}: Asset Barcode is required`);
            }
            if (!asset.outletType) {
                throw new Error(`Row ${i + 1}: Outlet Type is required`);
            }
            if (!asset.tapType) {
                throw new Error(`Row ${i + 1}: Tap Type is required`);
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

    parseNumber(value) {
        if (!value) return 0;
        const num = parseInt(value);
        return isNaN(num) ? 0 : num;
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
            'Asset Barcode', 'Status', 'Outlet Type', 'Tap Type', 'Wing', 'Building Code',
            'Room ID', 'Floor Number', 'Floor Name', 'Room Number', 'Room Name',
            'Has Filter', 'Filter Needed', 'In Use'
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
                        <td class="px-2 py-2 text-xs">${asset.outletType}</td>
                        <td class="px-2 py-2 text-xs">${asset.tapType}</td>
                        <td class="px-2 py-2 text-xs">${asset.wing}</td>
                        <td class="px-2 py-2 text-xs">${asset.buildingCode}</td>
                        <td class="px-2 py-2 text-xs">${asset.roomId}</td>
                        <td class="px-2 py-2 text-xs">${asset.floorNumber}</td>
                        <td class="px-2 py-2 text-xs">${asset.floorName}</td>
                        <td class="px-2 py-2 text-xs">${asset.roomNumber}</td>
                        <td class="px-2 py-2 text-xs">${asset.roomName}</td>
                        <td class="px-2 py-2 text-xs">${asset.hasFilter ? 'Yes' : 'No'}</td>
                        <td class="px-2 py-2 text-xs">${asset.filterNeeded ? 'Yes' : 'No'}</td>
                        <td class="px-2 py-2 text-xs">${asset.inUse ? 'Yes' : 'No'}</td>
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
});

console.log('Water Tap Asset Management System loaded');
console.log('API Base URL:', API_BASE_URL); 