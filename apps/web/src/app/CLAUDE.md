# src/app/ Directory Guide

This directory contains all Next.js App Router pages and API routes.

## Directory Structure

```
app/
├── (home)/           # Home page route group
│   ├── page.tsx      # Landing page
│   └── _components/  # Home-specific components
├── (inside)/         # Authenticated area route group
│   ├── create/       # Create exercises page
│   ├── explore/      # Explore exercises page
│   └── _components/  # Shared inside components
├── auth/             # Authentication pages
│   ├── login/        # Login page
│   ├── signup/       # Registration page
│   ├── verify/       # Email verification page
│   └── reset-password/ # Password reset page
├── problem/          # Problem solving interface
│   └── [id]/         # Dynamic problem route
├── api/              # API routes
│   └── v1/           # API version 1
├── layout.tsx        # Root layout
├── globals.css       # Global styles
└── favicon.ico       # Site favicon
```

## Route Groups

### `(home)`
Public landing page with marketing content:
- Hero section
- Features showcase
- Collaborators carousel

### `(inside)`
Authenticated user area:
- Requires valid session token
- Has its own layout with navbar/footer
- Contains exercise creation and exploration

### `auth`
Authentication flow pages:
- All public routes
- Handles signup, login, password reset, email verification

### `problem/[id]`
Code editor interface for solving problems:
- Monaco Editor integration
- 10 programming languages (JS, TS, Python, Java, Go, Rust, C++, C#, Ruby, Swift)
- 5 editor themes (VS Dark, VS Light, GitHub Dark, Monokai, Solarized Dark)
- Input/Output panels
- AI Chat panel
- Problem description panel
- Resizable panel layout

**Problem page components** (`[id]/_components/`):
- `EditorPanel.tsx` - Monaco code editor
- `OutputPanel.tsx` - Code execution output
- `InputPanel.tsx` - Standard input
- `ChatPanel.tsx` - AI assistant chat
- `ProblemDescription.tsx` - Exercise description
- `Header.tsx` - Page header with controls
- `LanguageSelector.tsx` - Language dropdown
- `ThemeSelector.tsx` - Theme dropdown
- `RunButton.tsx` - Code execution button
- `HeaderProfileBtn.tsx` - User profile button

## Conventions

### Page Components
```tsx
// page.tsx should be default export
export default function PageName() {
  return <div>...</div>
}
```

### API Route Handlers
```tsx
// route.ts exports HTTP method handlers
export async function GET(request: NextRequest) { ... }
export async function POST(request: NextRequest) { ... }
```

### Private Components
- Use `_components/` folder for route-specific components
- These won't be treated as routes by Next.js

### Layouts
- `layout.tsx` wraps all child routes
- Use for shared UI (headers, footers, providers)
