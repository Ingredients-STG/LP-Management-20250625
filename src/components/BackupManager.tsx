'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';

interface BackupStatus {
  timestamp: string;
  tables: Array<{
    name: string;
    displayName: string;
    recordCount: number;
    status: string;
    error?: string;
  }>;
}

interface BackupResult {
  success: boolean;
  message: string;
  filesGenerated: string[];
  emailSent?: boolean;
  error?: string;
}

export default function BackupManager() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [lastBackupResult, setLastBackupResult] = useState<BackupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBackup = async () => {
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    setIsLoading(true);
    setError(null);
    setLastBackupResult(null);

    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailAddress: email }),
      });

      const result = await response.json();

      if (result.success) {
        setLastBackupResult(result);
        setError(null);
      } else {
        setError(result.error || 'Backup failed');
      }
    } catch (err) {
      setError('Failed to create backup. Please try again.');
      console.error('Backup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/backup');
      const result = await response.json();

      if (result.success) {
        setBackupStatus(result.status);
        setError(null);
      } else {
        setError(result.error || 'Failed to get backup status');
      }
    } catch (err) {
      setError('Failed to get backup status. Please try again.');
      console.error('Status error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Database Backup</h2>
        <p className="text-gray-600 mb-6">
          Create a complete backup of all your LP Management data and receive it via email as an Excel file.
        </p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter email address to receive backup"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handleBackup} 
              disabled={isLoading || !email.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? 'Creating Backup...' : 'Create Backup'}
            </Button>
            
            <Button 
              onClick={handleGetStatus} 
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? 'Loading...' : 'Check Status'}
            </Button>
          </div>
        </div>

        {error && (
          <Alert className="mt-4 border-red-200 bg-red-50 text-red-800">
            {error}
          </Alert>
        )}

        {lastBackupResult && (
          <Alert className={`mt-4 ${lastBackupResult.success ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
            <div>
              <p className="font-semibold">
                {lastBackupResult.success ? 'Backup Successful!' : 'Backup Failed'}
              </p>
              <p className="mt-1">{lastBackupResult.message}</p>
              {lastBackupResult.filesGenerated && lastBackupResult.filesGenerated.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Files Generated:</p>
                  <ul className="list-disc list-inside mt-1">
                    {lastBackupResult.filesGenerated.map((file, index) => (
                      <li key={index}>{file}</li>
                    ))}
                  </ul>
                </div>
              )}
              {lastBackupResult.emailSent !== undefined && (
                <p className="mt-2">
                  Email Status: {lastBackupResult.emailSent ? 'Sent Successfully' : 'Failed to Send'}
                </p>
              )}
            </div>
          </Alert>
        )}
      </Card>

      {backupStatus && (
        <Card className="p-6">
          <h3 className="text-xl font-bold mb-4">Database Status</h3>
          <p className="text-sm text-gray-600 mb-4">
            Last checked: {new Date(backupStatus.timestamp).toLocaleString()}
          </p>
          
          <div className="space-y-3">
            {backupStatus.tables.map((table) => (
              <div key={table.name} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium">{table.displayName}</h4>
                  <p className="text-sm text-gray-600">{table.name}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    table.status === 'accessible' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {table.status === 'accessible' ? 'Accessible' : 'Error'}
                  </span>
                  <p className="text-sm text-gray-600 mt-1">
                    {table.recordCount} records
                  </p>
                  {table.error && (
                    <p className="text-xs text-red-600 mt-1">{table.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="text-lg font-bold mb-3">Backup Information</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>• The backup includes all data from your LP Management system</p>
          <p>• Data is exported to Excel format with separate sheets for each table</p>
          <p>• Backup files are sent to the specified email address</p>
          <p>• Keep backup files in a secure location for data recovery</p>
          <p>• Regular backups are recommended for data protection</p>
        </div>
      </Card>
    </div>
  );
}
