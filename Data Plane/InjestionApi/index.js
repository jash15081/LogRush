const express = require("express");
const app = express();
require("dotenv").config();
// Parse JSON body
app.use(express.json());

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
// Ingestion endpoint
app.post("/ingest",async (req, res) => {
  const logData = req.body;
  await sleep(1000); // simulate processing delay
  console.log("Received log:", logData[0].level);
  console.log("Handled by:", process.env.HOSTNAME);
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
