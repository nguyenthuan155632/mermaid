#!/usr/bin/env node

/**
 * Database setup script
 * Creates the database if it doesn't exist
 * Run with: node scripts/setup-database.js
 */

// Load environment variables from .env file
require('dotenv').config();

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function setupDatabase() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    process.exit(1);
  }

  // Extract database name and connection details
  const url = new URL(dbUrl);
  const dbName = url.pathname.slice(1); // Remove leading slash
  const username = url.username || 'postgres';
  const password = url.password || '';
  const host = url.hostname || 'localhost';
  const port = url.port || '5432';

  // Create connection URL to postgres database (default database)
  const adminUrl = `postgresql://${username}${password ? ':' + password : ''}@${host}:${port}/postgres`;

  try {
    // Try to create database using psql
    const createDbCommand = `psql "${adminUrl}" -c "CREATE DATABASE ${dbName};"`;

    try {
      await execAsync(createDbCommand);
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }

  } catch {
    process.exit(1);
  }
}

setupDatabase();

