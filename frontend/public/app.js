/**
 * Library AI Agent — Frontend Application
 * Communicates with Express backend powered by IBM Granite
 */

const API_BASE = window.location.port === '5500' || window.location.port === '8080'
  ? 'http://localhost:3001'  // dev: live server
  : '';                      // prod: same origin

// ─── State ─────────────────────────────────────────────────────────────────────
const state = {
  sessionId: 'sess_' + Math.random().toString(36).slice(2),
  profile: JSON.parse(localStorage.getItem('student_profile') || '{}'),
  books: [],
  pendingReserveBookId: null,
};

// ─── DOM Refs ───────────────────────────────────────────────────────────────────
const $id = id => document.getElementById(id);

const chatMessages     = $id('chatMessages');
const chatInput        = $id('chatInput');
const sendBtn          = $id('sendBtn');
const typingIndicator  = $id('typingIndicator');
const catalogGrid      = $id('catalogGrid');
const catalogSearch    = $id('catalogSearch');
const catalogSubject   = $id('catalogSubject');
const filterAvailable  = $id('filterAvailable');
const myReservations   = $id('myReservations');

// ─── Init ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  fetchStats();
  fetchBooks();
  setupEventListeners();
  // Poll notifications every 15 seconds when profile is set
  setInterval(() => { fetchNotifications(); fetchReservations(); }, 15000);
});

// ─── Profile ────────────────────────────────────────────────────────────────────
function loadProfile() {
  if (state.profile.name)  $id('studentName').value  = state.profile.name;
  if (state.profile.id)    $id('studentId').value    = state.profile.id;
  if (state.profile.major) $id('studentMajor').value = state.profile.major;
  if (state.profile.year)  $id('studentYear').value  = state.profile.year;
  if (state.profile.id) { fetchReservations(); fetchNotifications(); }
}

$id('saveProfile').addEventListener('click', async () => {
  const profile = {
    name:  $id('studentName').value.trim(),
    id:    $id('studentId').value.trim(),
    major: $id('studentMajor').value.trim(),
    year:  $id('studentYear').value,
  };
  if (!profile.name || !profile.id) {
    showToast('Please enter your name and student ID.', 'error');
    return;
  }
  state.profile = profile;
  localStorage.setItem('student_profile', JSON.stringify(profile));

  try {
    await fetch(`${API_BASE}/api/session/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, studentProfile: profile })
    });
    showToast(`Profile saved for ${profile.name}!`, 'success');
    fetchReservations();
  } catch {
    showToast('Profile saved locally.', 'success');
  }
});

// ─── Stats ──────────────────────────────────────────────────────────────────────
async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/library/stats`);
    const stats = await res.json();
    $id('statTitles').textContent   = stats.uniqueTitles;
    $id('statAvail').textContent    = stats.availableBooks;
    $id('statOut').textContent      = stats.checkedOut;
    $id('statSubjects').textContent = stats.subjects;
  } catch { /* silent */ }
}

// ─── Books / Catalog ────────────────────────────────────────────────────────────
async function fetchBooks(query = '', subject = '', availableOnly = false) {
  try {
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    if (subject) params.set('subject', subject);
    if (availableOnly) params.set('available', 'true');
    const res = await fetch(`${API_BASE}/api/library/books?${params}`);
    state.books = await res.json();
    renderCatalog(state.books);
    populateSubjectFilter(state.books);
  } catch { showToast('Could not load catalog.', 'error'); }
}

function populateSubjectFilter(books) {
  const subjects = [...new Set(books.map(b => b.subject))].sort();
  const current = catalogSubject.value;
  // Only repopulate if changed
  if (catalogSubject.children.length - 1 === subjects.length) return;
  catalogSubject.innerHTML = '<option value="">All Subjects</option>';
  subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    if (s === current) opt.selected = true;
    catalogSubject.appendChild(opt);
  });
}

