const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Weather Radar API',
      version: '1.0.0',
      description: 'API for fetching and displaying MRMS weather radar data',
      contact: {
        name: 'Radar Weather App',
        email: 'contact@example.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      schemas: {
        RadarPoint: {
          type: 'object',
          properties: {
            lat: {
              type: 'number',
              format: 'float',
              description: 'Latitude coordinate',
              example: 40.7128
            },
            lon: {
              type: 'number',
              format: 'float',
              description: 'Longitude coordinate',
              example: -74.0060
            },
            reflectivity: {
              type: 'number',
              format: 'float',
              description: 'Radar reflectivity in dBZ',
              example: 25.5
            },
            precipitation: {
              type: 'string',
              description: 'Precipitation intensity category',
              enum: ['none', 'light', 'moderate', 'heavy', 'extreme'],
              example: 'moderate'
            },
            color: {
              type: 'string',
              description: 'Color code for visualization',
              example: '#ffff00'
            }
          }
        },
        GeoJSONFeature: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['Feature'],
              example: 'Feature'
            },
            geometry: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['Point'],
                  example: 'Point'
                },
                coordinates: {
                  type: 'array',
                  items: {
                    type: 'number'
                  },
                  minItems: 2,
                  maxItems: 2,
                  example: [-74.0060, 40.7128]
                }
              }
            },
            properties: {
              $ref: '#/components/schemas/RadarPoint'
            }
          }
        },
        RadarDataResponse: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['FeatureCollection'],
              example: 'FeatureCollection'
            },
            features: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/GeoJSONFeature'
              }
            },
            metadata: {
              type: 'object',
              properties: {
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Timestamp of the radar data',
                  example: '2024-01-15T12:00:00.000Z'
                },
                totalPoints: {
                  type: 'integer',
                  description: 'Total number of radar points',
                  example: 1500
                }
              }
            }
          }
        },
        StatusResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Server status',
              example: 'running'
            },
            database: {
              type: 'string',
              description: 'Database connection status',
              example: 'connected'
            },
            lastUpdate: {
              type: 'string',
              format: 'date-time',
              description: 'Last radar data update',
              example: '2024-01-15T12:00:00.000Z'
            },
            dataAvailable: {
              type: 'boolean',
              description: 'Whether radar data is available',
              example: true
            },
            stats: {
              type: 'object',
              properties: {
                total_points: {
                  type: 'integer',
                  description: 'Total radar points in database',
                  example: 50000
                },
                earliest_data: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Earliest data timestamp',
                  example: '2024-01-15T06:00:00.000Z'
                },
                latest_data: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Latest data timestamp',
                  example: '2024-01-15T12:00:00.000Z'
                },
                unique_timestamps: {
                  type: 'integer',
                  description: 'Number of unique timestamps',
                  example: 6
                }
              }
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
              example: 'No radar data available'
            }
          }
        }
      }
    }
  },
  apis: [path.join(__dirname, '../index.js')] // Path to the API files
};

const specs = swaggerJsdoc(options);

module.exports = { specs, swaggerUi };
