import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = `asset-files-${process.env.NODE_ENV || 'dev'}`;

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('Upload request received');
    
    // Check environment variables
    if (!process.env.AMPLIFY_ACCESS_KEY_ID || !process.env.AMPLIFY_SECRET_ACCESS_KEY) {
      console.error('Missing AWS credentials');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const assetId = formData.get('assetId') as string;
    
    console.log('File:', file?.name, 'Asset ID:', assetId);
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!assetId) {
      return NextResponse.json(
        { success: false, error: 'Asset ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'File type not allowed' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${assetId}/${uuidv4()}.${fileExtension}`;

    // Convert file to buffer
    const buffer = await file.arrayBuffer();

    // Upload to S3
    console.log('Uploading to S3:', BUCKET_NAME, uniqueFileName);
    
    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFileName,
      Body: new Uint8Array(buffer),
      ContentType: file.type,
      Metadata: {
        originalName: file.name,
        assetId: assetId,
        uploadedAt: new Date().toISOString(),
      },
    });

    const uploadResult = await s3Client.send(uploadCommand);
    console.log('S3 upload successful:', uploadResult);

    // Generate S3 URL
    const s3Url = `https://${BUCKET_NAME}.s3.${process.env.AMPLIFY_AWS_REGION || 'eu-west-2'}.amazonaws.com/${uniqueFileName}`;

    const response = NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileType: file.type,
        s3Url: s3Url,
        uploadedAt: new Date().toISOString(),
      }
    });

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;

  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Upload failed. Please check the file and try again.' 
      },
      { status: 500 }
    );
  }
}

// DELETE - Remove file from S3
export async function DELETE(request: NextRequest) {
  try {
    const { s3Url } = await request.json();
    
    if (!s3Url) {
      return NextResponse.json(
        { success: false, error: 'S3 URL is required' },
        { status: 400 }
      );
    }

    // Extract key from S3 URL
    const urlParts = s3Url.split('/');
    const key = urlParts.slice(-2).join('/'); // Get assetId/filename.ext

    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(deleteCommand);

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete file' 
      },
      { status: 500 }
    );
  }
} 