function renderCatalog(books) {
  if (!books.length) {
    catalogGrid.innerHTML = '<div style="color:var(--muted);grid-column:1/-1;text-align:center;padding:40px;">No books found.</div>';
    return;
  }
  catalogGrid.innerHTML = books.map(book => {
    const availColor = book.available > 1 ? 'avail-green' : book.available === 1 ? 'avail-yellow' : 'avail-red';
    const availText  = book.available > 0 ? `${book.available}/${book.total} available` : 'Checked out';
    const demandClass = 'demand-' + book.demand.replace(' ', '-');
    const btnClass = book.available > 0 ? 'reserve-btn' : 'reserve-btn waitlist-btn';
    const btnText  = book.available > 0 ? 'Reserve' : 'Waitlist';
    const topics   = book.topic.slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('');
    return `
      <div class="book-card">
        <div class="book-card-header">
          <div>
            <div class="book-title">${escHtml(book.title)}</div>
            <div class="book-author">${escHtml(book.author)}</div>
          </div>
          <span class="book-id">${book.id}</span>
        </div>
        <div class="book-description">${escHtml(book.description)}</div>
        <div class="book-meta">${topics}<span class="tag">${escHtml(book.subject)}</span></div>
        <div class="book-footer">
          <div>
            <div class="availability"><span class="avail-dot ${availColor}"></span>${availText}</div>
            <div class="location">📍 ${escHtml(book.location)} · Ed. ${escHtml(book.edition)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
            <span class="demand-badge ${demandClass}">${book.demand} demand</span>
            <button class="${btnClass}" onclick="openReserveModal('${book.id}')">${btnText}</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── Reservation Modal ──────────────────────────────────────────────────────────
function openReserveModal(bookId) {
  const book = state.books.find(b => b.id === bookId);
  if (!book) return;
  state.pendingReserveBookId = bookId;

  $id('modalBookTitle').textContent = book.title;
  const action = book.available > 0 ? 'Reserve' : 'Join Waitlist for';
  $id('modalBody').innerHTML = `
    <p>${action}: <strong>${escHtml(book.title)}</strong></p>
    <p style="color:var(--muted);font-size:13px;margin-top:6px;">by ${escHtml(book.author)}</p>
    <p style="margin-top:12px;font-size:13px;">
      <strong>Availability:</strong> ${book.available}/${book.total} copies<br>
      <strong>Location:</strong> ${escHtml(book.location)}<br>
      <strong>Demand:</strong> ${book.demand}
    </p>
    ${!state.profile.id ? '<p style="color:var(--yellow);margin-top:12px;font-size:13px;">⚠ Please set up your Student Profile in the sidebar first.</p>' : ''}
  `;
  $id('confirmReserve').textContent = book.available > 0 ? 'Reserve Book' : 'Join Waitlist';
  $id('reserveModal').style.display = 'flex';
}

function closeModal() {
  $id('reserveModal').style.display = 'none';
  state.pendingReserveBookId = null;
}

$id('confirmReserve').addEventListener('click', async () => {
  if (!state.profile.id) { showToast('Please set up your Student Profile first.', 'error'); return; }
  if (!state.pendingReserveBookId) return;
  try {
    const res = await fetch(`${API_BASE}/api/library/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId: state.pendingReserveBookId,
        studentId: state.profile.id,
        studentName: state.profile.name
      })
    });
    const result = await res.json();
    closeModal();
    showToast(result.message, result.success ? 'success' : 'error');
    if (result.success) {
      fetchBooks(catalogSearch.value, catalogSubject.value, filterAvailable.checked);
      fetchStats();
      fetchReservations();
    }
  } catch { showToast('Reservation failed. Please try again.', 'error'); }
});

// ─── My Reservations (sidebar) ──────────────────────────────────────────────────
async function fetchReservations() {
  if (!state.profile.id) return;
  try {
    const res = await fetch(`${API_BASE}/api/library/reservations/${state.profile.id}`);
    const reservations = await res.json();
    if (!reservations.length) {
      myReservations.innerHTML = '<div class="empty-state">No active reservations</div>';
    } else {
      myReservations.innerHTML = reservations.map(r => `
        <div class="reservation-item">
          <div class="book-name">${escHtml(r.bookTitle)}</div>
          <span class="res-status ${r.status === 'reserved' ? 'status-reserved' : 'status-waitlisted'}">
            ${r.status === 'reserved' ? '✓ Reserved' : '⏳ Waitlisted'}
          </span>
        </div>
      `).join('');
    }
    renderMyBooksGrid(reservations);
  } catch { /* silent */ }
}

