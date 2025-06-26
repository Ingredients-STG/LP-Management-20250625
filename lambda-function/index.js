const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();

// Table names from environment variables
const ASSETS_TABLE = process.env.ASSETS_TABLE || 'WaterTapAssetAssets';
const MAINTENANCE_TABLE = process.env.MAINTENANCE_TABLE || 'WaterTapMaintenance';
const LOCATIONS_TABLE = process.env.LOCATIONS_TABLE || 'WaterTapLocations';

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
            const assetId = pathParameters.id;
            response = await updateAsset(assetId, body);
        } else if (path.startsWith('/items/assets/') && httpMethod === 'DELETE') {
            const assetId = pathParameters.id;
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
        
        // Asset type breakdown
        const assetTypeBreakdown = assets.reduce((acc, asset) => {
            const type = asset.assetType || 'Unknown';
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
            filtersOn: assets.filter(asset => asset.filtersOn === true).length,
            filtersNeeded: filtersNeeded,
            augmentedCare: assets.filter(asset => asset.augmentedCare === true).length
        };
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                totalAssets,
                activeAssets,
                maintenanceAssets,
                filtersNeeded,
                statusBreakdown,
                assetTypeBreakdown,
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
        
        // Validate required fields
        if (!assetData.assetBarcode) {
            throw new Error('assetBarcode is required');
        }
        if (!assetData.assetType) {
            throw new Error('assetType is required');
        }
        if (!assetData.primaryIdentifier) {
            throw new Error('primaryIdentifier is required');
        }
        
        // Generate ID using UUID format to match existing data
        const assetId = uuidv4();
        const now = new Date().toISOString();
        
        const asset = {
            id: assetId,
            assetBarcode: assetData.assetBarcode,
            status: (assetData.status || 'ACTIVE').toUpperCase(),
            assetType: assetData.assetType,
            primaryIdentifier: assetData.primaryIdentifier,
            secondaryIdentifier: assetData.secondaryIdentifier || '',
            wing: assetData.wing || '',
            wingInShort: assetData.wingInShort || '',
            room: assetData.room || '',
            floor: assetData.floor || '',
            floorInWords: assetData.floorInWords || '',
            roomNo: assetData.roomNo || '',
            roomName: assetData.roomName || '',
            filterNeeded: assetData.filterNeeded === true,
            filtersOn: assetData.filtersOn === true,
            filterExpiryDate: assetData.filterExpiryDate || '',
            filterInstalledOn: assetData.filterInstalledOn || '',
            notes: assetData.notes || '',
            augmentedCare: assetData.augmentedCare === true,
            created: assetData.created || now,
            createdBy: assetData.createdBy || 'System',
            modified: assetData.modified || now,
            modifiedBy: assetData.modifiedBy || 'System'
        };
        
        console.log('Asset to be saved:', JSON.stringify(asset, null, 2));
        
        const params = {
            TableName: ASSETS_TABLE,
            Item: asset
        };
        
        console.log('DynamoDB params:', JSON.stringify(params, null, 2));
        
        await dynamodb.put(params).promise();
        
        console.log('Asset created successfully');
        
        return {
            statusCode: 201,
            body: JSON.stringify(asset)
        };
    } catch (error) {
        console.error('Error creating asset:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        throw error;
    }
}

async function updateAsset(assetId, assetData) {
    try {
        console.log('Updating asset ID:', assetId);
        console.log('Update data:', JSON.stringify(assetData, null, 2));
        
        const now = new Date().toISOString();
        
        // Build update expression
        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        
        const fields = [
            'assetBarcode', 'status', 'assetType', 'primaryIdentifier', 'secondaryIdentifier',
            'wing', 'wingInShort', 'room', 'floor', 'floorInWords', 'roomNo', 'roomName',
            'filterNeeded', 'filtersOn', 'filterExpiryDate', 'filterInstalledOn', 'notes', 'augmentedCare'
        ];
        
        fields.forEach(field => {
            if (assetData.hasOwnProperty(field)) {
                updateExpressions.push(`#${field} = :${field}`);
                expressionAttributeNames[`#${field}`] = field;
                // Normalize status to uppercase
                if (field === 'status' && assetData[field]) {
                    expressionAttributeValues[`:${field}`] = assetData[field].toUpperCase();
                } else {
                    expressionAttributeValues[`:${field}`] = assetData[field];
                }
            }
        });
        
        // Always update modified timestamp and user
        updateExpressions.push('#modified = :modified');
        updateExpressions.push('#modifiedBy = :modifiedBy');
        expressionAttributeNames['#modified'] = 'modified';
        expressionAttributeNames['#modifiedBy'] = 'modifiedBy';
        expressionAttributeValues[':modified'] = now;
        expressionAttributeValues[':modifiedBy'] = assetData.modifiedBy || 'System';
        
        const params = {
            TableName: ASSETS_TABLE,
            Key: { id: assetId },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        };
        
        console.log('DynamoDB update params:', JSON.stringify(params, null, 2));
        
        const result = await dynamodb.update(params).promise();
        
        console.log('Asset updated successfully');
        
        return {
            statusCode: 200,
            body: JSON.stringify(result.Attributes)
        };
    } catch (error) {
        console.error('Error updating asset:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        throw error;
    }
}

async function deleteAsset(assetId) {
    try {
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
            body: JSON.stringify({ items: result.Items || [] })
        };
    } catch (error) {
        console.error('Error getting locations:', error);
        throw error;
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
            body: JSON.stringify({ items: result.Items || [] })
        };
    } catch (error) {
        console.error('Error getting maintenance records:', error);
        throw error;
    }
}

// Using uuidv4() for ID generation 