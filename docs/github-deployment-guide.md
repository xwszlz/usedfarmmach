# GitHub + Vercel 自动部署指南

## 概述
本指南将帮助您建立自动部署流水线，解决手动部署失败问题。一旦配置完成，每次推送到 `main` 分支都将自动触发 Vercel 生产部署。

---

## 第一步：创建 GitHub 仓库

### 方法A：通过 GitHub 网站
1. 访问 [GitHub.com](https://github.com) 并登录
2. 点击右上角 "+" → "New repository"
3. 填写仓库信息：
   - **Repository name**: `usedfarmmach` (或您喜欢的名称)
   - **Description**: 神雕农机跨境平台
   - **Visibility**: Public (推荐) 或 Private
   - **Initialize with README**: 不勾选 (我们已有代码)
4. 点击 "Create repository"

### 方法B：通过 GitHub CLI (如果已安装)
```bash
# 安装 GitHub CLI: https://cli.github.com/
gh auth login
gh repo create usedfarmmach --description "神雕农机跨境平台" --public --source=. --remote=origin --push
```

---

## 第二步：连接本地仓库到 GitHub

```bash
# 在项目根目录执行
cd "D:\神雕农机\usedfarmmach"

# 添加远程仓库（替换 YOUR_USERNAME 为您的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/usedfarmmach.git

# 推送代码到 GitHub
git push -u origin main
```

如果遇到认证问题，请使用个人访问令牌：
1. 访问 GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 生成新令牌，勾选 `repo` 权限
3. 使用令牌作为密码：
   ```
   git remote set-url origin https://YOUR_USERNAME:TOKEN@github.com/YOUR_USERNAME/usedfarmmach.git
   git push -u origin main
   ```

---

## 第三步：配置 Vercel Secrets

### 获取 Vercel 凭证
1. 访问 [Vercel Dashboard](https://vercel.com)
2. 点击右上角头像 → "Settings"
3. 左侧菜单选择 "Tokens"
4. 点击 "Create Token"：
   - **Token Name**: `GitHub Actions Deploy`
   - **Scope**: 选择 "All" 权限
   - 复制生成的令牌（仅显示一次）

### 获取项目 ID
1. 在 Vercel Dashboard 中进入 `usedfarmmach` 项目
2. 点击 "Settings" → "General"
3. 在 "Project ID" 部分复制 ID

### 获取组织 ID
1. 在 Vercel Dashboard 点击左上角组织名
2. 点击 "Settings" → "General"
3. 在 "Organization ID" 部分复制 ID

### 设置 GitHub Secrets
1. 访问 GitHub 仓库页面
2. 点击 "Settings" → "Secrets and variables" → "Actions"
3. 添加以下 secrets：
   - `VERCEL_TOKEN`: 粘贴 Vercel 令牌
   - `VERCEL_ORG_ID`: 粘贴组织 ID
   - `VERCEL_PROJECT_ID`: 粘贴项目 ID

---

## 第四步：触发首次部署

### 方法A：推送更改
```bash
# 提交所有更改
git add .
git commit -m "chore: add GitHub Actions workflow for auto-deployment"
git push origin main
```

### 方法B：手动触发 GitHub Actions
1. 访问 GitHub 仓库页面
2. 点击 "Actions" 标签页
3. 在左侧选择 "Deploy to Vercel" 工作流
4. 点击 "Run workflow" → 选择 main 分支

---

## 第五步：验证部署状态

### 检查工作流状态
- GitHub Actions 页面应显示绿色勾号 ✅
- 点击运行详情查看构建日志

### 验证生产网站
- 等待 2-3 分钟构建完成
- 访问 [https://usedfarmmach.vercel.app](https://usedfarmmach.vercel.app)
- 使用 Ctrl+F5 强制刷新验证封面图更新

---

## 故障排除

### 问题1：构建失败
- 检查 GitHub Actions 日志中的具体错误
- 常见问题：Node.js 版本不匹配、依赖缺失
- 解决方案：确保 `package.json` 中的依赖正确

### 问题2：Vercel 部署失败
- 确认 Vercel secrets 正确设置
- 检查 Vercel 项目是否已连接到 GitHub 仓库
- 在 Vercel Dashboard 中查看部署日志

### 问题3：封面图未更新
- 确认缓存破坏参数已添加到代码中
- 检查数据库 `sortOrder` 是否正确更新
- 验证 OSS 图片 URL 是否可访问

---

## 后续维护

### 自动部署优势
- ✅ 代码推送后自动构建部署
- ✅ 无需手动操作 Vercel Dashboard
- ✅ 构建过程透明，可追溯日志
- ✅ 支持回滚到任意提交

### 封面图优化扩展
使用相同的自动化流程，您可以：
1. 批量更新所有 53 个产品的封面图
2. 开发管理员界面进行可视化选择
3. 集成 AI 评分算法自动选择最佳封面

---

## 需要帮助？
如果遇到任何问题，请提供：
1. GitHub Actions 运行链接
2. 错误信息截图
3. 具体失败步骤

我们将协助您解决问题，确保自动部署成功运行。