'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Text,
  Button,
  Table,
  Group,
  Stack,
  Badge,
  Loader,
  Alert,
  Modal,
  TextInput,
  Textarea,
  Select,
  Grid,
  Divider,
  ActionIcon,
  Tooltip,
  Paper,
  Title,
  ScrollArea,
  FileInput,
  Progress,
  Box,
  ThemeIcon,
} from '@mantine/core';
import {
  IconRefresh,
  IconPlus,
  IconEdit,
  IconTrash,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconEye,
  IconDownload,
  IconDatabase,
  IconSearch,
  IconFilter,
  IconCalendar,
  IconUpload,
  IconFileSpreadsheet,
  IconTemplate,
  IconFileExport,
  IconMapPin,
  IconBuilding,
  IconInfoCircle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { DatePickerInput } from '@mantine/dates';
import * as XLSX from 'xlsx';
import { findAssetByBarcode, type Asset } from '@/lib/utils';

interface LPItem {
  id: string;
  itemInternalId: string;
  woNumber: string;
  createdDate: string;
  room: string;
  location: string;
  wing: string;
  assetBarcode: string;
  positiveCountPre: string;
  positiveCountPost: string;
  sampleNumber: string;
  labName: string;
  certificateNumber: string;
  sampleType: string;
  testType: string;
  sampleTemperature: string;
  bacteriaVariant: string;
  sampledOn: string;
  nextResampleDate: string;
  // Additional recording fields
  hotTemperature: string;
  coldTemperature: string;
  remedialWoNumber: string;
  remedialCompletedDate: string;
  status: string;
  // System fields
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  modifiedBy: string;
  syncedAt?: string;
  reconciliationStatus?: string;
}

interface LPManagementProps {
  assets: Asset[];
  onAssetClick: (asset: Asset) => void;
}

export default function LPManagement({ assets, onAssetClick }: LPManagementProps) {
  const [lpItems, setLpItems] = useState<LPItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LPItem | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [viewModalOpened, setViewModalOpened] = useState(false);
  const [uploadModalOpened, setUploadModalOpened] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<any[]>([]);
  
  // Template upload state
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateUploadModalOpened, setTemplateUploadModalOpened] = useState(false);

  // Asset overview modal state - now handled by parent component

  // Form state
  const [formData, setFormData] = useState({
    woNumber: '',
    room: '',
    location: '',
    wing: '',
    assetBarcode: '',
    positiveCountPre: '',
    positiveCountPost: '',
    sampleNumber: '',
    labName: '',
    certificateNumber: '',
    sampleType: '',
    testType: '',
    sampleTemperature: '',
    bacteriaVariant: '',
    sampledOn: '',
    nextResampleDate: '',
    hotTemperature: '',
    coldTemperature: '',
    remedialWoNumber: '',
    remedialCompletedDate: '',
    status: 'In Progress',
  });

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSampleType, setFilterSampleType] = useState<string>('');
  const [filterTestType, setFilterTestType] = useState<string>('');
  const [filterWing, setFilterWing] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [singleDate, setSingleDate] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Dynamic filter options based on actual LP Items data
  const sampleTypes = Array.from(new Set(lpItems.map(item => item.sampleType).filter(Boolean))).sort();
  const testTypes = Array.from(new Set(lpItems.map(item => item.testType).filter(Boolean))).sort();
  const bacteriaVariants = Array.from(new Set(lpItems.map(item => item.bacteriaVariant).filter(Boolean))).sort();
  const wings = Array.from(new Set(lpItems.map(item => item.wing).filter(Boolean))).sort();

  // Helper functions for Excel data extraction (based on Power Automate script)
  const extractValue = (text: string, startText: string, endText: string): string => {
    if (!text) return "";
    const startIndex = text.indexOf(startText);
    if (startIndex === -1) return "";
    const adjustedStartIndex = startIndex + startText.length;
    const endIndex = text.indexOf(endText, adjustedStartIndex);
    return endIndex === -1
      ? text.substring(adjustedStartIndex).trim()
      : text.substring(adjustedStartIndex, endIndex).trim();
  };

  const extractBetween = (text: string, startText: string, endText: string): string => {
    if (!text) return "";
    const startIndex = text.indexOf(startText);
    if (startIndex === -1) return "";
    const adjustedStartIndex = startIndex + startText.length;
    const endIndex = text.indexOf(endText, adjustedStartIndex);
    return endIndex === -1
      ? text.substring(adjustedStartIndex).trim()
      : text.substring(adjustedStartIndex, endIndex).trim();
  };

  const formatDate = (dateString: string | Date | null | undefined): string => {
    if (!dateString) return "";
    
    if (dateString instanceof Date) {
      return dateString.toISOString(); // Return ISO format for proper storage
    }
    
    if (typeof dateString === "string") {
      const [datePart] = dateString.split(" ");
      const [day, month, year] = datePart.split("/");
      if (day && month && year) {
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toISOString(); // Convert to ISO format
      }
    }
    
    // Try to parse as date and convert to ISO
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch (error) {
      console.warn('Could not parse date in formatDate:', dateString);
    }
    
    return dateString.toString();
  };

  // Helper function to display dates in user-friendly format (dd/mm/yyyy)
  const displayDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      return dateString;
    }
  };

  const getTestType = (description: string): string => {
    if (!description) return "";
    
    if (description.toLowerCase().startsWith("legionella")) {
      return "LA";
    } else if (description.toLowerCase().startsWith("pseudomonas")) {
      return "PA";
    }
    
    return "";
  };

  // Download template for bulk upload
  const downloadTemplate = () => {
    const templateData = [
      {
        'WO Number': '123456',
        'Created Date': '15/01/2025',
        'Room/Ward Name': 'Room 101',
        'Room Number': 'LNS-5.077',
        'Wing': 'LNS',
        'Asset Barcode': 'B12345',
        'Positive Count (Pre)': '50',
        'Positive Count (Post)': '0',
        'Sample Number': '001',
        'Lab Name': 'Lab A',
        'Certificate Number': 'CERT123',
        'Sample Type': 'Original',
        'Test Type': 'LA',
        'Sample Temperature': '37',
        'Bacteria Variant': 'SPP',
        'Sampled On': '15/01/2025',
        'Next Resample Date': '15/02/2025',
        'Hot Temperature': '45',
        'Cold Temperature': '15',
        'Remedial WO Number': '789012',
        'Remedial Completed Date': '20/01/2025'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'LP Items Template');
    
    // Auto-size columns
    const cols = Object.keys(templateData[0]).map(() => ({ wch: 20 }));
    worksheet['!cols'] = cols;
    
    XLSX.writeFile(workbook, 'LP_Items_Template.xlsx');
    
    notifications.show({
      title: 'Success',
      message: 'Template downloaded successfully!',
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  // Export filtered LP items to Excel
  const exportToExcel = () => {
    const exportData = filteredLPItems.map(item => ({
      'WO Number': item.woNumber,
      'Created Date': displayDate(item.createdDate),
      'Room/Ward Name': item.room,
      'Room Number': item.location,
      'Wing': item.wing,
      'Asset Barcode': item.assetBarcode,
      'Positive Count (Pre)': item.positiveCountPre,
      'Positive Count (Post)': item.positiveCountPost,
      'Sample Number': item.sampleNumber,
      'Lab Name': item.labName,
      'Certificate Number': item.certificateNumber,
      'Sample Type': item.sampleType,
      'Test Type': item.testType,
      'Sample Temperature': item.sampleTemperature,
      'Bacteria Variant': item.bacteriaVariant,
      'Sampled On': displayDate(item.sampledOn),
      'Next Resample Date': displayDate(item.nextResampleDate),
      'Hot Temperature': item.hotTemperature,
      'Cold Temperature': item.coldTemperature,
      'Remedial WO Number': item.remedialWoNumber,
      'Remedial Completed Date': displayDate(item.remedialCompletedDate),
      'Status': item.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'LP Items Export');
    
    // Auto-size columns
    const cols = Object.keys(exportData[0] || {}).map(() => ({ wch: 20 }));
    worksheet['!cols'] = cols;
    
    const fileName = `LP_Items_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    notifications.show({
      title: 'Export Successful',
      message: `${filteredLPItems.length} LP items exported to ${fileName}`,
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  // Convert dd/mm/yyyy to ISO date format for proper DynamoDB storage and sorting
  const convertDateFormat = (dateString: string | number | null | undefined): string => {
    if (!dateString) return '';
    
    // Handle Excel date numbers first
    if (typeof dateString === 'number') {
      const date = new Date((dateString - 25569) * 86400 * 1000);
      return date.toISOString();
    }
    
    // Convert to string for pattern matching
    const dateStr = String(dateString).trim();
    if (!dateStr) return '';
    
    // Check if it's already in yyyy-mm-dd format
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return new Date(dateStr).toISOString();
    }
    
    // Convert dd/mm/yyyy to ISO format
    if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [day, month, year] = dateStr.split('/');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toISOString();
    }
    
    // Try to parse as a date and convert to ISO
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch (error) {
      console.warn('Could not parse date:', dateStr);
    }
    
    return dateStr;
  };

  // Process template file (simple Excel to JSON conversion)
  const processTemplateFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          // Convert template data to LP items format
          const processedData = jsonData.map((row: any) => ({
            woNumber: row['WO Number']?.toString() || '',
            createdDate: convertDateFormat(row['Created Date']) || '',
            room: row['Room/Ward Name'] || row['Room'] || '', // Support both old and new field names
            location: row['Room Number'] || row['Location'] || '', // Support both old and new field names
            wing: row['Wing'] || '',
            assetBarcode: row['Asset Barcode'] || '',
            positiveCountPre: row['Positive Count (Pre)']?.toString() || '0',
            positiveCountPost: row['Positive Count (Post)']?.toString() || '0',
            sampleNumber: row['Sample Number']?.toString() || '',
            labName: row['Lab Name'] || '',
            certificateNumber: row['Certificate Number'] || '',
            sampleType: row['Sample Type'] || '',
            testType: row['Test Type'] || '',
            sampleTemperature: row['Sample Temperature']?.toString() || '',
            bacteriaVariant: row['Bacteria Variant'] || '',
            sampledOn: convertDateFormat(row['Sampled On']) || '',
            nextResampleDate: convertDateFormat(row['Next Resample Date']) || '',
            hotTemperature: row['Hot Temperature']?.toString() || '',
            coldTemperature: row['Cold Temperature']?.toString() || '',
            remedialWoNumber: row['Remedial WO Number']?.toString() || '',
            remedialCompletedDate: convertDateFormat(row['Remedial Completed Date']) || '',
            status: (!row['Remedial WO Number'] || row['Remedial WO Number'] === '' || row['Remedial WO Number'] === 'N/A') ? 'In Progress' : 'Completed',
          }));
          
          resolve(processedData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Check for duplicates based on WO Number
  const checkForDuplicates = async (newItems: any[]): Promise<{ duplicates: string[], unique: any[] }> => {
    const existingWONumbers = lpItems.map(item => item.woNumber);
    const newWONumbers = newItems.map(item => item.woNumber);
    
    const duplicates: string[] = [];
    const unique: any[] = [];
    
    newItems.forEach(item => {
      if (existingWONumbers.includes(item.woNumber)) {
        duplicates.push(item.woNumber);
      } else if (!newWONumbers.slice(0, newWONumbers.indexOf(item.woNumber)).includes(item.woNumber)) {
        // Also check for duplicates within the new items themselves
        unique.push(item);
      } else {
        duplicates.push(item.woNumber);
      }
    });
    
    return { duplicates, unique };
  };

  // Process Excel file and extract LP data
  const processExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Skip header row and process data
          const processedData: any[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            
            // Skip empty rows
            if (!row || row.every(cell => !cell)) continue;
            
            // Extract data based on your Power Automate logic
            const instructions = row[9] as string || ""; // Column 10 (Instructions)
            const description = row[8] as string || ""; // Column 9 (Description)
            const createdDate = formatDate(row[2] as string); // Column 3 (Created Date)
            // Final correct mapping based on your specification:
            // Wing: "LNS" (extract just the prefix), Room Number: "LNS-1.191", Room/Ward Name: "Transitional & Special Care"
            const wingFull = row[11] || ""; // Column 12 - Wing full value
            const wing = wingFull.split('-')[0] || wingFull; // Extract just "LNS" part before the dash
            const location = row[12] || ""; // Column 13 - Room Number (specific identifier like "LNS-1.191")
            const room = row[13] || ""; // Column 14 - Room/Ward Name (descriptive name like "Transitional & Special Care")
            
            const assetBarcode = extractValue(instructions, "Asset number: ", " ");
            const positivePre = parseInt(extractValue(instructions, "Positive Count (Pre): ", " ")) || 0;
            const positivePost = parseInt(extractValue(instructions, "Positive Count (Post): ", " ")) || 0;
            const sampleNumber = parseInt(extractBetween(description, "(", " +")) || 0;
            const labName = extractBetween(description, "+ ", ")");
            const certificateNumber = extractValue(instructions, "Certificate ID: ", " ");
            const sampleType = extractValue(instructions, "Sample Type: ", " ");
            const testType = getTestType(description);
            const sampleTemperature = extractValue(instructions, "Sample Temperature: ", " ");
            const bacteriaVariant = extractValue(instructions, "Bacteria Variant: ", " ");
            const sampledOn = formatDate(extractValue(instructions, "Sampled On: ", " "));
            const nextResampleDate = formatDate(extractValue(instructions, "Next Resample Date: ", " "));
            
            processedData.push({
              woNumber: (parseInt(row[1] as string) || 0).toString(),
              createdDate,
              room,
              location,
              wing,
              assetBarcode,
              positiveCountPre: positivePre.toString(),
              positiveCountPost: positivePost.toString(),
              sampleNumber: sampleNumber.toString(),
              labName,
              certificateNumber,
              sampleType,
              testType,
              sampleTemperature,
              bacteriaVariant,
              sampledOn,
              nextResampleDate,
              status: 'In Progress', // Default status for Planet extraction
            });
          }
          
          resolve(processedData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Filter and sort function
  const filteredLPItems = lpItems
    .filter((item) => {
    // Search query - searches across all text fields
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const searchableFields = [
        item.assetBarcode,
        item.woNumber,
        item.room,
        item.location,
        item.wing,
        item.sampleNumber,
        item.labName,
        item.certificateNumber,
        item.sampleType,
        item.testType,
        item.bacteriaVariant,
        item.positiveCountPre,
        item.positiveCountPost,
        item.sampleTemperature,
        item.hotTemperature,
        item.coldTemperature,
        item.remedialWoNumber
      ];
      
      const matchesSearch = searchableFields.some(field => 
        field?.toLowerCase().includes(query)
      );
      
      if (!matchesSearch) return false;
    }

    // Sample Type filter
    if (filterSampleType && item.sampleType !== filterSampleType) {
      return false;
    }

    // Test Type filter
    if (filterTestType && item.testType !== filterTestType) {
      return false;
    }

    // Wing filter
    if (filterWing && item.wing !== filterWing) {
      return false;
    }

    // Status filter
    if (filterStatus && item.status !== filterStatus) {
      return false;
    }

    // Date range filter (sampled on date)
    if (dateRange[0] || dateRange[1]) {
      const sampledDate = item.sampledOn ? new Date(item.sampledOn) : null;
      if (!sampledDate) return false;
      
      // Convert dateRange values to Date objects for comparison
      const startDate = dateRange[0] ? (dateRange[0] instanceof Date ? dateRange[0] : new Date(dateRange[0])) : null;
      const endDate = dateRange[1] ? (dateRange[1] instanceof Date ? dateRange[1] : new Date(dateRange[1])) : null;
      
      if (startDate && sampledDate < startDate) return false;
      if (endDate && sampledDate > endDate) return false;
    }

    // Single date filter
    if (singleDate) {
      const sampledDate = item.sampledOn ? new Date(item.sampledOn) : null;
      if (!sampledDate) return false;
      
      // Ensure singleDate is a proper Date object
      const singleDateObj = singleDate instanceof Date ? singleDate : new Date(singleDate);
      if (isNaN(singleDateObj.getTime())) return false; // Invalid date
      
      const singleDateString = singleDateObj.toDateString();
      const sampledDateString = sampledDate.toDateString();
      if (singleDateString !== sampledDateString) return false;
    }

    return true;
  })
  .sort((a, b) => {
    // Sort by WO Number in descending order (largest number first)
    const woNumberA = parseInt(a.woNumber) || 0;
    const woNumberB = parseInt(b.woNumber) || 0;
    return woNumberB - woNumberA;
  });

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setFilterSampleType('');
    setFilterTestType('');
    setFilterWing('');
    setFilterStatus('');
    setDateRange([null, null]);
    setSingleDate(null);
  };

  // Fetch LP items from API
  const fetchLPItems = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/lp-items');
      if (!response.ok) {
        throw new Error('Failed to fetch LP items');
      }
      const data = await response.json();
      setLpItems(data.items || []);
    } catch (error) {
      console.error('Error fetching LP items:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch LP items',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Find asset by barcode using existing assets data
  const findAssetByBarcodeLocal = (barcode: string): Asset | null => {
    // Use the utility function with the assets passed from parent
    return findAssetByBarcode(barcode, assets);
  };

  // Handle asset barcode click
  const handleAssetBarcodeClick = (barcode: string) => {
    console.log('Clicking asset barcode:', barcode);
    
    const asset = findAssetByBarcodeLocal(barcode);
    console.log('Found asset:', asset);
    
    if (asset) {
      onAssetClick(asset);
    } else {
      notifications.show({
        title: 'Asset Not Found',
        message: `No asset found with barcode: ${barcode}`,
        color: 'orange',
        icon: <IconAlertCircle size={16} />,
      });
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchLPItems();
  }, []);

  // Handle form submission
  const handleSubmit = async () => {
    try {
      const url = isEditing ? `/api/lp-items/${selectedItem?.id}` : '/api/lp-items';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          // Convert date fields to ISO format for proper storage
          sampledOn: formData.sampledOn ? new Date(formData.sampledOn).toISOString() : '',
          nextResampleDate: formData.nextResampleDate ? new Date(formData.nextResampleDate).toISOString() : '',
          remedialCompletedDate: formData.remedialCompletedDate ? new Date(formData.remedialCompletedDate).toISOString() : '',
          // Status will be calculated on the server side based on remedialWoNumber
          modifiedBy: 'current-user', // This should come from auth context
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} LP item`);
      }

      notifications.show({
        title: 'Success',
        message: `LP item ${isEditing ? 'updated' : 'created'} successfully`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      handleCloseModal();
      fetchLPItems();
    } catch (error) {
      console.error('Error saving LP item:', error);
      notifications.show({
        title: 'Error',
        message: `Failed to ${isEditing ? 'update' : 'create'} LP item`,
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  // Handle Excel file upload and processing (Planet extraction)
  const handleFileUpload = async () => {
    if (!uploadFile) {
      notifications.show({
        title: 'Error',
        message: 'Please select an Excel file first',
        color: 'red',
        icon: <IconX size={16} />,
      });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(10);

      // Process Excel file
      const extractedData = await processExcelFile(uploadFile);
      setExtractedData(extractedData);
      setUploadProgress(30);

      if (extractedData.length === 0) {
        notifications.show({
          title: 'Warning',
          message: 'No valid data found in the Excel file',
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
        });
        setUploading(false);
        return;
      }

      // Check for duplicates
      const { duplicates, unique } = await checkForDuplicates(extractedData);
      setUploadProgress(50);

      if (duplicates.length > 0) {
        notifications.show({
          title: 'Duplicates Found',
          message: `Found ${duplicates.length} duplicate WO Numbers: ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}. Only unique items will be uploaded.`,
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
        });
      }

      if (unique.length === 0) {
        notifications.show({
          title: 'No New Items',
          message: 'All items already exist in the database (based on WO Number)',
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
        });
        setUploading(false);
        return;
      }

      // Send unique data to API for bulk upload
      const response = await fetch('/api/lp-items/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: unique,
          source: 'planet-extraction', // Specify source as planet extraction
          createdBy: 'current-user', // This should come from auth context
        }),
      });

      setUploadProgress(90);

      if (!response.ok) {
        throw new Error('Failed to upload LP items');
      }

      const result = await response.json();
      setUploadProgress(100);

      notifications.show({
        title: 'Success',
        message: `Successfully uploaded ${result.count || unique.length} unique LP items${duplicates.length > 0 ? ` (${duplicates.length} duplicates skipped)` : ''}`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      // Reset upload state and refresh data
      setUploadModalOpened(false);
      setUploadFile(null);
      setExtractedData([]);
      fetchLPItems();
    } catch (error) {
      console.error('Error uploading Excel file:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to process and upload Excel file',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle template file upload
  const handleTemplateUpload = async () => {
    if (!templateFile) {
      notifications.show({
        title: 'Error',
        message: 'Please select a template file first',
        color: 'red',
        icon: <IconX size={16} />,
      });
      return;
    }

    try {
      setTemplateUploading(true);

      // Process template file
      const templateData = await processTemplateFile(templateFile);

      if (templateData.length === 0) {
        notifications.show({
          title: 'Warning',
          message: 'No valid data found in the template file',
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
        });
        setTemplateUploading(false);
        return;
      }

      // Check for duplicates
      const { duplicates, unique } = await checkForDuplicates(templateData);

      if (duplicates.length > 0) {
        notifications.show({
          title: 'Duplicates Found',
          message: `Found ${duplicates.length} duplicate WO Numbers: ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}. Only unique items will be uploaded.`,
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
        });
      }

      if (unique.length === 0) {
        notifications.show({
          title: 'No New Items',
          message: 'All items already exist in the database (based on WO Number)',
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
        });
        setTemplateUploading(false);
        return;
      }

      // Send unique data to API for bulk upload
      const response = await fetch('/api/lp-items/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: unique,
          source: 'template-upload', // Specify source as template upload
          createdBy: 'current-user', // This should come from auth context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to upload template data');
      }

      const result = await response.json();

      notifications.show({
        title: 'Success',
        message: `Successfully uploaded ${result.count || unique.length} unique LP items${duplicates.length > 0 ? ` (${duplicates.length} duplicates skipped)` : ''}`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      // Reset upload state and refresh data
      setTemplateUploadModalOpened(false);
      setTemplateFile(null);
      fetchLPItems();
    } catch (error) {
      console.error('Error uploading template file:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to process and upload template file',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setTemplateUploading(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this LP item?')) {
      return;
    }

    try {
      const response = await fetch(`/api/lp-items/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete LP item');
      }

      notifications.show({
        title: 'Success',
        message: 'LP item deleted successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      fetchLPItems();
    } catch (error) {
      console.error('Error deleting LP item:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete LP item',
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  // Modal handlers
  const handleOpenModal = (item?: LPItem) => {
    if (item) {
      setIsEditing(true);
      setSelectedItem(item);
      setFormData({
        woNumber: item.woNumber,
        room: item.room,
        location: item.location,
        wing: item.wing,
        assetBarcode: item.assetBarcode,
        positiveCountPre: item.positiveCountPre,
        positiveCountPost: item.positiveCountPost,
        sampleNumber: item.sampleNumber,
        labName: item.labName,
        certificateNumber: item.certificateNumber,
        sampleType: item.sampleType,
        testType: item.testType,
        sampleTemperature: item.sampleTemperature,
        bacteriaVariant: item.bacteriaVariant,
        sampledOn: item.sampledOn ? item.sampledOn.split('T')[0] : '',
        nextResampleDate: item.nextResampleDate ? item.nextResampleDate.split('T')[0] : '',
        hotTemperature: item.hotTemperature,
        coldTemperature: item.coldTemperature,
        remedialWoNumber: item.remedialWoNumber,
        remedialCompletedDate: item.remedialCompletedDate ? item.remedialCompletedDate.split('T')[0] : '',
        status: item.status,
      });
    } else {
      setIsEditing(false);
      setSelectedItem(null);
      setFormData({
        woNumber: '',
        room: '',
        location: '',
        wing: '',
        assetBarcode: '',
        positiveCountPre: '',
        positiveCountPost: '',
        sampleNumber: '',
        labName: '',
        certificateNumber: '',
        sampleType: '',
        testType: '',
        sampleTemperature: '',
        bacteriaVariant: '',
        sampledOn: '',
        nextResampleDate: '',
        hotTemperature: '',
        coldTemperature: '',
        remedialWoNumber: '',
        remedialCompletedDate: '',
        status: 'In Progress',
      });
    }
    setModalOpened(true);
  };

  const handleCloseModal = () => {
    setModalOpened(false);
    setSelectedItem(null);
    setIsEditing(false);
  };

  const handleViewItem = (item: LPItem) => {
    setSelectedItem(item);
    setViewModalOpened(true);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'green';
      case 'inactive': return 'gray';
      case 'pending': return 'yellow';
      case 'archived': return 'red';
      default: return 'blue';
    }
  };

  if (loading) {
    return (
      <Stack align="center" justify="center" h={400}>
        <Loader size="lg" />
        <Text>Loading LP Management data...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {/* Header */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Group>
            <IconDatabase size={24} />
            <div>
              <Title order={2}>LP Management</Title>
              <Text size="sm" c="dimmed">
                Manage LP items synced from SharePoint
              </Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={fetchLPItems}
              loading={refreshing}
            >
              Refresh
            </Button>
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={downloadTemplate}
            >
              Download Template
            </Button>
            <Button
              variant="light"
              leftSection={<IconTemplate size={16} />}
              onClick={() => setTemplateUploadModalOpened(true)}
            >
              Upload Template
            </Button>
            <Button
              variant="light"
              leftSection={<IconUpload size={16} />}
              onClick={() => setUploadModalOpened(true)}
            >
              Extract from Planet
            </Button>
            <Button
              variant="light"
              leftSection={<IconFileExport size={16} />}
              onClick={exportToExcel}
              disabled={filteredLPItems.length === 0}
            >
              Export to Excel
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => handleOpenModal()}
            >
              Add LP Item
            </Button>
          </Group>
        </Group>

      </Card>

      {/* Statistics */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">Total Items</Text>
            <Text fw={700} size="xl">{filteredLPItems.length}</Text>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">Original Samples</Text>
            <Text fw={700} size="xl" c="blue">
              {filteredLPItems.filter(item => item.sampleType === 'Original').length}
            </Text>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">Resamples</Text>
            <Text fw={700} size="xl" c="orange">
              {filteredLPItems.filter(item => item.sampleType === 'Resample').length}
            </Text>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">In Progress</Text>
            <Text fw={700} size="xl" c="orange">
              {filteredLPItems.filter(item => item.status === 'In Progress').length}
            </Text>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Search and Filter Section */}
      <Card shadow="sm" padding="lg" radius="md" withBorder mb="md">
        <Stack gap="md">
          {/* Search Bar */}
          <Group>
            <TextInput
              placeholder="Search across all fields..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftSection={<IconSearch size={16} />}
              style={{ flex: 1 }}
            />
            <Button
              variant={showFilters ? "filled" : "outline"}
              leftSection={<IconFilter size={16} />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
            {(searchQuery || filterSampleType || filterTestType || filterWing || filterStatus || dateRange[0] || dateRange[1] || singleDate) && (
              <Button
                variant="light"
                color="gray"
                leftSection={<IconX size={16} />}
                onClick={clearFilters}
              >
                Clear All
              </Button>
            )}
          </Group>

          {/* Filter Panel */}
          {showFilters && (
            <Card withBorder p="md" bg="gray.0">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Select
                    label="Sample Type"
                    placeholder="All sample types"
                    value={filterSampleType}
                    onChange={(value) => setFilterSampleType(value || '')}
                    data={[
                      { value: '', label: 'All sample types' },
                      ...sampleTypes.map(type => ({ value: type, label: type }))
                    ]}
                    clearable
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Select
                    label="Test Type"
                    placeholder="All test types"
                    value={filterTestType}
                    onChange={(value) => setFilterTestType(value || '')}
                    data={[
                      { value: '', label: 'All test types' },
                      ...testTypes.map(type => ({ value: type, label: type }))
                    ]}
                    clearable
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Select
                    label="Wing"
                    placeholder="All wings"
                    value={filterWing}
                    onChange={(value) => setFilterWing(value || '')}
                    data={[
                      { value: '', label: 'All wings' },
                      ...wings.map(wing => ({ value: wing, label: wing }))
                    ]}
                    clearable
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Select
                    label="Status"
                    placeholder="All statuses"
                    value={filterStatus}
                    onChange={(value) => setFilterStatus(value || '')}
                    data={[
                      { value: '', label: 'All statuses' },
                      { value: 'In Progress', label: 'In Progress' },
                      { value: 'Completed', label: 'Completed' }
                    ]}
                    clearable
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <DatePickerInput
                    label="Date (Sampled On)"
                    placeholder="Select date"
                    value={singleDate}
                    onChange={setSingleDate}
                    clearable
                    leftSection={<IconCalendar size={16} />}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <DatePickerInput
                    type="range"
                    label="Date Range (Sampled On)"
                    placeholder="Select date range"
                    value={dateRange}
                    onChange={setDateRange}
                    leftSection={<IconCalendar size={16} />}
                    clearable
                  />
                </Grid.Col>
              </Grid>
            </Card>
          )}
        </Stack>
      </Card>

      {/* LP Items Table */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={500}>LP Items ({filteredLPItems.length} of {lpItems.length})</Text>
        </Group>


        {/* Active Filters Display */}
        {(searchQuery || filterSampleType || filterTestType || filterWing || filterStatus || dateRange[0] || dateRange[1] || singleDate) && (
          <Group mb="md" gap="xs">
            <Text size="sm" c="dimmed">Active filters:</Text>
            {searchQuery && (
              <Badge variant="light" color="blue" size="sm">
                Search: "{searchQuery}"
              </Badge>
            )}
            {filterSampleType && (
              <Badge variant="light" color="green" size="sm">
                Sample Type: {filterSampleType}
              </Badge>
            )}
            {filterTestType && (
              <Badge variant="light" color="orange" size="sm">
                Test Type: {filterTestType}
              </Badge>
            )}
            {filterWing && (
              <Badge variant="light" color="purple" size="sm">
                Wing: {filterWing}
              </Badge>
            )}
            {filterStatus && (
              <Badge variant="light" color={filterStatus === 'In Progress' ? 'orange' : 'green'} size="sm">
                Status: {filterStatus}
              </Badge>
            )}
            {dateRange[0] && dateRange[1] && (
              <Badge variant="light" color="cyan" size="sm">
                Date Range: {(dateRange[0] instanceof Date ? dateRange[0] : new Date(dateRange[0])).toLocaleDateString()} - {(dateRange[1] instanceof Date ? dateRange[1] : new Date(dateRange[1])).toLocaleDateString()}
              </Badge>
            )}
            {singleDate && (
              <Badge variant="light" color="teal" size="sm">
                Date: {singleDate instanceof Date ? singleDate.toLocaleDateString() : new Date(singleDate).toLocaleDateString()}
              </Badge>
            )}
          </Group>
        )}

        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Asset Barcode</Table.Th>
                <Table.Th>WO Number</Table.Th>
                <Table.Th>Wing</Table.Th>
                <Table.Th>Sample Type</Table.Th>
                <Table.Th>Test Type</Table.Th>
                <Table.Th>Pre Count</Table.Th>
                <Table.Th>Post Count</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Sampled On</Table.Th>
                <Table.Th>Next Resample</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredLPItems.length > 0 ? (
                filteredLPItems.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <Text 
                        fw={500} 
                        c="blue" 
                        style={{ 
                          cursor: 'pointer', 
                          textDecoration: 'underline'
                        }}
                        onClick={() => handleAssetBarcodeClick(item.assetBarcode)}
                      >
                        {item.assetBarcode}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{parseFloat(item.woNumber).toString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={500}>{item.wing}</Text>
                        <Text size="xs" c="dimmed">{item.location}</Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={item.sampleType === 'Original' ? 'blue' : 'orange'}>
                        {item.sampleType}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge 
                        variant="light" 
                        color={item.testType === 'LA' ? 'teal' : item.testType === 'PA' ? 'violet' : 'gray'}
                      >
                        {item.testType || 'N/A'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={parseInt(item.positiveCountPre) > 100 ? 'red' : 'green'}>
                        {item.positiveCountPre} CFU
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={parseInt(item.positiveCountPost) > 100 ? 'red' : 'green'}>
                        {item.positiveCountPost} CFU
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge 
                        variant="light" 
                        color={item.status === 'In Progress' ? 'orange' : 'green'}
                        size="sm"
                      >
                        {item.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {displayDate(item.sampledOn) || 'N/A'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {displayDate(item.nextResampleDate) || 'N/A'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Tooltip label="View Details">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => handleViewItem(item)}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Edit">
                          <ActionIcon
                            variant="subtle"
                            color="orange"
                            onClick={() => handleOpenModal(item)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDelete(item.id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={11}>
                    <Stack align="center" gap="xs" py="xl">
                      <IconDatabase size={48} color="gray" />
                      <Text c="dimmed">
                        {lpItems.length === 0 
                          ? "No LP items found" 
                          : "No LP items match the current filters"
                        }
                      </Text>
                      {lpItems.length === 0 ? (
                        <Button 
                          variant="light" 
                          onClick={() => handleOpenModal()}
                          leftSection={<IconPlus size={16} />}
                        >
                          Add First LP Item
                        </Button>
                      ) : (
                        <Button 
                          variant="light"
                          color="gray"
                          onClick={clearFilters}
                          leftSection={<IconX size={16} />}
                        >
                          Clear Filters
                        </Button>
                      )}
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={handleCloseModal}
        title={isEditing ? 'Edit LP Item' : 'Add LP Item'}
        size="60%"
      >
        <Stack gap="md">
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Asset Barcode"
                placeholder="Enter asset barcode"
                value={formData.assetBarcode}
                onChange={(e) => setFormData({ ...formData, assetBarcode: e.target.value })}
                required
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="WO Number"
                placeholder="Enter work order number"
                value={formData.woNumber}
                onChange={(e) => setFormData({ ...formData, woNumber: e.target.value })}
                required
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Room/Ward Name"
                placeholder="Enter room or ward name"
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Room Number"
                placeholder="Enter specific room number (e.g., LNS-1.191)"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Wing"
                placeholder="Enter wing (e.g., LNS, ROS, MXF)"
                value={formData.wing}
                onChange={(e) => setFormData({ ...formData, wing: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Sample Number"
                placeholder="Enter sample number"
                value={formData.sampleNumber}
                onChange={(e) => setFormData({ ...formData, sampleNumber: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Lab Name"
                placeholder="Enter lab name"
                value={formData.labName}
                onChange={(e) => setFormData({ ...formData, labName: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Certificate Number"
                placeholder="Enter certificate number"
                value={formData.certificateNumber}
                onChange={(e) => setFormData({ ...formData, certificateNumber: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Sample Type"
                placeholder="Select sample type"
                data={sampleTypes}
                value={formData.sampleType}
                onChange={(value) => setFormData({ ...formData, sampleType: value || '' })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Test Type"
                placeholder="Select test type"
                data={testTypes}
                value={formData.testType}
                onChange={(value) => setFormData({ ...formData, testType: value || '' })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Positive Count (Pre)"
                placeholder="CFU count before"
                value={formData.positiveCountPre}
                onChange={(e) => setFormData({ ...formData, positiveCountPre: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Positive Count (Post)"
                placeholder="CFU count after"
                value={formData.positiveCountPost}
                onChange={(e) => setFormData({ ...formData, positiveCountPost: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Sample Temperature"
                placeholder="Enter temperature"
                value={formData.sampleTemperature}
                onChange={(e) => setFormData({ ...formData, sampleTemperature: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Bacteria Variant"
                placeholder="Select bacteria variant"
                data={bacteriaVariants}
                value={formData.bacteriaVariant}
                onChange={(value) => setFormData({ ...formData, bacteriaVariant: value || '' })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Sampled On"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.sampledOn}
                onChange={(e) => setFormData({ ...formData, sampledOn: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Next Resample Date"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.nextResampleDate}
                onChange={(e) => setFormData({ ...formData, nextResampleDate: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Hot Temperature (°C)"
                placeholder="Enter hot temperature"
                value={formData.hotTemperature}
                onChange={(e) => setFormData({ ...formData, hotTemperature: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Cold Temperature (°C)"
                placeholder="Enter cold temperature"
                value={formData.coldTemperature}
                onChange={(e) => setFormData({ ...formData, coldTemperature: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Remedial WO Number"
                placeholder="Enter remedial work order number"
                value={formData.remedialWoNumber}
                onChange={(e) => setFormData({ ...formData, remedialWoNumber: e.target.value })}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Remedial Completed Date"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.remedialCompletedDate}
                onChange={(e) => setFormData({ ...formData, remedialCompletedDate: e.target.value })}
              />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* View Details Modal */}
      <Modal
        opened={viewModalOpened}
        onClose={() => setViewModalOpened(false)}
        title="LP Item Details"
        size="60%"
      >
        {selectedItem && (
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600} size="lg">Asset: {selectedItem.assetBarcode}</Text>
              <Group gap="xs">
                <Badge 
                  variant="light" 
                  color={selectedItem.sampleType === 'Original' ? 'blue' : 'orange'}
                >
                  {selectedItem.sampleType}
                </Badge>
                <Badge 
                  variant="light" 
                  color={selectedItem.status === 'Completed' ? 'green' : 'orange'}
                >
                  {selectedItem.status}
                </Badge>
                <Badge 
                  variant="light" 
                  color="purple"
                >
                  {selectedItem.testType}
                </Badge>
              </Group>
            </Group>

            <Divider />

            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Asset Barcode</Text>
                <Text fw={500}>{selectedItem.assetBarcode}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">WO Number</Text>
                <Text fw={500}>{parseFloat(selectedItem.woNumber).toString()}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Room/Ward Name</Text>
                <Text fw={500}>{selectedItem.room || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Room Number</Text>
                <Text fw={500}>{selectedItem.location || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Wing</Text>
                <Text fw={500}>{selectedItem.wing || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Sample Number</Text>
                <Text fw={500}>{selectedItem.sampleNumber || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Lab Name</Text>
                <Text fw={500}>{selectedItem.labName || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Certificate Number</Text>
                <Text fw={500}>{selectedItem.certificateNumber || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Sample Type</Text>
                <Badge variant="light" color={selectedItem.sampleType === 'Original' ? 'blue' : 'orange'}>
                  {selectedItem.sampleType || 'N/A'}
                </Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Test Type</Text>
                <Badge 
                  variant="light" 
                  color={selectedItem.testType === 'LA' ? 'teal' : selectedItem.testType === 'PA' ? 'violet' : 'gray'}
                >
                  {selectedItem.testType || 'N/A'}
                </Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Positive Count (Pre)</Text>
                <Badge variant="light" color={parseInt(selectedItem.positiveCountPre) > 100 ? 'red' : 'green'}>
                  {selectedItem.positiveCountPre} CFU
                </Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Positive Count (Post)</Text>
                <Badge variant="light" color={parseInt(selectedItem.positiveCountPost) > 100 ? 'red' : 'green'}>
                  {selectedItem.positiveCountPost} CFU
                </Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Sample Temperature</Text>
                <Text fw={500}>{selectedItem.sampleTemperature || 'N/A'}°C</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Bacteria Variant</Text>
                <Text fw={500}>{selectedItem.bacteriaVariant || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Sampled On</Text>
                <Text fw={500}>
                  {displayDate(selectedItem.sampledOn) || 'N/A'}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Next Resample Date</Text>
                <Text fw={500}>
                  {displayDate(selectedItem.nextResampleDate) || 'N/A'}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Hot Temperature</Text>
                <Text fw={500}>{selectedItem.hotTemperature ? `${selectedItem.hotTemperature}°C` : 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Cold Temperature</Text>
                <Text fw={500}>{selectedItem.coldTemperature ? `${selectedItem.coldTemperature}°C` : 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Remedial WO Number</Text>
                <Text fw={500}>{selectedItem.remedialWoNumber || 'N/A'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Remedial Completed Date</Text>
                <Text fw={500}>
                  {displayDate(selectedItem.remedialCompletedDate) || 'N/A'}
                </Text>
              </Grid.Col>
            </Grid>

            <Divider />

            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Created</Text>
                <Text fw={500}>
                  {new Date(selectedItem.createdAt).toLocaleString('en-GB')}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Last Modified</Text>
                <Text fw={500}>
                  {new Date(selectedItem.updatedAt).toLocaleString('en-GB')}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Created By</Text>
                <Text fw={500}>{selectedItem.createdBy}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Modified By</Text>
                <Text fw={500}>{selectedItem.modifiedBy}</Text>
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="md">
              <Button 
                variant="subtle" 
                onClick={() => setViewModalOpened(false)}
              >
                Close
              </Button>
              <Button 
                onClick={() => {
                  setViewModalOpened(false);
                  handleOpenModal(selectedItem);
                }}
                leftSection={<IconEdit size={16} />}
              >
                Edit
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Planet Extraction Modal */}
      <Modal
        opened={uploadModalOpened}
        onClose={() => {
          if (!uploading) {
            setUploadModalOpened(false);
            setUploadFile(null);
            setExtractedData([]);
            setUploadProgress(0);
          }
        }}
        title="Extract from Planet Excel File"
        size="lg"
        closeOnClickOutside={!uploading}
        closeOnEscape={!uploading}
      >
        <Stack gap="md">
          <Alert icon={<IconFileSpreadsheet size={16} />} color="blue" variant="light">
            Upload a Planet Excel file (.xlsx, .xls) containing LP data. The system will automatically extract and process the data based on your Power Automate column mapping. Duplicate WO Numbers will be automatically detected and skipped.
          </Alert>

          <FileInput
            label="Select Excel File"
            placeholder="Choose an Excel file..."
            accept=".xlsx,.xls"
            value={uploadFile}
            onChange={setUploadFile}
            leftSection={<IconFileSpreadsheet size={16} />}
            disabled={uploading}
          />

          {uploading && (
            <Stack gap="xs">
              <Text size="sm" fw={500}>Processing file...</Text>
              <Progress value={uploadProgress} animated />
              <Text size="xs" c="dimmed">
                {uploadProgress < 50 ? 'Reading Excel file...' : 
                 uploadProgress < 90 ? 'Uploading to database...' : 
                 'Finalizing...'}
              </Text>
            </Stack>
          )}

          {extractedData.length > 0 && !uploading && (
            <Alert icon={<IconCheck size={16} />} color="green" variant="light">
              Found {extractedData.length} valid LP items in the Excel file. Ready to upload.
            </Alert>
          )}

          <Group justify="flex-end" mt="md">
            <Button 
              variant="subtle" 
              onClick={() => {
                setUploadModalOpened(false);
                setUploadFile(null);
                setExtractedData([]);
                setUploadProgress(0);
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFileUpload}
              disabled={!uploadFile || uploading}
              loading={uploading}
              leftSection={<IconUpload size={16} />}
            >
              Extract & Upload
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Template Upload Modal */}
      <Modal
        opened={templateUploadModalOpened}
        onClose={() => {
          if (!templateUploading) {
            setTemplateUploadModalOpened(false);
            setTemplateFile(null);
          }
        }}
        title="Upload Template File"
        size="lg"
        closeOnClickOutside={!templateUploading}
        closeOnEscape={!templateUploading}
      >
        <Stack gap="md">
          <Alert icon={<IconTemplate size={16} />} color="green" variant="light">
            Upload a filled template Excel file (.xlsx, .xls) containing LP data. Use the "Download Template" button to get the correct format. Duplicate WO Numbers will be automatically detected and skipped.
          </Alert>

          <FileInput
            label="Select Template File"
            placeholder="Choose a filled template file..."
            accept=".xlsx,.xls"
            value={templateFile}
            onChange={setTemplateFile}
            leftSection={<IconTemplate size={16} />}
            disabled={templateUploading}
          />

          {templateUploading && (
            <Stack gap="xs">
              <Text size="sm" fw={500}>Processing template file...</Text>
              <Loader size="sm" />
            </Stack>
          )}

          <Group justify="flex-end" mt="md">
            <Button 
              variant="subtle" 
              onClick={() => {
                setTemplateUploadModalOpened(false);
                setTemplateFile(null);
              }}
              disabled={templateUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTemplateUpload}
              disabled={!templateFile || templateUploading}
              loading={templateUploading}
              leftSection={<IconUpload size={16} />}
            >
              Upload Template
            </Button>
          </Group>
        </Stack>
      </Modal>


      {/* Asset Overview Modal is now handled by parent component */}
    </Stack>
  );
}
