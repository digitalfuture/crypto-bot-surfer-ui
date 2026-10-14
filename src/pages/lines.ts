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
    const lastsParam = url.searchParams.get("lasts");
    const firstsParam = url.searchParams.get("firsts");

    let clientCounts: Record<string, number> | null = null;
    let clientMtimes: Record<string, number> | null = null;
    let clientLasts: Record<string, string> | null = null;
    let clientFirsts: Record<string, string> | null = null;

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

    if (lastsParam) {
      try {
        clientLasts = JSON.parse(lastsParam);
      } catch {
        clientLasts = null;
      }
    }

    if (firstsParam) {
      try {
        clientFirsts = JSON.parse(firstsParam);
      } catch {
        clientFirsts = null;
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
      "vol-momentum",
      "vol-breakout",
      "volatility2",
      "volatility3",
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

      const rawLast = clientLasts
        ? clientLasts[fileName] ??
          clientLasts[id] ??
          clientLasts[`trades-${id}.csv`]
        : undefined;
      const clientLast = typeof rawLast === "string" ? rawLast.trim() : null;

      const rawFirst = clientFirsts
        ? clientFirsts[fileName] ??
          clientFirsts[id] ??
          clientFirsts[`trades-${id}.csv`]
        : undefined;
      const clientFirst = typeof rawFirst === "string" ? rawFirst.trim() : null;

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
        .filter((line) => line.trim().length > 0 && !line.startsWith("Count,"));

      const totalRows = allRows.length;

      let returnRows: string[];
      let offset = 0;
      let isDelta = false;

      if (clientCount !== null) {
        if (clientCount === totalRows) {
          // Verify consistency of first and last row
          const serverFirstDate =
            totalRows > 0 ? allRows[0].split(",")[1]?.trim() : null;
          const serverLastDate =
            totalRows > 0 ? allRows[totalRows - 1].split(",")[1]?.trim() : null;

          const isConsistent =
            (!clientFirst || !serverFirstDate || clientFirst === serverFirstDate) &&
            (!clientLast || !serverLastDate || clientLast === serverLastDate);

          if (!isConsistent || (clientMtime !== null && fileMtime > clientMtime)) {
            returnRows = allRows.slice(-10000);
            offset = 0;
            isDelta = false;
          } else {
            returnRows = [];
            offset = clientCount;
            isDelta = true;
          }
        } else if (clientCount < totalRows) {
          // Verify cache consistency:
          // 1. First row matches
          // 2. Row at (clientCount - 1) matches client's last known row
          const serverFirstDate = allRows[0]?.split(",")[1]?.trim();
          const serverClientLastDate =
            clientCount > 0 ? allRows[clientCount - 1]?.split(",")[1]?.trim() : null;

          const isFirstConsistent =
            !clientFirst || !serverFirstDate || clientFirst === serverFirstDate;
          const isLastConsistent =
            !clientLast || !serverClientLastDate || clientLast === serverClientLastDate;

          if (isFirstConsistent && isLastConsistent) {
            // Client only needs new rows appended since clientCount
            returnRows = allRows.slice(clientCount);
            offset = clientCount;
            isDelta = true;
          } else {
            // Desync detected! File changed or was prepended/reset -> reload full rows
            returnRows = allRows.slice(-10000);
            offset = 0;
            isDelta = false;
          }
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
