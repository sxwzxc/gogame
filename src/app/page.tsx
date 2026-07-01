"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Play, ExternalLink, Zap, ChevronDown, ChevronUp, FolderTree, Route, Layers } from "lucide-react"

interface ApiEndpoint {
  name: string
  method: string
  path: string
  file: string
  description: string
  category: "static" | "dynamic-single" | "dynamic-multi" | "catch-all" | "index"
}

const endpoints: ApiEndpoint[] = [
  {
    name: "Hello",
    method: "GET",
    path: "/hello",
    file: "cloud-functions/hello.go",
    description: "Static route — file name maps directly to path",
    category: "static",
  },
  {
    name: "List Posts",
    method: "GET",
    path: "/api/posts",
    file: "cloud-functions/api/posts/index.go",
    description: "index.go serves as the default handler for a directory",
    category: "index",
  },
  {
    name: "User by ID",
    method: "GET",
    path: "/api/users/u-42",
    file: "cloud-functions/api/users/[userId].go",
    description: "[userId] captures a single dynamic segment",
    category: "dynamic-single",
  },
  {
    name: "User's Post",
    method: "GET",
    path: "/api/users/u-42/posts/p-7",
    file: "cloud-functions/api/users/[userId]/posts/[postId].go",
    description: "Nested dynamic params: [userId] and [postId]",
    category: "dynamic-multi",
  },
  {
    name: "File Access",
    method: "GET",
    path: "/api/files/docs/guide/intro.md",
    file: "cloud-functions/api/files/[[path]].go",
    description: "[[path]] catches all remaining path segments",
    category: "catch-all",
  },
]

const categoryLabels: Record<string, string> = {
  "static": "Static Routes",
  "index": "Index Routes",
  "dynamic-single": "Single Dynamic Param [param]",
  "dynamic-multi": "Multiple Dynamic Params",
  "catch-all": "Catch-All Routes [[param]]",
}

const categoryOrder = ["static", "index", "dynamic-single", "dynamic-multi", "catch-all"]

