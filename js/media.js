// media.js - 标注功能 V2.0 (跨浏览器持久化+管理面板)

var MediaDB = {
  db: null,
  open: function() {
    return new Promise(function(resolve){
      try{
        var req = indexedDB.open("HainanMediaDB", 1);
        req.onupgradeneeded = function(e) { var db = e.target.result; if (!db.objectStoreNames.contains("media")) db.createObjectStore("media", {keyPath:"id"}); };
        req.onsuccess = function(e) { MediaDB.db = e.target.result; resolve(true); };
        req.onerror = function() { console.warn("IndexedDB不可用"); resolve(false); };
      } catch(e) { resolve(false); }
    });
  },
  getAll: function() {
    return new Promise(function(resolve){
      if (!MediaDB.db) { resolve([]); return; }
      try { var tx = MediaDB.db.transaction("media","readonly"); var req = tx.objectStore("media").getAll(); req.onsuccess = function() { resolve(req.result || []); }; req.onerror = function() { resolve([]); }; } catch(e) { resolve([]); }
    });
  },
  put: function(item) { if (!MediaDB.db) return; try { var tx = MediaDB.db.transaction("media","readwrite"); tx.objectStore("media").put(item); } catch(e) {} },
  remove: function(id) { if (!MediaDB.db) return; try { var tx = MediaDB.db.transaction("media","readwrite"); tx.objectStore("media").delete(id); } catch(e) {} },
  clearAll: function() { if (!MediaDB.db) return; try { var tx = MediaDB.db.transaction("media","readwrite"); tx.objectStore("media").clear(); } catch(e) {} },
  putAll: async function(items) {
    if (!MediaDB.db) return;
    try { var tx = MediaDB.db.transaction("media","readwrite"); var store = tx.objectStore("media"); for (var i = 0; i < items.length; i++) { store.put(items[i]); } } catch(e) {}
  }
};

