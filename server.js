const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// JioSaavn API Client
const createSaavnClient = () => {
  const REQ_TIMEOUT = 20;
  const USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/110.0",
    "Mozilla/5.0 (Windows NT 10.0; rv:102.0) Gecko/20100101 Firefox/102.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/109.0",
  ];

  const headers = {
    "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
    "Referer": "https://www.jiosaavn.com/",
  };

  const api_url = "https://www.jiosaavn.com/api.php";
  
  const apiClient = axios.create({
    timeout: REQ_TIMEOUT * 1000,
    headers: headers
  });

  const formatResponse = async (response) => {
    if (Array.isArray(response)) {
      return { data: response };
    } else if (typeof response === 'object') {
      if ('data' in response) {
        return response;
      } else {
        return { data: response };
      }
    }
  };

  const getIdFromUrl = async (url) => {
    return url.split("/").pop();
  };

  const searchOnSaavn = async (searchQuery) => {
    const params = {
      "__call": "autocomplete.get",
      "query": searchQuery,
      "_format": "json",
      "_marker": "0",
      "ctx": "web6dot0",
    };

    try {
      const resp = await apiClient.post(api_url, null, { params });
      const data = await formatResponse(resp.data);
      data.status = resp.status;
      return data;
    } catch (error) {
      throw error;
    }
  };

  const getSongDetails = async (songId) => {
    if (songId.includes("jiosaavn")) {
      songId = await getIdFromUrl(songId);
    }

    const params = {
      "__call": "webapi.get",
      "token": songId,
      "type": "song",
      "includeMetaTags": "0",
      "ctx": "web6dot0",
      "api_version": "4",
      "_format": "json",
      "_marker": "0",
    };

    const resp = await apiClient.post(api_url, null, { params });
    return resp.data;
  };

  const getSongDirectLink = async (songId) => {
    const songs = await getSongDetails(songId);
    const moreInfo = songs.songs[0].more_info;
    const songEncUrl = moreInfo.encrypted_media_url;
    const bitrate = moreInfo["320kbps"] ? "320" : "128";

    const params = {
      "__call": "song.generateAuthToken",
      "url": songEncUrl,
      "bitrate": String(bitrate),
      "api_version": "4",
      "_format": "json",
      "ctx": "web6dot0",
      "_marker": "0",
    };

    const resp = await apiClient.post(api_url, null, { params });
    const data = await formatResponse(resp.data);
    return data.data.auth_url;
  };

  const getTopCharts = async () => {
    const params = {
      "__call": "content.getCharts",
      "api_version": "4",
      "_format": "json",
      "_marker": "0",
      "ctx": "web6dot0",
    };

    const resp = await apiClient.post(api_url, null, { params });
    const data = await formatResponse(resp.data);
    data.status = resp.status;
    return data;
  };

  const getNewReleases = async (page = 1, limit = 50) => {
    const params = {
      "api_version": "4",
      "_format": "json",
      "__call": "content.getAlbums",
      "p": String(page),
      "ctx": "web6dot0",
      "_marker": "0",
      "n": String(limit),
    };

    const resp = await apiClient.post(api_url, null, { params });
    const data = resp.data;
    data.status = resp.status;
    return data;
  };

  return {
    searchOnSaavn,
    getSongDetails,
    getSongDirectLink,
    getTopCharts,
    getNewReleases
  };
};

const saavnClient = createSaavnClient();

// API Routes
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    const result = await saavnClient.searchOnSaavn(query);
    res.json({ status: 200, data: result.data.songs.data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search songs' });
  }
});

app.get('/api/song/:id', async (req, res) => {
    try {
      let { id } = req.params;
      if (id.includes('/')) {
        id = id.split('/').pop(); 
      }
  
      const result = await saavnClient.getSongDirectLink(id);
      res.json({ status: 200, downloadLink: result });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get song link' });
    }
  });
  

app.get('/api/charts', async (req, res) => {
  try {
    const result = await saavnClient.getTopCharts();
    res.json({ status: 200, data: result.data.charts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get charts' });
  }
});

app.get('/api/new-releases', async (req, res) => {
  try {
    const result = await saavnClient.getNewReleases();
    res.json({ status: 200, data: result.data.albums });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get new releases' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});