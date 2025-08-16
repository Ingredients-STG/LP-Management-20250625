// ✅ index.js

const {
    DynamoDBClient
  } = require("@aws-sdk/client-dynamodb");
  const {
    PutCommand,
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
  
    const params = {
      TableName: "SPListItems", // Replace with your actual table name
      Item: {
        id: body.id || Date.now().toString(),
        AssetBarcode: body.AssetBarcode || "Unknown",
        ReasonForFilterChange: body.ReasonForFilterChange || "Not specified",
        modifiedBy: body.modifiedBy || "Unknown",
        FilterInstalledDate: body.FilterInstalledDate || "Not set",
        FilterType: body.FilterType || "Not set",
        Location: body.Location || "Not set",
        updatedAt: new Date().toISOString()
      }
    };
    
  
    try {
      await docClient.send(new PutCommand(params));
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Item saved to DynamoDB"
        }),
      };
    } catch (err) {
      console.error("DynamoDB Error:", err);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Failed to write to DynamoDB"
        }),
      };
    }
  };
  