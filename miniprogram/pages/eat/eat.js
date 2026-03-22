var store = require('../../utils/store');
var tips = require('../../utils/tips');
var ai = require('../../utils/ai-service');
var foodIcon = require('../../utils/food-icon');

var _siPlugin=null;
try{_siPlugin=requirePlugin('WechatSI');}catch(e){}

Page({
  data: {
    calendarDays:[], scrollToDay:'', selectedDate:'', dailyTip:'',
    totalCal:0, nutrientP:0, nutrientC:0, nutrientF:0,
    allFoods:[], displayFoods:[], showAllFoods:false,
    foodInput:'', recording:false, voiceText:'',
    capturedImages:[], aiLoading:false
  },
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
          that.setData({foodInput:base+(base?sep:'')+res.result,voiceText:res.result});
        }
      };
      this._recManager.onStop=function(res){
        that.setData({recording:false});
        if(res.result){
          var base=that._baseText||'';
          var sep=(base&&!base.match(/[，,、\s]$/))? '，':'';
          that.setData({foodInput:base+(base?sep:'')+res.result,voiceText:''});
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
  onShow: function() {
    if (typeof this.getTabBar==='function'&&this.getTabBar()) this.getTabBar().setData({selected:0});
    this.initCalendar();
    this.setData({ selectedDate:store.todayStr(), dailyTip:tips.getDailyTip() });
    this.refreshFoodView();
  },
  initCalendar: function() {
    var today=new Date(),dn=['日','一','二','三','四','五','六'],days=[],foods=store.getFoods(),ts=store.todayStr();
    for(var i=-14;i<=14;i++){var d=new Date(today);d.setDate(today.getDate()+i);var ds=store.formatDate(d);
      days.push({date:ds,dayName:dn[d.getDay()],dayNum:d.getDate(),isToday:i===0,isSelected:ds===ts,hasData:!!foods[ds]});}
    this.setData({calendarDays:days,scrollToDay:'day-'+ts});
  },
  onSelectDay: function(e) {
    var date=e.currentTarget.dataset.date;
    var days=this.data.calendarDays.map(function(d){d.isSelected=(d.date===date);return d;});
    this.setData({selectedDate:date,calendarDays:days,showAllFoods:false}); this.refreshFoodView();
  },
  refreshFoodView: function() {
    var foods=store.getFoods(),dk=this.data.selectedDate,df=foods[dk]||{};
    var all=(df.meals||[]).slice();
    ['breakfast','lunch','dinner','snack'].forEach(function(k){if(df[k])all=all.concat(df[k]);});
    for(var i=0;i<all.length;i++){
      if(!all[i].timeStr){
        if(all[i].addedAt) all[i].timeStr=all[i].addedAt;
        else if(all[i].id){var d=new Date(all[i].id);all[i].timeStr=('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
        else all[i].timeStr='';
      }
      var mapped=foodIcon(all[i].name);
      all[i].icon=(mapped!=='🍽️')?mapped:(all[i].icon||'🍽️');
    }
    all.sort(function(a,b){return(b.id||0)-(a.id||0);});
    var display=this.data.showAllFoods?all:all.slice(0,3);
    var n=store.calcDayNutrients(foods,dk);
    var tc=store.calcDayCal(foods,dk);
    this.setData({allFoods:all,displayFoods:display,totalCal:tc,nutrientP:Math.round(n.p),nutrientC:Math.round(n.c),nutrientF:Math.round(n.f)});
    this.drawRing(tc);
  },
  drawRing: function(cal) {
    var ctx=wx.createCanvasContext('calRing',this),cx=40,cy=40,r=30,p=Math.min(cal/2000,1);
    ctx.setLineWidth(6);ctx.setStrokeStyle('#F0ECE6');ctx.setLineCap('round');
    ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.stroke();
    if(p>0){ctx.setStrokeStyle('#FF6B35');ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+2*Math.PI*p);ctx.stroke();}
    ctx.draw();
  },
  onFoodDetail: function(e) {
    var id=e.currentTarget.dataset.id;
    wx.navigateTo({url:'/pages/food-detail/food-detail?id='+id+'&date='+this.data.selectedDate});
  },
  onToggleShowAll: function() {
    this.setData({showAllFoods:true,displayFoods:this.data.allFoods});
  },
  onDeleteFood: function(e) {
    var id=e.currentTarget.dataset.id,that=this;
    wx.showModal({title:'确认删除',content:'确定删除？',success:function(r){
      if(r.confirm){var foods=store.getFoods(),dk=that.data.selectedDate,df=foods[dk];
        if(!df)return;
        if(df.meals){df.meals=df.meals.filter(function(f){return f.id!==id;});if(!df.meals.length)delete df.meals;}
        ['breakfast','lunch','dinner','snack'].forEach(function(k){
          if(df[k]){df[k]=df[k].filter(function(f){return f.id!==id;});if(!df[k].length)delete df[k];}
        });
        if(!Object.keys(df).length)delete foods[dk];
        store.setFoods(foods);that.refreshFoodView();that.initCalendar();
      }
    }});
  },
  onFoodInput: function(e){ this.setData({foodInput:e.detail.value}); },
  onClearInput: function(){ this.setData({foodInput:''}); },

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
    this._baseText=this.data.foodInput;
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
    var current=this.data.foodInput;
    var sep=(current&&!current.match(/[，,、。！？\s]$/))?'，':'';
    var target=current+(current?sep:'')+text;
    var i=current.length+(current?sep.length:0);
    function tick(){
      if(i>=target.length){that._processTypeQueue();return;}
      i+=2;if(i>target.length)i=target.length;
      that.setData({foodInput:target.slice(0,i),voiceText:text});
      setTimeout(tick,40);
    }
    tick();
  },

  onCamera: function(){
    var that=this;
    wx.chooseMedia({count:9,mediaType:['image'],sourceType:['camera'],sizeType:['compressed'],success:function(r){
      var imgs=that.data.capturedImages.slice(),paths=[];
      for(var i=0;i<r.tempFiles.length;i++){imgs.push(r.tempFiles[i].tempFilePath);paths.push(r.tempFiles[i].tempFilePath);}
      that.setData({capturedImages:imgs});
      that._autoRecognize(paths);
    }});
  },
  onAlbum: function(){
    var that=this;
    wx.chooseMedia({count:9,mediaType:['image'],sourceType:['album'],sizeType:['compressed'],success:function(r){
      var imgs=that.data.capturedImages.slice(),paths=[];
      for(var i=0;i<r.tempFiles.length;i++){imgs.push(r.tempFiles[i].tempFilePath);paths.push(r.tempFiles[i].tempFilePath);}
      that.setData({capturedImages:imgs});
      that._autoRecognize(paths);
    }});
  },
  onRemoveImage: function(e){
    var imgs=this.data.capturedImages.slice();
    imgs.splice(e.currentTarget.dataset.index,1);
    this.setData({capturedImages:imgs});
  },
  _autoRecognize: function(paths){
    var that=this,idx=0,results=[];
    that.setData({aiLoading:true});
    function next(){
      if(idx>=paths.length){
        that.setData({aiLoading:false,capturedImages:[]});
        if(results.length>0){
          for(var i=0;i<results.length;i++){results[i].id=Date.now()+i;results[i].icon=foodIcon(results[i].name);}
          getApp().globalData=getApp().globalData||{};
          getApp().globalData.pendingFoods=results;
          getApp().globalData.pendingDate=that.data.selectedDate;
          wx.navigateTo({url:'/pages/food-detail/food-detail?mode=preview'});
        }
        return;
      }
      var p=paths[idx];idx++;
      wx.showLoading({title:'识别第'+idx+'/'+paths.length+'张',mask:true});
      ai.recognizeFood(p,function(err,food){
        wx.hideLoading();
        if(err){wx.showToast({title:'第'+idx+'张: '+(err||'识别失败'),icon:'none',duration:2000});}
        else{food.tempImagePath=p;results.push(food);}
        next();
      });
    }
    next();
  },
  onAIRecognize: function(){
    var text=this.data.foodInput.trim();
    if(!text&&!this.data.capturedImages.length){wx.showToast({title:'请输入食物或拍照',icon:'none'});return;}
    if(this.data.capturedImages.length&&!text){this._autoRecognize(this.data.capturedImages);return;}
    var that=this;
    that.setData({aiLoading:true});wx.showLoading({title:'AI 分析中...',mask:true});
    ai.analyzeFoodsMulti(text,function(err,foods){
      wx.hideLoading();that.setData({aiLoading:false});
      if(err){wx.showToast({title:err,icon:'none'});return;}
      for(var i=0;i<foods.length;i++){foods[i].id=foods[i].id||Date.now()+i;foods[i].icon=foodIcon(foods[i].name);}
      getApp().globalData=getApp().globalData||{};
      getApp().globalData.pendingFoods=foods;
      getApp().globalData.pendingDate=that.data.selectedDate;
      that.setData({foodInput:'',capturedImages:[]});
      wx.navigateTo({url:'/pages/food-detail/food-detail?mode=preview'});
    });
  }
});
