// server.js - 澶у摜寮熸梾娓歌鍒?鍚庣鏈嶅姟鍣?const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "sk-61f271bb50984baca6dfc0a101bf730e";
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/v1/chat/completions";

// 鏁版嵁瀛樺偍鐩綍
const DATA_DIR = path.join(__dirname, "server_data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
[ DATA_DIR, UPLOADS_DIR ].forEach(function(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// 鏁版嵁鏂囦欢璺緞
const MEDIA_FILE = path.join(DATA_DIR, "media.json");
const KNOWLEDGE_FILE = path.join(DATA_DIR, "knowledge.json");
const ROUTES_FILE = path.join(DATA_DIR, "routes.json");

// 璇诲彇/鍐欏叆JSON
function readJSON(filepath) {
  try { return JSON.parse(fs.readFileSync(filepath, "utf-8")); } catch(e) { return null; }
}
function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
}

// 鍒濆鍖栨暟鎹枃浠?if (!readJSON(MEDIA_FILE)) writeJSON(MEDIA_FILE, []);
if (!readJSON(KNOWLEDGE_FILE)) writeJSON(KNOWLEDGE_FILE, []);
if (!readJSON(ROUTES_FILE)) writeJSON(ROUTES_FILE, []);

// 涓棿浠?app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.static(__dirname));

// 鏂囦欢涓婁紶閰嶇疆
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: function(req, file, cb) {
    cb(null, Date.now() + "-" + encodeURIComponent(file.originalname));
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 200 * 1024 * 1024 } });

// ============ API 璺敱 ============

// 濯掍綋鏍囨敞 API
app.get("/api/media", function(req, res) {
  res.json(readJSON(MEDIA_FILE) || []);
});
app.post("/api/media", function(req, res) {
  writeJSON(MEDIA_FILE, req.body);
  res.json({ success: true });
});

// 鐭ヨ瘑鐐?API
app.get("/api/knowledge", function(req, res) {
  res.json(readJSON(KNOWLEDGE_FILE) || []);
});
app.post("/api/knowledge", function(req, res) {
  writeJSON(KNOWLEDGE_FILE, req.body);
  res.json({ success: true });
});

// 璺嚎鍘嗗彶 API
app.get("/api/routes", function(req, res) {
  res.json(readJSON(ROUTES_FILE) || []);
});
app.post("/api/routes", function(req, res) {
  writeJSON(ROUTES_FILE, req.body);
  res.json({ success: true });
});

// 鏂囦欢涓婁紶
app.post("/api/upload", upload.single("file"), function(req, res) {
  if (!req.file) return res.status(400).json({ error: "娌℃湁鏂囦欢" });
  res.json({ url: "/server_data/uploads/" + req.file.filename, filename: req.file.originalname });
});

// 鎻愪緵涓婁紶鏂囦欢璁块棶
app.use("/server_data", express.static(DATA_DIR));

// 鍚姩
app.listen(PORT, function() {
  console.log("澶у摜寮熸梾娓歌鍒掓湇鍔″櫒鍚姩: http://localhost:" + PORT);
});
