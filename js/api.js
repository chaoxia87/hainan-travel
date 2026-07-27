// api.js - API适配器 (自动识别本地/云端)
var API = {
  // 判断是否在服务器上运行
  isServer: function() {
    return window.location.protocol === "http:" || window.location.protocol === "https:";
  },

  baseURL: function() {
    return this.isServer() ? "" : "http://localhost:3000";
  },

  // 媒体标注
  async loadMedia() {
    if (!this.isServer()) {
      try { return JSON.parse(localStorage.getItem("hainan_media_items") || "[]"); } catch(e) { return []; }
    }
    try {
      var resp = await fetch(this.baseURL() + "/api/media");
      return await resp.json();
    } catch(e) { console.warn("API loadMedia failed:", e.message); return []; }
  },

  async saveMedia(data) {
    if (!this.isServer()) {
      try { localStorage.setItem("hainan_media_items", JSON.stringify(data)); } catch(e) {}
      return;
    }
    try {
      await fetch(this.baseURL() + "/api/media", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      });
    } catch(e) { console.warn("API saveMedia failed:", e.message); }
  },

  // 知识点
  async loadKnowledge() {
    if (!this.isServer()) {
      try { return JSON.parse(localStorage.getItem("knowledge_history") || "[]"); } catch(e) { return []; }
    }
    try {
      var resp = await fetch(this.baseURL() + "/api/knowledge");
      return await resp.json();
    } catch(e) { console.warn("API loadKnowledge failed:", e.message); return []; }
  },

  async saveKnowledge(data) {
    if (!this.isServer()) {
      try { localStorage.setItem("knowledge_history", JSON.stringify(data)); } catch(e) {}
      return;
    }
    try {
      await fetch(this.baseURL() + "/api/knowledge", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      });
    } catch(e) { console.warn("API saveKnowledge failed:", e.message); }
  },

  // 路线历史
  async loadRoutes() {
    if (!this.isServer()) {
      try { return JSON.parse(localStorage.getItem("hainan_route_history") || "[]"); } catch(e) { return []; }
    }
    try {
      var resp = await fetch(this.baseURL() + "/api/routes");
      return await resp.json();
    } catch(e) { console.warn("API loadRoutes failed:", e.message); return []; }
  },

  async saveRoutes(data) {
    if (!this.isServer()) {
      try { localStorage.setItem("hainan_route_history", JSON.stringify(data)); } catch(e) {}
      return;
    }
    try {
      await fetch(this.baseURL() + "/api/routes", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      });
    } catch(e) { console.warn("API saveRoutes failed:", e.message); }
  },

  // 文件上传
  async uploadFile(file) {
    if (!this.isServer()) {
      // 本地模式：转base64
      return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    var formData = new FormData();
    formData.append("file", file);
    try {
      var resp = await fetch(this.baseURL() + "/api/upload", { method: "POST", body: formData });
      var data = await resp.json();
      return data.url;
    } catch(e) { console.warn("Upload failed:", e.message); return null; }
  },

  getFileURL(path) {
    if (!path) return "";
    if (path.startsWith("data:") || path.startsWith("http")) return path;
    return this.isServer() ? path : path;
  }
};

window.API = API;
