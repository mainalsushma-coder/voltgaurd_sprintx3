const fs = require("fs");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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
    subcategory: { type: String, enum: ["voltage_fluctuation", "microblackout", "complete_blackout", "flickering", "other"], default: "voltage_fluctuation" },
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
    
    location: {
        building: { type: String, required: true },
        floor: String,
        room: String,
        gps: {
            lat: Number,
            lng: Number
        }
    },
    
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    resolvedAt: Date
});

// Create Models
const User = mongoose.model("User", userSchema);
const Incident = mongoose.model("Incident", incidentSchema);

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
  }

  // Sort by confidence (highest first)
  return predictions.sort((a, b) => b.confidence - a.confidence);
};

// ==================== TECHNICIAN MANAGEMENT ====================

// Technician availability and reassignment system
const technicians = [
  { id: 1, name: "Rajesh Kumar", skills: ["electrical", "emergency"], available: true, currentTasks: [] },
  { id: 2, name: "Priya Sharma", skills: ["electrical", "maintenance"], available: true, currentTasks: [] },
  { id: 3, name: "Ankit Patel", skills: ["emergency", "critical"], available: true, currentTasks: [] }
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
        </ul>
    `);
});

// Incident Routes with duplicate detection and rate limiting
app.post("/api/incidents", reportLimiter, async (req, res) => {
    try {
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

        const incident = new Incident(req.body);
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
        const incidents = await Incident.find();
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
    console.log(`👨‍🔧 Technicians: http://localhost:${PORT}/api/technicians`);
});