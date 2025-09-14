import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Date utilities
export const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '-';
  
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (!isValid(date)) return '-';
    
    return format(date, 'dd/MM/yyyy');
  } catch {
    return '-';
  }
};

export const formatDateTime = (dateString?: string | null): string => {
  if (!dateString) return '-';
  
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (!isValid(date)) return '-';
    
    return format(date, 'dd/MM/yyyy HH:mm');
  } catch {
    return '-';
  }
};

export const formatDateForInput = (dateString?: string | null): string => {
  if (!dateString) return '';
  
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (!isValid(date)) return '';
    
    return format(date, 'yyyy-MM-dd');
  } catch {
    return '';
  }
};

// Validation utilities
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidBarcode = (barcode: string): boolean => {
  // Basic barcode validation - alphanumeric, 3-20 characters
  const barcodeRegex = /^[A-Z0-9]{3,20}$/i;
  return barcodeRegex.test(barcode);
};

// String utilities
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const capitalizeFirst = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const normalizeStatusDisplay = (status: string): string => {
  return capitalizeFirst(status);
};

// Number utilities
export const formatCurrency = (amount: number, currency = 'GBP'): string => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-GB').format(num);
};

// Array utilities
export const groupBy = <T, K extends string | number | symbol>(
  array: T[],
  getKey: (item: T) => K
): Record<K, T[]> => {
  return array.reduce((grouped, item) => {
    const key = getKey(item);
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
    return grouped;
  }, {} as Record<K, T[]>);
};

export const sortBy = <T>(
  array: T[],
  getValue: (item: T) => string | number | Date,
  direction: 'asc' | 'desc' = 'asc'
): T[] => {
  return [...array].sort((a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
};

// Search utilities
export const searchInObject = <T extends Record<string, unknown>>(
  obj: T,
  searchTerm: string,
  searchFields?: (keyof T)[]
): boolean => {
  const term = searchTerm.toLowerCase();
  const fieldsToSearch = searchFields || Object.keys(obj);
  
  return fieldsToSearch.some(field => {
    const value = obj[field];
    if (value == null) return false;
    
    return String(value).toLowerCase().includes(term);
  });
};

// File utilities
export const downloadFile = (content: string, filename: string, contentType: string): void => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Local storage utilities
export const storage = {
  get: <T>(key: string, defaultValue?: T): T | null => {
    if (typeof window === 'undefined') return defaultValue || null;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue || null;
    } catch (error) {
      console.error(`Error reading from localStorage:`, error);
      return defaultValue || null;
    }
  },

  set: <T>(key: string, value: T): void => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage:`, error);
    }
  },

  remove: (key: string): void => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from localStorage:`, error);
    }
  },

  clear: (): void => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.clear();
    } catch (error) {
      console.error(`Error clearing localStorage:`, error);
    }
  },
};

// Debounce utility
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Error handling utilities
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  
  return 'An unexpected error occurred';
};

// Type guards
export const isNotNull = <T>(value: T | null | undefined): value is T => {
  return value != null;
};

export const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value);
}; 

// Date and time formatting utilities
export const formatTimestamp = (date: Date | string): string => {
  let d: Date;
  if (typeof date === 'string') {
    // If the string contains a 'Z' (end of ISO), strip anything after it
    const zIndex = date.indexOf('Z');
    const cleanDate = zIndex !== -1 ? date.substring(0, zIndex + 1) : date;
    d = new Date(cleanDate);
  } else {
    d = date;
  }
  if (isNaN(d.getTime())) return '-';
  // Format as DD/MM/YYYY HH:mm:ss (UK format, 24-hour clock)
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

// User identification utilities
export const getCurrentUser = (): string => {
  // This function should be called from components that have access to auth context
  // For server-side operations, we'll need to pass the user info explicitly
  if (typeof window !== 'undefined') {
    // Try to get user from localStorage if available
    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        return user.email || user.username || 'Unknown User';
      }
    } catch (error) {
      console.warn('Error reading user from localStorage:', error);
    }
  }
  return 'System User';
};

export const getCurrentUserEmail = (): string => {
  if (typeof window !== 'undefined') {
    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        return user.email || 'unknown@system.local';
      }
    } catch (error) {
      console.warn('Error reading user email from localStorage:', error);
    }
  }
  return 'system@local';
};

// Asset matching utilities
export interface Asset {
  id?: string;
  assetBarcode: string;
  status: string;
  assetType: string;
  primaryIdentifier: string;
  secondaryIdentifier: string;
  wing: string;
  wingInShort: string;
  room: string;
  floor: string;
  floorInWords: string;
  roomNo: string;
  roomName: string;
  filterNeeded: boolean | string;
  filtersOn: boolean | string;
  filterExpiryDate: string;
  filterInstalledOn: string;
  needFlushing: boolean | string;
  filterType: string;
  notes: string;
  reasonForFilterChange?: string;
  augmentedCare: boolean | string;
  lowUsageAsset: boolean | string;
  attachments?: Array<{
    fileName: string;
    fileType: string;
    s3Url: string;
    uploadedAt: string;
  }>;
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;
}

/**
 * Find an asset by barcode with enhanced matching logic
 * 1. First tries exact barcode match
 * 2. If no match, searches through asset notes for the barcode
 * This handles cases where asset barcodes have been changed over time
 */
export const findAssetByBarcode = (barcode: string, assets: Asset[]): Asset | null => {
  console.log('findAssetByBarcode called with:', { barcode, assetsCount: assets?.length });
  
  if (!barcode || !assets || assets.length === 0) {
    console.log('Early return: missing barcode or assets');
    return null;
  }

  // Step 1: Try exact barcode match
  const exactMatch = assets.find(asset => {
    const match = asset.assetBarcode && asset.assetBarcode.toLowerCase() === barcode.toLowerCase();
    if (match) {
      console.log('Found exact match:', asset.assetBarcode);
    }
    return match;
  });
  
  if (exactMatch) {
    return exactMatch;
  }

  // Step 2: Search through asset notes for the barcode
  const noteMatch = assets.find(asset => {
    if (!asset.notes) return false;
    
    // Search for the barcode in notes (case-insensitive)
    const notesText = asset.notes.toLowerCase();
    const searchBarcode = barcode.toLowerCase();
    
    // Look for the barcode as a standalone word or with common separators
    const barcodeRegex = new RegExp(`\\b${searchBarcode}\\b`, 'i');
    const match = barcodeRegex.test(notesText);
    if (match) {
      console.log('Found note match:', asset.assetBarcode, 'in notes:', asset.notes);
    }
    return match;
  });

  console.log('No match found for barcode:', barcode);
  return noteMatch || null;
};

/**
 * Get all assets that match a barcode (including historical matches)
 * Useful for finding all related assets when barcodes have changed
 */
export const findAllAssetsByBarcode = (barcode: string, assets: Asset[]): Asset[] => {
  if (!barcode || !assets || assets.length === 0) {
    return [];
  }

  const matches: Asset[] = [];
  const searchBarcode = barcode.toLowerCase();

  assets.forEach(asset => {
    // Check exact barcode match
    if (asset.assetBarcode && asset.assetBarcode.toLowerCase() === searchBarcode) {
      matches.push(asset);
      return;
    }

    // Check notes for barcode reference
    if (asset.notes) {
      const notesText = asset.notes.toLowerCase();
      const barcodeRegex = new RegExp(`\\b${searchBarcode}\\b`, 'i');
      if (barcodeRegex.test(notesText)) {
        matches.push(asset);
      }
    }
  });

  return matches;
}; 