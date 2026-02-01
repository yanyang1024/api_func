import { ApiResponse, SearchQuery, SearchResult } from "../core/types.js";

export interface DatabaseConfig {
  type: "sqlite" | "mysql" | "postgresql";
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
}

export interface QueryResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  executionTime: number;
}

export class DatabaseService {
  private config: DatabaseConfig;
  private pool: Map<string, any> = new Map();

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // 根据数据库类型初始化连接
    switch (this.config.type) {
      case "sqlite":
        await this.initSqlite();
        break;
      case "mysql":
        await this.initMysql();
        break;
      case "postgresql":
        await this.initPostgresql();
        break;
    }
  }

  private async initSqlite(): Promise<void> {
    // SQLite本地文件数据库
    const { default: sqlite3 } = await import("sqlite3");
    const dbPath = this.config.database;
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) reject(err);
        else {
          this.pool.set("main", db);
          resolve();
        }
      });
    });
  }

  private async initMysql(): Promise<void> {
    // MySQL连接
    const mysql = await import("mysql2/promise");
    const conn = await mysql.createConnection({
      host: this.config.host,
      port: this.config.port || 3306,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
    });
    this.pool.set("main", conn);
  }

  private async initPostgresql(): Promise<void> {
    // PostgreSQL连接
    const pg = await import("pg");
    const conn = new pg.Client({
      host: this.config.host,
      port: this.config.port || 5432,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
    });
    await conn.connect();
    this.pool.set("main", conn);
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const startTime = Date.now();
    const db = this.pool.get("main");

    if (!db) {
      throw new Error("数据库未连接");
    }

    if (this.config.type === "sqlite") {
      return this.querySqlite(db, sql, params, startTime);
    } else {
      return this.queryOther(db, sql, params, startTime);
    }
  }

  private async querySqlite(
    db: any,
    sql: string,
    params: unknown[] | undefined,
    startTime: number
  ): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      db.all(sql, params || [], (err: Error, rows: any[]) => {
        const executionTime = Date.now() - startTime;
        
        if (err) {
          reject(err);
          return;
        }

        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        
        resolve({
          columns,
          rows,
          rowCount: rows.length,
          executionTime,
        });
      });
    });
  }

  private async queryOther(
    db: any,
    sql: string,
    params: unknown[] | undefined,
    startTime: number
  ): Promise<QueryResult> {
    const [rows] = await db.execute(sql, params || []);
    const executionTime = Date.now() - startTime;

    const resultRows = Array.isArray(rows) ? rows : [];
    const columns = resultRows.length > 0 ? Object.keys(resultRows[0]) : [];

    return {
      columns,
      rows: resultRows,
      rowCount: resultRows.length,
      executionTime,
    };
  }

  async execute(sql: string, params?: unknown[]): Promise<{ affectedRows: number }> {
    const db = this.pool.get("main");
    
    if (!db) {
      throw new Error("数据库未连接");
    }

    if (this.config.type === "sqlite") {
      return new Promise((resolve, reject) => {
        db.run(sql, params || [], function (err: Error) {
          if (err) reject(err);
          else resolve({ affectedRows: this.changes });
        });
      });
    } else {
      const [result] = await db.execute(sql, params || []);
      return { affectedRows: result.affectedRows || 0 };
    }
  }

  async close(): Promise<void> {
    for (const [name, db] of this.pool) {
      if (this.config.type === "sqlite") {
        db.close();
      } else {
        await db.end();
      }
      this.pool.delete(name);
    }
  }

  async getTables(): Promise<string[]> {
    const sql = this.config.type === "sqlite"
      ? "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      : "SHOW TABLES";
    
    const result = await this.query(sql);
    return result.rows.map((row: any) => Object.values(row)[0] as string);
  }

  async describeTable(tableName: string): Promise<Array<{
    name: string;
    type: string;
    nullable: boolean;
    default: unknown;
  }>> {
    let sql: string;
    
    if (this.config.type === "sqlite") {
      sql = `PRAGMA table_info(${tableName})`;
      const result = await this.query(sql);
      return result.rows.map((row: any) => ({
        name: row.name,
        type: row.type,
        nullable: row.notnull === 0,
        default: row.dflt_value,
      }));
    } else if (this.config.type === "mysql") {
      sql = `DESCRIBE ${tableName}`;
      const result = await this.query(sql);
      return result.rows.map((row: any) => ({
        name: row.Field,
        type: row.Type,
        nullable: row.Null === "YES",
        default: row.Default,
      }));
    }
    
    throw new Error(`不支持的数据库类型: ${this.config.type}`);
  }
}

export const createDatabaseService = (config: DatabaseConfig): DatabaseService => {
  return new DatabaseService(config);
};
