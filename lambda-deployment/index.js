// ✅ index.js - Updated to support both Filter Reconciliation and LP Management

const {
    DynamoDBClient
  } = require("@aws-sdk/client-dynamodb");
  const {
    PutCommand,
    BatchWriteCommand,
    DynamoDBDocumentClient
  } = require("@aws-sdk/lib-dynamodb");
  
  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client);
  
  exports.handler = async (event) => {
    console.log("Event received:", JSON.stringify(event));
  
    let body;
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (err) {
      console.error("Invalid JSON:", err);
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid JSON"
        }),
      };
    }

    // Determine table and operation type
    const tableName = body.tableName || "SPListItems"; // Default to SPListItems for backward compatibility
    const source = body.source || "power-automate";
    
    try {
      if (body.items && Array.isArray(body.items)) {
        // Bulk operation (new feature)
        console.log(`Processing bulk operation: ${body.items.length} items to ${tableName}`);
        return await handleBulkOperation(body.items, tableName, source);
      } else {
        // Single item operation (backward compatibility)
        console.log(`Processing single item to ${tableName}`);
        return await handleSingleItem(body, tableName, source);
      }
    } catch (err) {
      console.error("Operation Error:", err);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Failed to process request",
          error: err.message
        }),
      };
    }
  };

  // Handle single item (preserves existing functionality)
  async function handleSingleItem(body, tableName, source) {
    let item;
    
    if (tableName === "LPItems") {
      // LP Management item structure
      item = {
        id: body.id || `lp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        itemInternalId: body.ItemInternalId || body.itemInternalId || '',
        woNumber: body['WO Number'] || body.woNumber || '',
        createdDate: body['Created Date'] || body.createdDate || '',
        room: body.Room || body.room || '',
        wardDept: body['Ward/Dept'] || body.wardDept || '',
        location: body.Location || body.location || '',
        assetBarcode: body['Asset Barcode'] || body.assetBarcode || '',
        positiveCountPre: body['Positive Count (Pre)'] || body.positiveCountPre || '0',
        positiveCountPost: body['Positive Count (Post)'] || body.positiveCountPost || '0',
        sampleNumber: body['Sample Number'] || body.sampleNumber || '',
        labName: body['Lab Name'] || body.labName || '',
        certificateNumber: body['Certificate Number'] || body.certificateNumber || '',
        sampleType: body['Sample Type'] || body.sampleType || '',
        testType: body['Test Type'] || body.testType || '',
        sampleTemperature: body['Sample Temperature'] || body.sampleTemperature || '',
        bacteriaVariant: body['Bacteria Variant'] || body.bacteriaVariant || '',
        sampledOn: body['Sampled On'] || body.sampledOn || '',
        nextResampleDate: body['Next Resample Date'] || body.nextResampleDate || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: source,
        modifiedBy: source,
        reconciliationStatus: 'synced',
        syncedAt: new Date().toISOString()
      };
    } else {
      // SPListItems (Filter Reconciliation) structure - EXACT backward compatibility
      item = {
        id: body.id || Date.now().toString(),
        AssetBarcode: body.AssetBarcode || "Unknown",
        ReasonForFilterChange: body.ReasonForFilterChange || "Not specified",
        modifiedBy: body.modifiedBy || "Unknown",
        FilterInstalledDate: body.FilterInstalledDate || "Not set",
        FilterType: body.FilterType || "Not set",
        Location: body.Location || "Not set",
        updatedAt: new Date().toISOString()
      };
    }

    const params = {
      TableName: tableName,
      Item: item
    };

    await docClient.send(new PutCommand(params));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: tableName === "SPListItems" ? "Item saved to DynamoDB" : `Item saved to ${tableName}`,
        itemId: item.id
      }),
    };
  }

  // Handle bulk operations (new feature)
  async function handleBulkOperation(items, tableName, source) {
    const processedItems = items.map((item, index) => {
      if (tableName === "LPItems") {
        const id = item.id || `lp-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
                  return {
            id,
            itemInternalId: item.ItemInternalId || item.itemInternalId || '',
            woNumber: item['WO Number'] || item.woNumber || '',
            createdDate: item['Created Date'] || item.createdDate || '',
            room: item.Room || item.room || '',
            location: item.Location || item.location || '',
            wing: item.Wing || item.wing || '',
            assetBarcode: item['Asset Barcode'] || item.assetBarcode || '',
            positiveCountPre: item['Positive Count (Pre)'] || item.positiveCountPre || '0',
            positiveCountPost: item['Positive Count (Post)'] || item.positiveCountPost || '0',
            sampleNumber: item['Sample Number'] || item.sampleNumber || '',
            labName: item['Lab Name'] || item.labName || '',
            certificateNumber: item['Certificate Number'] || item.certificateNumber || '',
            sampleType: item['Sample Type'] || item.sampleType || '',
            testType: item['Test Type'] || item.testType || '',
            sampleTemperature: item['Sample Temperature'] || item.sampleTemperature || '',
            bacteriaVariant: item['Bacteria Variant'] || item.bacteriaVariant || '',
            sampledOn: item['Sampled On'] || item.sampledOn || '',
            nextResampleDate: item['Next Resample Date'] || item.nextResampleDate || '',
            createdAt: item.createdAt || now,
            updatedAt: now,
            createdBy: item.createdBy || source,
            modifiedBy: source,
            originalData: item,
            syncedAt: now,
            reconciliationStatus: 'synced'
          };
      } else {
        // SPListItems bulk structure
        const id = item.id || `sp-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
        
        return {
          id,
          AssetBarcode: item.AssetBarcode || "Unknown",
          ReasonForFilterChange: item.ReasonForFilterChange || "Not specified",
          modifiedBy: item.modifiedBy || source,
          FilterInstalledDate: item.FilterInstalledDate || "Not set",
          FilterType: item.FilterType || "Not set",
          Location: item.Location || "Not set",
          updatedAt: new Date().toISOString(),
          reconciliationStatus: 'synced'
        };
      }
    });

    // Process in batches of 25 (DynamoDB limit)
    const batchSize = 25;
    let processedCount = 0;
    
    for (let i = 0; i < processedItems.length; i += batchSize) {
      const batch = processedItems.slice(i, i + batchSize);
      
      const writeRequests = batch.map(item => ({
        PutRequest: { Item: item }
      }));

      const batchParams = {
        RequestItems: {
          [tableName]: writeRequests
        }
      };

      await docClient.send(new BatchWriteCommand(batchParams));
      processedCount += batch.length;
      
      console.log(`Processed batch: ${processedCount}/${processedItems.length} items`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully processed ${processedCount} items to ${tableName}`,
        processedCount,
        tableName,
        source
      }),
    };
  }
  