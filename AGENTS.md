# Repository Guidelines

## Project Overview
This is a full-featured Mermaid Diagram Editor built with Next.js 16+, React 19+, and TypeScript. The application supports real-time collaboration, advanced commenting, AI-powered features, and comprehensive diagram management.

## Project Structure & Module Organization
The codebase uses Next.js App Router with the following organization:

```
src/
├── app/                    # Next.js App Router routes
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth authentication endpoints
│   │   ├── diagrams/      # Diagram CRUD operations
│   │   ├── fix-diagram/   # AI-powered error fixing
│   │   ├── samples/       # Sample diagram templates
│   │   └── share/         # Diagram sharing functionality
│   ├── diagrams/          # Diagram management pages
│   ├── editor/            # Main diagram editor interface
│   ├── login/             # User authentication pages
│   ├── signup/            # User registration pages
│   └── share/             # Shared diagram access pages
├── components/            # Reusable UI components
│   ├── CodeEditor.tsx     # Monaco code editor integration
│   ├── MermaidRenderer.tsx # Mermaid diagram rendering
│   ├── SamplesSidebar.tsx # Sample diagram browser
│   ├── comments/          # Commenting system components
│   ├── editor/            # Editor-specific components
│   └── realtime/          # Real-time collaboration components
├── db/                    # Database configuration and schema
│   ├── schema.ts          # Drizzle ORM schema definitions
│   └── index.ts           # Database connection setup
├── lib/                   # Utility libraries and helpers
│   ├── gemini.ts          # Google Gemini AI integration
│   ├── export.ts          # Diagram export functionality
│   ├── theme.ts           # Material-UI theme configuration
│   ├── websocket.ts       # WebSocket client utilities
│   └── anonymousSession.ts # Anonymous user session management
├── hooks/                 # Custom React hooks
│   ├── useDebounce.ts     # Debouncing utility hook
│   ├── useWebSocket.ts    # WebSocket connection hook
│   └── editor/            # Editor-specific hooks
├── types/                 # TypeScript type definitions
├── contexts/              # React context providers
└── data/                  # Static data and samples
    ├── sample_data.ts     # Sample diagram data
    └── samples.ts         # Sample diagram definitions
```

Database tables, Drizzle helpers, and migrations sit under `src/db` with tooling in `drizzle.config.ts`. Bootstrap via `scripts/setup-database.js`. Place tests beside the implementation (e.g., `FeaturePanel.test.tsx`) so reviewers can trace intent quickly.

## Core Features & Architecture

### 🎨 Diagram Editing & Rendering
- **Real-time Editing**: Monaco code editor with live Mermaid preview
- **Comprehensive Support**: All Mermaid diagram types (flowchart, sequence, class, state, ER, gantt, pie, journey, gitgraph)
- **Error Detection**: Automatic syntax validation with clear error messages
- **Preview Controls**: Zoom, fullscreen mode, and responsive design

### 🤝 Real-Time Collaboration
- **Live Editing**: Multiple users can edit simultaneously
- **Live Cursors**: Real-time cursor positions with color-coded indicators
- **User Presence**: Active collaborator avatars and names
- **Anonymous Support**: Generated session IDs for guest users
- **WebSocket Integration**: Separate WebSocket server for real-time features

### 💬 Advanced Commenting System
- **Visual Indicators**: Click-to-comment with visual markers on diagrams
- **Threaded Conversations**: Multi-level reply system
- **Real-time Updates**: Instant comment synchronization
- **Resolution System**: Mark threads as resolved
- **Multiple Interfaces**: Sidebar panel and popup access

### 🔐 Authentication & User Management
- **NextAuth.js v5**: Secure multi-provider authentication
- **Email/Password**: Traditional auth with bcryptjs hashing
- **Google OAuth**: Single sign-on integration
- **Session Management**: Persistent sessions with middleware

### 🚀 AI-Powered Features
- **Error Fixing**: Google Gemini AI for automatic error correction
- **Smart Suggestions**: AI-powered diagram improvements
- **Error Explanations**: Clear explanations of issues and fixes

### 📊 Diagram Management
- **CRUD Operations**: Create, read, update, delete diagrams
- **Version Control**: Automatic snapshots with revert capability
- **Search Functionality**: Find diagrams by title and content
- **Organization**: User-specific collections

### 🌐 Sharing & Export
- **Shareable Links**: Secure token-based sharing
- **Access Control**: Public/private diagram visibility
- **Multiple Formats**: PNG and SVG export with customization
- **Export Tokens**: Secure access to exported diagrams

## Build, Test, and Development Commands
- `pnpm dev` — run the development server on port 4025 with hot reload
- `pnpm build` — create the production bundle and type-check
- `pnpm start` — serve the compiled `.next` output, mirroring production
- `pnpm lint` — enforce the Next.js ESLint preset; fix warnings before PRs
- `pnpm db:setup` — create the local database and seed default data
- `pnpm db:push` — apply Drizzle schema changes to the configured database
- `pnpm db:studio` — open Drizzle Studio for table inspection or quick edits

## Database Setup & Schema

### Database Configuration
- **Database**: PostgreSQL (Railway or any PostgreSQL instance)
- **ORM**: Drizzle ORM for type-safe database operations
- **Migrations**: Automatic schema management with `pnpm db:push`

