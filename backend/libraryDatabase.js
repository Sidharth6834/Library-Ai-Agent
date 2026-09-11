/**
 * Library Database
 * - Book catalog (fixed master list)
 * - Persistent reservations/waitlist stored in db.json (survives restarts)
 * - Auto-fulfills waitlist when a book is returned
 * - Notification queue per student
 */

const fs   = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

// ─── Master Book Catalog ───────────────────────────────────────────────────────
const BOOKS = [
  { id: "CS001", title: "Artificial Intelligence: A Modern Approach", author: "Stuart Russell & Peter Norvig", isbn: "978-0-13-468599-1", subject: "Computer Science", topic: ["AI", "Machine Learning", "Search Algorithms"], edition: "4th", total: 4, demand: "high", location: "CS-A1", description: "The leading textbook on AI covering all major areas including search, logic, planning, ML." },
  { id: "CS002", title: "Deep Learning", author: "Ian Goodfellow, Yoshua Bengio, Aaron Courville", isbn: "978-0-262-03561-3", subject: "Computer Science", topic: ["Deep Learning", "Neural Networks", "AI"], edition: "1st", total: 3, demand: "very high", location: "CS-A2", description: "Comprehensive resource on deep learning techniques and mathematical foundations." },
  { id: "CS003", title: "Clean Code", author: "Robert C. Martin", isbn: "978-0-13-235088-4", subject: "Software Engineering", topic: ["Programming", "Best Practices", "Agile"], edition: "1st", total: 5, demand: "medium", location: "CS-B1", description: "Essential guide to writing clean, maintainable code in any language." },
  { id: "CS004", title: "Design Patterns: Elements of Reusable Object-Oriented Software", author: "Gang of Four", isbn: "978-0-201-63361-0", subject: "Software Engineering", topic: ["Design Patterns", "OOP", "Architecture"], edition: "1st", total: 3, demand: "high", location: "CS-B2", description: "Classic book on software design patterns used across the industry." },
  { id: "CS005", title: "Introduction to Algorithms (CLRS)", author: "Cormen, Leiserson, Rivest, Stein", isbn: "978-0-262-04630-5", subject: "Computer Science", topic: ["Algorithms", "Data Structures", "Complexity"], edition: "4th", total: 6, demand: "high", location: "CS-C1", description: "Comprehensive reference on algorithms and data structures." },
  { id: "CS006", title: "The Pragmatic Programmer", author: "David Thomas, Andrew Hunt", isbn: "978-0-13-595705-9", subject: "Software Engineering", topic: ["Programming", "Career", "Best Practices"], edition: "20th Anniversary", total: 3, demand: "medium", location: "CS-B3", description: "Timeless insights into the art and craft of software development." },
  { id: "CS007", title: "Python Machine Learning", author: "Sebastian Raschka, Vahid Mirjalili", isbn: "978-1-78995-575-0", subject: "Computer Science", topic: ["Python", "Machine Learning", "Data Science"], edition: "3rd", total: 4, demand: "high", location: "CS-A3", description: "Hands-on ML with Python using Scikit-learn, Keras, and TensorFlow." },
  { id: "CS008", title: "Database System Concepts", author: "Abraham Silberschatz", isbn: "978-0-07-802215-9", subject: "Computer Science", topic: ["Databases", "SQL", "Data Management"], edition: "7th", total: 5, demand: "medium", location: "CS-D1", description: "Foundational text on database design, management, and SQL." },
  { id: "MA001", title: "Linear Algebra and Its Applications", author: "Gilbert Strang", isbn: "978-0-03-010567-8", subject: "Mathematics", topic: ["Linear Algebra", "Matrices", "Vector Spaces"], edition: "5th", total: 4, demand: "high", location: "MA-A1", description: "Classic treatment of linear algebra with clear explanations and applications." },
  { id: "MA002", title: "Probability and Statistics for Engineering", author: "Jay Devore", isbn: "978-1-305-25180-9", subject: "Mathematics", topic: ["Probability", "Statistics", "Engineering"], edition: "9th", total: 3, demand: "high", location: "MA-B1", description: "Comprehensive intro to probability and statistics for engineers and scientists." },
  { id: "MA003", title: "Calculus: Early Transcendentals", author: "James Stewart", isbn: "978-1-285-74155-0", subject: "Mathematics", topic: ["Calculus", "Differentiation", "Integration"], edition: "8th", total: 8, demand: "medium", location: "MA-C1", description: "The standard calculus textbook used in universities worldwide." },
  { id: "MA004", title: "Discrete Mathematics and Its Applications", author: "Kenneth H. Rosen", isbn: "978-0-07-338309-5", subject: "Mathematics", topic: ["Discrete Math", "Logic", "Graph Theory", "Combinatorics"], edition: "8th", total: 5, demand: "medium", location: "MA-D1", description: "Thorough introduction to mathematical reasoning and discrete structures." },
  { id: "DS001", title: "Hands-On Machine Learning with Scikit-Learn, Keras & TensorFlow", author: "Aurélien Géron", isbn: "978-1-098-12597-4", subject: "Data Science", topic: ["Machine Learning", "Python", "TensorFlow", "Neural Networks"], edition: "3rd", total: 3, demand: "very high", location: "DS-A1", description: "Best-selling practical guide to building ML systems using modern tools." },
  { id: "DS002", title: "Data Science from Scratch", author: "Joel Grus", isbn: "978-1-492-04113-0", subject: "Data Science", topic: ["Data Science", "Python", "Statistics", "Machine Learning"], edition: "2nd", total: 3, demand: "medium", location: "DS-A2", description: "Build data science tools from scratch with Python." },
  { id: "DS003", title: "The Elements of Statistical Learning", author: "Hastie, Tibshirani, Friedman", isbn: "978-0-387-84858-7", subject: "Data Science", topic: ["Statistics", "Machine Learning", "Regression", "Classification"], edition: "2nd", total: 2, demand: "high", location: "DS-B1", description: "Rigorous statistical treatment of machine learning methods." },
  { id: "PH001", title: "University Physics", author: "Young & Freedman", isbn: "978-0-13-397231-0", subject: "Physics", topic: ["Mechanics", "Thermodynamics", "Electromagnetism", "Optics"], edition: "15th", total: 7, demand: "medium", location: "PH-A1", description: "Standard university physics covering classical and modern topics." },
  { id: "PH002", title: "Introduction to Electrodynamics", author: "David J. Griffiths", isbn: "978-1-108-42041-9", subject: "Physics", topic: ["Electrodynamics", "Maxwell Equations", "Waves"], edition: "4th", total: 4, demand: "medium", location: "PH-B1", description: "The standard undergraduate text in electrodynamics." },
  { id: "BU001", title: "The Lean Startup", author: "Eric Ries", isbn: "978-0-307-88791-7", subject: "Business", topic: ["Entrepreneurship", "Lean", "Startups", "Innovation"], edition: "1st", total: 4, demand: "medium", location: "BU-A1", description: "Framework for building startups and managing innovation." },
  { id: "BU002", title: "Thinking, Fast and Slow", author: "Daniel Kahneman", isbn: "978-0-374-27563-1", subject: "Psychology", topic: ["Cognitive Science", "Decision Making", "Behavioral Economics"], edition: "1st", total: 3, demand: "low", location: "BU-B1", description: "Nobel laureate's exploration of the two systems of thinking." },
  { id: "BI001", title: "Campbell Biology", author: "Jane B. Reece et al.", isbn: "978-0-13-480209-8", subject: "Biology", topic: ["Cell Biology", "Genetics", "Evolution", "Ecology"], edition: "12th", total: 5, demand: "medium", location: "BI-A1", description: "The standard comprehensive biology textbook at university level." },
  { id: "LI001", title: "How to Read Literature Like a Professor", author: "Thomas C. Foster", isbn: "978-0-06-230160-6", subject: "Literature", topic: ["Literary Analysis", "Writing", "Reading Skills"], edition: "Revised", total: 5, demand: "low", location: "LI-A1", description: "A guide to deeper reading and literary analysis." },
];

