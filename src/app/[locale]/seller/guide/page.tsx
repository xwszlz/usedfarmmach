import { FileText, CheckCircle, AlertTriangle, DollarSign, Camera, MessageCircle } from "lucide-react";
import Link from "next/link";

export default function PublishGuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">产品发布指引</h1>
        <p className="text-gray-500">如何在神雕农机平台发布您的二手农机产品</p>
      </div>

      {/* 步骤 */}
      <div className="mb-10 space-y-6">
        <h2 className="text-xl font-bold text-gray-900">发布流程</h2>
        
        <div className="grid gap-4">
          {[
            { step: "1", icon: FileText, title: "注册并登录", desc: "点击右上角「注册」创建卖家账号，或直接登录已有账号。登录后导航栏会出现「卖家中心」入口。" },
            { step: "2", icon: CheckCircle, title: "进入卖家中心", desc: "点击导航栏「卖家中心」进入产品管理页面，点击「发布新产品」按钮开始填写产品信息。" },
            { step: "3", icon: Camera, title: "填写产品信息", desc: "准确填写品牌、型号、年份、工时、成色、价格、位置等信息。越详细越容易成交。也可以使用AI拍照识别功能，上传照片后自动填充规格字段。小程序用户可拍8张定向照片+1个运转视频，系统自动识别并估值。" },
            { step: "4", icon: DollarSign, title: "消耗积分发布", desc: "每发布一台产品消耗 1 积分。首次注册赠送 1 积分，积分不足时联系管理员充值。" },
            { step: "5", icon: MessageCircle, title: "等待买家询盘", desc: "产品上线后买家将能看到并联系您。您可以在卖家中心查看收到的询盘信息。" },
          ].map((item) => (
            <div key={item.step} className="flex gap-4 rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">第{item.step}步：{item.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 填写标准 */}
      <div className="mb-10 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-gray-900">填写规范</h2>
        <div className="space-y-3 text-sm">
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">品牌</span>
            <span className="text-gray-600">从下拉列表中选择对应品牌。如果列表中没有，联系管理员添加。</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">型号</span>
            <span className="text-gray-600">填写准确的型号名称，如"970"、"FR450"、"5300RC"等。不要包含品牌名称。</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">年份</span>
            <span className="text-gray-600">填写出厂年份，四位数字，如 2017。不确定时填写大概年份。</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">工时</span>
            <span className="text-gray-600">填写发动机或轧辊工作小时数。非必填，但提供后增加买家信任度。</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">成色</span>
            <span className="text-gray-600">优秀/良好/一般/较差。根据机器实际状况如实选择。</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">价格</span>
            <span className="text-gray-600">填写人民币报价。单位：元。如 1630000 表示 163万元。</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">位置</span>
            <span className="text-gray-600">填写设备所在地，如"河北"、"山东青岛"。</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">描述</span>
            <span className="text-gray-600">可补充产品配置、维修历史、亮点说明等。内容越详细，买家询盘率越高。</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">视频</span>
            <span className="text-gray-600">上传运转视频可提升买家信任度，并纳入估值参考。建议MP4格式，15-120秒，包含：绕机全景、发动机启动、作业演示、仪表展示、铭牌特写。</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">港口</span>
            <span className="text-gray-600">发货港口根据您的位置自动匹配最近港口（如河北→天津港，山东→青岛港），可手动修改。</span>
          </div>
        </div>
      </div>

      {/* 注意事项 */}
      <div className="mb-10 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <h3 className="font-semibold text-amber-800">注意事项</h3>
            <ul className="mt-2 space-y-1 text-sm text-amber-700">
              <li>• 请确保产品信息真实准确，虚假信息将被下架</li>
              <li>• 产品上线后会自动显示在设备市场和搜索中</li>
              <li>• 卖家需自行与买家沟通交易细节和物流</li>
              <li>• 平台提供跨境物流方案支持</li>
              <li>• 大额交易建议使用第三方资金托管</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 开始发布 */}
      <div className="text-center">
        <Link
          href="/zh/seller/products/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white hover:bg-primary-700"
        >
          立即发布产品
        </Link>
        <p className="mt-2 text-xs text-gray-400">发布消耗 1 积分</p>
      </div>
    </div>
  );
}
