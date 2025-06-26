const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
    region: 'eu-west-2'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ASSETS_TABLE = 'WaterTapAssetAssets';

async function normalizeStatusValues() {
    try {
        console.log('Starting status normalization...');
        
        // Get all assets
        const scanParams = {
            TableName: ASSETS_TABLE
        };
        
        const result = await dynamodb.scan(scanParams).promise();
        const assets = result.Items || [];
        
        console.log(`Found ${assets.length} assets to process`);
        
        let updatedCount = 0;
        
        for (const asset of assets) {
            if (asset.status && asset.status !== asset.status.toUpperCase()) {
                console.log(`Updating asset ${asset.id}: "${asset.status}" -> "${asset.status.toUpperCase()}"`);
                
                const updateParams = {
                    TableName: ASSETS_TABLE,
                    Key: { id: asset.id },
                    UpdateExpression: 'SET #status = :status, #modified = :modified, #modifiedBy = :modifiedBy',
                    ExpressionAttributeNames: {
                        '#status': 'status',
                        '#modified': 'modified',
                        '#modifiedBy': 'modifiedBy'
                    },
                    ExpressionAttributeValues: {
                        ':status': asset.status.toUpperCase(),
                        ':modified': new Date().toISOString(),
                        ':modifiedBy': 'System Normalization'
                    }
                };
                
                await dynamodb.update(updateParams).promise();
                updatedCount++;
            }
        }
        
        console.log(`\nNormalization complete!`);
        console.log(`Total assets processed: ${assets.length}`);
        console.log(`Assets updated: ${updatedCount}`);
        console.log(`Assets already normalized: ${assets.length - updatedCount}`);
        
    } catch (error) {
        console.error('Error normalizing status values:', error);
    }
}

// Run the normalization
normalizeStatusValues(); 