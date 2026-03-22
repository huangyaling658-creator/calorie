var store = require('../../utils/store');

function buildSummary(intake, n, foodNames, exBurn) {
  if (intake === 0) return '今天还没有记录饮食哦，快去"吃了啥"页面记录吧~';

  var parts = [];
  var p = n.p, c = n.c, f = n.f, total = p + f + c;

  // 热量总评
  if (intake < 800) parts.push('🔸 今天总摄入仅 ' + intake + ' kcal，远低于基础代谢需求（约1200kcal）。长期热量过低会让身体进入"节能模式"，基础代谢下降、肌肉流失，反而不利于减脂。建议适当增加优质蛋白和碳水的摄入。');
  else if (intake < 1200) parts.push('🔸 今天摄入 ' + intake + ' kcal，处于低热量区间。适度的热量缺口有助于减脂，但要确保营养素摄入充足，避免长期低于基础代谢导致代谢适应。');
  else if (intake < 1800) parts.push('✅ 今天摄入 ' + intake + ' kcal，处于健康减脂区间。这个热量水平既能维持基础代谢，又能产生适度的热量缺口，非常理想。');
  else if (intake < 2200) parts.push('📊 今天摄入 ' + intake + ' kcal，适合中等活动量人群的日常需求。如果目标是减脂，可以考虑减少100-200kcal或增加运动量。');
  else parts.push('⚠️ 今天已摄入 ' + intake + ' kcal，超出一般人日均需求。建议晚餐以清淡蔬菜为主，避免高油高糖食物，或通过运动弥补多余热量。');

  // 营养素分析
  if (total > 0) {
    var pR = Math.round(p / total * 100), cR = Math.round(c / total * 100), fR = Math.round(f / total * 100);
    parts.push('\n\n📊 三大营养素比例 — 蛋白质 ' + pR + '% / 碳水 ' + cR + '% / 脂肪 ' + fR + '%');
    
    // 蛋白质评价
    if (pR >= 25) parts.push('\n• 蛋白质：占比优秀（' + pR + '%），有利于肌肉合成和修复，饱腹感强，能有效抑制食欲。保持这个水平！');
    else if (pR >= 15) parts.push('\n• 蛋白质：占比适中（' + pR + '%），在推荐范围内。如果有增肌需求可适当增加至25-30%。');
    else parts.push('\n• 蛋白质：占比偏低（' + pR + '%），建议提高至15-25%。推荐增加鸡蛋、鸡胸肉、鱼虾、豆腐、希腊酸奶等优质蛋白来源，有助于维持肌肉量和提高代谢。');
    
    // 碳水评价
    if (cR > 65) parts.push('\n• 碳水：占比偏高（' + cR + '%），容易引起血糖波动和脂肪囤积。建议用粗粮（糙米、燕麦、红薯）替代精制碳水（白米饭、面条），并增加蛋白质和蔬菜比例。');
    else if (cR >= 40) parts.push('\n• 碳水：占比合理（' + cR + '%），在健康区间内。优先选择低GI碳水（全谷物、薯类），有助于稳定血糖和持续供能。');
    else parts.push('\n• 碳水：占比较低（' + cR + '%），虽然低碳饮食有助于减脂，但长期过低可能导致注意力下降、运动表现不佳。建议保持在40-55%的范围。');
    
    // 脂肪评价
    if (fR > 40) parts.push('\n• 脂肪：占比偏高（' + fR + '%），可能来自油炸食品、五花肉等高脂食物。建议选择不饱和脂肪（橄榄油、坚果、牛油果），减少饱和脂肪和反式脂肪摄入。');
    else if (fR >= 20) parts.push('\n• 脂肪：占比合理（' + fR + '%），脂肪是人体必需的营养素，有助于脂溶性维生素吸收和激素合成。');
    else parts.push('\n• 脂肪：占比偏低（' + fR + '%），适量的健康脂肪（坚果、深海鱼、牛油果）对营养吸收和激素分泌很重要，建议适当增加。');
  }

  // 食物多样性评价
  if (foodNames.length > 0) {
    parts.push('\n\n🍽️ 食物多样性评估');
    if (foodNames.length === 1) parts.push('\n今天只记录了1种食物（' + foodNames[0] + '），膳食多样性严重不足。《中国居民膳食指南》建议每天至少摄入12种食物，建议增加蔬菜、水果、蛋白质来源和全谷物。');
    else if (foodNames.length <= 3) parts.push('\n今天记录了' + foodNames.length + '种食物（' + foodNames.join('、') + '），种类偏少。建议目标：每餐包含主食+蛋白质+蔬菜的组合，额外补充水果和乳制品。');
    else if (foodNames.length <= 6) parts.push('\n今天记录了' + foodNames.length + '种食物，种类较为均衡。继续保持多样化的饮食习惯，尝试每周轮换不同的蛋白质来源和蔬菜种类。');
    else parts.push('\n今天记录了' + foodNames.length + '种食物，膳食多样性出色！丰富的食物种类有助于获取全面的营养素。继续保持这样的好习惯。');

    // 分析具体食物特征
    var hasVeg = false, hasFruit = false, hasMeat = false, hasGrain = false, hasJunkFood = false;
    var vegWords = ['菜','蔬','沙拉','西兰花','菠菜','生菜','白菜','芹菜','黄瓜','番茄','茄子','萝卜'];
    var fruitWords = ['苹果','香蕉','橙','葡萄','草莓','西瓜','梨','桃','芒果','蓝莓','猕猴桃','水果'];
    var meatWords = ['鸡','鱼','虾','肉','蛋','牛','猪','羊','鸭','豆腐','豆'];
    var grainWords = ['米饭','面条','面','馒头','面包','燕麦','粥','杂粮','红薯','土豆','玉米'];
    var junkWords = ['薯条','炸','可乐','汽水','奶茶','蛋糕','冰淇淋','巧克力','饼干','零食','糖','炸鸡'];
    for (var i = 0; i < foodNames.length; i++) {
      var fn = foodNames[i];
      for (var j = 0; j < vegWords.length; j++) if (fn.indexOf(vegWords[j]) !== -1) { hasVeg = true; break; }
      for (var j = 0; j < fruitWords.length; j++) if (fn.indexOf(fruitWords[j]) !== -1) { hasFruit = true; break; }
      for (var j = 0; j < meatWords.length; j++) if (fn.indexOf(meatWords[j]) !== -1) { hasMeat = true; break; }
      for (var j = 0; j < grainWords.length; j++) if (fn.indexOf(grainWords[j]) !== -1) { hasGrain = true; break; }
      for (var j = 0; j < junkWords.length; j++) if (fn.indexOf(junkWords[j]) !== -1) { hasJunkFood = true; break; }
    }
    var missing = [];
    if (!hasVeg) missing.push('蔬菜（建议每天300-500g）');
    if (!hasFruit) missing.push('水果（建议每天200-350g）');
    if (!hasMeat) missing.push('优质蛋白（鸡蛋/鸡肉/鱼虾/豆腐）');
    if (!hasGrain) missing.push('主食/全谷物');
    if (missing.length > 0) parts.push('\n⚠️ 今天似乎缺少：' + missing.join('、') + '。');
    if (hasJunkFood) parts.push('\n💡 检测到高糖高油食物，偶尔放纵无妨，建议下一餐选择清淡低卡的食物来平衡。');
  }

  // 运动与热量收支
  if (exBurn > 0) {
    var netCal = intake - exBurn;
    parts.push('\n\n🏃 运动与热量收支');
    parts.push('\n今日运动消耗 ' + exBurn + ' kcal，净摄入 ' + netCal + ' kcal。');
    if (netCal < 300) parts.push('净摄入很低，减脂效果显著，但注意不要长期低于800kcal净摄入，以免影响基础代谢和身体健康。');
    else if (netCal < 800) parts.push('热量缺口适中，这是健康减脂的理想状态。保持每天300-500kcal的热量缺口，每周可减去约0.5kg体脂。');
    else if (netCal < 1500) parts.push('热量收支基本平衡，适合维持体重。如果目标是减脂，可以增加运动或适当减少摄入。');
    else parts.push('净摄入偏高，建议增加运动量或减少高热量食物摄入，目标是让净摄入控制在1200-1800kcal之间。');
  } else if (intake > 0) {
    parts.push('\n\n🏃 运动提醒');
    parts.push('\n今天还没有运动记录。建议饭后30分钟进行20-30分钟的有氧运动（快走、慢跑），有助于消耗多余热量、促进消化、改善睡眠质量。');
  }

  return parts.join('');
}

