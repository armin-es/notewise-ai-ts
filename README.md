# NoteWise AI

A modern, full-stack AI agent application built with Next.js, TypeScript, and the latest AI SDK stack. Transform your notes into an intelligent assistant that can search, reason, and perform actions using your knowledge base through RAG (Retrieval-Augmented Generation) and tool calling capabilities.

## Features

- **AI Agent with Tool Calling**: Multi-step reasoning agent that can search notes, draft content, and perform actions using your knowledge base
- **Smart RAG Pipeline**: Upload markdown notes, automatically chunked and embedded using OpenAI
- **Vector Search**: Fast semantic search powered by pgvector with HNSW indexing
- **AI Chat Interface**: Ask questions and get answers grounded in your notes with agentic capabilities
- **File Management**: Upload, view, and delete embedded files through an intuitive UI
- **Authentication**: Secure user authentication with Clerk
- **Modern Stack**: Built with Next.js 16, React 19, Drizzle ORM, and Vercel AI SDK

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS
- **Database**: PostgreSQL with pgvector extension
- **ORM**: Drizzle ORM
- **AI**: Vercel AI SDK, OpenAI (GPT-4o, text-embedding-3-small)
- **Auth**: Clerk
- **Validation**: Zod

## Prerequisites

- Node.js 18+ and pnpm (or npm/yarn)
- PostgreSQL database with pgvector extension (or Docker)
- OpenAI API key
- Clerk account (for authentication)

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd notewise-ai-ts
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your actual credentials:

- **Database**: Update `DATABASE_URL` with your PostgreSQL connection string
- **Clerk**: Get keys from [Clerk Dashboard](https://dashboard.clerk.com) - see [CLERK_SETUP.md](./CLERK_SETUP.md)
- **OpenAI**: Get API key from [OpenAI Platform](https://platform.openai.com/api-keys) - see [OPENAI_SETUP.md](./OPENAI_SETUP.md)

### 4. Set Up Database

#### Option A: Using Docker (Recommended)

```bash
docker-compose up -d
```

This starts a PostgreSQL database with pgvector extension on port 5432.

#### Option B: Local PostgreSQL

Ensure you have PostgreSQL installed with the pgvector extension enabled.

### 5. Run Database Migrations

```bash
pnpm db:generate  # Generate migration files
pnpm db:migrate   # Apply migrations to database
```

### 6. Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Uploading Notes

1. Sign in with Clerk
2. Use the file upload component in the sidebar
3. Upload markdown (`.md`) files
4. Files are automatically chunked, embedded, and stored

### Chatting with Your AI Agent

1. Ask questions or request actions in the chat interface
2. The AI agent searches your notes using vector similarity
3. The agent can perform multi-step reasoning and use tools to accomplish tasks
4. Responses are grounded in your uploaded content with sources cited automatically

### Managing Files

- View all uploaded files in the sidebar
- See chunk counts and upload dates
- Delete files and their embeddings when needed

## Project Structure

```
notewise-ai-ts/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API routes
│   │   │   ├── chat/     # Chat endpoint with RAG
│   │   │   ├── upload/   # File upload endpoint
│   │   │   └── embeddings/ # File management endpoint
│   │   ├── layout.tsx    # Root layout with Clerk
│   │   └── page.tsx      # Main page
│   ├── components/       # React components
│   │   ├── chat/         # Chat interface
│   │   ├── upload/       # File upload UI
│   │   └── embeddings/   # File list component
│   └── lib/
│       ├── db/           # Database schema and connection
│       └── rag/          # RAG utilities (embeddings, vector store)
├── drizzle/              # Database migrations
├── scripts/              # Utility scripts
└── docker-compose.yml    # Local database setup
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm ingest` - Ingest markdown files from `data/notes/` directory
- `pnpm db:generate` - Generate Drizzle migration files
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Drizzle Studio (database GUI)

## Development

### Adding Notes via Script

Create a `data/notes/` directory and add markdown files:

```bash
mkdir -p data/notes
echo "# My Notes\nContent here..." > data/notes/my-notes.md
pnpm ingest
```

### Database Management

View your database using Drizzle Studio:

```bash
pnpm db:studio
```

## Documentation

- [CLERK_SETUP.md](./CLERK_SETUP.md) - Setting up Clerk authentication
- [OPENAI_SETUP.md](./OPENAI_SETUP.md) - Setting up OpenAI API key
- [VIEW_DATABASE.md](./VIEW_DATABASE.md) - How to view and manage the database
- [DATABASE_CONCEPTS.md](./DATABASE_CONCEPTS.md) - Understanding indexes and connection pooling
- [HNSW_EXPLANATION.md](./HNSW_EXPLANATION.md) - How HNSW indexing works for vectors
- [EMBEDDINGS_GUIDE.md](./EMBEDDINGS_GUIDE.md) - Guide to embeddings and vector search
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions

## Security

- Never commit `.env.local` (it's in `.gitignore`)
- All API keys are stored in environment variables
- Authentication is handled by Clerk
- Database credentials should be kept secure

## Deployment

This project is ready for deployment on Vercel:

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

Make sure to set up your production database (e.g., Vercel Postgres with pgvector, Supabase, or Neon).

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
