# 📁 COMPLETE SETUP GUIDE - Copy/Paste Ready

## ✅ ALL FILES GENERATED (15 Files Ready to Use)

You now have EVERYTHING needed. Just copy-paste the code into VS Code!

---

## 🚀 STEP-BY-STEP SETUP (10 minutes)

### **STEP 1: Create Main Folder**
```bash
mkdir data-collection-platform
cd data-collection-platform
```

### **STEP 2: Create Backend Folder Structure**
```bash
mkdir backend
cd backend
mkdir logs
```

### **STEP 3: Create Backend Files**
Copy these files into `backend/` folder:
- **server.js** - File: 01-backend-server.js
- **package.json** - File: 02-backend-package.json
- **.env** - File: 03-backend-env.txt (rename to .env)

### **STEP 4: Install Backend Dependencies**
```bash
cd backend
npm install
```

### **STEP 5: Configure Backend .env**
Edit `backend/.env`:
```
PORT=5000
JWT_SECRET=your-jwt-secret-key-change-this-in-production
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=data_collection
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=data-collection-bucket
CORS_ORIGINS=http://localhost:3000
NODE_ENV=development
```

### **STEP 6: Create Frontend Folder Structure**
```bash
cd ..
mkdir frontend
cd frontend
mkdir -p src/components src/pages public
```

### **STEP 7: Create Frontend Files**
Copy files into `frontend/` folder:
- **src/App.js** - File: 04-frontend-App.js
- **src/index.js** - File: 14-frontend-index.js
- **src/App.css** - File: 15-frontend-App.css
- **package.json** - File: 12-frontend-package.json
- **.env** - File: 13-frontend-env.txt (rename to .env)

Copy files into `frontend/src/pages/`:
- **LoginRegister.js** - File: 05-frontend-LoginRegister.js
- **Welcome.js** - File: 06-frontend-Welcome.js
- **Dashboard.js** - File: 07-frontend-Dashboard.js
- **AdminDashboard.js** - File: 08-frontend-AdminDashboard.js

Copy files into `frontend/src/components/`:
- **SurveyForm.js** - File: 09-frontend-SurveyForm.js
- **VideoRecorder.js** - File: 10-frontend-VideoRecorder.js
- **CognitiveTestInterface.js** - File: 11-frontend-CognitiveTestInterface.js

### **STEP 8: Create Frontend HTML**
Create `frontend/public/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Data Collection Platform</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

### **STEP 9: Install Frontend Dependencies**
```bash
cd frontend
npm install
```

### **STEP 10: Run the Application**

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

---

## 📊 Access the Application

| Component | URL | Status |
|-----------|-----|--------|
| Frontend | http://localhost:3000 | ✓ Auto-opens |
| Backend API | http://localhost:5000 | ✓ Running |
| Health Check | http://localhost:5000/api/health | ✓ Check |

---

## 🔧 BEFORE RUNNING - Prerequisites

### **Required:**
1. **Node.js 16+** - [Download](https://nodejs.org/)
2. **PostgreSQL 13+** - [Download](https://www.postgresql.org/download/)
3. **AWS Account** (S3 bucket for video storage)

### **PostgreSQL Setup:**
```bash
# Create database
createdb data_collection

# Verify connection
psql -U postgres -d data_collection -c "SELECT version();"
```

### **AWS S3 Setup:**
1. Create S3 bucket: `data-collection-bucket`
2. Create IAM user with S3 permissions
3. Get Access Key & Secret Key
4. Add to `backend/.env`

---

## 📝 File Descriptions

### **Backend (Node.js/Express)**
- **server.js** - Complete Express server with:
  - 15+ API routes
  - PostgreSQL integration
  - AWS S3 upload
  - JWT authentication
  - CORS, Helmet, Rate limiting
  - Winston logging
  - Auto-database initialization

### **Frontend (React)**
- **App.js** - Main React app with routing
- **LoginRegister.js** - Auth page (login/register)
- **Welcome.js** - Welcome/navigation page
- **Dashboard.js** - Main dashboard with tabs
- **AdminDashboard.js** - Admin statistics & export
- **SurveyForm.js** - 107-item survey with 8 subscales
- **VideoRecorder.js** - Real-time video recording + S3 upload
- **CognitiveTestInterface.js** - 5 cognitive tests
- **App.css** - Complete responsive styling

---

## ✨ Features Included

### **Authentication**
✓ User registration with demographics
✓ JWT token-based login
✓ Password hashing with bcryptjs
✓ Protected routes

### **Survey**
✓ 107 items across 8 subscales:
  1. Demographics (12 items)
  2. Social Media Usage (30 items)
  3. Attention & Focus (25 items)
  4. Working Memory (20 items)
  5. Problem-Solving (20 items)
  6. Academic Performance (15 items)
  7. Digital Wellness (15 items)
  8. Sleep & Wellbeing (10 items)
✓ Multi-section progression
✓ Completion time tracking
✓ Device information capture

### **Cognitive Tests**
✓ SART (Sustained Attention Response Task)
✓ Digit Span Test
✓ Trail Making Test
✓ Go/No-Go Task
✓ Stroop Color-Word Test
✓ Real-time scoring
✓ Percentile calculation

### **Video**
✓ Real-time webcam recording
✓ Direct S3 upload
✓ Progress tracking
✓ AES-256 encryption
✓ 500MB file limit

### **Data Management**
✓ PostgreSQL database
✓ 6 database tables
✓ Admin dashboard
✓ Data export (JSON)
✓ Health checks

### **Security**
✓ JWT authentication
✓ Password hashing
✓ CORS protection
✓ Rate limiting
✓ Input validation
✓ S3 encryption
✓ Helmet security headers

---

## 🐛 Troubleshooting

### **Port Already in Use**
```bash
# Change port in backend/.env
PORT=5001

