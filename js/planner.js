// planner.js - AI路线规划 V1.0
const RoutePlanner = {
  attractions: null, currentRoute: null, attrToCity: {}, attrList: [],

  init() {
    this.attractions = APP_DATA.attractions;
    this.attrToCity = {};
    this.attrList = [];
    var self = this;
    this.attractions.forEach(function(a){
      self.attrToCity[a.name] = a.city;
      self.attrList.push(a.name+"("+a.city+")");
    });
  },

  showPlanner(containerId) {
    containerId = containerId || "plannerPanel";
    var panel = document.getElementById(containerId);
    if(!panel)return;
    panel.innerHTML = '<div class="planner-header"><h3>🧭 DeepSeek AI 路线规划</h3>'+
      '<div style="display:flex;gap:6px;"><button class="btn btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="RoutePlanner.showHistory()">📋 记录</button>'+
      '<button class="btn-close" onclick="document.getElementById(\''+containerId+'\').classList.remove(\'active\')">&times;</button></div></div>'+
      '<div class="planner-form"><div class="form-group"><label>✍️ 自由描述旅行需求</label>'+
      '<textarea id="planPrompt" rows="5" placeholder="如：一家三口8月海南5天，想去亚龙湾、蜈支洲岛、日月湾冲浪，每天1200元"></textarea></div>'+
      '<div style="font-size:11px;color:#889;margin:-8px 0 12px;">💡 支持'+this.attractions.length+'个景点</div>'+
      '<button class="btn btn-primary btn-block" id="btnGenerate">✨ DeepSeek 生成路线</button></div>'+
      '<div id="planResult"></div>';
    panel.classList.add("active");
    document.getElementById("btnGenerate").addEventListener("click",function(){RoutePlanner.generate();});
  },

  async generate() {
    var prompt = document.getElementById("planPrompt");
    if(!prompt||!prompt.value.trim()){ContentDisplay.showStatus("请描述旅行需求","info","mapStatus");return;}
    prompt = prompt.value.trim();
    ContentDisplay.showStatus("🤖 DeepSeek规划中...","loading","mapStatus");
    try{
      var route = await this._callDeepSeek(prompt);
      if(!route||!route.days||!route.days.length)throw new Error("AI返回为空");
      this.currentRoute = route;
      this._saveHistory(route);
      this._showResult(route);
      ContentDisplay.showStatus("✅ "+route.name,"success","mapStatus");
    }catch(err){
      console.error(err);
      var fb = this._localFallback(prompt);
      this.currentRoute = fb;
      this._saveHistory(fb);
      this._showResult(fb);
      ContentDisplay.showStatus("⚠️ 本地引擎生成（AI失败:"+err.message.substring(0,20)+"）","success","mapStatus");
    }
    KnowledgeBase.saveQA(prompt, (this.currentRoute?this.currentRoute.name:""), (this.currentRoute?this.currentRoute.name:""));
  },

  async _callDeepSeek(userInput) {
    var cfg = AIChat.apiConfig;
    if(!AIChat._getPassword())throw new Error("请先输入访问密码");
    var cities = Object.keys(HainanMap.cities).join("、");
    var sys = '你是海南旅游路线规划专家。严格返回JSON。格式：{"name":"路线名","type":"亲子/情侣/老人/年轻人/经典","days":[{"day":1,"from":"城市","to":"城市","places":["景点"],"stay":"城市"}],"tips":"建议","budget":{"accommodation":0,"food":0,"transport":0,"tickets":0,"total":0}}。城市：'+cities+'。景点：'+this.attrList.join("、")+'。规则：from/to/stay来自城市列表；places来自景点列表；路线连续；最后stay="返程"。';
    var resp = await fetch("/api/deepseek",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:cfg.model,messages:[{role:"system",content:sys},{role:"user",content:"规划海南旅游："+userInput}],temperature:0.7,max_tokens:2000,_password: AIChat._getPassword()})
    });
    if(!resp.ok)throw new Error("API "+resp.status);
    var text = (await resp.json()).choices[0].message.content;
    var m = text.match(/```(?:json)?\s*([\s\S]*?)```/);if(m)text=m[1].trim();
    var b1=text.indexOf("{"),b2=text.lastIndexOf("}");if(b1>=0&&b2>b1)text=text.substring(b1,b2+1);
    var route = JSON.parse(text);
    if(!route.days)route.days=[];if(!route.name)route.name="海南自由行";if(!route.type)route.type="经典";
    if(!route.budget){var d=route.days.length||3;route.budget={accommodation:d*400,food:d*350,transport:d*200,tickets:d*250,total:d*1200};}
    return route;
  },

  _localFallback(prompt) {
    var dm = prompt.match(/(\d+)\s*天/);var days = dm?parseInt(dm[1]):5;
    var type="经典";
    if(prompt.indexOf("亲子")>=0||prompt.indexOf("孩子")>=0||prompt.indexOf("一家")>=0)type="亲子";
    else if(prompt.indexOf("情侣")>=0||prompt.indexOf("蜜月")>=0||prompt.indexOf("浪漫")>=0)type="情侣";
    else if(prompt.indexOf("老人")>=0||prompt.indexOf("父母")>=0)type="老人";

    var cityMentions = [];var cityList = Object.keys(HainanMap.cities);
    cityList.forEach(function(c){if(prompt.indexOf(c)>=0)cityMentions.push(c);});
    if(cityMentions.length<2)cityMentions=["海口","万宁","三亚"];

    var routeDays=[];
    for(var i=0;i<Math.min(days,cityMentions.length+2);i++){
      var from=cityMentions[Math.min(i,cityMentions.length-1)];
      var to=(i+1<cityMentions.length)?cityMentions[i+1]:cityMentions[cityMentions.length-1];
      if(i===0){from=cityMentions[0];to=cityMentions.length>1?cityMentions[1]:cityMentions[0];}
      if(i>=cityMentions.length){from=cityMentions[cityMentions.length-1];to=cityMentions[cityMentions.length-1];}
      var nearbyAttrs = this.attractions.filter(function(a){return a.city===from||a.city===to;}).slice(0,2);
      routeDays.push({day:i+1,from:from,to:to,places:nearbyAttrs.map(function(a){return a.name;}),stay:(i===Math.min(days,cityMentions.length+2)-1?"返程":to)});
    }
    return {name:"海南"+days+"日"+type+"游",type:type,days:routeDays,tips:"本地引擎生成，仅供参考",budget:{accommodation:days*400,food:days*350,transport:days*200,tickets:days*250,total:days*1200}};
  },

  _showResult(route) {
    var rd = document.getElementById("planResult");if(!rd)return;
    var bv = [route.budget?route.budget.accommodation||0:0,route.budget?route.budget.food||0:0,route.budget?route.budget.transport||0:0,route.budget?route.budget.tickets||0:0,route.budget?route.budget.total||0:0];
    rd.innerHTML = '<div class="plan-result-header"><h4>🗺️ '+route.name+'</h4><p>'+route.type+' | '+route.days.length+'天</p>'+(route.tips?'<p class="plan-notes">💡 '+route.tips+'</p>':'')+'</div>'+
      '<div class="plan-result-days">'+route.days.map(function(d){return '<div class="plan-day-item"><div class="plan-day-num">Day '+d.day+'</div><div class="plan-day-content"><div class="plan-day-route">'+d.from+' → '+d.to+'</div><div class="plan-day-places">'+d.places.map(function(p){return '<span class="plan-place">📍 '+p+'</span>';}).join("")+'</div><div class="plan-day-stay">🏨 '+d.stay+'</div></div></div>';}).join("")+'</div>'+
      '<div class="plan-result-budget"><div class="budget-row"><span>🏨 住宿</span><span>¥'+Math.round(bv[0])+'</span></div><div class="budget-row"><span>🍜 餐饮</span><span>¥'+Math.round(bv[1])+'</span></div><div class="budget-row"><span>🚗 交通</span><span>¥'+Math.round(bv[2])+'</span></div><div class="budget-row"><span>🎫 门票</span><span>¥'+Math.round(bv[3])+'</span></div><div class="budget-row budget-total"><span>合计</span><span>¥'+Math.round(route.budget?route.budget.total||0:0)+'</span></div></div>'+
      '<div class="plan-actions"><button class="btn btn-primary" id="btnStartDemo">🚗 开始演示</button><button class="btn btn-secondary" id="btnRetry">🔄 换一条</button><button class="btn" id="btnDeleteRoute" style="background:rgba(255,68,68,0.1);border:1px solid #F44;color:#F44;">🗑️ 删除</button></div>';
    document.getElementById("btnStartDemo").addEventListener("click",function(){RoutePlanner.startDemo();});
    document.getElementById("btnRetry").addEventListener("click",function(){RouteAnimation.stopDemo();RoutePlanner.generate();});
    document.getElementById("btnDeleteRoute").addEventListener("click",function(){
      RouteAnimation.stopDemo();RoutePlanner.currentRoute=null;
      rd.innerHTML='<div style="text-align:center;padding:20px;color:#889;">🗑️ 已删除</div>';
      ContentDisplay.showStatus("🗑️ 路线已删除","info","mapStatus");
    });
    rd.scrollIntoView({behavior:"smooth"});
  },

  startDemo() {
    if(!this.currentRoute){ContentDisplay.showStatus("请先生成路线","info","mapStatus");return;}
    window.dispatchEvent(new CustomEvent("startRouteDemo",{detail:this.currentRoute}));
  },

  getCurrentRoute(){return this.currentRoute;},

  _saveHistory(route) {try{var key="hainan_route_history";var h=JSON.parse(localStorage.getItem(key)||"[]");h.unshift({name:route.name,type:route.type,days:route.days.length,budget:(route.budget?route.budget.total:0)||0,route:route,time:new Date().toLocaleString()});if(h.length>20)h.splice(20);localStorage.setItem(key,JSON.stringify(h));if(API.isServer()){API.saveRoutes(h).catch(function(){})}}catch(e){}},

  getHistory() {var h=[];try{h=JSON.parse(localStorage.getItem("hainan_route_history")||"[]");}catch(e){}return h;},

  showHistory(containerId) {
    containerId = containerId || "plannerPanel";
    var panel = document.getElementById(containerId);
    if(!panel)return;
    var h=this.getHistory();
    var qa=KnowledgeBase.history||[];
    var html = '<div class="planner-header"><h3>📋 全部记录</h3><button class="btn-close" onclick="document.getElementById(\''+containerId+'\').classList.remove(\'active\')">&times;</button></div><div class="knowledge-content">';
    html+='<div class="knowledge-section"><h4>🗺️ 路线记录 ('+h.length+')</h4>';
    if(h.length===0){html+='<div style="text-align:center;padding:12px;color:#889;">暂无记录</div>';}
    h.forEach(function(item,i){
      html+='<div class="plan-day-item" style="cursor:pointer;margin-bottom:6px;" onclick="RoutePlanner._loadHistory('+i+')"><div class="plan-day-content"><div style="font-weight:bold;color:#FFD700;">'+item.name+'</div><div style="font-size:12px;color:#889;">'+item.type+' | '+item.days+'天 | ¥'+item.budget+' | '+item.time+'</div></div><button style="background:none;border:none;color:#889;font-size:16px;cursor:pointer;" onclick="event.stopPropagation();RoutePlanner._delHistory('+i+')">🗑️</button></div>';
    });
    if(h.length>0)html+='<button class="btn btn-secondary btn-block" style="margin-top:8px;padding:6px;font-size:12px;" onclick="RoutePlanner.showPlanner()">🧭 新建规划</button>';
    html+='</div>';
    html+='<div class="knowledge-section" style="margin-top:20px;"><h4>💬 问答记录 ('+qa.length+')</h4>';
    if(qa.length===0){html+='<div style="text-align:center;padding:12px;color:#889;">暂无记录</div>';}
    else{
      html+='<div style="max-height:300px;overflow-y:auto;">';
      qa.forEach(function(q){
        var t=q.timestamp?new Date(q.timestamp).toLocaleString():"";
        html+='<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><div style="font-size:12px;color:#FFD700;">❓ '+q.question.substring(0,60)+'</div><div style="font-size:11px;color:#889;">💡 '+(q.answer||q.route||"").substring(0,80)+'</div><div style="font-size:10px;color:rgba(255,255,255,0.3);">'+t+'</div></div>';
      });
      html+='</div>';
    }
    html+='</div></div>';
    panel.innerHTML=html;
    panel.classList.add("active");
  },
_loadHistory(index) {
    var h=this.getHistory();
    if(index<0||index>=h.length)return;
    this.currentRoute=h[index].route;
    this.showPlanner();
    var self=this;
    setTimeout(function(){self._showResult(self.currentRoute);},200);
  },

  _delHistory(index) {
    var key="hainan_route_history";
    var h=JSON.parse(localStorage.getItem(key)||"[]");
    h.splice(index,1);
    localStorage.setItem(key,JSON.stringify(h));
    this.showHistory();
    ContentDisplay.showStatus("🗑️ 已删除","info","mapStatus");
  }
};
window.RoutePlanner = RoutePlanner;
