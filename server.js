import express from "express";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
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

// Function to read CSV files from the public/data directory (or dev report directory)
async function readFiles() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const isDev = process.env.NODE_ENV === "development";
  const siblingReportDir = join(__dirname, "../crypto-bot-surfer/report");
  const prodDir = process.env.REPORT_FILE_DIR || join(__dirname, "public/data/");
  const directoryPath =
    isDev && existsSync(siblingReportDir) ? siblingReportDir : prodDir;
  const fileList = [];

  if (!existsSync(directoryPath)) {
    console.warn(`Reports directory does not exist: ${directoryPath}`);
    return fileList;
  }

  try {
    // Read all files in the target directory
    const files = await readdir(directoryPath);

    const order = [
      "volatility",
      "channel",
      "trend",
      "pullback",
      "scalper",
      "orderbook-wall",
      "orderbook-imbalance",
      "orderbook-absorption",
      "wall",
      "imbalance",
      "absorption",
    ];

    const csvFiles = files.filter((fileName) => fileName.endsWith(".csv"));
    csvFiles.sort((a, b) => {
      const idA = a
        .replace(/\.csv$/i, "")
        .replace(/^trades[-_]/i, "")
        .toLowerCase();
      const idB = b
        .replace(/\.csv$/i, "")
        .replace(/^trades[-_]/i, "")
        .toLowerCase();
      const idxA = order.indexOf(idA);
      const idxB = order.indexOf(idB);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

    for (const fileName of csvFiles) {
      const filePath = join(directoryPath, fileName);
      const fileData = await readFile(filePath, { encoding: "utf8" });

      // Add file name and content to the result list
      fileList.push({
        name: fileName,
        data: fileData
          .trim()
          .split(/\r?\n/)
          .slice(1)
          .filter((line) => line.trim().length > 0)
          .slice(-10000),
      });
    }

    return fileList;
  } catch (error) {
    console.error("Error reading directory:", error);
    throw error;
  }
}
