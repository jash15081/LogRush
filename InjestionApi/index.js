const express = require("express");
const app = express();
require("dotenv").config();
// Parse JSON body
app.use(express.json());

// Ingestion endpoint
app.post("/ingest", (req, res) => {
  const logData = req.body;

  console.log("Received log:", logData);

  res.status(200).json({
    status: "success",
    message: "Log received"
  });
});

// Start server
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Ingestion API running on port ${PORT}`);
});
