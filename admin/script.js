
// API Configuration
const API_BASE_URL = location.protocol + '//' + location.host + '/api';
let API_KEY = localStorage.getItem('animeApiKey') || '';
let isAuthenticated = false;

// DOM Elements
const authButton = document.getElementById('authButton');
const apiKeyInput = document.getElementById('apiKey');
const authStatusSpan = document.getElementById('authStatus');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Authentication
function checkAuthentication() {
    if (API_KEY) {
        apiKeyInput.value = API_KEY;
        authStatusSpan.textContent = 'Checking...';
        authStatusSpan.style.color = 'orange';
        
        // Make a test request
        fetch(`${API_BASE_URL}/anime`, {
            headers: {
                'X-API-Key': API_KEY
            }
        })
        .then(response => {
            if (response.ok) {
                authStatusSpan.textContent = 'Authenticated';
                authStatusSpan.style.color = 'green';
                isAuthenticated = true;
                loadData();
            } else {
                authStatusSpan.textContent = 'Invalid API Key';
                authStatusSpan.style.color = 'red';
                isAuthenticated = false;
                localStorage.removeItem('animeApiKey');
            }
        })
        .catch(error => {
            authStatusSpan.textContent = 'Connection Error';
            authStatusSpan.style.color = 'red';
            console.error('API connection error:', error);
            isAuthenticated = false;
        });
    } else {
        authStatusSpan.textContent = 'Not Authenticated';
        authStatusSpan.style.color = 'red';
        isAuthenticated = false;
    }
}

authButton.addEventListener('click', () => {
    API_KEY = apiKeyInput.value.trim();
    if (API_KEY) {
        localStorage.setItem('animeApiKey', API_KEY);
        checkAuthentication();
    } else {
        authStatusSpan.textContent = 'API Key Required';
        authStatusSpan.style.color = 'red';
    }
});

// Tab Navigation
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all tabs
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to selected tab
        button.classList.add('active');
        const tabId = button.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        
        // Load data for the tab
        if (isAuthenticated) {
            if (tabId === 'anime') {
                loadAnimeList();
            } else if (tabId === 'episodes') {
                loadEpisodesList();
                loadAnimeForFilter();
            }
        }
    });
});

// Data Loading Functions
async function loadData() {
    if (!isAuthenticated) return;
    
    // Load initial data for the active tab
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab.id === 'anime') {
        loadAnimeList();
    } else if (activeTab.id === 'episodes') {
        loadEpisodesList();
        loadAnimeForFilter();
    }
    
    // Load anime list for dropdowns
    loadAnimeDropdowns();
}

async function fetchWithAuth(url, options = {}) {
    const defaultOptions = {
        headers: {
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
        }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    if (options.headers) {
        mergedOptions.headers = { ...defaultOptions.headers, ...options.headers };
    }
    
    try {
        const response = await fetch(url, mergedOptions);
        if (response.status === 401) {
            authStatusSpan.textContent = 'Authentication Failed';
            authStatusSpan.style.color = 'red';
            isAuthenticated = false;
            throw new Error('Authentication failed');
        }
        
        // Check response status
        if (response.status === 405) {
            throw new Error('Method not allowed. This operation might be restricted.');
        }
        
        // Check content type to avoid JSON parsing errors
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response;
        } else if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        } else {
            console.warn('Response is not JSON:', contentType);
            return response;
        }
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

// Anime Management
async function loadAnimeList() {
    const tableBody = document.getElementById('animeTableBody');
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;"><div class="loading-spinner"></div><p>Loading anime data...</p></td></tr>';
    
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/anime`);
        const animeList = await response.json();
        
        if (animeList.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">No anime found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = '';
        animeList.forEach(anime => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${anime.id}</td>
                <td><img src="${anime.thumbnail_url}" alt="${anime.title}" class="thumbnail-preview"></td>
                <td>${anime.title}</td>
                <td>${anime.genre}</td>
                <td>${new Date(anime.created_at).toLocaleString()}</td>
                <td>${new Date(anime.updated_at).toLocaleString()}</td>
                <td class="action-buttons">
                    <button class="edit-btn" data-id="${anime.id}">Edit</button>
                    <button class="delete-btn" data-id="${anime.id}" data-title="${anime.title}">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // Populate genre filter
        const genreFilter = document.getElementById('animeGenreFilter');
        const genres = new Set();
        animeList.forEach(anime => {
            anime.genre.split(',').forEach(g => {
                genres.add(g.trim());
            });
        });
        
        // Keep the first option and add genres
        const firstOption = genreFilter.options[0];
        genreFilter.innerHTML = '';
        genreFilter.appendChild(firstOption);
        
        Array.from(genres).sort().forEach(genre => {
            const option = document.createElement('option');
            option.value = genre;
            option.textContent = genre;
            genreFilter.appendChild(option);
        });
        
        attachAnimeEventListeners();
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="7">Error loading anime: ${error.message}</td></tr>`;
    }
}

