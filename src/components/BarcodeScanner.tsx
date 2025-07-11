'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  Modal, 
  Button, 
  Text, 
  Group, 
  Stack, 
  Alert, 
  TextInput, 
  ActionIcon,
  Box,
  Center,
  Loader,
  Badge,
  Paper,
  Divider
} from '@mantine/core';
import { 
  IconCamera, 
  IconAlertCircle, 
  IconRotate, 
  IconX,
  IconQrcode,
  IconRefresh,
  IconScan,
  IconDeviceMobile,
  IconFocus2
} from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';

interface BarcodeScannerProps {
  opened: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
  onError?: (error: string) => void;
}

export default function BarcodeScanner({ opened, onClose, onScan, onError }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scannerInitialized, setScannerInitialized] = useState(false);
  
  // Media queries for responsive design
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px) and (min-width: 769px)');
  const isDesktop = useMediaQuery('(min-width: 1025px)');

  // Configuration for html5-qrcode scanner
  const scannerConfig = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0,
    disableFlip: false,
    showTorchButtonIfSupported: true,
    showZoomSliderIfSupported: true,
    defaultZoomValueIfSupported: 2,
    useBarCodeDetectorIfSupported: true,
    experimentalFeatures: {
      useBarCodeDetectorIfSupported: true
    },
    rememberLastUsedCamera: true
  };

  // Initialize scanner
  const initializeScanner = useCallback(async () => {
    if (!opened || scannerInitialized || isDesktop) return;

    try {
      setIsInitializing(true);
      setError(null);

      // Clean up existing scanner
      if (scannerRef.current) {
        try {
          await scannerRef.current.clear();
        } catch (e) {
          console.log('Scanner cleanup error:', e);
        }
      }

      // Create new scanner instance
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        scannerConfig,
        false
      );

      // Success callback
      const onScanSuccess = (decodedText: string, decodedResult: any) => {
        console.log(`Barcode scanned: ${decodedText}`, decodedResult);
        setLastScannedCode(decodedText);
        onScan(decodedText);
        
        // Stop scanning and close modal
        stopScanning();
        onClose();
      };

      // Error callback
      const onScanError = (errorMessage: string) => {
        // Only log actual errors, not "No QR code found" messages
        if (!errorMessage.includes('No QR code found') && 
            !errorMessage.includes('QR code parse error')) {
          console.error('Scanner error:', errorMessage);
          setError('Scanner error occurred. Please try again.');
        }
      };

      // Start scanning
      scannerRef.current.render(onScanSuccess, onScanError);
      setIsScanning(true);
      setScannerInitialized(true);
      setIsInitializing(false);

    } catch (error: any) {
      console.error('Failed to initialize scanner:', error);
      setError('Failed to initialize camera. Please check permissions and try again.');
      setIsInitializing(false);
    }
  }, [opened, scannerInitialized, isDesktop, onScan, onClose]);

  // Stop scanning
  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch (e) {
        console.log('Scanner stop error:', e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setScannerInitialized(false);
    setTorchEnabled(false);
  }, []);

  // Switch camera
  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    // Restart scanner with new camera
    setScannerInitialized(false);
    setTimeout(() => {
      initializeScanner();
    }, 100);
  }, [initializeScanner]);

  // Retry scanning
  const retryScanning = useCallback(() => {
    setScannerInitialized(false);
    setError(null);
    setTimeout(() => {
      initializeScanner();
    }, 100);
  }, [initializeScanner]);

  // Handle manual barcode submission
  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim());
      setManualBarcode('');
      onClose();
    }
  };

  // Handle modal close
  const handleClose = () => {
    stopScanning();
    setError(null);
    setManualBarcode('');
    setLastScannedCode('');
    onClose();
  };

  // Initialize scanner when modal opens
  useEffect(() => {
    if (opened && !isDesktop) {
      initializeScanner();
    } else {
      stopScanning();
    }
  }, [opened, isDesktop, initializeScanner, stopScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  // Don't render on desktop
  if (isDesktop) {
    return null;
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconQrcode size={20} />
          <Text fw={600}>Barcode Scanner</Text>
          <Badge variant="light" color="blue" size="sm">
            {isMobile ? 'Mobile' : 'Tablet'}
          </Badge>
        </Group>
      }
      size={isMobile ? "100%" : "lg"}
      fullScreen={isMobile}
      closeOnClickOutside={false}
      closeOnEscape={true}
      centered={!isMobile}
      styles={{
        header: { 
          backgroundColor: '#f8f9fa', 
          borderBottom: '1px solid #e9ecef',
          position: 'sticky',
          top: 0,
          zIndex: 1000
        },
        body: { padding: 0 }
      }}
    >
      <Stack gap="md" p="md">
        {/* Instructions */}
        <Alert 
          icon={<IconDeviceMobile size={16} />} 
          color="blue" 
          variant="light"
          title="Scanner Instructions"
        >
          <Text size="sm">
            • Point your camera at any barcode or QR code
            • Supports: QR codes, Code 128, Code 39, EAN, UPC, and more
            • Use the controls below to adjust settings
            • Ensure good lighting for best results
          </Text>
        </Alert>

        {/* Error Display */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            <Text size="sm">{error}</Text>
          </Alert>
        )}

        {/* Scanner Controls */}
        <Paper p="sm" withBorder>
          <Group justify="space-between" mb="xs">
            <Text fw={500} size="sm">Scanner Controls</Text>
            <Group gap="xs">
              {isMobile && (
                <ActionIcon
                  variant="light"
                  color="blue"
                  onClick={switchCamera}
                  title="Switch Camera"
                  size="sm"
                >
                  <IconRotate size={16} />
                </ActionIcon>
              )}
              <ActionIcon
                variant="light"
                color="orange"
                onClick={retryScanning}
                title="Retry"
                size="sm"
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Group>
          </Group>
          
          <Group gap="md">
            <Group gap="xs">
              <IconCamera size={16} />
              <Text size="xs" c="dimmed">
                {facingMode === 'environment' ? 'Back Camera' : 'Front Camera'}
              </Text>
            </Group>
            <Group gap="xs">
              <IconFocus2 size={16} />
              <Text size="xs" c="dimmed">Auto Focus</Text>
            </Group>
          </Group>
        </Paper>

        {/* Scanner View */}
        <Paper
          withBorder
          style={{
            position: 'relative',
            width: '100%',
            minHeight: isMobile ? '60vh' : '400px',
            backgroundColor: '#000',
            borderRadius: '8px',
            overflow: 'hidden'
          }}
        >
          {/* Loading Overlay */}
          {isInitializing && (
            <Center
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                color: 'white',
                zIndex: 100
              }}
            >
              <Stack align="center" gap="sm">
                <Loader size="lg" color="blue" />
                <Text size="sm">Initializing camera...</Text>
                <Text size="xs" c="dimmed">Please allow camera access</Text>
              </Stack>
            </Center>
          )}

          {/* Scanner Container */}
          <Box
            id="qr-reader"
            style={{
              width: '100%',
              minHeight: '100%'
            }}
          />

          {/* Scanner Status */}
          {isScanning && !isInitializing && (
            <Box
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                right: '16px',
                zIndex: 50
              }}
            >
              <Paper p="xs" withBorder bg="rgba(255, 255, 255, 0.9)">
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconScan size={16} color="green" />
                    <Text size="xs" fw={500}>Scanning...</Text>
                  </Group>
                  <Badge variant="light" color="green" size="xs">
                    Active
                  </Badge>
                </Group>
              </Paper>
            </Box>
          )}
        </Paper>

        <Divider />

        {/* Manual Entry Fallback */}
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Group gap="xs">
              <IconQrcode size={16} />
              <Text size="sm" fw={500}>Manual Entry</Text>
            </Group>
            <Text size="xs" c="dimmed">
              Can't scan? Enter the barcode manually below:
            </Text>
            <Group gap="xs">
              <TextInput
                placeholder="Enter barcode or asset ID"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                style={{ flex: 1 }}
                size="sm"
                styles={{
                  input: {
                    fontSize: '16px', // Prevent zoom on iOS
                  },
                }}
              />
              <Button 
                size="sm" 
                onClick={handleManualSubmit} 
                disabled={!manualBarcode.trim()}
                leftSection={<IconQrcode size={16} />}
                variant="light"
              >
                Search
              </Button>
            </Group>
          </Stack>
        </Paper>

        {/* Action Buttons */}
        <Group justify="space-between">
          <Button
            variant="light"
            color="gray"
            onClick={handleClose}
            leftSection={<IconX size={16} />}
          >
            Cancel
          </Button>
          
          {lastScannedCode && (
            <Badge color="green" variant="light" size="lg">
              Last: {lastScannedCode.substring(0, 10)}...
            </Badge>
          )}
        </Group>
      </Stack>
    </Modal>
  );
} 