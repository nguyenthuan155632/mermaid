# Mermaid Diagram Editor

A full-featured web application for creating and editing Mermaid diagrams, built with Next.js 16+, React 19+, and TypeScript.

## Features

- **Real-time Diagram Editing**: Code editor with live preview of Mermaid diagrams
- **Diagram Management**: Save, edit, and delete multiple diagrams
- **User Authentication**: Secure authentication using NextAuth.js v5
- **Sample Diagrams**: Pre-built templates for various diagram types
- **Error Detection**: Automatic syntax error detection and display
- **AI-Powered Error Fixing**: Google Gemini AI integration for automatic error correction
- **Export Functionality**: Export diagrams to PNG and SVG formats
- **Preview Controls**: Zoom in/out and fullscreen mode
- **Sharing**: Generate shareable links for diagrams

## Tech Stack

- **Framework**: Next.js 16.0.1+
- **React**: 19.2.0+
- **Authentication**: NextAuth.js 5.0.0-beta.22+
- **Database**: PostgreSQL (Railway) with Drizzle ORM 0.44.7+
- **UI**: Material-UI (MUI)
- **AI**: Google Generative AI 0.24.1+
- **Validation**: Zod 3.24.1+
- **TypeScript**: 5.9.3+

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm` or `brew install pnpm`)
- Railway PostgreSQL database (or any PostgreSQL database)
- Google Gemini API key

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
DATABASE_URL=postgresql://user:password@host:port/database
NEXTAUTH_SECRET=your-random-secret-here
NEXTAUTH_URL=http://localhost:4025
GEMINI_API_KEY=your-gemini-api-key
```

**Generate NEXTAUTH_SECRET**:
```bash
openssl rand -base64 32
```

### 3. Set Up Database

Run the database setup script to create the database:

```bash
pnpm db:setup
```

This script will:
- Read your `DATABASE_URL` from `.env.local`
- Create the database if it doesn't exist
- Provide instructions for next steps

**Manual Setup (Alternative):**

If the script doesn't work, you can create the database manually:

```bash
# Using psql command line
psql -U postgres -c "CREATE DATABASE mermaid;"

# Or connect to PostgreSQL and run:
# CREATE DATABASE mermaid;
```

### 4. Run Database Migrations

Run database migrations to create the schema:

```bash
pnpm db:push
```

### 5. Seed Sample Diagrams (Optional)

You can seed the database with sample diagrams by creating a script or manually inserting them using the Drizzle Studio:

```bash
pnpm db:studio
```

### 6. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:4025](http://localhost:4025) in your browser.

## Deployment to Railway

### 1. Create Railway Project

1. Sign up/login to [Railway](https://railway.app)
2. Create a new project
3. Add a PostgreSQL database service

### 2. Configure Environment Variables

In Railway dashboard, add all environment variables from `.env.local`:
- `DATABASE_URL` (automatically provided by Railway PostgreSQL service)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (your Railway app URL)
- `GEMINI_API_KEY`

### 3. Deploy

Connect your GitHub repository or deploy directly:

```bash
railway up
```

### 4. Run Migrations

After deployment, run migrations:

```bash
railway run pnpm db:push
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   ├── diagrams/
│   │   ├── fix-diagram/
│   │   └── samples/
│   ├── diagrams/
│   ├── editor/
│   ├── login/
│   ├── signup/
│   └── share/
├── components/
│   ├── CodeEditor.tsx
│   ├── MermaidRenderer.tsx
│   ├── SamplesSidebar.tsx
│   └── ErrorBoundary.tsx
├── db/
│   ├── schema.ts
│   └── index.ts
├── lib/
│   ├── gemini.ts
│   ├── export.ts
│   └── theme.ts
├── hooks/
│   └── useDebounce.ts
└── types/
    └── index.ts
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm db:push` - Push schema changes to database
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:setup` - Create database if it doesn't exist

## Database Schema

- **users**: User accounts with email and hashed passwords
- **diagrams**: User-created diagrams with code, title, and sharing settings
- **sample_diagrams**: Pre-built sample diagrams for templates

## API Routes

- `POST /api/auth/signup` - User registration
- `GET/POST /api/auth/[...nextauth]` - NextAuth authentication
- `GET/POST /api/diagrams` - List/create diagrams
- `GET/PATCH/DELETE /api/diagrams/[id]` - Diagram operations
- `POST /api/diagrams/[id]/share` - Generate share link
- `GET /api/share/[token]` - Get shared diagram
- `POST /api/fix-diagram` - AI-powered error fixing
- `GET /api/samples` - Get sample diagrams

## License

MIT