function attachAnimeEventListeners() {
    // Edit buttons
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', () => {
            const id = button.getAttribute('data-id');
            editAnime(id);
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', () => {
            const id = button.getAttribute('data-id');
            const title = button.getAttribute('data-title');
            confirmDelete('anime', id, title);
        });
    });
}

// Add Anime Modal
document.getElementById('addAnimeBtn').addEventListener('click', () => {
    openAnimeModal();
});

function openAnimeModal(animeData = null) {
    const modal = document.getElementById('animeModal');
    const modalTitle = document.getElementById('animeModalTitle');
    const form = document.getElementById('animeForm');
    const idInput = document.getElementById('animeId');
    const titleInput = document.getElementById('animeTitle');
    const thumbnailInput = document.getElementById('animeThumbnail');
    const genreInput = document.getElementById('animeGenre');
    const descriptionInput = document.getElementById('animeDescription');
    
    if (animeData) {
        modalTitle.textContent = 'Edit Anime';
        idInput.value = animeData.id;
        titleInput.value = animeData.title;
        thumbnailInput.value = animeData.thumbnail_url;
        genreInput.value = animeData.genre;
        descriptionInput.value = animeData.description || '';
    } else {
        modalTitle.textContent = 'Add New Anime';
        form.reset();
        idInput.value = '';
    }
    
    modal.style.display = 'block';
}

// Close modal on X click or cancel button
document.querySelectorAll('.close, .close-btn').forEach(element => {
    element.addEventListener('click', () => {
        document.getElementById('animeModal').style.display = 'none';
        document.getElementById('episodeModal').style.display = 'none';
        document.getElementById('confirmModal').style.display = 'none';
    });
});

// Close modal when clicking outside of it
window.addEventListener('click', (event) => {
    if (event.target === document.getElementById('animeModal')) {
        document.getElementById('animeModal').style.display = 'none';
    }
    if (event.target === document.getElementById('episodeModal')) {
        document.getElementById('episodeModal').style.display = 'none';
    }
    if (event.target === document.getElementById('confirmModal')) {
        document.getElementById('confirmModal').style.display = 'none';
    }
});

