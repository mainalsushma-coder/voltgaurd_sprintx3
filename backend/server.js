const fs = require("fs");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// MongoDB Connection
mongoose.connect("mongodb://localhost:27017/voltage_guard", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
    console.log("✅ Connected to MongoDB");
});

// Database Schemas
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ["student", "technician", "admin"], default: "student" },
    phone: String,
    location: {
        building: String,
        floor: String,
        room: String
    },
    createdAt: { type: Date, default: Date.now }
});

const incidentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { type: String, enum: ["electricity", "water", "internet", "hostel", "other"], required: true },
    subcategory: { type: String, enum: ["voltage_fluctuation", "microblackout", "complete_blackout", "flickering", "equipment_failure", "other"], default: "voltage_fluctuation" },
    description: { type: String, required: true },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    status: { type: String, enum: ["new", "assigned", "in_progress", "resolved"], default: "new" },
    
    // Voltage-specific fields
    voltage_readings: {
        reported_voltage: Number,
        normal_voltage: { type: Number, default: 230 },
        duration_minutes: Number,
        frequency: { type: String, enum: ["momentary", "intermittent", "constant"] }
    },
    symptoms: [String],
    affected_devices: [String],
    
    // Image upload support
    images: [String],
    
    location: {
        building: { type: String, required: true },
        floor: String,
        room: String,
        gps: {
            lat: Number,
            lng: Number
        }
    },
    
    equipment: {
        type: String,
        enum: ["transformer", "generator", "ups", "switchboard", "wiring", "other"]
    },
    
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    resolvedAt: Date
});

// Analytics Schema for historical data
const analyticsSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    total_incidents: Number,
    critical_incidents: Number,
    resolved_incidents: Number,
    avg_resolution_time: Number,
    building_stats: Object,
    category_stats: Object,
    predictions_generated: Number
});

// Create Models
const User = mongoose.model("User", userSchema);
const Incident = mongoose.model("Incident", incidentSchema);
const Analytics = mongoose.model("Analytics", analyticsSchema);

// ==================== DUPLICATE DETECTION ====================

// Smart duplicate detection
const detectSimilarIncidents = async (newIncident) => {
  const recentIncidents = await Incident.find({
    'location.building': newIncident.location.building,
    createdAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } // Last 2 hours
  });

  for (let incident of recentIncidents) {
    const titleSimilarity = calculateSimilarity(newIncident.title, incident.title);
    const descSimilarity = calculateSimilarity(newIncident.description, incident.description);
    
    if (titleSimilarity > 0.7 || descSimilarity > 0.6) {
      return incident; // Similar incident found
    }
  }
  return null;
};

// Simple similarity function (Levenshtein-like)
const calculateSimilarity = (str1, str2) => {
  const words1 = str1.toLowerCase().split(' ');
  const words2 = str2.toLowerCase().split(' ');
  
  const commonWords = words1.filter(word => 
    words2.some(w2 => w2.includes(word) || word.includes(w2))
  );
  
  return commonWords.length / Math.max(words1.length, words2.length);
};

// ==================== RATE LIMITING ====================

