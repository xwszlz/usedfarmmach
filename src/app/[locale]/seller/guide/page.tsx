import { FileText, CheckCircle, AlertTriangle, DollarSign, Camera, MessageCircle } from "lucide-react";
import Link from "next/link";
import { translate } from "@/lib/i18n-runtime";
import { getLocale } from "next-intl/server";
export default async function PublishGuidePage() {
  const locale = await getLocale();
    return (<div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">{translate("产品发布指引", locale)}</h1>
        <p className="text-gray-500">{translate("如何在神雕农机平台发布您的二手农机产品", locale)}</p>
      </div>

      {/* 步骤 */}
      <div className="mb-10 space-y-6">
        <h2 className="text-xl font-bold text-gray-900">{translate("发布流程", locale)}</h2>
        
        <div className="grid gap-4">
          {[
            { step: "1", icon: FileText, title: translate("注册并登录", locale), desc: "\u70B9\u51FB\u53F3\u4E0A\u89D2\u300C\u6CE8\u518C\u300D\u521B\u5EFA\u5356\u5BB6\u8D26\u53F7\uFF0C\u6216\u76F4\u63A5\u767B\u5F55\u5DF2\u6709\u8D26\u53F7\u3002\u767B\u5F55\u540E\u5BFC\u822A\u680F\u4F1A\u51FA\u73B0\u300C\u5356\u5BB6\u4E2D\u5FC3\u300D\u5165\u53E3\u3002" },
            { step: "2", icon: CheckCircle, title: translate("进入卖家中心", locale), desc: "\u70B9\u51FB\u5BFC\u822A\u680F\u300C\u5356\u5BB6\u4E2D\u5FC3\u300D\u8FDB\u5165\u4EA7\u54C1\u7BA1\u7406\u9875\u9762\uFF0C\u70B9\u51FB\u300C\u53D1\u5E03\u65B0\u4EA7\u54C1\u300D\u6309\u94AE\u5F00\u59CB\u586B\u5199\u4EA7\u54C1\u4FE1\u606F\u3002" },
            { step: "3", icon: Camera, title: translate("填写产品信息", locale), desc: "\u51C6\u786E\u586B\u5199\u54C1\u724C\u3001\u578B\u53F7\u3001\u5E74\u4EFD\u3001\u5DE5\u65F6\u3001\u6210\u8272\u3001\u4EF7\u683C\u3001\u4F4D\u7F6E\u7B49\u4FE1\u606F\u3002\u8D8A\u8BE6\u7EC6\u8D8A\u5BB9\u6613\u6210\u4EA4\u3002\u4E5F\u53EF\u4EE5\u4F7F\u7528AI\u62CD\u7167\u8BC6\u522B\u529F\u80FD\uFF0C\u4E0A\u4F20\u7167\u7247\u540E\u81EA\u52A8\u586B\u5145\u89C4\u683C\u5B57\u6BB5\u3002\u5C0F\u7A0B\u5E8F\u7528\u6237\u53EF\u62CD8\u5F20\u5B9A\u5411\u7167\u7247+1\u4E2A\u8FD0\u8F6C\u89C6\u9891\uFF0C\u7CFB\u7EDF\u81EA\u52A8\u8BC6\u522B\u5E76\u4F30\u503C\u3002" },
            { step: "4", icon: DollarSign, title: translate("消耗积分发布", locale), desc: "\u6BCF\u53D1\u5E03\u4E00\u53F0\u4EA7\u54C1\u6D88\u8017 1 \u79EF\u5206\u3002\u9996\u6B21\u6CE8\u518C\u8D60\u9001 1 \u79EF\u5206\uFF0C\u79EF\u5206\u4E0D\u8DB3\u65F6\u8054\u7CFB\u7BA1\u7406\u5458\u5145\u503C\u3002" },
            { step: "5", icon: MessageCircle, title: translate("等待买家询盘", locale), desc: "\u4EA7\u54C1\u4E0A\u7EBF\u540E\u4E70\u5BB6\u5C06\u80FD\u770B\u5230\u5E76\u8054\u7CFB\u60A8\u3002\u60A8\u53EF\u4EE5\u5728\u5356\u5BB6\u4E2D\u5FC3\u67E5\u770B\u6536\u5230\u7684\u8BE2\u76D8\u4FE1\u606F\u3002" },
        ].map(async (item) => {
  const locale = await getLocale();
  return (<div key={item.step} className="flex gap-4 rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                <item.icon className="h-5 w-5"/>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{translate("第", locale)}{item.step}{translate("步：", locale)}{item.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{item.desc}</p>
              </div>
            </div>);
})}
        </div>
      </div>

      {/* 填写标准 */}
      <div className="mb-10 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-gray-900">{translate("填写规范", locale)}</h2>
        <div className="space-y-3 text-sm">
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{translate("品牌", locale)}</span>
            <span className="text-gray-600">{translate("从下拉列表中选择对应品牌。如果列表中没有，联系管理员添加。", locale)}</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{translate("型号", locale)}</span>
            <span className="text-gray-600">{translate("填写准确的型号名称，如\"970\"、\"FR450\"、\"5300RC\"等。不要包含品牌名称。", locale)}</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{translate("年份", locale)}</span>
            <span className="text-gray-600">{translate("填写出厂年份，四位数字，如 2017。不确定时填写大概年份。", locale)}</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{translate("工时", locale)}</span>
            <span className="text-gray-600">{translate("填写发动机或轧辊工作小时数。非必填，但提供后增加买家信任度。", locale)}</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{translate("成色", locale)}</span>
            <span className="text-gray-600">{translate("优秀/良好/一般/较差。根据机器实际状况如实选择。", locale)}</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{translate("价格", locale)}</span>
            <span className="text-gray-600">{translate("填写人民币报价。单位：元。如 1630000 表示 163万元。", locale)}</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{translate("位置", locale)}</span>
            <span className="text-gray-600">{translate("填写设备所在地，如\"河北\"、\"山东青岛\"。", locale)}</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{translate("描述", locale)}</span>
            <span className="text-gray-600">{translate("可补充产品配置、维修历史、亮点说明等。内容越详细，买家询盘率越高。", locale)}</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{translate("视频", locale)}</span>
            <span className="text-gray-600">{translate("上传运转视频可提升买家信任度，并纳入估值参考。建议MP4格式，15-120秒，包含：绕机全景、发动机启动、作业演示、仪表展示、铭牌特写。", locale)}</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{translate("港口", locale)}</span>
            <span className="text-gray-600">{translate("发货港口根据您的位置自动匹配最近港口（如河北→天津港，山东→青岛港），可手动修改。", locale)}</span>
          </div>
        </div>
      </div>

      {/* 注意事项 */}
      <div className="mb-10 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600"/>
          <div>
            <h3 className="font-semibold text-amber-800">{translate("注意事项", locale)}</h3>
            <ul className="mt-2 space-y-1 text-sm text-amber-700">
              <li>{translate("• 请确保产品信息真实准确，虚假信息将被下架", locale)}</li>
              <li>{translate("• 产品上线后会自动显示在设备市场和搜索中", locale)}</li>
              <li>{translate("• 卖家需自行与买家沟通交易细节和物流", locale)}</li>
              <li>{translate("• 平台提供跨境物流方案支持", locale)}</li>
              <li>{translate("• 大额交易建议使用第三方资金托管", locale)}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 开始发布 */}
      <div className="text-center">
        <Link href="/zh/seller/products/new" className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white hover:bg-primary-700">{translate("立即发布产品", locale)}</Link>
        <p className="mt-2 text-xs text-gray-400">{translate("发布消耗 1 积分", locale)}</p>
      </div>
    </div>);
}
