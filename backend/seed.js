
const mongoose = require('mongoose');


mongoose.connect("mongodb://localhost:27017/voltage_guard", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const Incident = mongoose.model('Incident', new mongoose.Schema({
    title: String,
    category: String,
    description: String,
    severity: String,
    status: String,
    location: {
        building: String,
        room: String
    },
    equipment: String,
    createdAt: { type: Date, default: Date.now }
}));

const sampleIncidents = [
    {
        title: "Voltage Fluctuation in Hostel A",
        category: "electricity",
        description: "Lights flickering in common room, voltage drops in evening",
        severity: "high",
        status: "resolved",
        location: { building: "Hostel A", room: "Common Room" },
        equipment: "transformer",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    },
    {
        title: "Complete Blackout - Academic Block",
        category: "electricity", 
        description: "Complete power failure during peak hours",
        severity: "critical",
        status: "resolved",
        location: { building: "Academic Block", room: "Floor 2" },
        equipment: "switchboard",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
    },
    {
        title: "Voltage Drop in Lab Complex",
        category: "electricity",
        description: "Equipment shutting down due to low voltage",
        severity: "critical", 
        status: "in-progress",
        location: { building: "Lab Complex", room: "Lab 205" },
        equipment: "transformer",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
    },
    {
        title: "Flickering Lights - Hostel B",
        category: "electricity",
        description: "Intermittent flickering throughout building",
        severity: "medium",
        status: "new",
        location: { building: "Hostel B", room: "Floor 3" },
        equipment: "wiring",
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
    },
    {
        title: "Generator Failure - Admin Block",
        category: "electricity",
        description: "Backup generator not starting during outage",
        severity: "high",
        status: "resolved", 
        location: { building: "Admin Block", room: "Basement" },
        equipment: "generator",
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago
    }
];

async function seedDatabase() {
    try {
        // Clear existing incidents
        await Incident.deleteMany({});
        console.log('🗑️  Cleared existing incidents');
        
        // Add sample incidents
        await Incident.insertMany(sampleIncidents);
        console.log('✅ Added sample incidents for AI predictions');
        
        console.log('🎯 Now restart your server and check predictions!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();