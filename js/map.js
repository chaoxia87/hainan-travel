// map.js - 海南地图核心 V2.1 (高德卫星+GCJ02修正)
// WGS84 -> GCJ02 坐标转换
var CoordConvert = {
  PI: 3.141592653589793,
  a: 6378245.0,
  ee: 0.00669342162296594323,
  _transformLat: function(x, y) {
    var ret = -100.0 + 2.0*x + 3.0*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x));
    ret += (20.0*Math.sin(6.0*x*this.PI) + 20.0*Math.sin(2.0*x*this.PI)) * 2.0/3.0;
    ret += (20.0*Math.sin(y*this.PI) + 40.0*Math.sin(y/3.0*this.PI)) * 2.0/3.0;
    ret += (160.0*Math.sin(y/12.0*this.PI) + 320.0*Math.sin(y*this.PI/30.0)) * 2.0/3.0;
    return ret;
  },
  _transformLng: function(x, y) {
    var ret = 300.0 + x + 2.0*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x));
    ret += (20.0*Math.sin(6.0*x*this.PI) + 20.0*Math.sin(2.0*x*this.PI)) * 2.0/3.0;
    ret += (20.0*Math.sin(x*this.PI) + 40.0*Math.sin(x/3.0*this.PI)) * 2.0/3.0;
    ret += (150.0*Math.sin(x/12.0*this.PI) + 300.0*Math.sin(x/30.0*this.PI)) * 2.0/3.0;
    return ret;
  },
  wgs84ToGcj02: function(lng, lat) {
    if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lng, lat];
    var dlat = this._transformLat(lng - 105.0, lat - 35.0);
    var dlng = this._transformLng(lng - 105.0, lat - 35.0);
    var radlat = lat / 180.0 * this.PI;
    var magic = Math.sin(radlat);
    magic = 1 - this.ee * magic * magic;
    var sqrtmagic = Math.sqrt(magic);
    dlat = (dlat * 180.0) / ((this.a * (1 - this.ee)) / (magic * sqrtmagic) * this.PI);
    dlng = (dlng * 180.0) / (this.a / sqrtmagic * Math.cos(radlat) * this.PI);
    return [lng + dlng, lat + dlat];
  }
};