var MediaMarker = {
  map: null, mediaItems: [], mediaMarkers: [], active: false, popup: null,
  iconTypes: [
    { id: "camera", icon: "📷", label: "景点/拍照", color: "#FF69B4", bg: "linear-gradient(135deg,#FF69B4,#FF1493)", shadow: "rgba(255,105,180,0.55)" },
    { id: "food", icon: "🍜", label: "餐饮", color: "#FF8C00", bg: "linear-gradient(135deg,#FF8C00,#FF6347)", shadow: "rgba(255,140,0,0.55)" },
    { id: "hotel", icon: "🏨", label: "住宿", color: "#4FC3F7", bg: "linear-gradient(135deg,#4FC3F7,#0288D1)", shadow: "rgba(79,195,247,0.55)" },
    { id: "play", icon: "🏊", label: "游玩", color: "#66DD88", bg: "linear-gradient(135deg,#66DD88,#2E7D32)", shadow: "rgba(102,221,136,0.55)" }
  ],
  _getIconConfig: function(iconType) {
    var found = this.iconTypes.find(function(t) { return t.id === iconType; });
    return found || this.iconTypes[0];
  },
  STORAGE_KEY: "hainan_annotations_meta",

  async init(map) {
    var self = this;
    this.map = map;
    await MediaDB.open();

    // 多源合并：IndexedDB(含完整媒体) > localStorage(轻量元数据) > 嵌入数据
    var dbItems = await MediaDB.getAll();
    var lsItems = [];
    try { lsItems = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "[]"); } catch(e) {}
    var embeddedItems = (window.APP_DATA && window.APP_DATA.annotations) ? window.APP_DATA.annotations : [];

    // 用 Map 按 id 去重合并，IndexedDB 优先级最高
    var merged = new Map();
    embeddedItems.forEach(function(item) { merged.set(item.id, item); });
    lsItems.forEach(function(item) { 
      var existing = merged.get(item.id);
      merged.set(item.id, existing ? Object.assign({}, existing, item) : item);
    });
    dbItems.forEach(function(item) { merged.set(item.id, item); });

    this.mediaItems = Array.from(merged.values());
    if (API.isServer()) { try { var serverItems = await API.loadMedia(); var sm = new Map(); serverItems.forEach(function(it) { sm.set(it.id, it); }); this.mediaItems.forEach(function(it) { var sv = sm.get(it.id); if (!sv) sm.set(it.id, it); else if (sv.imgData && !it.imgData) { it.imgData = sv.imgData; it.vidData = sv.vidData; } }); this.mediaItems = Array.from(sm.values()); API.saveMedia(this.mediaItems); MediaDB.putAll(this.mediaItems); } catch(e) {} }
    // 如果 IndexedDB

    // 如果 IndexedDB 缺少数据，同步回 IndexedDB
    if (this.mediaItems.length > dbItems.length) {
      await MediaDB.putAll(this.mediaItems);
    }
    this._saveMeta();

    // 渲染所有标注
    this.mediaItems.forEach(function(item) { self._createMarker(item); });

    if (this.mediaItems.length > 0) {
      console.log("✅ 恢复 " + this.mediaItems.length + " 个标注 (DB:" + dbItems.length + " LS:" + lsItems.length + " EMB:" + embeddedItems.length + ")");
      var b = document.getElementById("btnMediaDelAll"); if (b) b.style.display = "inline-flex";
      var b2 = document.getElementById("btnMediaList"); if (b2) b2.style.display = "inline-flex";
    }
  },

  _saveMeta: function() {
    // 保存轻量元数据到 localStorage
    var self = this;
    var meta = this.mediaItems.map(function(item) {
      return { id: item.id, lng: item.lng, lat: item.lat, title: item.title, desc: item.desc, iconType: item.iconType || "camera", hasImg: !!item.imgData, hasVid: !!item.vidData };
    });
    try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(meta)); } catch(e) {}
  },

  startAddMode: function() { this.active = true; this.map.getCanvas().style.cursor = "cell"; ContentDisplay.showStatus("📷 点击地图添加图片/视频（自动保存，换浏览器也不丢）", "info", "mapStatus"); },
  addAtPosition: function(lng, lat) { if (!this.active) return; this.active = false; this.map.getCanvas().style.cursor = ""; this._showDialog(lng, lat, null); },
  cancelAddMode: function() { this.active = false; this.map.getCanvas().style.cursor = ""; },

  editItem: function(id) {
    var idx = this.mediaItems.findIndex(function(i) { return i.id === id; });
    if (idx < 0) return;
    var item = this.mediaItems[idx];
    if (this.popup) this.popup.remove();
    this._showDialog(item.lng, item.lat, item);
  },

  _showDialog: function(lng, lat, editItem) {
    var old = document.getElementById("mediaUploadDialog"); if (old) old.remove();
    var d = document.createElement("div"); d.id = "mediaUploadDialog";
    var isEdit = !!editItem;
    var currentIconType = (isEdit && editItem.iconType) ? editItem.iconType : "camera";
    d.innerHTML = '<div class="media-dialog-overlay" onclick="document.getElementById(\'mediaUploadDialog\').remove()"></div>' +
      '<div class="media-dialog"><div class="media-dialog-header"><h4>' + (isEdit ? '✏️ 编辑' : '📷 添加') + '媒体标注</h4><button class="btn-close" onclick="document.getElementById(\'mediaUploadDialog\').remove()">&times;</button></div>' +
      '<div class="media-dialog-body"><input type="hidden" id="mediaEditId" value="' + (isEdit ? editItem.id : '') + '">' +
      '<input type="hidden" id="mediaIconType" value="' + currentIconType + '">' +
      '<div class="form-group"><label>🏷️ 标签类型</label><div class="icon-type-selector" id="iconTypeSelector">' +
      this.iconTypes.map(function(t) {
        var sel = t.id === currentIconType ? 'style="border:3px solid #FFD700;transform:scale(1.15);"' : 'style="border:2px solid rgba(255,255,255,0.2);"';
        return '<button class="icon-type-btn" data-type="' + t.id + '" ' + sel + ' title="' + t.label + '" onclick="MediaMarker._selectIconType(this,\'' + t.id + '\')"><span style="font-size:22px;">' + t.icon + '</span><span style="font-size:9px;display:block;margin-top:1px;">' + t.label + '</span></button>';
      }).join("") + '</div></div>' +
      '<div class="form-group"><label>📍 坐标</label><input value="' + lng.toFixed(4) + ', ' + lat.toFixed(4) + '" disabled></div>' +
      '<div class="form-group"><label>📝 标题</label><input type="text" id="mediaTitle" value="' + (isEdit ? editItem.title : '') + '" placeholder="景点名称"></div>' +
      '<div class="form-group"><label>📄 描述</label><textarea id="mediaDesc" rows="2" placeholder="简单介绍...">' + (isEdit && editItem.desc ? editItem.desc : '') + '</textarea></div>' +
      '<div class="form-group"><label>🖼️ 图片' + (isEdit && editItem.imgData ? '（已有，可更换）' : '') + '</label><input type="file" id="mediaImage" accept="image/*" onchange="MediaMarker._preview(this,\'img\')"></div>' +
      '<div id="imgPre" style="display:' + (isEdit && editItem.imgData ? 'block' : 'none') + ';text-align:center;margin:6px 0;"><img id="imgPreEl" src="' + (isEdit && editItem.imgData ? editItem.imgData : '') + '" style="max-width:180px;max-height:120px;border-radius:8px;"></div>' +
      '<div class="form-group"><label>🎬 视频' + (isEdit && editItem.vidData ? '（已有，可更换）' : '') + '</label><input type="file" id="mediaVideo" accept="video/*" onchange="MediaMarker._preview(this,\'vid\')"></div>' +
      '<div id="vidPre" style="display:' + (isEdit && editItem.vidData ? 'block' : 'none') + ';text-align:center;margin:6px 0;"><video id="vidPreEl" src="' + (isEdit && editItem.vidData ? editItem.vidData : '') + '" controls style="max-width:100%;max-height:120px;border-radius:8px;"></video></div>' +
      '<button class="btn btn-primary btn-block" onclick="MediaMarker._saveFromDialog()" style="margin-top:8px;">' + (isEdit ? '💾 更新' : '✅ 保存') + '（自动持久化）</button></div></div>';
    document.body.appendChild(d);
  },

  _selectIconType: function(btn, iconType) {
    document.getElementById("mediaIconType").value = iconType;
    var buttons = document.querySelectorAll("#iconTypeSelector .icon-type-btn");
    buttons.forEach(function(b) {
      b.style.border = "2px solid rgba(255,255,255,0.2)";
      b.style.transform = "scale(1)";
    });
    btn.style.border = "3px solid #FFD700";
    btn.style.transform = "scale(1.15)";
  },

  _preview: function(input, type) {
    var f = input.files[0]; if (!f) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      if (type === "img") { document.getElementById("imgPre").style.display = "block"; document.getElementById("imgPreEl").src = e.target.result; }
      else { document.getElementById("vidPre").style.display = "block"; document.getElementById("vidPreEl").src = e.target.result; }
    };
    reader.readAsDataURL(f);
  },

  _saveFromDialog: function() {
    var editId = parseInt(document.getElementById("mediaEditId").value || "0");
    var iconTypeEl = document.getElementById("mediaIconType"); var iconType = iconTypeEl ? iconTypeEl.value : "camera";
    var titleEl = document.getElementById("mediaTitle"); var title = titleEl ? titleEl.value.trim() : "未命名标注";
    var descEl = document.getElementById("mediaDesc"); var desc = descEl ? descEl.value.trim() : "";
    var imgFile = document.getElementById("mediaImage").files[0];
    var vidFile = document.getElementById("mediaVideo").files[0];
    var isEdit = editId > 0;
    var self = this;

    // 获取坐标
    var lng, lat;
    if (isEdit) {
      var ex = this.mediaItems.find(function(i) { return i.id === editId; });
      if (!ex) return; lng = ex.lng; lat = ex.lat;
    } else {
      var coordEl = document.querySelector("#mediaUploadDialog input[disabled]");
      var parts = coordEl.value.split(",").map(parseFloat);
      lng = parts[0]; lat = parts[1];
    }

    var done = function(imgData, vidData) {
      if (isEdit) {
        var idx = self.mediaItems.findIndex(function(i) { return i.id === editId; });
        if (idx >= 0) {
          var item = self.mediaItems[idx];
          item.title = title; item.desc = desc; item.iconType = iconType;
          if (imgData !== undefined) item.imgData = imgData;
          if (vidData !== undefined) item.vidData = vidData;
          if (self.mediaMarkers[idx]) self.mediaMarkers[idx].remove();
          self._createMarker(item, idx);
          MediaDB.put(item);
        }
      } else {
        var item = { id: Date.now(), lng: lng, lat: lat, title: title, desc: desc, iconType: iconType, imgData: imgData || null, vidData: vidData || null };
        self.mediaItems.push(item);
        self._createMarker(item);
        MediaDB.put(item);
      }
      self._saveMeta();
      var dlg = document.getElementById("mediaUploadDialog"); if (dlg) dlg.remove();
      var b = document.getElementById("btnMediaDelAll"); if (b) b.style.display = "inline-flex";
      var b2 = document.getElementById("btnMediaList"); if (b2) b2.style.display = "inline-flex";
      ContentDisplay.showStatus("✅ 「" + title + "」已" + (isEdit ? "更新" : "添加") + "（换浏览器导出导入即可恢复）", "success", "mapStatus");
    };

    var imgData = undefined, vidData = undefined, pending = 0;
    var check = function() { pending--; if (pending <= 0) done(imgData, vidData); };

    if (imgFile) { pending++; var r1 = new FileReader(); r1.onload = function(e) { imgData = e.target.result; check(); }; r1.readAsDataURL(imgFile); }
    if (vidFile) { pending++; var r2 = new FileReader(); r2.onload = function(e) { vidData = e.target.result; check(); }; r2.readAsDataURL(vidFile); }

    if (pending === 0) {
      if (isEdit) { var existing = self.mediaItems.find(function(i) { return i.id === editId; }); done(existing ? existing.imgData : null, existing ? existing.vidData : null); }
      else { done(null, null); }
    }
  },

  _createMarker: function(item, replaceIdx) {
    var el = document.createElement("div");
    var cfg = this._getIconConfig(item.iconType || "camera");
    var el = document.createElement("div");
    el.style.cssText = "width:34px;height:34px;background:" + cfg.bg + ";border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;box-shadow:0 2px 14px " + cfg.shadow + ";transition:all 0.25s;";
    el.innerHTML = cfg.icon;
    el.title = item.title + " [" + cfg.label + "]";
    el.dataset.iconType = item.iconType || "camera";

    var sColor = cfg.shadow;
    el.addEventListener("mouseenter", function() {
      el.style.width = "42px";
      el.style.height = "42px";
      el.style.fontSize = "20px";
      el.style.boxShadow = "0 0 22px " + sColor.replace("0.55", "0.9") + ",0 4px 18px " + sColor;
      el.style.zIndex = "100";
    });
    el.addEventListener("mouseleave", function() {
      el.style.width = "34px";
      el.style.height = "34px";
      el.style.fontSize = "15px";
      el.style.boxShadow = "0 2px 14px " + sColor;
      el.style.zIndex = "";
    });

    var marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([item.lng, item.lat]).addTo(this.map);
    if (replaceIdx !== undefined) { this.mediaMarkers[replaceIdx] = marker; }
    else { this.mediaMarkers.push(marker); }

    var self = this;
    el.addEventListener("click", function(ev) {
      ev.stopPropagation();
      if (self.popup) self.popup.remove();
      self.popup = new maplibregl.Popup({ offset: 18, maxWidth: "400px", className: "media-popup" })
        .setLngLat([item.lng, item.lat]).setHTML(self._popupHTML(item)).addTo(self.map);
    });
  },

  _popupHTML: function(item) {
    var h = '<div style="min-width:260px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
      '<div style="font-size:15px;font-weight:bold;color:#FFD700;">' + MediaMarker._getIconConfig(item.iconType||"camera").icon + ' ' + item.title + ' <span style="font-size:10px;color:#889;background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;">' + MediaMarker._getIconConfig(item.iconType||"camera").label + '</span></div>' +
      '<div style="display:flex;gap:5px;">' +
      '<button onclick="MediaMarker.editItem(' + item.id + ')" style="background:rgba(0,212,255,0.15);border:1px solid #0DF;color:#0DF;padding:4px 10px;border-radius:8px;font-size:10px;cursor:pointer;">✏️ 编辑</button>' +
      '<button onclick="MediaMarker._del(' + item.id + ')" style="background:rgba(255,68,68,0.15);border:1px solid #F44;color:#F44;padding:4px 10px;border-radius:8px;font-size:10px;cursor:pointer;">🗑️</button>' +
      '</div></div>';
    if (item.imgData) h += '<div style="text-align:center;margin:6px 0;"><img src="' + item.imgData + '" style="max-width:100%;max-height:260px;border-radius:10px;"></div>';
    if (item.vidData) h += '<div style="margin:6px 0;"><video controls style="max-width:100%;max-height:220px;border-radius:10px;" src="' + item.vidData + '"></video></div>';
    if (item.desc) h += '<div style="font-size:12px;color:#ccc;line-height:1.5;margin-top:4px;">' + item.desc + '</div>';
    if (!item.imgData && !item.vidData && !item.desc) h += '<div style="text-align:center;color:#889;padding:8px;">📭 点击 ✏️ 添加媒体</div>';
    h += '</div>';
    return h;
  },

  _del: function(id) {
    var idx = this.mediaItems.findIndex(function(i) { return i.id === id; });
    if (idx >= 0) {
      this.mediaItems.splice(idx, 1);
      if (this.mediaMarkers[idx]) this.mediaMarkers[idx].remove();
      this.mediaMarkers.splice(idx, 1);
      if (this.popup) this.popup.remove();
      MediaDB.remove(id);
      this._saveMeta();
      if (this.mediaItems.length === 0) {
        var b = document.getElementById("btnMediaDelAll"); if (b) b.style.display = "none";
        var b2 = document.getElementById("btnMediaList"); if (b2) b2.style.display = "none";
      }
      ContentDisplay.showStatus("🗑️ 已删除", "info", "mapStatus");
    }
  },

  deleteAll: async function() {
    var n = this.mediaItems.length; if (n === 0) { ContentDisplay.showStatus("没有标注", "info", "mapStatus"); return; }
    if (!confirm("确定删除全部 " + n + " 个标注？此操作不可撤销。")) return;
    this.mediaMarkers.forEach(function(m) { m.remove(); }); this.mediaMarkers = [];
    this.mediaItems = [];
    if (this.popup) this.popup.remove();
    await MediaDB.clearAll();
    try { localStorage.removeItem("hainan_annotations_meta"); } catch(e) {}
    var b = document.getElementById("btnMediaDelAll"); if (b) b.style.display = "none";
    var b2 = document.getElementById("btnMediaList"); if (b2) b2.style.display = "none";
    ContentDisplay.showStatus("🗑️ 已删除 " + n + " 个", "info", "mapStatus");
  },

  // === 标注管理面板 ===
  showListPanel: function() {
    var old = document.getElementById("mediaListPanel"); if (old) old.remove();
    var self = this;
    var d = document.createElement("div"); d.id = "mediaListPanel";
    d.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:50;backdrop-filter:blur(3px);";

    var html = '<div style="background:rgba(10,15,30,0.96);border:1px solid rgba(255,255,255,0.1);border-radius:12px;max-height:75vh;overflow-y:auto;width:440px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.1);position:sticky;top:0;background:rgba(10,15,30,0.96);z-index:1;">';
    html += '<h3 style="font-size:16px;">📋 标注管理 (' + this.mediaItems.length + ')</h3>';
    html += '<div style="display:flex;gap:6px;">';
    html += '<button class="btn btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="MediaMarker._exportAll()">📥 导出备份</button>';
    html += '<button class="btn btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="MediaMarker._importAll()">📤 导入恢复</button>';
    html += '<button style="background:none;border:none;color:#889;font-size:22px;cursor:pointer;" onclick="document.getElementById(\'mediaListPanel\').remove()">&times;</button>';
    html += '</div></div>';
    html += '<div style="padding:12px;">';

    if (this.mediaItems.length === 0) {
      html += '<div style="text-align:center;padding:30px;color:#889;">📭 暂无标注<br><small>点击 📷标注 按钮开始添加</small></div>';
    } else {
      html += '<div style="font-size:12px;color:#889;margin-bottom:10px;padding:8px;background:rgba(255,215,0,0.05);border-radius:8px;">💡 换浏览器后，点击 <b>📥 导出备份</b> 保存文件，再 <b>📤 导入恢复</b> 即可恢复所有标注（含图片视频）</div>';
      this.mediaItems.forEach(function(item, i) {
        html += '<div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:4px;background:rgba(255,255,255,0.02);">' +
          '<div style="width:50px;height:38px;flex-shrink:0;border-radius:6px;overflow:hidden;background:rgba(255,105,180,0.1);display:flex;align-items:center;justify-content:center;font-size:20px;">' +
          (item.imgData ? '<img src="' + item.imgData + '" style="width:100%;height:100%;object-fit:cover;">' : (item.vidData ? '🎬' : '📷')) +
          '</div>' +
          '<div style="flex:1;min-width:0;">' +
          '<div style="font-weight:bold;font-size:13px;color:#FFD700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + item.title + '</div>' +
          '<div style="font-size:11px;color:#889;">' + item.lng.toFixed(4) + ', ' + item.lat.toFixed(4) + ' | ' + (item.imgData ? '🖼️' : '') + ' ' + (item.vidData ? '🎬' : '') + ' ' + (!item.imgData && !item.vidData ? '📭' : '') + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:4px;flex-shrink:0;">' +
          '<button onclick="HainanMap.flyTo(' + item.lng + ',' + item.lat + ',15);document.getElementById(\'mediaListPanel\').remove();" style="background:rgba(0,212,255,0.1);border:1px solid #0DF;color:#0DF;padding:4px 8px;border-radius:6px;font-size:10px;cursor:pointer;" title="飞到标注位置">📍</button>' +
          '<button onclick="MediaMarker.editItem(' + item.id + ');document.getElementById(\'mediaListPanel\').remove();" style="background:rgba(0,212,255,0.1);border:1px solid #0DF;color:#0DF;padding:4px 8px;border-radius:6px;font-size:10px;cursor:pointer;">✏️</button>' +
          '<button onclick="MediaMarker._del(' + item.id + ');MediaMarker.showListPanel();" style="background:rgba(255,68,68,0.1);border:1px solid #F44;color:#F44;padding:4px 8px;border-radius:6px;font-size:10px;cursor:pointer;">🗑️</button>' +
          '</div></div>';
      });
    }
    html += '</div></div>';
    d.innerHTML = html;

    d.addEventListener("click", function(e) { if (e.target === d) d.remove(); });
    document.body.appendChild(d);
  },

  _exportAll: function() {
    var data = JSON.stringify(this.mediaItems, null, 2);
    var blob = new Blob([data], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url;
    a.download = "hainan-annotations-" + new Date().toISOString().split("T")[0] + ".json";
    a.click(); URL.revokeObjectURL(url);
    ContentDisplay.showStatus("✅ 已导出 " + this.mediaItems.length + " 个标注（含图片视频）", "success", "mapStatus");
  },

  _importAll: function() {
    var input = document.createElement("input"); input.type = "file"; input.accept = ".json";
    var self = this;
    input.onchange = async function(e) {
      var file = e.target.files[0]; if (!file) return;
      var text = await file.text();
      try {
        var items = JSON.parse(text);
        if (!Array.isArray(items)) throw new Error("格式错误：不是数组");
        // 清除现有
        self.mediaMarkers.forEach(function(m) { m.remove(); }); self.mediaMarkers = [];
        await MediaDB.clearAll();
        // 导入新数据
        self.mediaItems = items;
        await MediaDB.putAll(items);
        self._saveMeta();
        items.forEach(function(item) { self._createMarker(item); });
        var b = document.getElementById("btnMediaDelAll"); if (b) b.style.display = "inline-flex";
        var b2 = document.getElementById("btnMediaList"); if (b2) b2.style.display = "inline-flex";
        if (document.getElementById("mediaListPanel")) self.showListPanel();
        ContentDisplay.showStatus("✅ 已导入 " + items.length + " 个标注（含图片视频）", "success", "mapStatus");
      } catch (err) {
        ContentDisplay.showStatus("❌ 导入失败: " + err.message, "info", "mapStatus");
      }
    };
    input.click();
  }
};

window.MediaMarker = MediaMarker;
