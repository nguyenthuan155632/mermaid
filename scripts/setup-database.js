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
  console.log('🔧 Setting up database...\n');

  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found in .env file');
    console.log('\nPlease:');
    console.log('1. Copy .env.example to .env');
    console.log('2. Update DATABASE_URL with your PostgreSQL credentials');
    process.exit(1);
  }

  console.log('📋 Database URL found in .env');

  // Extract database name and connection details
  const url = new URL(dbUrl);
  const dbName = url.pathname.slice(1); // Remove leading slash
  const username = url.username || 'postgres';
  const password = url.password || '';
  const host = url.hostname || 'localhost';
  const port = url.port || '5432';

  console.log(`📊 Database: ${dbName}`);
  console.log(`🖥️  Host: ${host}:${port}`);
  console.log(`👤 User: ${username}\n`);

  // Create connection URL to postgres database (default database)
  const adminUrl = `postgresql://${username}${password ? ':' + password : ''}@${host}:${port}/postgres`;

  console.log('🔨 Creating database...');
  try {
    // Try to create database using psql
    const createDbCommand = `psql "${adminUrl}" -c "CREATE DATABASE ${dbName};"`;

    try {
      await execAsync(createDbCommand);
      console.log(`✅ Database '${dbName}' created successfully!\n`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`ℹ️  Database '${dbName}' already exists\n`);
      } else {
        throw error;
      }
    }

    console.log('✅ Database setup complete!\n');
    console.log('Next steps:');
    console.log('1. Run: pnpm db:push');
    console.log('2. Run: pnpm db:seed (optional)');
    console.log('3. Run: pnpm dev\n');

  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    console.log('\n📝 Manual setup instructions:');
    console.log('1. Open PostgreSQL command line or GUI tool');
    console.log(`2. Run: CREATE DATABASE ${dbName};`);
    console.log('3. Then run: pnpm db:push\n');
    process.exit(1);
  }
}

setupDatabase();

