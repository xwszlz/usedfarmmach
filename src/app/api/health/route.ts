import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // 简单查询验证数据库连接
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        prisma: 'ready',
      },
      version: process.env.npm_package_version || '0.1.0',
      site: process.env.SITE || 'com',
    });
  } catch (err) {
    console.error('[Health Check] Database connection failed:', err);
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'disconnected',
        prisma: 'error',
      },
      error: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 503 });
  }
}