const fs = require("fs");
const express = require("express");
const cors = require("cors");
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

let data = [];

// Routes
app.get("/", (req, res) => {
    res.send(`
        <h1>Backend Server is Running!</h1>
        <p>Available endpoints:</p>
        <ul>
            <li>GET <a href="/data">/data</a> - View all data</li>
            <li>POST /data - Submit new data</li>
        </ul>
    `);
});

app.post("/data", (req, res) => {
    const newData = {
        event: req.body.event,
        value: req.body.value,
        time: new Date().toLocaleString()
    };
    
    data.push(newData);
    fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
    
    console.log("Received:", req.body);
    res.send("OK");
});

app.get("/data", (req, res) => {
    res.json(data);
});

// Start server
app.listen(3000, () => {
    console.log("Server running on port 3000");
});