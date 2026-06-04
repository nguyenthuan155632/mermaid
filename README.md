# Mermaid Diagram Editor

A full-featured web application for creating and editing Mermaid diagrams, built with Next.js 16+, React 19+, and TypeScript.

## Features

### 🎨 **Diagram Editing & Rendering**
- **Real-time Diagram Editing**: Monaco code editor with live preview of Mermaid diagrams
- **Support for All Mermaid Types**: Flowchart, sequence, class, state, ER, gantt, pie, journey, gitgraph, and more
- **Error Detection**: Automatic syntax error detection with clear error messages
- **Preview Controls**: Zoom in/out controls and fullscreen mode for distraction-free viewing

### 🤝 **Real-Time Collaboration**
- **Live Collaborative Editing**: Multiple users can edit the same diagram simultaneously
- **Live Cursors**: See other users' cursor positions in real-time with color-coded indicators
- **User Presence**: View active collaborators with user avatars and names
- **Anonymous Collaboration**: Support for anonymous users with generated session IDs
- **Real-time Code Synchronization**: Instant synchronization of code changes across all connected users

### 💬 **Advanced Commenting System**
- **Visual Comment Indicators**: Click anywhere on diagrams to add comments with visual markers
- **Threaded Conversations**: Multi-level reply system with hierarchical organization
- **Real-time Comment Updates**: Comments appear instantly for all users
- **Comment Resolution**: Mark threads as resolved to keep discussions organized
- **Comment Panel & Popup**: Sidebar for full comment management and quick popup access
- **Comment Mode Toggle**: Switch between editing and commenting modes seamlessly

### 🔐 **User Authentication & Management**
- **NextAuth.js v5 Integration**: Secure authentication with multiple providers
- **Email/Password Authentication**: Traditional login with bcryptjs password hashing
- **Google OAuth**: Single sign-on with Google accounts
- **User Session Management**: Persistent sessions with NextAuth middleware

### 📊 **Diagram Management**
- **Diagram CRUD Operations**: Create, read, update, and delete multiple diagrams
- **Diagram Organization**: Save and organize diagrams in user-specific collections
- **Version Control**: Automatic snapshots with ability to revert to previous versions
- **Diagram Search**: Find diagrams by title and content

### 🚀 **AI-Powered Features**
- **AI Error Fixing**: Google Gemini AI integration for automatic error correction
- **Smart Suggestions**: AI-powered recommendations for diagram improvements
- **Error Explanation**: AI provides clear explanations of what went wrong and how fixes work

### 🌐 **Sharing & Export**
- **Shareable Links**: Generate secure tokens for sharing diagrams with others
- **Public/Private Diagrams**: Control diagram visibility and access permissions
- **Multiple Export Formats**: Export diagrams to PNG and SVG with customizable options
  - **PNG Export**: High-resolution PNG with adjustable pixel ratio (1x-4x)
  - **SVG Export**: Scalable vector graphics with background options
  - **Background Customization**: White or transparent backgrounds for both formats
- **Export Tokens**: Secure tokens for accessing exported diagrams

### 📚 **Sample Templates**
- **Pre-built Diagrams**: Collection of sample diagrams for various use cases
- **Template Loading**: Quick start with professionally designed templates
- **Customizable Samples**: Modify and save samples as your own diagrams

### 🔧 **Developer Experience**
- **TypeScript**: Full type safety throughout the application
- **Material-UI**: Modern, accessible user interface components
- **Database Integration**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Development Tools**: Built-in database studio and migration management
- **Real-time WebSocket**: Separate WebSocket server for collaborative features

### 🏗️ **Architecture & Infrastructure**
- **Next.js 16+**: Modern React framework with App Router
- **PostgreSQL Database**: Robust relational database with Drizzle ORM
- **WebSocket Server**: Dedicated server for real-time collaboration
- **Puppeteer Integration**: Server-side rendering for export functionality
- **Responsive Design**: Mobile-friendly interface that works on all devices

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
GOOGLE_API_KEY=your-gemini-api-key
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
- `GOOGLE_API_KEY`

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