const HainanMap = {
  map: null, attractions: [], warnModeActive: false,
  drawing: { active: false, points: [], markers: [] },
  eraseMode: false,
  pen: { active: false, strokes: [], currentCoords: [], strokeCount: 0, color: "#FF3333", isDrawing: false },
  cities: {
    "海口":[110.330,20.030],"文昌":[110.790,19.610],"琼海":[110.460,19.240],
    "万宁":[110.390,18.800],"陵水":[110.030,18.500],"三亚":[109.510,18.250],
    "五指山":[109.690,18.880],"儋州":[109.580,19.520],"东方":[108.650,19.100],
    "乐东":[109.170,18.650],"保亭":[109.700,18.640],"琼中":[109.840,19.030],
    "澄迈":[110.000,19.740],"临高":[109.690,19.910],"昌江":[109.050,19.260],
    "定安":[110.350,19.680],"屯昌":[110.100,19.360],"白沙":[109.440,19.230]
  },

  init(containerId) {
    var self = this;
    this.map = new maplibregl.Map({
      container: containerId,
      style: { version:8,
        sources:{
          "amap-sat":{type:"raster",tiles:[
            "https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
            "https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
            "https://webst03.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
            "https://webst04.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}"
          ],tileSize:256},
          "amap-rd":{type:"raster",tiles:[
            "https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
            "https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
            "https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
            "https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
          ],tileSize:256}
        },
        layers:[
          {id:"amap-sat-layer",type:"raster",source:"amap-sat"},
          {id:"amap-rd-layer",type:"raster",source:"amap-rd"}
        ]
      },
      center:[109.7,19.0],zoom:8.5,minZoom:1.5,maxZoom:18,pitch:52,bearing:5,attributionControl:false
    });
    this.map.addControl(new maplibregl.NavigationControl({showCompass:true,visualizePitch:true}),"bottom-right");
    this.map.addControl(new maplibregl.ScaleControl({unit:"metric"}),"bottom-left");
    var attrEl = document.createElement("div");
    attrEl.style.cssText = "position:absolute;bottom:4px;left:100px;z-index:2;font-size:10px;color:rgba(255,255,255,0.4);pointer-events:none;";
    attrEl.textContent = "© 高德地图";
    document.getElementById(containerId).appendChild(attrEl);
    this.map.on("click","attraction-circles",function(e){
      if(!e.features||!e.features[0])return;
      var idx=e.features[0].properties.attrIndex;
      if(idx!==undefined){var a=self.attractions[idx];self.flyTo(a.lng,a.lat,13);ContentDisplay.showAttractionCard(a);}
    });
    return this.map;
  },

  loadAttractions(){this.attractions=APP_DATA.attractions;return this.attractions;},

  addAttractionMarkers(){
    this.clearMarkers();
    var features = [];
    for (var i = 0; i < this.attractions.length; i++) {
      var a = this.attractions[i];
      var gcj = CoordConvert.wgs84ToGcj02(a.lng, a.lat);
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: gcj },
        properties: { attrIndex: i, name: a.name, score: a.score, color: HainanMap.getTypeColor(a.type) }
      });
    }
    var gj = { type: "FeatureCollection", features: features };
    this.map.addSource("attractions-src",{type:"geojson",data:gj});
    this.map.addLayer({id:"attraction-circles",type:"circle",source:"attractions-src",
      paint:{"circle-radius":["+",3,["*",["get","score"],0.8]],"circle-color":["get","color"],"circle-stroke-width":1,"circle-stroke-color":"#fff","circle-opacity":0.85}});
    this.map.addLayer({id:"attraction-glow",type:"circle",source:"attractions-src",
      paint:{"circle-radius":["+",6,["*",["get","score"],1.5]],"circle-color":["get","color"],"circle-opacity":0.08,"circle-blur":1}});
  },

  addCityLabels(){
    var self=this;
    document.querySelectorAll(".city-label-marker").forEach(function(e){e.remove();});
    Object.entries(this.cities).forEach(function(entry){
      var n=entry[0],c=entry[1];
      var gcj = CoordConvert.wgs84ToGcj02(c[0], c[1]);
      var el=document.createElement("div");el.className="city-label-marker";
      el.innerHTML='<span style="background:rgba(10,15,30,0.92);border:2px solid #FFD700;color:#FFD700;padding:4px 10px;border-radius:16px;font-size:13px;font-weight:bold;white-space:nowrap;box-shadow:0 2px 10px rgba(255,215,0,0.3);">'+n+'</span>';
      new maplibregl.Marker({element:el.children[0],anchor:"center"}).setLngLat(gcj).addTo(self.map);
    });
  },

  clearMarkers(){try{this.map.removeLayer("attraction-glow")}catch(e){}try{this.map.removeLayer("attraction-circles")}catch(e){}try{this.map.removeSource("attractions-src")}catch(e){}},
  
  getTypeColor(t){
    var c={"海岛":"#00D4FF","海滩":"#FFD700","海岸":"#FF8C00","海湾":"#00CED1","雨林":"#32CD32","山景":"#8B4513","文化":"#DA70D6","公园":"#98FB98","乐园":"#FF1493","购物":"#FF6347","地质":"#A0522D","植物园":"#2E8B57","科技":"#4169E1","影视":"#9370DB","生态":"#3CB371","自然":"#228B22","河流":"#4682B4","漂流":"#00BFFF","度假":"#FF69B4","半岛":"#20B2AA","椰林":"#6B8E23","古镇":"#D2691E","森林":"#228B22","温泉":"#FF69B4","美食":"#FF6347","沙滩":"#FFD700"};
    return c[t]||"#00D4FF";
  },

  getStarRating(s){var r="";for(var i=0;i<5;i++)r+=i<s?"★":"☆";return r;},

  flyToCity(n){
    var c=this.cities[n];
    if(c){var gcj=CoordConvert.wgs84ToGcj02(c[0],c[1]);this.map.flyTo({center:gcj,zoom:11,pitch:58,duration:1500});}
  },

  flyTo(lng,lat,z){
    z=z||14;
    var gcj=CoordConvert.wgs84ToGcj02(lng,lat);
    this.map.flyTo({center:gcj,zoom:z,pitch:55,duration:1500});
  },

  setView(lng,lat,z){
    z=z||9;
    var gcj=CoordConvert.wgs84ToGcj02(lng,lat);
    this.map.jumpTo({center:gcj,zoom:z,pitch:52});
  },

  enableWarnMode(){this.warnModeActive=true;try{this.map.setPaintProperty("attraction-circles","circle-stroke-color","#FF4444");this.map.setPaintProperty("attraction-circles","circle-stroke-width",2.5)}catch(e){}},
  disableWarnMode(){this.warnModeActive=false;try{this.map.setPaintProperty("attraction-circles","circle-stroke-color","#fff");this.map.setPaintProperty("attraction-circles","circle-stroke-width",1)}catch(e){}},

  // Drawing tool
  startDrawing(){
    this.eraseMode=false;this.drawing.active=true;this.drawing.points=[];this.drawing.markers=[];
    this.map.getCanvas().style.cursor="crosshair";
    this._showEraseButtons(true);
    ContentDisplay.showStatus("点击地图加路径点，右键完成","info","mapStatus");
  },
  addDrawPoint(lng,lat){
    if(!this.drawing.active)return;
    this.drawing.points.push([lng,lat]);
    var n=this.drawing.points.length;
    var el=document.createElement("div");
    el.style.cssText="width:20px;height:20px;background:#FFD700;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;color:#000;cursor:pointer;";
    el.textContent=n;el.dataset.index=this.drawing.markers.length;
    el.addEventListener("click",function(ev){ev.stopPropagation();if(HainanMap.eraseMode)HainanMap._removeSinglePoint(parseInt(this.dataset.index));});
    var m=new maplibregl.Marker({element:el,anchor:"center"}).setLngLat([lng,lat]).addTo(this.map);
    this.drawing.markers.push({marker:m,el:el,lng:lng,lat:lat});this._updateDrawLine();
    ContentDisplay.showStatus("点"+n+" | 右键完成 | 消除逐点删 | 全清一键删","info","mapStatus");
  },
  _updateDrawLine(){
    try{this.map.removeLayer("draw-line");this.map.removeSource("draw-line")}catch(e){}
    if(this.drawing.points.length>=2){
      this.map.addSource("draw-line",{type:"geojson",data:{type:"Feature",geometry:{type:"LineString",coordinates:this.drawing.points}}});
      this.map.addLayer({id:"draw-line",type:"line",source:"draw-line",paint:{"line-color":"#FF3333","line-width":5}});
    }
  },
  finishDrawing(){
    this.drawing.active=false;this.map.getCanvas().style.cursor="";
    if(this.drawing.points.length>0)this._showEraseButtons(true);
  },
  toggleEraseMode(){
    this.eraseMode=!this.eraseMode;
    if(this.eraseMode){this.map.getCanvas().style.cursor="pointer";ContentDisplay.showStatus("消除中：点击路径点逐个删除 | 再点退出","info","mapStatus")}
    else{this.map.getCanvas().style.cursor="";ContentDisplay.showStatus("已退出消除","info","mapStatus")}
  },
  _removeSinglePoint(index){
    if(index<0||index>=this.drawing.markers.length)return;
    this.drawing.markers[index].marker.remove();this.drawing.markers.splice(index,1);
    this.drawing.points=this.drawing.markers.map(function(m){return[m.lng,m.lat];});
    this.drawing.markers.forEach(function(item,i){item.el.textContent=i+1;item.el.dataset.index=i;});
    this._updateDrawLine();
    if(this.drawing.points.length===0){this.eraseMode=false;this._showEraseButtons(false);}
    ContentDisplay.showStatus("剩余"+this.drawing.points.length+"个点","info","mapStatus");
  },
  clearAllDrawing(){
    this.eraseMode=false;this.drawing.active=false;
    this.drawing.markers.forEach(function(m){m.marker.remove();});this.drawing.markers=[];
    try{this.map.removeLayer("draw-line");this.map.removeSource("draw-line")}catch(e){}
    this.drawing.points=[];this.map.getCanvas().style.cursor="";
    this._showEraseButtons(false);
    var be=document.getElementById("btnErase");if(be){be.classList.remove("active");be.textContent="消除";}
    ContentDisplay.showStatus("全部圈画已清除","info","mapStatus");
  },
  _showEraseButtons(show){
    var be=document.getElementById("btnErase"),ba=document.getElementById("btnEraseAll");
    if(be)be.style.display=show?"inline-flex":"none";
    if(ba)ba.style.display=show?"inline-flex":"none";
    if(!show){this.eraseMode=false;}
  },

  // Pen tool (自由画笔)
  startPen(){
    this.pen.active = true; this.pen.isDrawing = false; this.pen.currentCoords = [];
    this.map.getCanvas().style.cursor = "crosshair";
    this.map.dragPan.disable();
    ContentDisplay.showStatus("🖌️ 画笔模式 | 按住左键绘制 | 松开完成一笔 | Esc退出","info","mapStatus");
    var bar = document.getElementById("penToolbar");
    if(bar) bar.style.display = "flex";
  },
  finishPen(){
    this.pen.active = false; this.pen.isDrawing = false; this.pen.currentCoords = [];
    this.map.getCanvas().style.cursor = "";
    this.map.dragPan.enable();
    var bar = document.getElementById("penToolbar");
    if(bar) bar.style.display = "none";
    ContentDisplay.showStatus("","info","mapStatus");
  },
  _onPenDown(e){
    if(!this.pen.active) return;
    e.originalEvent.preventDefault();
    this.pen.isDrawing = true;
    this.pen.currentCoords = [[e.lngLat.lng, e.lngLat.lat]];
  },
  _onPenMove(e){
    if(!this.pen.active || !this.pen.isDrawing) return;
    this.pen.currentCoords.push([e.lngLat.lng, e.lngLat.lat]);
    // 实时预览：更新临时线
    try{this.map.removeLayer("pen-temp");this.map.removeSource("pen-temp")}catch(ex){}
    if(this.pen.currentCoords.length >= 2){
      this.map.addSource("pen-temp",{type:"geojson",data:{type:"Feature",geometry:{type:"LineString",coordinates:this.pen.currentCoords}}});
      this.map.addLayer({id:"pen-temp",type:"line",source:"pen-temp",paint:{"line-color":this.pen.color,"line-width":4,"line-opacity":0.8},layout:{"line-cap":"round","line-join":"round"}});
    }
  },
  _onPenUp(e){
    if(!this.pen.active || !this.pen.isDrawing) return;
    this.pen.isDrawing = false;
    try{this.map.removeLayer("pen-temp");this.map.removeSource("pen-temp")}catch(ex){}
    if(this.pen.currentCoords.length >= 2){
      this._addPenStroke(this.pen.currentCoords.slice());
    }
    this.pen.currentCoords = [];
  },
  _addPenStroke(coords){
    this.pen.strokeCount++;
    var sid = "pen-stroke-" + this.pen.strokeCount;
    var lid = "pen-layer-" + this.pen.strokeCount;
    this.map.addSource(sid,{type:"geojson",data:{type:"Feature",geometry:{type:"LineString",coordinates:coords}}});
    this.map.addLayer({id:lid,type:"line",source:sid,paint:{"line-color":this.pen.color,"line-width":4,"line-opacity":0.85},layout:{"line-cap":"round","line-join":"round"}});
    this.pen.strokes.push({sourceId:sid,layerId:lid,color:this.pen.color});
    ContentDisplay.showStatus("🖌️ 已画 "+this.pen.strokes.length+" 笔 | Ctrl+Z撤销 | Esc退出","info","mapStatus");
  },
  undoPenStroke(){
    if(this.pen.strokes.length === 0) return;
    var s = this.pen.strokes.pop();
    try{this.map.removeLayer(s.layerId)}catch(e){}
    try{this.map.removeSource(s.sourceId)}catch(e){}
    ContentDisplay.showStatus("🖌️ 撤销一笔，剩余 "+this.pen.strokes.length+" 笔","info","mapStatus");
  },
  clearAllPen(){
    while(this.pen.strokes.length > 0){
      var s = this.pen.strokes.pop();
      try{this.map.removeLayer(s.layerId)}catch(e){}
      try{this.map.removeSource(s.sourceId)}catch(e){}
    }
    this.pen.strokeCount = 0;
    try{this.map.removeLayer("pen-temp");this.map.removeSource("pen-temp")}catch(e){}
    ContentDisplay.showStatus("🖌️ 画笔已全部清除","info","mapStatus");
  },
  setPenColor(color){
    this.pen.color = color;
    ContentDisplay.showStatus("🖌️ 画笔颜色: "+color,"info","mapStatus");
  },
  getDrawnRoute(){return this.drawing.points.slice();}
};
window.HainanMap = HainanMap;
