import express from "express";
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { handler as ssrHandler } from "./dist/server/entry.mjs";

const port = 80;
const hostName = "localhost";
const app = express();

// Middlewares
app.use(express.static("dist/client/"));
app.use(ssrHandler);

app.get("/lines", async (req, res) => {
  res.statusCode = 200;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/plain");

  const data = await readFiles();

  res.end(JSON.stringify(data));
});

app.post("/lines/update", (req, res) => {
  res.statusCode = 200;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/plain");

  res.end(JSON.stringify(req.files));
});

app.listen(port, () => {
  console.log(`Server running at http://${hostName}:${port}/`);
});

// Functions
function readFiles() {
  return new Promise(async (resolve, reject) => {
    const __filename = fileURLToPath(import.meta.url);

    const __dirname = dirname(__filename);
    const directoryPath = join(__dirname, "public/data/");
    const fileList = [];

    const files = await readdir(directoryPath);

    for await (const fileName of files) {
      const filePath = directoryPath + fileName;
      const fileData = await readFile(filePath, {
        encoding: "utf8",
      });

      // console.log("file;", file);
      fileList.push({ name: fileName, data: fileData });
    }

    // console.log(fileList);

    return resolve(fileList);
  });
}
