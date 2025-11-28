#!/usr/bin/env node

/**
 * Database drop script
 * Drops the database completely
 * Run with: node scripts/drop-database.js
 */

// Load environment variables from .env file
require('dotenv').config();

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function dropDatabase() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('DATABASE_URL environment variable is required');
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
    // Terminate existing connections to the database
    const terminateCommand = `psql "${adminUrl}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid();"`;

    try {
      await execAsync(terminateCommand);
      console.log(`🔄 Terminated active connections to '${dbName}'`);
    } catch (error) {
      console.log(`ℹ️  No active connections to terminate or database doesn't exist`);
    }

    // Drop the database
    const dropDbCommand = `psql "${adminUrl}" -c "DROP DATABASE IF EXISTS ${dbName};"`;

    try {
      await execAsync(dropDbCommand);
      console.log(`✅ Database '${dbName}' dropped successfully`);
    } catch (error) {
      if (error.message.includes('does not exist')) {
        console.log(`ℹ️  Database '${dbName}' doesn't exist`);
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('❌ Failed to drop database:', error.message);
    process.exit(1);
  }
}

dropDatabase();
