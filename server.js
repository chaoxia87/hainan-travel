// server.js - 大哥弟旅游规划 后端服务器
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// 数据存储目录
const DATA_DIR = path.join(__dirname, "server_data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
[ DATA_DIR, UPLOADS_DIR ].forEach(function(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// 数据文件路径
const MEDIA_FILE = path.join(DATA_DIR, "media.json");
const KNOWLEDGE_FILE = path.join(DATA_DIR, "knowledge.json");
const ROUTES_FILE = path.join(DATA_DIR, "routes.json");

// 读取/写入JSON
function readJSON(filepath) {
  try { return JSON.parse(fs.readFileSync(filepath, "utf-8")); } catch(e) { return null; }
}
function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
}

// 初始化数据文件
if (!readJSON(MEDIA_FILE)) writeJSON(MEDIA_FILE, []);
if (!readJSON(KNOWLEDGE_FILE)) writeJSON(KNOWLEDGE_FILE, []);
if (!readJSON(ROUTES_FILE)) writeJSON(ROUTES_FILE, []);

// 中间件
app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.static(__dirname));

// 文件上传配置
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: function(req, file, cb) {
    cb(null, Date.now() + "-" + encodeURIComponent(file.originalname));
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 200 * 1024 * 1024 } });

// ============ API 路由 ============

// 媒体标注 API
app.get("/api/media", function(req, res) {
  res.json(readJSON(MEDIA_FILE) || []);
});
app.post("/api/media", function(req, res) {
  writeJSON(MEDIA_FILE, req.body);
  res.json({ success: true });
});

// 知识点 API
app.get("/api/knowledge", function(req, res) {
  res.json(readJSON(KNOWLEDGE_FILE) || []);
});
app.post("/api/knowledge", function(req, res) {
  writeJSON(KNOWLEDGE_FILE, req.body);
  res.json({ success: true });
});

// 路线历史 API
app.get("/api/routes", function(req, res) {
  res.json(readJSON(ROUTES_FILE) || []);
});
app.post("/api/routes", function(req, res) {
  writeJSON(ROUTES_FILE, req.body);
  res.json({ success: true });
});

// 文件上传
app.post("/api/upload", upload.single("file"), function(req, res) {
  if (!req.file) return res.status(400).json({ error: "没有文件" });
  res.json({ url: "/server_data/uploads/" + req.file.filename, filename: req.file.originalname });
});

// 提供上传文件访问
app.use("/server_data", express.static(DATA_DIR));

// 启动
app.listen(PORT, function() {
  console.log("大哥弟旅游规划服务器启动: http://localhost:" + PORT);
});
