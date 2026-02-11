# src/components/ Directory Guide

This directory contains reusable React components used across the application.

## Directory Structure

```
components/
├── ui/               # Base UI components (shadcn/ui style)
│   ├── button.tsx
│   ├── input.tsx
│   ├── card.tsx
│   ├── form.tsx
│   ├── chat/         # Chat-related components
│   └── ...
├── composed/         # Composed/complex components
│   ├── alert-component.tsx
│   └── confirmation-button.tsx
├── login-form.tsx    # Auth form components
├── signup-form.tsx
├── reset-password-form.tsx
└── verify-form.tsx
```

## UI Components (`ui/`)

Base UI components following shadcn/ui patterns:
- Built on Radix UI primitives
- Styled with Tailwind CSS
- Use `class-variance-authority` for variants

### Available Components
- `button` - Button with variants (default, destructive, outline, etc.)
- `input` - Text input field
- `label` - Form label
- `card` - Card container with header, content, footer
- `form` - Form components with react-hook-form integration
- `tabs` - Tab navigation
- `select` - Dropdown select
- `avatar` - User avatar
- `badge` - Status badges
- `alert` - Alert messages
- `alert-dialog` - Confirmation dialogs
- `carousel` - Image/content carousel
- `skeleton` - Loading skeleton
- `table` - Data table
- `textarea` - Multi-line text input
- `scroll-area` - Custom scrollable area
- `resizable` - Resizable panels

### Chat Components (`ui/chat/`)
- `chat-bubble` - Message bubble
- `chat-input` - Message input field
- `chat-message-list` - Message list container
- `expandable-chat` - Expandable chat panel
- `message-loading` - Loading indicator

## Composed Components (`composed/`)

Higher-level components combining multiple UI primitives:
- `alert-component` - Pre-configured alert with common patterns
- `confirmation-button` - Button with confirmation dialog

## Auth Form Components

Form components for authentication flows:
- `login-form.tsx` - Login form with validation
- `signup-form.tsx` - Registration form
- `reset-password-form.tsx` - Password reset form
- `verify-form.tsx` - Email verification form

### Form Features
- React Hook Form integration
- Zod schema validation
- Cloudflare Turnstile integration (production)
- Loading states
- Error handling

## Usage Patterns

### Importing UI Components
```tsx
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
```

### Component Variants
```tsx
<Button variant="default">Primary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Link</Button>
```

### Form Integration
```tsx
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
```

## Adding New Components

1. For base UI: Add to `ui/` following shadcn/ui patterns
2. For composed: Add to `composed/` combining existing primitives
3. Export from component file directly (no barrel exports)