// Rate limiting for incident reporting
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each user to 5 reports per windowMs
  message: {
    error: 'Too many incident reports from this user, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==================== ENHANCED PREDICTION ENGINE ====================

// Enhanced Prediction Engine with Confidence Scoring
const predictVoltageIssues = (incidents) => {
  const predictions = [];
  
  // Group incidents by building
  const buildingData = {};
  incidents.forEach(incident => {
    const building = incident.location.building;
    if (!buildingData[building]) {
      buildingData[building] = [];
    }
    buildingData[building].push(incident);
  });

  // Analyze each building
  for (const [building, buildingIncidents] of Object.entries(buildingData)) {
    const criticalCount = buildingIncidents.filter(inc => inc.severity === 'critical').length;
    const totalCount = buildingIncidents.length;
    const recentIncidents = buildingIncidents.filter(inc => 
      new Date(inc.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    // Equipment-specific analysis
    const equipmentCounts = {};
    buildingIncidents.forEach(inc => {
      if (inc.equipment) {
        equipmentCounts[inc.equipment] = (equipmentCounts[inc.equipment] || 0) + 1;
      }
    });

    // Calculate confidence score (0-100)
    let confidence = 0;
    let reason = "";
    
    // Multi-factor confidence calculation
    if (criticalCount >= 2 && recentIncidents >= 3) {
      confidence = Math.min(30 + (criticalCount * 15) + (recentIncidents * 5), 95);
      reason = `Multiple critical incidents (${criticalCount}) with high frequency (${recentIncidents} in 7 days)`;
      
      predictions.push({
        location: { building },
        predicted_issue: "High probability of voltage transformer failure",
        probability: 85,
        confidence: confidence,
        reason: reason,
        predicted_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        urgency: confidence > 80 ? "critical" : "high",
        equipment: "transformer",
        evidence: {
          critical_incidents: criticalCount,
          total_recent: recentIncidents,
          data_quality: buildingIncidents.length >= 5 ? "high" : "medium"
        }
      });
    }
    
    // High frequency prediction
    if (recentIncidents >= 5) {
      const freqConfidence = Math.min(25 + (recentIncidents * 8), 85);
      predictions.push({
        location: { building },
        predicted_issue: "Likely voltage fluctuation pattern",
        probability: 70,
        confidence: freqConfidence,
        reason: `High incident frequency (${recentIncidents} incidents in 7 days)`,
        predicted_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        urgency: freqConfidence > 70 ? "high" : "medium",
        evidence: {
          recent_incidents: recentIncidents,
          data_quality: buildingIncidents.length >= 3 ? "medium" : "low"
        }
      });
    }

    // Evening peak hours prediction
    const eveningIncidents = buildingIncidents.filter(inc => {
      const hour = new Date(inc.createdAt).getHours();
      return hour >= 18 && hour <= 22;
    }).length;

    if (eveningIncidents >= 3) {
      const eveningConfidence = Math.min(20 + (eveningIncidents * 12), 80);
      predictions.push({
        location: { building },
        predicted_issue: "Evening peak load voltage drops",
        probability: 75,
        confidence: eveningConfidence,
        reason: `Consistent evening incidents (${eveningIncidents} occurrences)`,
        predicted_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        predicted_time: "18:00-22:00",
        urgency: "medium",
        evidence: {
          evening_incidents: eveningIncidents,
          pattern_consistency: "high"
        }
      });
    }

    // Equipment-specific predictions
    for (const [equipment, count] of Object.entries(equipmentCounts)) {
      if (count >= 2) {
        const equipmentConfidence = Math.min(40 + (count * 20), 90);
        predictions.push({
          location: { building },
          predicted_issue: `Potential ${equipment} maintenance needed`,
          probability: 65,
          confidence: equipmentConfidence,
          reason: `${count} incidents related to ${equipment}`,
          predicted_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          urgency: count >= 3 ? "high" : "medium",
          equipment: equipment,
          evidence: {
            equipment_incidents: count,
            maintenance_required: true
          }
        });
      }
    }
  }

  // Sort by confidence (highest first)
  return predictions.sort((a, b) => b.confidence - a.confidence);
};

// ==================== HISTORICAL TREND ANALYSIS ====================

const analyzeHistoricalTrends = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const incidents = await Incident.find({
    createdAt: { $gte: thirtyDaysAgo }
  });

  const trends = {
    daily_incidents: {},
    weekly_patterns: {},
    building_trends: {},
    severity_trends: {},
    seasonal_patterns: {}
  };

  // Daily incident counts
  incidents.forEach(incident => {
    const date = incident.createdAt.toISOString().split('T')[0];
    trends.daily_incidents[date] = (trends.daily_incidents[date] || 0) + 1;
  });

  // Weekly patterns (day of week)
  incidents.forEach(incident => {
    const dayOfWeek = incident.createdAt.getDay();
    trends.weekly_patterns[dayOfWeek] = (trends.weekly_patterns[dayOfWeek] || 0) + 1;
  });

  // Building trends
  incidents.forEach(incident => {
    const building = incident.location.building;
    trends.building_trends[building] = (trends.building_trends[building] || 0) + 1;
  });

  // Severity trends
  incidents.forEach(incident => {
    trends.severity_trends[incident.severity] = (trends.severity_trends[incident.severity] || 0) + 1;
  });

  return trends;
};

// ==================== TECHNICIAN MANAGEMENT ====================

// Technician availability and reassignment system
const technicians = [
  { id: 1, name: "Rajesh Kumar", skills: ["electrical", "emergency"], available: true, currentTasks: [], performance: { resolved: 45, avgTime: 2.1 } },
  { id: 2, name: "Priya Sharma", skills: ["electrical", "maintenance"], available: true, currentTasks: [], performance: { resolved: 38, avgTime: 1.8 } },
  { id: 3, name: "Ankit Patel", skills: ["emergency", "critical"], available: true, currentTasks: [], performance: { resolved: 52, avgTime: 2.4 } }
];

// Smart technician assignment
const assignTechnician = (incident) => {
  const suitableTechs = technicians.filter(tech => 
    tech.available && 
    tech.skills.some(skill => 
      incident.severity === 'critical' ? skill === 'emergency' || skill === 'critical' : true
    )
  );

  if (suitableTechs.length === 0) {
    // No available technicians - implement escalation
    return {
      assigned: false,
      message: "No technicians available. Escalating to senior team...",
      escalation: true
    };
  }

  // Assign to technician with least current tasks
  const assignedTech = suitableTechs.sort((a, b) => 
    a.currentTasks.length - b.currentTasks.length
  )[0];

  assignedTech.currentTasks.push(incident._id);
  
  return {
    assigned: true,
    technician: assignedTech,
    message: `Assigned to ${assignedTech.name}`
  };
};

// ==================== ROUTES ====================

app.get("/", (req, res) => {
    res.send(`
        <h1>⚡ VoltageGuard Backend API</h1>
        <p>MongoDB Connected: ${db.readyState === 1 ? '✅' : '❌'}</p>
        <ul>
            <li>GET <a href="/api/incidents">/api/incidents</a> - Get all incidents</li>
            <li>POST /api/incidents - Create incident</li>
            <li>GET <a href="/api/predictions">/api/predictions</a> - Get AI predictions</li>
            <li>GET <a href="/api/technicians">/api/technicians</a> - Get technicians</li>
            <li>GET <a href="/api/heatmap">/api/heatmap</a> - Get heatmap data</li>
            <li>GET <a href="/api/analytics/trends">/api/analytics/trends</a> - Get historical trends</li>
        </ul>
    `);
});

// Incident Routes with duplicate detection and rate limiting
app.post("/api/incidents", reportLimiter, upload.array('images', 3), async (req, res) => {
    try {
        const imagePaths = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

        const incidentData = {
            ...req.body,
            images: imagePaths
        };

        // Check for similar incidents unless forceSubmit is true
        if (!req.body.forceSubmit) {
            const similarIncident = await detectSimilarIncidents(req.body);
            if (similarIncident) {
                return res.status(409).json({
                    error: 'Similar incident already reported',
                    similarIncident: {
                        id: similarIncident._id,
                        title: similarIncident.title,
                        status: similarIncident.status
                    }
                });
            }
        }

        const incident = new Incident(incidentData);
        await incident.save();
        console.log("📝 New incident reported:", incident.title);
        
        // Auto-assign technician for critical incidents
        if (incident.severity === 'critical') {
            const assignment = assignTechnician(incident);
            if (assignment.assigned) {
                incident.assignedTo = assignment.technician.id;
                incident.status = 'assigned';
                await incident.save();
                console.log(`👨‍🔧 Auto-assigned to: ${assignment.technician.name}`);
            }
        }
        
        res.status(201).json(incident);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get("/api/incidents", async (req, res) => {
    try {
        const incidents = await Incident.find().sort({ createdAt: -1 });
        res.json(incidents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update incident status
app.put("/api/incidents/:id", async (req, res) => {
    try {
        const incident = await Incident.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status, updatedAt: new Date() },
            { new: true }
        );
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }
        res.json(incident);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Prediction API Endpoint
app.get("/api/predictions", async (req, res) => {
    try {
        const incidents = await Incident.find();
        const predictions = predictVoltageIssues(incidents);
        res.json(predictions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Heatmap Data Endpoint
app.get("/api/heatmap", async (req, res) => {
    try {
        const incidents = await Incident.find();
        const heatmapData = {};
        
        const buildingCoordinates = {
            'Hostel A': { lat: 28.6129, lng: 77.2295 },
            'Hostel B': { lat: 28.6130, lng: 77.2300 },
            'Academic Block': { lat: 28.6128, lng: 77.2290 },
            'Lab Complex': { lat: 28.6132, lng: 77.2292 },
            'Library': { lat: 28.6127, lng: 77.2298 },
            'Admin Block': { lat: 28.6131, lng: 77.2293 }
        };

        incidents.forEach(incident => {
            const building = incident.location.building;
            if (!heatmapData[building]) {
                heatmapData[building] = {
                    total: 0,
                    critical: 0,
                    recent: 0,
                    coordinates: buildingCoordinates[building] || { lat: 28.6129, lng: 77.2295 }
                };
            }
            heatmapData[building].total++;
            if (incident.severity === 'critical') heatmapData[building].critical++;
            if (new Date(incident.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
                heatmapData[building].recent++;
            }
        });
        
        res.json(heatmapData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Historical Trends Endpoint
app.get("/api/analytics/trends", async (req, res) => {
    try {
        const trends = await analyzeHistoricalTrends();
        res.json(trends);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Complaint Aging Analysis
app.get("/api/analytics/aging", async (req, res) => {
    try {
        const incidents = await Incident.find();
        const aging = {
            '0-1 days': 0,
            '1-3 days': 0,
            '3-7 days': 0,
            '1-2 weeks': 0,
            '2+ weeks': 0
        };
        
        incidents.forEach(incident => {
            if (incident.status !== 'resolved') {
                const ageDays = (new Date() - new Date(incident.createdAt)) / (24 * 60 * 60 * 1000);
                if (ageDays <= 1) aging['0-1 days']++;
                else if (ageDays <= 3) aging['1-3 days']++;
                else if (ageDays <= 7) aging['3-7 days']++;
                else if (ageDays <= 14) aging['1-2 weeks']++;
                else aging['2+ weeks']++;
            }
        });
        
        res.json(aging);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Technician API Endpoints
app.get("/api/technicians", async (req, res) => {
    try {
        res.json(technicians);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put("/api/technicians/:id/availability", async (req, res) => {
    try {
        const tech = technicians.find(t => t.id === parseInt(req.params.id));
        if (!tech) {
            return res.status(404).json({ error: "Technician not found" });
        }
        
        tech.available = req.body.available;
        
        // If making unavailable, reassign their tasks
        if (!req.body.available && tech.currentTasks.length > 0) {
            tech.currentTasks.forEach(taskId => {
                console.log(`Reassigning task ${taskId} from ${tech.name}`);
                // In production, you'd actually reassign these tasks
            });
            tech.currentTasks = [];
        }
        
        res.json(tech);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`⚡ VoltageGuard Server running on port ${PORT}`);
    console.log(`📍 API: http://localhost:${PORT}`);
    console.log(`🔮 Predictions: http://localhost:${PORT}/api/predictions`);
    console.log(`🏢 Heatmap: http://localhost:${PORT}/api/heatmap`);
    console.log(`📊 Analytics: http://localhost:${PORT}/api/analytics/trends`);
});