function buildRecommend(intake, n, foodNames) {
  var recs = [];
  recs.push({ meal: '早餐', items: [] });
  recs.push({ meal: '午餐', items: [] });
  recs.push({ meal: '晚餐', items: [] });

  var p = n.p, c = n.c, f = n.f;

  if (p < 40) {
    recs[0].items.push({ name: '水煮蛋2个 + 全麦面包', cal: 280, reason: '快速补充优质蛋白和缓释碳水' });
    recs[1].items.push({ name: '鸡胸肉蔬菜沙拉', cal: 320, reason: '高蛋白低脂，搭配丰富维生素' });
  } else {
    recs[0].items.push({ name: '燕麦粥 + 坚果 + 蓝莓', cal: 280, reason: '低GI碳水+好脂肪+抗氧化' });
    recs[1].items.push({ name: '糙米饭 + 清蒸鱼', cal: 420, reason: '优质碳水+优质蛋白均衡搭配' });
  }

  if (f > 50) {
    recs[2].items.push({ name: '蔬菜豆腐汤 + 杂粮', cal: 250, reason: '清淡低脂，帮助消化' });
    recs[1].items.push({ name: '凉拌西兰花', cal: 50, reason: '高纤维低卡，促进肠道健康' });
  } else {
    recs[2].items.push({ name: '紫薯 + 清炒时蔬', cal: 220, reason: '低GI粗粮+高纤维蔬菜' });
  }

  if (c > 200) {
    recs[0].items.push({ name: '无糖希腊酸奶', cal: 120, reason: '高蛋白控糖，助肠道健康' });
  } else {
    recs[0].items.push({ name: '红薯 + 牛奶', cal: 230, reason: '优质碳水+钙质补充' });
  }

  var hasVeg = false, hasFruit = false;
  for (var i = 0; i < foodNames.length; i++) {
    if (foodNames[i].indexOf('菜') !== -1 || foodNames[i].indexOf('沙拉') !== -1) hasVeg = true;
    if (foodNames[i].indexOf('苹果') !== -1 || foodNames[i].indexOf('香蕉') !== -1 || foodNames[i].indexOf('水果') !== -1 || foodNames[i].indexOf('莓') !== -1) hasFruit = true;
  }
  if (!hasVeg) {
    recs[1].items.push({ name: '什锦蔬菜（菠菜/西兰花/彩椒）', cal: 80, reason: '补充膳食纤维和维生素' });
    recs[2].items.push({ name: '番茄蛋花汤', cal: 80, reason: '补充番茄红素和蛋白质' });
  }
  if (!hasFruit) recs[2].items.push({ name: '苹果1个 或 猕猴桃2个', cal: 90, reason: '富含维C和果胶，助消化' });

  var totalRec = 0;
  for (var i = 0; i < recs.length; i++) for (var j = 0; j < recs[i].items.length; j++) totalRec += recs[i].items[j].cal;
  return { meals: recs, totalCal: totalRec };
}

