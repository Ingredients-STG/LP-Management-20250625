const https = require('https');
const http = require('http');

exports.handler = async (event) => {
  const APP_URL = process.env.APP_URL;
  
  if (!APP_URL) {
    throw new Error('APP_URL environment variable not set');
  }
  
  const url = `${APP_URL}/api/scheduler/`;
  
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LP-Management-Scheduler/1.0',
      },
      timeout: 300000, // 5 minutes timeout
    };

    const req = client.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('Scheduler execution result:', result);
          resolve({
            statusCode: 200,
            body: JSON.stringify({
              success: true,
              message: 'Scheduler executed successfully',
              result: result
            })
          });
        } catch (error) {
          console.error('Failed to parse response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
};
