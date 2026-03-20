# ARchive 🏛️

> **Web-based AR and ML system for interactive museum engagement at the DLSU-D AEA-IRC Presidents' Memorabilia Gallery.**

A web-based intelligent Augmented Reality system that transforms the static memorabilia gallery of the **Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC)** at De La Salle University-Dasmarinas (DLSU-D) into an immersive, interactive digital experience.

Visitors point their phone camera at a physical artifact in the gallery. ARchive detects it in real-time using a YOLOv8 machine learning model, then overlays contextual historical information directly on top of the object — all through the mobile browser, with **no app download required**.

---

## ✨ Features

- 🔍 **Real-time artifact detection** — YOLOv8 object detection model trained on AEA-IRC memorabilia, running entirely in the browser via ONNX Runtime Web (WebAssembly)
- 📱 **Web-based AR overlays** — MindAR.js image tracking + Three.js rendering anchors historical info panels on physical artifacts
- 🕸️ **Knowledge graph** — D3.js force simulation visualizing relationships between artifacts, presidents, and historical events
- 🔒 **Privacy-first** — no camera data ever leaves the visitor's device; all inference runs client-side
- 📡 **No installation required** — accessible via QR code on any modern mobile browser

---

## 🛠️ Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| ML Model | YOLOv8 (Ultralytics) + PyTorch | Transfer learning from COCO weights |
| Annotation | Label Studio | Offline, private, locally hosted |
| Augmentation | Albumentations | Applied post-annotation before training |
| Browser Inference | ONNX Runtime Web | WebAssembly — fully client-side |
| AR Tracking | MindAR.js | Image-target based |
| 3D Rendering | Three.js | AR overlay panels |
| Frontend | React + Vite + TailwindCSS | Deployed on Vercel |
| Backend | FastAPI (Python) | REST API, deployed on Render |
| Database | PostgreSQL via Supabase | Artifact content and relationships |
| Graph Viz | D3.js | Knowledge graph (no Neo4j required) |
| DevOps | Docker + GitHub Actions | Auto-deploy on push to main |

All tools used are **free and open-source**. No paid licenses required.

---

## 🗂️ Repository Structure

```
archive-dlsud/
├── frontend/                  # React + Vite web app (Person 2)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ARCamera.jsx
│   │   │   ├── ArtifactPanel.jsx
│   │   │   └── KnowledgeGraph.jsx
│   │   ├── hooks/
│   │   │   ├── useONNX.js
│   │   │   └── useMindAR.js
│   │   └── assets/
│   │       ├── models/        # best.onnx + classes.txt
│   │       └── markers/       # MindAR .mind files
│   └── package.json
│
├── backend/                   # FastAPI REST API (Person 3)
│   ├── main.py
│   ├── models.py
│   ├── schemas.py
│   ├── database.py
│   ├── routers/
│   │   └── artifacts.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── ml/                        # ML pipeline (Person 1)
│   ├── scripts/
│   │   ├── augment.py
│   │   ├── train.py
│   │   └── export_onnx.py
│   └── weights/
│       ├── best.onnx          # exported inference model
│       └── classes.txt
│
├── .github/
│   └── workflows/
│       └── deploy.yml         # auto-deploy on push to main
├── .gitignore
└── README.md
```

> ⚠️ The `dataset/` folder (training images) is listed in `.gitignore` and is **never committed to this repository**. Training photos are private institutional data owned by DLSU-D AEA-IRC.

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10 or 3.11
- Node.js 18+
- Git

### 1. Clone the repository

```bash
git clone git@github.com:your-username/archive-dlsud.git
cd archive-dlsud
```

### 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Set VITE_API_URL to your backend URL in .env.local
npm run dev
# Opens at http://localhost:5173
```

### 3. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Set DATABASE_URL and FRONTEND_URL in .env
uvicorn main:app --reload
# Opens at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### 4. ML training (Person 1 only)

```bash
cd ml
pip install ultralytics albumentations label-studio
# After annotation and augmentation:
yolo detect train model=yolov8n.pt data=dataset/data.yaml epochs=100 imgsz=640 batch=8 name=archive_v1
# Export to ONNX after training:
yolo export model=runs/detect/archive_v1/weights/best.pt format=onnx imgsz=640 opset=12
```

---

## 🌐 Deployment

| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | `https://archive-app.vercel.app` |
| Backend API | Render | `https://archive-api.onrender.com` |
| Database | Supabase | Managed PostgreSQL |

Deployment is automated via GitHub Actions — every push to `main` triggers a redeploy of both frontend and backend.

---

## 🔒 Privacy & Security

- **Training images** are never uploaded to any cloud service — annotation is performed locally using Label Studio
- **Camera data** from visitors never leaves their device — ONNX inference runs entirely in WebAssembly in the browser
- **Database credentials** are stored as environment variables and never committed to this repository
- **Visitor data** is not collected — the system requires no login and tracks no individual users

---

## 📊 ML Model Performance

| Metric | Value |
|---|---|
| Model | YOLOv8n (nano) |
| Training method | Transfer learning from COCO weights |
| Dataset | Custom AEA-IRC memorabilia images |
| mAP50 | _to be updated after training_ |
| Precision | _to be updated after training_ |
| Recall | _to be updated after training_ |

---

## 🌍 SDG Alignment

This project directly contributes to **SDG 11.4** — *Strengthen efforts to protect and safeguard the world's cultural and natural heritage* — by leveraging intelligent systems to make DLSU-D's institutional heritage accessible and engaging for a digitally-native student population.

---

## 👥 Team

| Role | Responsibility |
|---|---|
| Person 1 | ML pipeline — annotation, training, ONNX export |
| Person 2 | AR frontend — React app, MindAR.js, Three.js |
| Person 3 | Backend — FastAPI, PostgreSQL, D3.js, deployment |

**Institution:** De La Salle University-Dasmarinas (DLSU-D)
**Gallery:** Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC)

---

## 📄 License

This project is developed as an academic thesis at DLSU-D. All rights reserved. The trained model and annotated dataset are proprietary assets of DLSU-D AEA-IRC and may not be redistributed.
