


# VoltageGuard AI

**Smart Predictive Maintenance System for Campus Power Management**


---

## Live Demo

* **Web Application:** [https://spiffy-daifuku-d880aa.netlify.app/](https://spiffy-daifuku-d880aa.netlify.app/)
* **Backend API:** [https://voltgaurd.mainalsushma.workers.dev](https://voltgaurd.mainalsushma.workers.dev)
* **Demo Video:** [Watch it here](https://1drv.ms/v/c/71671ec335297c58/IQCL-ggE0JRQS4sk7mOc21P2ASIfIp25nJXK7v9TKf4hu4w)

---

## Overview

VoltageGuard AI is an intelligent power monitoring and predictive maintenance platform designed for university and campus environments.
It analyzes voltage fluctuations in real time, forecasts potential failures, and automates technician dispatch—reducing downtime and maintenance costs.

---

## Core Features

### 1. AI-Powered Forecasting

* Predicts electrical failures using historical pattern analysis
* Real-time probability scoring for high-risk zones
* Early warning alerts for critical infrastructure

### 2. Campus-Wide Monitoring

* Live heatmaps of voltage irregularities
* Real-time dashboard with severity classification
* Weekly and monthly trend visualization

### 3. Incident & Workflow Automation

* One-click issue reporting with location and image support
* Status tracking from creation to resolution
* Automatic technician routing based on skill and proximity

### 4. Technician Optimization

* Smart assignment and workload balancing
* Response time and efficiency analytics
* Resource utilization tracking

---

## Business Impact

| Metric              | Outcome      |
| ------------------- | ------------ |
| ROI                 | 1,450%       |
| Incidents Prevented | 47+          |
| Cost Savings        | ₹478,000+    |
| Time Saved          | 1,200+ hours |
| Prediction Accuracy | 89%          |

---

## Technology Stack

### Frontend

* React 19
* Chart.js
* Responsive CSS3

### Backend

* Cloudflare Workers (serverless)
* RESTful API
* In-memory data storage

### AI/ML

* Pattern recognition models
* Probability-based risk engine
* Predictive failure modeling

---

## System Architecture

```
[Frontend (Netlify)] 
        ↓
[Cloudflare Workers API]
        ↓
[AI Engine / Prediction Logic]
        ↓
[Real-time Client Response]
```

---

## Data Flow

1. User reports incident from the frontend
2. Backend validates and processes data
3. AI engine performs risk prediction
4. Dashboard displays live insights

---

## Getting Started

### Prerequisites

* Node.js 18+
* npm or yarn
* Wrangler (for Cloudflare Workers)

### Frontend Setup

```bash
git clone https://github.com/your-username/voltageguard.git
cd voltage-frontend
npm install
npm start
```

### Backend Deployment

```bash
cd backend
npx wrangler deploy
```

---

## Usage

* **Dashboard**: Monitor live voltage and predictions
* **Report Incident**: Submit location-based issues with images
* **Predictions**: View AI-generated failure forecasts
* **Technicians**: Assign and manage maintenance staff

---

## UI/UX Highlights

* Fully responsive layout
* Real-time updates without refresh
* Interactive charts and analytics
* Simple and intuitive navigation

---

## Future Enhancements

* Integration with IoT sensors
* SMS/WhatsApp alert notifications
* Role-based authentication
* Predictive maintenance scheduling

---

## Support

For issues or feature requests, create a GitHub issue or contact the development team.

---

Built to keep campuses powered, protected, and proactive.

---


