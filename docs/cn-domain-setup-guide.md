# usedfarmmach.cn 域名配置指南

## 当前状态

✅ **域名已成功添加到 Vercel 项目**  
`usedfarmmach.cn` 已添加到 Vercel 项目 `usedfarmmach` 中。

⚠️ **DNS 配置待完成**  
Vercel 检测到域名尚未正确配置。需要您在阿里云 DNS 控制台完成配置。

## DNS 配置选项（二选一）

### 选项 A：添加 A 记录（推荐，简单快捷）

1. 登录 [阿里云控制台](https://homenew.console.aliyun.com/)
2. 进入 **云解析 DNS** 服务
3. 找到 `usedfarmmach.cn` 域名
4. 点击 **解析设置** → **添加记录**
5. 填写以下信息：
   - **记录类型**：`A`
   - **主机记录**：`@`（表示主域名）
   - **记录值**：`76.76.21.21`
   - **TTL**：`600`（10分钟）或保持默认
6. 点击 **确认** 保存

### 选项 B：修改 Nameservers（将域名完全交给 Vercel 管理）

1. 登录阿里云控制台
2. 进入 **云解析 DNS** 服务
3. 找到 `usedfarmmach.cn` 域名
4. 点击 **DNS 修改** → **修改 DNS 服务器**
5. 将当前 DNS 服务器改为：
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
6. 保存更改（生效可能需要 24-48 小时）

## 验证配置

配置完成后，Vercel 会自动检测并颁发 SSL 证书。您可以通过以下方式验证：

1. **等待证书颁发**：Vercel 会在 DNS 配置正确后自动申请并安装 SSL 证书，通常需要 5-10 分钟
2. **测试访问**：访问 https://usedfarmmach.cn
3. **检查状态**：运行 `vercel domains verify usedfarmmach.cn` 或查看 Vercel Dashboard

## DNS 生效时间

- **A 记录更新**：通常 1-10 分钟生效
- **Nameservers 更改**：可能需要 24-48 小时完全生效

## 当前 Nameservers 对比

| 项目 | 当前 Nameservers (阿里云) | Vercel 要求 Nameservers |
|------|---------------------------|--------------------------|
| 服务器1 | `dns15.hichina.com` | `ns1.vercel-dns.com` |
| 服务器2 | `dns16.hichina.com` | `ns2.vercel-dns.com` |

## 注意事项

1. **不要同时配置 A 记录和修改 Nameservers**：选择一种方式即可
2. **SSL 证书自动颁发**：DNS 配置正确后，Vercel 会自动处理 HTTPS
3. **不影响 usedfarmmach.com**：`.cn` 域名独立于 `.com` 网站，互不影响
4. **免费版限制**：Vercel 免费版可能有访问频率限制，如果 Dashboard 打不开可稍后再试

## 后续步骤

1. **完成 DNS 配置**（按上述选项操作）
2. **等待 DNS 生效**（可用 `ping usedfarmmach.cn` 测试）
3. **访问网站**：https://usedfarmmach.cn
4. **验证功能**：确认导航、封面图等更新已生效

## 故障排除

- **DNS 未生效**：使用 `nslookup usedfarmmach.cn` 或 `dig usedfarmmach.cn` 检查解析
- **SSL 证书问题**：等待 10-15 分钟后再试，Vercel 会自动重试
- **网站内容未更新**：确保最新代码已部署到 Vercel（可通过 GitHub Actions 自动部署）

---

**配置完成后，网站将可通过 https://usedfarmmach.cn 访问，完全独立于 https://usedfarmmach.com。**