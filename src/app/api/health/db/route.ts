import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // 测试数据库连接 + 简单查询验证表存在
    const result = await prisma.$queryRaw<{ connected: boolean; tables: number }[]>`
      SELECT 
        true as connected,
        (SELECT count(*) FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as tables
    `;
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      connected: true,
      tables: Number(result[0]?.tables || 0),
      site: process.env.SITE || 'com',
    });
  } catch (err) {
    console.error('[Health Check DB] Database connection failed:', err);
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      connected: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 503 });
  }
}