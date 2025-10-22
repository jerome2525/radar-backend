# Weather Radar Backend

A comprehensive Node.js backend service for fetching, processing, and serving MRMS (Multi-Radar Multi-Sensor) weather radar data. This service provides real-time weather radar information through a RESTful API with support for both PostgreSQL and SQLite databases.

## 🌟 Features

- **Real-time Radar Data**: Fetches live MRMS GRIB2 files from NOAA
- **Multiple Data Sources**: Supports MRMS NCEP, MRMS Viewer, and NWS API with intelligent fallback
- **Dual Database Support**: PostgreSQL for production, SQLite for development
- **RESTful API**: Clean endpoints for radar data access
- **Scheduled Updates**: Automated data fetching every 5 minutes
- **GeoJSON Format**: Standardized data format for frontend consumption
- **Swagger Documentation**: Interactive API documentation
- **Railway Deployment**: Production-ready deployment configuration
- **Health Monitoring**: Built-in health checks and status endpoints

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL (for production) or SQLite (for development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/jerome2525/radar-backend.git
cd radar-backend
```

2. Install dependencies:
```bash
cd server
npm install
```

3. Set up environment variables:
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
# For PostgreSQL (production):
DATABASE_URL=postgresql://username:password@host:port/database

# For SQLite (development):
# Leave DATABASE_URL empty to use SQLite
```

4. Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:5000`

## 📡 API Endpoints

### Radar Data

- `GET /api/radar/latest` - Get the latest radar data
- `GET /api/radar/bounds?minLat=24&maxLat=49&minLon=-125&maxLon=-66` - Get radar data within geographic bounds
- `GET /api/radar/status` - Get server status and statistics

### Documentation

- `GET /api-docs` - Interactive Swagger API documentation

## 🗄️ Database Schema

### radar_data
- `id` - Primary key
- `timestamp` - Data timestamp
- `lat` - Latitude coordinate
- `lon` - Longitude coordinate  
- `reflectivity` - Radar reflectivity in dBZ
- `precipitation` - Precipitation intensity category
- `color` - Color code for visualization
- `created_at` - Record creation timestamp

### radar_metadata
- `id` - Primary key
- `timestamp` - Data timestamp
- `source_file` - Source file name
- `total_points` - Number of data points
- `bounds_json` - Geographic bounds as JSON
- `created_at` - Record creation timestamp

## 🔧 Configuration

### Environment Variables

- `PORT` - Server port (default: 5000)
- `DATABASE_URL` - PostgreSQL connection string (optional, uses SQLite if not set)
- `NODE_ENV` - Environment (development/production)

### Railway Deployment

The project is configured for Railway deployment with:

- **Nixpacks**: Automatic Node.js detection and build
- **Health Checks**: `/api/radar/status` endpoint
- **Auto-restart**: On failure with retry policy
- **PostgreSQL**: Production database support

## 📊 Data Sources

### Primary Sources (in order of preference)

1. **MRMS NCEP Directory**: Direct access to NOAA's MRMS GRIB2 files
2. **MRMS Viewer API**: Official MRMS viewer endpoints
3. **NWS API**: National Weather Service API for precipitation data
4. **Enhanced Mock Data**: Realistic fallback data based on weather patterns

### Data Processing

- **GRIB2 Parsing**: Converts meteorological data to JSON
- **Coordinate Conversion**: Handles map projections
- **Data Sampling**: Optimizes for frontend performance
- **Quality Filtering**: Removes invalid/missing values

## 🏗️ Architecture

```
radar-backend/
├── server/
│   ├── index.js              # Main Express server
│   ├── package.json          # Dependencies and scripts
│   ├── database/
│   │   └── database.js       # Database abstraction layer
│   ├── scraper/
│   │   └── radarScraper.js   # Data fetching and parsing
│   ├── processor/
│   │   └── radarProcessor.js # Data processing utilities
│   ├── swagger/
│   │   └── swaggerConfig.js  # API documentation config
│   └── data/
│       ├── downloads/        # Temporary GRIB2 files
│       ├── processed/        # Processed data files
│       └── radar.db          # SQLite database (dev)
├── railway.json              # Railway deployment config
├── nixpacks.toml            # Nixpacks build configuration
└── README.md                # This file
```

## 🔄 Scheduled Tasks

- **Data Updates**: Every 5 minutes (`*/5 * * * *`)
- **Data Cleanup**: Every hour (`0 * * * *`) - keeps last 24 hours

## 🧪 Development

### Running Tests

```bash
npm test
```

### Development Mode

```bash
npm run dev
```

Uses nodemon for automatic restart on file changes.

### Database Management

The application automatically:
- Creates tables on startup
- Handles both PostgreSQL and SQLite
- Manages indexes for performance
- Cleans up old data

## 🚀 Deployment

### Railway (Recommended)

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on git push

### Manual Deployment

1. Set `NODE_ENV=production`
2. Configure `DATABASE_URL` for PostgreSQL
3. Run `npm start`

## 📈 Performance

- **Database Indexing**: Optimized queries on timestamp and location
- **Data Sampling**: Limits points to prevent frontend overload
- **Caching**: In-memory caching for frequently accessed data
- **Cleanup**: Automatic removal of old data

## 🔒 Security

- **CORS**: Configured for frontend integration
- **Input Validation**: Parameter validation on all endpoints
- **Error Handling**: Graceful error responses
- **Rate Limiting**: Built-in protection against abuse

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **NOAA**: For providing MRMS radar data
- **Railway**: For hosting platform
- **Express.js**: For the web framework
- **PostgreSQL/SQLite**: For database support

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the API documentation at `/api-docs`
- Review the logs for debugging information

---

**Built with ❤️ for weather enthusiasts and developers**
