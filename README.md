# 📚 Library AI Agent — IBM Granite

An intelligent Library AI Agent powered by **IBM Granite 4** via **IBM watsonx.ai** that helps students discover, search, and reserve library resources using natural language.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd library-ai-agent/backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Edit `.env` and set your IBM API key:
```
IBM_API_KEY=your_actual_ibm_api_key_here
```
> All other values are pre-configured for the project.

### 3. Start the Server
```bash
npm start
```
Open **http://localhost:3001** in your browser.

---

## 🏗️ Architecture

```
library-ai-agent/
├── backend/
│   ├── server.js           # Express REST API + static file serving
│   ├── watsonxService.js   # IBM Granite integration (IAM + text generation)
│   ├── libraryDatabase.js  # In-memory book catalog + reservation engine
│   ├── package.json
│   └── .env.example
└── frontend/
    └── public/
        ├── index.html      # Single-page application shell
        ├── style.css       # Dark-theme responsive UI
        └── app.js          # Frontend logic & API calls
```

---

## 🤖 IBM Granite Configuration

| Setting | Value |
|---------|-------|
| Model | `ibm/granite-4-h-small` |
| Project ID | `8b921f38-6abe-4b29-8629-c98d6e14555e` |
| Endpoint | `https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29` |
| Auth | IBM IAM API Key → Bearer Token |

---

## 🔌 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Service health check |
| `GET` | `/api/library/stats` | Library statistics |
| `GET` | `/api/library/books` | List/search books (`?search=`, `?subject=`, `?available=true`) |
| `GET` | `/api/library/books/:id` | Single book details |
| `POST` | `/api/library/reserve` | Reserve a book or join waitlist |
| `DELETE` | `/api/library/reserve` | Cancel a reservation |
| `GET` | `/api/library/reservations/:studentId` | Student's reservations |
| `POST` | `/api/chat` | Chat with IBM Granite AI agent |
| `POST` | `/api/session/profile` | Update student profile |
| `DELETE` | `/api/session/:sessionId` | Clear session |

---

## 🎯 Features

- **AI Chat**: Natural language queries to IBM Granite for book recommendations
- **Book Catalog**: 20+ books across CS, Maths, Data Science, Physics, Biology, Business
- **Real-time Availability**: Live availability tracking (available/checked-out)
- **Reservations**: Reserve books or join automatic waitlists
- **Student Profiles**: Personalized recommendations by major and year
- **Quick Suggestions**: One-click topic queries
- **Session Memory**: Maintains conversation history per session

---

## 🔑 Getting an IBM API Key

1. Create a free account at [cloud.ibm.com](https://cloud.ibm.com)
2. Go to **Manage → Access (IAM) → API keys**
3. Click **Create an IBM Cloud API key**
4. Copy the key and paste it into the sidebar or `.env`
