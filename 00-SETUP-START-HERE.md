# Data Collection Platform - Complete Setup

## 📁 FOLDER STRUCTURE

```
data-collection-platform/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env
│   └── logs/ (create this folder)
│
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   ├── components/
│   │   │   ├── SurveyForm.js
│   │   │   ├── VideoRecorder.js
│   │   │   └── CognitiveTestInterface.js
│   │   ├── pages/
│   │   │   ├── LoginRegister.js
│   │   │   ├── Dashboard.js
│   │   │   ├── AdminDashboard.js
│   │   │   └── Welcome.js
│   │   └── services/
│   │       └── api.js
│   ├── package.json
│   └── .env
│
├── .gitignore
├── README.md
└── SETUP-INSTRUCTIONS.md
```

## 🚀 QUICK START (5 Steps)

### Step 1: Create Main Folder
```bash
mkdir data-collection-platform
cd data-collection-platform
```

### Step 2: Create Backend
```bash
mkdir backend
cd backend
# Copy backend files from below
npm install
```

### Step 3: Create Frontend
```bash
cd ..
mkdir frontend
cd frontend
# Copy frontend files from below
npm install
```

### Step 4: Setup Environment Files
- Create .env in both backend and frontend (see templates below)

### Step 5: Run
```bash
# Terminal 1 (Backend)
cd backend
npm start

# Terminal 2 (Frontend)
cd frontend
npm start
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

---

## ✅ ALL CODE FILES BELOW

Copy each file into the corresponding folder in VS Code.

