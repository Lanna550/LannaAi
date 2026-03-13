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
const AUTH_DEFAULT_BIO = "Halo! Aku suka anime!";
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
let persistenceMode = PERSISTENCE_MODE === "file" ? "file" : "mysql";
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

app.use(cors());
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
      } else {
        throw error;
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
  return {
    id: String(row.id || ""),
    username: String(row.username || ""),
    email: String(row.email || ""),
    displayName: String(row.username || ""),
    bio: String(row.bio || AUTH_DEFAULT_BIO),
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

  return runWithPersistence({
    mysqlTask: async () => {
      const [rows] = await dbPool.execute(
        "SELECT id, user_id, message, response, created_at FROM chats WHERE user_id = ? ORDER BY created_at ASC, id ASC",
        [normalizedUserId],
      );

      return Array.isArray(rows) ? rows : [];
    },
    fileTask: async () =>
      withFileLock("chats", async () => {
        const store = await readChatsStore();
        const rows = store.chatsByUserId[String(normalizedUserId)];
        return Array.isArray(rows) ? rows : [];
      }),
  });
}

async function saveChatRowsForUser(userId, sessions = []) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return { ok: false, savedRows: 0 };
  }

  const rows = buildChatRowsForStorage(normalizedUserId, sessions);

  return runWithPersistence({
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
    fileTask: async () =>
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
      }),
  });
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
    "Halo! Aku Lanna, teman ceritamu. Kamu bisa cerita apa pun: sedih, senang, capek, atau bingung. Aku dengerin ya.",
  furina:
    "Furina siap jadi spesialis generate gambarmu. Jelaskan visual yang kamu mau, nanti aku buatkan gambarnya.",
  inori: "Halo! Inori di sini. Yuk ngobrol.",
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
  const apiKeyFingerprint = apiKey
    ? crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 8)
    : null;

  return res.json({
    ok: true,
    persistence: persistenceMode,
    hasGeminiApiKey: Boolean(apiKey),
    geminiApiKeyFingerprint: apiKeyFingerprint,
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
      ? ` Coba lagi dalam sekitar ${retryAfterSeconds} detik atau ganti API key / aktifkan billing Gemini.`
      : " Coba lagi beberapa saat atau ganti API key / aktifkan billing Gemini.";

    return {
      status,
      payload: {
        code: "GEMINI_QUOTA_EXCEEDED",
        error:
          (isZeroQuota
            ? "Kuota Gemini API untuk project/key ini terdeteksi 0 (free tier tidak aktif / billing belum aktif). "
            : "Permintaan ke Gemini terkena batas kuota atau rate limit.") +
          retryMessage,
        retryAfterSeconds,
        attemptedModels,
      },
    };
  }

  if (status === 401 || status === 403) {
    return {
      status,
      payload: {
        code: "GEMINI_AUTH_ERROR",
        error:
          "GEMINI_API_KEY di server tidak valid, tidak aktif, atau tidak punya akses ke model yang dipakai.",
        attemptedModels,
      },
    };
  }

  return {
    status,
    payload: {
      code: "GEMINI_REQUEST_FAILED",
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
    const { apiKey } = getGeminiClients();

    if (!apiKey) {
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

    const result = await generateImageReply({
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
