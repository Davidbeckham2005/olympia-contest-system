import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";
import { config } from "./env.js";
import { TEAM_DEFS } from "./constants.js";
//vụ kết nối, khởi tạo và chuẩn hóa cách truy vấn Cơ sở dữ


const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Đường dẫn file SQLite mặc định nằm trong server/data (cùng chỗ với questions JSON).
// Có thể ghi đè bằng env DB_PATH (vd khi mount Persistent Disk ở thư mục riêng để
// tránh che khuất các file câu hỏi trong server/data). DB_PATH phải là đường dẫn tuyệt đối.
const SQLITE_PATH = process.env.DB_PATH
  ? process.env.DB_PATH
  : path.join(__dirname, "../data/cuoc_thi.sqlite");
const SQLITE_SCHEMA = path.join(__dirname, "../db/schema.sql");
const MYSQL_SCHEMA = path.join(__dirname, "../db/schema.mysql.sql");

let sqliteDb = null;
let mysqlPool = null;

function splitStatements(sql) {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
//Mỗi loại CSDL (SQLite / MySQL) có cú pháp thực thi truy vấn khác nhau.
// File này sử dụng Design Pattern Wrapper (wrapSqlite và wrapMysql) để quy về cùng 1 chuẩn duy nhất:
function wrapSqlite(database) {
  return {
    async query(sql, params = []) {
      const trimmed = sql.trim().replace(/;$/, "");
      const stmt = database.prepare(trimmed);
      if (/^(SELECT|PRAGMA)/i.test(trimmed)) {
        const values = params.map((p) => (p === undefined ? null : p));
        return stmt.all(...values);
      }
      stmt.run(...params.map((p) => (p === undefined ? null : p)));
      return [];
    },
    async beginTransaction() {
      database.exec("BEGIN");
    },
    async commit() {
      database.exec("COMMIT");
    },
    async rollback() {
      database.exec("ROLLBACK");
    },
    release() {},
  };
}

function wrapMysql(conn) {
  return {
    async query(sql, params = []) {
      const [rows] = await conn.query(sql, params);
      return rows;
    },
    beginTransaction: () => conn.beginTransaction(),
    commit: () => conn.commit(),
    rollback: () => conn.rollback(),
    release: () => conn.release(),
  };
}

export async function connectDb() {
  if (config.db.client === "mysql") {
    const mysql = await import("mysql2/promise");
    const { host, port, user, password, database } = config.db;
    try {
      const bootstrap = await mysql.createConnection({ host, port, user, password });
      await bootstrap.query(
        `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      await bootstrap.end();
      mysqlPool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
      });
      const schema = fs.readFileSync(MYSQL_SCHEMA, "utf8");
      for (const sql of splitStatements(schema)) {
        await mysqlPool.query(sql);
      }
      await migrate();
      console.log(`Đã kết nối MySQL: ${user}@${host}:${port}/${database}`);
      return;
    } catch (err) {
      throw new Error(
        `Không kết nối được MySQL. Kiểm tra XAMPP đang chạy và .env. Chi tiết: ${err.message}`
      );
    }
  }

  fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
  sqliteDb = new DatabaseSync(SQLITE_PATH);
  const schema = fs.readFileSync(SQLITE_SCHEMA, "utf8");
  for (const sql of splitStatements(schema)) {
    sqliteDb.exec(sql);
  }
  await migrate();
  console.log(`Đã kết nối SQLite: ${SQLITE_PATH}`);
}

// Nâng cấp CSDL cũ lên cấu trúc mới (idempotent)
async function migrate() {
  const conn = await getConnection();
  try {
    // v1: mật khẩu đăng nhập của từng đội
    try {
      await conn.query("ALTER TABLE teams ADD COLUMN pass TEXT NOT NULL DEFAULT ''");
      console.log("Đã nâng cấp CSDL: thêm cột teams.pass");
    } catch {
      /* cột đã tồn tại */
    }
    // v2: nền màn hình khán giả (kiểu nền + ảnh nền mờ)
    try {
      await conn.query("ALTER TABLE settings ADD COLUMN audience_bg TEXT NOT NULL DEFAULT 'dark'");
      console.log("Đã nâng cấp CSDL: thêm cột settings.audience_bg");
    } catch {
      /* cột đã tồn tại */
    }
    try {
      await conn.query("ALTER TABLE settings ADD COLUMN audience_bg_url TEXT NOT NULL DEFAULT ''");
      console.log("Đã nâng cấp CSDL: thêm cột settings.audience_bg_url");
    } catch {
      /* cột đã tồn tại */
    }
    // v3: trạng thái loại đội vĩnh viễn (MC tự bấm khóa)
    try {
      await conn.query("ALTER TABLE teams ADD COLUMN eliminated INTEGER NOT NULL DEFAULT 0");
      console.log("Đã nâng cấp CSDL: thêm cột teams.eliminated");
    } catch {
      /* cột đã tồn tại */
    }
    // Đội nào chưa có mật khẩu thì gán mặc định theo TEAM_DEFS
    for (const def of TEAM_DEFS) {
      if (!def.pass) continue;
      await conn.query(
        "UPDATE teams SET pass = ? WHERE id = ? AND (pass IS NULL OR pass = '')",
        [def.pass, def.id]
      );
    }
  } finally {
    conn.release();
  }
}

export async function getConnection() {
  if (config.db.client === "mysql") {
    if (!mysqlPool) throw new Error("CSDL chưa được kết nối.");
    const conn = await mysqlPool.getConnection();
    return wrapMysql(conn);
  }
  if (!sqliteDb) throw new Error("CSDL chưa được kết nối.");
  return wrapSqlite(sqliteDb);
}
