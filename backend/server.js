const fs = require("fs");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

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

// Routes
app.get("/", (req, res) => {
    res.send(`
        <h1>⚡ VoltageGuard Backend API</h1>
        <p>MongoDB Connected: ${db.readyState === 1 ? '✅' : '❌'}</p>
        <ul>
            <li>GET <a href="/api/incidents">/api/incidents</a> - Get all incidents</li>
            <li>POST /api/incidents - Create incident</li>
            <li>GET <a href="/api/predictions">/api/predictions</a> - Get AI predictions</li>
        </ul>
    `);
});

// Incident Routes
app.post("/api/incidents", async (req, res) => {
    try {
        const incident = new Incident(req.body);
        await incident.save();
        console.log("📝 New incident reported:", incident.title);
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

// ==================== PREDICTION ENGINE ====================

// Prediction Engine Logic
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
            new Date(inc.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        ).length;

        // Prediction logic
        if (criticalCount >= 2 && recentIncidents >= 3) {
            predictions.push({
                location: { building },
                predicted_issue: "High probability of voltage transformer failure",
                probability: 85,
                reason: `Multiple critical incidents (${criticalCount}) in last week`,
                predicted_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next 24 hours
                confidence: "high",
                urgency: "critical"
            });
        }
        
        if (recentIncidents >= 5) {
            predictions.push({
                location: { building },
                predicted_issue: "Likely voltage fluctuation pattern",
                probability: 70,
                reason: `High incident frequency (${recentIncidents} incidents in 7 days)`,
                predicted_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Next 48 hours
                confidence: "medium",
                urgency: "high"
            });
        }

        // Evening peak hours prediction
        const eveningIncidents = buildingIncidents.filter(inc => {
            const hour = new Date(inc.createdAt).getHours();
            return hour >= 18 && hour <= 22; // 6 PM - 10 PM
        }).length;

        if (eveningIncidents >= 3) {
            predictions.push({
                location: { building },
                predicted_issue: "Evening peak load voltage drops",
                probability: 75,
                reason: `Consistent evening incidents (${eveningIncidents} occurrences)`,
                predicted_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow evening
                predicted_time: "18:00-22:00",
                confidence: "high",
                urgency: "medium"
            });
        }
    }

    return predictions;
};

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

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`⚡ VoltageGuard Server running on port ${PORT}`);
    console.log(`📍 API: http://localhost:${PORT}`);
    console.log(`🔮 Predictions: http://localhost:${PORT}/api/predictions`);
});