/**
 * Library AI Agent - Express Backend Server
 * Powered by IBM Granite via watsonx.ai
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { generateText, buildLibraryAgentPrompt } = require('./watsonxService');
const db = require('./libraryDatabase');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ─── In-memory Session Store ───────────────────────────────────────────────────
const sessions = {}; // sessionId -> { history, studentProfile, apiKey }

function getSession(sessionId) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = { history: [], studentProfile: {}, apiKey: null };
  }
  return sessions[sessionId];
}

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Library AI Agent', model: 'ibm/granite-4-h-small', timestamp: new Date().toISOString() });
});

// ─── Library Stats ─────────────────────────────────────────────────────────────
app.get('/api/library/stats', (req, res) => {
  res.json(db.getStats());
});

// ─── Get All Books ─────────────────────────────────────────────────────────────
app.get('/api/library/books', (req, res) => {
  const { search, subject, available } = req.query;
  let books = db.getAllBooks();
  if (search) books = db.searchBooks(search);
  if (subject) books = books.filter(b => b.subject.toLowerCase() === subject.toLowerCase());
  if (available === 'true') books = books.filter(b => b.available > 0);
  res.json(books);
});

// ─── Get Single Book ───────────────────────────────────────────────────────────
app.get('/api/library/books/:id', (req, res) => {
  const book = db.getBookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
});

// ─── Reserve Book ──────────────────────────────────────────────────────────────
app.post('/api/library/reserve', (req, res) => {
  const { bookId, studentId, studentName } = req.body;
  if (!bookId || !studentId || !studentName) {
    return res.status(400).json({ error: 'bookId, studentId, and studentName are required' });
  }
  const result = db.reserveBook(bookId, studentId, studentName);
  res.json(result);
});

// ─── Cancel Reservation ────────────────────────────────────────────────────────
app.delete('/api/library/reserve', (req, res) => {
  const { bookId, studentId } = req.body;
  const result = db.cancelReservation(bookId, studentId);
  res.json(result);
});

// ─── Return Book ───────────────────────────────────────────────────────────────
app.post('/api/library/return', (req, res) => {
  const { bookId, studentId } = req.body;
  if (!bookId || !studentId) return res.status(400).json({ error: 'bookId and studentId are required' });
  const result = db.returnBook(bookId, studentId);
  res.json(result);
});

// ─── Get Student Reservations ──────────────────────────────────────────────────
app.get('/api/library/reservations/:studentId', (req, res) => {
  const reservations = db.getStudentReservations(req.params.studentId);
  res.json(reservations);
});

// ─── Notifications ─────────────────────────────────────────────────────────────
app.get('/api/notifications/:studentId', (req, res) => {
  const notifs = db.getNotifications(req.params.studentId);
  const unread = db.getUnreadCount(req.params.studentId);
  res.json({ notifications: notifs, unread });
});

app.post('/api/notifications/:studentId/read', (req, res) => {
  db.markNotificationsRead(req.params.studentId);
  res.json({ success: true });
});

// ─── AI Chat Endpoint ─────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, sessionId, studentProfile, apiKey } = req.body;

  if (!message) return res.status(400).json({ error: 'message is required' });
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  const session = getSession(sessionId);

  // Store API key in session if provided
  if (apiKey) session.apiKey = apiKey;
  if (studentProfile) session.studentProfile = { ...session.studentProfile, ...studentProfile };

  const effectiveApiKey = session.apiKey || process.env.IBM_API_KEY;
  if (!effectiveApiKey || effectiveApiKey === 'your_ibm_api_key_here') {
    return res.status(400).json({ error: 'IBM API key not configured. Please provide your API key in settings.' });
  }

  try {
    // Intent Detection — check if user wants to reserve/cancel via chat
    const lowerMsg = message.toLowerCase();
    const reserveMatch = lowerMsg.match(/reserve\s+(book\s+)?([a-z]{2}\d{3})/i) ||
                         lowerMsg.match(/\b([a-z]{2}\d{3})\b.*\breserve\b/i);
    const cancelMatch  = lowerMsg.match(/cancel\s+(reservation|booking)?.*?([a-z]{2}\d{3})/i);

    let actionResult = null;

    if (reserveMatch && session.studentProfile.id) {
      const bookId = (reserveMatch[2] || reserveMatch[1]).toUpperCase();
      const result = db.reserveBook(bookId, session.studentProfile.id, session.studentProfile.name || 'Student');
      actionResult = result;
    } else if (cancelMatch && session.studentProfile.id) {
      const bookId = cancelMatch[2].toUpperCase();
      const result = db.cancelReservation(bookId, session.studentProfile.id);
      actionResult = result;
    }

    // Build prompt and call IBM Granite
    const libraryContext = db.buildLibraryContext();
    const prompt = buildLibraryAgentPrompt(message, libraryContext, session.history, session.studentProfile);

    const aiResult = await generateText(prompt, effectiveApiKey, { max_new_tokens: 600 });

    // Append to history
    session.history.push({ role: 'user', content: message });
    session.history.push({ role: 'assistant', content: aiResult.text });

    // Keep history to last 20 messages
    if (session.history.length > 20) session.history = session.history.slice(-20);

    res.json({
      reply: aiResult.text,
      tokens_used: aiResult.tokens_used,
      action: actionResult || null
    });

  } catch (err) {
    console.error('AI generation error:', err.message);
    const errMsg = err.response?.data?.errors?.[0]?.message || err.message;
    res.status(500).json({ error: `AI service error: ${errMsg}` });
  }
});

// ─── Update Student Profile ────────────────────────────────────────────────────
app.post('/api/session/profile', (req, res) => {
  const { sessionId, studentProfile } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const session = getSession(sessionId);
  session.studentProfile = { ...session.studentProfile, ...studentProfile };
  res.json({ success: true, profile: session.studentProfile });
});

// ─── Clear Session ─────────────────────────────────────────────────────────────
app.delete('/api/session/:sessionId', (req, res) => {
  delete sessions[req.params.sessionId];
  res.json({ success: true });
});

// ─── Catch-all: serve frontend ─────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║        Library AI Agent  —  IBM Granite              ║
║  Backend: http://localhost:${PORT}                     ║
║  Model:   ibm/granite-4-h-small                      ║
║  Project: 8b921f38-6abe-4b29-8629-c98d6e14555e      ║
╚══════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
