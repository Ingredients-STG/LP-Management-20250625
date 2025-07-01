// Shared filter logic utility for consistent behavior across forms and CSV upload

export interface FilterLogicInput {
  filterInstalledOn?: Date | string | null;
  filterNeeded?: boolean;
  filtersOn?: boolean;
}

export interface FilterLogicResult {
  filterNeeded: boolean;
  filtersOn: boolean;
  filterInstalledOn: string | null;
  filterExpiryDate: string | null;
  errors: string[];
}

/**
 * Apply the complete filter logic rules consistently across forms and CSV upload
 * 
 * Rules:
 * 1. If filterInstalledOn is present and valid:
 *    - Set filterNeeded = true
 *    - Set filtersOn = true
 *    - Calculate filterExpiry = filterInstalledOn + 3 months
 * 
 * 2. If filterInstalledOn is missing or invalid:
 *    - Set filterNeeded = false
 *    - Set filtersOn = false
 *    - Clear filterExpiry and filterInstalledOn
 * 
 * 3. If filtersOn = false explicitly provided:
 *    - Force clear filterInstalledOn and filterExpiry
 *    - Retain filterNeeded value if manually specified
 * 
 * 4. Validation Check:
 *    - If filterNeeded = true but filterInstalledOn missing:
 *      → Return error: "Filter Installed Date is required when Filter Needed is YES"
 */
export function applyFilterLogic(input: FilterLogicInput): FilterLogicResult {
  const errors: string[] = [];
  let filterNeeded: boolean;
  let filtersOn: boolean;
  let filterInstalledOn: string | null = null;
  let filterExpiryDate: string | null = null;

  // Parse and validate filter installed date
  const parsedInstalled = parseFilterDate(input.filterInstalledOn);

  // Rule 3: If filtersOn = false explicitly provided, override all logic
  if (input.filtersOn === false) {
    filterNeeded = input.filterNeeded ?? false;
    filtersOn = false;
    filterInstalledOn = null;
    filterExpiryDate = null;
  }
  // Rule 1: If filterInstalledOn is present and valid
  else if (parsedInstalled) {
    filterNeeded = true;
    filtersOn = true;
    filterInstalledOn = parsedInstalled;
    
    // Calculate filter expiry using the enhanced function
    const installedDate = new Date(parsedInstalled);
    const expiryDate = getFilterExpiryFromInstalledDate(installedDate);
    filterExpiryDate = expiryDate.toISOString().split('T')[0];
  }
  // Rule 2: If filterInstalledOn is missing or invalid
  else {
    filterNeeded = false;
    filtersOn = false;
    filterInstalledOn = null;
    filterExpiryDate = null;
  }

  // Rule 4: Validation Check
  if (input.filterNeeded === true && !parsedInstalled) {
    errors.push("Filter Installed Date is required when Filter Needed is YES");
  }

  return {
    filterNeeded,
    filtersOn,
    filterInstalledOn,
    filterExpiryDate,
    errors
  };
}

/**
 * Calculate filter expiry date exactly 3 months from installation date
 * Handles month overflow by adjusting to the last valid day of the target month
 */
function getFilterExpiryFromInstalledDate(installed: Date): Date {
  // Work with UTC to avoid timezone issues
  const year = installed.getUTCFullYear();
  const month = installed.getUTCMonth();
  const day = installed.getUTCDate();
  
  // Calculate target month and year
  const targetMonth = (month + 3) % 12;
  const targetYear = year + Math.floor((month + 3) / 12);
  
  // Get the last day of the target month
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  
  // Set to the original day or the last valid day of the target month
  const targetDay = Math.min(day, lastDayOfTargetMonth);
  
  // Create the result date in UTC
  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

/**
 * Parse filter date from various input formats including dd/mm/yyyy
 * Returns ISO date string (YYYY-MM-DD) or null if invalid
 */
function parseFilterDate(value: any): string | null {
  if (!value) return null;

  try {
    let date: Date;
    
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      
      // Check for dd/mm/yyyy format
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split('/');
        date = new Date(`${year}-${month}-${day}`);
      } else {
        date = new Date(trimmed);
      }
    } else {
      return null;
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch {
    return null;
  }
}

/**
 * Calculate filter age in days from installation date
 * Returns null if no valid installation date or filters are off
 */
export function calculateFilterAge(filterInstalledOn: string | null, filtersOn: boolean): number | null {
  if (!filtersOn || !filterInstalledOn) return null;

  try {
    const installedDate = new Date(filterInstalledOn);
    const today = new Date();
    
    if (isNaN(installedDate.getTime())) return null;
    
    const diffTime = today.getTime() - installedDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 0 ? diffDays : null;
  } catch {
    return null;
  }
}

/**
 * Format filter age for display
 */
export function formatFilterAge(filterInstalledOn: string | null, filtersOn: boolean): string | null {
  const age = calculateFilterAge(filterInstalledOn, filtersOn);
  if (age === null) return null;
  
  if (age === 0) return "🕒 Filter Age: Today";
  if (age === 1) return "🕒 Filter Age: 1 day";
  return `🕒 Filter Age: ${age} days`;
} 