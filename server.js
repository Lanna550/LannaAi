import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FileState, GoogleAIFileManager } from "@google/generative-ai/server";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let cachedEnvMtimeMs = null;
let cachedApiKey = null;
let cachedGenAI = null;
let cachedFileManager = null;

function maybeReloadDotenv() {
  const envPath = path.join(__dirname, ".env");

  try {
    const stat = fs.statSync(envPath);
    const mtimeMs = Number(stat.mtimeMs || 0);
    if (Number.isFinite(mtimeMs) && mtimeMs > 0 && cachedEnvMtimeMs === mtimeMs) {
      return;
    }

    dotenv.config({ path: envPath, override: true });
    cachedEnvMtimeMs = mtimeMs;
  } catch (_error) {
    // ignore: env file might not exist or cannot be stat'ed
  }
}

function getGeminiClients() {
  maybeReloadDotenv();
  const apiKey = process.env.GEMINI_API_KEY || "";

  if (apiKey && apiKey !== cachedApiKey) {
    cachedApiKey = apiKey;
    cachedGenAI = new GoogleGenerativeAI(apiKey);
    cachedFileManager = new GoogleAIFileManager(apiKey);
  }

  return {
    apiKey,
    genAI: cachedGenAI,
    fileManager: cachedFileManager,
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});
const DB_PORT = Number.parseInt(process.env.DB_PORT || "3306", 10) || 3306;
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "chatbot";
const AUTH_DEFAULT_AVATAR = "/images/avatar1.jpg";
const AUTH_DEFAULT_BIO = "";
const LEGACY_AUTH_DEFAULT_BIO = "Halo! Aku suka anime!";
const PROFILE_UPLOAD_DIR = path.join(
  __dirname,
  "app",
  "public",
  "uploads",
  "profiles",
);

fs.mkdirSync(PROFILE_UPLOAD_DIR, { recursive: true });

const profileUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, PROFILE_UPLOAD_DIR);
    },
    filename: (_req, file, callback) => {
      const safeExtension =
        path.extname(file.originalname || "") ||
        (file.mimetype?.includes("png")
          ? ".png"
          : file.mimetype?.includes("webp")
            ? ".webp"
            : ".jpg");
      callback(
        null,
        `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExtension}`,
      );
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
const dbPool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const FALLBACK_DATA_DIR = path.join(__dirname, "data");
const FALLBACK_USERS_FILE = path.join(FALLBACK_DATA_DIR, "users.json");
const FALLBACK_CHATS_FILE = path.join(FALLBACK_DATA_DIR, "chats.json");
const FALLBACK_FEEDBACK_FILE = path.join(FALLBACK_DATA_DIR, "feedback.json");

const PERSISTENCE_MODE = String(process.env.PERSISTENCE_MODE || "").trim().toLowerCase();
const IS_PERSISTENCE_FORCED_FILE = PERSISTENCE_MODE === "file";
const MYSQL_RECOVERY_RETRY_MS =
  Number.parseInt(process.env.MYSQL_RECOVERY_RETRY_MS || "15000", 10) || 15000;
let persistenceMode = PERSISTENCE_MODE === "file" ? "file" : "mysql";
let nextMysqlRecoveryAttemptAt = 0;
const persistenceReady = (async () => {
  await fs.promises.mkdir(FALLBACK_DATA_DIR, { recursive: true });

  if (persistenceMode === "mysql") {
    const mysqlReady = await tryInitMysqlPersistence();
    if (!mysqlReady) {
      persistenceMode = "file";
      console.warn(
        "MySQL tidak tersedia. Backend memakai fallback file JSON di folder ./data",
      );
    }
  } else {
    console.log("Persistence mode: file (JSON fallback di folder ./data)");
  }
})();

const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isPrivateIpv4Host(hostname) {
  const matched = String(hostname || "")
    .trim()
    .toLowerCase()
    .match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!matched) {
    return false;
  }

  const [a, b, c, d] = matched.slice(1).map((segment) => Number.parseInt(segment, 10));
  if (![a, b, c, d].every((segment) => Number.isFinite(segment) && segment >= 0 && segment <= 255)) {
    return false;
  }

  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isLoopbackOrPrivateHost(hostname) {
  const normalizedHost = String(hostname || "").trim().toLowerCase();
  if (!normalizedHost) {
    return false;
  }

  if (LOCALHOST_HOSTS.has(normalizedHost)) {
    return true;
  }

  if (normalizedHost.endsWith(".local")) {
    return true;
  }

  return isPrivateIpv4Host(normalizedHost);
}

function normalizeCorsOrigin(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch (_error) {
    return "";
  }
}

function parseCorsAllowedOrigins(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((origin) => normalizeCorsOrigin(origin))
      .filter((origin) => Boolean(origin)),
  );
}

const configuredCorsAllowedOrigins = parseCorsAllowedOrigins(
  process.env.CORS_ALLOWED_ORIGINS,
);

function isCorsOriginAllowed(origin) {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeCorsOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  if (!configuredCorsAllowedOrigins.size) {
    return true;
  }

  if (configuredCorsAllowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  try {
    const hostname = String(new URL(normalizedOrigin).hostname || "").trim().toLowerCase();
    return isLoopbackOrPrivateHost(hostname);
  } catch (_error) {
    return false;
  }
}

if (configuredCorsAllowedOrigins.size) {
  console.log(
    `CORS allowlist aktif: ${Array.from(configuredCorsAllowedOrigins).join(", ")} (+ localhost/LAN lokal).`,
  );
} else {
  console.log("CORS mode dev: semua origin diizinkan (set CORS_ALLOWED_ORIGINS untuk membatasi).");
}

const corsMiddleware = cors({
  origin: (origin, callback) => {
    callback(null, isCorsOriginAllowed(origin));
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
  optionsSuccessStatus: 204,
});

app.use((req, res, next) => {
  if (req.headers["access-control-request-private-network"] === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }

  next();
});

app.use(corsMiddleware);
app.options(/.*/, corsMiddleware);
app.use(express.json({ limit: "2mb" }));
app.use(
  "/uploads",
  express.static(path.join(__dirname, "app", "public", "uploads")),
);

function isMysqlConnectivityError(error) {
  const code = String(error?.code || "").toUpperCase();
  return (
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EHOSTUNREACH" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "ER_ACCESS_DENIED_ERROR" ||
    code === "ER_BAD_DB_ERROR" ||
    code === "ER_DBACCESS_DENIED_ERROR"
  );
}

async function tryInitMysqlPersistence() {
  try {
    const bootstrap = await mysql
      .createConnection({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        multipleStatements: true,
      })
      .catch(() => null);

    if (bootstrap) {
      try {
        await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
      } finally {
        await bootstrap.end().catch(() => undefined);
      }
    }

    const connection = await dbPool.getConnection();
    try {
      await connection.query("SELECT 1");
    } finally {
      connection.release();
    }

    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password TEXT NOT NULL,
        profile_image TEXT NULL,
        banner_image TEXT NULL,
        bio TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS chats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        message LONGTEXT NULL,
        response LONGTEXT NULL,
        created_at DATETIME NOT NULL,
        INDEX idx_user_created (user_id, created_at)
      )`,
    );

    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS ai_feedback (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        users_id INT NULL,
        message_id VARCHAR(100) NULL,
        model_name VARCHAR(50) NULL,
        rating INT NULL,
        feedback_type VARCHAR(20) NULL,
        comment TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_feedback_users_id (users_id),
        INDEX idx_feedback_message_id (message_id),
        INDEX idx_feedback_created_at (created_at)
      )`,
    );

    return true;
  } catch (error) {
    if (isMysqlConnectivityError(error)) {
      console.warn(
        `MYSQL INIT WARNING: ${String(error?.code || "UNKNOWN")} saat konek ke ${DB_HOST}:${DB_PORT}.`,
      );
    } else {
      console.error("MYSQL INIT ERROR:", error);
    }
    return false;
  }
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    const raw = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (_error) {
    return fallbackValue;
  }
}

async function writeJsonAtomic(filePath, value) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.promises.writeFile(tmpPath, JSON.stringify(value, null, 2), "utf8");
  await fs.promises.rename(tmpPath, filePath);
}

const fileWriteQueue = new Map();

async function withFileLock(lockKey, task) {
  const current = fileWriteQueue.get(lockKey) || Promise.resolve();
  const next = current.then(task, task);
  fileWriteQueue.set(lockKey, next.catch(() => undefined));
  return next;
}

async function readUsersStore() {
  await persistenceReady;
  const store = await readJsonFile(FALLBACK_USERS_FILE, null);
  if (
    !store ||
    typeof store !== "object" ||
    !Number.isInteger(store.nextId) ||
    !Array.isArray(store.users)
  ) {
    return { nextId: 1, users: [] };
  }

  return store;
}

async function writeUsersStore(store) {
  await persistenceReady;
  await writeJsonAtomic(FALLBACK_USERS_FILE, store);
}

async function readChatsStore() {
  await persistenceReady;
  const store = await readJsonFile(FALLBACK_CHATS_FILE, null);
  if (
    !store ||
    typeof store !== "object" ||
    !Number.isInteger(store.nextRowId) ||
    !store.chatsByUserId ||
    typeof store.chatsByUserId !== "object"
  ) {
    return { nextRowId: 1, chatsByUserId: {} };
  }

  return store;
}

async function writeChatsStore(store) {
  await persistenceReady;
  await writeJsonAtomic(FALLBACK_CHATS_FILE, store);
}

async function readFeedbackStore() {
  await persistenceReady;
  const store = await readJsonFile(FALLBACK_FEEDBACK_FILE, null);
  if (
    !store ||
    typeof store !== "object" ||
    !Number.isInteger(store.nextId) ||
    !Array.isArray(store.feedbacks)
  ) {
    return { nextId: 1, feedbacks: [] };
  }

  return store;
}

async function writeFeedbackStore(store) {
  await persistenceReady;
  await writeJsonAtomic(FALLBACK_FEEDBACK_FILE, store);
}

async function runWithPersistence({ mysqlTask, fileTask }) {
  await persistenceReady;

  if (persistenceMode === "mysql") {
    try {
      return await mysqlTask();
    } catch (error) {
      if (isMysqlConnectivityError(error)) {
        console.error("MYSQL UNAVAILABLE, switch to file fallback:", error);
        persistenceMode = "file";
        nextMysqlRecoveryAttemptAt = Date.now() + MYSQL_RECOVERY_RETRY_MS;
      } else {
        throw error;
      }
    }
  }

  if (!IS_PERSISTENCE_FORCED_FILE && persistenceMode === "file") {
    const now = Date.now();
    if (now >= nextMysqlRecoveryAttemptAt) {
      try {
        const result = await mysqlTask();
        persistenceMode = "mysql";
        nextMysqlRecoveryAttemptAt = 0;
        console.log("MYSQL RECOVERED, switch back to MySQL persistence.");
        return result;
      } catch (error) {
        if (isMysqlConnectivityError(error)) {
          nextMysqlRecoveryAttemptAt = now + MYSQL_RECOVERY_RETRY_MS;
          console.warn(
            `MYSQL RECOVERY FAILED (${String(error?.code || "UNKNOWN")}), tetap fallback file.`,
          );
        } else {
          throw error;
        }
      }
    }
  }

  return fileTask();
}

function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username = "") {
  return String(username || "").trim();
}

function normalizeBio(bio = "") {
  return String(bio || "").trim();
}

function normalizeUserId(userId = "") {
  const parsed = Number.parseInt(String(userId || "").trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeFeedbackType(feedbackType = "") {
  const normalized = String(feedbackType || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (
    normalized === "positive" ||
    normalized === "bagus" ||
    normalized === "good" ||
    normalized === "like" ||
    normalized === "thumbsup" ||
    normalized === "thumbs_up"
  ) {
    return "positive";
  }

  if (
    normalized === "neutral" ||
    normalized === "biasa" ||
    normalized === "biasa_saja" ||
    normalized === "average" ||
    normalized === "meh"
  ) {
    return "neutral";
  }

  if (
    normalized === "negative" ||
    normalized === "jelek" ||
    normalized === "bad" ||
    normalized === "dislike" ||
    normalized === "thumbsdown" ||
    normalized === "thumbs_down"
  ) {
    return "negative";
  }

  return null;
}

function normalizeFeedbackRating(ratingValue) {
  const parsed = Number.parseInt(String(ratingValue), 10);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return Math.max(1, Math.min(5, parsed));
}

function ratingFromFeedbackType(feedbackType) {
  if (feedbackType === "positive") {
    return 5;
  }

  if (feedbackType === "neutral") {
    return 3;
  }

  if (feedbackType === "negative") {
    return 1;
  }

  return null;
}

function normalizeFeedbackComment(comment = "") {
  const trimmed = String(comment || "").trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 2000);
}

function normalizeMessageId(messageId = "") {
  const trimmed = String(messageId || "").trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 100);
}

function normalizeModelNameForFeedback(modelName = "") {
  const trimmed = String(modelName || "").trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 50);
}

