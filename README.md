
# Anime Database API Documentation

## Overview

The Anime Database API is a comprehensive RESTful service built on Cloudflare Workers integrated with Cloudflare D1 SQLite database. This API provides full CRUD (Create, Read, Update, Delete) operations for managing anime shows and their episodes, along with advanced search capabilities, bulk operations, and rate limiting.

## Technical Stack

- **Platform**: Cloudflare Workers (Serverless)
- **Database**: Cloudflare D1 (SQLite-compatible distributed database)
- **Cache**: Cloudflare KV Store (ANIME_CACHE)
- **Rate Limiting**: Cloudflare KV Store (ANIME_KV)
- **Authentication**: API Key-based (X-API-Key header)

## Database Schema

The database consists of two main tables:

### Anime Table

```sql
CREATE TABLE IF NOT EXISTS anime (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    genre TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Episodes Table

```sql
CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anime_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    episode_number INTEGER NOT NULL,
    thumbnail_url TEXT NOT NULL,
    video_url_480p TEXT,
    video_url_720p TEXT,
    video_url_1080p TEXT,
    video_url_max_quality TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE,
    UNIQUE (anime_id, episode_number)
);
```

### Indexes

For performance optimization, the following indexes are defined:

```sql
CREATE INDEX IF NOT EXISTS idx_anime_title ON anime(title);
CREATE INDEX IF NOT EXISTS idx_anime_genre ON anime(genre);
CREATE INDEX IF NOT EXISTS idx_episodes_anime_id ON episodes(anime_id);
CREATE INDEX IF NOT EXISTS idx_episodes_title ON episodes(title);
```

## API Functionality

### 1. Authentication

- **Method**: API Key authentication via `X-API-Key` header
- **Key**: `7291826614`
- **Required for**: All POST, PUT, DELETE operations
- **Not required for**: GET operations (read-only access)

### 2. Rate Limiting

The API implements IP-based rate limiting:
- Tracks requests per client IP using Cloudflare KV
- Enforces a limit of 20 write operations (POST, PUT, DELETE) per minute
- Returns 429 status code when rate limit is exceeded, with a Retry-After header

### 3. Caching

The API uses intelligent caching strategies:
- **Search results**: Cached for 5 minutes
- **Single item retrieval**: Cached for 10 minutes
- **List retrieval**: Cached for 3 minutes
- **API documentation**: Cached for 24 hours
- Uses ETag headers for cache validation
- Cache keys are based on request parameters

### 4. CORS Support

The API includes comprehensive CORS headers:
- Allows requests from all origins (`*`)
- Supports all required HTTP methods
- Sets appropriate cache control headers
- Handles preflight OPTIONS requests

### 5. Core Endpoints

#### Anime Resource

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/api/anime` | GET | List all anime | No |
| `/api/anime` | POST | Create a new anime | Yes |
| `/api/anime/:id` | GET | Get a specific anime by ID | No |
| `/api/anime/:id` | PUT | Update an anime | Yes |
| `/api/anime/:id` | DELETE | Delete an anime and its episodes | Yes |

#### Episodes Resource

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/api/episodes` | GET | List all episodes (can filter by anime_id) | No |
| `/api/episodes` | POST | Create a new episode | Yes |
| `/api/episodes/:id` | GET | Get a specific episode by ID | No |
| `/api/episodes/:id` | PUT | Update an episode | Yes |
| `/api/episodes/:id` | DELETE | Delete an episode | Yes |

#### Search Functionality

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/api/search` | GET | Search for anime and episodes | No |

