import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/articles/[id] - 获取单篇文章详情（支持id或slug）
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 先尝试按ID查找，再按slug查找
    let article = await prisma.article.findUnique({ where: { id } });

    if (!article) {
      article = await prisma.article.findUnique({ where: { slug: id } });
    }

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // 增加浏览量
    await prisma.article.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({ ...article, viewCount: article.viewCount + 1 });
  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
  }
}

// PUT /api/articles/[id] - 更新文章
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const updateData: any = { ...body };
    if (body.tags && typeof body.tags === 'object') {
      updateData.tags = JSON.stringify(body.tags);
    }
    if (body.status === 'published' && !body.publishedAt) {
      updateData.publishedAt = new Date();
    }

    const article = await prisma.article.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(article);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }
    console.error('Error updating article:', error);
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 });
  }
}

// DELETE /api/articles/[id] - 删除文章
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await prisma.article.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }
    console.error('Error deleting article:', error);
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
  }
}