function isCustomUploadPath(filePath = "") {
  return typeof filePath === "string" && filePath.startsWith("/uploads/profiles/");
}

function deleteStoredUpload(filePath = "") {
  if (!isCustomUploadPath(filePath)) {
    return;
  }

  const absolutePath = path.join(
    __dirname,
    "app",
    "public",
    filePath.replace(/^\/+/, ""),
  );

  fs.promises.unlink(absolutePath).catch(() => undefined);
}

function mapUserRow(row = {}) {
  const resolvedBio =
    typeof row.bio === "string" && row.bio.trim() !== LEGACY_AUTH_DEFAULT_BIO
      ? row.bio
      : AUTH_DEFAULT_BIO;

  return {
    id: String(row.id || ""),
    username: String(row.username || ""),
    email: String(row.email || ""),
    displayName: String(row.username || ""),
    bio: resolvedBio,
    avatar: String(row.profile_image || AUTH_DEFAULT_AVATAR),
    banner: row.banner_image ? String(row.banner_image) : undefined,
    createdAt: row.created_at
      ? new Date(row.created_at).toISOString()
      : new Date().toISOString(),
  };
}

async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  return runWithPersistence({
    mysqlTask: async () => {
      const [rows] = await dbPool.execute(
        "SELECT id, username, email, password, profile_image, banner_image, bio, created_at FROM users WHERE email = ? LIMIT 1",
        [normalizedEmail],
      );

      return Array.isArray(rows) ? rows[0] : null;
    },
    fileTask: async () =>
      withFileLock("users", async () => {
        const store = await readUsersStore();
        const user = store.users.find((item) => item.email === normalizedEmail);
        return user || null;
      }),
  });
}

async function findPublicUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  return runWithPersistence({
    mysqlTask: async () => {
      const [rows] = await dbPool.execute(
        "SELECT id, username, email, profile_image, banner_image, bio, created_at FROM users WHERE email = ? LIMIT 1",
        [normalizedEmail],
      );

      return Array.isArray(rows) ? rows[0] : null;
    },
    fileTask: async () =>
      withFileLock("users", async () => {
        const store = await readUsersStore();
        const user = store.users.find((item) => item.email === normalizedEmail);
        if (!user) {
          return null;
        }
        const { password, ...publicUser } = user;
        return publicUser;
      }),
  });
}

async function findUserById(userId) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return null;
  }

  return runWithPersistence({
    mysqlTask: async () => {
      const [rows] = await dbPool.execute(
        "SELECT id, username, email, profile_image, banner_image, bio, created_at FROM users WHERE id = ? LIMIT 1",
        [normalizedUserId],
      );

      return Array.isArray(rows) ? rows[0] : null;
    },
    fileTask: async () =>
      withFileLock("users", async () => {
        const store = await readUsersStore();
        const user = store.users.find((item) => Number(item.id) === normalizedUserId);
        if (!user) {
          return null;
        }
        const { password, ...publicUser } = user;
        return publicUser;
      }),
  });
}

async function findUserByUsernameOrEmail(username, email) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = normalizeEmail(email);

  return runWithPersistence({
    mysqlTask: async () => {
      const [rows] = await dbPool.execute(
        "SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1",
        [normalizedUsername, normalizedEmail],
      );

      return Array.isArray(rows) ? rows[0] : null;
    },
    fileTask: async () =>
      withFileLock("users", async () => {
        const store = await readUsersStore();
        const user = store.users.find(
          (item) => item.username === normalizedUsername || item.email === normalizedEmail,
        );
        return user ? { id: user.id } : null;
      }),
  });
}

async function findOtherUserByUsername(userId, username) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUserId || !normalizedUsername) {
    return null;
  }

  return runWithPersistence({
    mysqlTask: async () => {
      const [rows] = await dbPool.execute(
        "SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1",
        [normalizedUsername, normalizedUserId],
      );

      return Array.isArray(rows) ? rows[0] : null;
    },
    fileTask: async () =>
      withFileLock("users", async () => {
        const store = await readUsersStore();
        const user = store.users.find(
          (item) =>
            item.username === normalizedUsername &&
            Number(item.id) !== normalizedUserId,
        );
        return user ? { id: user.id } : null;
      }),
  });
}

async function verifyPassword(inputPassword, storedPassword) {
  if (!storedPassword) {
    return false;
  }

  if (/^\$2[aby]\$\d{2}\$/.test(storedPassword)) {
    return bcrypt.compare(inputPassword, storedPassword);
  }

  return inputPassword === storedPassword;
}

function createAuthErrorResponse(error) {
  console.error("AUTH ERROR:", error);
  return {
    code: "AUTH_DB_ERROR",
    error:
      persistenceMode === "file"
        ? "Backend memakai fallback file. Coba ulangi beberapa saat."
        : "Gagal terhubung ke MySQL. Pastikan MySQL XAMPP aktif dan konfigurasi database benar.",
  };
}

async function createUserRecord({ username, email, passwordHash }) {
  const createdAt = new Date().toISOString();

  return runWithPersistence({
    mysqlTask: async () => {
      const [result] = await dbPool.execute(
        "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
        [username, email, passwordHash],
      );

      return {
        id: result?.insertId,
        username,
        email,
        created_at: createdAt,
      };
    },
    fileTask: async () =>
      withFileLock("users", async () => {
        const store = await readUsersStore();
        const nextId = store.nextId;
        const record = {
          id: nextId,
          username,
          email,
          password: passwordHash,
          profile_image: null,
          banner_image: null,
          bio: AUTH_DEFAULT_BIO,
          created_at: createdAt,
        };

        store.nextId = nextId + 1;
        store.users.push(record);
        await writeUsersStore(store);

        const { password, ...publicUser } = record;
        return publicUser;
      }),
  });
}

async function updateUserProfileRecord(userId, { username, bio }) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return null;
  }

  return runWithPersistence({
    mysqlTask: async () => {
      await dbPool.execute("UPDATE users SET username = ?, bio = ? WHERE id = ?", [
        username,
        bio,
        normalizedUserId,
      ]);

      return findUserById(normalizedUserId);
    },
    fileTask: async () =>
      withFileLock("users", async () => {
        const store = await readUsersStore();
        const index = store.users.findIndex(
          (item) => Number(item.id) === normalizedUserId,
        );
        if (index < 0) {
          return null;
        }

        store.users[index] = {
          ...store.users[index],
          username,
          bio,
        };
        await writeUsersStore(store);

        const { password, ...publicUser } = store.users[index];
        return publicUser;
      }),
  });
}

async function updateUserMediaRecord(userId, { profileImage, bannerImage }) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return null;
  }

  return runWithPersistence({
    mysqlTask: async () => {
      await dbPool.execute(
        "UPDATE users SET profile_image = ?, banner_image = ? WHERE id = ?",
        [profileImage || null, bannerImage || null, normalizedUserId],
      );

      return findUserById(normalizedUserId);
    },
    fileTask: async () =>
      withFileLock("users", async () => {
        const store = await readUsersStore();
        const index = store.users.findIndex(
          (item) => Number(item.id) === normalizedUserId,
        );
        if (index < 0) {
          return null;
        }

        store.users[index] = {
          ...store.users[index],
          profile_image: profileImage ?? store.users[index].profile_image ?? null,
          banner_image: bannerImage ?? store.users[index].banner_image ?? null,
        };
        await writeUsersStore(store);

        const { password, ...publicUser } = store.users[index];
        return publicUser;
      }),
  });
}

async function loadChatRowsForUser(userId) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return [];
  }

  const fileTask = async () =>
    withFileLock("chats", async () => {
      const store = await readChatsStore();
      const rows = store.chatsByUserId[String(normalizedUserId)];
      return Array.isArray(rows) ? rows : [];
    });

  try {
    const rows = await runWithPersistence({
      mysqlTask: async () => {
        const [mysqlRows] = await dbPool.execute(
          "SELECT id, user_id, message, response, created_at FROM chats WHERE user_id = ? ORDER BY created_at ASC, id ASC",
          [normalizedUserId],
        );

        return Array.isArray(mysqlRows) ? mysqlRows : [];
      },
      fileTask,
    });

    if (Array.isArray(rows) && rows.length > 0) {
      return rows;
    }

    // Jika DB kosong tapi ada data fallback file (mis. sync sebelumnya gagal),
    // pakai data file agar history lintas device tidak hilang.
    const fileRows = await fileTask();
    return Array.isArray(fileRows) && fileRows.length > 0 ? fileRows : rows;
  } catch (error) {
    console.error("CHAT LOAD ERROR, fallback ke file:", error);
    return fileTask();
  }
}

async function saveChatRowsForUser(userId, sessions = []) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return { ok: false, savedRows: 0 };
  }

  const rows = buildChatRowsForStorage(normalizedUserId, sessions);
  const fileTask = async () =>
    withFileLock("chats", async () => {
      const store = await readChatsStore();
      const userKey = String(normalizedUserId);
      const nextRows = rows.map((row) => ({
        id: store.nextRowId++,
        user_id: normalizedUserId,
        message: row.message,
        response: row.response,
        created_at: new Date(
          String(row.createdAt || "").trim().replace(" ", "T") + "Z",
        ).toISOString(),
      }));

      store.chatsByUserId[userKey] = nextRows;
      await writeChatsStore(store);
      return { ok: true, savedRows: nextRows.length };
    });

  try {
    const result = await runWithPersistence({
      mysqlTask: async () => {
        const connection = await dbPool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.execute("DELETE FROM chats WHERE user_id = ?", [normalizedUserId]);

          for (const row of rows) {
            await connection.execute(
              "INSERT INTO chats (user_id, message, response, created_at) VALUES (?, ?, ?, ?)",
              [row.userId, row.message, row.response, row.createdAt],
            );
          }

          await connection.commit();
          return { ok: true, savedRows: rows.length };
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      },
      fileTask,
    });

    // Mirror ke file sebagai backup lintas restart/masalah DB.
    if (persistenceMode === "mysql") {
      try {
        await fileTask();
      } catch (mirrorError) {
        console.warn("CHAT MIRROR FILE FAILED:", mirrorError);
      }
    }

    return result;
  } catch (error) {
    // Kasus umum yang bikin history "terlihat hilang" lintas device:
    // user_id tidak punya row users di MySQL => FK fail.
    if (
      String(error?.code || "").toUpperCase() === "ER_NO_REFERENCED_ROW_2" ||
      String(error?.code || "").toUpperCase() === "ER_ROW_IS_REFERENCED_2"
    ) {
      console.warn(
        "CHAT SAVE FK ERROR, fallback ke file untuk menjaga history tetap tersimpan:",
        error,
      );
      return fileTask();
    }

    throw error;
  }
}

async function saveFeedbackRecord({
  userId,
  messageId,
  modelName,
  rating,
  feedbackType,
  comment,
}) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedMessageId = normalizeMessageId(messageId);
  const normalizedModelName = normalizeModelNameForFeedback(modelName);
  const normalizedFeedbackType = normalizeFeedbackType(feedbackType);
  const normalizedRating =
    normalizeFeedbackRating(rating) ?? ratingFromFeedbackType(normalizedFeedbackType);
  const normalizedComment = normalizeFeedbackComment(comment);

  if (!normalizedFeedbackType || !normalizedRating) {
    return { ok: false, reason: "invalid_feedback" };
  }

  if (!normalizedMessageId) {
    return { ok: false, reason: "invalid_message_id" };
  }

  return runWithPersistence({
    mysqlTask: async () => {
      const [result] = await dbPool.execute(
        "INSERT INTO ai_feedback (users_id, message_id, model_name, rating, feedback_type, comment) VALUES (?, ?, ?, ?, ?, ?)",
        [
          normalizedUserId,
          normalizedMessageId,
          normalizedModelName,
          normalizedRating,
          normalizedFeedbackType,
          normalizedComment,
        ],
      );

      return {
        ok: true,
        id: Number(result?.insertId || 0) || null,
      };
    },
    fileTask: async () =>
      withFileLock("feedback", async () => {
        const store = await readFeedbackStore();
        const nextId = store.nextId;
        store.nextId += 1;
        store.feedbacks.push({
          id: nextId,
          users_id: normalizedUserId,
          message_id: normalizedMessageId,
          model_name: normalizedModelName,
          rating: normalizedRating,
          feedback_type: normalizedFeedbackType,
          comment: normalizedComment,
          created_at: new Date().toISOString(),
        });
        await writeFeedbackStore(store);

        return {
          ok: true,
          id: nextId,
        };
      }),
  });
}

const CHAT_WELCOME_MESSAGES = {
  lanna:
    "Halo! Aku Miku, teman ceritamu. Kamu bisa cerita apa pun: sedih, senang, capek, atau bingung. Aku dengerin ya.",
  furina:
    "Sparkle siap jadi spesialis generate gambarmu. Jelaskan visual yang kamu mau, nanti aku buatkan gambarnya.",
  inori: "Halo! Furina di sini. Yuk ngobrol.",
};

