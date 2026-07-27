// knowledge.js - 知识库 V1.0
const KnowledgeBase = {
  knowledge: null, history: [],

  init() {
    this.knowledge = APP_DATA.knowledge;
    this._loadHistory();
  },

  saveQA(question, answer, route) {
    route = route || "";
    this.history.unshift({question:question,answer:answer.substring(0,300),route:route,timestamp:new Date().toISOString()});
    if(this.history.length>200)this.history.pop();
    this._saveHistory();
  },

  getDailySummary() {
    var today=new Date().toISOString().split("T")[0];
    var todayE=this.history.filter(function(h){return h.timestamp.startsWith(today);});
    var freq={};
    todayE.forEach(function(e){var k=e.question.substring(0,12);freq[k]=(freq[k]||0)+1;});
    var popular=Object.entries(freq).sort(function(a,b){return b[1]-a[1];}).slice(0,5).map(function(entry){return entry[1]+"次 - "+entry[0]+"...";});
    var newRoutes=Array.from(new Set(todayE.filter(function(e){return e.route;}).map(function(e){return e.route;})));
    return{date:today,totalQuestions:todayE.length,popularQuestions:popular,newRoutes:newRoutes,totalHistory:this.history.length};
  },

  showPanel(containerId) {
    containerId = containerId || "knowledgePanel";
    var panel=document.getElementById(containerId);
    if(!panel)return;
    var s=this.getDailySummary();
    var tipsList=(this.knowledge&&this.knowledge.tips&&this.knowledge.tips["避坑总纲"])||["景区不买水果","不参加拉客一日游","水上项目正规平台订","不打表就投诉","特产去大超市","珍珠水晶都是假的"];

    var html='<div class="knowledge-header"><h3>📚 知识库</h3><button class="btn-close" onclick="document.getElementById(\''+containerId+'\').classList.remove(\'active\')">&times;</button></div>';
    html+='<div class="knowledge-content">';
    html+='<div class="knowledge-section"><h4>📊 今日数据</h4><p>总问答：<strong>'+s.totalQuestions+'</strong></p><p>累计记录：<strong>'+s.totalHistory+'</strong></p></div>';

    if(s.popularQuestions.length){
      html+='<div class="knowledge-section"><h4>🔥 今日热门</h4><ol class="popular-list">';
      s.popularQuestions.forEach(function(p){html+='<li>'+p+'</li>';});
      html+='</ol></div>';
    }

    if(s.newRoutes.length){
      html+='<div class="knowledge-section"><h4>🗺️ 今日路线</h4><ul class="route-list">';
      s.newRoutes.forEach(function(r){html+='<li>'+r+'</li>';});
      html+='</ul></div>';
    }

    try{
      var rh=JSON.parse(localStorage.getItem("hainan_route_history")||"[]").slice(0,3);
      if(rh.length){
        html+='<div class="knowledge-section"><h4>🗺️ 最近路线</h4><ul class="route-list" style="max-height:160px;overflow-y:auto;">';
        rh.forEach(function(r,i){
          html+='<li style="cursor:pointer;padding:4px 0;" onclick="RoutePlanner._loadHistory('+i+')">'+r.name+' ('+r.type+', '+r.days+'天)</li>';
        });
        html+='</ul><button class="btn btn-secondary btn-block" style="margin-top:6px;padding:4px 8px;font-size:11px;" onclick="document.getElementById(\'knowledgePanel\').classList.remove(\'active\');RoutePlanner.showHistory()">📋 查看全部记录</button></div>';
      }
    }catch(e){}

    html+='<div class="knowledge-section"><h4>💡 避坑总纲</h4><ul class="tips-list">';
    tipsList.forEach(function(t){html+='<li>⚠️ '+t+'</li>';});
    html+='</ul></div>';

    html+='<button class="btn btn-secondary btn-block" onclick="KnowledgeBase.exportData()">📥 导出数据</button>';
    html+='</div>';
    panel.innerHTML=html;
    panel.classList.add("active");
  },

  exportData() {
    var blob=new Blob([JSON.stringify({history:this.history,summary:this.getDailySummary(),exportTime:new Date().toISOString()},null,2)],{type:"application/json"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");a.href=url;a.download="hainan-knowledge-"+new Date().toISOString().split("T")[0]+".json";a.click();
    URL.revokeObjectURL(url);
    ContentDisplay.showStatus("✅ 数据已导出","success","mapStatus");
  },

  _loadHistory(){if(API.isServer()){var self=this;API.loadKnowledge().then(function(d){if(d&&d.length){self.history=d;}}).catch(function(){});}try{var s=localStorage.getItem("knowledge_history");if(s){var localHistory=JSON.parse(s);if(localHistory.length>this.history.length)this.history=localHistory;}}catch(e){}},
  _saveHistory(){try{localStorage.setItem("knowledge_history",JSON.stringify(this.history));}catch(e){}if(API.isServer()){API.saveKnowledge(this.history).catch(function(){})}}
};
window.KnowledgeBase = KnowledgeBase;
