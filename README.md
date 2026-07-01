# Go Cloud Functions on EdgeOne Pages - Handler Mode

A function request demonstration website based on Next.js + Tailwind CSS, showcasing how to deploy Go Cloud Functions using Handler Mode on EdgeOne Pages with file-based routing.

## 🚀 Features

- **File-Based Routing**: Go handler files map directly to API endpoints, just like Next.js file routing
- **Modern UI Design**: Adopts black background with white text theme, using #1c66e5 as accent color
- **Real-time API Demo**: Integrated Go backend with interactive API call testing for all route types
- **Multiple Route Patterns**: Supports static, index, dynamic, nested dynamic, and catch-all routes
- **TypeScript Support**: Complete type definitions and type safety

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React full-stack framework
- **React 19** - User interface library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first CSS framework

### UI Components
- **shadcn/ui** - High-quality React components
- **Lucide React** - Beautiful icon library
- **class-variance-authority** - Component style variant management
- **clsx & tailwind-merge** - CSS class name merging utilities

### Backend
- **Go 1.21** - Cloud Functions runtime
- **Handler Mode** - File-based routing for Go functions on EdgeOne Pages

## 📁 Project Structure

```
go-handler-template/
├── cloud-functions/                # Go Cloud Functions source
│   ├── hello.go                   # Static route → GET /hello
│   └── api/
│       ├── posts/
│       │   └── index.go           # Index route → GET /api/posts
│       ├── users/
│       │   ├── [userId].go        # Dynamic param → GET /api/users/:userId
│       │   └── [userId]/
│       │       └── posts/
│       │           └── [postId].go # Nested params → GET /api/users/:userId/posts/:postId
│       └── files/
│           └── [[path]].go        # Catch-all → GET /api/files/*path
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── globals.css           # Global styles
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Main page (API demo UI)
│   ├── components/               # React components
│   │   └── ui/                   # UI base components
│   │       ├── button.tsx        # Button component
│   │       └── card.tsx          # Card component
│   └── lib/                      # Utility functions
│       └── utils.ts              # Common utilities
├── public/                        # Static assets
├── package.json                   # Project configuration
└── README.md                     # Project documentation
```

## 🚀 Quick Start

### Requirements

- Node.js 18+
- npm or yarn
- Go 1.21+ (for local development)

### Install Dependencies

```bash
npm install
# or
yarn install
```

### Development Mode

```bash
edgeone pages dev
```

Visit [http://localhost:8088](http://localhost:8088) to view the application.

### Build Production Version

```bash
edgeone pages build
```

## 🎯 Core Features

### 1. File-Based Go Routing

The `cloud-functions/` directory maps directly to API routes:

| File | Route | Pattern |
|------|-------|---------|
| `hello.go` | `GET /hello` | Static route |
| `api/posts/index.go` | `GET /api/posts` | Index route |
| `api/users/[userId].go` | `GET /api/users/:userId` | Dynamic parameter |
| `api/users/[userId]/posts/[postId].go` | `GET /api/users/:userId/posts/:postId` | Nested dynamic parameters |
| `api/files/[[path]].go` | `GET /api/files/*path` | Catch-all route |

### 2. Interactive API Demo

- Click "Call" to test each API endpoint in real-time
- View JSON response with syntax highlighting
- Expandable source file path display

### 3. Handler Convention

Each Go file exports a standard `Handler` function:

```go
package handler

import (
    "encoding/json"
    "net/http"
)

func Handler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "message": "Hello from Go Cloud Functions!",
    })
}
```

## 🔧 Configuration

### Tailwind CSS Configuration
The project uses Tailwind CSS 4 with custom color variables:

```css
:root {
  --primary: #1c66e5;        /* Primary color */
  --background: #000000;     /* Background color */
  --foreground: #ffffff;     /* Foreground color */
}
```

### Component Styling
Uses `class-variance-authority` to manage component style variants with multiple preset styles.

## 📚 Documentation

- **EdgeOne Pages Official Docs**: [https://pages.edgeone.ai/document/go](https://pages.edgeone.ai/document/go)
- **Next.js Documentation**: [https://nextjs.org/docs](https://nextjs.org/docs)
- **Tailwind CSS Documentation**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **Go Documentation**: [https://go.dev/doc](https://go.dev/doc)

## 🚀 Deployment Guide

### EdgeOne Pages Deployment

1. Push code to GitHub repository
2. Create new project in EdgeOne Pages console
3. Select GitHub repository as source
4. Configure build command: `edgeone pages build`
5. Deploy project

### Go Cloud Functions Configuration

Create `cloud-functions/` folder in project root and add Go handler files:

```go
// cloud-functions/hello.go
package handler

import (
    "encoding/json"
    "net/http"
)

func Handler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "message": "Hello from Go!",
    })
}
```

## Deploy

[![Deploy with EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?from=github&template=go-handler-template)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/github/choosealicense.com/blob/gh-pages/_licenses/mit.txt) file for details.
