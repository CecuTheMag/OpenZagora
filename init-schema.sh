#!/bin/bash
# Run this script to manually initialize the database schema

echo "Initializing database schema..."

# Find the container runtime
if command -v podman &> /dev/null; then
    RUNTIME="podman"
elif command -v docker &> /dev/null; then
    RUNTIME="docker"
else
    echo "Error: Neither podman nor docker found"
    exit 1
fi

echo "Using container runtime: $RUNTIME"

# Run schemas in order
echo "Running main schema..."
$RUNTIME exec open-zagora-db-dev psql -U postgres -d open_zagora -f /docker-entrypoint-initdb.d/01-schema.sql

echo "Running budget schema..."
$RUNTIME exec open-zagora-db-dev psql -U postgres -d open_zagora -f /docker-entrypoint-initdb.d/02-budget-schema.sql

echo "Running data pipeline schema..."
$RUNTIME exec open-zagora-db-dev psql -U postgres -d open_zagora -f /docker-entrypoint-initdb.d/03-data-pipeline-schema.sql

echo "Done! Schema initialized successfully."
