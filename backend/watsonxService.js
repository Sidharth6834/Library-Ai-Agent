/**
 * IBM watsonx AI Service
 * Handles token acquisition and text generation via IBM Granite
 */
require('dotenv').config();
const axios = require('axios');
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Detect corporate proxy from environment (HTTP_PROXY / HTTPS_PROXY / https_proxy)
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy ||
                 process.env.HTTP_PROXY  || process.env.http_proxy  || null;

// Use proxy-aware agent when a proxy is detected, otherwise bypass TLS verification
const httpsAgent = proxyUrl
  ? new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false })
  : new https.Agent({ rejectUnauthorized: false });

console.log(proxyUrl
  ? `[watsonx] Using proxy: ${proxyUrl}`
  : '[watsonx] Direct connection (no proxy detected)');

const IAM_URL = process.env.IBM_IAM_URL || 'https://iam.cloud.ibm.com/identity/token';
const WX_URL = process.env.IBM_WX_URL || 'https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29';
const MODEL_ID = process.env.IBM_MODEL_ID || 'ibm/granite-4-h-small';
const PROJECT_ID = process.env.IBM_PROJECT_ID || '8b921f38-6abe-4b29-8629-c98d6e14555e';

let cachedToken = null;
let tokenExpiry = null;

// ─── IAM Token Management ──────────────────────────────────────────────────────

async function getIAMToken(apiKey) {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'urn:ibm:params:oauth:grant-type:apikey');
  params.append('apikey', apiKey);

  const response = await axios.post(IAM_URL, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    httpsAgent
  });

  cachedToken = response.data.access_token;
  // Expire 5 minutes before actual expiry for safety
  tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
  return cachedToken;
}

// ─── Text Generation ───────────────────────────────────────────────────────────

async function generateText(prompt, apiKey, options = {}) {
  const token = await getIAMToken(apiKey);

  const payload = {
    model_id: MODEL_ID,
    project_id: PROJECT_ID,
    input: prompt,
    parameters: {
      decoding_method: options.decoding_method || 'greedy',
      max_new_tokens: options.max_new_tokens || 800,
      min_new_tokens: options.min_new_tokens || 50,
      stop_sequences: options.stop_sequences || ['<|end|>', '\n\nUser:', '\nUser:'],
      repetition_penalty: options.repetition_penalty || 1.1,
      temperature: options.temperature || 0.7
    }
  };

  const response = await axios.post(WX_URL, payload, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    httpsAgent
  });

  const result = response.data;
  if (result.results && result.results.length > 0) {
    return {
      text: result.results[0].generated_text.trim(),
      tokens_used: result.results[0].generated_token_count,
      stop_reason: result.results[0].stop_reason
    };
  }
  throw new Error('No results from IBM Granite model');
}

// ─── Library Agent Prompt Builder ─────────────────────────────────────────────

function buildLibraryAgentPrompt(userMessage, libraryContext, conversationHistory = [], studentProfile = {}) {
  const systemPrompt = `You are LibraryBot, an intelligent Library AI Agent for a university library powered by IBM Granite.
Your mission is to help students find the right learning materials, check book availability, make reservations, and provide personalized academic recommendations.

CAPABILITIES:
- Search and recommend books based on topics, subjects, or course names
- Check real-time book availability (available/checked-out/waitlisted)
- Assist with book reservations and waitlist management
- Analyze student academic needs and suggest curated reading lists
- Provide book summaries, locations, and demand information
- Guide students to the best resources for their studies

RESPONSE GUIDELINES:
- Be friendly, helpful, and academic in tone
- Always include book IDs (like [CS001]) when recommending books so students can reserve them
- Mention availability status when relevant
- For unavailable books, always offer to add to waitlist
- Provide specific, actionable recommendations
- If a student mentions a course or topic, map it to relevant books in the catalog
- Keep responses concise but comprehensive (aim for 150-300 words)

${studentProfile.name ? `STUDENT PROFILE: ${studentProfile.name} | Major: ${studentProfile.major || 'Not specified'} | Year: ${studentProfile.year || 'Not specified'}` : ''}

${libraryContext}

CONVERSATION FORMAT:
Always end recommendations with a line like: "Would you like me to reserve any of these for you? Just ask!"`;

  let conversationStr = '';
  if (conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-6); // last 3 exchanges
    conversationStr = '\n\nCONVERSATION HISTORY:\n' + recent.map(m =>
      `${m.role === 'user' ? 'Student' : 'LibraryBot'}: ${m.content}`
    ).join('\n');
  }

  return `${systemPrompt}${conversationStr}

Student: ${userMessage}
LibraryBot:`;
}

module.exports = { generateText, buildLibraryAgentPrompt };
