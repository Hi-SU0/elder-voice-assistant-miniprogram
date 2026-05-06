// 云函数入口文件：chatAI/index.js
const cloud = require('wx-server-sdk');
const crypto = require('crypto-js');
const WebSocket = require('ws');
const axios = require('axios');

cloud.init({ env: 'cloud1-6ggbe1wr5819344f' });
const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

// 🔴 密钥区域
const XF_APPID = requiredEnv('XF_APPID');
const XF_API_SECRET = requiredEnv('XF_API_SECRET');
const XF_API_KEY = requiredEnv('XF_API_KEY');
const DEEPSEEK_API_KEY = requiredEnv('DEEPSEEK_API_KEY');

exports.main = async (event, context) => {
  const audioBase64 = event.audioBase64;
  const dialect = event.dialect || '普通话';

  if (!audioBase64) return { error: "没有收到语音数据！" };

  try {
    // 1. 语音识别 (ASR) —— 🌟 修改点1：把 dialect 传进去让它“换耳朵”
    const asrText = await getIatResult(audioBase64, dialect);
    if (!asrText || asrText.length === 0) {
      return { asrText: "（没有听清）", aiReply: "刚才没听清，您能再大点声吗？" };
    }

    // 2. 调用 DeepSeek 生成回复 (贴心小棉袄人设)
    const aiReply = await getDeepSeekReply(asrText);

    // 3. 语音合成 (TTS)
    let vcn = 'x4_yezi'; // 默认普通话（讯飞小露）
    if (dialect.includes('方言')) {
      vcn = 'x2_xiaoying'; // 切换为陕西方言（讯飞小莹 V2.0版）
    }

    const ttsBase64 = await getXunfeiTTS(aiReply, vcn);

    return { asrText, aiReply, ttsBase64 };

  } catch (error) {
    return { error: error.message };
  }
};

// ======================= 以下是底层封装函数 =======================

// 封装1：调用 DeepSeek API (贴心小棉袄人设)
async function getDeepSeekReply(text) {
  const prompt = "你是一个贴心、懂事的晚辈。老人家和你聊天时，你要像自家人一样陪他们唠家常，多倾听、多夸奖、多顺着他们的话说。说话要极度口语化，不要说教，多用'您'、'哎呀'、'呢'等语气词，哄老人开心。每次回复控制在40字左右，通俗易懂。";

  const response = await axios.post('https://api.deepseek.com/chat/completions', {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: text }
    ]
  }, {
    headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` }
  });
  return response.data.choices[0].message.content;
}

// 封装2：调用科大讯飞语音听写 (ASR) —— 🌟 修改点2：增加方言判断逻辑
function getIatResult(audioBase64, dialect) {
  return new Promise((resolve, reject) => {
    const host = "iat-api.xfyun.cn";
    const date = new Date().toUTCString();
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
    const signatureSha = crypto.HmacSHA256(signatureOrigin, XF_API_SECRET);
    const signature = crypto.enc.Base64.stringify(signatureSha);
    const authorizationOrigin = `api_key="${XF_API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authStr = crypto.enc.Base64.stringify(crypto.enc.Utf8.parse(authorizationOrigin));
    const url = `wss://${host}/v2/iat?authorization=${authStr}&date=${encodeURIComponent(date)}&host=${host}`;

    const ws = new WebSocket(url);
    let fullText = "";

    // 🌟 核心修改区：动态决定用什么方言模型听
    let accentCode = "mandarin"; // 默认用强大的普通话模型（涵盖大多数北方方言口音）

    // 如果以后你想扩充选项，这里已经为你预留好了其他方言的匹配接口
    if (dialect.includes('四川') || dialect.includes('重庆') || dialect.includes('西南')) {
      accentCode = "lmz";
    } else if (dialect.includes('河南')) {
      accentCode = "henanese";
    } else if (dialect.includes('粤语') || dialect.includes('广东')) {
      accentCode = "cantonese";
    }
    // 💡 注：科大讯飞听写 API 暂时没有专门的“陕西方言”标识，遇到陕甘宁口音，它依然会使用包容性最强的 mandarin（普通话）模型去纠错识别。

    ws.on('open', () => {
      ws.send(JSON.stringify({
        common: { app_id: XF_APPID },
        // 这里把 accent: "mandarin" 换成了动态的 accentCode
        business: { language: "zh_cn", domain: "iat", accent: accentCode, vad_eos: 5000 },
        data: { status: 0, format: "audio/L16;rate=16000", encoding: "raw", audio: audioBase64 }
      }));
      ws.send(JSON.stringify({
        data: { status: 2, format: "audio/L16;rate=16000", encoding: "raw", audio: "" }
      }));
    });

    ws.on('message', (data) => {
      const res = JSON.parse(data);
      if (res.code !== 0) { reject(new Error("讯飞识别报错：" + res.message)); ws.close(); return; }
      if (res.data && res.data.result && res.data.result.ws) {
        res.data.result.ws.forEach(item => { item.cw.forEach(w => { fullText += w.w; }); });
      }
      if (res.data.status === 2) { resolve(fullText); ws.close(); }
    });
    ws.on('error', (err) => reject(err));
  });
}

// 封装3：调用科大讯飞语音合成 (TTS)
function getXunfeiTTS(text, vcn) {
  return new Promise((resolve, reject) => {
    const host = "tts-api.xfyun.cn";
    const date = new Date().toUTCString();
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
    const signatureSha = crypto.HmacSHA256(signatureOrigin, XF_API_SECRET);
    const signature = crypto.enc.Base64.stringify(signatureSha);
    const authorizationOrigin = `api_key="${XF_API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authStr = crypto.enc.Base64.stringify(crypto.enc.Utf8.parse(authorizationOrigin));
    const url = `wss://${host}/v2/tts?authorization=${authStr}&date=${encodeURIComponent(date)}&host=${host}`;

    const ws = new WebSocket(url);
    let audioChunks = [];

    ws.on('open', () => {
      ws.send(JSON.stringify({
        common: { app_id: XF_APPID },
        business: { aue: "lame", sfl: 1, vcn: vcn, speed: 40, volume: 60, pitch: 50, tte: "UTF8" },
        data: { status: 2, text: Buffer.from(text).toString('base64') }
      }));
    });

    ws.on('message', (data) => {
      const res = JSON.parse(data);
      if (res.code !== 0) { reject(new Error("讯飞合成报错：" + res.message)); ws.close(); return; }
      if (res.data && res.data.audio) { audioChunks.push(Buffer.from(res.data.audio, 'base64')); }
      if (res.data && res.data.status === 2) {
        const finalBuffer = Buffer.concat(audioChunks);
        resolve(finalBuffer.toString('base64'));
        ws.close();
      }
    });
    ws.on('error', (err) => reject(err));
  });
}
