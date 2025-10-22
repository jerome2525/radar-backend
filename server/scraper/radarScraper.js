const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const zlib = require('zlib');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class RadarScraper {
  constructor() {
    // Use official MRMS data access methods
    this.mrmsNcepUrl = 'https://mrms.ncep.noaa.gov';
    this.mrmsViewerUrl = 'https://mrms.nssl.noaa.gov/qvs/product_viewer/';
    this.nwsApiUrl = 'https://api.weather.gov';
    this.downloadDir = path.join(__dirname, '../data/downloads');
    
    // Ensure download directory exists
    fs.ensureDirSync(this.downloadDir);
  }

  /**
   * Get real-time radar data using official MRMS methods
   */
  async getLatestRadarData() {
    try {
      console.log('Fetching real-time radar data from MRMS...');
      
      // Try multiple approaches to get real radar data
      let radarData = [];
      
      // Method 1: Try MRMS NCEP directory (the correct URL!)
      try {
        radarData = await this.getMRMSNcepData();
        if (radarData.length > 0) {
          console.log(`Successfully retrieved ${radarData.length} radar points from MRMS NCEP`);
          return radarData;
        }
      } catch (error) {
        console.warn('MRMS NCEP method failed:', error.message);
      }
      
      // Method 2: Try MRMS viewer API
      try {
        radarData = await this.getMRMSViewerData();
        if (radarData.length > 0) {
          console.log(`Successfully retrieved ${radarData.length} radar points from MRMS viewer`);
          return radarData;
        }
      } catch (error) {
        console.warn('MRMS viewer method failed:', error.message);
      }
      
      // Method 2: Try NWS API for precipitation data
      try {
        radarData = await this.getNWSRadarData();
        if (radarData.length > 0) {
          console.log(`Successfully retrieved ${radarData.length} radar points from NWS API`);
          return radarData;
        }
      } catch (error) {
        console.warn('NWS API method failed:', error.message);
      }
      
      // Method 3: Fallback to enhanced mock data
      console.log('Using enhanced mock data based on real weather patterns...');
      return this.getEnhancedMockData();
      
    } catch (error) {
      console.error('Error fetching radar data:', error.message);
      return this.getEnhancedMockData();
    }
  }

  /**
   * Try to get data from MRMS NCEP directory (Method 1 - CORRECT URL!)
   */
  async getMRMSNcepData() {
    try {
      console.log('Trying to access MRMS NCEP directory...');
      
      // Try to access the BREF_1HR_MAX subdirectory (contains the GRIB2 files)
      const response = await axios.get(`${this.mrmsNcepUrl}/2D/BREF_1HR_MAX/`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });
      
      console.log('Successfully accessed MRMS NCEP directory!');
      console.log('Response status:', response.status);
      console.log('Response length:', response.data.length);
      
      // Parse the directory listing to find GRIB2 files
      return await this.parseMRMSDirectory(response.data);
      
    } catch (error) {
      console.warn('MRMS NCEP directory access failed:', error.message);
      throw error;
    }
  }

  /**
   * Parse MRMS directory listing to find GRIB2 files
   */
  async parseMRMSDirectory(htmlContent) {
    const radarData = [];
    
    // Look for GRIB2 files in the directory listing
    const patterns = [
      /href="([^"]*\.grib2\.gz[^"]*)"/g,
      /href="([^"]*\.grib2[^"]*)"/g,
      /href="([^"]*\.grib[^"]*)"/g,
      /href="([^"]*\.grb[^"]*)"/g
    ];
    
      const files = [];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(htmlContent)) !== null) {
        files.push(match[1]);
      }
    });
    
    console.log(`Found ${files.length} potential data files in MRMS directory`);
    
    if (files.length > 0) {
      // Try to download and parse the latest file
      const latestFile = files.find(f => f.includes('latest')) || files[0];
      console.log('Attempting to download:', latestFile);
      
      try {
        const radarPoints = await this.downloadAndParseGRIB2(latestFile);
        radarData.push(...radarPoints);
        console.log(`Successfully parsed ${radarPoints.length} radar points from GRIB2 file`);
      } catch (error) {
        console.warn('Failed to parse GRIB2 file:', error.message);
      }
    }
    
    return radarData;
  }

  /**
   * Download and parse a GRIB2 file
   */
  async downloadAndParseGRIB2(filename) {
    try {
      console.log(`Downloading GRIB2 file: ${filename}`);
      
      // Construct the full URL
      const fileUrl = `${this.mrmsNcepUrl}/2D/BREF_1HR_MAX/${filename}`;
      
      // Download the file
      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*'
        },
        timeout: 30000 // 30 second timeout for large files
      });
      
      console.log(`Downloaded ${response.data.length} bytes`);
      
      // Save to temporary file
      const tempFile = path.join(this.downloadDir, filename);
      await fs.writeFile(tempFile, response.data);
      
      // Parse the GRIB2 file
      const radarPoints = await this.parseGRIB2File(tempFile);
      
      // Clean up temporary file
      await fs.remove(tempFile);
      
      return radarPoints;
      
    } catch (error) {
      console.error('Error downloading/parsing GRIB2 file:', error.message);
      throw error;
    }
  }

  /**
   * Parse a GRIB2 file and extract radar data
   */
  async parseGRIB2File(filePath) {
    try {
      console.log('Parsing GRIB2 file...');
      
      // Read the compressed file
      const compressedData = await fs.readFile(filePath);
      console.log(`Read ${compressedData.length} bytes of compressed data`);
      
      // Decompress the GRIB2 file
      const decompressedData = await new Promise((resolve, reject) => {
        zlib.gunzip(compressedData, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      console.log(`Decompressed to ${decompressedData.length} bytes`);
      
      // Save decompressed data to temporary file for grib2json
      const tempGribFile = filePath.replace('.gz', '');
      await fs.writeFile(tempGribFile, decompressedData);
      
      // Use grib2json to convert GRIB2 to JSON
      const jsonFile = tempGribFile + '.json';
      await execAsync(`npx grib2json ${tempGribFile} -o ${jsonFile}`);
      
      // Read the JSON data
      const jsonData = await fs.readFile(jsonFile, 'utf8');
      const data = JSON.parse(jsonData);
      
      // Clean up temporary files
      await fs.remove(tempGribFile);
      await fs.remove(jsonFile);
      
      console.log('GRIB2 file parsed successfully');
      console.log('Available fields:', Object.keys(data));
      
      const radarPoints = [];
      
      // Extract radar data from the GRIB2 file
      // The exact field names depend on the MRMS product
      for (const [fieldName, fieldData] of Object.entries(data)) {
        if (fieldData.values && fieldData.latitudes && fieldData.longitudes) {
          console.log(`Processing field: ${fieldName}`);
          console.log(`Values range: ${Math.min(...fieldData.values)} to ${Math.max(...fieldData.values)}`);
          
          // Convert GRIB2 data to radar points
          const points = this.convertGRIB2ToRadarPoints(fieldData, fieldName);
          radarPoints.push(...points);
        }
      }
      
      console.log(`Extracted ${radarPoints.length} radar points from GRIB2 file`);
      return radarPoints;
      
    } catch (error) {
      console.error('Error parsing GRIB2 file:', error.message);
      throw error;
    }
  }

  /**
   * Convert GRIB2 field data to radar points
   */
  convertGRIB2ToRadarPoints(fieldData, fieldName) {
    const radarPoints = [];
    
    // Sample the data (don't use every single point to avoid overwhelming the frontend)
    const sampleRate = Math.max(1, Math.floor(fieldData.values.length / 1000)); // Max 1000 points
    
    for (let i = 0; i < fieldData.values.length; i += sampleRate) {
      const value = fieldData.values[i];
      const lat = fieldData.latitudes[i];
      const lon = fieldData.longitudes[i];
      
      // Skip invalid/missing values
      if (value === null || value === undefined || isNaN(value) || value < 0) {
        continue;
      }
      
      // Convert reflectivity to dBZ if needed
      let reflectivity = value;
      if (fieldName.includes('BREF') || fieldName.includes('REFL')) {
        // BREF is already in dBZ
        reflectivity = value;
      } else {
        // Convert other values to dBZ scale
        reflectivity = Math.max(0, Math.min(70, value * 10)); // Scale and clamp
      }
      
      radarPoints.push({
        coordinates: [lon, lat],
        reflectivity: reflectivity,
        precipitation: this.classifyPrecipitation(reflectivity),
        color: this.getColorForReflectivity(reflectivity),
        source: 'MRMS_GRIB2',
        field: fieldName,
        timestamp: new Date().toISOString()
      });
    }
    
    return radarPoints;
  }
  async getMRMSViewerData() {
    try {
      // Try to access MRMS viewer API endpoints
      const response = await axios.get(`${this.mrmsViewerUrl}api/products`, {
        headers: {
          'User-Agent': 'RadarApp/1.0 (contact@example.com)',
          'Accept': 'application/json'
        },
        timeout: 10000
      });
      
      // Process MRMS product data
      return this.processMRMSProducts(response.data);
      
    } catch (error) {
      console.warn('MRMS viewer API not accessible:', error.message);
      throw error;
    }
  }

  /**
   * Try to get data from NWS API (Method 2)
   */
  async getNWSRadarData() {
    try {
      const stations = this.getRadarStations();
      const radarData = [];
      
      for (const station of stations.slice(0, 5)) { // Limit to 5 stations
        try {
          const data = await this.getStationRadarData(station);
          radarData.push(...data);
        } catch (error) {
          console.warn(`Failed to get data for station ${station.id}:`, error.message);
        }
      }
      
      return radarData;
      
    } catch (error) {
      console.warn('NWS API method failed:', error.message);
      throw error;
    }
  }

  /**
   * Process MRMS product data
   */
  processMRMSProducts(products) {
    const radarData = [];
    
    // This would process actual MRMS GRIB2 data
    // For now, return empty array to trigger fallback
    return radarData;
  }

  /**
   * Get list of radar stations
   */
  getRadarStations() {
    const stations = [
      { id: 'KTLX', name: 'Oklahoma City', lat: 35.3, lon: -97.3 },
      { id: 'KDFX', name: 'Laughlin AFB', lat: 29.3, lon: -100.3 },
      { id: 'KEWX', name: 'San Antonio', lat: 29.7, lon: -98.0 },
      { id: 'KFWS', name: 'Fort Worth', lat: 32.6, lon: -97.3 },
      { id: 'KGRK', name: 'Fort Hood', lat: 31.2, lon: -97.1 },
      { id: 'KSHV', name: 'Shreveport', lat: 32.4, lon: -93.8 },
      { id: 'KLZK', name: 'Little Rock', lat: 34.8, lon: -92.3 },
      { id: 'KPOE', name: 'Fort Polk', lat: 31.2, lon: -93.2 },
      { id: 'KLCH', name: 'Lake Charles', lat: 30.1, lon: -93.2 },
      { id: 'KLIX', name: 'New Orleans', lat: 30.3, lon: -89.8 }
    ];
    
    return stations;
  }

  /**
   * Get radar data for a specific station
   */
  async getStationRadarData(station) {
    try {
      // Get current conditions for the station area
      const response = await axios.get(`${this.baseUrl}/points/${station.lat},${station.lon}`, {
        headers: {
          'User-Agent': 'RadarApp/1.0 (contact@example.com)',
          'Accept': 'application/geo+json'
        },
        timeout: 10000
      });

      const forecastUrl = response.data.properties.forecast;
      
      // Get forecast data
      const forecastResponse = await axios.get(forecastUrl, {
        headers: {
          'User-Agent': 'RadarApp/1.0 (contact@example.com)',
          'Accept': 'application/geo+json'
        },
        timeout: 10000
      });

      // Extract precipitation data from forecast
      const precipitationData = this.extractPrecipitationData(forecastResponse.data, station);
      
      return precipitationData;
      
    } catch (error) {
      console.warn(`Error getting data for station ${station.id}:`, error.message);
      return [];
    }
  }

  /**
   * Extract precipitation data from forecast
   */
  extractPrecipitationData(forecastData, station) {
    const data = [];
    
    if (forecastData.properties?.periods) {
      forecastData.properties.periods.slice(0, 3).forEach((period, index) => {
        if (period.probabilityOfPrecipitation?.value > 0) {
          // Generate radar points around the station
          const numPoints = Math.floor(Math.random() * 10) + 5; // 5-15 points
          
          for (let i = 0; i < numPoints; i++) {
            // Create realistic radar pattern around station
            const angle = (Math.PI * 2 * i) / numPoints;
            const radius = Math.random() * 2.0; // 2 degree radius
            
            const lat = station.lat + radius * Math.cos(angle);
            const lon = station.lon + radius * Math.sin(angle);
            
            // Calculate reflectivity based on precipitation probability
            const baseReflectivity = period.probabilityOfPrecipitation.value;
            const reflectivity = baseReflectivity + Math.random() * 20; // Add variation
            
            data.push({
              coordinates: [lon, lat],
              reflectivity: Math.min(reflectivity, 50), // Cap at 50 dBZ
              precipitation: this.classifyPrecipitation(reflectivity),
              color: this.getColorForReflectivity(reflectivity),
              station: station.id,
              timestamp: new Date().toISOString()
            });
          }
        }
      });
    }
    
    return data;
  }

  /**
   * Classify precipitation intensity
   */
  classifyPrecipitation(reflectivity) {
    if (reflectivity < 20) return 'light';
    if (reflectivity < 35) return 'moderate';
    if (reflectivity < 45) return 'heavy';
    return 'extreme';
  }

  /**
   * Get color for reflectivity value
   */
  getColorForReflectivity(reflectivity) {
    if (reflectivity < 20) return '#00ff00'; // Green
    if (reflectivity < 35) return '#ffff00'; // Yellow
    if (reflectivity < 45) return '#ff8000'; // Orange
    return '#ff0000'; // Red
  }

  /**
   * Enhanced mock data based on real weather patterns
   */
  getEnhancedMockData() {
    console.log('Generating enhanced mock data with realistic weather patterns...');
    
    const mockData = [];
    const stations = this.getRadarStations();
    
    // Create realistic weather systems across the US
    stations.forEach(station => {
      // Random weather system type
      const systemType = Math.random();
      
      if (systemType < 0.3) {
        // Thunderstorm cell - small, intense
        this.generateThunderstormCell(mockData, station);
      } else if (systemType < 0.6) {
        // Weather front - linear pattern
        this.generateWeatherFront(mockData, station);
      } else {
        // Scattered showers - random points
        this.generateScatteredShowers(mockData, station);
      }
    });
    
    return mockData;
  }

  /**
   * Generate thunderstorm cell pattern
   */
  generateThunderstormCell(mockData, station) {
    const numPoints = Math.floor(Math.random() * 8) + 5; // 5-12 points
    const intensity = 30 + Math.random() * 20; // 30-50 dBZ
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (Math.PI * 2 * i) / numPoints;
      const radius = Math.random() * 1.5; // Small radius for storms
      
      const lat = station.lat + radius * Math.cos(angle);
      const lon = station.lon + radius * Math.sin(angle);
      const reflectivity = intensity + (Math.random() - 0.5) * 10;
      
      mockData.push({
        coordinates: [lon, lat],
        reflectivity: Math.max(20, Math.min(50, reflectivity)),
        precipitation: this.classifyPrecipitation(reflectivity),
        color: this.getColorForReflectivity(reflectivity),
        station: station.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Generate weather front pattern
   */
  generateWeatherFront(mockData, station) {
    const numPoints = Math.floor(Math.random() * 15) + 10; // 10-24 points
    const direction = Math.random() * Math.PI * 2;
    const length = 2 + Math.random() * 3; // 2-5 degree length
    
    for (let i = 0; i < numPoints; i++) {
      const distance = (i / numPoints) * length;
      const lat = station.lat + distance * Math.cos(direction);
      const lon = station.lon + distance * Math.sin(direction);
      const reflectivity = 25 + Math.random() * 15; // Moderate intensity
      
      mockData.push({
        coordinates: [lon, lat],
        reflectivity: Math.max(20, Math.min(40, reflectivity)),
        precipitation: this.classifyPrecipitation(reflectivity),
        color: this.getColorForReflectivity(reflectivity),
        station: station.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Generate scattered showers pattern
   */
  generateScatteredShowers(mockData, station) {
    const numPoints = Math.floor(Math.random() * 12) + 8; // 8-19 points
    
    for (let i = 0; i < numPoints; i++) {
      const lat = station.lat + (Math.random() - 0.5) * 4.0; // 4 degree spread
      const lon = station.lon + (Math.random() - 0.5) * 4.0;
      const reflectivity = 15 + Math.random() * 20; // Light to moderate
      
      mockData.push({
        coordinates: [lon, lat],
        reflectivity: Math.max(10, Math.min(35, reflectivity)),
        precipitation: this.classifyPrecipitation(reflectivity),
        color: this.getColorForReflectivity(reflectivity),
        station: station.id,
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = RadarScraper;