const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();

// Table names from environment variables
const ASSETS_TABLE = process.env.ASSETS_TABLE || 'WaterTapAssetAssets';
const MAINTENANCE_TABLE = process.env.MAINTENANCE_TABLE || 'WaterTapAssetMaintenance';
const LOCATIONS_TABLE = process.env.LOCATIONS_TABLE || 'WaterTapAssetLocations';

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://main.d25j5qt77sjegi.amplifyapp.com',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
};

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // Handle preflight OPTIONS requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }
    
    try {
        const { httpMethod, path, pathParameters } = event;
        const body = event.body ? JSON.parse(event.body) : {};
        
        let response;
        
        // Route requests
        if (path === '/dashboard' && httpMethod === 'GET') {
            response = await getDashboardData();
        } else if (path === '/items/dashboard' && httpMethod === 'GET') {
            response = await getDashboardData();
        } else if (path === '/assets' && httpMethod === 'GET') {
            response = await getAssets();
        } else if (path === '/assets' && httpMethod === 'POST') {
            response = await createAsset(body);
        } else if (path.startsWith('/assets/') && httpMethod === 'PUT') {
            const assetId = pathParameters.id;
            response = await updateAsset(assetId, body);
        } else if (path.startsWith('/assets/') && httpMethod === 'DELETE') {
            const assetId = pathParameters.id;
            response = await deleteAsset(assetId);
        } else if (path === '/items/assets' && httpMethod === 'GET') {
            response = await getAssets();
        } else if (path === '/items/assets' && httpMethod === 'POST') {
            response = await createAsset(body);
        } else if (path.startsWith('/items/assets/') && httpMethod === 'PUT') {
            console.log('PUT request - pathParameters:', JSON.stringify(pathParameters));
            console.log('PUT request - path:', path);
            const assetId = pathParameters.id || path.split('/').pop();
            console.log('PUT request - extracted assetId:', assetId);
            response = await updateAsset(assetId, body);
        } else if (path.startsWith('/items/assets/') && httpMethod === 'DELETE') {
            console.log('DELETE request - pathParameters:', JSON.stringify(pathParameters));
            console.log('DELETE request - path:', path);
            const assetId = pathParameters.id || path.split('/').pop();
            console.log('DELETE request - extracted assetId:', assetId);
            response = await deleteAsset(assetId);
        } else if (path === '/items/locations' && httpMethod === 'GET') {
            response = await getLocations();
        } else if (path === '/items/maintenance' && httpMethod === 'GET') {
            response = await getMaintenanceRecords();
        } else {
            response = {
                statusCode: 404,
                body: JSON.stringify({ error: 'Not found' })
            };
        }
        
        return {
            ...response,
            headers: { ...corsHeaders, ...response.headers }
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: error.message })
        };
    }
};

async function getDashboardData() {
    try {
        const assets = await getAllAssets();
        
        // Calculate dashboard statistics
        const totalAssets = assets.length;
        const activeAssets = assets.filter(asset => asset.status === 'ACTIVE').length;
        const maintenanceAssets = assets.filter(asset => asset.status === 'MAINTENANCE').length;
        const filtersNeeded = assets.filter(asset => asset.filterNeeded === true).length;
        
        // Status breakdown
        const statusBreakdown = assets.reduce((acc, asset) => {
            acc[asset.status] = (acc[asset.status] || 0) + 1;
            return acc;
        }, {});
        
        // Outlet type breakdown
        const outletTypeBreakdown = assets.reduce((acc, asset) => {
            const type = asset.outletType || 'Unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        
        // Wing breakdown
        const wingBreakdown = assets.reduce((acc, asset) => {
            const wing = asset.wing || 'Unknown';
            acc[wing] = (acc[wing] || 0) + 1;
            return acc;
        }, {});
        
        // Filter status
        const filterStatus = {
            hasFilter: assets.filter(asset => asset.hasFilter === true).length,
            filtersNeeded: filtersNeeded,
            inUse: assets.filter(asset => asset.inUse === true).length
        };
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                totalAssets,
                activeAssets,
                maintenanceAssets,
                filtersNeeded,
                statusBreakdown,
                outletTypeBreakdown,
                wingBreakdown,
                filterStatus
            })
        };
    } catch (error) {
        console.error('Error getting dashboard data:', error);
        throw error;
    }
}

async function getAssets() {
    try {
        const assets = await getAllAssets();
        return {
            statusCode: 200,
            body: JSON.stringify({ items: assets, assets: assets, count: assets.length })
        };
    } catch (error) {
        console.error('Error getting assets:', error);
        throw error;
    }
}

async function getAllAssets() {
    const params = {
        TableName: ASSETS_TABLE
    };
    
    const result = await dynamodb.scan(params).promise();
    return result.Items || [];
}

