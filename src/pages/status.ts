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
  slope?: number | null;
  r2?: number | null;
  zScore?: number | null;
}

export interface IBotStatus {
  id: string;
  name: string;
  hasOpenPosition: boolean;
  position: IBotPosition | null;
  positions?: IBotPosition[];
  totalTrades: number;
  totalProfit: number;
  lastTradeDate?: string;
  isLive?: boolean;
  metrics?: {
    slope?: number;
    slopePct?: number;
    r2?: number;
    zScore?: number;
    regime?: string;
    period?: number;
  } | null;
}

export interface IAccountInfo {
  mode: "live" | "demo" | "paper";
  balance: number | null;
  leverage: number | null;
  grossExposure: number | null;
  maxGross: number | null;
  openPositions: number | null;
  execMode?: string | null;
}

export interface IStatusResponse {
  system: {
    status: "HEALTHY" | "WARNING" | "OFFLINE";
    runningBots: number;
    totalBots: number;
    uiStatus?: string;
    timestamp: string;
    activePositionsCount: number;
    isLiveServer?: boolean;
  };
  account?: IAccountInfo;
  bots: IBotStatus[];
}

export interface IWatchdogData {
  status?: "HEALTHY" | "WARNING" | "OFFLINE";
  runningBots?: number;
  totalBots?: number;
  uiStatus?: string;
  timestamp?: string;
  containers?: Record<string, string>;
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
    let watchdogData: IWatchdogData | null = null;
    const watchdogFile = join(directoryPath, "watchdog.json");
    if (existsSync(watchdogFile)) {
      try {
        const rawWatchdog = await readFile(watchdogFile, "utf8");
        watchdogData = JSON.parse(rawWatchdog) as IWatchdogData;
      } catch (err) {
        console.warn("Could not read watchdog.json:", err);
      }
    }

    const files = await readdir(directoryPath);
    const bots: IBotStatus[] = [];
    let activePositionsCount = 0;

    // Filter CSV files
    const csvFiles = files.filter(
      (f) =>
        f.endsWith(".csv") &&
        !f.endsWith("-demo.csv") &&
        !f.endsWith("-testnet.csv") &&
        !f.endsWith("-real.csv")
    );