#### Bulk Operations

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/api/bulk/:resource` | POST | Perform bulk operations on anime or episodes | Yes |

#### API Documentation

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `/api` or `/api/docs` | GET | Get API documentation | No |

## Detailed Endpoint Documentation

### Anime Endpoints

#### GET /api/anime
Returns a list of all anime ordered by title.

**Response Example:**
```json
[
  {
    "id": 1,
    "title": "Naruto",
    "thumbnail_url": "https://example.com/naruto.jpg",
    "genre": "Action, Adventure",
    "description": "Ninja adventure",
    "created_at": "2023-05-15T12:00:00Z",
    "updated_at": "2023-05-15T12:00:00Z"
  },
  {
    "id": 2,
    "title": "One Piece",
    "thumbnail_url": "https://example.com/onepiece.jpg",
    "genre": "Adventure, Fantasy",
    "description": "Pirate adventure",
    "created_at": "2023-05-16T12:00:00Z",
    "updated_at": "2023-05-16T12:00:00Z"
  }
]
```

#### POST /api/anime
Creates a new anime entry.

**Required Fields:**
- `title` (string)
- `thumbnail_url` (string)
- `genre` (string)

**Optional Fields:**
- `description` (string)

**Request Example:**
```json
{
  "title": "Attack on Titan",
  "thumbnail_url": "https://example.com/aot.jpg",
  "genre": "Action, Drama, Fantasy",
  "description": "Humanity's struggle against giant humanoids"
}
```

**Response Example:**
```json
{
  "message": "Anime created successfully",
  "id": 3
}
```

#### GET /api/anime/:id
Returns details of a specific anime by ID.

**Response Example:**
```json
{
  "id": 3,
  "title": "Attack on Titan",
  "thumbnail_url": "https://example.com/aot.jpg",
  "genre": "Action, Drama, Fantasy",
  "description": "Humanity's struggle against giant humanoids",
  "created_at": "2023-05-17T12:00:00Z",
  "updated_at": "2023-05-17T12:00:00Z"
}
```

#### PUT /api/anime/:id
Updates an existing anime entry. Only specified fields will be updated.

**Request Example:**
```json
{
  "description": "Humanity's last stand against giant humanoids called Titans"
}
```

**Response Example:**
```json
{
  "message": "Anime updated successfully",
  "id": 3
}
```

#### DELETE /api/anime/:id
Deletes an anime and all its associated episodes (cascading delete).

**Response Example:**
```json
{
  "message": "Anime and related episodes deleted successfully"
}
```

### Episodes Endpoints

#### GET /api/episodes
Returns a list of all episodes or filtered by anime_id if provided.

**Query Parameters:**
- `anime_id` (optional): Filter episodes by anime ID

**Response Example:**
```json
[
  {
    "id": 1,
    "anime_id": 1,
    "anime_title": "Naruto",
    "title": "Enter: Naruto Uzumaki!",
    "episode_number": 1,
    "thumbnail_url": "https://example.com/naruto-ep1.jpg",
    "video_url_480p": "https://example.com/naruto-ep1-480p.mp4",
    "video_url_720p": "https://example.com/naruto-ep1-720p.mp4",
    "video_url_1080p": "https://example.com/naruto-ep1-1080p.mp4",
    "video_url_max_quality": "https://example.com/naruto-ep1-1080p.mp4",
    "created_at": "2023-05-15T12:00:00Z",
    "updated_at": "2023-05-15T12:00:00Z"
  },
  {
    "id": 2,
    "anime_id": 1,
    "anime_title": "Naruto",
    "title": "My Name is Konohamaru!",
    "episode_number": 2,
    "thumbnail_url": "https://example.com/naruto-ep2.jpg",
    "video_url_480p": "https://example.com/naruto-ep2-480p.mp4",
    "video_url_720p": "https://example.com/naruto-ep2-720p.mp4",
    "video_url_1080p": "https://example.com/naruto-ep2-1080p.mp4",
    "video_url_max_quality": "https://example.com/naruto-ep2-1080p.mp4",
    "created_at": "2023-05-15T12:10:00Z",
    "updated_at": "2023-05-15T12:10:00Z"
  }
]
```

#### POST /api/episodes
Creates a new episode.

**Required Fields:**
- `anime_id` (integer)
- `title` (string)
- `episode_number` (integer)
- `thumbnail_url` (string)
- `video_url_max_quality` (string)

**Optional Fields:**
- `video_url_480p` (string)
- `video_url_720p` (string)
- `video_url_1080p` (string)

**Request Example:**
```json
{
  "anime_id": 1,
  "title": "Sasuke and Sakura: Friends or Foes?",
  "episode_number": 3,
  "thumbnail_url": "https://example.com/naruto-ep3.jpg",
  "video_url_480p": "https://example.com/naruto-ep3-480p.mp4",
  "video_url_720p": "https://example.com/naruto-ep3-720p.mp4",
  "video_url_1080p": "https://example.com/naruto-ep3-1080p.mp4",
  "video_url_max_quality": "https://example.com/naruto-ep3-1080p.mp4"
}
```

**Response Example:**
```json
{
  "message": "Episode created successfully",
  "id": 3
}
```

#### GET /api/episodes/:id
Returns details of a specific episode by ID.

**Response Example:**
```json
{
  "id": 3,
  "anime_id": 1,
  "anime_title": "Naruto",
  "title": "Sasuke and Sakura: Friends or Foes?",
  "episode_number": 3,
  "thumbnail_url": "https://example.com/naruto-ep3.jpg",
  "video_url_480p": "https://example.com/naruto-ep3-480p.mp4",
  "video_url_720p": "https://example.com/naruto-ep3-720p.mp4",
  "video_url_1080p": "https://example.com/naruto-ep3-1080p.mp4",
  "video_url_max_quality": "https://example.com/naruto-ep3-1080p.mp4",
  "created_at": "2023-05-15T12:20:00Z",
  "updated_at": "2023-05-15T12:20:00Z"
}
```

#### PUT /api/episodes/:id
Updates an existing episode. Only specified fields will be updated.

**Request Example:**
```json
{
  "title": "Sasuke and Sakura: Teammates",
  "video_url_1080p": "https://example.com/naruto-ep3-1080p-remastered.mp4",
  "video_url_max_quality": "https://example.com/naruto-ep3-1080p-remastered.mp4"
}
```

**Response Example:**
```json
{
  "message": "Episode updated successfully",
  "id": 3
}
```

#### DELETE /api/episodes/:id
Deletes a specific episode.

**Response Example:**
```json
{
  "message": "Episode deleted successfully"
}
```

### Search Endpoint

#### GET /api/search
Searches anime and episodes with powerful filtering and sorting options.

**Query Parameters:**
- `q` (string, optional): Search query
- `type` (string, optional): Result type: 'all', 'anime', or 'episodes'. Default: 'all'
- `genre` (string, optional): Filter by genre
- `sort` (string, optional): Sort results: 'relevance', 'newest', 'oldest', 'title_asc', 'title_desc'. Default: 'relevance'
- `page` (integer, optional): Page number for pagination. Default: 1
- `limit` (integer, optional): Results per page (max 100). Default: 20
- `fuzzy` (boolean, optional): Enable/disable fuzzy search. Default: true

**Note:** At least one of `q` or `genre` is required.

**Fuzzy Search Features:**
1. Character deletion (handles missing letters)
2. Character swapping (handles swapped letters)
3. Word splitting (searches individual words in multi-word queries)
4. Wildcard matching (implicitly handles character replacement)

**Response Example:**
```json
{
  "query": "narto",
  "genre": null,
  "type": "all",
  "sort": "relevance",
  "fuzzy_search": true,
  "alternative_terms_used": ["nrto", "nato", "narto"],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_pages": 1,
    "total_results": 21,
    "total_anime": 1,
    "total_episodes": 20,
    "has_next_page": false,
    "has_prev_page": false
  },
  "results_this_page": 21,
  "results": {
    "anime": [
      {
        "id": 1,
        "title": "Naruto",
        "thumbnail_url": "https://example.com/naruto.jpg",
        "genre": "Action, Adventure",
        "description": "Ninja adventure",
        "created_at": "2023-05-15T12:00:00Z",
        "updated_at": "2023-05-15T12:00:00Z"
      }
    ],
    "episodes": [
      {
        "id": 1,
        "anime_id": 1,
        "anime_title": "Naruto",
        "anime_genre": "Action, Adventure",
        "title": "Enter: Naruto Uzumaki!",
        "episode_number": 1,
        "thumbnail_url": "https://example.com/naruto-ep1.jpg",
        "video_url_480p": "https://example.com/naruto-ep1-480p.mp4",
        "video_url_720p": "https://example.com/naruto-ep1-720p.mp4",
        "video_url_1080p": "https://example.com/naruto-ep1-1080p.mp4",
        "video_url_max_quality": "https://example.com/naruto-ep1-1080p.mp4",
        "created_at": "2023-05-15T12:00:00Z",
        "updated_at": "2023-05-15T12:00:00Z"
      }
      // More episodes...
    ]
  }
}
```

### Bulk Operations Endpoint

#### POST /api/bulk/:resource
Performs bulk operations on the specified resource ('anime' or 'episodes').

**Path Parameters:**
- `resource` (string): Either 'anime' or 'episodes'

**Request Body:**
- `operation` (string): The bulk operation to perform (currently supports 'create')
- `items` (array): Array of items to create

**Request Example (Bulk Create Anime):**
```json
{
  "operation": "create",
  "items": [
    {
      "title": "Demon Slayer",
      "thumbnail_url": "https://example.com/demonslayer.jpg",
      "genre": "Action, Supernatural",
      "description": "Demon hunting in Taisho-era Japan"
    },
    {
      "title": "My Hero Academia",
      "thumbnail_url": "https://example.com/mha.jpg",
      "genre": "Action, Superhero",
      "description": "Superhero school adventures"
    }
  ]
}
```

**Response Example:**
```json
{
  "operation": "bulk_create",
  "resource": "anime",
  "results": [
    {
      "id": 4,
      "success": true
    },
    {
      "id": 5,
      "success": true
    }
  ],
  "errors": [],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

## Code Architecture and Components

### 1. Entry Point

The module exports a `fetch` handler - the standard entry point for Cloudflare Workers:

```javascript
export default {
  async fetch(request, env, ctx) {
    return await handleRequest(request, env, ctx);
  }
};
```

### 2. Main Request Handler

The `handleRequest` function processes the incoming HTTP request:
- Parses the URL and HTTP method
- Sets up CORS headers
- Implements rate limiting for write operations
- Routes requests to appropriate resource handlers based on path
- Provides API documentation for documentation endpoints
- Returns 404 for non-matching paths

### 3. Resource Handlers

#### Anime Handler (`handleAnimeRequest`)

This function handles all operations on the anime resource:
- GET: Retrieves all anime or a specific anime by ID
- POST: Creates a new anime with validation
- PUT: Updates an existing anime
- DELETE: Deletes an anime and its related episodes (cascade delete)

#### Episodes Handler (`handleEpisodesRequest`)

This function handles all operations on the episodes resource:
- GET: Retrieves all episodes (with optional anime_id filtering) or a specific episode
- POST: Creates a new episode with validation and anime existence check
- PUT: Updates an existing episode
- DELETE: Deletes a specific episode

#### Bulk Operations Handler (`handleBulkOperations`)

This function processes bulk operations on resources:
- Currently supports bulk creation of anime and episodes
- Validates each item individually
- Reports successful and failed operations with detailed error information

#### Search Handler (`handleSearchRequest`)

This complex handler implements the advanced search functionality:
- Supports caching of search results
- Processes search parameters (query, type, genre, sort, pagination)
- Implements fuzzy search for typo tolerance
- Searches across both anime and episodes tables as needed
- Provides detailed pagination information
- Formats and returns structured search results

### 4. Helper Functions

#### JSON Response (`jsonResponse`)

Creates standardized JSON responses with:
- Proper Content-Type
- Status code
- Extra headers including CORS headers
- ETag generation for cache validation

#### ETag Generation (`generateETag`)

Generates hash-based ETags from response data for cache validation.

## Environment Variables and Bindings

The Worker expects these bindings in the Cloudflare Dashboard:

1. **DB**: A D1 Database binding for the SQLite database
2. **ANIME_KV**: A KV Namespace binding for rate limiting
3. **ANIME_CACHE**: A KV Namespace binding for caching search results

## Performance Optimizations

1. **Caching Strategy**: 
   - Different TTLs for different operations
   - ETag-based cache validation
   - Cache keys based on request parameters

2. **Database Optimizations**:
   - Appropriate indexes on frequently queried columns
   - JOIN operations to reduce multiple queries
   - Pagination to limit result sizes

3. **Rate Limiting**:
   - Prevents abuse of write operations
   - Uses client IP for identification
   - Sliding window approach (1-minute windows)

4. **Search Optimizations**:
   - Fuzzy search for better user experience
   - Dynamic query building for efficient filtering
   - Relevance-based sorting options

## Security Considerations

1. **Authentication**:
   - API Key required for all write operations
   - Key validation prior to processing write requests

2. **Rate Limiting**:
   - Prevents brute force and DDoS attacks
   - Returns appropriate 429 status codes

3. **Input Validation**:
   - Required fields checking
   - Foreign key validation
   - Safe SQL parameter binding to prevent injection

4. **CORS Headers**:
   - Proper configuration for cross-origin requests
   - Handling of preflight requests

## Conclusion

This Anime Database API provides a comprehensive solution for managing anime and episode data with features like:

- Complete CRUD operations
- Advanced search with fuzzy matching
- Performance optimizations through caching and indexes
- Security through authentication and rate limiting
- Bulk operations support
- Comprehensive error handling

The combination of Cloudflare Workers with D1 SQLite database creates a globally distributed, low-latency API that can scale to handle significant traffic while maintaining responsive performance.
