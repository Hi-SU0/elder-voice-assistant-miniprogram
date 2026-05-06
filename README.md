# 适老知音 — 老年人语音 AI 健康顾问小程序

一款专为老年人设计的微信小程序，用户只需**按住说话**，即可与 AI 健康顾问进行语音对话。全链路语音交互（ASR → LLM → TTS），支持普通话与陕甘宁方言，界面大字体、大按钮，充分考虑适老化体验。

---

## 功能特性

- 🎤 **一键语音输入** — 按住底部胶囊按钮录音，松手自动发送
- 🧠 **AI 智能回复** — 接入 DeepSeek 大模型，以"贴心晚辈"人设与老人唠家常
- 🔊 **语音播报回复** — 通过科大讯飞 TTS 将 AI 回复转成语音播放，支持静音开关
- 🗣️ **方言支持** — 支持普通话与陕甘宁方言切换识别，TTS 发音随之切换
- 👴 **适老化设计** — 超大字号（20px+）、大圆角气泡、高对比色、暖米底色

---

## 技术架构

```
微信小程序前端
    │
    │  wx.cloud.callFunction
    ▼
云函数 chatAI（Node.js）
    ├── 科大讯飞 ASR（WebSocket）── 语音 → 文字
    ├── DeepSeek Chat API（HTTP） ── 文字 → AI 回复
    └── 科大讯飞 TTS（WebSocket）── AI 回复 → 语音（Base64 MP3）
```

| 层级 | 技术 |
|------|------|
| 前端框架 | 微信小程序（WXML / WXSS / JS） |
| 云开发 | 微信云开发（CloudBase） |
| 语音识别 | 科大讯飞 IAT WebSocket API |
| 大语言模型 | DeepSeek Chat（deepseek-chat） |
| 语音合成 | 科大讯飞 TTS WebSocket API |
| 云函数依赖 | `wx-server-sdk`、`axios`、`ws`、`crypto-js` |

---

## 目录结构

```
├── miniprogram/
│   ├── app.js                  # 小程序入口，初始化云开发环境
│   ├── app.json                # 全局配置（页面路由、导航栏）
│   ├── pages/
│   │   ├── index/              # 主聊天页（核心交互页面）
│   │   └── example/            # 云开发功能示例页
│   └── components/
│       └── cloudTipModal/      # 云环境提示弹窗组件
├── cloudfunctions/
│   ├── chatAI/                 # 核心云函数：ASR + LLM + TTS 链路
│   └── quickstartFunctions/    # 云开发基础功能示例云函数
├── .env.example                # 环境变量示例文件
└── project.config.json         # 微信开发者工具项目配置
```

---

## 快速开始

### 前置条件

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 已开通**微信云开发**环境
- 已注册**科大讯飞**开放平台账号，获取 `APPID`、`API Key`、`API Secret`
- 已注册 **DeepSeek** 开放平台账号，获取 `API Key`

### 1. 克隆项目

```bash
git clone https://github.com/Hi-SU0/elder-voice-assistant-miniprogram.git
```

### 2. 配置云开发环境 ID

在 `miniprogram/app.js` 和 `miniprogram/pages/index/index.js` 中，将 `env` 字段替换为你自己的云开发环境 ID：

```js
wx.cloud.init({
  env: '你的云开发环境ID',
  traceUser: true,
});
```

### 3. 配置云函数环境变量

参考 `.env.example`，在**微信云开发控制台 → 云函数 → chatAI → 函数配置 → 环境变量**中添加以下四个变量：

| 变量名 | 说明 |
|--------|------|
| `XF_APPID` | 科大讯飞应用 ID |
| `XF_API_KEY` | 科大讯飞 API Key |
| `XF_API_SECRET` | 科大讯飞 API Secret |
| `DEEPSEEK_API_KEY` | DeepSeek API Key |

> ⚠️ 请勿将真实密钥提交到代码仓库，所有密钥均通过云函数环境变量注入。

### 4. 部署云函数

在微信开发者工具中，右键点击 `cloudfunctions/chatAI` 目录，选择**「上传并部署 - 云端安装依赖」**。

`quickstartFunctions` 同理（如需使用示例功能）。

### 5. 导入并运行

用微信开发者工具导入项目根目录，选择对应的 AppID，点击**编译**即可在模拟器或真机预览。

---

## 使用说明

1. 打开小程序，AI 顾问会主动打招呼
2. 顶部下拉框可切换**普通话 / 方言（陕甘宁）**识别模式
3. 点击右上角 🔊 可切换**语音播报开关**
4. **按住底部按钮说话**，松手后自动识别并获取 AI 回复
5. AI 回复会以文字气泡和语音双通道呈现

---

## 参考文档

- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [科大讯飞开放平台 - 语音听写](https://www.xfyun.cn/doc/asr/voicedictation/API.html)
- [科大讯飞开放平台 - 语音合成](https://www.xfyun.cn/doc/tts/online_tts/API.html)
- [DeepSeek API 文档](https://platform.deepseek.com/api-docs/)