// ─── Persistent State (db.json) ────────────────────────────────────────────────
// Shape: { checkedOut: { bookId: count }, reservations: [...], notifications: { studentId: [...] } }

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch { /* corrupt file — start fresh */ }
  return { checkedOut: {}, reservations: [], notifications: {} };
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let _db = loadDB();

function db() { return _db; }

// ─── Derived availability ──────────────────────────────────────────────────────
function availableCount(bookId) {
  const book = BOOKS.find(b => b.id === bookId);
  if (!book) return 0;
  const out = _db.checkedOut[bookId] || 0;
  return Math.max(0, book.total - out);
}

// ─── Enrich book with live availability ───────────────────────────────────────
function enrich(book) {
  const avail = availableCount(book.id);
  const waitlisted = _db.reservations.filter(r => r.bookId === book.id && r.status === 'waitlisted').length;
  return { ...book, available: avail, checkedOut: (book.total - avail), waitlistCount: waitlisted };
}

// ─── Query helpers ─────────────────────────────────────────────────────────────
function getAllBooks()      { return BOOKS.map(enrich); }
function getBookById(id)   { const b = BOOKS.find(b => b.id === id); return b ? enrich(b) : null; }
function getBooksBySubject(subject) { return BOOKS.filter(b => b.subject.toLowerCase() === subject.toLowerCase()).map(enrich); }
function getAvailableBooks(){ return BOOKS.map(enrich).filter(b => b.available > 0); }

