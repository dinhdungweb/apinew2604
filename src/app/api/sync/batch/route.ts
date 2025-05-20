import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({ message: 'Batch sync API' });
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ 
    message: 'Batch sync API is temporarily disabled',
    info: 'Please use /api/sync/batch-new endpoint instead' 
  });
} 