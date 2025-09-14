import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '@/lib/backup';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emailAddress } = body;

    if (!emailAddress) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
      return NextResponse.json(
        { error: 'Invalid email address format' },
        { status: 400 }
      );
    }

    console.log(`Starting backup process for email: ${emailAddress}`);

    // Create backup
    const result = await BackupService.createBackup(emailAddress);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        filesGenerated: result.filesGenerated,
        emailSent: result.emailSent
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Backup failed',
          message: result.message 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Backup API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('Getting backup status...');
    
    const status = await BackupService.getBackupStatus();
    
    return NextResponse.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('Backup status API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get backup status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
