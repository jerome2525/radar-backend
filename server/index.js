const express = require('express');
const cors = require('cors');
const path = require('path');
const RadarScraper = require('./scraper/radarScraper');
const radarScraper = new RadarScraper();
const radarProcessor = require('./processor/radarProcessor');
const database = require('./database/database');
const { specs, swaggerUi } = require('./swagger/swaggerConfig');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Weather Radar API Documentation'
}));

// Initialize database
let dbInitialized = false;

async function initializeDatabase() {
  try {
    await database.init();
    dbInitialized = true;
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

// API Routes

/**
 * @swagger
 * /api/radar/latest:
 *   get:
 *     summary: Get latest radar data
 *     description: Retrieve the most recent radar data as GeoJSON format
 *     tags: [Radar Data]
 *     responses:
 *       200:
 *         description: Latest radar data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RadarDataResponse'
 *       404:
 *         description: No radar data available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: Database not initialized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/api/radar/latest', async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const latestData = await database.getLatestRadarData();
    
    if (!latestData) {
      return res.status(404).json({ error: 'No radar data available' });
    }

    // Convert to GeoJSON format for frontend
    const geoJsonData = {
      type: 'FeatureCollection',
      features: latestData.data.map(point => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.lon, point.lat]
        },
        properties: {
          reflectivity: point.reflectivity,
          precipitation: point.precipitation,
          color: point.color
        }
      })),
      metadata: {
        timestamp: latestData.timestamp,
        totalPoints: latestData.data.length
      }
    };

    res.json(geoJsonData);
  } catch (error) {
    console.error('Error fetching latest radar data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/radar/status:
 *   get:
 *     summary: Get server status and statistics
 *     description: Retrieve server status, database connection status, and radar data statistics
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Status information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatusResponse'
 *       503:
 *         description: Database not initialized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/api/radar/status', async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const stats = await database.getStats();
    const latestData = await database.getLatestRadarData();

    res.json({
      status: 'running',
      database: 'connected',
      lastUpdate: latestData ? latestData.timestamp : null,
      dataAvailable: !!latestData,
      stats: stats
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/radar/bounds:
 *   get:
 *     summary: Get radar data within geographic bounds
 *     description: Retrieve radar data points within specified geographic boundaries
 *     tags: [Radar Data]
 *     parameters:
 *       - in: query
 *         name: minLat
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *         description: Minimum latitude
 *         example: 24.0
 *       - in: query
 *         name: maxLat
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *         description: Maximum latitude
 *         example: 49.0
 *       - in: query
 *         name: minLon
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *         description: Minimum longitude
 *         example: -125.0
 *       - in: query
 *         name: maxLon
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *         description: Maximum longitude
 *         example: -66.0
 *       - in: query
 *         name: timestamp
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Specific timestamp to query (optional)
 *         example: "2024-01-15T12:00:00.000Z"
 *     responses:
 *       200:
 *         description: Radar data within bounds retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                   example: "FeatureCollection"
 *                 features:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GeoJSONFeature'
 *       400:
 *         description: Missing required bounds parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/api/radar/bounds', async (req, res) => {
  try {
    const { minLat, maxLat, minLon, maxLon, timestamp } = req.query;
    
    if (!minLat || !maxLat || !minLon || !maxLon) {
      return res.status(400).json({ error: 'Missing required bounds parameters' });
    }

    const data = await database.getRadarDataByBounds(
      parseFloat(minLat),
      parseFloat(maxLat),
      parseFloat(minLon),
      parseFloat(maxLon),
      timestamp
    );

    const geoJsonData = {
      type: 'FeatureCollection',
      features: data.map(point => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.lon, point.lat]
        },
        properties: {
          reflectivity: point.reflectivity,
          precipitation: point.precipitation,
          color: point.color
        }
      }))
    };

    res.json(geoJsonData);
  } catch (error) {
    console.error('Error fetching radar data by bounds:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to update radar data
async function updateRadarData() {
  try {
    console.log('Fetching latest radar data...');
    
    // Get latest radar data using the updated scraper
    const radarData = await radarScraper.getLatestRadarData();
    
    if (radarData.length === 0) {
      console.log('No radar data available');
      return;
    }
    
    // Step 4: Store processed data in database
    const timestamp = new Date().toISOString();
    
    // Extract radar points from the data
    const radarPoints = radarData.map(point => ({
      lat: point.coordinates[1],
      lon: point.coordinates[0],
      reflectivity: point.reflectivity,
      precipitation: point.precipitation,
      color: point.color
    }));
    
    // Store radar data points
    await database.storeRadarData(timestamp, radarPoints);
    
    // Store metadata
    await database.storeRadarMetadata(
      timestamp,
      'MRMS_Data',
      radarData.length,
      { minLat: 24, maxLat: 49, minLon: -125, maxLon: -66 }
    );
    
    console.log(`Radar data updated successfully: ${radarData.length} points stored`);
  } catch (error) {
    console.error('Error updating radar data:', error);
  }
}

// Schedule data updates every 5 minutes
const cron = require('node-cron');
cron.schedule('*/5 * * * *', () => {
  if (dbInitialized) {
    updateRadarData();
  }
});

// Schedule cleanup of old data every hour
cron.schedule('0 * * * *', () => {
  if (dbInitialized) {
    database.cleanupOldData(24); // Keep last 24 hours
  }
});

// Initialize database and start server
initializeDatabase().then(() => {
  // Initial data fetch
  updateRadarData();
  
  // Serve React app for all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api/radar/latest`);
    console.log(`Swagger documentation at http://localhost:${PORT}/api-docs`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
