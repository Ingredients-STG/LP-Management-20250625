'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, Result, NotFoundException } from '@zxing/library';
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
  Badge
} from '@mantine/core';
import { 
  IconCamera, 
  IconAlertCircle, 
  IconRotate, 
  IconX,
  IconQrcode,
  IconRefresh
} from '@tabler/icons-react';

interface BarcodeScannerProps {
  opened: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
  onError?: (error: string) => void;
}

export default function BarcodeScanner({ opened, onClose, onScan, onError }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');
  const [manualBarcode, setManualBarcode] = useState('');
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      setIsMobile(isMobileDevice);
    };
    checkMobile();
  }, []);

  // Initialize ZXing reader
  useEffect(() => {
    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader();
    }
    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    };
  }, []);

  // Check camera permissions
  const checkCameraPermission = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionStatus('unsupported');
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionStatus('granted');
      return true;
    } catch (error: any) {
      console.error('Camera permission check failed:', error);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionStatus('denied');
        setError('Camera access denied. Please enable camera permissions in your browser settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setPermissionStatus('unsupported');
        setError('No camera found on this device.');
      } else {
        setPermissionStatus('unsupported');
        setError('Camera not available on this device.');
      }
      return false;
    }
  }, [facingMode]);

  // Start scanning
  const startScanning = useCallback(async () => {
    if (!readerRef.current || !videoRef.current) return;

    try {
      setIsInitializing(true);
      setError(null);

      const hasPermission = await checkCameraPermission();
      if (!hasPermission) {
        setIsInitializing(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setIsScanning(true);
      setIsInitializing(false);

      // Start decoding
      readerRef.current.decodeFromVideoDevice(
        null,
        videoRef.current,
        (result: Result | null, error: any) => {
          if (result) {
            const scannedCode = result.getText();
            setLastScannedCode(scannedCode);
            onScan(scannedCode);
            
            // Stop scanning and close modal after successful scan
            stopScanning();
            onClose();
            
            // Show success message (you can implement a toast here)
            console.log(`Barcode Scanned: ${scannedCode}`);
          }
          
          if (error && !(error instanceof NotFoundException)) {
            console.error('Scanning error:', error);
            setError('Error scanning barcode. Please try again.');
          }
        }
      );

    } catch (error: any) {
      console.error('Failed to start scanning:', error);
      setError('Failed to start camera. Please check permissions and try again.');
      setIsInitializing(false);
    }
  }, [facingMode, onScan, onClose, checkCameraPermission]);

  // Stop scanning
  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (readerRef.current) {
      readerRef.current.reset();
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
  }, []);

  // Switch camera
  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, []);

  // Retry scanning
  const retryScanning = useCallback(() => {
    stopScanning();
    setTimeout(() => {
      startScanning();
    }, 500);
  }, [stopScanning, startScanning]);

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

  // Start scanning when modal opens
  useEffect(() => {
    if (opened) {
      startScanning();
    } else {
      stopScanning();
    }
  }, [opened, startScanning, stopScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconQrcode size={20} />
          <Text fw={600}>Barcode Scanner</Text>
        </Group>
      }
      size={isMobile ? "100%" : "md"}
      fullScreen={isMobile}
      closeOnClickOutside={false}
      closeOnEscape={true}
      centered={!isMobile}
      styles={{
        header: { backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef' },
        body: { padding: 0 }
      }}
    >
      <Stack gap="md" p="md">
        {/* Instructions */}
        <Alert icon={<IconCamera size={16} />} color="blue" variant="light">
          <Text size="sm">
            Align the barcode within the frame. The scanner supports Code 128, Code 39, QR, and EAN formats.
          </Text>
        </Alert>

        {/* Error Display */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            <Text size="sm">{error}</Text>
          </Alert>
        )}

        {/* Scanner View */}
        <Box
          style={{
            position: 'relative',
            width: '100%',
            height: isMobile ? '60vh' : '400px',
            backgroundColor: '#000',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '2px solid #e9ecef'
          }}
        >
          {/* Video Element */}
          <video
            ref={videoRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
            autoPlay
            playsInline
            muted
          />
          
          {/* Scanning Frame Overlay */}
          <Box
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '250px',
              height: '150px',
              border: '2px solid #00ff00',
              borderRadius: '8px',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              animation: isScanning ? 'pulse 2s infinite' : 'none'
            }}
          />
          
          {/* Loading Overlay */}
          {isInitializing && (
            <Center
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white'
              }}
            >
              <Stack align="center" gap="sm">
                <Loader size="lg" />
                <Text size="sm">Initializing camera...</Text>
              </Stack>
            </Center>
          )}

          {/* Control Buttons */}
          <Group
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              gap: '8px'
            }}
          >
            {isMobile && (
              <ActionIcon
                variant="filled"
                color="blue"
                size="lg"
                onClick={switchCamera}
                title="Switch Camera"
              >
                <IconRotate size={20} />
              </ActionIcon>
            )}
            
            <ActionIcon
              variant="filled"
              color="orange"
              size="lg"
              onClick={retryScanning}
              title="Retry"
            >
              <IconRefresh size={20} />
            </ActionIcon>
          </Group>
        </Box>

        {/* Manual Entry Fallback */}
        {permissionStatus === 'denied' || permissionStatus === 'unsupported' ? (
          <Stack gap="sm">
            <Text size="sm" fw={500} c="dimmed">
              Camera not available. Enter barcode manually:
            </Text>
            <Group gap="xs">
              <TextInput
                placeholder="Enter barcode or asset ID"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                style={{ flex: 1 }}
                size="sm"
              />
              <Button 
                size="sm" 
                onClick={handleManualSubmit} 
                disabled={!manualBarcode.trim()}
                leftSection={<IconQrcode size={16} />}
              >
                Search
              </Button>
            </Group>
          </Stack>
        ) : (
          /* Action Buttons */
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
              <Badge color="green" variant="light">
                Last scanned: {lastScannedCode}
              </Badge>
            )}
          </Group>
        )}
      </Stack>

      <style jsx>{`
        @keyframes pulse {
          0% { border-color: #00ff00; }
          50% { border-color: #00cc00; }
          100% { border-color: #00ff00; }
        }
      `}</style>
    </Modal>
  );
} 