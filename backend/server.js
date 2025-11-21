const fs = require("fs");
const express = require("express");
const app = express();
app.use(express.json());

let data = [];

app.post("/data", (req, res) => {
    data.push({
        event: req.body.event,
        value: req.body.value,
        time: new Date().toLocaleString()
    });

    fs.writeFileSync("data.json", JSON.stringify(data, null, 2));

    console.log("Received:", req.body);
    res.send("OK");
});

app.get("/data", (req, res) => {
    res.json(data);
});

app.listen(3000, () => console.log("Server running on port 3000"));
