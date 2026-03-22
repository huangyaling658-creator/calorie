var store = require('../../utils/store');
var foodIcon = require('../../utils/food-icon');

function getComparisons(cal){
  var all=[];
  if(cal<=0) return all;
  all.push({icon:'🏃',text:'相当于慢跑 '+Math.round(cal/10)+' 分钟'});
  all.push({icon:'🚶',text:'相当于散步 '+Math.round(cal/4)+' 分钟'});
  all.push({icon:'🥚',text:'约等于 '+(cal/70).toFixed(1)+' 个鸡蛋的能量'});
  all.push({icon:'🍚',text:'约等于 '+(cal/170).toFixed(1)+' 碗米饭'});
  if(cal>150) all.push({icon:'🏟️',text:'需要绕操场跑 '+Math.round(cal/40)+' 圈才能消耗'});
  if(cal>100) all.push({icon:'🚴',text:'相当于骑自行车 '+Math.round(cal/7)+' 分钟'});
  if(cal>200) all.push({icon:'🏊',text:'相当于游泳 '+Math.round(cal/9)+' 分钟'});
  if(cal>50) all.push({icon:'🧘',text:'相当于做瑜伽 '+Math.round(cal/4)+' 分钟'});
  if(cal>80) all.push({icon:'🪢',text:'相当于跳绳 '+Math.round(cal/12)+' 分钟'});
  if(cal>120) all.push({icon:'💃',text:'相当于跳舞 '+Math.round(cal/7)+' 分钟'});
  for(var i=all.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=all[i];all[i]=all[j];all[j]=t;}
  return all.slice(0,5);
}

function genAnalysis(food){
  var p=food.protein||0,f=food.fat||0,c=food.carbs||0,total=p+f+c;
  if(total===0)return'暂无足够数据进行营养分析。';
  var pR=p/total,fR=f/total,cR=c/total;
  if(pR>0.25&&fR<0.15) return'高蛋白低脂肪的优质组合，适合健身增肌或减脂期间食用，饱腹感强。';
  if(cR>0.6) return'碳水含量较高，建议搭配蛋白质和蔬菜，延缓血糖上升，增加饱腹感。';
  if(fR>0.4) return'脂肪含量偏高，建议适量食用，搭配清淡蔬菜平衡总热量。';
  return'营养较为均衡，蛋白质、碳水和脂肪比例合理，继续保持多样化饮食。';
}

Page({
  data:{statusBarHeight:20,navHeight:88,mode:'view',foods:[],currentIndex:0,
    food:null,analysis:'',timeStr:'',comparisons:[],pendingDate:'',currentAdded:false},
  onLoad:function(opt){
    var sys=wx.getWindowInfo(),menu=wx.getMenuButtonBoundingClientRect();
    var sbh=sys.statusBarHeight||20;
    this.setData({statusBarHeight:sbh,navHeight:sbh+menu.height+(menu.top-sbh)*2});
    if(opt.mode==='preview') this._loadPreview();
    else this._loadExisting(opt);
  },
  _loadPreview:function(){
    var gd=getApp().globalData||{};
    var foods=gd.pendingFoods||[];
    var date=gd.pendingDate||store.todayStr();
    if(!foods.length){wx.showToast({title:'无识别结果',icon:'none'});return;}
    for(var i=0;i<foods.length;i++){
      var mapped=foodIcon(foods[i].name);
      if(mapped!=='🍽️')foods[i].icon=mapped;
      else if(!foods[i].icon)foods[i].icon='🍽️';
      foods[i]._added=false;
    }
    this.setData({mode:'preview',foods:foods,pendingDate:date,currentIndex:0});
    this._showFood(0);
  },
  _loadExisting:function(opt){
    var id=Number(opt.id),date=opt.date;
    var foods=store.getFoods(),df=foods[date]||{};
    var all=(df.meals||[]).slice();
    ['breakfast','lunch','dinner','snack'].forEach(function(k){if(df[k])all=all.concat(df[k]);});
    var found=null;
    for(var i=0;i<all.length;i++){if(all[i].id===id){found=all[i];break;}}
    if(!found){wx.showToast({title:'食物不存在',icon:'none'});return;}
    var mapped=foodIcon(found.name);
    if(mapped!=='🍽️')found.icon=mapped;
    else if(!found.icon)found.icon='🍽️';
    var ts='';
    if(found.addedAt)ts=found.addedAt;
    else if(found.id){var d=new Date(found.id);ts=('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
    this.setData({mode:'view',food:found,analysis:genAnalysis(found),timeStr:date+' '+ts,
      comparisons:getComparisons(found.cal||0)});
  },
  _showFood:function(idx){
    var f=this.data.foods[idx];
    if(!f)return;
    this.setData({currentIndex:idx,food:f,analysis:genAnalysis(f),
      comparisons:getComparisons(f.cal||0),currentAdded:!!f._added});
  },
  onPrevFood:function(){
    if(this.data.currentIndex>0)this._showFood(this.data.currentIndex-1);
  },
  onNextFood:function(){
    if(this.data.currentIndex<this.data.foods.length-1)this._showFood(this.data.currentIndex+1);
  },
  onAddCurrent:function(){
    var idx=this.data.currentIndex;
    var food=this.data.foods[idx];
    if(!food||food._added)return;
    var that=this;
    var date=this.data.pendingDate||store.todayStr();

    function doSave(){
      var now=new Date(),ts=('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2);
      var allFoods=store.getFoods();
      if(!allFoods[date])allFoods[date]={};
      if(!allFoods[date].meals)allFoods[date].meals=[];
      allFoods[date].meals.push({
        id:food.id||Date.now(), name:food.name, icon:food.icon,
        cal:food.cal||0, protein:food.protein||0, carbs:food.carbs||0,
        fat:food.fat||0, fiber:food.fiber||0, sodium:food.sodium||0,
        type:food.type||'', portion:food.portion||'',
        summary:food.summary||'', imageUrl:food.imageUrl||'', addedAt:ts
      });
      store.setFoods(allFoods);
      food._added=true;
      var key='foods['+idx+']._added';
      var obj={currentAdded:true};
      obj[key]=true;
      that.setData(obj);
      wx.showToast({title:'已添加 '+food.name,icon:'success'});
    }

    if(food.tempImagePath){
      wx.showLoading({title:'保存图片...',mask:true});
      var cloudPath='food/'+Date.now()+'_'+Math.random().toString(36).slice(2,6)+'.jpg';
      wx.cloud.uploadFile({
        cloudPath:cloudPath,filePath:food.tempImagePath,
        success:function(res){food.imageUrl=res.fileID;},
        complete:function(){
          delete food.tempImagePath;
          wx.hideLoading();
          doSave();
        }
      });
    } else {
      doSave();
    }
  },
  onBack:function(){
    var gd=getApp().globalData||{};
    delete gd.pendingFoods;delete gd.pendingDate;
    wx.navigateBack();
  }
});
