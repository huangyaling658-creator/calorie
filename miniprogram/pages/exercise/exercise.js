var store = require('../../utils/store');
var tips = require('../../utils/tips');
var ai = require('../../utils/ai-service');

var _siPlugin=null;
try{_siPlugin=requirePlugin('WechatSI');}catch(e){}

var QUICK = [
  {name:'散步',icon:'🚶',cpm:4},{name:'跑步',icon:'🏃',cpm:10},{name:'骑行',icon:'🚴',cpm:8},
  {name:'游泳',icon:'🏊',cpm:9},{name:'瑜伽',icon:'🧘',cpm:4},{name:'跳绳',icon:'⏭️',cpm:12},
  {name:'跳舞',icon:'💃',cpm:7},{name:'HIIT',icon:'🔥',cpm:14},{name:'爬楼梯',icon:'🪜',cpm:8},
  {name:'打球',icon:'🏀',cpm:8},{name:'健身',icon:'💪',cpm:7},{name:'举铁',icon:'🏋️',cpm:6}
];

function exerciseIcon(name){
  if(!name) return'🏃';
  var map=[
    ['跑步','🏃'],['慢跑','🏃'],['散步','🚶'],['走路','🚶'],['快走','🚶'],
    ['骑行','🚴'],['骑车','🚴'],['自行车','🚴'],
    ['游泳','🏊'],['瑜伽','🧘'],['拉伸','🧘'],['冥想','🧘'],
    ['跳绳','⏭️'],['跳舞','💃'],['舞蹈','💃'],
    ['HIIT','🔥'],['有氧','🔥'],['燃脂','🔥'],
    ['爬楼','🪜'],['爬山','⛰️'],['登山','⛰️'],['徒步','🥾'],
    ['篮球','🏀'],['打球','🏀'],['乒乓','🏓'],['羽毛球','🏸'],['网球','🎾'],['排球','🏐'],['足球','⚽'],
    ['健身','💪'],['力量','💪'],['俯卧撑','💪'],['仰卧起坐','💪'],
    ['举铁','🏋️'],['举重','🏋️'],['深蹲','🏋️'],['卧推','🏋️'],['哑铃','🏋️'],
    ['拳击','🥊'],['搏击','🥊'],['武术','🥋'],['太极','🥋'],
    ['滑雪','⛷️'],['滑冰','⛸️'],['溜冰','⛸️'],
    ['划船','🚣'],['皮划艇','🚣'],['高尔夫','⛳'],['棒球','⚾'],
    ['攀岩','🧗'],['跑圈','🏃'],['操场','🏃']
  ];
  for(var i=0;i<map.length;i++){
    if(name.indexOf(map[i][0])!==-1) return map[i][1];
  }
  return name.charAt(0);
}

