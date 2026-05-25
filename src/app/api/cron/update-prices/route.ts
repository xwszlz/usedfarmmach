import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/cron/update-prices
 * 手动触发价格数据更新（定时任务接口）
 * 
 * 此API由定时任务调用，用于更新国际市场价格数据
 * 需要API密钥验证
 * 
 * 请求头：
 * Authorization: Bearer [API_KEY]
 * 
 * 响应格式：
 * {
 *   success: boolean,
 *   message: string,
 *   error?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // API密钥验证
    const authHeader = request.headers.get("Authorization");
    const apiKey = process.env.CRON_API_KEY || "dev-secret-key";
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "缺少授权信息" },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    if (token !== apiKey && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "无效的API密钥" },
        { status: 401 }
      );
    }
    
    // TODO: 触发价格数据更新
    // 实际实现中应该调用价格更新脚本或服务
    // 例如: await updateInternationalPrices();
    
    console.log("手动触发价格数据更新");
    
    // 模拟异步操作
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return NextResponse.json({
      success: true,
      message: "价格数据更新任务已触发，请稍后查看结果",
      timestamp: new Date().toISOString()
    }, { status: 200 });
    
  } catch (error) {
    console.error("价格更新API错误:", error);
    
    const errorMessage = error instanceof Error ? error.message : "内部服务器错误";
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}