async function createAsset(assetData) {
    try {
        console.log('Creating asset with data:', JSON.stringify(assetData, null, 2));
        
        // Validate required fields for new 22-field schema
        if (!assetData.assetBarcode) {
            throw new Error('assetBarcode is required');
        }
        if (!assetData.outletType) {
            throw new Error('outletType is required');
        }
        if (!assetData.tapType) {
            throw new Error('tapType is required');
        }
        if (!assetData.wing) {
            throw new Error('wing is required');
        }
        
        // Generate ID using UUID format
        const assetId = uuidv4();
        const now = new Date().toISOString();
        
        const asset = {
            id: assetId,
            assetBarcode: assetData.assetBarcode,
            status: (assetData.status || 'ACTIVE').toUpperCase(),
            outletType: assetData.outletType,
            tapType: assetData.tapType,
            spareColumn: assetData.spareColumn || null,
            wing: assetData.wing,
            buildingCode: assetData.buildingCode || null,
            roomId: assetData.roomId || null,
            floorNumber: assetData.floorNumber || null,
            floorName: assetData.floorName || null,
            roomNumber: assetData.roomNumber || null,
            roomName: assetData.roomName || null,
            hasFilter: Boolean(assetData.hasFilter),
            filterNeeded: Boolean(assetData.filterNeeded),
            filterExpiryDate: assetData.filterExpiryDate || null,
            filterInstalledDate: assetData.filterInstalledDate || null,
            maintenanceNotes: assetData.maintenanceNotes || null,
            inUse: Boolean(assetData.inUse !== false), // Default to true
            createdAt: now,
            createdBy: assetData.createdBy || 'System',
            modifiedAt: now,
            modifiedBy: assetData.modifiedBy || 'System'
        };
        
        const params = {
            TableName: ASSETS_TABLE,
            Item: asset
        };
        
        await dynamodb.put(params).promise();
        
        return {
            statusCode: 201,
            body: JSON.stringify({ asset, message: 'Asset created successfully' })
        };
    } catch (error) {
        console.error('Error creating asset:', error);
        throw error;
    }
}

async function updateAsset(assetId, assetData) {
    try {
        console.log('Updating asset:', assetId, 'with data:', JSON.stringify(assetData, null, 2));
        
        if (!assetId) {
            throw new Error('Asset ID is required');
        }
        
        const now = new Date().toISOString();
        
        // Build update expression dynamically for new 22-field schema
        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        
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
            'modifiedBy': 'modifiedBy'
        };
        
        Object.keys(fieldMappings).forEach(field => {
            if (assetData.hasOwnProperty(field)) {
                const dbField = fieldMappings[field];
                updateExpressions.push(`#${dbField} = :${dbField}`);
                expressionAttributeNames[`#${dbField}`] = dbField;
                
                if (field === 'status' && assetData[field]) {
                    expressionAttributeValues[`:${dbField}`] = assetData[field].toUpperCase();
                } else if (field === 'hasFilter' || field === 'filterNeeded' || field === 'inUse') {
                    expressionAttributeValues[`:${dbField}`] = Boolean(assetData[field]);
                } else {
                    expressionAttributeValues[`:${dbField}`] = assetData[field];
                }
            }
        });
        
        // Always update modifiedAt
        updateExpressions.push('#modifiedAt = :modifiedAt');
        expressionAttributeNames['#modifiedAt'] = 'modifiedAt';
        expressionAttributeValues[':modifiedAt'] = now;
        
        if (updateExpressions.length === 0) {
            throw new Error('No valid fields to update');
        }
        
        const params = {
            TableName: ASSETS_TABLE,
            Key: { id: assetId },
            UpdateExpression: 'SET ' + updateExpressions.join(', '),
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        };
        
        console.log('Update params:', JSON.stringify(params, null, 2));
        
        const result = await dynamodb.update(params).promise();
        
        return {
            statusCode: 200,
            body: JSON.stringify({ asset: result.Attributes, message: 'Asset updated successfully' })
        };
    } catch (error) {
        console.error('Error updating asset:', error);
        throw error;
    }
}

async function deleteAsset(assetId) {
    try {
        console.log('Deleting asset:', assetId);
        
        if (!assetId) {
            throw new Error('Asset ID is required');
        }
        
        const params = {
            TableName: ASSETS_TABLE,
            Key: { id: assetId }
        };
        
        await dynamodb.delete(params).promise();
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Asset deleted successfully' })
        };
    } catch (error) {
        console.error('Error deleting asset:', error);
        throw error;
    }
}

async function getLocations() {
    try {
        const params = {
            TableName: LOCATIONS_TABLE
        };
        
        const result = await dynamodb.scan(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify({ items: result.Items || [], count: (result.Items || []).length })
        };
    } catch (error) {
        console.error('Error getting locations:', error);
        return {
            statusCode: 200,
            body: JSON.stringify({ items: [], count: 0 })
        };
    }
}

async function getMaintenanceRecords() {
    try {
        const params = {
            TableName: MAINTENANCE_TABLE
        };
        
        const result = await dynamodb.scan(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify({ items: result.Items || [], count: (result.Items || []).length })
        };
    } catch (error) {
        console.error('Error getting maintenance records:', error);
        return {
            statusCode: 200,
            body: JSON.stringify({ items: [], count: 0 })
        };
    }
} 