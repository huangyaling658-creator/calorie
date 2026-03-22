function uploadImage(path, cb) {
  wx.compressImage({
    src: path, quality: 15,
    success: function(r) { doUpload(r.tempFilePath, cb); },
    fail: function() { doUpload(path, cb); }
  });
}

function doUpload(filePath, cb) {
  var cloudPath = 'tmp/img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.jpg';
  wx.cloud.uploadFile({
    cloudPath: cloudPath,
    filePath: filePath,
    success: function(res) { cb(null, res.fileID); },
    fail: function() { cb('图片上传失败'); }
  });
}

function callCloud(action, data, cb) {
  var maxRetry = 1;
  function attempt(n) {
    wx.cloud.callFunction({
      name: 'aiProxy',
      data: Object.assign({ action: action }, data),
      success: function(res) {
        var r = res.result;
        if (r && r.success) cb(null, r.data);
        else cb((r && r.error) || '识别失败，请重试');
      },
      fail: function(err) {
        var msg = (err && err.errMsg) || '';
        if (n < maxRetry) {
          setTimeout(function() { attempt(n + 1); }, 800);
          return;
        }
        if (msg.indexOf('timeout') !== -1 || msg.indexOf('Timeout') !== -1) {
          cb('请求超时，请重试');
        } else {
          cb('云函数调用失败，请重新部署aiProxy后重试');
        }
      }
    });
  }
  attempt(0);
}

function cleanFile(fileID) {
  if (fileID) wx.cloud.deleteFile({ fileList: [fileID] });
}

module.exports = {
  recognizeFood: function(path, cb) {
    uploadImage(path, function(err, fileID) {
      if (err) { cb(err); return; }
      callCloud('recognizeFood', { fileID: fileID }, function(err2, data) {
        cleanFile(fileID);
        cb(err2, data);
      });
    });
  },
  analyzeFoodsMulti: function(text, cb) {
    callCloud('analyzeFoodsMulti', { text: text }, cb);
  },
  recognizeExercise: function(path, cb) {
    uploadImage(path, function(err, fileID) {
      if (err) { cb(err); return; }
      callCloud('recognizeExercise', { fileID: fileID }, function(err2, data) {
        cleanFile(fileID);
        cb(err2, data);
      });
    });
  },
  analyzeExerciseByText: function(text, cb) {
    callCloud('analyzeExerciseByText', { text: text }, cb);
  }
};
