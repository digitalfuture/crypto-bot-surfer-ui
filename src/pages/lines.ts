import type { APIRoute } from "astro";
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export interface IServerLine {
  name: string;
  data: string[];
  total?: number;
  offset?: number;
  isDelta?: boolean;
  mtime?: number;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const countsParam = url.searchParams.get("counts");
    const mtimesParam = url.searchParams.get("mtimes");

    let clientCounts: Record<string, number> | null = null;
    let clientMtimes: Record<string, number> | null = null;

    if (countsParam) {
      try {
        clientCounts = JSON.parse(countsParam);
      } catch {
        clientCounts = null;
      }
    }

    if (mtimesParam) {
      try {
        clientMtimes = JSON.parse(mtimesParam);
      } catch {
        clientMtimes = null;
      }
    }

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
      "vol-momentum",
      "vol-breakout",
      "volatility2",
      "volatility3",
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
      const fileStat = await stat(filePath);
      const fileMtime = Math.floor(fileStat.mtimeMs);

      const id = fileName
        .replace(/\.csv$/i, "")
        .replace(/^trades[-_]/i, "")
        .toLowerCase();

      const rawCount = clientCounts
        ? clientCounts[fileName] ??
          clientCounts[id] ??
          clientCounts[`trades-${id}.csv`]
        : undefined;
      const clientCount =
        typeof rawCount === "number" && !isNaN(rawCount) && rawCount >= 0
          ? rawCount
          : null;

      const rawMtime = clientMtimes
        ? clientMtimes[fileName] ??
          clientMtimes[id] ??
          clientMtimes[`trades-${id}.csv`]
        : undefined;
      const clientMtime =
        typeof rawMtime === "number" && !isNaN(rawMtime) && rawMtime > 0
          ? rawMtime
          : null;

      // Fast path: if client provided mtime and count, and file mtime has not changed at all:
      if (
        clientMtime !== null &&
        clientCount !== null &&
        fileMtime <= clientMtime
      ) {
        fileList.push({
          name: fileName,
          data: [],
          total: clientCount,
          offset: clientCount,
          isDelta: true,
          mtime: fileMtime,
        });
        continue;
      }

      // File was modified or client has no mtime: read file
      const fileData = await readFile(filePath, { encoding: "utf8" });
      const allRows = fileData
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .filter((line) => line.trim().length > 0);

      const totalRows = allRows.length;

      let returnRows: string[];
      let offset = 0;
      let isDelta = false;

      if (clientCount !== null) {
        if (clientCount === totalRows) {
          // File was modified but row count didn't change (e.g. commission edit in-place)
          // If mtime changed, reload full file to reflect in-place changes
          if (clientMtime !== null && fileMtime > clientMtime) {
            returnRows = allRows.slice(-10000);
            offset = 0;
            isDelta = false;
          } else {
            returnRows = [];
            offset = clientCount;
            isDelta = true;
          }
        } else if (clientCount < totalRows) {
          // Client only needs new rows appended since clientCount
          returnRows = allRows.slice(clientCount);
          offset = clientCount;
          isDelta = true;
        } else {
          // File was truncated or reset -> reload full rows
          returnRows = allRows.slice(-10000);
          offset = 0;
          isDelta = false;
        }
      } else {
        // Initial full load
        returnRows = allRows.slice(-10000);
        offset = 0;
        isDelta = false;
      }

      fileList.push({
        name: fileName,
        data: returnRows,
        total: totalRows,
        offset,
        isDelta,
        mtime: fileMtime,
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