    for (const fileName of csvFiles) {
      const strategyId = fileName
        .replace(/\.csv$/i, "")
        .replace(/^trades[-_]/i, "")
        .toLowerCase();
      const displayName = strategyId
        .replace(/^(orderbook|ob|mm|vol)[-_]/i, "")
        .toUpperCase();

      const csvPath = join(directoryPath, fileName);
      const csvRaw = await readFile(csvPath, "utf8");
      const lines = csvRaw
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .filter((l) => l.trim().length > 0);

      const isLiveServer = process.env.LIVE_SERVER !== "false";
      const isLive = isLiveServer || lines.some((l) => {
        const parts = l.split(",");
        return parts[4]?.trim() === "LIVE_START" || parts[2]?.trim() === "LIVE_START";
      });

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

        // Odd row count (1, 3, 5...) means the position is currently open (for live bots)
        const isOddRow = lines.length % 2 === 1;
        if (isLive && isOddRow) {
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

      // Check state file: <strategyId>.state.json or <fileName>.state.json
      let statePosition: IBotPosition | null = null;
      let stateMetrics: IBotStatus["metrics"] = null;
      let statePositions: IBotPosition[] = [];
      const baseStrategyId = strategyId.replace(/[-_]live$/i, "");
      const stateFile = existsSync(join(directoryPath, `${strategyId}.state.json`))
        ? join(directoryPath, `${strategyId}.state.json`)
        : existsSync(join(directoryPath, `${baseStrategyId}.state.json`))
        ? join(directoryPath, `${baseStrategyId}.state.json`)
        : join(directoryPath, `${fileName}.state.json`);
      if (existsSync(stateFile)) {
        try {
          const rawState = await readFile(stateFile, "utf8");
          const stateData = JSON.parse(rawState) as {
            symbol?: string;
            side?: string;
            entryPrice?: string | number;
            shortPrice?: string | number;
            stopLoss?: string | number;
            takeProfit?: string | number;
            volatility?: string | number;
            metrics?: any;
          };
          const toFloat = (
            val: string | number | undefined | null
          ): number | null => {
            if (val == null) return null;
            const num = typeof val === "number" ? val : parseFloat(String(val));
            return isNaN(num) ? null : num;
          };

          if (stateData && stateData.metrics) {
            stateMetrics = stateData.metrics;
          }

          if (stateData && (stateData as any).sleeves) {
            for (const sl of Object.values((stateData as any).sleeves as Record<string, any>)) {
              if (sl && sl.pos) {
                for (const [sym, p] of Object.entries(sl.pos as Record<string, any>)) {
                  if (p && Number((p as any).units) > 0) {
                    statePositions.push({
                      symbol: sym,
                      side: Number((p as any).dir) > 0 ? "LONG" : "SHORT",
                      entryPrice: Number((p as any).entry) || 0,
                    });
                  }
                }
              }
            }
            if (statePositions.length > 0) {
              statePosition = statePositions[0];
            }
          }

          if (stateData && stateData.symbol) {
            statePosition = {
              symbol: stateData.symbol,
              side: stateData.side || "SHORT",
              entryPrice: toFloat(stateData.entryPrice) ?? 0,
              shortPrice: toFloat(stateData.shortPrice) ?? undefined,
              stopLoss: toFloat(stateData.stopLoss),
              takeProfit: toFloat(stateData.takeProfit),
              volatility: toFloat(stateData.volatility),
              slope: stateData.metrics?.slope ?? null,
              r2: stateData.metrics?.r2 ?? null,
              zScore: stateData.metrics?.zScore ?? null,
            };
          }
        } catch {
          // ignore error reading state json
        }
      }

      // For live bot, match real execution prices from CSV trades
      if (strategyId.toLowerCase().includes("live") && lines.length > 0 && statePositions.length > 0) {
        for (const p of statePositions) {
          for (let i = lines.length - 1; i >= 0; i--) {
            const rowParts = lines[i].split(",");
            const sym = (rowParts[2] || "").trim();
            const action = (rowParts[4] || "").toUpperCase().trim();
            if (sym.startsWith(p.symbol) && (action === "BUY" || action === "SELL")) {
              const liveFill = parseFloat(rowParts[5]);
              if (!isNaN(liveFill) && liveFill > 0) {
                p.entryPrice = liveFill;
              }
              break;
            }
          }
        }
        statePosition = statePositions[0];
      }

      const activePos = isLive ? (statePosition || fallbackPosition) : null;
      const activePositions = isLive ? (statePositions.length > 0 ? statePositions : (activePos ? [activePos] : [])) : [];
      const hasOpenPosition = isLive && (isLastTradeOpen || activePositions.length > 0);

      bots.push({
        id: strategyId,
        name: displayName,
        hasOpenPosition,
        position: activePos,
        positions: activePositions,
        totalTrades: lines.length,
        totalProfit,
        lastTradeDate,
        metrics: stateMetrics,
        isLive,
      });
    }

    const order = [
      "trend-mtf-v2",
      "trend-mtf",
      "trend-mtf-smartlab",
      "btc-5m",
      "btc-15m",
      "btc-30m",
      "btc-1h",
      "lr-trend",
      "lr-reversion",
      "lr-pullback",
      "lr-squeeze",
      "lr-portfolio",
      "momentum",
      "breakout",
      "channel",
      "trend",
      "pullback",
      "scalper",
      "wall",
      "imbalance",
      "absorption",
      "inventory",
      "sweep",
      "iceberg",
      "vol-momentum",
      "vol-breakout",
      "volatility",
      "orderbook-wall",
      "orderbook-imbalance",
      "orderbook-absorption",
      "mm-inventory",
      "liquidity-sweep",
      "orderbook-iceberg",
    ];
    bots.sort((a, b) => {
      const cleanA = a.id.replace(/^(orderbook|ob|mm|vol|lr)[-_]/i, "");
      const cleanB = b.id.replace(/^(orderbook|ob|mm|vol|lr)[-_]/i, "");
      const idxA = order.indexOf(cleanA) !== -1 ? order.indexOf(cleanA) : order.indexOf(a.id);
      const idxB = order.indexOf(cleanB) !== -1 ? order.indexOf(cleanB) : order.indexOf(b.id);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

    const liveBots = bots.filter((b) => b.isLive);
    const uniqueCoinsInPos = new Set<string>();
    for (const b of (liveBots.length > 0 ? liveBots : bots)) {
      if (b.positions && b.positions.length > 0) {
        for (const p of b.positions) uniqueCoinsInPos.add(p.symbol);
      } else if (b.position?.symbol) {
        uniqueCoinsInPos.add(b.position.symbol);
      }
    }
    // Read real/demo account balance & leverage from state files (preferring live > demo > any exec)
    const hasLiveCsv = files.some((f) => f.endsWith("-live.csv"));
    const hasDemoCsv = files.some((f) => f.endsWith("-demo.csv"));
    let accountInfo: IAccountInfo = {
      mode: hasLiveCsv && !hasDemoCsv ? "live" : hasDemoCsv ? "demo" : "paper",
      balance: null,
      leverage: null,
      grossExposure: null,
      maxGross: null,
      openPositions: null,
      execMode: null,
    };
    const stateFiles = files
      .filter((f) => f.endsWith(".state.json"))
      .sort((a, b) => (a.includes("v2") ? -1 : b.includes("v2") ? 1 : 0));
    for (const sf of stateFiles) {
      try {
        const parsed = JSON.parse(await readFile(join(directoryPath, sf), "utf8"));
        const ex = parsed?.exec;
        if (!ex) continue;
        const mode: "live" | "demo" | "paper" =
          ex.execution === "live" ? "live" : ex.execution === "demo" ? "demo" : accountInfo.mode;
        const bal = typeof ex.lastEquity === "number" && ex.lastEquity > 0 ? ex.lastEquity : null;
        if (bal !== null || ex.execution === "live" || ex.execution === "demo") {
          // Prefer live over demo over paper
          const rank = (m: string) => (m === "live" ? 3 : m === "demo" ? 2 : 1);
          if (accountInfo.balance === null || rank(mode) >= rank(accountInfo.mode)) {
            accountInfo = {
              mode,
              balance: bal,
              leverage: typeof ex.leverage === "number" ? ex.leverage : Number(process.env.LEVERAGE || 3),
              grossExposure: typeof ex.grossExposure === "number" ? ex.grossExposure : null,
              maxGross: typeof ex.maxGross === "number" ? ex.maxGross : null,
              openPositions: typeof ex.openPositions === "number" ? ex.openPositions : null,
              execMode: ex.execMode ?? null,
            };
          }
        }
      } catch {
        // ignore unreadable state files
      }
    }

    const isLiveServer =
      process.env.LIVE_SERVER === "true"
        ? true
        : process.env.LIVE_SERVER === "false"
        ? false
        : accountInfo.mode === "live" || (hasLiveCsv && !hasDemoCsv);

    const systemStatus: IStatusResponse["system"] = {
      status: watchdogData?.status || "HEALTHY",
      runningBots: watchdogData?.runningBots ?? (liveBots.length > 0 ? liveBots.length : bots.length),
      totalBots: watchdogData?.totalBots ?? (liveBots.length > 0 ? liveBots.length : bots.length),
      uiStatus: watchdogData?.uiStatus ?? "running",
      timestamp: watchdogData?.timestamp || new Date().toISOString(),
      activePositionsCount: uniqueCoinsInPos.size,
      isLiveServer,
    };

    return new Response(
      JSON.stringify({
        system: systemStatus,
        account: accountInfo,
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