// Save Anime
document.getElementById('animeForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const id = document.getElementById('animeId').value;
    const title = document.getElementById('animeTitle').value;
    const thumbnail_url = document.getElementById('animeThumbnail').value;
    const genre = document.getElementById('animeGenre').value;
    const description = document.getElementById('animeDescription').value;
    
    const animeData = {
        title,
        thumbnail_url,
        genre,
        description
    };
    
    try {
        let response;
        if (id) {
            // Update existing anime
            response = await fetchWithAuth(`${API_BASE_URL}/anime/${id}`, {
                method: 'PUT',
                body: JSON.stringify(animeData)
            });
        } else {
            // Create new anime
            response = await fetchWithAuth(`${API_BASE_URL}/anime`, {
                method: 'POST',
                body: JSON.stringify(animeData)
            });
        }
        
        if (response.ok) {
            document.getElementById('animeModal').style.display = 'none';
            loadAnimeList();
            loadAnimeDropdowns();
        } else {
            const errorData = await response.json();
            alert(`Error: ${errorData.error || 'Failed to save anime'}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

async function editAnime(id) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/anime/${id}`);
        if (response.ok) {
            const animeData = await response.json();
            openAnimeModal(animeData);
        } else {
            alert('Failed to fetch anime details');
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

function confirmDelete(type, id, title) {
    const modal = document.getElementById('confirmModal');
    const message = document.getElementById('confirmMessage');
    const confirmYesBtn = document.getElementById('confirmYes');
    const confirmNoBtn = document.getElementById('confirmNo');
    
    message.textContent = `Are you sure you want to delete the ${type} "${title}"? This action cannot be undone.`;
    
    confirmYesBtn.onclick = async () => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/${type}/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                modal.style.display = 'none';
                if (type === 'anime') {
                    loadAnimeList();
                    loadAnimeDropdowns();
                } else if (type === 'episodes') {
                    loadEpisodesList();
                }
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.error || `Failed to delete ${type}`}`);
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };
    
    confirmNoBtn.onclick = () => {
        modal.style.display = 'none';
    };
    
    modal.style.display = 'block';
}

// Episodes Management
async function loadEpisodesList() {
    const tableBody = document.getElementById('episodeTableBody');
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;"><div class="loading-spinner"></div><p>Loading episodes data...</p></td></tr>';
    
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/episodes`);
        const episodesList = await response.json();
        
        if (episodesList.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8">No episodes found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = '';
        episodesList.forEach(episode => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${episode.id}</td>
                <td><img src="${episode.thumbnail_url}" alt="Ep ${episode.episode_number}" class="thumbnail-preview"></td>
                <td>${episode.anime_title}</td>
                <td>${episode.episode_number}</td>
                <td>${episode.title}</td>
                <td>${getVideoQualityInfo(episode)}</td>
                <td>${new Date(episode.created_at).toLocaleString()}</td>
                <td class="action-buttons">
                    <button class="edit-btn" data-id="${episode.id}">Edit</button>
                    <button class="delete-btn" data-id="${episode.id}" data-title="${episode.title}">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        attachEpisodeEventListeners();
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="8">Error loading episodes: ${error.message}</td></tr>`;
    }
}

function getVideoQualityInfo(episode) {
    const qualities = [];
    if (episode.video_url_480p) qualities.push('480p');
    if (episode.video_url_720p) qualities.push('720p');
    if (episode.video_url_1080p) qualities.push('1080p');
    if (episode.video_url_max_quality) qualities.push('Max');
    return qualities.join(', ');
}

function attachEpisodeEventListeners() {
    // Edit buttons
    document.querySelectorAll('#episodeTableBody .edit-btn').forEach(button => {
        button.addEventListener('click', () => {
            const id = button.getAttribute('data-id');
            editEpisode(id);
        });
    });
    
    // Delete buttons
    document.querySelectorAll('#episodeTableBody .delete-btn').forEach(button => {
        button.addEventListener('click', () => {
            const id = button.getAttribute('data-id');
            const title = button.getAttribute('data-title');
            confirmDelete('episodes', id, title);
        });
    });
}

// Add Episode Modal
document.getElementById('addEpisodeBtn').addEventListener('click', () => {
    openEpisodeModal();
});

async function loadAnimeDropdowns() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/anime`);
        const animeList = await response.json();
        
        const animeFilterDropdown = document.getElementById('animeFilter');
        const episodeAnimeDropdown = document.getElementById('episodeAnimeId');
        
        // Keep first option in the filter dropdown
        const firstFilterOption = animeFilterDropdown.options[0];
        animeFilterDropdown.innerHTML = '';
        animeFilterDropdown.appendChild(firstFilterOption);
        
        // Clear episode anime dropdown
        episodeAnimeDropdown.innerHTML = '';
        
        animeList.forEach(anime => {
            // Add to filter dropdown
            const filterOption = document.createElement('option');
            filterOption.value = anime.id;
            filterOption.textContent = anime.title;
            animeFilterDropdown.appendChild(filterOption);
            
            // Add to episode form dropdown
            const formOption = document.createElement('option');
            formOption.value = anime.id;
            formOption.textContent = anime.title;
            episodeAnimeDropdown.appendChild(formOption);
        });
    } catch (error) {
        console.error('Error loading anime dropdowns:', error);
    }
}

async function loadAnimeForFilter() {
    await loadAnimeDropdowns();
}

function openEpisodeModal(episodeData = null) {
    const modal = document.getElementById('episodeModal');
    const modalTitle = document.getElementById('episodeModalTitle');
    const form = document.getElementById('episodeForm');
    const idInput = document.getElementById('episodeId');
    const animeSelect = document.getElementById('episodeAnimeId');
    const titleInput = document.getElementById('episodeTitle');
    const numberInput = document.getElementById('episodeNumber');
    const thumbnailInput = document.getElementById('episodeThumbnail');
    const url480pInput = document.getElementById('episodeUrl480p');
    const url720pInput = document.getElementById('episodeUrl720p');
    const url1080pInput = document.getElementById('episodeUrl1080p');
    const urlMaxInput = document.getElementById('episodeUrlMax');
    
    if (episodeData) {
        modalTitle.textContent = 'Edit Episode';
        idInput.value = episodeData.id;
        
        // Set selected anime
        for (let i = 0; i < animeSelect.options.length; i++) {
            if (animeSelect.options[i].value == episodeData.anime_id) {
                animeSelect.selectedIndex = i;
                break;
            }
        }
        
        titleInput.value = episodeData.title;
        numberInput.value = episodeData.episode_number;
        thumbnailInput.value = episodeData.thumbnail_url;
        url480pInput.value = episodeData.video_url_480p || '';
        url720pInput.value = episodeData.video_url_720p || '';
        url1080pInput.value = episodeData.video_url_1080p || '';
        urlMaxInput.value = episodeData.video_url_max_quality;
    } else {
        modalTitle.textContent = 'Add New Episode';
        form.reset();
        idInput.value = '';
    }
    
    modal.style.display = 'block';
}

// Save Episode
document.getElementById('episodeForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const id = document.getElementById('episodeId').value;
    const anime_id = document.getElementById('episodeAnimeId').value;
    const title = document.getElementById('episodeTitle').value;
    const episode_number = document.getElementById('episodeNumber').value;
    const thumbnail_url = document.getElementById('episodeThumbnail').value;
    const video_url_480p = document.getElementById('episodeUrl480p').value;
    const video_url_720p = document.getElementById('episodeUrl720p').value;
    const video_url_1080p = document.getElementById('episodeUrl1080p').value;
    const video_url_max_quality = document.getElementById('episodeUrlMax').value;
    
    const episodeData = {
        anime_id,
        title,
        episode_number,
        thumbnail_url,
        video_url_480p,
        video_url_720p,
        video_url_1080p,
        video_url_max_quality
    };
    
    try {
        let response;
        if (id) {
            // Update existing episode
            response = await fetchWithAuth(`${API_BASE_URL}/episodes/${id}`, {
                method: 'PUT',
                body: JSON.stringify(episodeData)
            });
        } else {
            // Create new episode
            response = await fetchWithAuth(`${API_BASE_URL}/episodes`, {
                method: 'POST',
                body: JSON.stringify(episodeData)
            });
        }
        
        if (response.ok) {
            document.getElementById('episodeModal').style.display = 'none';
            loadEpisodesList();
        } else {
            const errorData = await response.json();
            alert(`Error: ${errorData.error || 'Failed to save episode'}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

async function editEpisode(id) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/episodes/${id}`);
        if (response.ok) {
            const episodeData = await response.json();
            openEpisodeModal(episodeData);
        } else {
            alert('Failed to fetch episode details');
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Bulk Operations
document.getElementById('bulkSubmitBtn').addEventListener('click', async () => {
    const resource = document.getElementById('bulkResource').value;
    const operation = document.getElementById('bulkOperation').value;
    const dataTextarea = document.getElementById('bulkData');
    const resultsContainer = document.getElementById('bulkResults');
    
    try {
        // Parse JSON data
        const items = JSON.parse(dataTextarea.value);
        
        if (!Array.isArray(items)) {
            throw new Error('Data must be a JSON array');
        }
        
        resultsContainer.innerHTML = 'Processing...';
        
        const response = await fetchWithAuth(`${API_BASE_URL}/bulk/${resource}`, {
            method: 'POST',
            body: JSON.stringify({
                operation,
                items
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            let html = `
                <h3>Bulk Operation Results</h3>
                <p>Operation: ${result.operation}</p>
                <p>Resource: ${result.resource}</p>
                <p>Total: ${result.summary.total}, Success: ${result.summary.successful}, Failed: ${result.summary.failed}</p>
            `;
            
            if (result.errors.length > 0) {
                html += '<h4>Errors:</h4><ul>';
                result.errors.forEach(error => {
                    html += `<li>Error: ${error.error}</li>`;
                });
                html += '</ul>';
            }
            
            resultsContainer.innerHTML = html;
            
            // Reload data
            if (resource === 'anime') {
                loadAnimeList();
                loadAnimeDropdowns();
            } else if (resource === 'episodes') {
                loadEpisodesList();
            }
        } else {
            resultsContainer.innerHTML = `<p class="error">Error: ${result.error}</p>`;
        }
    } catch (error) {
        resultsContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
});

// Search functionality
document.getElementById('animeSearchBtn').addEventListener('click', () => {
    const query = document.getElementById('animeSearch').value;
    const genre = document.getElementById('animeGenreFilter').value;
    
    // Call the search API
    searchAnime(query, genre);
});

document.getElementById('episodeSearchBtn').addEventListener('click', () => {
    const query = document.getElementById('episodeSearch').value;
    const animeId = document.getElementById('animeFilter').value;
    
    // Call the search API
    searchEpisodes(query, animeId);
});

async function searchAnime(query, genre) {
    const tableBody = document.getElementById('animeTableBody');
    tableBody.innerHTML = '<tr><td colspan="7">Searching...</td></tr>';
    
    try {
        let url = `${API_BASE_URL}/search?type=anime`;
        if (query) url += `&q=${encodeURIComponent(query)}`;
        if (genre) url += `&genre=${encodeURIComponent(genre)}`;
        
        const response = await fetchWithAuth(url);
        const searchResults = await response.json();
        
        if (!searchResults.results || !searchResults.results.anime || searchResults.results.anime.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">No anime found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = '';
        searchResults.results.anime.forEach(anime => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${anime.id}</td>
                <td><img src="${anime.thumbnail_url}" alt="${anime.title}" class="thumbnail-preview"></td>
                <td>${anime.title}</td>
                <td>${anime.genre}</td>
                <td>${new Date(anime.created_at).toLocaleString()}</td>
                <td>${new Date(anime.updated_at).toLocaleString()}</td>
                <td class="action-buttons">
                    <button class="edit-btn" data-id="${anime.id}">Edit</button>
                    <button class="delete-btn" data-id="${anime.id}" data-title="${anime.title}">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        attachAnimeEventListeners();
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="7">Error searching anime: ${error.message}</td></tr>`;
    }
}

async function searchEpisodes(query, animeId) {
    const tableBody = document.getElementById('episodeTableBody');
    tableBody.innerHTML = '<tr><td colspan="8">Searching...</td></tr>';
    
    try {
        let url;
        if (query) {
            url = `${API_BASE_URL}/search?type=episodes&q=${encodeURIComponent(query)}`;
        } else if (animeId) {
            url = `${API_BASE_URL}/episodes?anime_id=${animeId}`;
        } else {
            // No filters, load all episodes
            loadEpisodesList();
            return;
        }
        
        const response = await fetchWithAuth(url);
        let episodesList;
        
        if (query) {
            const searchResults = await response.json();
            episodesList = searchResults.results.episodes || [];
        } else {
            episodesList = await response.json();
        }
        
        if (episodesList.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8">No episodes found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = '';
        episodesList.forEach(episode => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${episode.id}</td>
                <td><img src="${episode.thumbnail_url}" alt="Ep ${episode.episode_number}" class="thumbnail-preview"></td>
                <td>${episode.anime_title}</td>
                <td>${episode.episode_number}</td>
                <td>${episode.title}</td>
                <td>${getVideoQualityInfo(episode)}</td>
                <td>${new Date(episode.created_at).toLocaleString()}</td>
                <td class="action-buttons">
                    <button class="edit-btn" data-id="${episode.id}">Edit</button>
                    <button class="delete-btn" data-id="${episode.id}" data-title="${episode.title}">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        attachEpisodeEventListeners();
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="8">Error searching episodes: ${error.message}</td></tr>`;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
});
