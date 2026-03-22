function todayStr(){var d=new Date();return fmt(d);}
function fmt(d){return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
function get(k,def){try{var v=wx.getStorageSync('klg_'+k);return v!==''&&v!=null?v:def;}catch(e){return def;}}
function set(k,v){try{wx.setStorageSync('klg_'+k,v);}catch(e){}}
function sumMeals(dayFoods,field){if(!dayFoods)return 0;var t=0,meals=Object.keys(dayFoods);for(var i=0;i<meals.length;i++){var items=dayFoods[meals[i]];if(!Array.isArray(items))continue;for(var j=0;j<items.length;j++)t+=(items[j][field]||0);}return t;}

var _syncTimer=null;
function scheduleSync(){
  if(_syncTimer) clearTimeout(_syncTimer);
  _syncTimer=setTimeout(function(){
    _syncTimer=null;
    var foods=get('foods',{});
    var exercises=get('exercises',{});
    wx.cloud.callFunction({
      name:'dataSync',
      data:{action:'upload',foods:foods,exercises:exercises}
    });
  },2000);
}

module.exports = {
  todayStr:todayStr, formatDate:fmt,
  getFoods:function(){return get('foods',{});},
  setFoods:function(f){set('foods',f);scheduleSync();},
  getExercises:function(){return get('exercises',{});},
  setExercises:function(e){set('exercises',e);scheduleSync();},
  calcDayCal:function(foods,dk){return sumMeals(foods[dk],'cal');},
  calcDayNutrients:function(foods,dk){var d=foods[dk],r={p:0,c:0,f:0};if(!d)return r;var meals=Object.keys(d);for(var i=0;i<meals.length;i++){var items=d[meals[i]];if(!Array.isArray(items))continue;for(var j=0;j<items.length;j++){r.p+=(items[j].protein||0);r.c+=(items[j].carbs||0);r.f+=(items[j].fat||0);}}return r;},
  calcDayExercise:function(ex,dk){var l=ex[dk];if(!l)return 0;var t=0;for(var i=0;i<l.length;i++)t+=(l[i].cal||0);return t;},
  calcStreak:function(foods){var s=0,today=new Date();for(var i=0;i<365;i++){var d=new Date(today);d.setDate(today.getDate()-i);var ds=fmt(d);if(foods[ds]&&Object.keys(foods[ds]).length>0)s++;else if(i>0)break;}return s;},
  syncFromCloud:function(cb){
    wx.cloud.callFunction({
      name:'dataSync',
      data:{action:'download'},
      success:function(res){
        var r=res.result;
        if(!r||!r.success||!r.data){if(cb)cb();return;}
        var cloud=r.data;
        var localFoods=get('foods',{});
        var localEx=get('exercises',{});
        var localTs=get('syncTs',0);
        var cloudTs=cloud.updatedAt||0;
        if(cloudTs>localTs){
          var merged=mergeData(localFoods,cloud.foods||{});
          var mergedEx=mergeData(localEx,cloud.exercises||{});
          set('foods',merged);set('exercises',mergedEx);set('syncTs',cloudTs);
        } else {
          var merged=mergeData(cloud.foods||{},localFoods);
          var mergedEx=mergeData(cloud.exercises||{},localEx);
          set('foods',merged);set('exercises',mergedEx);
          scheduleSync();
        }
        if(cb)cb();
      },
      fail:function(){if(cb)cb();}
    });
  }
};

function mergeData(base,newer){
  var result={};
  var allKeys={};
  var k;
  for(k in base) allKeys[k]=true;
  for(k in newer) allKeys[k]=true;
  for(k in allKeys){
    var bv=base[k],nv=newer[k];
    if(!bv){result[k]=nv;}
    else if(!nv){result[k]=bv;}
    else {
      var bCount=countItems(bv);
      var nCount=countItems(nv);
      result[k]=nCount>=bCount?nv:bv;
    }
  }
  return result;
}

function countItems(dayData){
  if(Array.isArray(dayData)) return dayData.length;
  if(typeof dayData!=='object'||!dayData) return 0;
  var c=0;
  for(var k in dayData){
    if(Array.isArray(dayData[k])) c+=dayData[k].length;
  }
  return c;
}
