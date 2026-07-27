// api.js - API适配器 (自动识别本地/云端，故障回退)
var API = {
  _serverChecked: false,
  _serverAvailable: false,

  // 检测服务器是否可用（缓存结果）
  async checkServer() {
    if (this._serverChecked) return this._serverAvailable;
    this._serverChecked = true;
    try {
      var resp = await fetch("/api/health", { method: "GET", signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        var data = await resp.json();
        this._serverAvailable = data.status === "ok";
      }
    } catch(e) {
      this._serverAvailable = false;
    }
    return this._serverAvailable;
  },

  // 判断是否在服务器上运行
  isServer: function() {
    return window.location.protocol === "http:" || window.location.protocol === "https:";
  },

  baseURL: function() {
    return this.isServer() ? "" : "http://localhost:3000";
  },

  // 媒体标注
  async loadMedia() {
    if (this.isServer()) {
      try {
        var resp = await fetch(this.baseURL() + "/api/media");
        if (resp.ok) return await resp.json();
      } catch(e) { console.warn("API loadMedia failed, fallback to local:", e.message); }
    }
    try { return JSON.parse(localStorage.getItem("hainan_media_items") || "[]"); } catch(e) { return []; }
  },

  async saveMedia(data) {
    // 始终保存到本地
    try { localStorage.setItem("hainan_media_items", JSON.stringify(data)); } catch(e) {}
    // 如果服务器可用，同步
    if (this.isServer()) {
      try {
        await fetch(this.baseURL() + "/api/media", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
        });
      } catch(e) { console.warn("API saveMedia sync failed:", e.message); }
    }
  },

  // 知识点
  async loadKnowledge() {
    if (this.isServer()) {
      try {
        var resp = await fetch(this.baseURL() + "/api/knowledge");
        if (resp.ok) return await resp.json();
      } catch(e) { console.warn("API loadKnowledge failed, fallback:", e.message); }
    }
    try { return JSON.parse(localStorage.getItem("knowledge_history") || "[]"); } catch(e) { return []; }
  },

  async saveKnowledge(data) {
    try { localStorage.setItem("knowledge_history", JSON.stringify(data)); } catch(e) {}
    if (this.isServer()) {
      try {
        await fetch(this.baseURL() + "/api/knowledge", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
        });
      } catch(e) { console.warn("API saveKnowledge sync failed:", e.message); }
    }
  },

  // 路线历史
  async loadRoutes() {
    if (this.isServer()) {
      try {
        var resp = await fetch(this.baseURL() + "/api/routes");
        if (resp.ok) return await resp.json();
      } catch(e) { console.warn("API loadRoutes failed, fallback:", e.message); }
    }
    try { return JSON.parse(localStorage.getItem("hainan_route_history") || "[]"); } catch(e) { return []; }
  },

  async saveRoutes(data) {
    try { localStorage.setItem("hainan_route_history", JSON.stringify(data)); } catch(e) {}
    if (this.isServer()) {
      try {
        await fetch(this.baseURL() + "/api/routes", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
        });
      } catch(e) { console.warn("API saveRoutes sync failed:", e.message); }
    }
  },

  // 文件上传
  async uploadFile(file) {
    if (this.isServer()) {
      try {
        var formData = new FormData();
        formData.append("file", file);
        var resp = await fetch(this.baseURL() + "/api/upload", { method: "POST", body: formData });
        if (resp.ok) {
          var data = await resp.json();
          return data.url;
        }
      } catch(e) { console.warn("Upload to server failed, using local:", e.message); }
    }
    // 本地模式或服务器失败：转base64
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  getFileURL(path) {
    if (!path) return "";
    if (path.startsWith("data:") || path.startsWith("http")) return path;
    return path;
  }
};

window.API = API;
