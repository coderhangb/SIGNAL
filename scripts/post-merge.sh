#!/bin/bash
set -e
npm ci
# Migrations are explicit: configure a development DATABASE_URL and run npm run db:migrate.
