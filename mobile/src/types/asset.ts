export type AssetStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED';

export interface Asset {
  id: string;
  assetBarcode: string;
  assetType: string;
  status: AssetStatus;
  primaryIdentifier: string;
  secondaryIdentifier?: string;
  wing: string;
  wingInShort?: string;
  room?: string;
  floor?: string;
  floorInWords?: string;
  roomNo?: string;
  roomName?: string;
  filterNeeded: boolean;
  filtersOn: boolean;
  filterExpiryDate?: string;
  filterInstalledOn?: string;
  notes?: string;
  augmentedCare: boolean;
  created: string;
  createdBy?: string;
  modified: string;
  modifiedBy?: string;
}
