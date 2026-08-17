# Cloudflare Pages 部署配置

## 自动部署步骤

1. 访问 https://dash.cloudflare.com/pages
2. 点击 "Create a project"
3. 选择 "Connect to Git"
4. 选择仓库 `kaojing-monitor`
5. 配置构建设置：

### 构建配置
- **Framework preset**: `Next.js`
- **Build command**: `npm run build`
- **Build output directory**: `.next`
- **Root directory**: `frontend`

### 环境变量
添加以下环境变量：

| 变量名 | 值 |
|--------|-----|
| `NEXT_PUBLIC_API_BASE_URL` | `https://kaojing-api.dangwei121105.workers.dev` |
| `NODE_VERSION` | `18` |

6. 点击 "Save and Deploy"

## 预期结果

- 部署时间: 约 2-3 分钟
- 访问地址: `https://kaojing-monitor.pages.dev`
- 自定义域名: 可在部署后配置

## 验证清单

部署完成后访问站点，检查：
- [ ] 首页能正常加载
- [ ] 公告列表显示正常（来自 API）
- [ ] 筛选功能正常工作
- [ ] 详情页能正常打开
- [ ] 响应式布局正常

## 故障排查

如果遇到问题：

### 1. 构建失败
- 检查 Build log
- 确认 Node 版本 ≥ 18
- 确认 Root directory 设置为 `frontend`

### 2. API 请求失败
- 检查环境变量 `NEXT_PUBLIC_API_BASE_URL`
- 测试 API: `curl https://kaojing-api.dangwei121105.workers.dev/api/announcements?limit=1`

### 3. 样式异常
- 检查 Build output directory 是否为 `.next`
- 清除 Cloudflare Pages 缓存并重新部署
