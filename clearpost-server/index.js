const express = require('express');
const axios = require('axios');
const cors = require('cors');
const session = require('express-session');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const querystring = require('querystring');

const PORT = process.env.PORT || 3001;

// Twitter credentials and callback URL
const CONSUMER_KEY = "NMAt4kO61RiPhTjEJJgec1zQj";
const CONSUMER_SECRET = "pXr7dsLxLxOTaESQAV1RC7e6YlUPdryiMu5kdCxd9d0lEuOMVE";
const CALLBACK_URL = "https://clearpost.onrender.com/callback";

const app = express();

// Update CORS to allow the correct frontend domain
app.use(cors({
  origin: "https://clearpost.vercel.app",
  credentials: true
}));

app.use(express.json());

// Updated session configuration for cross-domain cookies
app.use(session({
  secret: 'clearpost_secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    // Set the cookie domain so that it is sent with requests from your backend domain.
    // Note: This value may need to be adjusted based on your setup.
    domain: process.env.NODE_ENV === 'production' ? 'clearpost.onrender.com' : undefined,
    secure: process.env.NODE_ENV === 'production',  // Cookies are sent only over HTTPS in production.
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// OAuth 1.0a setup
const oauth = OAuth({
  consumer: { key: CONSUMER_KEY, secret: CONSUMER_SECRET },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto.createHmac('sha1', key).update(base_string).digest('base64');
  },
});

// -----------------
// OAuth Endpoints
// -----------------

// Start Twitter login
app.get('/auth/twitter', async (req, res) => {
  try {
    const requestData = {
      url: "https://api.twitter.com/oauth/request_token",
      method: "POST",
      data: { oauth_callback: CALLBACK_URL },
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData));
    const response = await axios.post(requestData.url, null, { headers: authHeader });

    const parsed = querystring.parse(response.data);
    req.session.oauth_token = parsed.oauth_token;
    req.session.oauth_token_secret = parsed.oauth_token_secret;

    const redirectURL = `https://api.twitter.com/oauth/authorize?oauth_token=${parsed.oauth_token}`;
    res.redirect(redirectURL);
  } catch (err) {
    console.error("❌ Error getting request token:", err.message);
    res.status(500).json({ error: "Failed to get request token" });
  }
});

// Handle Twitter OAuth callback
app.get('/callback', async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  try {
    const requestData = {
      url: "https://api.twitter.com/oauth/access_token",
      method: "POST",
      data: { oauth_token, oauth_verifier },
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData));
    const response = await axios.post(requestData.url, null, { headers: authHeader });

    const result = querystring.parse(response.data);
    req.session.access_token = result.oauth_token;
    req.session.access_token_secret = result.oauth_token_secret;
    req.session.screen_name = result.screen_name;
    req.session.user_id = result.user_id;

    // Redirect user back to your frontend using the correct domain.
    res.redirect("https://clearpost.vercel.app");
  } catch (err) {
    console.error("❌ Error exchanging access token:", err.message);
    res.status(500).json({ error: "Failed to exchange access token" });
  }
});

// -----------------------
// API Endpoints (Prefix)
// -----------------------

const apiRouter = express.Router();

// Fetch user's tweets using Twitter API v2
apiRouter.get("/fetch-twitter", async (req, res) => {
  const { access_token, access_token_secret, user_id, screen_name } = req.session;
  if (!access_token || !access_token_secret || !user_id) {
    return res.status(401).json({ error: "Not authenticated with Twitter" });
  }
  try {
    const url = `https://api.twitter.com/2/users/${user_id}/tweets?max_results=5&tweet.fields=text`;
    const requestData = { url, method: "GET" };

    const authHeader = oauth.toHeader(
      oauth.authorize(requestData, {
        key: access_token,
        secret: access_token_secret,
      })
    );

    console.log("📡 Fetching from Twitter v2:", url);

    const response = await axios.get(url, { headers: authHeader });
    const tweets = response.data.data || [];
    console.log(`✅ Retrieved ${tweets.length} tweets from @${screen_name}`);
    res.json({
      user: { id: user_id, screen_name },
      tweets
    });
  } catch (err) {
    console.error("❌ Twitter v2 API error:", err.response?.data || err.message);
    res.json({
      user: { id: user_id || "mock", screen_name: screen_name || "mockuser" },
      tweets: [
        { id: "1", text: "⚠️ Twitter v2 access still blocked or buggy. This is a mock tweet." },
        { id: "2", text: "🧪 Using dummy tweet data for now." }
      ]
    });
  }
});

// Hugging Face AI analysis endpoint
apiRouter.post("/analyze-tweet", async (req, res) => {
  const { text } = req.body;
  try {
    const aiRes = await axios.post(
      "https://api-inference.huggingface.co/models/unitary/toxic-bert",
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer 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`,
          "Content-Type": "application/json"
        }
      }
    );
    res.json(aiRes.data);
  } catch (err) {
    console.error("❌ Hugging Face error:", err.response?.data || err.message);
    res.status(500).json({ error: "AI analysis failed", details: err.response?.data || err.message });
  }
});

// Mount API endpoints under "/api"
app.use("/api", apiRouter);

app.listen(PORT, () => {
  console.log(`🚀 ClearPost running at https://clearpost.onrender.com`);
});















