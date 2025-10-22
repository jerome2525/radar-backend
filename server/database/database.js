const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, '../data/radar.db');
    this.db = null;
    this.isPostgreSQL = !!process.env.DATABASE_URL;
    this.pgPool = null;
  }

  /**
   * Initialize database connection and create tables
   */
  async init() {
    if (this.isPostgreSQL) {
      return this.initPostgreSQL();
    } else {
      return this.initSQLite();
    }
  }

  async initSQLite() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening SQLite database:', err.message);
          reject(err);
          return;
        }
        
        console.log('Connected to SQLite database');
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  async initPostgreSQL() {
    try {
      this.pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      console.log('Connected to PostgreSQL database');
      await this.createTables();
    } catch (error) {
      console.error('Error connecting to PostgreSQL:', error.message);
      throw error;
    }
  }

  /**
   * Create necessary tables
   */
  async createTables() {
    if (this.isPostgreSQL) {
      return this.createPostgreSQLTables();
    } else {
      return this.createSQLiteTables();
    }
  }

  async createSQLiteTables() {
    return new Promise((resolve, reject) => {
      const createRadarDataTable = `
        CREATE TABLE IF NOT EXISTS radar_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp DATETIME NOT NULL,
          lat REAL NOT NULL,
          lon REAL NOT NULL,
          reflectivity REAL NOT NULL,
          precipitation TEXT NOT NULL,
          color TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createRadarMetadataTable = `
        CREATE TABLE IF NOT EXISTS radar_metadata (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp DATETIME NOT NULL,
          source_file TEXT,
          total_points INTEGER NOT NULL,
          bounds_json TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createIndexes = `
        CREATE INDEX IF NOT EXISTS idx_radar_timestamp ON radar_data(timestamp);
        CREATE INDEX IF NOT EXISTS idx_radar_location ON radar_data(lat, lon);
        CREATE INDEX IF NOT EXISTS idx_metadata_timestamp ON radar_metadata(timestamp);
      `;

      this.db.serialize(() => {
        this.db.run(createRadarDataTable);
        this.db.run(createRadarMetadataTable);
        this.db.run(createIndexes, (err) => {
          if (err) {
            console.error('Error creating SQLite tables:', err.message);
            reject(err);
            return;
          }
          
          console.log('SQLite database tables created successfully');
          resolve();
        });
      });
    });
  }

  async createPostgreSQLTables() {
    try {
      const createRadarDataTable = `
        CREATE TABLE IF NOT EXISTS radar_data (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL,
          lat DECIMAL(10, 8) NOT NULL,
          lon DECIMAL(11, 8) NOT NULL,
          reflectivity DECIMAL(5, 2) NOT NULL,
          precipitation VARCHAR(20) NOT NULL,
          color VARCHAR(7) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createRadarMetadataTable = `
        CREATE TABLE IF NOT EXISTS radar_metadata (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL,
          source_file VARCHAR(255),
          total_points INTEGER NOT NULL,
          bounds_json TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createIndexes = `
        CREATE INDEX IF NOT EXISTS idx_radar_timestamp ON radar_data(timestamp);
        CREATE INDEX IF NOT EXISTS idx_radar_location ON radar_data(lat, lon);
        CREATE INDEX IF NOT EXISTS idx_metadata_timestamp ON radar_metadata(timestamp);
      `;

      await this.pgPool.query(createRadarDataTable);
      await this.pgPool.query(createRadarMetadataTable);
      await this.pgPool.query(createIndexes);
      
      console.log('PostgreSQL database tables created successfully');
    } catch (error) {
      console.error('Error creating PostgreSQL tables:', error.message);
      throw error;
    }
  }

  /**
   * Store radar data points
   */
  async storeRadarData(timestamp, radarPoints) {
    if (this.isPostgreSQL) {
      return this.storeRadarDataPostgreSQL(timestamp, radarPoints);
    } else {
      return this.storeRadarDataSQLite(timestamp, radarPoints);
    }
  }

  async storeRadarDataSQLite(timestamp, radarPoints) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO radar_data (timestamp, lat, lon, reflectivity, precipitation, color)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      let completed = 0;
      const total = radarPoints.length;

      if (total === 0) {
        resolve();
        return;
      }

      radarPoints.forEach(point => {
        stmt.run([timestamp, point.lat, point.lon, point.reflectivity, point.precipitation, point.color], (err) => {
          if (err) {
            console.error('Error inserting radar data:', err.message);
            reject(err);
            return;
          }
          
          completed++;
          if (completed === total) {
            stmt.finalize();
            resolve();
          }
        });
      });
    });
  }

  async storeRadarDataPostgreSQL(timestamp, radarPoints) {
    try {
      if (radarPoints.length === 0) {
        return;
      }

      const values = radarPoints.map(point => 
        `('${timestamp}', ${point.lat}, ${point.lon}, ${point.reflectivity}, '${point.precipitation}', '${point.color}')`
      ).join(',');

      const query = `
        INSERT INTO radar_data (timestamp, lat, lon, reflectivity, precipitation, color)
        VALUES ${values}
      `;

      await this.pgPool.query(query);
    } catch (error) {
      console.error('Error storing radar data in PostgreSQL:', error.message);
      throw error;
    }
  }

  /**
   * Store radar metadata
   */
  async storeRadarMetadata(timestamp, sourceFile, totalPoints, bounds) {
    if (this.isPostgreSQL) {
      return this.storeRadarMetadataPostgreSQL(timestamp, sourceFile, totalPoints, bounds);
    } else {
      return this.storeRadarMetadataSQLite(timestamp, sourceFile, totalPoints, bounds);
    }
  }

  async storeRadarMetadataSQLite(timestamp, sourceFile, totalPoints, bounds) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO radar_metadata (timestamp, source_file, total_points, bounds_json)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run([timestamp, sourceFile, totalPoints, JSON.stringify(bounds)], (err) => {
        if (err) {
          console.error('Error inserting radar metadata:', err.message);
          reject(err);
          return;
        }
        
        stmt.finalize();
        resolve();
      });
    });
  }

  async storeRadarMetadataPostgreSQL(timestamp, sourceFile, totalPoints, bounds) {
    try {
      const query = `
        INSERT INTO radar_metadata (timestamp, source_file, total_points, bounds_json)
        VALUES ($1, $2, $3, $4)
      `;

      await this.pgPool.query(query, [timestamp, sourceFile, totalPoints, JSON.stringify(bounds)]);
    } catch (error) {
      console.error('Error storing radar metadata in PostgreSQL:', error.message);
      throw error;
    }
  }

  /**
   * Get latest radar data
   */
  async getLatestRadarData() {
    if (this.isPostgreSQL) {
      return this.getLatestRadarDataPostgreSQL();
    } else {
      return this.getLatestRadarDataSQLite();
    }
  }

  async getLatestRadarDataSQLite() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM radar_data 
        WHERE timestamp = (SELECT MAX(timestamp) FROM radar_data)
        ORDER BY created_at DESC
      `;

      this.db.all(query, (err, rows) => {
        if (err) {
          console.error('Error fetching latest radar data:', err.message);
          reject(err);
          return;
        }

        if (rows.length === 0) {
          resolve(null);
          return;
        }

        const latestTimestamp = rows[0].timestamp;
        const data = rows.map(row => ({
          lat: row.lat,
          lon: row.lon,
          reflectivity: row.reflectivity,
          precipitation: row.precipitation,
          color: row.color
        }));

        resolve({
          timestamp: latestTimestamp,
          data: data
        });
      });
    });
  }

  async getLatestRadarDataPostgreSQL() {
    try {
      const query = `
        SELECT * FROM radar_data 
        WHERE timestamp = (SELECT MAX(timestamp) FROM radar_data)
        ORDER BY created_at DESC
      `;

      const result = await this.pgPool.query(query);
      
      if (result.rows.length === 0) {
        return null;
      }

      const latestTimestamp = result.rows[0].timestamp;
      const data = result.rows.map(row => ({
        lat: parseFloat(row.lat),
        lon: parseFloat(row.lon),
        reflectivity: parseFloat(row.reflectivity),
        precipitation: row.precipitation,
        color: row.color
      }));

      return {
        timestamp: latestTimestamp,
        data: data
      };
    } catch (error) {
      console.error('Error fetching latest radar data from PostgreSQL:', error.message);
      throw error;
    }
  }

  /**
   * Get radar data within bounds
   */
  async getRadarDataByBounds(minLat, maxLat, minLon, maxLon, timestamp = null) {
    if (this.isPostgreSQL) {
      return this.getRadarDataByBoundsPostgreSQL(minLat, maxLat, minLon, maxLon, timestamp);
    } else {
      return this.getRadarDataByBoundsSQLite(minLat, maxLat, minLon, maxLon, timestamp);
    }
  }

  async getRadarDataByBoundsSQLite(minLat, maxLat, minLon, maxLon, timestamp) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT * FROM radar_data 
        WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?
      `;
      let params = [minLat, maxLat, minLon, maxLon];

      if (timestamp) {
        query += ' AND timestamp = ?';
        params.push(timestamp);
      }

      query += ' ORDER BY created_at DESC';

      this.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error fetching radar data by bounds:', err.message);
          reject(err);
          return;
        }

        const data = rows.map(row => ({
          lat: row.lat,
          lon: row.lon,
          reflectivity: row.reflectivity,
          precipitation: row.precipitation,
          color: row.color
        }));

        resolve(data);
      });
    });
  }

  async getRadarDataByBoundsPostgreSQL(minLat, maxLat, minLon, maxLon, timestamp) {
    try {
      let query = `
        SELECT * FROM radar_data 
        WHERE lat BETWEEN $1 AND $2 AND lon BETWEEN $3 AND $4
      `;
      let params = [minLat, maxLat, minLon, maxLon];

      if (timestamp) {
        query += ' AND timestamp = $5';
        params.push(timestamp);
      }

      query += ' ORDER BY created_at DESC';

      const result = await this.pgPool.query(query, params);
      
      const data = result.rows.map(row => ({
        lat: parseFloat(row.lat),
        lon: parseFloat(row.lon),
        reflectivity: parseFloat(row.reflectivity),
        precipitation: row.precipitation,
        color: row.color
      }));

      return data;
    } catch (error) {
      console.error('Error fetching radar data by bounds from PostgreSQL:', error.message);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    if (this.isPostgreSQL) {
      return this.getStatsPostgreSQL();
    } else {
      return this.getStatsSQLite();
    }
  }

  async getStatsSQLite() {
    return new Promise((resolve, reject) => {
      const queries = [
        'SELECT COUNT(*) as total_points FROM radar_data',
        'SELECT COUNT(DISTINCT timestamp) as total_timestamps FROM radar_data',
        'SELECT MAX(timestamp) as latest_timestamp FROM radar_data'
      ];

      let completed = 0;
      const results = {};

      queries.forEach((query, index) => {
        this.db.get(query, (err, row) => {
          if (err) {
            console.error('Error fetching stats:', err.message);
            reject(err);
            return;
          }

          if (index === 0) results.totalPoints = row.total_points;
          if (index === 1) results.totalTimestamps = row.total_timestamps;
          if (index === 2) results.latestTimestamp = row.latest_timestamp;

          completed++;
          if (completed === queries.length) {
            resolve(results);
          }
        });
      });
    });
  }

  async getStatsPostgreSQL() {
    try {
      const queries = [
        'SELECT COUNT(*) as total_points FROM radar_data',
        'SELECT COUNT(DISTINCT timestamp) as total_timestamps FROM radar_data',
        'SELECT MAX(timestamp) as latest_timestamp FROM radar_data'
      ];

      const results = {};

      for (let i = 0; i < queries.length; i++) {
        const result = await this.pgPool.query(queries[i]);
        const row = result.rows[0];

        if (i === 0) results.totalPoints = parseInt(row.total_points);
        if (i === 1) results.totalTimestamps = parseInt(row.total_timestamps);
        if (i === 2) results.latestTimestamp = row.latest_timestamp;
      }

      return results;
    } catch (error) {
      console.error('Error fetching stats from PostgreSQL:', error.message);
      throw error;
    }
  }

  /**
   * Cleanup old data
   */
  async cleanupOldData(hoursToKeep) {
    if (this.isPostgreSQL) {
      return this.cleanupOldDataPostgreSQL(hoursToKeep);
    } else {
      return this.cleanupOldDataSQLite(hoursToKeep);
    }
  }

  async cleanupOldDataSQLite(hoursToKeep) {
    return new Promise((resolve, reject) => {
      const cutoffTime = new Date(Date.now() - hoursToKeep * 60 * 60 * 1000).toISOString();
      
      const queries = [
        'DELETE FROM radar_data WHERE created_at < ?',
        'DELETE FROM radar_metadata WHERE created_at < ?'
      ];

      let completed = 0;
      const total = queries.length;

      queries.forEach(query => {
        this.db.run(query, [cutoffTime], (err) => {
          if (err) {
            console.error('Error cleaning up old data:', err.message);
            reject(err);
            return;
          }
          
          completed++;
          if (completed === total) {
            console.log(`Cleaned up data older than ${hoursToKeep} hours`);
            resolve();
          }
        });
      });
    });
  }

  async cleanupOldDataPostgreSQL(hoursToKeep) {
    try {
      const cutoffTime = new Date(Date.now() - hoursToKeep * 60 * 60 * 1000).toISOString();
      
      const queries = [
        'DELETE FROM radar_data WHERE created_at < $1',
        'DELETE FROM radar_metadata WHERE created_at < $1'
      ];

      for (const query of queries) {
        await this.pgPool.query(query, [cutoffTime]);
      }

      console.log(`Cleaned up data older than ${hoursToKeep} hours`);
    } catch (error) {
      console.error('Error cleaning up old data in PostgreSQL:', error.message);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.isPostgreSQL && this.pgPool) {
      await this.pgPool.end();
    } else if (this.db) {
      this.db.close();
    }
  }
}

module.exports = new Database();