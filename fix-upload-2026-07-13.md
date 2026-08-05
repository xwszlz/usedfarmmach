# 修复：AI 智能识别图片上传失败

## 问题
产品发布页点击"开始智能识别"后提示：
**"所有图片上传失败，请检查网络后重试"**

## 根因
`src/app/api/ai-image-upload/route.ts` 使用 OSS 签名 v1 算法直接 PUT 上传图片到阿里云 OSS。

`generateOSSAuth()` 内部签名时使用了一个 `Date`：
```typescript
const date = new Date().toUTCString();
```

但 fetch headers 中又使用了另一个 `Date`：
```typescript
Date: new Date().toUTCString(),
```

OSS 服务端会用请求头里的 `Date` 重算签名，两个时间不一致导致 403，前端收到失败结果后抛出"所有图片上传失败"。

## 修复
修改文件：`src/app/api/ai-image-upload/route.ts`

1. `generateOSSAuth()` 改为返回 `{ authHeader, date }`，确保签名和请求头使用同一个 Date
2. fetch headers 的 `Date` 字段使用 `generateOSSAuth()` 返回的 `date`
3. 错误返回增加 OSS 响应文本，便于后续排查

## 验证
- `npx tsc --noEmit` 通过，零错误
- Git commit: `a940206 fix: OSS上传签名Date时间不一致导致AI图片上传失败`
- 已推送 GitHub: `e6d4784..a940206 main -> main`
- Vercel 自动部署中

## 后续建议
等 Vercel 部署完成后（约 2-3 分钟），在产品发布页重新点击"AI 智能识别"测试图片上传和识别。
