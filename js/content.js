// content.js - 内容展示 V1.0
const ContentDisplay = {
  showAttractionCard(attraction, containerId) {
    containerId = containerId || "attractionCard";
    var card = document.getElementById(containerId);
    if (!card || !attraction) return;
    var stars = HainanMap.getStarRating(attraction.score);
    var tagsHTML = attraction.tags.map(function(t){return '<span class="tag">'+t+'</span>';}).join("");
    card.innerHTML = '<div class="card-header"><div class="card-type-badge">'+attraction.type+'</div><button class="card-close" onclick="ContentDisplay.closeCard()">&times;</button></div>'+
      '<div class="card-body"><h2 class="card-title">'+attraction.name+'</h2>'+
      '<div class="card-city">📍 '+attraction.city+'</div>'+
      '<div class="card-rating"><span>推荐：</span><span class="stars">'+stars+'</span></div>'+
      '<div class="card-tags">'+tagsHTML+'</div>'+
      '<div class="card-section"><div class="card-section-title">📖 介绍</div><p class="card-intro">'+attraction.intro+'</p></div>'+
      (attraction.warning?'<div class="card-section card-warning"><div class="card-section-title">⚠️ 避坑</div><p>'+attraction.warning+'</p></div>':'')+
      '</div>';
    card.classList.add("active");
  },

  closeCard(containerId) { containerId = containerId || "attractionCard"; var c=document.getElementById(containerId); if(c)c.classList.remove("active"); },

  showAIResponse(text, containerId) {
    containerId = containerId || "aiMessages";
    var c = document.getElementById(containerId); if(!c)return;
    var d=document.createElement("div");d.className="ai-message ai-response";
    d.innerHTML='<div class="ai-avatar">🤖</div><div class="ai-bubble">'+this._fmt(text)+'</div>';
    c.appendChild(d);c.scrollTop=c.scrollHeight;
  },

  showUserMessage(text, containerId) {
    containerId = containerId || "aiMessages";
    var c=document.getElementById(containerId);if(!c)return;
    var d=document.createElement("div");d.className="ai-message user-message";
    d.innerHTML='<div class="ai-bubble">'+text+'</div><div class="ai-avatar">👤</div>';
    c.appendChild(d);c.scrollTop=c.scrollHeight;
  },

  showTyping(containerId) {
    containerId = containerId || "aiMessages";
    var c=document.getElementById(containerId);if(!c)return;
    var d=document.createElement("div");d.className="ai-message ai-response typing";d.id="typingIndicator";
    d.innerHTML='<div class="ai-avatar">🤖</div><div class="ai-bubble"><span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></div>';
    c.appendChild(d);c.scrollTop=c.scrollHeight;
  },
  removeTyping() { var e=document.getElementById("typingIndicator");if(e)e.remove(); },
  _fmt(t) { return t.replace(/\n/g,"<br>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>"); },

  showStatus(text, type, containerId) {
    type = type || "info"; containerId = containerId || "mapStatus";
    var el=document.getElementById(containerId);if(!el)return;
    el.textContent=text;el.className="status-bar "+type;el.style.display="block";
    if(type!=="loading")setTimeout(function(){el.style.display="none";},4000);
  }
};
window.ContentDisplay = ContentDisplay;
