// camera.js - 相机控制 V2.1 (GCJ02修正)
const CameraController = {
  map: null,
  init(map) { this.map = map; },

  async playOpeningAnimation() {
    var m = this.map;
    var g1 = CoordConvert.wgs84ToGcj02(109.7, 18.8);
    var g2 = CoordConvert.wgs84ToGcj02(109.55, 18.3);
    m.jumpTo({center:g1,zoom:7.5,pitch:30,bearing:0});
    await this._sleep(400);
    m.flyTo({center:g1,zoom:8.5,pitch:52,bearing:5,duration:2000});
    await this._sleep(1000);
    m.flyTo({center:g2,zoom:10.5,pitch:58,bearing:15,duration:2000});
    await this._sleep(800);
    m.flyTo({center:g1,zoom:8.8,pitch:52,bearing:5,duration:1500});
  },

  flyToHainanOverview() {
    var g = CoordConvert.wgs84ToGcj02(109.7, 18.8);
    this.map.flyTo({center:g,zoom:8.5,pitch:52,bearing:5,duration:2000});
  },

  followCar(lng, lat) {
    var z = Math.max(this.map.getZoom(), 10);
    var g = CoordConvert.wgs84ToGcj02(lng, lat);
    this.map.flyTo({center:g,zoom:z,pitch:50,duration:800});
  },

  flyBetween(flng, flat, tlng, tlat) {
    var d = Math.sqrt(Math.pow(tlng-flng,2)+Math.pow(tlat-flat,2));
    var g = CoordConvert.wgs84ToGcj02((flng+tlng)/2, (flat+tlat)/2);
    this.map.flyTo({center:g,zoom:Math.min(10,13-d*3),pitch:50,duration:1500});
  },

  _sleep(ms) { return new Promise(function(r){setTimeout(r,ms);}); }
};
window.CameraController = CameraController;