Page({
  data: {totalBurned:0,exercises:[],quickExercises:QUICK,
    calendarDays:[],scrollToDay:'',selectedDate:'',dailyTip:'',
    exInput:'',recording:false,voiceText:'',aiLoading:false},
  onLoad: function(){
    this._micAuthorized=false;
    this._initRecorder();
  },
  _initRecorder: function(){
    var that=this;
    if(_siPlugin){
      this._recManager=_siPlugin.getRecordRecognitionManager();
      this._recManager.onStart=function(){that.setData({recording:true,voiceText:'正在聆听...'});};
      this._recManager.onRecognize=function(res){
        if(res.result){
          var base=that._baseText||'';
          var sep=(base&&!base.match(/[，,、\s]$/))? '，':'';
          that.setData({exInput:base+(base?sep:'')+res.result,voiceText:res.result});
        }
      };
      this._recManager.onStop=function(res){
        that.setData({recording:false});
        if(res.result){
          var base=that._baseText||'';
          var sep=(base&&!base.match(/[，,、\s]$/))? '，':'';
          that.setData({exInput:base+(base?sep:'')+res.result,voiceText:''});
        } else { that.setData({voiceText:''}); }
      };
      this._recManager.onError=function(){
        that.setData({recording:false,voiceText:''});
        wx.showToast({title:'语音识别出错',icon:'none'});
      };
    } else {
      this._recorder=wx.getRecorderManager();
      this._recorder.onStop(function(res){
        var isManual=that._manualStop;
        var seq=that._currentSeg||0;
        that._currentSeg=seq+1;
        if(!isManual&&that.data.recording){
          that._recorder.start({format:'mp3',sampleRate:16000,numberOfChannels:1,duration:3000});
        } else {
          that.setData({recording:false});
        }
        if(res.tempFilePath){
          that._pendingCount=(that._pendingCount||0)+1;
          that._uploadAndTranscribe(res.tempFilePath,seq);
        } else if(isManual){
          that._checkAllDone();
        }
      });
      this._recorder.onError(function(){
        that.setData({recording:false,voiceText:''});
        that._manualStop=false;
      });
    }
    wx.getSetting({success:function(res){
      if(res.authSetting['scope.record']!==false) that._micAuthorized=true;
    }});
  },
  onShow: function(){
    if(typeof this.getTabBar==='function'&&this.getTabBar()) this.getTabBar().setData({selected:1});
    this.initCalendar();
    this.setData({selectedDate:store.todayStr(),dailyTip:tips.getDailyTip()});
    this.refresh();
  },
  initCalendar: function(){
    var today=new Date(),dn=['日','一','二','三','四','五','六'],days=[],exData=store.getExercises(),ts=store.todayStr();
    for(var i=-14;i<=14;i++){var d=new Date(today);d.setDate(today.getDate()+i);var ds=store.formatDate(d);
      days.push({date:ds,dayName:dn[d.getDay()],dayNum:d.getDate(),isToday:i===0,isSelected:ds===ts,hasData:!!exData[ds]});}
    this.setData({calendarDays:days,scrollToDay:'day-'+ts});
  },
  onSelectDay: function(e){
    var date=e.currentTarget.dataset.date;
    var days=this.data.calendarDays.map(function(d){d.isSelected=(d.date===date);return d;});
    this.setData({selectedDate:date,calendarDays:days}); this.refresh();
  },
  refresh: function(){
    var dk=this.data.selectedDate||store.todayStr(),all=store.getExercises(),list=(all[dk]||[]).slice(),total=store.calcDayExercise(all,dk);
    for(var i=0;i<list.length;i++) list[i].icon=exerciseIcon(list[i].name);
    this.setData({exercises:list,totalBurned:total});
    var ctx=wx.createCanvasContext('exRing',this),cx=40,cy=40,r=30,p=Math.min(total/500,1);
    ctx.setLineWidth(6);ctx.setStrokeStyle('#F0ECE6');ctx.setLineCap('round');ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.stroke();
    if(p>0){ctx.setStrokeStyle('#FF8A00');ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+2*Math.PI*p);ctx.stroke();}
    ctx.draw();
  },
  onExDetail: function(e){
    var idx=e.currentTarget.dataset.index,ex=this.data.exercises[idx];
    if(ex) wx.showModal({title:ex.name,content:'时长：'+ex.duration+'分钟\n消耗：'+ex.cal+' kcal',showCancel:false});
  },
  onDeleteExercise: function(e){
    var idx=e.currentTarget.dataset.index,that=this;
    wx.showModal({title:'确认删除',content:'确定删除？',success:function(r){
      if(r.confirm){
        var dk=that.data.selectedDate||store.todayStr(),all=store.getExercises();
        if(all[dk]){all[dk].splice(idx,1);if(!all[dk].length)delete all[dk];}
        store.setExercises(all);that.refresh();that.initCalendar();
      }
    }});
  },
  onQuickExercise: function(e){
    var q=QUICK[e.currentTarget.dataset.index];
    var ex={id:Date.now(),name:q.name,icon:q.icon,duration:30,cal:q.cpm*30};
    var dk=this.data.selectedDate||store.todayStr(),all=store.getExercises();
    if(!all[dk])all[dk]=[];all[dk].push(ex);store.setExercises(all);this.refresh();this.initCalendar();
    wx.showToast({title:q.name+' -'+ex.cal+'kcal',icon:'none'});
  },
  onExInput: function(e){ this.setData({exInput:e.detail.value}); },
  onClearInput: function(){ this.setData({exInput:''}); },

  onVoiceInput: function(){
    if(this.data.recording){
      this._manualStop=true;
      if(this._recManager) this._recManager.stop();
      else if(this._recorder) this._recorder.stop();
      return;
    }
    var that=this;
    if(this._micAuthorized){this._doStartRecord();return;}
    wx.authorize({scope:'scope.record',
      success:function(){that._micAuthorized=true;that._doStartRecord();},
      fail:function(){
        wx.showModal({title:'需要录音权限',content:'请授权录音权限',confirmText:'去设置',
          success:function(r){if(r.confirm)wx.openSetting({success:function(s){
            if(s.authSetting['scope.record']){that._micAuthorized=true;that._doStartRecord();}
          }});}});
      }
    });
  },
  _doStartRecord: function(){
    this._baseText=this.data.exInput;
    this._manualStop=false;
    this._currentSeg=0;
    this._nextDisplaySeq=0;
    this._segResults={};
    this._pendingCount=0;
    this._typeQueue=[];
    this._isTyping=false;
    this.setData({recording:true,voiceText:'正在聆听...'});
    if(this._recManager) this._recManager.start({lang:'zh_CN'});
    else if(this._recorder) this._recorder.start({format:'mp3',sampleRate:16000,numberOfChannels:1,duration:3000});
  },

  _uploadAndTranscribe: function(filePath,seq){
    var that=this;
    var fs=wx.getFileSystemManager();
    try {
      var base64=fs.readFileSync(filePath,'base64');
      wx.cloud.callFunction({
        name:'aiProxy',data:{action:'speechToText',audioBase64:base64},
        success:function(cfRes){
          var r=cfRes.result;
          var text=(r&&r.success&&r.data)?r.data.trim():'';
          that._segResults[seq]=text;
          that._flushSegResults();
          that._pendingCount=Math.max(0,(that._pendingCount||1)-1);
          that._checkAllDone();
        },
        fail:function(){
          that._segResults[seq]='';
          that._flushSegResults();
          that._pendingCount=Math.max(0,(that._pendingCount||1)-1);
          that._checkAllDone();
        }
      });
    } catch(e) {
      that._segResults[seq]='';
      that._flushSegResults();
      that._pendingCount=Math.max(0,(that._pendingCount||1)-1);
      that._checkAllDone();
    }
  },
  _checkAllDone: function(){
    if(this._pendingCount<=0&&!this.data.recording){
      var that=this;
      setTimeout(function(){
        if(that._pendingCount<=0) that.setData({voiceText:''});
      },300);
    }
  },
  _flushSegResults: function(){
    while(this._segResults&&this._segResults.hasOwnProperty(this._nextDisplaySeq)){
      var text=this._segResults[this._nextDisplaySeq];
      delete this._segResults[this._nextDisplaySeq];
      this._nextDisplaySeq++;
      if(text) this._typewriterAppend(text);
    }
  },
  _typewriterAppend: function(text){
    this._typeQueue=this._typeQueue||[];
    this._typeQueue.push(text);
    if(!this._isTyping) this._processTypeQueue();
  },
  _processTypeQueue: function(){
    if(!this._typeQueue||!this._typeQueue.length){this._isTyping=false;return;}
    this._isTyping=true;
    var that=this;
    var text=this._typeQueue.shift();
    var current=this.data.exInput;
    var sep=(current&&!current.match(/[，,、。！？\s]$/))?'，':'';
    var target=current+(current?sep:'')+text;
    var i=current.length+(current?sep.length:0);
    function tick(){
      if(i>=target.length){that._processTypeQueue();return;}
      i+=2;if(i>target.length)i=target.length;
      that.setData({exInput:target.slice(0,i),voiceText:text});
      setTimeout(tick,40);
    }
    tick();
  },

  onAIRecognize: function(){
    var text=this.data.exInput.trim();
    if(!text){wx.showToast({title:'请输入运动内容',icon:'none'});return;}
    var that=this;
    that.setData({aiLoading:true});wx.showLoading({title:'AI 分析中...',mask:true});
    ai.analyzeExerciseByText(text,function(err,exList){
      wx.hideLoading();that.setData({aiLoading:false});
      if(err){wx.showToast({title:err,icon:'none'});return;}
      var dk=that.data.selectedDate||store.todayStr(),all=store.getExercises();
      if(!all[dk])all[dk]=[];
      var CPM={跑步:10,游泳:9,骑行:8,跳绳:12,HIIT:14,健身:7,瑜伽:4,散步:4,拉伸:3,跳舞:7,爬楼梯:8,打球:8,举铁:6,快走:6,慢跑:8};
      for(var i=0;i<exList.length;i++){
        var cal=exList[i].cal||0,dur=exList[i].duration||30,nm=exList[i].name||'';
        if(cal<=0&&dur>0){var cpm=5;for(var k in CPM){if(nm.indexOf(k)!==-1){cpm=CPM[k];break;}}cal=Math.round(cpm*dur);}
        all[dk].push({id:Date.now()+i,name:nm,icon:exerciseIcon(nm),duration:dur,cal:cal});
      }
      store.setExercises(all);
      that.setData({exInput:''});
      wx.showToast({title:'已添加 '+exList.length+' 项运动',icon:'success'});
      that.refresh();that.initCalendar();
    });
  }
});
