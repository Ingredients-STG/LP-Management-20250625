'use client';

import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onError: (error: any) => void;
}

export default function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
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
        if (error.includes('No QR code found')) {
          return; // Ignore "no code found" errors as they're expected
        }
        onError(error);
      }
    );

    return () => {
      // Cleanup
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [onScan, onError]);

  return (
    <div 
      id="barcode-scanner-container" 
      style={{ 
        width: '100%', 
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    />
  );
} 