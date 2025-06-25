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
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
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
        const resource = pathParts[1]; // /items/{resource}
        const id = pathParts[2]; // optional ID

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
            headers,
            body: JSON.stringify({ error: 'Internal server error', details: error.message })
        };
    }
};

// Asset Management Functions
async function handleAssets(method, id, body) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
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
            "Access-Control-Allow-Headers": "*"
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
                "Access-Control-Allow-Headers": "*"
            },
            body: JSON.stringify({ error: 'Asset not found' })
        };
    }

    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify(result.Item)
    };
}

async function createAsset(assetData) {
    const asset = {
        id: uuidv4(),
        ...assetData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: assetData.status || 'ACTIVE'
    };

    const params = {
        TableName: ASSETS_TABLE,
        Item: asset
    };

    await dynamodb.put(params).promise();

    return {
        statusCode: 201,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify(asset)
    };
}

async function updateAsset(id, updates) {
    const timestamp = new Date().toISOString();
    
    const params = {
        TableName: ASSETS_TABLE,
        Key: { id },
        UpdateExpression: 'SET updatedAt = :timestamp',
        ExpressionAttributeValues: {
            ':timestamp': timestamp
        },
        ReturnValues: 'ALL_NEW'
    };

    // Build update expression dynamically
    Object.keys(updates).forEach(key => {
        if (key !== 'id') {
            params.UpdateExpression += `, ${key} = :${key}`;
            params.ExpressionAttributeValues[`:${key}`] = updates[key];
        }
    });

    const result = await dynamodb.update(params).promise();

    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify(result.Attributes)
    };
}

async function deleteAsset(id) {
    const params = {
        TableName: ASSETS_TABLE,
        Key: { id }
    };

    await dynamodb.delete(params).promise();

    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify({ message: 'Asset deleted successfully' })
    };
}

// Maintenance Management Functions
async function handleMaintenance(method, id, body) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
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
            "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify({
            maintenanceRecords: result.Items,
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
            "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify(result.Item || {})
    };
}

async function createMaintenanceRecord(maintenanceData) {
    const maintenance = {
        id: uuidv4(),
        ...maintenanceData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: maintenanceData.status || 'SCHEDULED'
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
            "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify(maintenance)
    };
}

async function updateMaintenanceRecord(id, updates) {
    const timestamp = new Date().toISOString();
    
    const params = {
        TableName: MAINTENANCE_TABLE,
        Key: { id },
        UpdateExpression: 'SET updatedAt = :timestamp',
        ExpressionAttributeValues: {
            ':timestamp': timestamp
        },
        ReturnValues: 'ALL_NEW'
    };

    // Build update expression dynamically
    Object.keys(updates).forEach(key => {
        if (key !== 'id') {
            params.UpdateExpression += `, ${key} = :${key}`;
            params.ExpressionAttributeValues[`:${key}`] = updates[key];
        }
    });

    const result = await dynamodb.update(params).promise();

    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify(result.Attributes)
    };
}

// Location Management Functions
async function handleLocations(method, id, body) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
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
            "Access-Control-Allow-Headers": "*"
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
        ...locationData,
        createdAt: new Date().toISOString()
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
            "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify(location)
    };
}

// Dashboard Analytics
async function handleDashboard() {
    try {
        // Get asset statistics
        const assetsResult = await dynamodb.scan({ TableName: ASSETS_TABLE }).promise();
        const assets = assetsResult.Items;
        
        const stats = {
            totalAssets: assets.length,
            activeAssets: assets.filter(a => a.status === 'ACTIVE').length,
            maintenanceAssets: assets.filter(a => a.status === 'MAINTENANCE').length,
            inactiveAssets: assets.filter(a => a.status === 'INACTIVE').length,
            filtersNeeded: assets.filter(a => a.filterNeeded === true).length,
            assetsByFloor: {},
            assetsByType: {}
        };

        // Group by floor
        assets.forEach(asset => {
            const floor = asset.floor || 'Unknown';
            stats.assetsByFloor[floor] = (stats.assetsByFloor[floor] || 0) + 1;
        });

        // Group by type
        assets.forEach(asset => {
            const type = asset.assetType || 'Unknown';
            stats.assetsByType[type] = (stats.assetsByType[type] || 0) + 1;
        });

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            },
            body: JSON.stringify(stats)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            },
            body: JSON.stringify({ error: 'Failed to fetch dashboard data' })
        };
    }
} 