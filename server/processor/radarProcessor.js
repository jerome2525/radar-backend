const fs = require('fs-extra');
const path = require('path');

class RadarProcessor {
  constructor() {
    this.dataDir = path.join(__dirname, '../data/processed');
    fs.ensureDirSync(this.dataDir);
  }

  /**
   * Process GRIB2 radar data (simplified version)
   * In a real implementation, you'd use libraries like pygrib or wgrib2
   */
  async processRadarData(filePath) {
    try {
      console.log(`Processing radar data from ${path.basename(filePath)}...`);
      
      // For now, create mock radar data
      // In production, you'd parse the actual GRIB2 file
      const mockRadarData = this.createMockRadarData();
      
      // Save processed data
      const outputPath = path.join(this.dataDir, `radar_${Date.now()}.json`);
      await fs.writeJson(outputPath, mockRadarData);
      
      console.log('Radar data processed successfully');
      return mockRadarData;
      
    } catch (error) {
      console.error('Error processing radar data:', error.message);
      throw error;
    }
  }

  /**
   * Create mock radar data for testing
   * This simulates what processed MRMS data would look like
   */
  createMockRadarData() {
    const radarPoints = [];
    
    // Create realistic weather patterns instead of a grid
    const weatherSystems = this.generateWeatherSystems();
    
    weatherSystems.forEach(system => {
      const { centerLat, centerLon, intensity, size } = system;
      
      // Generate points around each weather system center
      const numPoints = Math.floor(size * 50); // More points for larger systems
      
      for (let i = 0; i < numPoints; i++) {
        // Create more diverse patterns - not just circular
        const patternType = Math.random();
        
        let lat, lon;
        
        if (patternType < 0.3) {
          // Circular pattern
          const angle = (Math.PI * 2 * i) / numPoints;
          const radius = Math.random() * size * 2.0;
          lat = centerLat + radius * Math.cos(angle);
          lon = centerLon + radius * Math.sin(angle);
        } else if (patternType < 0.6) {
          // Random scatter pattern
          lat = centerLat + (Math.random() - 0.5) * size * 4.0;
          lon = centerLon + (Math.random() - 0.5) * size * 4.0;
        } else {
          // Linear pattern (weather fronts)
          const direction = Math.random() * Math.PI * 2;
          const distance = Math.random() * size * 3.0;
          lat = centerLat + distance * Math.cos(direction);
          lon = centerLon + distance * Math.sin(direction);
        }
        
        // Add additional randomness
        const randomLat = lat + (Math.random() - 0.5) * 5.0; // Increased from 2.0 to 5.0
        const randomLon = lon + (Math.random() - 0.5) * 5.0; // Increased from 2.0 to 5.0
        
        // Calculate reflectivity based on distance from center
        const distanceFromCenter = Math.sqrt(
          Math.pow(randomLat - centerLat, 2) + Math.pow(randomLon - centerLon, 2)
        );
        
        // Higher intensity at center, decreasing with distance
        const baseReflectivity = intensity * (1 - distanceFromCenter / size);
        const reflectivity = Math.max(5, baseReflectivity + (Math.random() - 0.5) * 10);
        
        // Only include points with significant reflectivity (> 10 dBZ)
        if (reflectivity > 10 && randomLat >= 24.0 && randomLat <= 49.0 && 
            randomLon >= -125.0 && randomLon <= -66.0) {
          radarPoints.push({
            lat: parseFloat(randomLat.toFixed(3)),
            lon: parseFloat(randomLon.toFixed(3)),
            reflectivity: parseFloat(reflectivity.toFixed(1)),
            precipitation: this.reflectivityToPrecipitation(reflectivity)
          });
        }
      }
    });
    
    return {
      type: 'FeatureCollection',
      features: radarPoints.map(point => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.lon, point.lat]
        },
        properties: {
          reflectivity: point.reflectivity,
          precipitation: point.precipitation,
          color: this.getColorForReflectivity(point.reflectivity)
        }
      })),
      metadata: {
        timestamp: new Date().toISOString(),
        totalPoints: radarPoints.length,
        bounds: {
          minLat,
          maxLat,
          minLon,
          maxLon
        }
      }
    };
  }

  /**
   * Generate realistic weather systems across the continental US
   */
  generateWeatherSystems() {
    const systems = [];
    
    // Create 3-6 weather systems with different characteristics
    const numSystems = Math.floor(Math.random() * 4) + 3; // 3-6 systems
    
    for (let i = 0; i < numSystems; i++) {
      // Random locations across the continental US
      const centerLat = 25.0 + Math.random() * 20.0; // 25°N to 45°N (more centered)
      const centerLon = -120.0 + Math.random() * 50.0; // -120°W to -70°W (more centered)
      
      // Random intensity and size
      const intensity = 20 + Math.random() * 30; // 20-50 dBZ
      const size = 3 + Math.random() * 8; // 3-11 degrees
      
      systems.push({
        centerLat,
        centerLon,
        intensity,
        size
      });
    }
    
    return systems;
  }

  /**
   * Convert reflectivity (dBZ) to precipitation intensity
   */
  reflectivityToPrecipitation(reflectivity) {
    if (reflectivity < 10) return 'none';
    if (reflectivity < 20) return 'light';
    if (reflectivity < 30) return 'moderate';
    if (reflectivity < 40) return 'heavy';
    return 'extreme';
  }

  /**
   * Get color for reflectivity value
   */
  getColorForReflectivity(reflectivity) {
    if (reflectivity < 10) return '#ffffff';      // No precipitation
    if (reflectivity < 20) return '#00ff00';      // Light green
    if (reflectivity < 30) return '#ffff00';      // Yellow
    if (reflectivity < 40) return '#ff8000';      // Orange
    if (reflectivity < 50) return '#ff0000';     // Red
    return '#800080';                             // Purple (extreme)
  }

  /**
   * Convert GRIB2 coordinates to lat/lon
   * This is a simplified version - real implementation would use proper projection
   */
  convertCoordinates(x, y, projection = 'lambert') {
    // Simplified coordinate conversion
    // In reality, you'd use proper map projection libraries
    const lat = 40.0 + (y - 1000) * 0.01;
    const lon = -100.0 + (x - 1000) * 0.01;
    return { lat, lon };
  }
}

module.exports = new RadarProcessor();
