# AGENTS.md - 大哥弟旅游规划

## 项目概述
海南3D旅游AI直播助手，用于抖音直播伴侣窗口捕获。
主播通过该网页展示高德卫星3D地图、介绍景点、AI规划路线、动态演示旅行过程。

## 技术栈
- HTML5 + CSS3 + JavaScript（纯前端 + Express后端）
- MapLibre GL + 高德卫星瓦片（GCJ02坐标修正）
- DeepSeek API（通过后端代理）
- 数据存储：服务器端JSON + localStorage + IndexedDB

## 项目结构
```
D:\codex\lvyouxiangmu\
├── index.html          # 主页面
├── server.js           # Express后端（API代理+文件上传+数据持久化）
├── package.json        # Node依赖（express, multer, cors）
├── Procfile            # Railway部署配置
├── railway.json        # Railway构建配置
├── 一键更新.ps1        # 本地一键更新脚本
├── css/style.css       # 样式
├── js/
│   ├── api.js          # API适配器（自动切换本地/云端+故障回退）
│   ├── data.js         # 63个景点数据（内嵌JS）
│   ├── map.js          # 地图核心（高德瓦片+GCJ02+景点标记+圈画+画笔）
│   ├── camera.js       # 镜头控制（flyTo动画）
│   ├── content.js      # 景点卡片展示
│   ├── ai.js           # DeepSeek AI问答
│   ├── planner.js      # AI路线规划+历史管理
│   ├── routeAnimation.js # 路线动画（小汽车+镜头跟随）
│   ├── knowledge.js    # 知识库（问答+路线记录）
│   └── media.js        # 标注功能（图片/视频上传+4种标签图标+IndexedDB持久化+导出/导入）
├── data/               # JSON数据（备用）
├── assets/images/      # 图片资源（touxiang1.png为logo）
└── server_data/        # 服务器端数据存储（自动创建）
```

## 关键配置

### DeepSeek API
- 密钥：（已配置在环境变量DEEPSEEK_API_KEY中）
- 模型：deepseek-chat
- 端点：https://api.deepseek.com/v1/chat/completions
- 环境变量：DEEPSEEK_API_KEY（Railway上已配置）

### 地图
- 类型：高德卫星图+路网叠加
- 坐标系统：WGS84→GCJ02自动转换
- 中心点：海南 [109.7, 19.0]，zoom 8.5

## 部署信息
- **线上地址**：https://hainan-travel-production.up.railway.app
- **GitHub仓库**：https://github.com/chaoxia87/hainan-travel
- **平台**：Railway（自动从GitHub部署）
- **Token**：（已配置在本地Git凭证中）

## 更新流程
1. 修改本地代码
2. git add -A && git commit -m "描述" && git push origin main
3. Railway自动部署（2-3分钟生效）
4. 本地也可运行 一键更新.ps1 拉取最新代码

## Git配置
- 远程：https://chaoxia87:（已配置在本地Git凭证中）@github.com/chaoxia87/hainan-travel.git

## 安全配置
- DeepSeek API密钥：仅在server.js服务器端，前端不可见
- 访问密码：zy666888（输入一次，sessionStorage保存）
- /api/deepseek 需密码验证，无密码返回401
- 密码验证端点：/api/verify-password

## 核心功能
1. 高德3D卫星地图 + 63个海南景点标记
2. AI问答（DeepSeek，支持住宿/美食/交通/天气/亲子等）
3. AI路线规划（DeepSeek生成多日行程+预算）
4. 路线动画演示（卡通敞篷车沿路线移动+镜头跟随）
5. 圈画功能（多点标注+逐点消除+颜色选择）
6. 画笔功能（自由绘制+撤销+清空+颜色选择）
7. AI访问密码保护（隐藏输入+会话记忆）
8. 媒体标注（图片/视频上传+4种图标标签📷景点/🍜餐饮/🏨住宿/🏊游玩+编辑切换+导出/导入含标签属性）
8. 知识库（问答记录+路线历史+全部记录查看）
9. 城市快捷导航（三亚/万宁/海口/全景等）
10. 避坑模式（景点避坑提示）

## 备份版本
- D:\codex\lvyouxiangmu_backup_V2.0 （早期稳定版）
- D:\codex\lvyouxiangmu_backup_V2.2 （中期版本）
- D:\codex\lvyouxiangmu_backup_V2.0 （早期稳定版）
- D:\codex\lvyouxiangmu_backup_V2.2 （中期版本）
- D:\codex\lvyouxiangmu_backup_V2.5 （云端部署版）
- D:\codex\lvyouxiangmu_backup_V2.8 （多图标标签版 ★当前）

## 注意事项
- 批量编辑js文件使用Node.js脚本（PowerShell中文路径转义问题）
- Node路径：C:\Users\ck\AppData\Local\OpenAI\Codex\runtimes\cua_node\1b23c930bdf84ed6\bin\node.exe
- Git路径：C:\Program Files\Git\bin\git.exe
- 不要在代码中使用emoji作为变量名
- 地图ID为cesiumContainer（历史遗留命名，实际用MapLibre）
- 景点坐标数据全部在js/data.js中
