const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();

// Table names from environment variables
const ASSETS_TABLE = process.env.ASSETS_TABLE || 'WaterTapAssetAssets';
const MAINTENANCE_TABLE = process.env.MAINTENANCE_TABLE || 'WaterTapAssetMaintenance';
const LOCATIONS_TABLE = process.env.LOCATIONS_TABLE || 'WaterTapAssetLocations';

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Max-Age": "86400"
    };

    try {
        const { httpMethod, pathParameters, body, path } = event;
        
        // Handle CORS preflight
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify('OK')
            };
        }

        // Extract resource from path
        const pathParts = path.split('/').filter(part => part !== '');
        console.log('Path parts:', pathParts);
        
        // Handle different path structures: /items/{resource} or /dev/items/{resource}
        let resourceIndex = pathParts.indexOf('items') + 1;
        if (resourceIndex === 0) {
            // Fallback: assume items is at index 1
            resourceIndex = 2;
        }
        
        const resource = pathParts[resourceIndex]; // resource after 'items'
        const id = pathParts[resourceIndex + 1]; // optional ID

        console.log(`Resource: ${resource}, ID: ${id}, Method: ${httpMethod}`);

        switch (resource) {
            case 'assets':
                return await handleAssets(httpMethod, id, body);
            case 'maintenance':
                return await handleMaintenance(httpMethod, id, body);
            case 'locations':
                return await handleLocations(httpMethod, id, body);
            case 'dashboard':
                return await handleDashboard();
            default:
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Resource not found' })
                };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
            },
            body: JSON.stringify({ error: 'Internal server error', details: error.message })
        };
    }
};

// Asset Management Functions
async function handleAssets(method, id, body) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
    };

    switch (method) {
        case 'GET':
            if (id) {
                return await getAsset(id);
            } else {
                return await getAllAssets();
            }
        case 'POST':
            return await createAsset(JSON.parse(body || '{}'));
        case 'PUT':
            return await updateAsset(id, JSON.parse(body || '{}'));
        case 'DELETE':
            return await deleteAsset(id);
        default:
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
    }
}

async function getAllAssets() {
    const params = {
        TableName: ASSETS_TABLE
    };

    const result = await dynamodb.scan(params).promise();
    
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        body: JSON.stringify({
            assets: result.Items,
            count: result.Count
        })
    };
}

async function getAsset(id) {
    const params = {
        TableName: ASSETS_TABLE,
        Key: { id }
    };

    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
        return {
            statusCode: 404,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
            },
            body: JSON.stringify({ error: 'Asset not found' })
        };
    }

    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        body: JSON.stringify(result.Item)
    };
}

async function createAsset(assetData) {
    const currentTimestamp = new Date().toISOString();
    const asset = {
        id: uuidv4(),
        // New 22-field schema
        assetBarcode: assetData.assetBarcode || '',
        status: assetData.status || 'ACTIVE',
        outletType: assetData.outletType || '',
        tapType: assetData.tapType || '',
        spareColumn: assetData.spareColumn || '',
        wing: assetData.wing || '',
        buildingCode: assetData.buildingCode || '',
        roomId: assetData.roomId || '',
        floorNumber: assetData.floorNumber || 0,
        floorName: assetData.floorName || '',
        roomNumber: assetData.roomNumber || '',
        roomName: assetData.roomName || '',
        hasFilter: assetData.hasFilter || false,
        filterNeeded: assetData.filterNeeded || false,
        filterExpiryDate: assetData.filterExpiryDate || '',
        filterInstalledDate: assetData.filterInstalledDate || '',
        maintenanceNotes: assetData.maintenanceNotes || '',
        inUse: assetData.inUse !== undefined ? assetData.inUse : true,
        createdAt: assetData.createdAt || currentTimestamp,
        createdBy: assetData.createdBy || 'System',
        modifiedAt: currentTimestamp,
        modifiedBy: assetData.modifiedBy || 'System'
    };

    const params = {
        TableName: ASSETS_TABLE,
        Item: asset,
        ConditionExpression: 'attribute_not_exists(assetBarcode)',
        ExpressionAttributeNames: {
            '#assetBarcode': 'assetBarcode'
        }
    };

    try {
        await dynamodb.put(params).promise();
        return {
            statusCode: 201,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
            },
            body: JSON.stringify(asset)
        };
    } catch (error) {
        if (error.code === 'ConditionalCheckFailedException') {
            return {
                statusCode: 409,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
                },
                body: JSON.stringify({ error: 'Asset with this barcode already exists' })
            };
        }
        throw error;
    }
}

async function updateAsset(id, updates) {
    const currentTimestamp = new Date().toISOString();
    
    // Build update expression dynamically
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    // Always update modifiedAt
    updates.modifiedAt = currentTimestamp;
    
    // Fields that can be updated
    const allowedFields = [
        'assetBarcode', 'status', 'outletType', 'tapType', 'spareColumn',
        'wing', 'buildingCode', 'roomId', 'floorNumber', 'floorName',
        'roomNumber', 'roomName', 'hasFilter', 'filterNeeded',
        'filterExpiryDate', 'filterInstalledDate', 'maintenanceNotes',
        'inUse', 'modifiedAt', 'modifiedBy'
    ];
    
    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key) && updates[key] !== undefined) {
            updateExpressions.push(`#${key} = :${key}`);
            expressionAttributeNames[`#${key}`] = key;
            expressionAttributeValues[`:${key}`] = updates[key];
        }
    });
    
    if (updateExpressions.length === 0) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
            },
            body: JSON.stringify({ error: 'No valid fields to update' })
        };
    }

    const params = {
        TableName: ASSETS_TABLE,
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
    };

    try {
        const result = await dynamodb.update(params).promise();
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
            },
            body: JSON.stringify(result.Attributes)
        };
    } catch (error) {
        return {
            statusCode: 404,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
            },
            body: JSON.stringify({ error: 'Asset not found' })
        };
    }
}

