Component({
  data: { selected:0, list:[
    {pagePath:"/pages/eat/eat",text:"吃了啥",icon:"🍴"},
    {pagePath:"/pages/exercise/exercise",text:"动了么",icon:"🏃"},
    {pagePath:"/pages/energy/energy",text:"今日能量",icon:"⚡"},
    {pagePath:"/pages/profile/profile",text:"能量日历",icon:"📅"}
  ]},
  methods: { switchTab:function(e){ wx.switchTab({url:this.data.list[e.currentTarget.dataset.index].pagePath}); } }
});
