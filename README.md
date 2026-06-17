# 轻卡路里

> 一个记录吃喝和运动、帮你看清每天热量收支的微信小程序。

## 这是什么

微信小程序「轻卡路里」：记录每天吃了什么、动了多少，AI 帮你估算食物热量，直观看到每天的「摄入 - 消耗」能量平衡。界面走暖色温柔风（`#FF8A00` 主色、`#FFFBF5` 米白底）。

## 功能

- 🍽️ **吃** —— 记录饮食，AI 估算食物热量
- 🏃 **运动** —— 记录运动消耗
- ⚡ **能量** —— 每日热量收支总览
- 🔍 **食物详情** —— 单项食物的营养明细
- 👤 **我的** —— 个人设置与目标

## 技术栈

- **前端**：微信小程序原生（WXML / WXSS / JS），自定义 tabBar
- **后端**：微信云开发云函数
  - `aiProxy` —— AI 能力代理（食物识别 / 热量估算）
  - `dataSync` —— 数据同步

## 运行

1. 微信开发者工具导入本项目
2. 开通并配置「云开发」环境
3. 上传部署 `cloudfunctions/` 下的云函数
4. 编译预览

## 目录结构

```
calorie/
├── miniprogram/
│   ├── pages/        ← eat / exercise / energy / profile / food-detail
│   ├── custom-tab-bar/
│   └── app.json
└── cloudfunctions/
    ├── aiProxy/
    └── dataSync/
```

---

由 [Santa](https://github.com/huangyaling658-creator) 一个人 + AI 打造。
