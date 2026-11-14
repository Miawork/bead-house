# 部署接口 / Deployment

## 正式环境

- Railway 正式网址：https://bead-house-production.up.railway.app
- Railway 项目：`bead-house`
- 运行区域：新加坡 `asia-southeast1-eqsg3a`
- 持久化磁盘：`bead-house-progress`，挂载到 `/data`
- Vercel 备站：https://bead-house-stage2-1-preview.vercel.app

Railway 是当前主站：一个 Node 服务同时提供网页、同源 `/api/ws` WebSocket 和 `/api/room` 存档接口。所有拼豆板、心愿墙作品、桌上饮料和玩家个人进度会原子写入 `/data/bead-house-state.json`，重新部署或重启后仍会恢复。

首次启动会从 Vercel 备站导入公共房间；旧玩家使用原浏览器进入时，会按匿名玩家 ID 自动补导个人存档。Vercel 备站及其 Blob 数据不会被删除。

## 本地运行与检查

```bash
npm install
npm run check
npm test
npm start
```

打开 `http://localhost:8787`。`npm test` 会验证静态页面、HTTP 存档、服务重启恢复和双客户端 WebSocket 转发。

## Railway 架构和重新部署

`.railway/railway.ts` 是当前 Railway Infrastructure as Code 声明，固定了新加坡单实例、健康检查、环境变量和持久化磁盘。普通代码更新直接执行：

```bash
railway up --detach
```

架构更新先预览再应用：

```bash
railway config plan
railway config apply
```

部署后检查：

```bash
railway deployment list
railway logs --lines 100
railway domain list
```

健康检查地址为 `/healthz`。可在请求中加入 `X-Railway-Debug: 1`，用响应头 `X-Railway-Upstream-Zone` 核对实际运行区域。

## GitHub 自动部署

Railway 服务连接 GitHub 仓库的 `main` 分支后，每次 push 会自动构建和发布：

```bash
railway service source connect --repo Miawork/bead-house --branch main --service bead-house
```

Railway GitHub App 必须能访问该仓库。仓库保持私有时只有获授权的账号可以复用；如果以后要发布公共“一键部署”模板，需要先明确同意公开源码，再在 Railway 的 Template 页面发布项目模板。

## Vercel 备站

Vercel 项目 `bead-house-stage2-1-preview` 仍可独立运行，使用同源 Functions、Runtime Cache 和私有 Blob。它需要名为 `bead-house-progress` 的私有 Blob Store 和 `BLOB_READ_WRITE_TOKEN`。不要删除该项目或 Blob；它同时是 Railway 自动迁移旧存档的数据源。

玩家身份目前是保存在浏览器里的匿名云端 ID；清除网站数据或换浏览器会产生新 ID。上传的参考图片只保存在本机，不会进入公共房间。
