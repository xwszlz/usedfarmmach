import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/articles - 获取文章列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'published';
    const category = searchParams.get('category');
    const sourcePlatform = searchParams.get('sourcePlatform');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search');
    const lang = searchParams.get('lang') || 'zh';

    const where: any = { status };
    if (category) where.category = category;
    if (sourcePlatform) where.sourcePlatform = sourcePlatform;
    if (search) {
      where.OR = [
        { titleZh: { contains: search, mode: 'insensitive' } },
        { titleEn: { contains: search, mode: 'insensitive' } },
        { titleRu: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          titleZh: true,
          titleEn: true,
          titleRu: true,
          excerptZh: true,
          excerptEn: true,
          excerptRu: true,
          coverImage: true,
          category: true,
          tags: true,
          tagsEn: true,
          tagsRu: true,
          sourcePlatform: true,
          publishedAt: true,
          viewCount: true,
          createdAt: true,
        },
      }),
      prisma.article.count({ where }),
    ]);

    return NextResponse.json({
      articles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}

// POST /api/articles - 创建新文章
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      slug,
      titleZh,
      titleEn,
      titleRu,
      contentZh,
      contentEn,
      contentRu,
      excerptZh,
      excerptEn,
      excerptRu,
      coverImage,
      status = 'draft',
      category,
      tags,
      sourcePlatform,
      sourceUrl,
      metaTitle,
      metaDesc,
      keywords,
      publishedAt,
    } = body;

    if (!slug || !titleZh || !contentZh) {
      return NextResponse.json(
        { error: 'slug, titleZh, and contentZh are required' },
        { status: 400 }
      );
    }

    const article = await prisma.article.create({
      data: {
        slug,
        titleZh,
        titleEn,
        titleRu,
        contentZh,
        contentEn,
        contentRu,
        excerptZh,
        excerptEn,
        excerptRu,
        coverImage,
        status,
        category,
        tags: typeof tags === 'object' ? JSON.stringify(tags) : tags,
        sourcePlatform,
        sourceUrl,
        metaTitle,
        metaDesc,
        keywords,
        publishedAt: status === 'published' ? (publishedAt ? new Date(publishedAt) : new Date()) : null,
      },
    });

    return NextResponse.json(article, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }
    console.error('Error creating article:', error);
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 });
  }
}
