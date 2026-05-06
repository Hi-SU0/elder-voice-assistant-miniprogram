const recorderManager = wx.getRecorderManager();
const fs = wx.getFileSystemManager(); // 引入微信文件系统管理器
const innerAudioContext = wx.createInnerAudioContext();

Page({
  data: {
    msgList: [
      { role: 'ai', content: '叔叔阿姨您好，我是您的专属健康顾问，今天身体感觉怎么样呀？（按住底部按钮说话）' }
    ],
    isRecording: false,
    isVoiceOn: true,
    dialectArray: ['普通话', '方言（陕甘宁）'],
    dialectIndex: 0
  },

  onLoad() {
    wx.setInnerAudioOption({ obeyMuteSwitch: false });
    wx.cloud.init({ env: 'cloud1-6ggbe1wr5819344f', traceUser: true });

    recorderManager.onStop((res) => {
      const tempFilePath = res.tempFilePath;
      const newMsg = { role: 'user', content: '[语音发送中...]' };
      this.setData({ msgList: [...this.data.msgList, newMsg] });

      // 读取你的录音，发给云端
      fs.readFile({
        filePath: tempFilePath,
        encoding: 'base64',
        success: (readRes) => { this.callAI(readRes.data); },
        fail: () => { wx.showToast({ title: '录音读取失败', icon: 'none' }); }
      });
    });
  },

  // 方言切换
  bindDialectChange(e) {
    this.setData({ dialectIndex: e.detail.value });
    wx.showToast({ title: `已切换为${this.data.dialectArray[e.detail.value]}`, icon: 'none' });
  },

  toggleVoice() {
    const next = !this.data.isVoiceOn;
    this.setData({ isVoiceOn: next });
    if (!next) innerAudioContext.stop();
  },

  startRecord() {
    this.setData({ isRecording: true });
    innerAudioContext.stop();
    recorderManager.start({ duration: 10000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000, format: 'PCM' });
  },

  stopRecord() {
    this.setData({ isRecording: false });
    recorderManager.stop();
  },

  callAI(audioBase64) {
    wx.showLoading({ title: 'AI思考中...' });
    const currentDialect = this.data.dialectArray[this.data.dialectIndex];

    wx.cloud.callFunction({
      name: 'chatAI',
      data: { audioBase64, dialect: currentDialect }, // 把选择的方言发给云端
      success: (res) => {
        wx.hideLoading();
        const result = res.result || {};
        const asrText = (result.asrText || '').trim();
        const aiReply = (result.aiReply || '').trim();

        // 🔴 关键点1：这里接收云端传回来的 Base64 音频代码
        const ttsBase64 = result.ttsBase64;

        const msgs = [...this.data.msgList];
        if (msgs.length > 0 && msgs[msgs.length - 1].role === 'user') {
          msgs[msgs.length - 1].content = `我：${asrText || '（未识别到声音）'}`;
        }
        if (aiReply) {
          msgs.push({ role: 'ai', content: aiReply });
          this.setData({ msgList: msgs });

          // 🔴 关键点2：把这段音频代码传给 playTTS 方法
          this.playTTS(ttsBase64);
        }
      },
      fail: (err) => { wx.hideLoading(); }
    });
  },

  // 🔴 关键点3：彻底修改播放逻辑
    // 🔴 终极稳定版播放逻辑
    playTTS(audioBase64) {
      if (!this.data.isVoiceOn || !audioBase64) return;

      const filePath = `${wx.env.USER_DATA_PATH}/tts_${Date.now()}.mp3`;

      fs.writeFile({
        filePath: filePath,
        data: audioBase64,
        encoding: 'base64',
        success: () => {
          // 每次播放都创建一个全新的播放器，防止之前的卡死
          const audioCtx = wx.createInnerAudioContext();
          audioCtx.src = filePath;

          // 监听：只要文件准备好了，立刻播放！不用傻等 setTimeout 了
          audioCtx.onCanplay(() => {
            audioCtx.play();
          });

          // 监听：万一播放失败，告诉我们到底是什么原因
          audioCtx.onError((err) => {
            console.error("微信播放器报错了：", err);
            wx.showToast({ title: '播放器开小差了', icon: 'none' });
          });

          // 播放结束自动销毁，释放手机内存
          audioCtx.onEnded(() => {
            audioCtx.destroy();
          });
        },
        fail: (err) => {
          console.error("音频写入手机失败", err);
        }
      });
    }
  });