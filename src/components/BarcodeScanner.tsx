'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Stack, Text, TextInput, Button, Group, Alert } from '@mantine/core';
import { IconAlertCircle, IconCamera } from '@tabler/icons-react';

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onError: (error: any) => void;
}

export default function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);

  const checkCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
      return true;
    } catch (error: any) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraPermissionDenied(true);
        onError('Camera access denied. Please enable camera in browser settings.');
        return false;
      }
      onError('Camera not available on this device.');
      return false;
    }
  };

  useEffect(() => {
    const initializeScanner = async () => {
      setIsInitializing(true);
      
      const hasPermission = await checkCameraPermission();
      if (!hasPermission) {
        setIsInitializing(false);
        return;
      }

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true,
        defaultZoomValueIfSupported: 2,
      };

      const scanner = new Html5QrcodeScanner(
        'barcode-scanner-container',
        config,
        false
      );

      scannerRef.current = scanner;

      scanner.render(
        (decodedText) => {
          // Success callback
          onScan(decodedText);
          scanner.clear();
        },
        (error) => {
          // Error callback - only log significant errors
          if (error.includes('No QR code found') || error.includes('NotFoundException')) {
            return; // Ignore "no code found" errors as they're expected
          }
          
          if (error.includes('NotAllowedError') || error.includes('Permission')) {
            setCameraPermissionDenied(true);
            onError('Camera access denied. Please enable camera in browser settings.');
          }
        }
      );

      setIsInitializing(false);
    };

    initializeScanner();

    return () => {
      // Cleanup
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [onScan, onError]);

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim());
      setManualBarcode('');
    }
  };

  if (cameraPermissionDenied) {
    return (
      <Stack gap="md">
        <Alert icon={<IconAlertCircle size={16} />} color="orange">
          Camera access denied. Please enable camera in browser settings and refresh the page.
        </Alert>
        
        <div>
          <Text size="sm" fw={500} mb="xs">Enter Barcode Manually</Text>
          <Group gap="xs">
            <TextInput
              placeholder="Enter barcode or asset ID"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              style={{ flex: 1 }}
            />
            <Button size="sm" onClick={handleManualSubmit} disabled={!manualBarcode.trim()}>
              Search
            </Button>
          </Group>
        </div>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Alert icon={<IconCamera size={16} />} color="blue">
        This feature requires camera permission. You may be prompted to allow camera access.
      </Alert>
      
      {isInitializing ? (
        <div style={{ 
          width: '100%', 
          height: '300px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f0f0f0',
          borderRadius: '8px'
        }}>
          <Text c="dimmed">Initializing camera...</Text>
        </div>
      ) : (
        <div 
          id="barcode-scanner-container" 
          style={{ 
            width: '100%', 
            height: '300px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        />
      )}
    </Stack>
  );
} 