const cloud = require('wx-server-sdk');
const https = require('https');
const secret = require('./secret');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DASHSCOPE_KEY = secret.DASHSCOPE_KEY;
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

const SILICONFLOW_KEY = secret.SILICONFLOW_KEY;
const SILICONFLOW_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions';

const FOOD_PROMPT = '严格判断图中是否有食物或饮品。如果图中没有任何食物或饮品，只返回：{"error":"no_food"}。如果有食物，返回JSON：{"name":"名称","type":"类型如主食/肉类/蔬菜/水果/饮品/零食/汤品/甜点","portion":"份量如1盘(约200g)","cal":千卡,"protein":蛋白质g,"carbs":碳水g,"fat":脂肪g,"fiber":膳食纤维g,"sodium":钠mg,"summary":"15字以内营养点评"}。只返回JSON，不要附加任何文字。';

const FOOD_MULTI_PROMPT = '你是一个专业营养师。用户会告诉你他们吃了什么，请将每种食物拆分为独立条目，分别估算热量和营养成分。返回JSON数组，每项食物一个对象：[{"name":"食物名称","type":"类型如主食/肉类/蔬菜/水果/饮品/零食/汤品/甜点/烧烤","portion":"估算份量如1份(约200g)","cal":千卡数值,"protein":蛋白质g,"carbs":碳水g,"fat":脂肪g,"fiber":膳食纤维g,"sodium":钠mg,"summary":"15字以内营养点评"}]。注意：cal等数值字段必须是数字不能是字符串。只返回JSON数组，不要附加任何文字。\n用户说：';

const EX_PROMPT = '严格判断图中是否有人在做运动或健身。如果图中没有运动相关内容，只返回：{"error":"no_exercise"}。如果有运动，返回JSON：{"name":"运动名称","duration":分钟,"cal":消耗千卡}。只返回JSON，不要附加任何文字。';

const EX_TEXT_PROMPT = '分析以下运动描述中的所有运动项目，每项运动单独列出。必须根据运动类型和时长估算消耗的千卡数，cal不能为0。参考：跑步约10kcal/分钟，游泳9，骑行8，跳绳12，HIIT14，健身7，瑜伽4，散步4，拉伸3，跳舞7，爬楼梯8，打球8，举铁6。返回JSON数组：[{"name":"运动名称","duration":分钟数,"cal":消耗千卡数}]。即使只有一项运动也返回数组。只返回JSON数组，不要附加任何文字。\n运动描述：';

function httpsPost(url, headers, body, timeout) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      timeout: timeout || 60000
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error('[aiProxy] API error:', res.statusCode, data.slice(0, 500));
          reject(new Error('AI接口错误(' + res.statusCode + '): ' + data.slice(0, 200)));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('返回格式异常')); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时，请重试')); });
    req.on('error', (e) => reject(new Error('网络请求失败: ' + e.message)));
    req.write(JSON.stringify(body));
    req.end();
  });
}

function callDashScope(messages, model, timeout) {
  console.log('[aiProxy] callDashScope model:', model, 'msgLen:', JSON.stringify(messages).length);
  return httpsPost(DASHSCOPE_URL, {
    'Authorization': 'Bearer ' + DASHSCOPE_KEY
  }, { model, messages }, timeout);
}

function extractContent(apiResult) {
  try { return apiResult.choices[0].message.content; }
  catch (e) { throw new Error('返回格式异常'); }
}

function parseJSON(text) {
  if (!text) return null;
  try {
    const t = text.trim();
    if (t[0] === '{' || t[0] === '[') return JSON.parse(t);
    let m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) return JSON.parse(m[1].trim());
    m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch (e) {}
  return null;
}

function parseJSONArray(text) {
  if (!text) return null;
  try {
    const t = text.trim();
    let m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) { const p = JSON.parse(m[1].trim()); return Array.isArray(p) ? p : (p && p.name ? [p] : null); }
    if (t[0] === '[') return JSON.parse(t);
    m = text.match(/\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
  } catch (e) { console.error('[aiProxy] parseJSONArray error:', e.message, 'text:', text.slice(0, 200)); }
  const obj = parseJSON(text);
  return obj && obj.name ? [obj] : null;
}

function normFood(f) {
  f.cal = Math.round(Number(f.cal) || 0);
  f.protein = Math.round(Number(f.protein) || 0);
  f.carbs = Math.round(Number(f.carbs) || 0);
  f.fat = Math.round(Number(f.fat) || 0);
  f.fiber = Math.round(Number(f.fiber) || 0);
  f.sodium = Math.round(Number(f.sodium) || 0);
  f.portion = f.portion || '1份';
  f.type = f.type || '';
  f.summary = f.summary || '';
  f.icon = f.icon || '🍽️';
  return f;
}

