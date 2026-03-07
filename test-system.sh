#!/bin/bash

echo "=========================================="
echo "OpenZagora System Health Check"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Find container runtime
if command -v podman &> /dev/null; then
    RUNTIME="podman"
elif command -v docker &> /dev/null; then
    RUNTIME="docker"
else
    echo -e "${RED}✗ Neither podman nor docker found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Using container runtime: $RUNTIME${NC}"
echo ""

# Check if containers are running
echo "1. Checking containers..."
if $RUNTIME ps | grep -q "open-zagora-db-dev"; then
    echo -e "${GREEN}✓ Database container running${NC}"
else
    echo -e "${RED}✗ Database container not running${NC}"
    exit 1
fi

if $RUNTIME ps | grep -q "open-zagora-server-dev"; then
    echo -e "${GREEN}✓ Server container running${NC}"
else
    echo -e "${RED}✗ Server container not running${NC}"
    exit 1
fi

if $RUNTIME ps | grep -q "open-zagora-client-dev"; then
    echo -e "${GREEN}✓ Client container running${NC}"
else
    echo -e "${RED}✗ Client container not running${NC}"
    exit 1
fi
echo ""

# Check database tables
echo "2. Checking database tables..."
TABLES=$($RUNTIME exec open-zagora-db-dev psql -U postgres -d open_zagora -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('osm_data', 'eop_data', 'data_sources', 'scraper_logs')" 2>&1)

if [[ $TABLES =~ ^[[:space:]]*4 ]]; then
    echo -e "${GREEN}✓ All required tables exist${NC}"
else
    echo -e "${RED}✗ Missing tables (found: $TABLES/4)${NC}"
    echo "  Run: podman-compose -f docker-compose.dev.yml down -v && podman-compose -f docker-compose.dev.yml up --build"
    exit 1
fi
echo ""

# Check data counts
echo "3. Checking data in database..."
OSM_COUNT=$($RUNTIME exec open-zagora-db-dev psql -U postgres -d open_zagora -t -c "SELECT COUNT(*) FROM osm_data WHERE lat IS NOT NULL" 2>&1 | tr -d ' ')
EOP_COUNT=$($RUNTIME exec open-zagora-db-dev psql -U postgres -d open_zagora -t -c "SELECT COUNT(*) FROM eop_data WHERE lat IS NOT NULL" 2>&1 | tr -d ' ')

echo "  OSM records: $OSM_COUNT"
echo "  EOP records: $EOP_COUNT"

if [ "$OSM_COUNT" -gt 0 ] || [ "$EOP_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Data exists in database${NC}"
else
    echo -e "${YELLOW}⚠ No data in database yet${NC}"
    echo "  Trigger data fetch: curl -X POST http://localhost:5000/api/scraper/run -d '{\"type\":\"full\"}' -H 'Content-Type: application/json'"
fi
echo ""

# Check API health
echo "4. Checking API endpoints..."
if curl -s http://localhost:5000/api/health | grep -q "OK"; then
    echo -e "${GREEN}✓ API health endpoint responding${NC}"
else
    echo -e "${RED}✗ API health endpoint not responding${NC}"
    exit 1
fi

# Check debug endpoint
DEBUG_RESPONSE=$(curl -s http://localhost:5000/api/osm/debug)
if echo "$DEBUG_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Debug endpoint responding${NC}"
    
    # Parse counts from JSON
    OSM_API=$(echo "$DEBUG_RESPONSE" | grep -o '"osm":[0-9]*' | grep -o '[0-9]*')
    EOP_API=$(echo "$DEBUG_RESPONSE" | grep -o '"eop":[0-9]*' | grep -o '[0-9]*')
    echo "  API reports: OSM=$OSM_API, EOP=$EOP_API"
else
    echo -e "${RED}✗ Debug endpoint error${NC}"
fi

# Check map endpoint
MAP_RESPONSE=$(curl -s "http://localhost:5000/api/osm/unified/map?limit=10")
if echo "$MAP_RESPONSE" | grep -q "success"; then
    TOTAL=$(echo "$MAP_RESPONSE" | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
    echo -e "${GREEN}✓ Map endpoint responding (total markers: $TOTAL)${NC}"
else
    echo -e "${RED}✗ Map endpoint error${NC}"
fi
echo ""

# Check client
echo "5. Checking client..."
if curl -s http://localhost:5173 | grep -q "vite"; then
    echo -e "${GREEN}✓ Client responding${NC}"
else
    echo -e "${YELLOW}⚠ Client may not be ready yet${NC}"
fi
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
if [ "$OSM_COUNT" -gt 0 ] || [ "$EOP_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ System is operational${NC}"
    echo ""
    echo "Access points:"
    echo "  Frontend: http://localhost:5173"
    echo "  Backend:  http://localhost:5000"
    echo "  API Docs: http://localhost:5000/api/health"
    echo ""
    echo "Total markers on map: $((OSM_COUNT + EOP_COUNT))"
else
    echo -e "${YELLOW}⚠ System is running but no data yet${NC}"
    echo ""
    echo "To populate data, run:"
    echo "  curl -X POST http://localhost:5000/api/scraper/run \\"
    echo "       -H 'Content-Type: application/json' \\"
    echo "       -d '{\"type\":\"full\"}'"
    echo ""
    echo "Or click 'Fetch Data' button in the UI at http://localhost:5173"
fi
echo ""