async function deleteAsset(id) {
    const params = {
        TableName: ASSETS_TABLE,
        Key: { id }
    };

    await dynamodb.delete(params).promise();
    
    return {
        statusCode: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        body: ''
    };
}

// Maintenance Management Functions
async function handleMaintenance(method, id, body) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
    };

    switch (method) {
        case 'GET':
            if (id) {
                return await getMaintenanceRecord(id);
            } else {
                return await getAllMaintenanceRecords();
            }
        case 'POST':
            return await createMaintenanceRecord(JSON.parse(body || '{}'));
        case 'PUT':
            return await updateMaintenanceRecord(id, JSON.parse(body || '{}'));
        default:
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
    }
}

async function getAllMaintenanceRecords() {
    const params = {
        TableName: MAINTENANCE_TABLE
    };

    const result = await dynamodb.scan(params).promise();
    
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        body: JSON.stringify({
            maintenance: result.Items,
            count: result.Count
        })
    };
}

async function getMaintenanceRecord(id) {
    const params = {
        TableName: MAINTENANCE_TABLE,
        Key: { id }
    };

    const result = await dynamodb.get(params).promise();
    
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        body: JSON.stringify(result.Item)
    };
}

async function createMaintenanceRecord(maintenanceData) {
    const maintenance = {
        id: uuidv4(),
        assetId: maintenanceData.assetId,
        maintenanceType: maintenanceData.maintenanceType,
        scheduledDate: maintenanceData.scheduledDate,
        completedDate: maintenanceData.completedDate,
        technician: maintenanceData.technician,
        notes: maintenanceData.notes,
        cost: maintenanceData.cost,
        status: maintenanceData.status || 'SCHEDULED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const params = {
        TableName: MAINTENANCE_TABLE,
        Item: maintenance
    };

    await dynamodb.put(params).promise();
    
    return {
        statusCode: 201,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        body: JSON.stringify(maintenance)
    };
}

async function updateMaintenanceRecord(id, updates) {
    updates.updatedAt = new Date().toISOString();
    
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
            updateExpressions.push(`#${key} = :${key}`);
            expressionAttributeNames[`#${key}`] = key;
            expressionAttributeValues[`:${key}`] = updates[key];
        }
    });

    const params = {
        TableName: MAINTENANCE_TABLE,
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(params).promise();
    
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        body: JSON.stringify(result.Attributes)
    };
}

// Location Management Functions
async function handleLocations(method, id, body) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
    };

    switch (method) {
        case 'GET':
            return await getAllLocations();
        case 'POST':
            return await createLocation(JSON.parse(body || '{}'));
        default:
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
    }
}

async function getAllLocations() {
    const params = {
        TableName: LOCATIONS_TABLE
    };

    const result = await dynamodb.scan(params).promise();
    
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        body: JSON.stringify({
            locations: result.Items,
            count: result.Count
        })
    };
}

async function createLocation(locationData) {
    const location = {
        id: uuidv4(),
        wing: locationData.wing,
        buildingCode: locationData.buildingCode,
        floorNumber: locationData.floorNumber,
        floorName: locationData.floorName,
        roomNumber: locationData.roomNumber,
        roomName: locationData.roomName,
        roomId: locationData.roomId,
        description: locationData.description
    };

    const params = {
        TableName: LOCATIONS_TABLE,
        Item: location
    };

    await dynamodb.put(params).promise();
    
    return {
        statusCode: 201,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        body: JSON.stringify(location)
    };
}

// Dashboard Functions
async function handleDashboard() {
    try {
        const params = {
            TableName: ASSETS_TABLE
        };

        const result = await dynamodb.scan(params).promise();
        const assets = result.Items;

        const stats = {
            totalAssets: assets.length,
            activeAssets: assets.filter(asset => asset.status === 'ACTIVE').length,
            maintenanceAssets: assets.filter(asset => asset.status === 'MAINTENANCE').length,
            inactiveAssets: assets.filter(asset => asset.status === 'INACTIVE').length,
            decommissionedAssets: assets.filter(asset => asset.status === 'DECOMMISSIONED').length,
            assetsWithFilters: assets.filter(asset => asset.hasFilter === true).length,
            filtersNeeded: assets.filter(asset => asset.filterNeeded === true).length,
            assetsInUse: assets.filter(asset => asset.inUse === true).length,
            // Breakdown by outlet type
            outletTypes: assets.reduce((acc, asset) => {
                acc[asset.outletType] = (acc[asset.outletType] || 0) + 1;
                return acc;
            }, {}),
            // Breakdown by tap type
            tapTypes: assets.reduce((acc, asset) => {
                acc[asset.tapType] = (acc[asset.tapType] || 0) + 1;
                return acc;
            }, {})
        };

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
            },
            body: JSON.stringify(stats)
        };
    } catch (error) {
        console.error('Dashboard error:', error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
            },
            body: JSON.stringify({ error: 'Failed to load dashboard data' })
        };
    }
} 