import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://r1iqp059n5.execute-api.eu-west-2.amazonaws.com/dev';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    
    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'Endpoint parameter is required' },
        { status: 400 }
      );
    }

    // Map endpoint to actual API path
    let apiPath = '';
    switch (endpoint) {
      case 'assets':
        apiPath = '/assets';
        break;
      case 'dashboard':
        apiPath = '/dashboard';
        break;
      default:
        apiPath = `/${endpoint}`;
    }

    const response = await fetch(`${API_BASE_URL}${apiPath}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      data: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Proxy API Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    
    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'Endpoint parameter is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    console.log('Proxy PUT request:', { endpoint, body });

    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      throw new Error(`API responded with status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('API response data:', data);
    
    return NextResponse.json({
      success: true,
      data: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Proxy API Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    
    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'Endpoint parameter is required' },
        { status: 400 }
      );
    }

    console.log('Proxy DELETE request:', { endpoint });

    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      throw new Error(`API responded with status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('API response data:', data);
    
    return NextResponse.json({
      success: true,
      data: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Proxy API Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    
    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'Endpoint parameter is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    console.log('Proxy POST request:', { endpoint, body });

    // Handle different actions for assets
    let apiPath = `/${endpoint}`;
    let method = 'POST';
    let requestBody = body;

    if (endpoint === 'assets' && body.action) {
      switch (body.action) {
        case 'update':
          // For updates, we need to use PUT method and send just the asset data
          method = 'PUT';
          apiPath = `/assets/${body.asset.id}`;
          requestBody = body.asset;
          break;
        case 'create':
          method = 'POST';
          apiPath = '/assets';
          requestBody = body.asset;
          break;
        case 'delete':
          method = 'DELETE';
          apiPath = `/assets/${body.assetId}`;
          requestBody = {};
          break;
        default:
          // Default POST behavior
          break;
      }
    }

    console.log('Making API call:', { method, apiPath, requestBody });

    const response = await fetch(`${API_BASE_URL}${apiPath}`, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method !== 'DELETE' ? JSON.stringify(requestBody) : undefined,
    });

    console.log('API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      throw new Error(`API responded with status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('API response data:', data);
    
    return NextResponse.json({
      success: true,
      data: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Proxy API Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