Page({
  data: {
    intake: 0, burn: 0, net: 0, intakeP: 0, burnP: 0,
    summaryText: '',
    recommend: null, recommendTotal: 0,
    nutriPct: { p: 0, c: 0, f: 0 },
    foodCount: 0, exCount: 0
  },
  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 2 });
    var dk = store.todayStr(), foods = store.getFoods(), ex = store.getExercises();
    var intake = store.calcDayCal(foods, dk), burn = store.calcDayExercise(ex, dk), max = Math.max(intake, burn, 1);

    var df = foods[dk] || {}, allMeals = (df.meals || []).slice();
    ['breakfast', 'lunch', 'dinner', 'snack'].forEach(function (k) { if (df[k]) allMeals = allMeals.concat(df[k]); });
    var foodNames = allMeals.map(function (f) { return f.name; });
    var n = store.calcDayNutrients(foods, dk);
    var pn = { p: Math.round(n.p), c: Math.round(n.c), f: Math.round(n.f) };

    var summary = buildSummary(intake, pn, foodNames, burn);
    var rec = buildRecommend(intake, pn, foodNames);

    var total = pn.p + pn.c + pn.f;
    var pct = { p: 0, c: 0, f: 0 };
    if (total > 0) { pct.p = Math.round(pn.p / total * 100); pct.c = Math.round(pn.c / total * 100); pct.f = 100 - pct.p - pct.c; }

    var exList = ex[dk] || [];

    this.setData({
      intake: intake, burn: burn, net: intake - burn,
      intakeP: Math.round(intake / max * 100), burnP: Math.round(burn / max * 100),
      summaryText: summary,
      recommend: rec.meals, recommendTotal: rec.totalCal,
      nutriPct: pct,
      foodCount: foodNames.length, exCount: exList.length
    });

    this._drawNutriChart(pct);
  },

  _drawNutriChart: function (pct) {
    if (pct.p === 0 && pct.c === 0 && pct.f === 0) return;
    var ctx = wx.createCanvasContext('nutriPie', this);
    var cx = 75, cy = 75, r = 60;
    var data = [
      { val: pct.p, color: '#FF5252' },
      { val: pct.c, color: '#2196F3' },
      { val: pct.f, color: '#4CAF50' }
    ];
    var startAngle = -Math.PI / 2;
    for (var i = 0; i < data.length; i++) {
      if (data[i].val <= 0) continue;
      var sweep = 2 * Math.PI * data[i].val / 100;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + sweep);
      ctx.closePath();
      ctx.setFillStyle(data[i].color);
      ctx.fill();
      startAngle += sweep;
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 35, 0, 2 * Math.PI);
    ctx.setFillStyle('#FFFBF5');
    ctx.fill();
    ctx.setFontSize(12);
    ctx.setFillStyle('#333');
    ctx.setTextAlign('center');
    ctx.setTextBaseline('middle');
    ctx.fillText('营养', cx, cy - 7);
    ctx.fillText('分布', cx, cy + 7);
    ctx.draw();
  }
});
