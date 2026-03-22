var store = require('./utils/store');

App({
  globalData: {},
  onLaunch: function() {
    if (wx.cloud) {
      wx.cloud.init({ env: 'cloud1-5gnlocol78e0ddcc', traceUser: true });
      store.syncFromCloud();
    }
  }
});