### Key Tables
- **users**: User accounts with email and hashed passwords
- **diagrams**: User-created diagrams with code, title, and sharing settings
- **sample_diagrams**: Pre-built sample diagrams for templates
- **comments**: Comment threads and replies for diagram collaboration
- **snapshots**: Version control snapshots for diagram history

### Setup Process
1. Configure `DATABASE_URL` in `.env.local`
2. Run `pnpm db:setup` to create database
3. Run `pnpm db:push` to apply schema migrations
4. Optionally seed with sample diagrams using `pnpm db:studio`

## WebSocket Server
Real-time collaboration features require a separate WebSocket server:
- **Location**: `scripts/start-websocket-server.js`
- **Combined Server**: `scripts/combined-server.js` for development
- **Integration**: Client-side utilities in `src/lib/websocket.ts`

## API Routes Overview

### Authentication
- `POST /api/auth/signup` - User registration
- `GET/POST /api/auth/[...nextauth]` - NextAuth authentication

### Diagram Management
- `GET/POST /api/diagrams` - List/create diagrams
- `GET/PATCH/DELETE /api/diagrams/[id]` - Diagram CRUD operations
- `POST /api/diagrams/[id]/duplicate` - Duplicate existing diagram
- `GET/POST /api/diagrams/[id]/snapshots` - Version control
- `POST /api/diagrams/[id]/snapshots/[snapshotId]/revert` - Revert to snapshot

### Collaboration & Sharing
- `POST /api/diagrams/[id]/share` - Generate share link
- `GET /api/share/[token]` - Access shared diagram
- `GET/POST /api/diagrams/[id]/comments` - Comment management
- `PATCH/DELETE /api/diagrams/[id]/comments/[commentId]` - Comment operations
- `GET/POST /api/diagrams/[id]/ws` - WebSocket endpoint for real-time features

### Export & AI Features
- `GET/POST /api/export/[...slug]` - Diagram export (PNG/SVG)
- `POST /api/fix-diagram` - AI-powered error fixing
- `GET /api/samples` - Get sample diagram templates

## Coding Style & Naming Conventions
Stick to TypeScript, 2-space indentation, and named exports when practical. Components and layouts use PascalCase; hooks start with `use` and stay in `src/hooks`. Keep server-only utilities in clearly named modules (e.g., `lib/server`) and guard browser APIs before use. Styling relies on MUI + Emotion, so colocate styles with the component for discoverability. Run `pnpm lint` (and enable auto-fix in your editor) prior to every commit.

### Component Organization
- **Feature-based grouping**: Related components in subdirectories
- **Real-time components**: Separate `src/components/realtime/` directory
- **Commenting system**: Dedicated `src/components/comments/` directory
- **Editor components**: Organized in `src/components/editor/`

### Type Safety
- All database operations use Drizzle ORM for type safety
- API routes use Zod for request/response validation
- Component props are fully typed with TypeScript interfaces

## Testing Guidelines
There is no baked-in runner yet, so contributors should add Jest + React Testing Library (or Playwright for browser flows) as needed for their feature. Name specs `*.test.ts(x)` or `*.spec.ts` and colocate them with the code they cover.

### Testing Priorities
- **Diagram Rendering**: Verify Mermaid syntax parsing and SVG generation
- **Real-time Features**: Test WebSocket connections and collaboration
- **Authentication**: Validate NextAuth flows and session management
- **API Routes**: Test all CRUD operations and error handling
- **Export Functionality**: Verify PNG/SVG generation with different options

### Manual Verification
Document manual verification steps in the PR, especially for:
- Diagram rendering and syntax error handling
- Real-time collaboration features
- Authentication flows
- Export functionality
- WebSocket connections

For database updates, include the `pnpm db:push` output or migration summary so reviewers can reproduce locally.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commits (e.g., "Add grid background"). Follow that voice, keep commits focused, and squash noisy fixups. Each PR should summarize the change, link issues, attach screenshots for UI tweaks, and outline test or manual steps. Wait for linting to pass before requesting review.

### PR Requirements
- **Clear Description**: Summarize changes and their impact
- **Testing Evidence**: Include test results or manual verification steps
- **Screenshots**: Required for UI changes
- **Database Changes**: Include migration output for schema changes
- **Breaking Changes**: Clearly document any breaking changes

## Environment & Security Notes
Secrets stay in `.env.local`; never commit credentials. Required values typically include:

### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: Random secret for NextAuth.js
- `NEXTAUTH_URL`: Application URL (http://localhost:4025 for development)
- `GOOGLE_API_KEY`: Google Gemini API key for AI features

### Security Best Practices
- Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`
- Rotate any leaked credentials immediately
- Never commit `.env.local` or include secrets in code
- Use environment-specific configurations for different deployment stages
- Validate all user inputs, especially in API routes
- Implement proper CORS and rate limiting for production

### Development Setup
1. Copy `env.example` to `.env.local`
2. Configure all required environment variables
3. Run `pnpm db:setup` to initialize database
4. Run `pnpm db:push` to apply schema
5. Start development with `pnpm dev`

## Deployment Considerations
- **Railway**: Recommended for PostgreSQL hosting
- **WebSocket Server**: Ensure proper WebSocket support in deployment
- **Environment Variables**: Configure all required variables in production
- **Database Migrations**: Run `pnpm db:push` after deployment
- **Asset Optimization**: Ensure proper handling of exported diagrams and fonts