export default function Home() {
  const [results, setResults] = useState<Record<string, { data: string; status: number } | null>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [expandedCode, setExpandedCode] = useState<string | null>(null)

  const handleApiCall = async (endpoint: ApiEndpoint) => {
    const key = endpoint.path
    setLoadingStates(prev => ({ ...prev, [key]: true }))
    const response = await fetch(endpoint.path)
    const data = await response.json()
    setResults(prev => ({ ...prev, [key]: { data: JSON.stringify(data, null, 2), status: response.status } }))
    setLoadingStates(prev => ({ ...prev, [key]: false }))
  }

  const grouped = categoryOrder.map(cat => ({
    category: cat,
    label: categoryLabels[cat],
    items: endpoints.filter(e => e.category === cat),
  }))

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Grid Background */}
      <div className="grid-background" />

      {/* Background Gradient Orbs - Go Cyan */}
      <div className="gradient-orb gradient-orb-primary w-[600px] h-[600px] -top-[200px] -left-[150px] animate-pulse-glow" />
      <div className="gradient-orb gradient-orb-secondary w-[400px] h-[400px] top-[40%] -right-[100px] animate-pulse-glow animation-delay-200" />

      {/* Gopher SVG Decoration */}
      <svg className="absolute top-[20%] right-[8%] w-[100px] h-[100px] opacity-[0.08]" viewBox="0 0 400 400" fill="currentColor">
        <path d="M200 0c110.5 0 200 89.5 200 200s-89.5 200-200 200S0 310.5 0 200 89.5 0 200 0zm0 50c-82.8 0-150 67.2-150 150s67.2 150 150 150 150-67.2 150-150S282.8 50 200 50z"/>
        <circle cx="140" cy="160" r="30"/>
        <circle cx="260" cy="160" r="30"/>
        <path d="M200 280c-30 0-60-20-60-50h120c0 30-30 50-60 50z"/>
      </svg>

      {/* Header */}
      <header className="header-border relative z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-end">
            <a
              href="https://github.com/TencentEdgeOne/go-handler-template"
              target="_blank"
              rel="noopener noreferrer"
              className="icon-glow text-gray-400 hover:text-[#00ADD8] transition-colors p-2"
              aria-label="GitHub"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-16 relative z-10">
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Hero Section */}
          <div className="text-center space-y-6 animate-fade-in-up">
            {/* Title */}
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00ADD8] via-[#5DC9E2] to-white">
                Go
              </span>
              <span className="text-white/70"> + EdgeOne Pages</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              File-based routing for Go functions. Each <code className="text-[#00ADD8] bg-[#00ADD8]/10 px-1.5 py-0.5 rounded">.go</code> file 
              in <code className="text-[#00ADD8] bg-[#00ADD8]/10 px-1.5 py-0.5 rounded">cloud-functions/</code> automatically 
              maps to an HTTP endpoint.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up animation-delay-100">
            <a href="https://edgeone.ai/pages/new?from=github&template=go-handler-template" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="btn-primary px-8 py-6 text-lg rounded-lg cursor-pointer">
                <Zap className="w-5 h-5 mr-2" />
                One-Click Deployment
              </Button>
            </a>
            <a href="https://pages.edgeone.ai/document/go" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg" className="btn-outline px-8 py-6 text-lg rounded-lg cursor-pointer">
                <ExternalLink className="w-5 h-5 mr-2" />
                View Documentation
              </Button>
            </a>
          </div>

          {/* File Structure Card */}
          <Card className="glass-card border-0 animate-fade-in-up animation-delay-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-400">
                <FolderTree className="w-4 h-4 text-[#00ADD8]" />
                File-Based Routing Structure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="file-tree text-sm leading-relaxed overflow-x-auto">
{`cloud-functions/
├── hello.go                              → GET /hello
├── api/
│   ├── posts/
│   │   └── index.go                      → GET /api/posts
│   ├── users/
│   │   ├── [userId].go                   → GET /api/users/:userId
│   │   └── [userId]/
│   │       └── posts/
│   │           └── [postId].go           → GET /api/users/:userId/posts/:postId
│   └── files/
│       └── [[path]].go                   → GET /api/files/*path (catch-all)`}
              </pre>
            </CardContent>
          </Card>

          {/* API Endpoints by Category */}
          <div className="space-y-6 animate-fade-in-up animation-delay-300">
            {grouped.map(group => (
              <div key={group.category} className="space-y-3">
                <h2 className="category-header">
                  {group.label}
                </h2>
                {group.items.map(endpoint => {
                  const key = endpoint.path
                  const result = results[key]
                  const isLoading = loadingStates[key]
                  const isExpanded = expandedCode === key

                  return (
                    <div key={key} className="route-card p-4 space-y-3">
                      {/* Endpoint header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="method-badge">
                              {endpoint.method}
                            </span>
                            <span className="font-mono text-sm text-gray-200">{endpoint.path}</span>
                          </div>
                          <p className="text-xs text-gray-500">{endpoint.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedCode(isExpanded ? null : key)}
                            className="text-xs text-gray-500 hover:text-[#00ADD8] flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span className="font-mono">{endpoint.file.split("/").pop()}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          <Button
                            size="sm"
                            onClick={() => handleApiCall(endpoint)}
                            disabled={isLoading}
                            className="btn-primary rounded cursor-pointer"
                          >
                            {isLoading ? (
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                            ) : (
                              <Play className="w-3 h-3 mr-1" />
                            )}
                            Call
                          </Button>
                        </div>
                      </div>

                      {/* Expandable source file path */}
                      {isExpanded && (
                        <div className="bg-[#0d1117] rounded px-3 py-2 border border-[#00ADD8]/10">
                          <p className="text-xs text-gray-400 font-mono flex items-center gap-2">
                            <svg className="w-4 h-4 text-[#00ADD8]" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M1.811 10.715l7.931 2.855-.001-5.727-7.93 2.872zm14.912-6.118H8.595v14.523l8.128-2.975V4.597z"/>
                            </svg>
                            {endpoint.file}
                          </p>
                        </div>
                      )}

                      {/* Result */}
                      {result && (
                        <div className="api-response">
                          <div className="px-3 py-2 border-b border-green-500/20">
                            <p className="text-xs text-gray-500 font-mono">
                              Response {result.status > 0 ? `(${result.status})` : ""}
                            </p>
                          </div>
                          <pre className="p-3 text-xs overflow-x-auto">
                            {result.data}
                          </pre>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
            <div className="feature-card p-5 animate-fade-in-up animation-delay-100">
              <div className="w-10 h-10 mb-4 rounded-lg bg-[#00ADD8]/15 flex items-center justify-center">
                <FolderTree className="w-5 h-5 text-[#00ADD8]" />
              </div>
              <h3 className="font-semibold mb-2">File-Based Routing</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Intuitive routing based on file system structure
              </p>
            </div>

            <div className="feature-card p-5 animate-fade-in-up animation-delay-200">
              <div className="w-10 h-10 mb-4 rounded-lg bg-[#00ADD8]/15 flex items-center justify-center">
                <Route className="w-5 h-5 text-[#00ADD8]" />
              </div>
              <h3 className="font-semibold mb-2">Dynamic Routes</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Support for params, nested params, and catch-all
              </p>
            </div>

            <div className="feature-card p-5 animate-fade-in-up animation-delay-300">
              <div className="w-10 h-10 mb-4 rounded-lg bg-[#00ADD8]/15 flex items-center justify-center">
                <Layers className="w-5 h-5 text-[#00ADD8]" />
              </div>
              <h3 className="font-semibold mb-2">Go Performance</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Native Go compilation for maximum efficiency
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer-border relative z-10 mt-16">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <span>Powered by</span>
            <a 
              href="https://pages.edgeone.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-[#00ADD8] transition-colors flex items-center gap-1"
            >
              <img src="/eo-logo-blue.svg" alt="EdgeOne" width={16} height={16} />
              EdgeOne Pages
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
