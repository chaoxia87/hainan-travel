// ai.js - DeepSeek AI问答 V1.0
const AIChat = {
  apiConfig: {
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    apiKey: null, // 密钥已移至服务器端
    model: "deepseek-chat",
    enabled: true
  },
  useProxy: function() { return true; }, // 强制走服务器代理（密钥安全）
  knowledge: null,
  attractions: null,
  conversationHistory: [],

  init() {
    this.knowledge = APP_DATA.knowledge;
    this.attractions = APP_DATA.attractions;
  },

  async ask(question) {
    this.conversationHistory.push({role:"user",content:question});
    if(this.apiConfig.enabled && this.apiConfig.apiKey){
      try{
        var answer=await this._callDeepSeek(question);
        this.conversationHistory.push({role:"assistant",content:answer});
        this._saveToKnowledge(question,answer);
        return answer;
      }catch(e){console.warn("DeepSeek API失败，回退本地:",e.message);}
    }
    var answer=this._localAnswer(question);
    this.conversationHistory.push({role:"assistant",content:answer});
    this._saveToKnowledge(question,answer);
    return answer;
  },

  async _callDeepSeek(question) {
    var names=this.attractions?this.attractions.slice(0,30).map(function(a){return a.name;}).join("、"):"三亚、海口、万宁等";
    var systemPrompt='你是海南旅游AI直播助手，在抖音直播间为观众解答海南旅游问题。风格：热情亲切口语化，先说结论再分条，每条带避坑提醒，简洁实用。海南热门景点：'+names;
    var resp=await fetch(this.apiConfig.endpoint,{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+this.apiConfig.apiKey},
      body:JSON.stringify({model:this.apiConfig.model,messages:[{role:"system",content:systemPrompt}].concat(this.conversationHistory.slice(-8)),temperature:0.7,max_tokens:800,stream:false})
    });
    if(!resp.ok){var t=await resp.text();throw new Error("API "+resp.status+": "+t);}
    var data=await resp.json();
    return data.choices[0].message.content;
  },

  _getPassword: function() {
    try { return sessionStorage.getItem("ai_access_pwd") || ""; } catch(e) { return ""; }
  },

  _localAnswer(question) {
    var q=question.toLowerCase();
    var tips=this.knowledge?this.knowledge.tips:{};
    if(q.indexOf("住")>=0||q.indexOf("酒店")>=0||q.indexOf("住宿")>=0||q.indexOf("民宿")>=0){
      var a="🏨 海南住宿建议\n\n";
      if(q.indexOf("三亚")>=0||q.indexOf("第一次")>=0){a+="亚龙湾：度假首选沙滩最好价格偏高\n大东海：交通方便性价比高\n三亚湾：看日落绝佳中档价格\n海棠湾：高端亲子亚特兰蒂斯\n";}
      else if(q.indexOf("海口")>=0){a+="骑楼老街：特色民宿南洋风情\n国贸商圈：商务酒店交通便利\n";}
      else{a+="三亚：亚龙湾(高端)、大东海(性价比)、三亚湾(日落)、海棠湾(亲子)\n海口：骑楼民宿(特色)、国贸酒店(商务)\n万宁：日月湾民宿(冲浪)、石梅湾(高端)\n陵水：清水湾(安静度假)\n";}
      return a+"\n⚠️ 旺季提前2周预订，平台比价再下单";
    }
    if(q.indexOf("吃")>=0||q.indexOf("美食")>=0||q.indexOf("海鲜")>=0){
      return "🍜 海南美食\n\n四大名菜：文昌鸡、加积鸭、东山羊、和乐蟹\n\n街头必吃：清补凉、椰子鸡、海南粉、陵水酸粉\n\n海鲜：去本地人去的海鲜市场（三亚第一市场、海口板桥路），买完找加工店\n\n⚠️ 景区大排档贵且宰客，称重注意沥水，先问单价再点";
    }
    if(q.indexOf("交通")>=0||q.indexOf("怎么去")>=0||q.indexOf("高铁")>=0||q.indexOf("租车")>=0){
      return "🚗 海南交通\n\n飞机：三亚凤凰+海口美兰，建议三亚进海口出不走回头路\n高铁：环岛高铁，海口→三亚约1.5小时\n自驾：高速免费（含油价），推荐东线\n\n⚠️ 机场别坐黑车，滴滴/高德叫车；租车选神州、一嗨";
    }
    if(q.indexOf("天气")>=0||q.indexOf("季节")>=0||q.indexOf("几月")>=0){
      return "🌤️ 海南天气\n\n最佳：11月-次年4月，舒适不闷热\n台风季：6-10月，出行前查天气\n\n⚠️ 海南紫外线超强！任何季节都要防晒、帽子、墨镜";
    }
    if(q.indexOf("亲子")>=0||q.indexOf("孩子")>=0||q.indexOf("一家")>=0){
      return "👨‍👩‍👧 亲子游\n\n海口→文昌航天城🚀→万宁→陵水分界洲岛🐬+猴岛🐒→三亚亚特兰蒂斯🧜\n\n⚠️ 减少赶路，每地多待一天；海边看好孩子；提前订亲子酒店";
    }
    if(q.indexOf("情侣")>=0||q.indexOf("蜜月")>=0||q.indexOf("浪漫")>=0){
      return "💑 情侣游\n\n三亚鹿回头看日落→后海村冲浪→蜈支洲岛拍照→天涯海角打卡\n万宁石梅湾人少清静，适合二人世界\n\n⚠️ 提前订海景房，旺季涨价严重";
    }
    if(q.indexOf("老人")>=0||q.indexOf("父母")>=0||q.indexOf("长辈")>=0){
      return "👴 老人游\n\n三亚南山寺→亚龙湾散步→三亚湾日落→陵水清水湾发呆\n减少爬山，每天≤2个景点\n\n⚠️ 带常用药品；防晒防暑；选有电梯酒店";
    }
    if(q.indexOf("避坑")>=0||q.indexOf("坑")>=0||q.indexOf("陷阱")>=0){
      var list=(tips["避坑总纲"]||["景区门口不买水果","不参加街头拉客一日游","水上项目在正规平台订","出租车不打表就投诉","买特产去大超市","路边珍珠水晶都是假的"]);
      return "⚠️ 避坑总纲\n\n"+list.map(function(t){return"• "+t;}).join("\n\n");
    }
    return "🌴 海南旅游助手\n\n我可以帮你：\n• 住宿：三亚/海口/万宁住哪？\n• 美食：吃什么？海鲜怎么不踩坑？\n• 交通：飞机/高铁/自驾怎么选\n• 亲子/情侣/老人：专属路线\n• 避坑：有哪些坑？\n• 路线：点击 🧭 AI规划 生成专属行程";
  },

  _saveToKnowledge(question, answer) {
    try{
      var history=JSON.parse(localStorage.getItem("knowledge_history")||"[]");
      history.push({question:question,answer:answer.substring(0,200),timestamp:new Date().toISOString()});
      if(history.length>100)history.splice(0,history.length-100);
      localStorage.setItem("knowledge_history",JSON.stringify(history));
    }catch(e){}
  }
};
AIChat.knowledge = null;
AIChat.attractions = null;
AIChat.conversationHistory = [];
window.AIChat = AIChat;