function searchBooks(query) {
  if (!query) return getAllBooks();
  const q = query.toLowerCase();
  return BOOKS.filter(b =>
    b.title.toLowerCase().includes(q) ||
    b.author.toLowerCase().includes(q) ||
    b.subject.toLowerCase().includes(q) ||
    b.topic.some(t => t.toLowerCase().includes(q)) ||
    b.description.toLowerCase().includes(q)
  ).map(enrich);
}

function getStats() {
  const enriched = getAllBooks();
  const totalCopies   = enriched.reduce((s, b) => s + b.total, 0);
  const availCopies   = enriched.reduce((s, b) => s + b.available, 0);
  const subjects      = [...new Set(enriched.map(b => b.subject))];
  return {
    totalBooks: totalCopies,
    availableBooks: availCopies,
    checkedOut: totalCopies - availCopies,
    uniqueTitles: BOOKS.length,
    subjects: subjects.length,
    subjectList: subjects,
    activeReservations: _db.reservations.filter(r => r.status === 'reserved').length,
    waitlisted: _db.reservations.filter(r => r.status === 'waitlisted').length,
  };
}

// ─── Reserve ───────────────────────────────────────────────────────────────────
function reserveBook(bookId, studentId, studentName) {
  const book = BOOKS.find(b => b.id === bookId);
  if (!book) return { success: false, message: `No book with ID "${bookId}" exists in the library catalog.` };

  const existing = _db.reservations.find(
    r => r.bookId === bookId && r.studentId === studentId && r.status !== 'cancelled'
  );
  if (existing) {
    return { success: false, message: `You already have a ${existing.status} spot for "${book.title}".` };
  }

  const avail = availableCount(bookId);

  if (avail > 0) {
    // Reserve — increment checked-out count
    _db.checkedOut[bookId] = (_db.checkedOut[bookId] || 0) + 1;
    _db.reservations.push({
      bookId, studentId, studentName,
      reservedAt: new Date().toISOString(),
      status: 'reserved'
    });
    saveDB(_db);
    return {
      success: true, status: 'reserved',
      message: `✅ Reserved "${book.title}" for you! Please collect within 48 hours from shelf ${book.location}.`
    };
  } else {
    // Add to waitlist
    const position = _db.reservations.filter(r => r.bookId === bookId && r.status === 'waitlisted').length + 1;
    _db.reservations.push({
      bookId, studentId, studentName,
      reservedAt: new Date().toISOString(),
      status: 'waitlisted'
    });
    saveDB(_db);
    return {
      success: true, status: 'waitlisted',
      message: `📋 All ${book.total} copies of "${book.title}" are currently checked out. You're #${position} on the waitlist. You'll be notified automatically when a copy becomes available.`
    };
  }
}

// ─── Return Book ───────────────────────────────────────────────────────────────
// Called when a student returns a book (or librarian marks it returned).
// Automatically fulfills the next person on the waitlist.
function returnBook(bookId, studentId) {
  const book = BOOKS.find(b => b.id === bookId);
  if (!book) return { success: false, message: `Book ID "${bookId}" not found.` };

  // Find the active reservation for this student
  const resIdx = _db.reservations.findIndex(
    r => r.bookId === bookId && r.studentId === studentId && r.status === 'reserved'
  );
  if (resIdx === -1) {
    return { success: false, message: `No active reservation found for this book under your ID.` };
  }

  // Mark as returned
  _db.reservations[resIdx].status = 'returned';
  _db.reservations[resIdx].returnedAt = new Date().toISOString();

  // Decrement checked-out count
  _db.checkedOut[bookId] = Math.max(0, (_db.checkedOut[bookId] || 1) - 1);

  let notifiedStudent = null;

  // ── Auto-fulfill waitlist ──────────────────────────────────────────────────
  // Find the earliest waitlisted person for this book
  const waitlistEntry = _db.reservations
    .filter(r => r.bookId === bookId && r.status === 'waitlisted')
    .sort((a, b) => new Date(a.reservedAt) - new Date(b.reservedAt))[0];

  if (waitlistEntry) {
    // Promote them to reserved
    const wIdx = _db.reservations.findIndex(r =>
      r.bookId === bookId &&
      r.studentId === waitlistEntry.studentId &&
      r.status === 'waitlisted'
    );
    _db.reservations[wIdx].status = 'reserved';
    _db.reservations[wIdx].fulfilledAt = new Date().toISOString();
    // Increment checked-out again for the new reservation
    _db.checkedOut[bookId] = (_db.checkedOut[bookId] || 0) + 1;

    // Push a notification for that student
    pushNotification(waitlistEntry.studentId, {
      type: 'waitlist_fulfilled',
      bookId,
      bookTitle: book.title,
      location: book.location,
      message: `📬 Good news! "${book.title}" is now available for you. Please collect from shelf ${book.location} within 48 hours or your spot will be released.`,
      at: new Date().toISOString()
    });

    notifiedStudent = waitlistEntry.studentName;
  }

  saveDB(_db);

  return {
    success: true,
    message: `Book "${book.title}" returned successfully.`,
    waitlistFulfilled: !!notifiedStudent,
    notifiedStudent
  };
}

