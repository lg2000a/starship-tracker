# Starship Watch 🚀

发射追踪网页，纯静态前端，零后端零数据库。

## 功能

- 下次发射倒计时（毫秒级精度）
- 发射状态 / 概率 / 发射台信息
- 近期10次发射计划列表
- 外链跳转：NextSpaceflight、SpaceFlightNow、SpaceX YouTube
- 数据双源：Launch Library 2（主）+ SpaceX Data API（备用）
- 每60秒自动刷新

## 数据来源

| API | 用途 | 限制 |
|-----|------|------|
| [Launch Library 2](https://ll.thespacedevs.com/2.3.0/) | 主数据源，所有发射 | 15 req/小时（免费） |
| [SpaceX Data API](https://api.spacexdata.com/v5/) | SpaceX 专属备用 | 无限制 |

## 部署到 Vercel（推荐）

### 方法一：GitHub 自动部署

1. 把这个文件夹推到 GitHub：
   ```bash
   git init
   git add .
   git commit -m "init: starship tracker"
   git remote add origin https://github.com/你的用户名/starship-tracker.git
   git push -u origin main
   ```

2. 登录 [vercel.com](https://vercel.com)，点击 **New Project**

3. 导入你的 GitHub 仓库，Framework 选 **Other**，直接点 Deploy

4. 部署完成后得到 `xxx.vercel.app` 地址

### 方法二：Vercel CLI 一键部署

```bash
npm i -g vercel
vercel --prod
```

## 自定义域名（可选，先挂起）

在 Vercel 项目设置 → Domains，添加你的域名后按提示配置 DNS 即可。

## 本地预览

```bash
# 任意静态服务器均可
npx serve .
# 或
python3 -m http.server 3000
```

## 文件结构

```
starship-tracker/
├── index.html    # 主页面
├── style.css     # 样式（深空工业风）
├── app.js        # 数据抓取 + 倒计时逻辑
├── vercel.json   # Vercel 部署配置
└── README.md
```
