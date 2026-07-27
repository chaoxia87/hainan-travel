// routeAnimation.js - V2.1 (GCJ02修正)
var RouteAnimation = {
  map: null, carMarker: null, routeLines: [], stopMarkers: [],
  animating: false, paused: false, currentDayIdx: 0, route: null,
  osrmCache: {},

  init: function(map) { this.map = map; window.addEventListener("startRouteDemo", function(e) { RouteAnimation.startDemo(e.detail); }); },

  _getOSRMRoute: async function(fromLng, fromLat, toLng, toLat) {
    var key = fromLng.toFixed(3) + "," + fromLat.toFixed(3) + "-" + toLng.toFixed(3) + "," + toLat.toFixed(3);
    if (this.osrmCache[key]) return this.osrmCache[key];
    try {
      var url = "https://router.project-osrm.org/route/v1/driving/" + fromLng + "," + fromLat + ";" + toLng + "," + toLat + "?geometries=geojson&overview=full&alternatives=false";
      var resp = await fetch(url);
      var data = await resp.json();
      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        var coords = data.routes[0].geometry.coordinates;
        this.osrmCache[key] = coords;
        return coords;
      }
    } catch (e) { console.warn("OSRM请求失败:", e.message); }
    var fallback = [[fromLng, fromLat], [toLng, toLat]];
    this.osrmCache[key] = fallback;
    return fallback;
  },

  _convertCoords: function(coords) {
    var result = [];
    for (var i = 0; i < coords.length; i++) {
      result.push(CoordConvert.wgs84ToGcj02(coords[i][0], coords[i][1]));
    }
    return result;
  },

  startDemo: async function(route) {
    if (this.animating) { this.stopDemo(); await this._sleep(300); }
    this.animating = true; this.paused = false;
    this.route = route; this.currentDayIdx = 0;
    this.clearRoute(); this._showControls(); this._updateControls();
    CameraController.flyToHainanOverview();
    ContentDisplay.showStatus("🗺️ " + route.name + " | 加载路线...", "info", "mapStatus");
    await this._sleep(1200);

    for (var i = 0; i < route.days.length; i++) {
      if (!this.animating) break;
      this.currentDayIdx = i; this._updateControls();
      var day = route.days[i];
      var fromWgs = HainanMap.cities[day.from], toWgs = HainanMap.cities[day.to];
      if (!fromWgs || !toWgs) continue;

      var fromGcj = CoordConvert.wgs84ToGcj02(fromWgs[0], fromWgs[1]);
      var toGcj = CoordConvert.wgs84ToGcj02(toWgs[0], toWgs[1]);

      ContentDisplay.showStatus("🚫 Day" + day.day + " " + day.from + " → " + day.to + " | 加载路线...", "info", "mapStatus");

      // OSRM路由用WGS84，显示用GCJ02
      var routeWgs = await this._getOSRMRoute(fromWgs[0], fromWgs[1], toWgs[0], toWgs[1]);
      var routeGcj = this._convertCoords(routeWgs);
      
      this._addStopMarker(fromGcj, "🆝 Day" + day.day + " 出发");

      var sid = "route-" + i;
      this.map.addSource(sid, { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: routeGcj } } });
      this.map.addLayer({ id: sid, type: "line", source: sid, paint: { "line-color": "#FF3333", "line-width": 5, "line-opacity": 0.85 }, layout: { "line-cap": "round", "line-join": "round" } });
      this.routeLines.push(sid);

      CameraController.flyBetween(fromWgs[0], fromWgs[1], toWgs[0], toWgs[1]);
      await this._sleep(500);

      if (!this.carMarker) this._createCar(fromGcj[0], fromGcj[1]);
      else this.carMarker.setLngLat(fromGcj);
      await this._sleep(300);

      ContentDisplay.showStatus("🚫 Day" + day.day + " " + day.from + " → " + day.to + " | 行驶中...", "info", "mapStatus");
      await this._animatePath(routeGcj, day);
      if (!this.animating) break;

      this._addStopMarker(toGcj, "🏫 Day" + day.day + " 到达 " + day.to);
      await this._sleep(1200);

      if (day.places.length > 0) {
        var attr = HainanMap.attractions.find(function(a) { return a.name === day.places[0]; });
        if (attr) ContentDisplay.showAttractionCard(attr);
        ContentDisplay.showStatus("📍 Day" + day.day + " | " + day.places.join("、"), "success", "mapStatus");
      }
      await this._sleep(2500);
      ContentDisplay.closeCard();

      this.stopMarkers.forEach(function(m) { m.remove(); });
      this.stopMarkers = [];
    }

    if (this.animating) {
      CameraController.flyToHainanOverview();
      ContentDisplay.showStatus("✅ 演示完成！点 🔧 重播", "success", "mapStatus");
    }
    this.animating = false;
  },

  stopDemo: function() { this.animating = false; this.paused = false; this.clearRoute(); ContentDisplay.showStatus("⏹ 已停止", "info", "mapStatus"); },
  playPause: function() { this.paused = !this.paused; this._updateControls(); },
  nextDay: function() {
    if (!this.route || this.currentDayIdx >= this.route.days.length - 1) return;
    this.stopDemo();
    var self = this;
    setTimeout(function() { self.startDemo({ name: self.route.name, type: self.route.type, days: self.route.days.slice(self.currentDayIdx + 1) }); }, 300);
  },
  prevDay: function() {
    if (!this.route || this.currentDayIdx <= 0) return;
    this.stopDemo();
    var self = this;
    setTimeout(function() { self.startDemo({ name: self.route.name, type: self.route.type, days: self.route.days.slice(self.currentDayIdx - 1) }); }, 300);
  },
  replay: function() {
    if (!this.route) return;
    var r = this.route;
    this.stopDemo();
    var self = this;
    setTimeout(function() { self.startDemo(r); }, 300);
  },

  _createCar: function(lng, lat) {
    var el = document.createElement("div");
    el.innerHTML = '<div style="text-align:center;">' +
      '<div style="background:rgba(0,0,0,0.8);color:#FFD700;display:inline-block;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:bold;margin-bottom:2px;">🏖️ 旅行中</div><br>' +
      '<div style="display:inline-block;position:relative;">' +
        '<span style="font-size:20px;position:absolute;top:-18px;left:2px;z-index:2;">👨</span>' +
        '<span style="font-size:20px;position:absolute;top:-18px;left:22px;z-index:2;">👩</span>' +
        '<span style="font-size:16px;position:absolute;top:-10px;left:44px;z-index:2;">👧</span>' +
        '<svg width="100" height="50" viewBox="0 0 100 50" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5));">' +
          '<defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFE566"/><stop offset="50%" stop-color="#FFD700"/><stop offset="100%" stop-color="#E6B800"/></linearGradient></defs>' +
          '<rect x="5" y="12" width="90" height="22" rx="10" fill="url(#cg)" stroke="#C9A000" stroke-width="1.5"/>' +
          '<rect x="25" y="5" width="30" height="14" rx="6" fill="#87CEEB" opacity="0.7" stroke="#C9A000" stroke-width="0.8"/>' +
          '<circle cx="8" cy="14" r="3" fill="#FFE566" stroke="#C9A000" stroke-width="0.5"/>' +
          '<rect x="12" y="16" width="14" height="7" rx="3" fill="#FFE566" stroke="#C9A000" stroke-width="0.5"/>' +
          '<circle cx="20" cy="22" r="2" fill="#333"/>' +
          '<rect x="72" y="14" width="14" height="7" rx="3" fill="#FF4444" opacity="0.8"/>' +
          '<circle cx="20" cy="36" r="9" fill="#333" stroke="#555" stroke-width="2"/>' +
          '<circle cx="20" cy="36" r="5" fill="#666"/>' +
          '<circle cx="78" cy="36" r="9" fill="#333" stroke="#555" stroke-width="2"/>' +
          '<circle cx="78" cy="36" r="5" fill="#666"/>' +
          '<rect x="4" y="28" width="94" height="5" rx="2" fill="#C9A000"/>' +
          '<circle cx="86" cy="14" r="3" fill="#FF4444"/>' +
          '<circle cx="92" cy="14" r="3" fill="#FFE566"/>' +
        '</svg>' +
      '</div></div>';
    this.carMarker = new maplibregl.Marker({ element: el.children[0], anchor: "bottom", offset: [0, -4] }).setLngLat([lng, lat]).addTo(this.map);
  },

  _addStopMarker: function(coord, label) {
    var el = document.createElement("div");
    el.style.cssText = "width:14px;height:14px;background:#00D4FF;border:2px solid #fff;border-radius:50%;box-shadow:0 0 10px #00D4FF;";
    this.stopMarkers.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(coord).addTo(this.map));
    if (label) {
      var p = new maplibregl.Popup({ offset: 8, closeButton: false, closeOnClick: false })
        .setLngLat(coord).setHTML('<span style="font-size:13px;font-weight:bold;">' + label + '</span>').addTo(this.map);
      this.stopMarkers.push({ remove: function() { p.remove(); } });
    }
  },

  _animatePath: async function(coords, day) {
    var totalPts = coords.length;
    if (totalPts < 2) return;
    
    var maxSteps = Math.min(150, Math.max(80, totalPts));
    var step = Math.max(1, Math.floor(totalPts / maxSteps));
    var sampledCoords = [];
    for (var i = 0; i < totalPts; i += step) {
      sampledCoords.push(coords[i]);
    }
    if (sampledCoords[sampledCoords.length - 1] !== coords[totalPts - 1]) {
      sampledCoords.push(coords[totalPts - 1]);
    }
    
    var stepDelay = 30, lastCheckpoint = -1;
    for (var s = 0; s < sampledCoords.length; s++) {
      while (this.paused && this.animating) await this._sleep(200);
      if (!this.animating) return;
      var pt = sampledCoords[s];
      this.carMarker.setLngLat(pt);
      if (s % 10 === 0) {
        // pt is already GCJ02, don't double-convert
        var z = Math.max(this.map.getZoom(), 10);
        this.map.flyTo({center:pt, zoom:z, pitch:50, duration:800});
      }
      var progress = s / sampledCoords.length;
      var ci = Math.floor(progress * day.places.length);
      if (ci > lastCheckpoint && day.places[ci]) {
        lastCheckpoint = ci;
        var attr = HainanMap.attractions.find(function(a) { return a.name === day.places[ci]; });
        if (attr) {
          var gcjPt = CoordConvert.wgs84ToGcj02(attr.lng, attr.lat);
          var pel = document.createElement("div");
          pel.style.cssText = "background:rgba(0,0,0,0.88);color:#FFD700;padding:4px 12px;border-radius:14px;font-size:12px;font-weight:bold;white-space:nowrap;border:1px solid rgba(255,215,0,0.3);";
          pel.textContent = "📍 " + attr.name;
          var tm = new maplibregl.Marker({ element: pel, anchor: "bottom", offset: [0, -30] }).setLngLat(gcjPt).addTo(this.map);
          this.stopMarkers.push(tm);
          ContentDisplay.showStatus("📍 途经: " + attr.name, "info", "mapStatus");
          setTimeout(function() { tm.remove(); }, 3000);
        }
      }
      await this._sleep(stepDelay);
    }
  },

  clearRoute: function() {
    var self = this;
    this.routeLines.forEach(function(id) { try { self.map.removeLayer(id); self.map.removeSource(id); } catch (e) {} });
    this.routeLines = [];
    this.stopMarkers.forEach(function(m) { m.remove(); }); this.stopMarkers = [];
    if (this.carMarker) { this.carMarker.remove(); this.carMarker = null; }
  },

  _showControls: function() {
    var bar = document.getElementById("animControlBar");
    if (!bar) {
      bar = document.createElement("div"); bar.id = "animControlBar";
      bar.innerHTML = '<div class="anim-controls">' +
        '<button id="btnPrev" class="anim-btn" title="上一天"><span>⏮</span></button>' +
        '<button id="btnPlay" class="anim-btn" title="暂停/播放"><span>⏯</span></button>' +
        '<button id="btnNext" class="anim-btn" title="下一天"><span>⏭</span></button>' +
        '<button id="btnReplay" class="anim-btn" title="重新播放"><span>🔧</span></button>' +
        '<button id="btnStop" class="anim-btn anim-stop" title="停止"><span>⏹</span></button>' +
        '<span id="animDayInfo" class="anim-day-info"></span></div>';
      document.getElementById("app").appendChild(bar);
      document.getElementById("btnPlay").addEventListener("click", function() { RouteAnimation.playPause(); });
      document.getElementById("btnPrev").addEventListener("click", function() { RouteAnimation.prevDay(); });
      document.getElementById("btnNext").addEventListener("click", function() { RouteAnimation.nextDay(); });
      document.getElementById("btnReplay").addEventListener("click", function() { RouteAnimation.replay(); });
      document.getElementById("btnStop").addEventListener("click", function() { RouteAnimation.stopDemo(); });
    }
    bar.style.display = "flex";
  },
  _updateControls: function() {
    var i = document.getElementById("animDayInfo"), p = document.getElementById("btnPlay");
    if (i && this.route) i.textContent = "Day" + (this.currentDayIdx + 1) + "/" + this.route.days.length;
    if (p) p.innerHTML = "<span>" + (this.paused ? "▶" : "⏸") + "</span>";
  },
  _sleep: function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
};
window.RouteAnimation = RouteAnimation;