// ─── Cancel Reservation ────────────────────────────────────────────────────────
function cancelReservation(bookId, studentId) {
  const book = BOOKS.find(b => b.id === bookId);
  const idx = _db.reservations.findIndex(
    r => r.bookId === bookId && r.studentId === studentId && r.status !== 'cancelled' && r.status !== 'returned'
  );
  if (idx === -1) return { success: false, message: "No active reservation found." };

  const wasReserved = _db.reservations[idx].status === 'reserved';
  _db.reservations[idx].status = 'cancelled';

  // If was reserved (not just waitlisted), free up a copy and check waitlist
  if (wasReserved) {
    _db.checkedOut[bookId] = Math.max(0, (_db.checkedOut[bookId] || 1) - 1);

    // Promote next waitlisted person
    const next = _db.reservations
      .filter(r => r.bookId === bookId && r.status === 'waitlisted')
      .sort((a, b) => new Date(a.reservedAt) - new Date(b.reservedAt))[0];

    if (next) {
      const nIdx = _db.reservations.findIndex(r =>
        r.bookId === bookId && r.studentId === next.studentId && r.status === 'waitlisted'
      );
      _db.reservations[nIdx].status = 'reserved';
      _db.reservations[nIdx].fulfilledAt = new Date().toISOString();
      _db.checkedOut[bookId] = (_db.checkedOut[bookId] || 0) + 1;
      pushNotification(next.studentId, {
        type: 'waitlist_fulfilled',
        bookId,
        bookTitle: book ? book.title : bookId,
        location: book ? book.location : '',
        message: `📬 "${book ? book.title : bookId}" is now available for you (reservation was cancelled by previous holder). Collect from shelf ${book ? book.location : ''} within 48 hours.`,
        at: new Date().toISOString()
      });
    }
  }

  saveDB(_db);
  return { success: true, message: `Reservation for "${book ? book.title : bookId}" cancelled.` };
}

// ─── Student Reservations ──────────────────────────────────────────────────────
function getStudentReservations(studentId) {
  return _db.reservations
    .filter(r => r.studentId === studentId && r.status !== 'cancelled' && r.status !== 'returned')
    .map(r => {
      const book = BOOKS.find(b => b.id === r.bookId);
      return { ...r, bookTitle: book ? book.title : 'Unknown', bookAuthor: book ? book.author : '', location: book ? book.location : '' };
    })
    .sort((a, b) => new Date(b.reservedAt) - new Date(a.reservedAt));
}

// ─── Notifications ─────────────────────────────────────────────────────────────
function pushNotification(studentId, notif) {
  if (!_db.notifications[studentId]) _db.notifications[studentId] = [];
  _db.notifications[studentId].unshift({ ...notif, read: false, id: Date.now() + Math.random() });
}

function getNotifications(studentId) {
  return (_db.notifications[studentId] || []).slice(0, 20); // last 20
}

function markNotificationsRead(studentId) {
  if (_db.notifications[studentId]) {
    _db.notifications[studentId] = _db.notifications[studentId].map(n => ({ ...n, read: true }));
    saveDB(_db);
  }
}

function getUnreadCount(studentId) {
  return (_db.notifications[studentId] || []).filter(n => !n.read).length;
}

// ─── AI Context Builder ────────────────────────────────────────────────────────
function buildLibraryContext() {
  const enriched = getAllBooks();
  const lines = enriched.map(b =>
    `[${b.id}] "${b.title}" by ${b.author} | Subject: ${b.subject} | Topics: ${b.topic.join(', ')} | Available: ${b.available}/${b.total} | Demand: ${b.demand} | Location: ${b.location}`
  ).join('\n');

  return `LIBRARY CATALOG (${BOOKS.length} titles in database):
${lines}

IMPORTANT RULES FOR YOU:
- Only recommend books that exist in the catalog above (identified by their [ID]).
- If a student asks for a book/topic NOT in the catalog, tell them clearly: "We don't currently have that book in our library. I can suggest the closest available alternatives." Then suggest the closest match from the catalog.
- Always show availability (e.g. "2 of 4 copies available") when recommending.
- If available: 0, say it's fully checked out and offer waitlist.
- If on waitlist, explain they'll be automatically notified when a copy is returned.`;
}

module.exports = {
  getAllBooks, getBookById, getBooksBySubject,
  getAvailableBooks, searchBooks, getStats,
  reserveBook, returnBook, cancelReservation,
  getStudentReservations,
  getNotifications, markNotificationsRead, getUnreadCount,
  buildLibraryContext,
};
