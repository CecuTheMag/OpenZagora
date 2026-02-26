# Open Zagora

A municipal transparency dashboard for Stara Zagora, Bulgaria. This full-stack web application provides public access to municipal projects, budget information, and council voting records.

## Features

- 📊 **Dashboard** - Overview of municipal statistics and recent projects
- 🗺️ **Interactive Map** - Visualize projects on an interactive map with location markers
- 💰 **Budget Visualization** - Charts and tables showing budget allocation by category
- 🏛️ **Council Votes** - Track municipal council decisions and voting records
- 📄 **PDF Upload** - Upload and parse municipal documents (projects, budgets, votes)

## Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **React Router v6** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Leaflet** - Interactive maps
- **Recharts** - Data visualization charts
- **Axios** - HTTP client

### Backend
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **node-pg** - PostgreSQL client
- **Multer** - File upload handling
- **pdf-parse** - PDF text extraction
- **CORS** - Cross-origin resource sharing

## Project Structure

```
open-zagora/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── App.jsx         # Main app component
│   │   ├── main.jsx        # Entry point
│   │   └── index.css       # Global styles
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── server/                 # Express backend
│   ├── db/
│   │   ├── schema.sql      # Database schema
│   │   └── pool.js         # DB connection pool
│   ├── routes/
│   │   ├── upload.js       # PDF upload endpoints
│   │   ├── projects.js     # Projects API
│   │   ├── budget.js       # Budget API
│   │   └── votes.js        # Votes API
│   ├── uploads/            # Uploaded PDFs (created automatically)
│   ├── parsed/             # Parsed JSON files (created automatically)
│   ├── server.js           # Main server file
│   ├── package.json
│   └── .env.example
└── README.md
```

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Git

## Setup Instructions

### Quick Start with Docker (Recommended)

The easiest way to run the entire application is using Docker Compose.

#### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+

#### 1. Clone and Start

```bash
git clone <repository-url>
cd open-zagora

# Start all services (production build)
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

The application will be available at:
- **Frontend**: http://localhost
- **Backend API**: http://localhost:5000
- **Database**: localhost:5432

#### 2. Development Mode with Hot Reload

For development with automatic code reloading:

```bash
# Start development stack
docker-compose -f docker-compose.dev.yml up --build
```

Access points:
- **Frontend (Dev)**: http://localhost:5173
- **Backend API (Dev)**: http://localhost:5000
- **Database**: localhost:5432

#### 3. Useful Docker Commands

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes (clears database data)
docker-compose down -v

# Rebuild after code changes
docker-compose up --build

# Run database migrations only
docker-compose exec db psql -U postgres -d open_zagora -f /docker-entrypoint-initdb.d/01-schema.sql
```

---

### Manual Setup (Alternative)

If you prefer not to use Docker, follow these steps:

#### 1. Clone and Navigate

```bash
git clone <repository-url>
cd open-zagora
```

#### 2. Database Setup

Create a PostgreSQL database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE open_zagora;

# Exit
\q

# Run schema (from project root)
psql -U postgres -d open_zagora -f server/db/schema.sql
```

#### 3. Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your database credentials
# Example:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=open_zagora
# DB_USER=postgres
# DB_PASSWORD=your_password

# Create upload directories
mkdir -p uploads parsed

# Start development server
npm run dev
```

The server will start on `http://localhost:5000`

#### 4. Frontend Setup

```bash
# Open a new terminal and navigate to client
cd client

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start development server
npm run dev
```

The client will start on `http://localhost:5173`

## API Endpoints

### Health Check
- `GET /api/health` - Server status

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get single project
- `GET /api/projects/map/data` - Get projects for map
- `POST /api/projects` - Create new project
- `POST /api/projects/:id/vote` - Submit citizen vote
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Budget
- `GET /api/budget` - List budget items
- `GET /api/budget/summary` - Get budget summary by category
- `GET /api/budget/years` - Get available years
- `GET /api/budget/trends` - Get year-over-year trends
- `POST /api/budget` - Create budget item

### Council Votes
- `GET /api/votes` - List voting records
- `GET /api/votes/statistics` - Get voting statistics
- `GET /api/votes/years` - Get available years
- `POST /api/votes` - Create voting record

### Upload
- `POST /api/upload` - Upload and parse PDF
- `GET /api/upload/status` - Check upload status

## Usage

### Viewing Projects
1. Navigate to the Dashboard for an overview
2. Click "Project Map" to see projects on an interactive map
3. Filter by status or search by name

### Exploring Budget
1. Go to the "Budget" page
2. View pie/bar charts showing allocation by category
3. See detailed breakdown in the table below

### Tracking Council Votes
1. Visit the "Council Votes" page
2. View voting statistics and trends
3. Browse individual voting records with results

### Uploading Documents
Send a POST request to `/api/upload` with:
- `pdf` - PDF file (multipart/form-data)
- `type` - Document type: `project`, `budget`, or `vote`

Example with curl:
```bash
curl -X POST -F "pdf=@document.pdf" -F "type=project" http://localhost:5000/api/upload
```

## Environment Variables

### Server (.env)
| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `5000` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `open_zagora` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | - |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:5173` |

### Client (.env)
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:5000/api` |

## Development

### Running Tests
```bash
# Backend tests (when added)
cd server && npm test

# Frontend tests (when added)
cd client && npm test
```

### Code Style
- Backend: Follow Express.js best practices
- Frontend: ESLint configuration included
- Use async/await for asynchronous operations
- Add comments for complex logic

## Production Deployment

### Backend
1. Set `NODE_ENV=production`
2. Use environment variables for all sensitive data
3. Set up proper database connection pooling
4. Use PM2 or similar process manager

### Frontend
1. Run `npm run build` to create production build
2. Serve `dist/` folder with a web server
3. Configure API URL for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Contact

For questions or support, please open an issue on GitHub.

---

Built with ❤️ for the citizens of Stara Zagora