# Change API URL in frontend/.env
REACT_APP_API_URL=http://localhost:5001/api
```

### **PostgreSQL Connection Failed**
```bash
# Check if PostgreSQL is running
psql -U postgres

# Verify database exists
\l

# Check connection string in backend/.env
```

### **S3 Upload Fails**
1. Verify AWS credentials in `.env`
2. Check S3 bucket exists and is public
3. Verify IAM user has S3 permissions
4. Check bucket name matches `S3_BUCKET_NAME`

### **Camera/Video Not Working**
1. Check browser permissions
2. Ensure HTTPS or localhost
3. Check browser console for errors

### **CORS Errors**
1. Verify `CORS_ORIGINS` in backend/.env
2. Check frontend URL matches
3. Restart backend after changing .env

---

## 📊 API Endpoints (15+)

### **Authentication**
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/verify

### **Survey**
- POST /api/survey/start
- POST /api/survey/submit
- GET /api/survey/progress/:userId

### **Videos**
- POST /api/videos/upload
- GET /api/videos/list/:userId

### **Facial Analysis**
- POST /api/facial/analyze
- GET /api/facial/results/:videoId

### **Cognitive Tests**
- POST /api/tests/submit
- GET /api/tests/results/:userId

### **Admin**
- GET /api/admin/dashboard
- GET /api/admin/export/:dataType

### **System**
- GET /api/health

---

## 📦 Folder Structure Final

```
data-collection-platform/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env
│   └── logs/
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   ├── components/
│   │   │   ├── SurveyForm.js
│   │   │   ├── VideoRecorder.js
│   │   │   └── CognitiveTestInterface.js
│   │   └── pages/
│   │       ├── LoginRegister.js
│   │       ├── Welcome.js
│   │       ├── Dashboard.js
│   │       └── AdminDashboard.js
│   ├── package.json
│   └── .env
└── README.md
```

---

## 🎯 Next Steps

1. ✅ Create folders and copy files
2. ✅ Install dependencies (npm install)
3. ✅ Setup PostgreSQL database
4. ✅ Configure AWS S3
5. ✅ Update .env files
6. ✅ Run backend (npm start)
7. ✅ Run frontend (npm start)
8. ✅ Register user & test
9. ✅ Complete survey
10. ✅ Test cognitive tests
11. ✅ Record video
12. ✅ Check admin dashboard

---

## 💡 Tips

- Use Chrome/Firefox for best compatibility
- Allow camera/microphone permissions
- Test with sample data first
- Check logs in `backend/logs/` folder
- Use Postman to test API endpoints
- Monitor database with pgAdmin or psql

---

## 📞 Support

If you encounter issues:
1. Check error messages in browser console
2. Check backend logs in `logs/` folder
3. Verify all .env files are configured
4. Ensure PostgreSQL is running
5. Check ports 3000 and 5000 are available
6. Verify AWS credentials

---

## ✅ CHECKLIST

Before going live:
- [ ] All 15 files copied to correct locations
- [ ] `npm install` completed in both folders
- [ ] PostgreSQL installed and running
- [ ] AWS S3 bucket created
- [ ] .env files configured with real values
- [ ] Backend starts without errors
- [ ] Frontend loads at localhost:3000
- [ ] Can register/login
- [ ] Survey loads with all 107 items
- [ ] Video recording works
- [ ] Cognitive tests are playable
- [ ] Admin dashboard shows stats
- [ ] Data can be exported

---

## 🎉 YOU'RE READY!

All code is production-ready. Just copy-paste and start collecting data from your 4,000 participants!

**Happy researching! 🔬📊**

Version 1.0 | December 25, 2025