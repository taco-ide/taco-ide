# src/data/ Directory Guide

This directory contains static data files used by the application.

## Files

### collaborators.json

Contains information about project collaborators displayed on the home page.

#### Structure
```json
[
  {
    "id": 1,
    "name": "Collaborator Name",
    "role": "Role/Title",
    "image": "/path/to/image.jpg",
    "github": "https://github.com/username",
    "linkedin": "https://linkedin.com/in/username"
  }
]
```

#### Usage
Fetched via `/api/v1/collaborators` endpoint and displayed in the Collaborators carousel on the home page.

## API Endpoint

The collaborators data is served through:
- **Route**: `GET /api/v1/collaborators`
- **Response**: JSON array of collaborator objects

## Adding New Data Files

1. Create JSON file in `src/data/`
2. Create corresponding API route in `src/app/api/v1/`
3. Import and serve the data

### Example API Route
```typescript
// src/app/api/v1/mydata/route.ts
import data from "@/data/mydata.json"

export async function GET() {
  return Response.json(data)
}
```

## Notes

- Keep data files focused and single-purpose
- Use JSON format for structured data
- Consider moving to database if data needs to be dynamic
- Images referenced should exist in `/public/` directory