// ─── My Books Grid (full view with Return button) ───────────────────────────────
function renderMyBooksGrid(reservations) {
  const grid = $id('myBooksGrid');
  if (!reservations.length) {
    grid.innerHTML = '<div class="empty-state" style="padding:40px;text-align:center;color:var(--muted);">You have no active reservations or waitlist entries.</div>';
    return;
  }
  grid.innerHTML = reservations.map(r => {
    const isReserved = r.status === 'reserved';
    const statusLabel = isReserved ? '✅ Reserved — ready to collect' : '⏳ On waitlist — will notify you';
    const statusClass = isReserved ? 'status-reserved-card' : 'status-waitlisted-card';
    return `
      <div class="mybook-card ${statusClass}">
        <div>
          <div class="mybook-title">${escHtml(r.bookTitle)}</div>
          <div class="mybook-author">${escHtml(r.bookAuthor)}</div>
        </div>
        <div class="res-status ${isReserved ? 'status-reserved' : 'status-waitlisted'}">${statusLabel}</div>
        ${r.location ? `<div class="mybook-location">📍 Shelf: ${escHtml(r.location)}</div>` : ''}
        <div class="mybook-meta">
          <span style="font-size:11px;color:var(--muted);">Since ${new Date(r.reservedAt).toLocaleDateString()}</span>
          ${isReserved
            ? `<button class="return-btn" onclick="returnBook('${r.bookId}')">↩ Return Book</button>`
            : `<span style="font-size:11px;color:var(--yellow);">You'll be notified when available</span>`
          }
        </div>
      </div>`;
  }).join('');
}

// ─── Return Book ────────────────────────────────────────────────────────────────
async function returnBook(bookId) {
  if (!state.profile.id) { showToast('Please set up your Student Profile first.', 'error'); return; }
  if (!confirm('Return this book?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/library/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, studentId: state.profile.id })
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message, 'success');
      if (result.waitlistFulfilled) {
        showToast(`📬 Waitlist notified: "${result.notifiedStudent}" has been informed the book is available!`, 'success');
      }
      fetchReservations();
      fetchStats();
      fetchBooks(catalogSearch.value, catalogSubject.value, filterAvailable.checked);
    } else {
      showToast(result.message, 'error');
    }
  } catch { showToast('Return failed. Please try again.', 'error'); }
}

// ─── Notifications ───────────────────────────────────────────────────────────────
async function fetchNotifications() {
  if (!state.profile.id) return;
  try {
    const res = await fetch(`${API_BASE}/api/notifications/${state.profile.id}`);
    const data = await res.json();

    // Update badge
    const badge = $id('notifBadge');
    if (data.unread > 0) {
      badge.textContent = data.unread;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    // Render list
    const list = $id('notifList');
    if (!data.notifications.length) {
      list.innerHTML = '<div class="empty-state">No notifications yet</div>';
      return;
    }
    list.innerHTML = data.notifications.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead()">
        <div>${escHtml(n.message)}</div>
        <div class="notif-time">${new Date(n.at).toLocaleString()}</div>
      </div>
    `).join('');
  } catch { /* silent */ }
}

async function markNotifRead() {
  if (!state.profile.id) return;
  await fetch(`${API_BASE}/api/notifications/${state.profile.id}/read`, { method: 'POST' });
  fetchNotifications();
}

// ─── Chat ───────────────────────────────────────────────────────────────────────
function setupEventListeners() {
  // Send on Enter (Shift+Enter = newline)
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  sendBtn.addEventListener('click', sendMessage);

  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  // Quick suggestion buttons
  document.querySelectorAll('.suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      chatInput.value = btn.dataset.q;
      sendMessage();
    });
  });

  // Catalog search
  let searchTimer;
  catalogSearch.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => fetchBooks(catalogSearch.value, catalogSubject.value, filterAvailable.checked), 300);
  });
  catalogSubject.addEventListener('change', () => fetchBooks(catalogSearch.value, catalogSubject.value, filterAvailable.checked));
  filterAvailable.addEventListener('change', () => fetchBooks(catalogSearch.value, catalogSubject.value, filterAvailable.checked));

  // Sidebar toggle
  $id('sidebarToggle').addEventListener('click', () => $id('sidebar').classList.toggle('collapsed'));
  $id('navToggle').addEventListener('click', () => $id('sidebar').classList.toggle('collapsed'));

  // Close modal on overlay click
  $id('reserveModal').addEventListener('click', e => { if (e.target === $id('reserveModal')) closeModal(); });
}