function createWelcomeMessage(modelId = "lanna") {
  return {
    id: `welcome-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: "assistant",
    content: CHAT_WELCOME_MESSAGES[modelId] || CHAT_WELCOME_MESSAGES.lanna,
    timestamp: new Date().toISOString(),
  };
}

function sanitizeChatAttachment(attachment = {}) {
  if (!attachment || typeof attachment !== "object") {
    return undefined;
  }

  const kind =
    attachment.kind === "image" ||
    attachment.kind === "audio" ||
    attachment.kind === "document"
      ? attachment.kind
      : undefined;
  const name = typeof attachment.name === "string" ? attachment.name : "";
  const mimeType =
    typeof attachment.mimeType === "string"
      ? attachment.mimeType
      : "application/octet-stream";
  const size = Number(attachment.size || 0);
  const fileUri =
    typeof attachment.fileUri === "string" && attachment.fileUri.trim()
      ? attachment.fileUri.trim()
      : undefined;

  if (!kind && !name) {
    return undefined;
  }

  return {
    kind: kind || "document",
    name,
    mimeType,
    size,
    fileUri,
  };
}

function parseChatPayload(rawValue, fallback = {}) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

function normalizePinnedAt(rawValue) {
  if (rawValue instanceof Date) {
    return Number.isNaN(rawValue.getTime()) ? null : rawValue.toISOString();
  }

  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return null;
  }

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function createLegacySessionFromRow(row = {}) {
  const sessionId = `legacy-${row.id || Date.now()}`;
  const modelId = "lanna";
  const userContent = String(row.message || "").trim();
  const assistantContent = String(row.response || "").trim();
  const timestamp = row.created_at
    ? new Date(row.created_at).toISOString()
    : new Date().toISOString();
  const messages = [createWelcomeMessage(modelId)];

  if (userContent) {
    messages.push({
      id: `user-${sessionId}`,
      role: "user",
      content: userContent,
      timestamp,
    });
  }

  if (assistantContent) {
    messages.push({
      id: `assistant-${sessionId}`,
      role: "assistant",
      content: assistantContent,
      timestamp,
    });
  }

  return {
    id: sessionId,
    title: userContent || "Chat Baru",
    preview: assistantContent || userContent || "",
    modelId,
    pinnedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages,
  };
}

function buildSessionsFromChatRows(rows = []) {
  const sessions = new Map();

  for (const row of rows) {
    const messagePayload = parseChatPayload(row.message, null);
    const responsePayload = parseChatPayload(row.response, null);

    if (!messagePayload || typeof messagePayload !== "object") {
      const legacySession = createLegacySessionFromRow(row);
      sessions.set(legacySession.id, legacySession);
      continue;
    }

    const sessionId =
      typeof messagePayload.sessionId === "string" && messagePayload.sessionId.trim()
        ? messagePayload.sessionId.trim()
        : `session-${row.id || Date.now()}`;
    const modelId =
      typeof messagePayload.modelId === "string" && messagePayload.modelId.trim()
        ? messagePayload.modelId.trim()
        : "lanna";
    const createdAt =
      messagePayload.sessionCreatedAt ||
      row.created_at ||
      new Date().toISOString();
    const updatedAt =
      responsePayload?.updatedAt ||
      messagePayload.updatedAt ||
      row.created_at ||
      new Date().toISOString();
    const rowPinnedAt = normalizePinnedAt(
      messagePayload.pinnedAt ?? responsePayload?.pinnedAt ?? null,
    );

    let session = sessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        title:
          typeof messagePayload.title === "string" && messagePayload.title.trim()
            ? messagePayload.title.trim()
            : "Chat Baru",
        preview:
          typeof responsePayload?.preview === "string"
            ? responsePayload.preview
            : "",
        modelId,
        pinnedAt: rowPinnedAt,
        createdAt: new Date(createdAt).toISOString(),
        updatedAt: new Date(updatedAt).toISOString(),
        messages: [createWelcomeMessage(modelId)],
      };
      sessions.set(sessionId, session);
    }

    if (messagePayload.userMessage || messagePayload.userAttachment) {
      session.messages.push({
        id:
          typeof messagePayload.userMessageId === "string"
            ? messagePayload.userMessageId
            : `user-${row.id}-${session.messages.length}`,
        role: "user",
        content: String(messagePayload.userMessage || ""),
        timestamp: new Date(
          messagePayload.userTimestamp || row.created_at || Date.now(),
        ).toISOString(),
        attachment: sanitizeChatAttachment(messagePayload.userAttachment),
      });
    }

    if (responsePayload?.assistantMessage || responsePayload?.assistantAttachment) {
      session.messages.push({
        id:
          typeof responsePayload.assistantMessageId === "string"
            ? responsePayload.assistantMessageId
            : `assistant-${row.id}-${session.messages.length}`,
        role: "assistant",
        content: String(responsePayload.assistantMessage || ""),
        timestamp: new Date(
          responsePayload.assistantTimestamp || row.created_at || Date.now(),
        ).toISOString(),
        attachment: sanitizeChatAttachment(responsePayload.assistantAttachment),
      });
    }

    session.updatedAt = new Date(updatedAt).toISOString();
    if (typeof responsePayload?.preview === "string" && responsePayload.preview.trim()) {
      session.preview = responsePayload.preview.trim();
    }
    if (typeof messagePayload.title === "string" && messagePayload.title.trim()) {
      session.title = messagePayload.title.trim();
    }
    if (
      Object.prototype.hasOwnProperty.call(messagePayload, "pinnedAt") ||
      (responsePayload &&
        typeof responsePayload === "object" &&
        Object.prototype.hasOwnProperty.call(responsePayload, "pinnedAt"))
    ) {
      session.pinnedAt = rowPinnedAt;
    }
  }

  return Array.from(sessions.values()).sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function buildChatRowsForStorage(userId, sessions = []) {
  const rows = [];

  for (const session of sessions) {
    if (!session || typeof session !== "object") {
      continue;
    }

    const sessionId =
      typeof session.id === "string" && session.id.trim() ? session.id.trim() : null;
    if (!sessionId) {
      continue;
    }

    const modelId =
      typeof session.modelId === "string" && session.modelId.trim()
        ? session.modelId.trim()
        : "lanna";
    const title =
      typeof session.title === "string" && session.title.trim()
        ? session.title.trim()
        : "Chat Baru";
    const preview =
      typeof session.preview === "string" ? session.preview.trim() : "";
    const pinnedAt = normalizePinnedAt(session.pinnedAt);
    const messages = Array.isArray(session.messages) ? session.messages : [];
    const userMessages = messages.filter((message) => message?.role === "user");

    for (const userMessage of userMessages) {
      const userIndex = messages.findIndex((message) => message?.id === userMessage.id);
      const assistantMessage =
        userIndex >= 0 ? messages.slice(userIndex + 1).find((message) => message?.role === "assistant") : null;
      const createdAt = new Date(
        userMessage?.timestamp || session.updatedAt || session.createdAt || Date.now(),
      );

      rows.push({
        userId,
        createdAt: createdAt.toISOString().slice(0, 19).replace("T", " "),
        message: JSON.stringify({
          sessionId,
          modelId,
          title,
          sessionCreatedAt: session.createdAt || createdAt.toISOString(),
          updatedAt: session.updatedAt || createdAt.toISOString(),
          pinnedAt,
          userMessageId: userMessage?.id || `user-${Date.now()}`,
          userTimestamp: userMessage?.timestamp || createdAt.toISOString(),
          userMessage: String(userMessage?.content || ""),
          userAttachment: sanitizeChatAttachment(userMessage?.attachment),
        }),
        response: JSON.stringify({
          assistantMessageId: assistantMessage?.id || null,
          assistantTimestamp:
            assistantMessage?.timestamp || session.updatedAt || createdAt.toISOString(),
          assistantMessage: String(assistantMessage?.content || ""),
          assistantAttachment: sanitizeChatAttachment(assistantMessage?.attachment),
          preview,
          pinnedAt,
          updatedAt: session.updatedAt || createdAt.toISOString(),
        }),
      });
    }
  }

  return rows;
}

app.get("/api/health", (_req, res) => {
  const { apiKey } = getGeminiClients();
  const tiktokConfig = getTikTokRapidApiConfig();
  const apiKeyFingerprint = apiKey
    ? crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 8)
    : null;

  return res.json({
    ok: true,
    persistence: persistenceMode,
    hasGeminiApiKey: Boolean(apiKey),
    geminiApiKeyFingerprint: apiKeyFingerprint,
    hasTiktokRapidApiKey: Boolean(tiktokConfig.rapidApiKey),
    tiktokRapidApiHost: tiktokConfig.rapidApiHost,
    hasGithubDeployToken: Boolean(GITHUB_DEPLOY_TOKEN),
    githubDeployWorkflow: GITHUB_DEPLOY_WORKFLOW,
    textModel: DEFAULT_TEXT_MODEL,
    multimodalModel: DEFAULT_MULTIMODAL_MODEL,
    imageModel: DEFAULT_IMAGE_MODEL,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/auth/register", async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!username || !email || !password) {
    return res.status(400).json({
      error: "Username, email, dan password wajib diisi.",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: "Password minimal 6 karakter.",
    });
  }

  try {
    const existingUser = await findUserByUsernameOrEmail(username, email);
    if (existingUser) {
      return res.status(409).json({
        error: "Username atau email sudah terdaftar.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const createdUser = await createUserRecord({
      username,
      email,
      passwordHash: hashedPassword,
    });

    return res.status(201).json({
      user: mapUserRow({
        id: createdUser?.id,
        username: createdUser?.username || username,
        email: createdUser?.email || email,
        created_at: createdUser?.created_at,
      }),
    });
  } catch (error) {
    return res.status(500).json(createAuthErrorResponse(error));
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({
      error: "Email dan password wajib diisi.",
    });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: "Email atau password salah.",
      });
    }

    const passwordMatched = await verifyPassword(password, user.password);
    if (!passwordMatched) {
      return res.status(401).json({
        error: "Email atau password salah.",
      });
    }

    return res.json({
      user: mapUserRow(user),
    });
  } catch (error) {
    return res.status(500).json(createAuthErrorResponse(error));
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: "User tidak ditemukan.",
      });
    }

    return res.json({
      user: mapUserRow(user),
    });
  } catch (error) {
    return res.status(500).json(createAuthErrorResponse(error));
  }
});

app.get("/api/users", async (req, res) => {
  const email = normalizeEmail(req.query?.email);
  if (!email) {
    return res.status(400).json({
      error: "Email wajib diisi.",
    });
  }

  try {
    const user = await findPublicUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        error: "User tidak ditemukan.",
      });
    }

    return res.json({
      user: mapUserRow(user),
    });
  } catch (error) {
    return res.status(500).json(createAuthErrorResponse(error));
  }
});

app.patch("/api/users/:id", async (req, res) => {
  const userId = normalizeUserId(req.params.id);
  const displayName = normalizeUsername(req.body?.displayName || req.body?.username);
  const bio = normalizeBio(req.body?.bio);

  if (!userId) {
    return res.status(400).json({
      error: "User ID tidak valid.",
    });
  }

  try {
    const currentUser = await findUserById(userId);
    if (!currentUser) {
      return res.status(404).json({
        error: "User tidak ditemukan.",
      });
    }

    if (displayName) {
      const existingUser = await findOtherUserByUsername(userId, displayName);
      if (existingUser) {
        return res.status(409).json({
          error: "Username sudah dipakai user lain.",
        });
      }
    }

    const updatedUser = await updateUserProfileRecord(userId, {
      username: displayName || currentUser.username || "",
      bio: bio || AUTH_DEFAULT_BIO,
    });
    return res.json({
      user: mapUserRow(updatedUser),
    });
  } catch (error) {
    return res.status(500).json(createAuthErrorResponse(error));
  }
});

app.post(
  "/api/users/:id/media",
  profileUpload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  async (req, res) => {
    const userId = normalizeUserId(req.params.id);
    if (!userId) {
      return res.status(400).json({
        error: "User ID tidak valid.",
      });
    }

    try {
      const currentUser = await findUserById(userId);
      if (!currentUser) {
        return res.status(404).json({
          error: "User tidak ditemukan.",
        });
      }

      const files = req.files || {};
      const avatarFile = Array.isArray(files.avatar) ? files.avatar[0] : null;
      const bannerFile = Array.isArray(files.banner) ? files.banner[0] : null;

      if (!avatarFile && !bannerFile) {
        return res.status(400).json({
          error: "File avatar atau banner wajib dikirim.",
        });
      }

      const nextAvatarPath = avatarFile
        ? `/uploads/profiles/${avatarFile.filename}`
        : currentUser.profile_image;
      const nextBannerPath = bannerFile
        ? `/uploads/profiles/${bannerFile.filename}`
        : currentUser.banner_image;

      await updateUserMediaRecord(userId, {
        profileImage: nextAvatarPath || null,
        bannerImage: nextBannerPath || null,
      });

      if (avatarFile && currentUser.profile_image && currentUser.profile_image !== nextAvatarPath) {
        deleteStoredUpload(currentUser.profile_image);
      }

      if (bannerFile && currentUser.banner_image && currentUser.banner_image !== nextBannerPath) {
        deleteStoredUpload(currentUser.banner_image);
      }

      const updatedUser = await findUserById(userId);
      return res.json({
        user: mapUserRow(updatedUser),
      });
    } catch (error) {
      return res.status(500).json(createAuthErrorResponse(error));
    }
  },
);

app.get("/api/chats/:userId", async (req, res) => {
  const userId = normalizeUserId(req.params.userId);
  if (!userId) {
    return res.status(400).json({
      error: "User ID tidak valid.",
    });
  }

  try {
    const rows = await loadChatRowsForUser(userId);

    return res.json({
      sessions: buildSessionsFromChatRows(Array.isArray(rows) ? rows : []),
    });
  } catch (error) {
    console.error("CHAT LOAD ERROR:", error);
    return res.status(500).json({
      error: "Gagal memuat riwayat chat dari database.",
    });
  }
});

app.put("/api/chats/:userId", async (req, res) => {
  const userId = normalizeUserId(req.params.userId);
  const sessions = Array.isArray(req.body?.sessions) ? req.body.sessions : [];

  if (!userId) {
    return res.status(400).json({
      error: "User ID tidak valid.",
    });
  }

  try {
    const result = await saveChatRowsForUser(userId, sessions);
    return res.json(result);
  } catch (error) {
    console.error("CHAT SAVE ERROR:", error);
    return res.status(500).json({
      error: "Gagal menyimpan riwayat chat ke database.",
    });
  }
});

app.post("/api/feedback", async (req, res) => {
  const feedbackType = normalizeFeedbackType(req.body?.feedbackType);
  const messageId = normalizeMessageId(req.body?.messageId);
  const modelName = normalizeModelNameForFeedback(req.body?.modelName);
  const rating =
    normalizeFeedbackRating(req.body?.rating) ?? ratingFromFeedbackType(feedbackType);
  const comment = normalizeFeedbackComment(req.body?.comment);
  const userId = normalizeUserId(req.body?.userId);

  if (!feedbackType) {
    return res.status(400).json({
      code: "INVALID_FEEDBACK_TYPE",
      error: "feedbackType wajib diisi (positive, neutral, atau negative).",
    });
  }

  if (!messageId) {
    return res.status(400).json({
      code: "INVALID_MESSAGE_ID",
      error: "messageId wajib diisi.",
    });
  }

  if (!rating) {
    return res.status(400).json({
      code: "INVALID_RATING",
      error: "rating tidak valid.",
    });
  }

  try {
    const result = await saveFeedbackRecord({
      userId,
      messageId,
      modelName,
      rating,
      feedbackType,
      comment,
    });

    if (!result?.ok) {
      return res.status(400).json({
        code: "INVALID_FEEDBACK_PAYLOAD",
        error: "Payload feedback tidak valid.",
      });
    }

    return res.status(201).json({
      ok: true,
      feedbackId: result.id,
    });
  } catch (error) {
    console.error("FEEDBACK SAVE ERROR:", error);
    return res.status(500).json({
      code: "FEEDBACK_SAVE_FAILED",
      error: "Gagal menyimpan feedback ke database.",
    });
  }
});

const MODEL_ALIASES = new Map([
  ["gemma 3 1b it", "gemma-3-1b-it"],
  ["gemma-3 1b it", "gemma-3-1b-it"],
  ["gemma 3 4b it", "gemma-3-4b-it"],
  ["gemma-3 4b it", "gemma-3-4b-it"],
  ["gemma 3 12b it", "gemma-3-12b-it"],
  ["gemma-3 12b it", "gemma-3-12b-it"],
  ["gemma 3 27b it", "gemma-3-27b-it"],
  ["gemma-3 27b it", "gemma-3-27b-it"],
  ["gemma 3n e4b it", "gemma-3n-e4b-it"],
  ["gemma-3n e4b it", "gemma-3n-e4b-it"],
  ["gemma 3n e2b it", "gemma-3n-e2b-it"],
  ["gemma-3n e2b it", "gemma-3n-e2b-it"],
  ["gemini 2.5 flash", "gemini-2.5-flash"],
  ["gemini-2.5 flash", "gemini-2.5-flash"],
  ["gemini 2.5 flash lite", "gemini-2.5-flash-lite"],
  ["gemini-2.5 flash lite", "gemini-2.5-flash-lite"],
  ["gemini 2.5 pro", "gemini-2.5-pro"],
  ["gemini-2.5 pro", "gemini-2.5-pro"],
  ["gemini 2.0 flash", "gemini-2.0-flash"],
  ["gemini-2 flash", "gemini-2.0-flash"],
  ["gemini 2.0 flash lite", "gemini-2.0-flash-lite"],
  ["gemini-2.0 flash lite", "gemini-2.0-flash-lite"],
  ["gemini flash latest", "gemini-flash-latest"],
  ["gemini-flash latest", "gemini-flash-latest"],
  ["gemini flash lite latest", "gemini-flash-lite-latest"],
  ["gemini-flash-lite latest", "gemini-flash-lite-latest"],
  ["gemini pro latest", "gemini-pro-latest"],
  ["gemini-pro latest", "gemini-pro-latest"],
  ["gemini 2.5 flash image", "gemini-2.5-flash-image"],
  ["gemini-2.5 flash image", "gemini-2.5-flash-image"],
  ["gemini 3.1 flash image preview", "gemini-3.1-flash-image-preview"],
  ["gemini-3.1 flash image preview", "gemini-3.1-flash-image-preview"],
  ["gemini 3 pro image preview", "gemini-3-pro-image-preview"],
  ["gemini-3 pro image preview", "gemini-3-pro-image-preview"],
]);

function normalizeModelName(modelName = "") {
  let normalized = String(modelName || "").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.toLowerCase().startsWith("models/")) {
    normalized = normalized.slice("models/".length);
  }

  const alias = MODEL_ALIASES.get(normalized.toLowerCase());
  return alias || normalized;
}

const DEFAULT_TEXT_MODEL =
  normalizeModelName(process.env.GEMINI_TEXT_MODEL) ||
  normalizeModelName(process.env.GEMINI_MODEL) ||
  "gemini-2.5-flash";
const DEFAULT_MULTIMODAL_MODEL =
  normalizeModelName(process.env.GEMINI_MODEL) || "gemini-2.5-flash";
const DEFAULT_IMAGE_MODEL =
  normalizeModelName(process.env.GEMINI_IMAGE_MODEL) ||
  "gemini-3.1-flash-image-preview";
const DEFAULT_EXTERNAL_IMAGE_MODEL =
  String(process.env.EXTERNAL_IMAGE_MODEL || "lan-image-worker").trim() || "lan-image-worker";
const EXTERNAL_IMAGE_API_URL = String(
  process.env.EXTERNAL_IMAGE_API_URL || "https://image-api.maulanapermana550.workers.dev/",
).trim();
const EXTERNAL_IMAGE_API_BEARER = String(
  process.env.EXTERNAL_IMAGE_API_BEARER || "lan-api-93f2a8d4c6b71e5f0a9d2c8b4e7f1a6",
).trim();
const FORCE_EXTERNAL_IMAGE_API =
  String(process.env.FORCE_EXTERNAL_IMAGE_API || "1").trim() !== "0";
const TIKTOK_RAPIDAPI_URL =
  String(
    process.env.TIKTOK_RAPIDAPI_URL || "https://tiktok-video-no-watermark2.p.rapidapi.com/",
  ).trim() || "https://tiktok-video-no-watermark2.p.rapidapi.com/";
const TIKTOK_RAPIDAPI_HOST =
  String(process.env.TIKTOK_RAPIDAPI_HOST || "tiktok-video-no-watermark2.p.rapidapi.com").trim() ||
  "tiktok-video-no-watermark2.p.rapidapi.com";
const TIKTOK_RAPIDAPI_KEY = String(process.env.TIKTOK_RAPIDAPI_KEY || "").trim();
const TIKTOK_RAPIDAPI_TIMEOUT_MS =
  Number.parseInt(String(process.env.TIKTOK_RAPIDAPI_TIMEOUT_MS || "15000"), 10) || 15000;
const TIKTOK_DEFAULT_HD = String(process.env.TIKTOK_DEFAULT_HD || "1").trim() !== "0";
const TIKTOK_MEDIA_DOWNLOAD_TIMEOUT_MS =
  Number.parseInt(String(process.env.TIKTOK_MEDIA_DOWNLOAD_TIMEOUT_MS || "180000"), 10) ||
  180000;
const TIKTOK_MEDIA_DOWNLOAD_MAX_RETRIES =
  Number.parseInt(String(process.env.TIKTOK_MEDIA_DOWNLOAD_MAX_RETRIES || "2"), 10) || 2;
const TIKTOK_PROXY_ALLOWED_HOST_KEYWORDS = [
  "tiktokcdn",
  "tokcdn",
  "tiktokv",
  "ibytedtos",
  "byteoversea",
  "muscdn",
];
const DEFAULT_IMAGE_ASPECT_RATIO =
  String(process.env.GEMINI_IMAGE_ASPECT_RATIO || "1:1").trim() || "1:1";
const DEFAULT_IMAGE_SIZE = String(process.env.GEMINI_IMAGE_SIZE || "").trim();
const DEFAULT_MAX_OUTPUT_TOKENS = Number.parseInt(
  String(process.env.GEMINI_MAX_OUTPUT_TOKENS || "800"),
  10,
);
const DEFAULT_MAX_OUTPUT_TOKENS_CODE = Number.parseInt(
  String(process.env.GEMINI_MAX_OUTPUT_TOKENS_CODE || "1400"),
  10,
);
const DEFAULT_TEMPERATURE = Number.parseFloat(
  String(process.env.GEMINI_TEMPERATURE || "0.6"),
);
const DEFAULT_TEMPERATURE_CODE = Number.parseFloat(
  String(process.env.GEMINI_TEMPERATURE_CODE || "0.2"),
);
const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_DEPLOY_TOKEN = String(
  process.env.GITHUB_DEPLOY_TOKEN || process.env.GITHUB_TOKEN || "",
).trim();
const GITHUB_DEPLOY_WORKFLOW =
  String(process.env.GITHUB_DEPLOY_WORKFLOW || "deploy-pages.yml").trim() ||
  "deploy-pages.yml";

function clampNumber(value, { min, max, fallback }) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function clampInt(value, { min, max, fallback }) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function getTikTokRapidApiConfig() {
  maybeReloadDotenv();
  const rapidApiUrl =
    String(process.env.TIKTOK_RAPIDAPI_URL || TIKTOK_RAPIDAPI_URL).trim() ||
    TIKTOK_RAPIDAPI_URL;
  const rapidApiHost =
    String(process.env.TIKTOK_RAPIDAPI_HOST || TIKTOK_RAPIDAPI_HOST).trim() ||
    TIKTOK_RAPIDAPI_HOST;
  const rapidApiKey = String(process.env.TIKTOK_RAPIDAPI_KEY || "").trim();
  const timeoutMs =
    Number.parseInt(
      String(process.env.TIKTOK_RAPIDAPI_TIMEOUT_MS || TIKTOK_RAPIDAPI_TIMEOUT_MS),
      10,
    ) || TIKTOK_RAPIDAPI_TIMEOUT_MS;
  const defaultHd = String(
    process.env.TIKTOK_DEFAULT_HD || (TIKTOK_DEFAULT_HD ? "1" : "0"),
  ).trim() !== "0";

  return {
    rapidApiUrl,
    rapidApiHost,
    rapidApiKey,
    timeoutMs,
    defaultHd,
  };
}

function createGithubHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = Number(statusCode) || 500;
  return error;
}

function sanitizeGithubName(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return /^[A-Za-z0-9_.-]+$/.test(normalized) ? normalized : "";
}

function normalizeGithubWorkflowId(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return GITHUB_DEPLOY_WORKFLOW;
  }

  return normalized.replace(/^\/+/, "");
}

function parseGithubRepositoryInput(value = "") {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  let owner = "";
  let repo = "";

  const ownerRepoMatch = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (ownerRepoMatch) {
    owner = ownerRepoMatch[1];
    repo = ownerRepoMatch[2];
  } else {
    let parsedUrl;
    try {
      parsedUrl = new URL(raw);
    } catch (_error) {
      return null;
    }

    const host = String(parsedUrl.hostname || "").trim().toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") {
      return null;
    }

    const segments = parsedUrl.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length < 2) {
      return null;
    }

    owner = segments[0];
    repo = segments[1].replace(/\.git$/i, "");
  }

  const safeOwner = sanitizeGithubName(owner);
  const safeRepo = sanitizeGithubName(repo);
  if (!safeOwner || !safeRepo) {
    return null;
  }

  return {
    owner: safeOwner,
    repo: safeRepo,
  };
}

function buildGithubPagesUrl(owner, repo) {
  return `https://${owner}.github.io/${repo}/`;
}

function createGithubApiHeaders() {
  if (!GITHUB_DEPLOY_TOKEN) {
    throw createGithubHttpError(500, "GITHUB_DEPLOY_TOKEN belum diset di server.");
  }

  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${GITHUB_DEPLOY_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function readGithubJsonSafely(response) {
  const rawText = await response.text().catch(() => "");
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch (_error) {
    return null;
  }
}

async function githubApiRequest(endpointPath, { method = "GET", body } = {}) {
  const normalizedPath = String(endpointPath || "").startsWith("/")
    ? String(endpointPath || "")
    : `/${String(endpointPath || "")}`;
  const requestUrl = `${GITHUB_API_BASE_URL}${normalizedPath}`;
  const response = await fetch(requestUrl, {
    method,
    headers: createGithubApiHeaders(),
    body: body == null ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await readGithubJsonSafely(response);
    const message =
      payload?.message ||
      payload?.error ||
      `GitHub API request gagal (${response.status}).`;
    throw createGithubHttpError(response.status, message);
  }

  if (response.status === 204) {
    return null;
  }

  return readGithubJsonSafely(response);
}

function mapGithubWorkflowRun(runPayload = null) {
  if (!runPayload || typeof runPayload !== "object") {
    return null;
  }

  return {
    id: Number(runPayload.id) || null,
    status: String(runPayload.status || "").trim() || "unknown",
    conclusion:
      runPayload.conclusion == null ? null : String(runPayload.conclusion || "").trim() || null,
    htmlUrl: String(runPayload.html_url || "").trim() || null,
    event: String(runPayload.event || "").trim() || null,
    createdAt: String(runPayload.created_at || "").trim() || null,
    updatedAt: String(runPayload.updated_at || "").trim() || null,
  };
}

async function fetchLatestGithubWorkflowRun({ owner, repo, workflow, branch }) {
  const query = new URLSearchParams({
    branch,
    event: "workflow_dispatch",
    per_page: "5",
  });
  const payload = await githubApiRequest(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/runs?${query.toString()}`,
  );
  const runs = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
  if (!runs.length) {
    return null;
  }

  const matchedRun = runs.find(
    (run) => String(run?.head_branch || "").trim() === branch,
  );
  return mapGithubWorkflowRun(matchedRun || runs[0]);
}

async function fetchGithubWorkflowRunById({ owner, repo, runId }) {
  const payload = await githubApiRequest(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${encodeURIComponent(String(runId))}`,
  );
  return mapGithubWorkflowRun(payload);
}

function extractLastUserText(contents = []) {
  for (let index = contents.length - 1; index >= 0; index -= 1) {
    const item = contents[index];
    if (!item || item.role !== "user" || !Array.isArray(item.parts)) {
      continue;
    }

    const text = item.parts
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("\n")
      .trim();

    if (text) {
      return text;
    }
  }

  return "";
}

function looksLikeCodeRequest(contents = []) {
  const text = extractLastUserText(contents);
  if (!text) {
    return false;
  }

  return (
    /```/.test(text) ||
    /\b(kode|coding|ngoding|program|script|source code|bug|error|stack trace|fungsi|class|api|endpoint|sql|database|regex)\b/i.test(
      text,
    ) ||
    /\b(python|javascript|typescript|node|react|nextjs|express|mysql|postgres|mongodb)\b/i.test(
      text,
    )
  );
}

function getTextGenerationConfig(contents = []) {
  const isCode = looksLikeCodeRequest(contents);
  const maxOutputTokens = clampInt(isCode ? DEFAULT_MAX_OUTPUT_TOKENS_CODE : DEFAULT_MAX_OUTPUT_TOKENS, {
    min: 128,
    max: 4096,
    fallback: isCode ? 1400 : 800,
  });
  const temperature = clampNumber(isCode ? DEFAULT_TEMPERATURE_CODE : DEFAULT_TEMPERATURE, {
    min: 0,
    max: 1.5,
    fallback: isCode ? 0.2 : 0.4,
  });

  return {
    candidateCount: 1,
    maxOutputTokens,
    temperature,
  };
}

function modelSupportsDeveloperInstruction(modelName = "") {
  const normalized = normalizeModelName(modelName).toLowerCase();
  return normalized.startsWith("gemini");
}

function embedSystemInstructionIntoContents(systemInstruction = "", contents = []) {
  const trimmed = String(systemInstruction || "").trim();
  if (!trimmed) {
    return contents;
  }

  return [
    {
      role: "user",
      parts: [{ text: `Instruksi sistem (ikuti):\n${trimmed}` }],
    },
    ...contents,
  ];
}

function getCandidateModels(requestedModel = "", preferMultimodal = false) {
  const normalizedRequested = normalizeModelName(requestedModel);
  if (preferMultimodal) {
    return [
      normalizedRequested,
      DEFAULT_MULTIMODAL_MODEL,
      "gemini-flash-latest",
      "gemini-flash-lite-latest",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.5-pro",
    ].filter((value, index, array) => value && array.indexOf(value) === index);
  }

  return [
    normalizedRequested,
    DEFAULT_TEXT_MODEL,
    "gemma-3-4b-it",
    "gemma-3-12b-it",
    "gemma-3-27b-it",
    "gemma-3n-e4b-it",
    "gemma-3n-e2b-it",
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
  ].filter((value, index, array) => value && array.indexOf(value) === index);
}

function getCandidateImageModels(requestedModel = "") {
  return [
    normalizeModelName(requestedModel),
    DEFAULT_IMAGE_MODEL,
    "gemini-3.1-flash-image-preview",
    "gemini-2.5-flash-image",
    "gemini-3-pro-image-preview",
  ].filter((value, index, array) => value && array.indexOf(value) === index);
}

function isExternalImageModel(requestedModel = "") {
  const normalized = String(requestedModel || "").trim().toLowerCase();
  return (
    normalized === DEFAULT_EXTERNAL_IMAGE_MODEL.toLowerCase() ||
    /deepai|lan-image-worker|image-worker|image-api/.test(normalized)
  );
}

function cleanErrorMessage(error) {
  return (error?.message || "Unknown Gemini error").replace(
    "[GoogleGenerativeAI Error]: ",
    "",
  );
}

function getErrorStatus(error) {
  const message = cleanErrorMessage(error);

  if (
    /api key not valid|invalid api key|api key expired|api_key_invalid/i.test(
      message,
    )
  ) {
    return 401;
  }

  const status = Number(error?.status || error?.statusCode);
  if (Number.isInteger(status) && status >= 400 && status < 600) {
    return status;
  }

  if (/too many requests|quota exceeded/i.test(message)) {
    return 429;
  }

  return 502;
}

function getRetryAfterSeconds(error) {
  const message = cleanErrorMessage(error);
  const messageMatch = message.match(/retry in ([\d.]+)s/i);
  if (messageMatch) {
    return Math.max(1, Math.ceil(Number(messageMatch[1])));
  }

  const details = Array.isArray(error?.errorDetails) ? error.errorDetails : [];
  const retryInfo = details.find(
    (item) => item?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
  );
  const retryDelay = retryInfo?.retryDelay;
  if (typeof retryDelay === "string") {
    const seconds = Number.parseInt(retryDelay.replace(/s$/i, ""), 10);
    if (Number.isInteger(seconds) && seconds > 0) {
      return seconds;
    }
  }

  return undefined;
}

function shouldTryNextModel(error) {
  const status = getErrorStatus(error);
  const message = cleanErrorMessage(error);

  return (
    status === 429 ||
    status >= 500 ||
    /model .* not found|is not found|unsupported model|not supported for generatecontent/i.test(
      message,
    ) ||
    /developer instruction is not enabled|system instruction is not enabled|does not support (developer|system) instruction/i.test(
      message,
    )
  );
}

function createClientError(error, attemptedModels = []) {
  const status = getErrorStatus(error);
  const retryAfterSeconds = getRetryAfterSeconds(error);
  const message = cleanErrorMessage(error);
  const isExternalImageRequest = attemptedModels.some((model) =>
    /deepai|lan-image-worker|image-worker|image-api/i.test(String(model || "")),
  );
  const attemptedImageModels = attemptedModels.filter((model) =>
    /image|imagen/i.test(String(model || "")),
  );
  const isImageRequest = attemptedImageModels.length > 0 || isExternalImageRequest;

  if (
    /developer instruction is not enabled|system instruction is not enabled|does not support (developer|system) instruction/i.test(
      message,
    )
  ) {
    return {
      status: 400,
      payload: {
        code: "GEMINI_UNSUPPORTED_SYSTEM_INSTRUCTION",
        error:
          "Model yang dipakai tidak mendukung `systemInstruction` (developer instruction). Ganti ke model `gemini-*` atau kosongkan `systemInstruction`.",
        attemptedModels,
      },
    };
  }

  if (status === 429) {
    const isZeroQuota = /\blimit:\s*0\b/i.test(message);
    const retryMessage = retryAfterSeconds
      ? ` Coba lagi dalam sekitar ${retryAfterSeconds} detik.`
      : " Coba lagi beberapa saat.";
    const isImageZeroQuota = isZeroQuota && isImageRequest;

    return {
      status,
      payload: {
        code: isExternalImageRequest
          ? "EXTERNAL_IMAGE_RATE_LIMIT"
          : isImageZeroQuota
            ? "GEMINI_IMAGE_QUOTA_ZERO_LIMIT"
            : "GEMINI_QUOTA_EXCEEDED",
        error:
          (isExternalImageRequest
            ? "Permintaan ke layanan image API terkena batas penggunaan."
            : isZeroQuota
              ? isImageRequest
                ? "Kuota Gemini API untuk generate gambar pada project/key ini terdeteksi 0 (free tier image tidak aktif / billing belum aktif). "
                : "Kuota Gemini API untuk project/key ini terdeteksi 0 (free tier tidak aktif / billing belum aktif). "
              : "Permintaan ke Gemini terkena batas kuota atau rate limit.") + retryMessage,
        retryAfterSeconds,
        attemptedModels,
      },
    };
  }

  if (status === 401 || status === 403) {
    return {
      status,
      payload: {
        code: isExternalImageRequest ? "EXTERNAL_IMAGE_AUTH_ERROR" : "GEMINI_AUTH_ERROR",
        error:
          isExternalImageRequest
            ? "Token image API di server tidak valid atau tidak aktif."
            : "GEMINI_API_KEY di server tidak valid, tidak aktif, atau tidak punya akses ke model yang dipakai.",
        attemptedModels,
      },
    };
  }

  if (status === 402 && isExternalImageRequest) {
    return {
      status,
      payload: {
        code: "EXTERNAL_IMAGE_PAYMENT_REQUIRED",
        error: "Layanan image API butuh saldo/paket aktif untuk generate gambar.",
        attemptedModels,
      },
    };
  }

  return {
    status,
    payload: {
      code: isExternalImageRequest
        ? "EXTERNAL_IMAGE_REQUEST_FAILED"
        : "GEMINI_REQUEST_FAILED",
      error: cleanErrorMessage(error),
      attemptedModels,
    },
  };
}

function parseJsonField(value, fallback) {
  if (value == null) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function pickFirstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) {
          return item.trim();
        }
      }
    }
  }

  return null;
}

function normalizeDurationSeconds(value) {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed);
}

function collectUrlCandidates(...values) {
  const queue = [];

  for (const value of values) {
    if (typeof value === "string") {
      queue.push(value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          queue.push(item);
        }
      }
    }
  }

  const seen = new Set();
  const candidates = [];

  for (const rawValue of queue) {
    const normalized = String(rawValue || "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    try {
      const parsed = new URL(normalized);
      const protocol = String(parsed.protocol || "").toLowerCase();
      if (protocol !== "http:" && protocol !== "https:") {
        continue;
      }

      seen.add(normalized);
      candidates.push(normalized);
    } catch (_error) {
      // ignore invalid URL candidate
    }
  }

  return candidates;
}

function normalizeTikTokResponse(payload) {
  const root = payload && typeof payload === "object" ? payload : {};
  const data =
    (root.data && typeof root.data === "object" ? root.data : null) ||
    (root.result && typeof root.result === "object" ? root.result : null) ||
    root;

  const hdVideoCandidates = collectUrlCandidates(
    data.hdplay,
    data.hd_play,
    data.hd_no_watermark,
    data.video_hd,
  );
  const primaryVideoCandidates = collectUrlCandidates(
    data.play,
    data.nowm,
    data.no_watermark,
    data.video?.playAddr,
    data.video?.downloadAddrNoWatermark,
    data.video?.downloadAddr,
  );
  const fallbackVideoCandidates = collectUrlCandidates(
    ...hdVideoCandidates,
    data.video_no_watermark,
    data.download,
  );
  const videoCandidates = Array.from(
    new Set([...primaryVideoCandidates, ...fallbackVideoCandidates]),
  );

  const hdNoWatermarkUrl = pickFirstNonEmptyString(
    data.hdplay,
    data.hd_play,
    data.hd_no_watermark,
    data.video_hd,
    videoCandidates[0],
  );
  const noWatermarkUrl = pickFirstNonEmptyString(
    data.play,
    data.nowm,
    data.no_watermark,
    primaryVideoCandidates[0],
    data.video_no_watermark,
    data.video?.playAddr,
    data.video?.downloadAddrNoWatermark,
    data.video?.downloadAddr,
    hdNoWatermarkUrl,
    data.download,
  );
  const watermarkUrl = pickFirstNonEmptyString(
    data.wmplay,
    data.watermark,
    data.watermark_url,
    data.video?.playAddrWithWatermark,
  );
  const audioUrl = pickFirstNonEmptyString(
    data.music,
    data.music_url,
    data.music_info?.play,
    data.music_info?.play_url,
    data.audio,
    data.sound,
  );
  const audioCandidates = collectUrlCandidates(
    data.music,
    data.music_url,
    data.music_info?.play,
    data.music_info?.play_url,
    data.audio,
    data.sound,
  );

  return {
    id: pickFirstNonEmptyString(data.id, data.aweme_id, data.video_id),
    title: pickFirstNonEmptyString(data.title, data.desc),
    author: pickFirstNonEmptyString(
      data.author?.nickname,
      data.author?.unique_id,
      data.author_name,
      data.owner?.nickname,
      data.nickname,
    ),
    durationSeconds: normalizeDurationSeconds(data.duration || data.video?.duration),
    thumbnailUrl: pickFirstNonEmptyString(
      data.origin_cover,
      data.cover,
      data.thumbnail,
      data.video?.cover,
      data.video?.dynamicCover,
      data.author?.avatar,
    ),
    noWatermarkUrl,
    hdNoWatermarkUrl: hdNoWatermarkUrl || null,
    hdVideoCandidates,
    videoCandidates,
    watermarkUrl: watermarkUrl || null,
    audioUrl: audioUrl || null,
    audioCandidates,
  };
}

function isTikTokDomainHost(hostname = "") {
  const normalizedHost = String(hostname || "").toLowerCase();
  return normalizedHost === "tiktok.com" || normalizedHost.endsWith(".tiktok.com");
}

function createTikTokHttpError(statusCode, message, extra = {}) {
  const error = new Error(message || "Terjadi kesalahan TikTok downloader.");
  error.statusCode = Number(statusCode) || 500;
  error.clientMessage = message || "Terjadi kesalahan TikTok downloader.";
  Object.assign(error, extra);
  return error;
}

async function resolveTikTokSourceUrl(
  sourceUrl,
  { timeoutMs = TIKTOK_RAPIDAPI_TIMEOUT_MS } = {},
) {
  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch (_error) {
    throw createTikTokHttpError(400, "URL TikTok tidak valid.");
  }

  if (!isTikTokDomainHost(parsedUrl.hostname)) {
    throw createTikTokHttpError(400, "URL harus berasal dari domain TikTok.");
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(parsedUrl.toString(), {
      method: "GET",
      redirect: "follow",
      signal: abortController.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (response.body) {
      response.body.cancel().catch(() => undefined);
    }

    const resolvedUrl = String(response.url || parsedUrl.toString()).trim();
    let parsedResolvedUrl;
    try {
      parsedResolvedUrl = new URL(resolvedUrl);
    } catch (_error) {
      throw createTikTokHttpError(400, "Gagal resolve redirect URL TikTok.");
    }

    if (!isTikTokDomainHost(parsedResolvedUrl.hostname)) {
      throw createTikTokHttpError(400, "Redirect URL TikTok tidak valid.");
    }

    return parsedResolvedUrl.toString();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createTikTokHttpError(504, "Resolve redirect TikTok timeout. Coba lagi.");
    }

    if (error?.clientMessage) {
      throw error;
    }

    throw createTikTokHttpError(502, "Gagal resolve redirect TikTok.");
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestTikTokDownloadInfo(sourceUrl, { hd } = {}) {
  if (!sourceUrl || !String(sourceUrl).trim()) {
    throw createTikTokHttpError(400, "URL TikTok wajib diisi.");
  }

  const tiktokConfig = getTikTokRapidApiConfig();
  const useHd = hd == null ? tiktokConfig.defaultHd : String(hd).trim() !== "0";

  if (!tiktokConfig.rapidApiKey) {
    throw createTikTokHttpError(500, "TIKTOK_RAPIDAPI_KEY belum diset di server.");
  }

  const resolvedTikTokUrl = await resolveTikTokSourceUrl(String(sourceUrl).trim(), {
    timeoutMs: tiktokConfig.timeoutMs,
  });
  const encodedParams = new URLSearchParams();
  encodedParams.set("url", resolvedTikTokUrl);
  encodedParams.set("hd", useHd ? "1" : "0");

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), tiktokConfig.timeoutMs);

  try {
    const response = await fetch(tiktokConfig.rapidApiUrl, {
      method: "POST",
      headers: {
        "x-rapidapi-key": tiktokConfig.rapidApiKey,
        "x-rapidapi-host": tiktokConfig.rapidApiHost,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encodedParams.toString(),
      signal: abortController.signal,
    });

    const rawText = await response.text().catch(() => "");
    let payload = null;
    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch (_error) {
        payload = null;
      }
    }

    const rapidApiMessage = pickFirstNonEmptyString(
      payload?.message,
      payload?.error,
      payload?.msg,
      payload?.detail,
      payload?.error?.message,
      rawText.length <= 300 ? rawText : "",
    );

    if (!response.ok) {
      const likelyAuthIssue = /not subscribed|forbidden|unauthorized|invalid api key/i.test(
        String(rapidApiMessage || ""),
      );
      throw createTikTokHttpError(
        likelyAuthIssue ? 402 : response.status,
        rapidApiMessage || `TikTok API gagal merespons (${response.status}).`,
      );
    }

    if (/not subscribed/i.test(String(rapidApiMessage || ""))) {
      throw createTikTokHttpError(
        402,
        "RapidAPI key belum subscribe ke API TikTok downloader.",
      );
    }

    const normalizedResult = normalizeTikTokResponse(payload);
    if (!normalizedResult.noWatermarkUrl) {
      throw createTikTokHttpError(
        404,
        rapidApiMessage ||
          "Video no watermark tidak ditemukan dari respons TikTok API.",
      );
    }

    return {
      sourceUrl: resolvedTikTokUrl,
      result: normalizedResult,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createTikTokHttpError(504, "Request ke TikTok API timeout. Coba lagi.");
    }

    if (error?.clientMessage) {
      throw error;
    }

    throw createTikTokHttpError(502, "Gagal menghubungi layanan TikTok downloader.");
  } finally {
    clearTimeout(timeoutId);
  }
}

function isAllowedTikTokMediaHost(hostname = "") {
  const normalizedHost = String(hostname || "").toLowerCase();
  if (!normalizedHost) {
    return false;
  }

  if (isTikTokDomainHost(normalizedHost)) {
    return true;
  }

  return TIKTOK_PROXY_ALLOWED_HOST_KEYWORDS.some((keyword) =>
    normalizedHost.includes(keyword),
  );
}

function isLikelyTikTokCdnHost(hostname = "") {
  const normalizedHost = String(hostname || "").toLowerCase();
  if (!normalizedHost) {
    return false;
  }

  return (
    normalizedHost.includes("tiktokcdn") ||
    normalizedHost.includes("tokcdn") ||
    normalizedHost.includes("ibytedtos") ||
    normalizedHost.includes("byteoversea")
  );
}

function getExtensionFromContentType(contentType = "") {
  const mimeType = String(contentType || "").toLowerCase();

  if (mimeType.includes("video/mp4")) {
    return "mp4";
  }

  if (mimeType.includes("video/webm")) {
    return "webm";
  }

  if (mimeType.includes("audio/mpeg") || mimeType.includes("audio/mp3")) {
    return "mp3";
  }

  if (mimeType.includes("audio/mp4") || mimeType.includes("audio/x-m4a")) {
    return "m4a";
  }

  if (mimeType.includes("audio/webm")) {
    return "webm";
  }

  return "mp4";
}

function sanitizeDownloadFileName(value = "", fallback = "tiktok-file") {
  const cleaned = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F\u007F]/g, "")
    .replace(/[;\r\n]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned || fallback;
}

function toAsciiDownloadFileName(value = "", fallback = "tiktok-file") {
  const cleaned = String(value || "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\;]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned || fallback;
}

function encodeRFC5987FileName(value = "") {
  return encodeURIComponent(String(value || "")).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function shouldRetryTikTokMediaError(error) {
  const code = String(error?.code || error?.cause?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();

  if (error?.name === "AbortError") {
    return true;
  }

  return (
    code === "UND_ERR_SOCKET" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "EPIPE" ||
    code === "ENOTFOUND" ||
    code === "EHOSTUNREACH" ||
    message.includes("terminated") ||
    message.includes("socket") ||
    message.includes("network")
  );
}

async function fetchTikTokMediaResponseWithRetry(mediaUrl) {
  const maxAttempts = Math.max(1, TIKTOK_MEDIA_DOWNLOAD_MAX_RETRIES + 1);
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const abortController = new AbortController();
    const timeoutId = setTimeout(
      () => abortController.abort(),
      TIKTOK_MEDIA_DOWNLOAD_TIMEOUT_MS,
    );

    try {
      const upstreamResponse = await fetch(mediaUrl, {
        method: "GET",
        redirect: "follow",
        signal: abortController.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
          Accept: "*/*",
          Referer: "https://www.tiktok.com/",
        },
      });

      if (!upstreamResponse.ok || !upstreamResponse.body) {
        const sourceError = Object.assign(
          new Error(`Source media response ${upstreamResponse.status}`),
          { statusCode: upstreamResponse.status },
        );
        throw sourceError;
      }

      return upstreamResponse;
    } catch (error) {
      lastError = error;
      const canRetry =
        attempt < maxAttempts &&
        (shouldRetryTikTokMediaError(error) ||
          (Number.isInteger(error?.statusCode) && error.statusCode >= 500));

      if (!canRetry) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error("Gagal mengambil stream media TikTok.");
}

function looksLikeHtmlOrJsonPayload(buffer) {
  if (!buffer || !buffer.length) {
    return true;
  }

  const sample = buffer
    .toString("utf8", 0, Math.min(buffer.length, 512))
    .trim()
    .toLowerCase();

  return (
    sample.startsWith("<!doctype") ||
    sample.startsWith("<html") ||
    sample.startsWith("{") ||
    sample.startsWith("[")
  );
}

function looksLikeMp4Header(buffer) {
  if (!buffer || buffer.length < 12) {
    return false;
  }

  return buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

function looksLikeMp3Header(buffer) {
  if (!buffer || buffer.length < 3) {
    return false;
  }

  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return true;
  }

  return buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
}

async function openValidatedTikTokMediaStream(mediaUrl, { kind = "video" } = {}) {
  const normalizedKind = kind === "audio" ? "audio" : "video";
  const upstreamResponse = await fetchTikTokMediaResponseWithRetry(mediaUrl);
  let finalResponseHost = "";
  try {
    finalResponseHost = String(new URL(upstreamResponse.url || mediaUrl).hostname || "").toLowerCase();
  } catch (_error) {
    finalResponseHost = "";
  }
  const isFinalHostAllowed =
    normalizedKind === "audio"
      ? isAllowedTikTokMediaHost(finalResponseHost)
      : isLikelyTikTokCdnHost(finalResponseHost);
  if (!finalResponseHost || !isFinalHostAllowed) {
    throw createTikTokHttpError(
      502,
      normalizedKind === "audio"
        ? "Source akhir bukan CDN TikTok audio yang valid."
        : "Source akhir bukan CDN TikTok video yang valid.",
    );
  }
  const upstreamContentType = String(
    upstreamResponse.headers.get("content-type") || "",
  ).toLowerCase();

  const isVideoPayload = upstreamContentType.startsWith("video/mp4");
  const isAudioPayload = upstreamContentType.startsWith("audio/");
  const isBinaryPayload =
    upstreamContentType.includes("application/octet-stream") ||
    upstreamContentType.includes("binary/octet-stream");
  const isExpectedContentType =
    normalizedKind === "audio"
      ? isAudioPayload || isBinaryPayload
      : isVideoPayload;

  if (!isExpectedContentType) {
    const sample = await upstreamResponse.text().catch(() => "");
    const compactSample = sample.replace(/\s+/g, " ").trim().slice(0, 180);
    throw createTikTokHttpError(
      502,
      compactSample
        ? `Source media tidak sesuai (${upstreamContentType || "unknown"}): ${compactSample}`
        : `Source media tidak sesuai (${upstreamContentType || "unknown"}).`,
    );
  }

  const streamBody = upstreamResponse.body;
  if (!streamBody) {
    throw createTikTokHttpError(502, "Body stream media kosong.");
  }

  const reader = streamBody.getReader();
  const firstRead = await reader.read();
  if (firstRead.done || !firstRead.value || !firstRead.value.length) {
    await reader.cancel().catch(() => undefined);
    throw createTikTokHttpError(502, "File video kosong.");
  }

  const firstChunk = Buffer.from(firstRead.value);
  if (normalizedKind === "audio") {
    const looksLikeAudioHeader = looksLikeMp3Header(firstChunk) || looksLikeMp4Header(firstChunk);
    if (isBinaryPayload && !looksLikeAudioHeader) {
      await reader.cancel().catch(() => undefined);
      throw createTikTokHttpError(
        502,
        "Header file audio tidak valid.",
      );
    }
  } else if (!looksLikeMp4Header(firstChunk)) {
    await reader.cancel().catch(() => undefined);
    throw createTikTokHttpError(
      502,
      "Header file bukan MP4 valid meskipun content-type video/mp4.",
    );
  }

  if (looksLikeHtmlOrJsonPayload(firstChunk)) {
    await reader.cancel().catch(() => undefined);
    throw createTikTokHttpError(502, "Source media mengembalikan HTML/JSON, bukan video MP4.");
  }

  return {
    upstreamResponse,
    reader,
    firstChunk,
    upstreamContentType,
  };
}

function ensureFileNameWithExtension(fileName = "", extension = "mp4") {
  const safeName = sanitizeDownloadFileName(fileName, "tiktok-file");
  if (/\.[a-z0-9]{2,5}$/i.test(safeName)) {
    return safeName;
  }

  return `${safeName}.${String(extension || "mp4").replace(/[^a-z0-9]/gi, "") || "mp4"}`;
}

function getAttachmentKind(mimeType = "") {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("audio/")) {
    return "audio";
  }

  return "document";
}

function getDefaultPromptForAttachment(attachment) {
  const kind = attachment?.kind;

  if (kind === "image") {
    return "Tolong deskripsikan isi gambar ini secara jelas dalam bahasa Indonesia.";
  }

  if (kind === "audio") {
    return "Tolong transkripsikan audio ini, lalu rangkum poin pentingnya dalam bahasa Indonesia.";
  }

  return "Tolong baca file ini dan jelaskan ringkas isi serta poin pentingnya dalam bahasa Indonesia.";
}

function getAttachmentPart(attachment, role = "user") {
  if (
    role !== "user" ||
    !attachment ||
    typeof attachment.fileUri !== "string" ||
    !attachment.fileUri.trim() ||
    typeof attachment.mimeType !== "string" ||
    !attachment.mimeType.trim()
  ) {
    return null;
  }

  return {
    fileData: {
      mimeType: attachment.mimeType.trim(),
      fileUri: attachment.fileUri.trim(),
    },
  };
}

function buildParts(content = "", attachment, role = "user") {
  const parts = [];

  if (typeof content === "string" && content.trim()) {
    parts.push({ text: content.trim() });
  }

  const attachmentPart = getAttachmentPart(attachment, role);
  if (attachmentPart) {
    parts.push(attachmentPart);
  }

  return parts;
}

function buildImageHistory(history = []) {
  const normalized = history
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim(),
    )
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content.trim() }],
    }))
    .slice(-8);

  while (normalized.length > 0 && normalized[0].role !== "user") {
    normalized.shift();
  }

  return normalized;
}

function normalizeHistory(history = []) {
  const normalized = history
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant"),
    )
    .map((item) => {
      const parts = buildParts(item.content, item.attachment, item.role);
      if (parts.length === 0) {
        return null;
      }

      return {
        role: item.role === "assistant" ? "model" : "user",
        parts,
      };
    })
    .filter(Boolean)
    .slice(-20);

  while (normalized.length > 0 && normalized[0].role !== "user") {
    normalized.shift();
  }

  return normalized;
}

async function waitForFileToBecomeActive(fileName) {
  const { fileManager } = getGeminiClients();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const file = await fileManager.getFile(fileName);

    if (file.state === FileState.ACTIVE) {
      return file;
    }

    if (file.state === FileState.FAILED) {
      throw new Error(file.error?.message || "Gemini gagal memproses file yang diupload.");
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error("File terlalu lama diproses oleh Gemini. Coba lagi.");
}

async function uploadAttachment(file) {
  const { fileManager } = getGeminiClients();
  const uploaded = await fileManager.uploadFile(file.buffer, {
    displayName: file.originalname,
    mimeType: file.mimetype || "application/octet-stream",
  });

  const activeFile = await waitForFileToBecomeActive(uploaded.file.name);

  return {
    kind: getAttachmentKind(activeFile.mimeType || file.mimetype),
    name: file.originalname,
    mimeType: activeFile.mimeType || file.mimetype || "application/octet-stream",
    size: Number(activeFile.sizeBytes || file.size || 0),
    fileUri: activeFile.uri,
  };
}

function buildInlineImagePart(file) {
  if (!file?.buffer || !file?.mimetype?.startsWith("image/")) {
    return null;
  }

  return {
    inline_data: {
      mime_type: file.mimetype,
      data: file.buffer.toString("base64"),
    },
  };
}

function getImageConfigForModel(modelName) {
  const imageConfig = {
    aspectRatio: DEFAULT_IMAGE_ASPECT_RATIO,
  };

  if (
    DEFAULT_IMAGE_SIZE &&
    /gemini-3\.1-flash-image-preview|gemini-3-pro-image-preview/i.test(modelName)
  ) {
    imageConfig.imageSize = DEFAULT_IMAGE_SIZE;
  }

  return imageConfig;
}

function createFetchError(status, payload) {
  const message =
    payload?.error?.message ||
    payload?.error?.status ||
    `Gemini request failed with status ${status}.`;

  return Object.assign(new Error(message), {
    status,
    statusCode: status,
    errorDetails: payload?.error?.details,
  });
}

function getExtensionFromMimeType(mimeType = "") {
  if (mimeType.includes("png")) {
    return "png";
  }

  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return "jpg";
  }

  if (mimeType.includes("webp")) {
    return "webp";
  }

  if (mimeType.includes("gif")) {
    return "gif";
  }

  return "png";
}

function parseGeneratedImageResponse(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const parts = candidates.flatMap((candidate) =>
    Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [],
  );

  let reply = "";
  let inlineData;

  for (const part of parts) {
    if (!reply && typeof part?.text === "string" && part.text.trim()) {
      reply = part.text.trim();
    }

    const currentInlineData = part?.inlineData || part?.inline_data;
    if (!inlineData && currentInlineData?.data) {
      inlineData = currentInlineData;
    }
  }

  if (!inlineData?.data) {
    throw Object.assign(
      new Error("Model image tidak mengembalikan file gambar."),
      { status: 502, statusCode: 502 },
    );
  }

  const mimeType = inlineData.mimeType || inlineData.mime_type || "image/png";
  const fileName = `generated-${Date.now()}.${getExtensionFromMimeType(mimeType)}`;

  return {
    reply: reply || "Aku sudah buatkan gambarnya.",
    attachment: {
      kind: "image",
      name: fileName,
      mimeType,
      size: Buffer.byteLength(inlineData.data, "base64"),
      previewUrl: `data:${mimeType};base64,${inlineData.data}`,
    },
  };
}

async function generateReply({
  requestedModel,
  systemInstruction,
  contents,
  preferMultimodal = false,
}) {
  const { genAI } = getGeminiClients();
  const attemptedModels = [];
  let lastError;
  const generationConfig = getTextGenerationConfig(contents);

  for (const modelName of getCandidateModels(requestedModel, preferMultimodal)) {
    attemptedModels.push(modelName);

    try {
      const trimmedInstruction = String(systemInstruction || "").trim();
      const canUseDeveloperInstruction =
        trimmedInstruction && modelSupportsDeveloperInstruction(modelName);
      const effectiveContents =
        trimmedInstruction && !canUseDeveloperInstruction
          ? embedSystemInstructionIntoContents(trimmedInstruction, contents)
          : contents;

      const generativeModel = genAI.getGenerativeModel(
        canUseDeveloperInstruction
          ? {
              model: modelName,
              systemInstruction: trimmedInstruction,
            }
          : { model: modelName },
      );

      const result = await generativeModel.generateContent({
        contents: effectiveContents,
        generationConfig,
      });
      const reply =
        result.response.text()?.trim() || "Model tidak mengembalikan balasan teks.";

      return {
        reply,
        model: modelName,
        attemptedModels,
      };
    } catch (error) {
      lastError = error;

      if (!shouldTryNextModel(error)) {
        break;
      }
    }
  }

  throw Object.assign(lastError || new Error("Gemini gagal merespons."), {
    attemptedModels,
  });
}

async function generateImageReply({
  requestedModel,
  systemInstruction,
  prompt,
  history,
  imageFile,
}) {
  const { apiKey } = getGeminiClients();
  const attemptedModels = [];
  let lastError;

  for (const modelName of getCandidateImageModels(requestedModel)) {
    attemptedModels.push(modelName);

    try {
      const trimmedInstruction = String(systemInstruction || "").trim();
      const canUseDeveloperInstruction =
        trimmedInstruction && modelSupportsDeveloperInstruction(modelName);

      const inlineImagePart = buildInlineImagePart(imageFile);
      const contents = [
        ...(trimmedInstruction && !canUseDeveloperInstruction
          ? embedSystemInstructionIntoContents(trimmedInstruction, [])
          : []),
        ...buildImageHistory(history),
        {
          role: "user",
          parts: [
            { text: prompt.trim() },
            ...(inlineImagePart ? [inlineImagePart] : []),
          ],
        },
      ];

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              imageConfig: getImageConfigForModel(modelName),
            },
            ...(trimmedInstruction && canUseDeveloperInstruction
              ? {
                  systemInstruction: {
                    parts: [{ text: trimmedInstruction }],
                  },
                }
              : {}),
          }),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw createFetchError(response.status, payload);
      }

      const result = parseGeneratedImageResponse(payload);
      return {
        ...result,
        model: modelName,
        attemptedModels,
      };
    } catch (error) {
      lastError = error;

      if (!shouldTryNextModel(error)) {
        break;
      }
    }
  }

  throw Object.assign(lastError || new Error("Gemini gagal membuat gambar."), {
    attemptedModels,
  });
}

async function generateExternalImageReply({ prompt, requestedModel }) {
  const modelName = requestedModel || DEFAULT_EXTERNAL_IMAGE_MODEL;
  const attemptedModels = [modelName];

  if (!EXTERNAL_IMAGE_API_URL) {
    throw Object.assign(new Error("EXTERNAL_IMAGE_API_URL belum diset di server."), {
      status: 500,
      statusCode: 500,
      attemptedModels,
    });
  }

  if (!EXTERNAL_IMAGE_API_BEARER) {
    throw Object.assign(new Error("EXTERNAL_IMAGE_API_BEARER belum diset di server."), {
      status: 500,
      statusCode: 500,
      attemptedModels,
    });
  }

  const trimmedPrompt = String(prompt || "").trim();
  if (!trimmedPrompt) {
    throw Object.assign(new Error("Prompt gambar tidak boleh kosong."), {
      status: 400,
      statusCode: 400,
      attemptedModels,
    });
  }

  const response = await fetch(EXTERNAL_IMAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${EXTERNAL_IMAGE_API_BEARER}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: trimmedPrompt,
    }),
  });

  if (!response.ok) {
    const rawBody = await response.text().catch(() => "");
    const fallbackMessage = `Image API request gagal dengan status ${response.status}.`;
    let parsed = null;
    if (rawBody) {
      try {
        parsed = JSON.parse(rawBody);
      } catch (_error) {
        parsed = null;
      }
    }
    const message =
      parsed?.error || parsed?.message || parsed?.detail || rawBody || fallbackMessage;
    throw Object.assign(new Error(String(message || fallbackMessage)), {
      status: response.status || 502,
      statusCode: response.status || 502,
      attemptedModels,
    });
  }

  const contentTypeHeader = String(response.headers.get("content-type") || "image/png");
  const mimeType = contentTypeHeader.split(";")[0].trim() || "image/png";
  const imageBuffer = Buffer.from(await response.arrayBuffer());

  if (!imageBuffer.length || !mimeType.startsWith("image/")) {
    throw Object.assign(new Error("Image API tidak mengembalikan file gambar valid."), {
      status: 502,
      statusCode: 502,
      attemptedModels,
    });
  }

  const extension = getExtensionFromMimeType(mimeType);
  const base64 = imageBuffer.toString("base64");

  return {
    reply: "Gambar berhasil dibuat.",
    model: modelName,
    attemptedModels,
    attachment: {
      kind: "image",
      name: `generated-${Date.now()}.${extension}`,
      mimeType,
      size: imageBuffer.length,
      previewUrl: `data:${mimeType};base64,${base64}`,
    },
  };
}

app.post("/api/chat", upload.single("attachment"), async (req, res) => {
  try {
    const body = req.body || {};
    const history = parseJsonField(body.history, []);
    const message = typeof body.message === "string" ? body.message : "";
    const systemInstruction =
      typeof body.systemInstruction === "string" ? body.systemInstruction : "";
    const requestedModel = typeof body.model === "string" ? body.model : "";
    const historyAttachment = parseJsonField(body.attachment, undefined);
    const uploadedAttachment = req.file ? await uploadAttachment(req.file) : null;
    const currentAttachment = uploadedAttachment || historyAttachment;
    const { apiKey } = getGeminiClients();

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY belum diset di server.",
      });
    }

    const resolvedMessage =
      typeof message === "string" && message.trim()
        ? message
        : currentAttachment
          ? getDefaultPromptForAttachment(currentAttachment)
          : "";

    const parts = buildParts(resolvedMessage, currentAttachment, "user");
    if (parts.length === 0) {
      return res.status(400).json({
        error: "Pesan, gambar, file, atau audio tidak boleh kosong.",
      });
    }

    const contents = [
      ...normalizeHistory(history),
      {
        role: "user",
        parts,
      },
    ];

    const result = await generateReply({
      requestedModel,
      systemInstruction,
      contents,
      preferMultimodal: Boolean(currentAttachment),
    });

    return res.json({
      reply: result.reply,
      model: result.model,
      attachment: uploadedAttachment || undefined,
    });
  } catch (error) {
    console.error("SERVER ERROR:", error);
    const clientError = createClientError(error, error?.attemptedModels || []);

    if (
      clientError.status === 429 &&
      Number.isInteger(clientError.payload?.retryAfterSeconds)
    ) {
      res.set("Retry-After", String(clientError.payload.retryAfterSeconds));
    }

    return res.status(clientError.status).json(clientError.payload);
  }
});

app.post("/api/chat/image", upload.single("attachment"), async (req, res) => {
  try {
    const body = req.body || {};
    const history = parseJsonField(body.history, []);
    const message = typeof body.message === "string" ? body.message : "";
    const systemInstruction =
      typeof body.systemInstruction === "string" ? body.systemInstruction : "";
    const requestedModel = typeof body.model === "string" ? body.model : "";
    const useExternalImage =
      FORCE_EXTERNAL_IMAGE_API || isExternalImageModel(requestedModel);
    const { apiKey } = getGeminiClients();

    if (!useExternalImage && !apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY belum diset di server.",
      });
    }

    if (!message.trim()) {
      return res.status(400).json({
        error: "Prompt gambar tidak boleh kosong.",
      });
    }

    if (req.file && !req.file.mimetype?.startsWith("image/")) {
      return res.status(400).json({
        error: "Mode generate image hanya menerima file gambar sebagai referensi.",
      });
    }

    const result = useExternalImage
      ? await generateExternalImageReply({
          requestedModel: isExternalImageModel(requestedModel)
            ? requestedModel
            : DEFAULT_EXTERNAL_IMAGE_MODEL,
          prompt: message,
        })
      : await generateImageReply({
          requestedModel,
          systemInstruction,
          prompt: message,
          history,
          imageFile: req.file || null,
        });

    return res.json({
      reply: result.reply,
      model: result.model,
      attachment: result.attachment,
    });
  } catch (error) {
    console.error("IMAGE SERVER ERROR:", error);
    const clientError = createClientError(error, error?.attemptedModels || []);

    if (
      clientError.status === 429 &&
      Number.isInteger(clientError.payload?.retryAfterSeconds)
    ) {
      res.set("Retry-After", String(clientError.payload.retryAfterSeconds));
    }

    return res.status(clientError.status).json(clientError.payload);
  }
});

app.post("/api/deploy/github/start", async (req, res) => {
  const repositoryInput = String(
    req.body?.repositoryUrl || req.body?.repository || req.body?.repo || "",
  ).trim();
  const branch = String(req.body?.branch || "main").trim() || "main";
  const workflow = normalizeGithubWorkflowId(req.body?.workflow);

  if (!repositoryInput) {
    return res.status(400).json({
      ok: false,
      error: "Repository URL wajib diisi.",
    });
  }

  const repository = parseGithubRepositoryInput(repositoryInput);
  if (!repository) {
    return res.status(400).json({
      ok: false,
      error: "Repository harus format owner/repo atau URL GitHub yang valid.",
    });
  }

  try {
    await githubApiRequest(
      `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
      {
        method: "POST",
        body: {
          ref: branch,
        },
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 1400));
    const latestRun = await fetchLatestGithubWorkflowRun({
      owner: repository.owner,
      repo: repository.repo,
      workflow,
      branch,
    });

    return res.json({
      ok: true,
      owner: repository.owner,
      repo: repository.repo,
      branch,
      workflow,
      pagesUrl: buildGithubPagesUrl(repository.owner, repository.repo),
      run: latestRun,
    });
  } catch (error) {
    console.error("GITHUB DEPLOY START ERROR:", error);
    const statusCode = Number(error?.statusCode) || 502;
    return res.status(statusCode).json({
      ok: false,
      error:
        error?.message ||
        "Gagal menjalankan workflow deploy GitHub. Cek token/repo/workflow.",
    });
  }
});

app.get("/api/deploy/github/status", async (req, res) => {
  const owner = sanitizeGithubName(req.query?.owner || "");
  const repo = sanitizeGithubName(req.query?.repo || "");
  const branch = String(req.query?.branch || "main").trim() || "main";
  const workflow = normalizeGithubWorkflowId(req.query?.workflow);
  const runId = Number.parseInt(String(req.query?.runId || ""), 10);

  if (!owner || !repo) {
    return res.status(400).json({
      ok: false,
      error: "Parameter owner dan repo wajib diisi.",
    });
  }

  try {
    const run = Number.isInteger(runId) && runId > 0
      ? await fetchGithubWorkflowRunById({
          owner,
          repo,
          runId,
        })
      : await fetchLatestGithubWorkflowRun({
          owner,
          repo,
          workflow,
          branch,
        });

    return res.json({
      ok: true,
      owner,
      repo,
      branch,
      workflow,
      pagesUrl: buildGithubPagesUrl(owner, repo),
      run,
    });
  } catch (error) {
    console.error("GITHUB DEPLOY STATUS ERROR:", error);
    const statusCode = Number(error?.statusCode) || 502;
    return res.status(statusCode).json({
      ok: false,
      error:
        error?.message || "Gagal mengambil status deploy GitHub.",
    });
  }
});

app.post("/api/tiktok/download", async (req, res) => {
  const sourceUrl = String(req.body?.url || "").trim();
  const hd = req.body?.hd == null ? TIKTOK_DEFAULT_HD : String(req.body.hd).trim() !== "0";

  try {
    const downloadInfo = await requestTikTokDownloadInfo(sourceUrl, { hd });

    return res.json({
      ok: true,
      sourceUrl: downloadInfo.sourceUrl,
      result: downloadInfo.result,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 502;
    const errorMessage =
      error?.clientMessage || error?.message || "Gagal menghubungi layanan TikTok downloader.";
    console.error("TIKTOK DOWNLOAD ERROR:", error);
    return res.status(statusCode).json({
      ok: false,
      error: errorMessage,
    });
  }
});

async function handleTikTokFileDownload(req, res) {
  const sourceInput = String(req.query?.url || req.body?.url || "").trim();
  const requestedKind = String(req.query?.kind || req.body?.kind || "video")
    .trim()
    .toLowerCase();
  const mediaKind =
    requestedKind === "audio" ? "audio" : requestedKind === "hd" ? "hd" : "video";
  const hdParam = req.body?.hd ?? req.query?.hd;
  const hd =
    mediaKind === "hd"
      ? true
      : hdParam == null
        ? TIKTOK_DEFAULT_HD
        : String(hdParam).trim() !== "0";
  const isHeadRequest = req.method === "HEAD";

  if (!sourceInput) {
    return res.status(400).json({
      ok: false,
      error: "Parameter url wajib diisi.",
    });
  }

  let parsedSourceUrl;
  try {
    parsedSourceUrl = new URL(sourceInput);
  } catch (_error) {
    return res.status(400).json({
      ok: false,
      error: "URL TikTok/media tidak valid.",
    });
  }

  const sourceProtocol = String(parsedSourceUrl.protocol || "").toLowerCase();
  if (sourceProtocol !== "http:" && sourceProtocol !== "https:") {
    return res.status(400).json({
      ok: false,
      error: "Protocol URL tidak didukung.",
    });
  }

  try {
    const sourceHostname = String(parsedSourceUrl.hostname || "").toLowerCase();
    const isTikTokSource = isTikTokDomainHost(sourceHostname);
    const isDirectMediaSource = isAllowedTikTokMediaHost(sourceHostname);
    if (!isTikTokSource && !isDirectMediaSource) {
      return res.status(400).json({
        ok: false,
        error: "URL harus berasal dari domain TikTok atau CDN media TikTok yang valid.",
      });
    }

    let resolvedRawMediaCandidates = [];
    if (isTikTokSource) {
      const downloadInfo = await requestTikTokDownloadInfo(parsedSourceUrl.toString(), { hd });
      resolvedRawMediaCandidates =
        mediaKind === "audio"
          ? Array.isArray(downloadInfo.result?.audioCandidates)
            ? downloadInfo.result.audioCandidates
            : collectUrlCandidates(downloadInfo.result?.audioUrl)
          : mediaKind === "hd"
            ? Array.isArray(downloadInfo.result?.hdVideoCandidates)
              ? downloadInfo.result.hdVideoCandidates
              : collectUrlCandidates(
                  downloadInfo.result?.hdNoWatermarkUrl,
                  downloadInfo.result?.noWatermarkUrl,
                )
            : Array.isArray(downloadInfo.result?.videoCandidates)
              ? downloadInfo.result.videoCandidates
              : collectUrlCandidates(
                  downloadInfo.result?.noWatermarkUrl,
                  downloadInfo.result?.hdNoWatermarkUrl,
                );
    } else {
      resolvedRawMediaCandidates = collectUrlCandidates(parsedSourceUrl.toString());
    }
    const cdnMediaCandidates = resolvedRawMediaCandidates.filter((candidate) => {
      try {
        const parsed = new URL(candidate);
        const hostname = String(parsed.hostname || "").toLowerCase();
        return isAllowedTikTokMediaHost(hostname) && isLikelyTikTokCdnHost(hostname);
      } catch (_error) {
        return false;
      }
    });
    const candidatePool = cdnMediaCandidates.length
      ? cdnMediaCandidates
      : resolvedRawMediaCandidates.filter((candidate) => {
          try {
            const parsed = new URL(candidate);
            const hostname = String(parsed.hostname || "").toLowerCase();
            return isAllowedTikTokMediaHost(hostname);
          } catch (_error) {
            return false;
          }
        });

    if (!candidatePool.length) {
      return res.status(404).json({
        ok: false,
        error:
          mediaKind === "audio"
            ? "URL audio TikTok tidak ditemukan."
            : mediaKind === "hd"
              ? "URL video HD TikTok tidak ditemukan."
              : "URL video tanpa watermark dari CDN TikTok tidak ditemukan.",
      });
    }

    let validatedStream = null;
    let lastStreamError = null;
    for (const candidateUrl of candidatePool) {
      try {
        validatedStream = await openValidatedTikTokMediaStream(candidateUrl, {
          kind: mediaKind === "audio" ? "audio" : "video",
        });
        break;
      } catch (error) {
        lastStreamError = error;
      }
    }

    if (!validatedStream) {
      throw createTikTokHttpError(
        Number(lastStreamError?.statusCode) || 502,
        lastStreamError?.clientMessage ||
          "URL video MP4 tanpa watermark tidak valid atau gagal diakses.",
      );
    }

    const { reader, firstChunk } = validatedStream;
    const responseContentType =
      mediaKind === "audio" ? "audio/mpeg" : "video/mp4";
    const responseFileName =
      mediaKind === "audio"
        ? "tiktok-audio.mp3"
        : mediaKind === "hd"
          ? "tiktok-video-hd.mp4"
          : "tiktok-video.mp4";

    res.status(200);
    res.setHeader("Content-Type", responseContentType);
    res.setHeader("Content-Disposition", `attachment; filename="${responseFileName}"`);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Type");

    if (isHeadRequest) {
      await reader.cancel().catch(() => undefined);
      return res.end();
    }

    async function* tikTokStreamGenerator() {
      yield firstChunk;
      while (true) {
        const next = await reader.read();
        if (next.done) {
          break;
        }

        if (next.value && next.value.length) {
          yield Buffer.from(next.value);
        }
      }
    }

    await pipeline(Readable.from(tikTokStreamGenerator()), res);
    return undefined;
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 502;
    const errorMessage =
      error?.clientMessage || error?.message || "Gagal memproses download file TikTok.";
    console.error("TIKTOK FILE DOWNLOAD ERROR:", error);

    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : new Error(errorMessage));
      return undefined;
    }

    return res.status(statusCode).json({
      ok: false,
      error: errorMessage,
    });
  }
}

app.get("/api/tiktok/download/file", handleTikTokFileDownload);
app.head("/api/tiktok/download/file", handleTikTokFileDownload);
app.post("/api/tiktok/download/file", handleTikTokFileDownload);

app.use((error, _req, res, next) => {
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: "Ukuran file terlalu besar. Maksimal 20MB untuk chat dan 5MB untuk profil.",
    });
  }

  return next(error);
});

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT} with text model ${DEFAULT_TEXT_MODEL}, multimodal model ${DEFAULT_MULTIMODAL_MODEL}, and image model ${DEFAULT_IMAGE_MODEL}`,
  );
});
