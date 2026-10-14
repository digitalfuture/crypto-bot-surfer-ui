import type { APIRoute } from "astro";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export interface IBotPosition {
  symbol: string;
  side: "LONG" | "SHORT" | string;
  entryPrice: number;
  shortPrice?: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  volatility?: number | null;
}

export interface IBotStatus {
  id: string;
  name: string;
  hasOpenPosition: boolean;
  position: IBotPosition | null;
  totalTrades: number;
  totalProfit: number;
  lastTradeDate?: string;
}

export interface IStatusResponse {
  system: {
    status: "HEALTHY" | "WARNING" | "OFFLINE";
    runningBots: number;
    totalBots: number;
    uiStatus?: string;
    timestamp: string;
    activePositionsCount: number;
  };
  bots: IBotStatus[];
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

    let directoryPath = isDev ? siblingReportDir : prodDir;

    if (!existsSync(directoryPath)) {
      if (isDev && existsSync(prodDir)) {
        directoryPath = prodDir;
      }
    }

    if (!existsSync(directoryPath)) {
      return new Response(
        JSON.stringify({
          system: {
            status: "OFFLINE",
            runningContainers: 0,
            totalContainers: 9,
            timestamp: new Date().toISOString(),
            activePositionsCount: 0,
          },
          bots: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 1. Read Watchdog info if available
    let watchdogData: any = null;
    const watchdogFile = join(directoryPath, "watchdog.json");
    if (existsSync(watchdogFile)) {
      try {
        const rawWatchdog = await readFile(watchdogFile, "utf8");
        watchdogData = JSON.parse(rawWatchdog);
      } catch (err) {
        console.warn("Could not read watchdog.json:", err);
      }
    }

    const files = await readdir(directoryPath);
    const bots: IBotStatus[] = [];
    let activePositionsCount = 0;

    // Filter CSV files
    const csvFiles = files.filter((f) => f.endsWith(".csv"));

    for (const fileName of csvFiles) {
      const strategyId = fileName
        .replace(/\.csv$/i, "")
        .replace(/^trades[-_]/i, "")
        .toLowerCase();
      const displayName = strategyId.toUpperCase();

      const csvPath = join(directoryPath, fileName);
      const csvRaw = await readFile(csvPath, "utf8");
      const lines = csvRaw
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .filter((l) => l.trim().length > 0);

      let totalProfit = 0;
      let lastTradeDate = "";
      let isLastTradeOpen = false;
      let fallbackPosition: IBotPosition | null = null;

      if (lines.length > 0) {
        const lastRow = lines[lines.length - 1].split(",");
        const lastProfit = parseFloat(lastRow[7]);
        const lastTotalProfit = parseFloat(lastRow[8]);
        if (!isNaN(lastTotalProfit)) totalProfit = lastTotalProfit;
        lastTradeDate = lastRow[1] || "";

        // If profit === 0 on the last row, the trade is active
        if (!isNaN(lastProfit) && lastProfit === 0) {
          isLastTradeOpen = true;
          const sym = lastRow[2];
          const tradeAction = lastRow[4];
          const p = parseFloat(lastRow[5]);
          if (sym && p > 0) {
            fallbackPosition = {
              symbol: sym,
              side: tradeAction === "BUY" ? "LONG" : "SHORT",
              entryPrice: p,
            };
          }
        }
      }

      // Check state file: <fileName>.state.json
      let statePosition: IBotPosition | null = null;
      const stateFile = join(directoryPath, `${fileName}.state.json`);
      if (existsSync(stateFile)) {
        try {
          const rawState = await readFile(stateFile, "utf8");
          const stateData = JSON.parse(rawState);
          if (stateData && stateData.symbol) {
            statePosition = {
              symbol: stateData.symbol,
              side: stateData.side || "SHORT",
              entryPrice: parseFloat(stateData.entryPrice || "0"),
              shortPrice: stateData.shortPrice
                ? parseFloat(stateData.shortPrice)
                : undefined,
              stopLoss: stateData.stopLoss
                ? parseFloat(stateData.stopLoss)
                : null,
              takeProfit: stateData.takeProfit
                ? parseFloat(stateData.takeProfit)
                : null,
              volatility: stateData.volatility
                ? parseFloat(stateData.volatility)
                : null,
            };
          }
        } catch {
          // ignore error reading state json
        }
      }

      const activePos = statePosition || fallbackPosition;
      const hasOpenPosition = isLastTradeOpen || activePos !== null;
      if (hasOpenPosition) {
        activePositionsCount++;
      }

      bots.push({
        id: strategyId,
        name: displayName,
        hasOpenPosition,
        position: activePos,
        totalTrades: lines.length,
        totalProfit,
        lastTradeDate,
      });
    }

    // Sort bots by standard order: VOLATILITY, CHANNEL, TREND, PULLBACK, SCALPER, ORDERBOOK-WALL, ORDERBOOK-IMBALANCE, ORDERBOOK-ABSORPTION, MM-INVENTORY, LIQUIDITY-SWEEP, ORDERBOOK-ICEBERG
    const order = [
      "volatility",
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
    bots.sort((a, b) => {
      const idxA = order.indexOf(a.id);
      const idxB = order.indexOf(b.id);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

    const systemStatus: IStatusResponse["system"] = {
      status: watchdogData?.status || "HEALTHY",
      runningBots: watchdogData?.runningBots ?? bots.length,
      totalBots: watchdogData?.totalBots ?? Math.max(11, bots.length),
      uiStatus: watchdogData?.uiStatus ?? "running",
      timestamp: watchdogData?.timestamp || new Date().toISOString(),
      activePositionsCount,
    };

    return new Response(
      JSON.stringify({
        system: systemStatus,
        bots,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error reading bot status:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