async function sendMessage() {
  const msg = chatInput.value.trim();
  if (!msg) return;

  appendMessage(msg, 'user');
  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;
  typingIndicator.style.display = 'flex';
  scrollToBottom();

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        sessionId: state.sessionId,
        studentProfile: state.profile.id ? state.profile : undefined
      })
    });
    const data = await res.json();

    typingIndicator.style.display = 'none';

    if (!res.ok) {
      appendMessage(`⚠ ${data.error}`, 'bot', 'error');
    } else {
      appendMessage(data.reply, 'bot', null, data.action, data.tokens_used);
      updateTokenCounter(data.tokens_used);
      if (data.action?.success) {
        fetchStats();
        fetchReservations();
        fetchBooks(catalogSearch.value, catalogSubject.value, filterAvailable.checked);
      }
    }
  } catch (err) {
    typingIndicator.style.display = 'none';
    appendMessage('⚠ Could not reach the server. Is the backend running?', 'bot', 'error');
  }

  sendBtn.disabled = false;
  scrollToBottom();
}

function appendMessage(text, role, type = null, action = null, tokens = null) {
  const div = document.createElement('div');
  div.className = `message ${role === 'user' ? 'user-message' : 'bot-message'}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? '🎓' : '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  // Convert simple markdown
  const html = formatMessageText(text, type);
  bubble.innerHTML = html;

  // Show action result
  if (action) {
    const actionDiv = document.createElement('div');
    const cls = action.success
      ? (action.status === 'waitlisted' ? 'action-card action-info' : 'action-card action-success')
      : 'action-card action-error';
    actionDiv.className = cls;
    actionDiv.textContent = action.message;
    bubble.appendChild(actionDiv);
  }

  // Token badge — only on bot messages
  if (role === 'bot' && tokens) {
    const tokenBadge = document.createElement('div');
    tokenBadge.className = 'token-badge';
    tokenBadge.innerHTML = `⚡ <span>${tokens} tokens</span> · IBM Granite`;
    bubble.appendChild(tokenBadge);
  }

  div.appendChild(avatar);
  div.appendChild(bubble);
  chatMessages.appendChild(div);
  scrollToBottom();
}

function formatMessageText(text, type) {
  if (type === 'error') return `<p style="color:var(--red)">${escHtml(text)}</p>`;

  // Escape HTML first, then apply simple markdown
  let html = escHtml(text);
  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Book IDs: [CS001]
  html = html.replace(/\[([A-Z]{2}\d{3})\]/g, '<code>[$1]</code>');
  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  // Bullet lists
  html = html.replace(/^• (.+)/gm, '<li>$1</li>');
  html = html.replace(/^- (.+)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  return `<p>${html}</p>`;
}

function scrollToBottom() {
  setTimeout(() => chatMessages.scrollTop = chatMessages.scrollHeight, 50);
}

// ─── Tab Switching ───────────────────────────────────────────────────────────────
function switchTab(tab) {
  $id('viewChat').classList.toggle('hidden', tab !== 'chat');
  $id('viewCatalog').classList.toggle('hidden', tab !== 'catalog');
  $id('viewMyBooks').classList.toggle('hidden', tab !== 'mybooks');
  $id('tabChat').classList.toggle('active', tab === 'chat');
  $id('tabCatalog').classList.toggle('active', tab === 'catalog');
  $id('tabMyBooks').classList.toggle('active', tab === 'mybooks');
  if (tab === 'mybooks') { fetchReservations(); fetchNotifications(); }
}

// ─── Toast ───────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const toast = $id('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ─── Utils ───────────────────────────────────────────────────────────────────────
function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
}
