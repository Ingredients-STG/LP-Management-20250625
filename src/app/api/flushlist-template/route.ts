import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const includeData = searchParams.get('includeData') === 'true';

    // Simple template with just Asset Barcode column
    const columns = ['Asset Barcode'];
    
    let data: any[] = [];
    
    if (includeData) {
      // If user wants sample data, we could fetch some existing barcodes
      // For now, just provide empty sample rows
      data = [
        { 'Asset Barcode': 'B12345' },
        { 'Asset Barcode': 'B67890' },
        { 'Asset Barcode': 'B11111' }
      ];
    } else {
      // Empty template with just headers
      data = [{ 'Asset Barcode': '' }];
    }

    if (format === 'excel') {
      // Create Excel file
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Flushlist');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="flushlist-template-${new Date().toISOString().split('T')[0]}.xlsx"`
        }
      });
    } else {
      // Create CSV file
      const worksheet = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="flushlist-template-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }
  } catch (error) {
    console.error('Error generating flushlist template:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
