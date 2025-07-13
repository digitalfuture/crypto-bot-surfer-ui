import express from "express";
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { handler as ssrHandler } from "./dist/server/entry.mjs";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configuration
const port = process.env.PORT || 8081;
const hostName = process.env.HOSTNAME || "localhost";
const app = express();

// Middleware to handle CORS
app.use(cors());

// Middleware to parse JSON in requests
app.use(express.json());

// Serve static files from the Astro build directory
app.use(
  express.static(join(dirname(fileURLToPath(import.meta.url)), "dist/client"))
);

// Attach Astro's server-side rendering handler
app.use(ssrHandler);

// Endpoint to read and return CSV files
app.get("/lines", async (req, res) => {
  try {
    const data = await readFiles();
    res.status(200).json(data);
  } catch (error) {
    console.error("Error reading files:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Endpoint to handle file updates (placeholder logic)
app.post("/lines/update", (req, res) => {
  res.status(200).json({ data: req.body });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://${hostName}:${port}/`);
});

// Function to read CSV files from the public/data directory
async function readFiles() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const directoryPath = join(__dirname, "public/data/");
  const fileList = [];

  try {
    // Read all files in the target directory
    const files = await readdir(directoryPath);

    for (const fileName of files) {
      // Only process .csv files
      if (fileName.endsWith(".csv")) {
        const filePath = join(directoryPath, fileName);
        const fileData = await readFile(filePath, { encoding: "utf8" });

        // Add file name and content to the result list
        fileList.push({
          name: fileName,
          data: fileData.trim().split("\n").slice(1).slice(-2000),
        });
      }
    }

    return fileList;
  } catch (error) {
    console.error("Error reading directory:", error);
    throw error;
  }
}
