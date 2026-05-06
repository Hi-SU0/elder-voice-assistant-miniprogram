Component({
  properties: {
    showTipProps: {
      type: Boolean,
      value: false,
      observer(value) {
        this.setData({ showTip: value });
      }
    },
    title: {
      type: String,
      value: ''
    },
    content: {
      type: String,
      value: ''
    }
  },

  data: {
    showTip: false
  },

  lifetimes: {
    attached() {
      this.setData({ showTip: this.properties.showTipProps });
    }
  },

  methods: {
    onClose() {
      this.setData({ showTip: false });
      this.triggerEvent('close');
    }
  }
});
