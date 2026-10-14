import type { APIRoute } from "astro";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export interface IServerLine {
  name: string;
  data: string[];
}

export const GET: APIRoute = async () => {
  try {
    const isDev = import.meta.env.DEV;
    const siblingReportDir = resolve(
      process.cwd(),
      "../crypto-bot-surfer/report"
    );
    const prodDir = process.env.REPORT_FILE_DIR
      ? resolve(process.env.REPORT_FILE_DIR)
      : resolve(process.cwd(), "public/data");

    // In dev mode: read from sibling crypto-bot-surfer/report folder.
    // In build/production: read from public/data (or REPORT_FILE_DIR).
    let directoryPath = isDev ? siblingReportDir : prodDir;

    if (!existsSync(directoryPath)) {
      if (isDev && existsSync(prodDir)) {
        directoryPath = prodDir;
      }
    }

    if (!existsSync(directoryPath)) {
      console.warn(`Reports directory does not exist: ${directoryPath}`);
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const files = await readdir(directoryPath);
    const fileList: IServerLine[] = [];

    const order = [
      "volatility",
      "volatility2",
      "channel",
      "channel2",
      "trend",
      "pullback",
      "scalper",
      "orderbook-wall",
      "orderbook-imbalance",
      "orderbook-absorption",
      "wall",
      "imbalance",
      "absorption",
      "mm-inventory",
      "inventory",
      "liquidity-sweep",
      "sweep",
      "orderbook-iceberg",
      "iceberg",
    ];

    const csvFiles = files.filter((f) => f.endsWith(".csv"));
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

      const rows = fileData
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .filter((line) => line.trim().length > 0)
        .slice(-10000);

      fileList.push({
        name: fileName,
        data: rows,
      });
    }

    return new Response(JSON.stringify(fileList), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error reading report files:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