exports.main = async (event) => {
  const { action } = event;
  console.log('[aiProxy] action:', action, 'eventKeys:', Object.keys(event));

  try {
    switch (action) {
      case 'recognizeFood': {
        const { fileID, imageBase64 } = event;
        let b64 = imageBase64;
        if (fileID && !b64) {
          const dlRes = await cloud.downloadFile({ fileID });
          b64 = dlRes.fileContent.toString('base64');
        }
        if (!b64) throw new Error('无图片数据');
        const messages = [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b64 } },
          { type: 'text', text: FOOD_PROMPT }
        ]}];
        const result = await callDashScope(messages, 'qwen-vl-plus', 60000);
        const text = extractContent(result);
        const f = parseJSON(text);
        if (!f) throw new Error('无法识别食物');
        if (f.error || !f.name) throw new Error('图片中未识别到食物');
        if (!f.cal || f.cal <= 0) throw new Error('图片中未识别到食物');
        return { success: true, data: normFood(f) };
      }

      case 'analyzeFoodsMulti': {
        const { text } = event;
        if (!text || !text.trim()) throw new Error('请输入食物内容');
        console.log('[aiProxy] analyzeFoodsMulti text:', text);
        const messages = [
          { role: 'system', content: '你是一个专业营养师，擅长评估食物热量和营养成分。用户会用口语描述吃了什么，你需要拆分每种食物并分别估算。始终只返回JSON，不要附加解释。' },
          { role: 'user', content: FOOD_MULTI_PROMPT + text }
        ];
        const result = await callDashScope(messages, 'qwen-plus', 30000);
        const content = extractContent(result);
        console.log('[aiProxy] analyzeFoodsMulti raw:', content.slice(0, 500));
        const arr = parseJSONArray(content);
        if (!arr || !arr.length) throw new Error('无法分析食物，请换个描述试试');
        for (let i = 0; i < arr.length; i++) {
          arr[i].id = Date.now() + i;
          normFood(arr[i]);
        }
        console.log('[aiProxy] analyzeFoodsMulti result count:', arr.length);
        return { success: true, data: arr };
      }

      case 'recognizeExercise': {
        const { fileID, imageBase64 } = event;
        let b64 = imageBase64;
        if (fileID && !b64) {
          const dlRes = await cloud.downloadFile({ fileID });
          b64 = dlRes.fileContent.toString('base64');
        }
        if (!b64) throw new Error('无图片数据');
        const messages = [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b64 } },
          { type: 'text', text: EX_PROMPT }
        ]}];
        const result = await callDashScope(messages, 'qwen-vl-plus', 60000);
        const text = extractContent(result);
        const ex = parseJSON(text);
        if (!ex || ex.error || !ex.name) throw new Error('图片中未识别到运动');
        ex.duration = Math.round(ex.duration || 30);
        ex.cal = Math.round(ex.cal || 0);
        return { success: true, data: ex };
      }

      case 'analyzeExerciseByText': {
        const { text } = event;
        const messages = [{ role: 'user', content: EX_TEXT_PROMPT + text }];
        const result = await callDashScope(messages, 'qwen-plus', 30000);
        const content = extractContent(result);
        let exList = parseJSONArray(content);
        if (!exList || !exList.length) {
          const single = parseJSON(content);
          if (single && single.name) exList = [single];
          else throw new Error('无法分析运动');
        }
        const CPM = {跑步:10,游泳:9,骑行:8,跳绳:12,HIIT:14,健身:7,瑜伽:4,散步:4,拉伸:3,跳舞:7,爬楼梯:8,打球:8,举铁:6,快走:6,慢跑:8,深蹲:6,俯卧撑:7,仰卧起坐:5,平板支撑:5,波比跳:12};
        for (let i = 0; i < exList.length; i++) {
          exList[i].duration = Math.round(exList[i].duration || 30);
          exList[i].cal = Math.round(exList[i].cal || 0);
          if (exList[i].cal <= 0 && exList[i].duration > 0) {
            let cpm = 5;
            const n = exList[i].name || '';
            for (const k in CPM) { if (n.indexOf(k) !== -1) { cpm = CPM[k]; break; } }
            exList[i].cal = Math.round(cpm * exList[i].duration);
          }
        }
        return { success: true, data: exList };
      }

      case 'speechToText': {
        const { fileID, audioBase64 } = event;
        let audioBuffer;
        if (audioBase64) {
          audioBuffer = Buffer.from(audioBase64, 'base64');
        } else if (fileID) {
          const dlRes = await cloud.downloadFile({ fileID });
          audioBuffer = dlRes.fileContent;
        } else {
          throw new Error('无音频数据');
        }
        const boundary = '----FormBound' + Date.now();
        let body = Buffer.concat([
          Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="model"\r\n\r\nFunAudioLLM/SenseVoiceSmall\r\n'),
          Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="audio.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'),
          audioBuffer,
          Buffer.from('\r\n--' + boundary + '--\r\n')
        ]);
        const sttResult = await new Promise((resolve, reject) => {
          const urlObj = new URL(SILICONFLOW_URL);
          const req = https.request({
            hostname: urlObj.hostname, path: urlObj.pathname, method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + SILICONFLOW_KEY,
              'Content-Type': 'multipart/form-data; boundary=' + boundary,
              'Content-Length': body.length
            }, timeout: 30000
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              if (res.statusCode !== 200) { reject(new Error('语音服务错误(' + res.statusCode + ')')); return; }
              try { resolve(JSON.parse(data)); } catch(e) { reject(new Error('语音返回格式异常')); }
            });
          });
          req.on('timeout', () => { req.destroy(); reject(new Error('语音识别超时')); });
          req.on('error', e => reject(new Error('语音网络错误: ' + e.message)));
          req.write(body);
          req.end();
        });
        if (sttResult.text) return { success: true, data: sttResult.text };
        throw new Error('未识别到语音内容');
      }

      default:
        return { success: false, error: '未知操作: ' + action };
    }
  } catch (e) {
    console.error('[aiProxy] error in action:', action, e.message, e.stack);
    return { success: false, error: e.message || '服务异常' };
  }
};
