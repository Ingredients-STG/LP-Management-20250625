#!/usr/bin/env node

/**
 * Cron Job Script for LP Management Scheduled Reports
 * 
 * This script should be set up as a cron job to run every hour
 * to check for and execute scheduled reports.
 * 
 * To set up the cron job:
 * 1. Make this file executable: chmod +x cron-scheduler.js
 * 2. Add to crontab: 0 * * * * /path/to/cron-scheduler.js
 * 
 * Or use a service like AWS EventBridge, Google Cloud Scheduler, etc.
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_ENDPOINT = '/api/scheduler';

function makeRequest() {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE_URL}${API_ENDPOINT}`;
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
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runScheduler() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting scheduled reports execution...`);
  
  try {
    const result = await makeRequest();
    
    if (result.success) {
      console.log(`[${timestamp}] ✅ Scheduler executed successfully`);
      console.log(`[${timestamp}] Executed: ${result.results?.length || 0} reports`);
      console.log(`[${timestamp}] Message: ${result.message}`);
      
      if (result.results && result.results.length > 0) {
        result.results.forEach(report => {
          if (report.success) {
            console.log(`[${timestamp}] ✅ Report "${report.reportName}" executed successfully`);
          } else {
            console.log(`[${timestamp}] ❌ Report "${report.reportName}" failed: ${report.error}`);
          }
        });
      }
    } else {
      console.log(`[${timestamp}] ❌ Scheduler execution failed: ${result.error}`);
    }
  } catch (error) {
    console.error(`[${timestamp}] ❌ Scheduler execution error:`, error.message);
    process.exit(1);
  }
}

// Run the scheduler
runScheduler().then(() => {
  console.log(`[${new Date().toISOString()}] Scheduler execution completed`);
  process.exit(0);
}).catch((error) => {
  console.error(`[${new Date().toISOString()}] Scheduler execution failed:`, error);
  process.exit(1);
});
