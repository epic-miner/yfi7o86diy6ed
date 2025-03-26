
// Anime Database API for Cloudflare Workers (Module format)
// This API allows CRUD operations on anime and episodes tables
// API Key required for POST, PUT, DELETE operations: 7291826614

// Cache configuration
const CACHE_TTL = {
    SEARCH: 60 * 5, // 5 minutes for search results
    GET_SINGLE: 60 * 10, // 10 minutes for single item retrieval
    GET_LIST: 60 * 3 // 3 minutes for list retrieval
  }
  
  export default {
    async fetch(request, env, ctx) {
      return await handleRequest(request, env, ctx);
    }
  };
  
  async function handleRequest(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method
  
    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Cache-Control': 'public, max-age=60', // Default cache for 1 minute
      'Vary': 'Origin, X-API-Key' // Vary cache based on origin and API key
    }
  
    // Rate limiting using Cloudflare Workers
    const clientIP = request.headers.get('CF-Connecting-IP')
    const rateLimitKey = `ratelimit:${clientIP}`
    
    // For non-GET methods, apply stricter rate limiting
    if (method !== 'GET' && method !== 'OPTIONS') {
      const rateLimitData = await env.ANIME_KV.get(rateLimitKey, { type: 'json' })
      const now = Date.now()
      
      if (rateLimitData && now - rateLimitData.timestamp < 60000) { // 1 minute window
        if (rateLimitData.count >= 20) { // 20 writes per minute
          return jsonResponse({
            error: 'Rate limit exceeded. Try again later.',
            retry_after: Math.ceil((rateLimitData.timestamp + 60000 - now) / 1000)
          }, 429, {
            ...corsHeaders,
            'Retry-After': Math.ceil((rateLimitData.timestamp + 60000 - now) / 1000)
          })
        }
        
        // Increment count
        await env.ANIME_KV.put(rateLimitKey, JSON.stringify({
          count: rateLimitData.count + 1,
          timestamp: rateLimitData.timestamp
        }))
      } else {
        // New rate limit window
        await env.ANIME_KV.put(rateLimitKey, JSON.stringify({
          count: 1,
          timestamp: now
        }))
      }
    }
  
    // Handle preflight requests
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      })
    }
  
    // Check if the request is for the API
    if (path.startsWith('/api/')) {
      // Parse the API path: /api/resource/id
      const parts = path.split('/').filter(part => part)
      const resource = parts[1] // 'anime' or 'episodes' or 'search'
      const id = parts[2] // optional ID
  
      // For non-GET requests, validate API key
      if (method !== 'GET') {
        const apiKey = request.headers.get('X-API-Key')
        if (apiKey !== '7291826614') {
          return jsonResponse({ error: 'Unauthorized. API key required.' }, 401, corsHeaders)
        }
      }
  
      try {
        // Route the request to the appropriate handler
        if (resource === 'anime') {
          return await handleAnimeRequest(request, method, id, corsHeaders, env)
        } else if (resource === 'episodes') {
          return await handleEpisodesRequest(request, method, id, corsHeaders, env)
        } else if (resource === 'bulk'){
          return await handleBulkOperations(request, corsHeaders, env)
        } else if (resource === 'search') {
          return await handleSearchRequest(request, corsHeaders, env)
        } else {
          return jsonResponse({ error: 'Invalid resource' }, 404, corsHeaders)
        }
      } catch (error) {
        return jsonResponse({ error: error.message }, 500, corsHeaders)
      }
    }
  
    // Check if request is for API documentation
    if (path === '/api' || path === '/api/docs') {
      return jsonResponse({
        name: "Anime API",
        version: "1.0.0",
        description: "API for anime and episodes management",
        base_url: url.origin + "/api",
        endpoints: [
          {
            path: "/api/anime",
            methods: ["GET", "POST"],
            description: "Get all anime or create a new anime",
            auth_required: ["POST"]
          },
          {
            path: "/api/anime/:id",
            methods: ["GET", "PUT", "DELETE"],
            description: "Get, update or delete a specific anime",
            auth_required: ["PUT", "DELETE"]
          },
          {
            path: "/api/episodes",
            methods: ["GET", "POST"],
            description: "Get all episodes or create a new episode",
            parameters: [
              {
                name: "anime_id",
                type: "query",
                description: "Filter episodes by anime ID"
              }
            ],
            auth_required: ["POST"]
          },
          {
            path: "/api/episodes/:id",
            methods: ["GET", "PUT", "DELETE"],
            description: "Get, update or delete a specific episode",
            auth_required: ["PUT", "DELETE"]
          },
          {
            path: "/api/search",
            methods: ["GET"],
            description: "Search for anime and episodes",
            parameters: [
              {
                name: "q",
                type: "query",
                description: "Search query"
              },
              {
                name: "type",
                type: "query",
                description: "Result type: 'all', 'anime', or 'episodes'"
              },
              {
                name: "genre",
                type: "query",
                description: "Filter by genre"
              },
              {
                name: "sort",
                type: "query",
                description: "Sort results: 'relevance', 'newest', 'oldest', 'title_asc', 'title_desc'"
              },
              {
                name: "page",
                type: "query",
                description: "Page number for pagination"
              },
              {
                name: "limit",
                type: "query",
                description: "Results per page (max 100)"
              },
              {
                name: "fuzzy",
                type: "query",
                description: "Enable/disable fuzzy search ('true' or 'false')"
              }
            ],
            auth_required: []
          },
          {
            path: "/api/bulk/:resource",
            methods: ["POST"],
            description: "Perform bulk operations on anime or episodes",
            auth_required: ["POST"]
          }
        ],
        authentication: {
          type: "API Key",
          header: "X-API-Key",
          key: "Required for all POST, PUT, DELETE operations"
        }
      }, 200, {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=86400' // Cache docs for 24 hours
      })
    }
  
    // If not an API request, return 404
    return jsonResponse({ error: 'Not found' }, 404, corsHeaders)
  }
  
  async function handleAnimeRequest(request, method, id, corsHeaders, env) {
    switch (method) {
      case 'GET':
        if (id) {
          // Get a specific anime by ID
          const anime = await env.DB.prepare(`
            SELECT * FROM anime WHERE id = ?
          `).bind(id).first()
  
          if (!anime) {
            return jsonResponse({ error: 'Anime not found' }, 404, corsHeaders)
          }
  
          return jsonResponse(anime, 200, corsHeaders)
        } else {
          // Get all anime
          const animeList = await env.DB.prepare(`
            SELECT * FROM anime ORDER BY title
          `).all()
  
          return jsonResponse(animeList.results, 200, corsHeaders)
        }
  
      case 'POST':
        // Create a new anime
        const newAnime = await request.json()
  
        // Validate required fields
        if (!newAnime.title || !newAnime.thumbnail_url || !newAnime.genre) {
          return jsonResponse({ error: 'Missing required fields' }, 400, corsHeaders)
        }
  
        const result = await env.DB.prepare(`
          INSERT INTO anime (title, thumbnail_url, genre, description)
          VALUES (?, ?, ?, ?)
        `).bind(
          newAnime.title,
          newAnime.thumbnail_url,
          newAnime.genre,
          newAnime.description || ''
        ).run()
  
        return jsonResponse({ 
          message: 'Anime created successfully', 
          id: result.lastInsertId 
        }, 201, corsHeaders)
  
      case 'PUT':
        // Update an existing anime
        if (!id) {
          return jsonResponse({ error: 'Anime ID is required' }, 400, corsHeaders)
        }
  
        const updateData = await request.json()
  
        // Check if anime exists
        const existingAnime = await env.DB.prepare(`
          SELECT id FROM anime WHERE id = ?
        `).bind(id).first()
  
        if (!existingAnime) {
          return jsonResponse({ error: 'Anime not found' }, 404, corsHeaders)
        }
  
        // Build update query dynamically based on provided fields
        let updateQuery = 'UPDATE anime SET '
        const updateValues = []
        const updateFields = []
  
        if (updateData.title !== undefined) {
          updateFields.push('title = ?')
          updateValues.push(updateData.title)
        }
  
        if (updateData.thumbnail_url !== undefined) {
          updateFields.push('thumbnail_url = ?')
          updateValues.push(updateData.thumbnail_url)
        }
  
        if (updateData.genre !== undefined) {
          updateFields.push('genre = ?')
          updateValues.push(updateData.genre)
        }
  
        if (updateData.description !== undefined) {
          updateFields.push('description = ?')
          updateValues.push(updateData.description)
        }
  
        updateQuery += updateFields.join(', ')
        updateQuery += ', updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        updateValues.push(id)
  
        await env.DB.prepare(updateQuery).bind(...updateValues).run()
  
        return jsonResponse({ 
          message: 'Anime updated successfully', 
          id: id 
        }, 200, corsHeaders)
  
      case 'DELETE':
        // Delete an anime
        if (!id) {
          return jsonResponse({ error: 'Anime ID is required' }, 400, corsHeaders)
        }
  
        // Check if anime exists
        const animeToDelete = await env.DB.prepare(`
          SELECT id FROM anime WHERE id = ?
        `).bind(id).first()
  
        if (!animeToDelete) {
          return jsonResponse({ error: 'Anime not found' }, 404, corsHeaders)
        }
  
        // Delete anime (cascade will delete related episodes)
        await env.DB.prepare(`
          DELETE FROM anime WHERE id = ?
        `).bind(id).run()
  
        return jsonResponse({ 
          message: 'Anime and related episodes deleted successfully' 
        }, 200, corsHeaders)
  
      default:
        return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders)
    }
  }
  
  async function handleEpisodesRequest(request, method, id, corsHeaders, env) {
    switch (method) {
      case 'GET':
        if (id) {
          // Get a specific episode by ID
          const episode = await env.DB.prepare(`
            SELECT e.*, a.title as anime_title 
            FROM episodes e
            JOIN anime a ON e.anime_id = a.id
            WHERE e.id = ?
          `).bind(id).first()
  
          if (!episode) {
            return jsonResponse({ error: 'Episode not found' }, 404, corsHeaders)
          }
  
          return jsonResponse(episode, 200, corsHeaders)
        } else {
          // Get all episodes or filter by anime_id
          const url = new URL(request.url)
          const animeId = url.searchParams.get('anime_id')
  
          let query = `
            SELECT e.*, a.title as anime_title 
            FROM episodes e
            JOIN anime a ON e.anime_id = a.id
          `
          let params = []
  
          if (animeId) {
            query += ` WHERE e.anime_id = ? `
            params.push(animeId)
          }
  
          query += ` ORDER BY e.anime_id, e.episode_number `
  
          const episodes = await env.DB.prepare(query).bind(...params).all()
  
          return jsonResponse(episodes.results, 200, corsHeaders)
        }
  
      case 'POST':
        // Create a new episode
        const newEpisode = await request.json()
  
        // Validate required fields
        if (!newEpisode.anime_id || !newEpisode.title || !newEpisode.episode_number || 
            !newEpisode.thumbnail_url || !newEpisode.video_url_max_quality) {
          return jsonResponse({ error: 'Missing required fields' }, 400, corsHeaders)
        }
  
        // Check if anime exists
        const anime = await env.DB.prepare(`
          SELECT id FROM anime WHERE id = ?
        `).bind(newEpisode.anime_id).first()
  
        if (!anime) {
          return jsonResponse({ error: 'Associated anime not found' }, 404, corsHeaders)
        }
  
        const result = await env.DB.prepare(`
          INSERT INTO episodes 
          (anime_id, title, episode_number, thumbnail_url, 
           video_url_480p, video_url_720p, video_url_1080p, video_url_max_quality)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          newEpisode.anime_id,
          newEpisode.title,
          newEpisode.episode_number,
          newEpisode.thumbnail_url,
          newEpisode.video_url_480p || null,
          newEpisode.video_url_720p || null,
          newEpisode.video_url_1080p || null,
          newEpisode.video_url_max_quality
        ).run()
  
        return jsonResponse({ 
          message: 'Episode created successfully', 
          id: result.lastInsertId 
        }, 201, corsHeaders)
  
      case 'PUT':
        // Update an existing episode
        if (!id) {
          return jsonResponse({ error: 'Episode ID is required' }, 400, corsHeaders)
        }
  
        const updateData = await request.json()
  
        // Check if episode exists
        const existingEpisode = await env.DB.prepare(`
          SELECT id FROM episodes WHERE id = ?
        `).bind(id).first()
  
        if (!existingEpisode) {
          return jsonResponse({ error: 'Episode not found' }, 404, corsHeaders)
        }
  
        // Build update query dynamically based on provided fields
        let updateQuery = 'UPDATE episodes SET '
        const updateValues = []
        const updateFields = []
  
        if (updateData.anime_id !== undefined) {
          // Check if the new anime exists
          const animeExists = await env.DB.prepare(`
            SELECT id FROM anime WHERE id = ?
          `).bind(updateData.anime_id).first()
  
          if (!animeExists) {
            return jsonResponse({ error: 'Associated anime not found' }, 404, corsHeaders)
          }
  
          updateFields.push('anime_id = ?')
          updateValues.push(updateData.anime_id)
        }
  
        if (updateData.title !== undefined) {
          updateFields.push('title = ?')
          updateValues.push(updateData.title)
        }
  
        if (updateData.episode_number !== undefined) {
          updateFields.push('episode_number = ?')
          updateValues.push(updateData.episode_number)
        }
  
        if (updateData.thumbnail_url !== undefined) {
          updateFields.push('thumbnail_url = ?')
          updateValues.push(updateData.thumbnail_url)
        }
  
        if (updateData.video_url_480p !== undefined) {
          updateFields.push('video_url_480p = ?')
          updateValues.push(updateData.video_url_480p)
        }
  
        if (updateData.video_url_720p !== undefined) {
          updateFields.push('video_url_720p = ?')
          updateValues.push(updateData.video_url_720p)
        }
  
        if (updateData.video_url_1080p !== undefined) {
          updateFields.push('video_url_1080p = ?')
          updateValues.push(updateData.video_url_1080p)
        }
  
        if (updateData.video_url_max_quality !== undefined) {
          updateFields.push('video_url_max_quality = ?')
          updateValues.push(updateData.video_url_max_quality)
        }
  
        updateQuery += updateFields.join(', ')
        updateQuery += ', updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        updateValues.push(id)
  
        await env.DB.prepare(updateQuery).bind(...updateValues).run()
  
        return jsonResponse({ 
          message: 'Episode updated successfully', 
          id: id 
        }, 200, corsHeaders)
  
      case 'DELETE':
        // Delete an episode
        if (!id) {
          return jsonResponse({ error: 'Episode ID is required' }, 400, corsHeaders)
        }
  
        // Check if episode exists
        const episodeToDelete = await env.DB.prepare(`
          SELECT id FROM episodes WHERE id = ?
        `).bind(id).first()
  
        if (!episodeToDelete) {
          return jsonResponse({ error: 'Episode not found' }, 404, corsHeaders)
        }
  
        // Delete episode
        await env.DB.prepare(`
          DELETE FROM episodes WHERE id = ?
        `).bind(id).run()
  
        return jsonResponse({ 
          message: 'Episode deleted successfully' 
        }, 200, corsHeaders)
  
      default:
        return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders)
    }
  }
  
  // Helper function to create JSON responses
  function jsonResponse(data, status = 200, extraHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders
    }
  
    // Add ETag for cache validation (if data object has an ID)
    if (data && (data.id || (data.results && Array.isArray(data.results)))) {
      const etag = `W/"${generateETag(data)}"`
      headers['ETag'] = etag
    }
  
    return new Response(JSON.stringify(data), {
      status,
      headers
    })
  }
  
  // Generate simple ETag from data
  function generateETag(data) {
    let str = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0 // Convert to 32bit integer
    }
    return hash.toString(16) // Convert to hex
  }
  
  async function handleBulkOperations(request, corsHeaders, env) {
    const url = new URL(request.url)
    const resource = url.pathname.split('/')[2] // 'anime' or 'episodes'
  
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Only POST method is supported for bulk operations' }, 405, corsHeaders)
    }
  
    try {
      const { operation, items } = await request.json()
  
      if (!operation || !items || !Array.isArray(items)) {
        return jsonResponse({ error: 'Invalid request format' }, 400, corsHeaders)
      }
  
      if (operation === 'create') {
        // Process bulk create
        if (resource === 'anime') {
          const results = []
          const errors = []
  
          for (const item of items) {
            try {
              if (!item.title || !item.thumbnail_url || !item.genre) {
                errors.push({ item, error: 'Missing required fields' })
                continue
              }
  
              const result = await env.DB.prepare(`
                INSERT INTO anime (title, thumbnail_url, genre, description)
                VALUES (?, ?, ?, ?)
              `).bind(
                item.title,
                item.thumbnail_url,
                item.genre,
                item.description || ''
              ).run()
  
              results.push({ id: result.lastInsertId, success: true })
            } catch (error) {
              errors.push({ item, error: error.message })
            }
          }
  
          return jsonResponse({
            operation: 'bulk_create',
            resource: 'anime',
            results,
            errors,
            summary: {
              total: items.length,
              successful: results.length,
              failed: errors.length
            }
          }, 200, corsHeaders)
        } else if (resource === 'episodes') {
          const results = []
          const errors = []
  
          for (const item of items) {
            try {
              if (!item.anime_id || !item.title || !item.episode_number ||
                  !item.thumbnail_url || !item.video_url_max_quality) {
                errors.push({ item, error: 'Missing required fields' })
                continue
              }
  
              // Check if anime exists
              const anime = await env.DB.prepare(`
                SELECT id FROM anime WHERE id = ?
              `).bind(item.anime_id).first()
  
              if (!anime) {
                errors.push({ item, error: 'Associated anime not found' })
                continue
              }
  
              const result = await env.DB.prepare(`
                INSERT INTO episodes
                (anime_id, title, episode_number, thumbnail_url,
                video_url_480p, video_url_720p, video_url_1080p, video_url_max_quality)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                item.anime_id,
                item.title,
                item.episode_number,
                item.thumbnail_url,
                item.video_url_480p || null,
                item.video_url_720p || null,
                item.video_url_1080p || null,
                item.video_url_max_quality
              ).run()
  
              results.push({ id: result.lastInsertId, success: true })
            } catch (error) {
              errors.push({ item, error: error.message })
            }
          }
  
          return jsonResponse({
            operation: 'bulk_create',
            resource: 'episodes',
            results,
            errors,
            summary: {
              total: items.length,
              successful: results.length,
              failed: errors.length
            }
          }, 200, corsHeaders)
        }
      }
  
      return jsonResponse({ error: 'Unsupported bulk operation' }, 400, corsHeaders)
    } catch (error) {
      return jsonResponse({ error: error.message }, 500, corsHeaders)
    }
  }
  
  async function handleSearchRequest(request, corsHeaders, env) {
    const url = new URL(request.url)
    
    // Generate cache key based on all search parameters
    const cacheKey = `search:${url.search}`
    
    // Try to get from cache first
    try {
      const cachedResponse = await env.ANIME_CACHE.get(cacheKey, { type: 'json' })
      if (cachedResponse) {
        return jsonResponse(cachedResponse, 200, {
          ...corsHeaders,
          'X-Cache': 'HIT',
          'Cache-Control': `public, max-age=${CACHE_TTL.SEARCH}`
        })
      }
    } catch (error) {
      // Continue if cache fails
      console.error('Cache error:', error)
    }
    
    // Get search parameters
    const query = url.searchParams.get('q')
    const type = url.searchParams.get('type') || 'all' // all, anime, episodes
    const genre = url.searchParams.get('genre')
    const sort = url.searchParams.get('sort') || 'relevance' // relevance, newest, oldest, title_asc, title_desc
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const fuzzySearch = url.searchParams.get('fuzzy') !== 'false' // Enable fuzzy search by default
    
    // Validate pagination
    if (page < 1) {
      return jsonResponse({ error: 'Page must be a positive integer' }, 400, corsHeaders)
    }
    
    if (limit < 1 || limit > 100) {
      return jsonResponse({ error: 'Limit must be between 1 and 100' }, 400, corsHeaders)
    }
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit
    
    if (!query && !genre) {
      return jsonResponse({ error: 'At least one search parameter (q or genre) is required' }, 400, corsHeaders)
    }
    
    // Process query for typo tolerance
    let searchTerm = null
    let alternativeTerms = []
    
    if (query) {
      // Base search with wildcard for partial matches
      searchTerm = `%${query}%`
      
      if (fuzzySearch && query.length > 2) {
        // Generate alternative search terms for typo tolerance
        // 1. Character deletion (missing letter)
        for (let i = 0; i < query.length; i++) {
          const term = query.slice(0, i) + query.slice(i + 1)
          alternativeTerms.push(`%${term}%`)
        }
        
        // 2. Character swapping (swapped letters)
        for (let i = 0; i < query.length - 1; i++) {
          const term = query.slice(0, i) + 
                      query.charAt(i + 1) + 
                      query.charAt(i) + 
                      query.slice(i + 2)
          alternativeTerms.push(`%${term}%`)
        }
        
        // 3. Character replacement (wrong letter)
        // This is handled implicitly by SQL LIKE with wildcards
        
        // 4. Split words for multi-word queries
        if (query.includes(' ')) {
          const words = query.split(' ').filter(word => word.length > 2)
          words.forEach(word => {
            alternativeTerms.push(`%${word}%`)
          })
        }
        
        // Deduplicate alternative terms
        alternativeTerms = [...new Set(alternativeTerms)]
      }
    }
    let results = {}
    let totalCounts = { anime: 0, episodes: 0 }
    
    try {
      // Search in anime table if type is 'all' or 'anime'
      if (type === 'all' || type === 'anime') {
        // Build WHERE clause dynamically
        let whereClause = []
        let whereParams = []
        
        if (searchTerm) {
          // Start with exact match
          let searchConditions = ['(title LIKE ? OR description LIKE ?)']
          whereParams.push(searchTerm, searchTerm)
          
          // Add alternative terms for typo tolerance
          if (alternativeTerms.length > 0) {
            const altConditions = alternativeTerms.map(() => '(title LIKE ? OR description LIKE ?)')
            alternativeTerms.forEach(term => {
              whereParams.push(term, term)
            })
            searchConditions = searchConditions.concat(altConditions)
          }
          
          whereClause.push('(' + searchConditions.join(' OR ') + ')')
        }
        
        if (genre) {
          whereClause.push('genre LIKE ?')
          whereParams.push(`%${genre}%`)
        }
        
        const whereString = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : ''
        
        // First get total count for pagination info
        const countQuery = `
          SELECT COUNT(*) as count
          FROM anime
          ${whereString}
        `
        const countResult = await env.DB.prepare(countQuery).bind(...whereParams).first()
        totalCounts.anime = countResult ? countResult.count : 0
        
        // Determine sort order
        let orderClause = ""
        switch (sort) {
          case 'newest':
            orderClause = 'ORDER BY created_at DESC'
            break
          case 'oldest':
            orderClause = 'ORDER BY created_at ASC'
            break
          case 'title_asc':
            orderClause = 'ORDER BY title ASC'
            break
          case 'title_desc':
            orderClause = 'ORDER BY title DESC'
            break
          default: // relevance
            // For relevance sorting, prioritize title matches over description matches if search term exists
            if (searchTerm) {
              orderClause = "ORDER BY CASE WHEN title LIKE ? THEN 1 WHEN description LIKE ? THEN 2 ELSE 3 END"
              whereParams.push(searchTerm, searchTerm)
            } else {
              orderClause = 'ORDER BY title ASC'
            }
        }
        
        const animeQuery = `
          SELECT *
          FROM anime
          ${whereString}
          ${orderClause}
          LIMIT ? OFFSET ?
        `
        // Add pagination parameters
        whereParams.push(limit, offset)
        
        const animeResults = await env.DB.prepare(animeQuery).bind(...whereParams).all()
        results.anime = animeResults.results || []
      }
      
      // Search in episodes table if type is 'all' or 'episodes'
      if (type === 'all' || type === 'episodes') {
        // Build WHERE clause dynamically
        let whereClause = []
        let whereParams = []
        
        if (searchTerm) {
          // Start with exact match
          let searchConditions = ['(e.title LIKE ? OR a.title LIKE ?)']
          whereParams.push(searchTerm, searchTerm)
          
          // Add alternative terms for typo tolerance
          if (alternativeTerms.length > 0) {
            const altConditions = alternativeTerms.map(() => '(e.title LIKE ? OR a.title LIKE ?)')
            alternativeTerms.forEach(term => {
              whereParams.push(term, term)
            })
            searchConditions = searchConditions.concat(altConditions)
          }
          
          whereClause.push('(' + searchConditions.join(' OR ') + ')')
        }
        
        if (genre) {
          whereClause.push('a.genre LIKE ?')
          whereParams.push(`%${genre}%`)
        }
        
        const whereString = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : ''
        
        // First get total count for pagination info
        const countQuery = `
          SELECT COUNT(*) as count
          FROM episodes e
          JOIN anime a ON e.anime_id = a.id
          ${whereString}
        `
        const countResult = await env.DB.prepare(countQuery).bind(...whereParams).first()
        totalCounts.episodes = countResult ? countResult.count : 0
        
        // Determine sort order
        let orderClause = ""
        switch (sort) {
          case 'newest':
            orderClause = 'ORDER BY e.created_at DESC'
            break
          case 'oldest':
            orderClause = 'ORDER BY e.created_at ASC'
            break
          case 'title_asc':
            orderClause = 'ORDER BY a.title ASC, e.episode_number ASC'
            break
          case 'title_desc':
            orderClause = 'ORDER BY a.title DESC, e.episode_number ASC'
            break
          default: // relevance
            // For relevance sorting, prioritize episode title matches over anime title matches if search term exists
            if (searchTerm) {
              orderClause = "ORDER BY CASE WHEN e.title LIKE ? THEN 1 WHEN a.title LIKE ? THEN 2 ELSE 3 END, e.episode_number ASC"
              whereParams.push(searchTerm, searchTerm)
            } else {
              orderClause = 'ORDER BY a.title ASC, e.episode_number ASC'
            }
        }
        
        const episodesQuery = `
          SELECT e.*, a.title as anime_title, a.genre as anime_genre
          FROM episodes e
          JOIN anime a ON e.anime_id = a.id
          ${whereString}
          ${orderClause}
          LIMIT ? OFFSET ?
        `
        // Add pagination parameters
        whereParams.push(limit, offset)
        
        const episodesResults = await env.DB.prepare(episodesQuery).bind(...whereParams).all()
        results.episodes = episodesResults.results || []
      }
      
      // Calculate total results for this page
      const totalResultsThisPage = (results.anime ? results.anime.length : 0) + 
                                 (results.episodes ? results.episodes.length : 0)
      
      // Calculate total results overall
      const totalResultsOverall = totalCounts.anime + totalCounts.episodes
      
      // Calculate pagination info
      const totalPages = Math.ceil(totalResultsOverall / limit)
      
      const responseData = {
        query,
        genre,
        type,
        sort,
        fuzzy_search: fuzzySearch,
        alternative_terms_used: alternativeTerms.length > 0 ? alternativeTerms.map(term => term.replace(/%/g, '')) : null,
        pagination: {
          page,
          limit,
          total_pages: totalPages,
          total_results: totalResultsOverall,
          total_anime: totalCounts.anime,
          total_episodes: totalCounts.episodes,
          has_next_page: page < totalPages,
          has_prev_page: page > 1
        },
        results_this_page: totalResultsThisPage,
        results
      }
      
      // Store in cache for future requests
      try {
        await env.ANIME_CACHE.put(cacheKey, JSON.stringify(responseData), {
          expirationTtl: CACHE_TTL.SEARCH
        })
      } catch (error) {
        console.error('Cache storage error:', error)
      }
      
      return jsonResponse(responseData, 200, {
        ...corsHeaders,
        'X-Cache': 'MISS',
        'Cache-Control': `public, max-age=${CACHE_TTL.SEARCH}`
      })
    } catch (error) {
      return jsonResponse({ error: error.message }, 500, corsHeaders)
    }
  }
  