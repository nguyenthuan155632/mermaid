# Create a Mermaid diagram editor web application with features similar to Mermaid.live. The application should be built using Next.js 16+ with React 19+ and TypeScript.
## Required Features

### 1. Diagram Editing

- Provide a code editor for writing Mermaid diagram syntax
- Real-time preview of the rendered diagram as the user types
- Support for all standard Mermaid diagram types (flowchart, sequence, class, state, ER, gantt, pie, etc.)

### 2. Diagram Management

- Allow users to save multiple diagrams to their account
- Enable users to create, read, update, and delete their saved diagrams
- Provide a list/gallery view of all saved diagrams for easy access

### 3. Authentication

- Implement user authentication using NextAuth.js v5
- Support login and logout functionality
- Secure user-specific diagram storage using Neon PostgreSQL with Drizzle ORM
- Hash passwords using bcryptjs

### 4. Sample Diagrams

- Include a collection of pre-built sample diagrams demonstrating different Mermaid diagram types
- Allow users to load samples into the editor as starting templates

### 5. Error Detection and Validation

- Detect and display syntax errors when Mermaid code fails to render
- Show clear error messages indicating what went wrong and where in the code
- Gracefully handle rendering failures without breaking the application

### 6. Al-Powered Error Fixing

- Integrate Google Gemini AI (using @google/generative-ai package) to automatically suggest fixes for invalid Mermaid syntax
- Provide a "Fix with AI" button that sends the broken code to Gemini and applies the suggested correction
- Display the AI's explanation of what was wrong and how it was fixed

### 7. Export Functionality

- Enable export of rendered diagrams to PNG format
- Enable export of rendered diagrams to SVG format
- Provide download buttons for both export formats

### 8. Preview Controls

- Implement zoom in/zoom out controls for the diagram preview
- Add a fullscreen mode toggle for distraction-free viewing
- Ensure smooth zoom and pan interactions

### 9. Sharing Capability

- Generate shareable links for diagrams
- Allow users to share diagrams with others (either publicly or with specific permissions)
- Consider implementing a unique URL for each shared diagram

## Technical Requirements

- Use the latest stable versions of all packages
- Follow the dependency structure provided, ensuring compatibility:
- Next.js 16.0.1+
- React 19.2.0+
- NextAuth. js 5.0.0-beta.22+
- Google Generative AI 0.24.1+
- Neon PostgreSQL serverless 1.0.2+
- Drizzle ORM 0.44.7+
- TypeScript 5.9.3+
- Zod 4.1.12+ for schema validation

## Implementation Notes

- Set up Drizzle ORM with Neon PostgreSQL for database operations
- Use environment variables (dotenv) for API keys and database credentials
- Implement proper TypeScript types throughout the application
- Use Zod for runtime validation of user inputs and API responses
- Configure ESLint with Next.js config for code quality
- Use Sharp for any server-side image processing if needed
