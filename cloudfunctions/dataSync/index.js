const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: '无法获取用户标识' };

  const col = db.collection('user_data');
  const { action } = event;

  try {
    switch (action) {
      case 'upload': {
        const { foods, exercises } = event;
        const now = Date.now();
        const existing = await col.where({ _openid: OPENID }).limit(1).get();

        if (existing.data && existing.data.length > 0) {
          await col.doc(existing.data[0]._id).update({
            data: { foods, exercises, updatedAt: now }
          });
        } else {
          await col.add({
            data: { _openid: OPENID, foods: foods || {}, exercises: exercises || {}, updatedAt: now }
          });
        }
        return { success: true, updatedAt: now };
      }

      case 'download': {
        const res = await col.where({ _openid: OPENID }).limit(1).get();
        if (res.data && res.data.length > 0) {
          const d = res.data[0];
          return { success: true, data: { foods: d.foods || {}, exercises: d.exercises || {}, updatedAt: d.updatedAt || 0 } };
        }
        return { success: true, data: null };
      }

      default:
        return { success: false, error: '未知操作: ' + action };
    }
  } catch (e) {
    return { success: false, error: e.message || '同步服务异常' };
  }
};
