var store = require('../../utils/store');
var foodIcon = require('../../utils/food-icon');

function getDayFoods(foods,dk){var df=foods[dk];if(!df)return[];var a=(df.meals||[]).slice();['breakfast','lunch','dinner','snack'].forEach(function(k){if(df[k])a=a.concat(df[k]);});for(var i=0;i<a.length;i++){if(!a[i].icon||a[i].icon==='🍽️')a[i].icon=foodIcon(a[i].name);}return a;}

Page({
  data:{streak:0,reportTab:'week',weekDays:[],monthCells:[],monthTitle:'',_vy:0,_vm:0},
  onShow:function(){
    if(typeof this.getTabBar==='function'&&this.getTabBar())this.getTabBar().setData({selected:3});
    var foods=store.getFoods(),now=new Date();
    this.data._vy=now.getFullYear();this.data._vm=now.getMonth();
    this.setData({streak:store.calcStreak(foods)});
    this.buildWeek(foods);this.buildMonth(foods);
  },
  buildWeek:function(foods){
    if(!foods)foods=store.getFoods();
    var dn=['日','一','二','三','四','五','六'],today=new Date(),days=[];
    for(var i=6;i>=0;i--){
      var d=new Date(today);d.setDate(today.getDate()-i);var dk=store.formatDate(d);
      var allFoods=getDayFoods(foods,dk);
      var images=[],chips=[];
      for(var j=0;j<allFoods.length;j++){
        if(allFoods[j].imageUrl) images.push({url:allFoods[j].imageUrl,id:allFoods[j].id||0});
        chips.push({name:allFoods[j].name,icon:allFoods[j].icon||'🍽️',imageUrl:allFoods[j].imageUrl||'',id:allFoods[j].id||0});
      }
      var collapsed=allFoods.length>4;
      var wasExpanded=!!(this._expandedDates&&this._expandedDates[dk]);
      var isExpanded=collapsed&&wasExpanded;
      days.push({
        date:dk, dayName:dn[d.getDay()], dayNum:d.getDate(),
        images:images, chips:chips,
        displayChips:isExpanded?chips:collapsed?chips.slice(0,3):chips,
        displayImages:isExpanded?images:collapsed?images.slice(0,3):images,
        total:allFoods.length, expanded:isExpanded, collapsed:collapsed,
        cal:store.calcDayCal(foods,dk)
      });
    }
    this.setData({weekDays:days});
  },
  onToggleExpand:function(e){
    var idx=e.currentTarget.dataset.idx;
    var day=this.data.weekDays[idx];
    var expanded=!day.expanded;
    this._expandedDates=this._expandedDates||{};
    this._expandedDates[day.date]=expanded;
    var obj={};
    obj['weekDays['+idx+'].expanded']=expanded;
    obj['weekDays['+idx+'].displayChips']=expanded?day.chips:day.chips.slice(0,3);
    obj['weekDays['+idx+'].displayImages']=expanded?day.images:day.images.slice(0,3);
    this.setData(obj);
  },
  buildMonth:function(foods){
    if(!foods)foods=store.getFoods();
    var y=this.data._vy,m=this.data._vm,fd=new Date(y,m,1).getDay(),td=new Date(y,m+1,0).getDate(),ts=store.todayStr(),cells=[];
    for(var i=0;i<fd;i++)cells.push({idx:'e'+i,empty:true,icons:[],images:[],hasMeal:false});
    for(var d=1;d<=td;d++){
      var dk=y+'-'+('0'+(m+1)).slice(-2)+'-'+('0'+d).slice(-2),items=getDayFoods(foods,dk);
      var icons=[],imgs=[];
      for(var j=0;j<Math.min(items.length,3);j++){
        icons.push(items[j].icon||'🍽️');
        if(items[j].imageUrl) imgs.push(items[j].imageUrl);
      }
      cells.push({idx:dk,day:d,empty:false,isToday:dk===ts,hasMeal:items.length>0,icons:icons,images:imgs.slice(0,1)});
    }
    this.setData({monthCells:cells,monthTitle:y+'年'+(m+1)+'月'});
  },
  onSwitchReport:function(e){this.setData({reportTab:e.currentTarget.dataset.tab});},
  onFoodDetail:function(e){
    var id=e.currentTarget.dataset.id,date=e.currentTarget.dataset.date;
    if(id) wx.navigateTo({url:'/pages/food-detail/food-detail?id='+id+'&date='+date});
  },
  onPrevMonth:function(){var m=this.data._vm-1,y=this.data._vy;if(m<0){m=11;y--;}this.data._vy=y;this.data._vm=m;this.buildMonth();},
  onNextMonth:function(){var m=this.data._vm+1,y=this.data._vy;if(m>11){m=0;y++;}this.data._vy=y;this.data._vm=m;this.buildMonth();}
});
