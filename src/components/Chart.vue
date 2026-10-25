<template>
  <!-- Chart container: ALWAYS in DOM so createChart never fails -->
  <div
    v-show="!isLoading && lines.length > 0 && !isMonitorView"
    class="chart cursor-pointer"
    id="chart-container"
    @dblclick="applyLongestScale"
    title="Double-click to auto-scale full time range"
  />

  <!-- Flat System & Bots Monitor View (replaces chart when active) -->
  <div
    v-if="!isLoading && lines.length > 0 && isMonitorView"
    class="monitor-view"
  >
    <!-- Flat Summary Bar -->
    <div class="monitor-summary-bar">
      <div class="summary-left">
        <span class="summary-item">
          WATCHDOG:
          <strong :class="systemStatus.status === 'HEALTHY' ? 'text-green' : 'text-yellow'">
            {{ systemStatus.status }}
          </strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          BOTS: <strong>{{ systemStatus.runningBots || botStatusList.length || 4 }}/{{ systemStatus.totalBots || botStatusList.length || 4 }} RUNNING</strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          IN POSITION: <strong>{{ systemStatus.activePositionsCount }} / {{ botStatusList.length || 4 }}</strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          PORTFOLIO PNL:
          <strong :class="parseFloat(totalProfit) >= 0 ? 'text-green' : 'text-red'">
            {{ formatProfit(totalProfit) }}
          </strong>
        </span>
        <template v-if="isAbsoluteMode">
          <span class="summary-sep">|</span>
          <span class="summary-item">
            PORTFOLIO EQ:
            <strong class="text-green">${{ portfolioEquity }}</strong>
          </span>
        </template>
      </div>
    </div>

    <!-- 11 Bots Flat Grid -->
    <div class="monitor-bots-grid">
      <div
        v-for="bot in botStatusList"
        :key="bot.id"
        class="bot-card cursor-pointer"
        :class="{ 'bot-card--in-pos': bot.hasOpenPosition }"
        @click="selectBotChart(bot.name)"
        :title="`Click to view ${bot.name} chart and trades`"
      >
        <div class="bot-card__color-bar" :style="{ backgroundColor: getBotColor(bot.name) }" />

        <div class="bot-card__header">
          <span class="bot-card__name" :title="bot.name">{{ formatBotName(bot.name) }}</span>
          <div class="bot-card__header-right">
            <span class="bot-card__pnl" :class="getBotPnl(bot) >= 0 ? 'text-green' : 'text-red'">
              {{ formatProfit(getBotPnl(bot)) }}
            </span>
          </div>
        </div>

        <div class="bot-card__body">
          <template v-if="bot.position">
            <div class="pos-row pos-row--main">
              <span class="pos-side" :class="bot.position.side === 'LONG' ? 'pos-side--long' : 'pos-side--short'">
                {{ bot.position.side }}
              </span>
              <span class="pos-symbol">{{ bot.position.symbol }}</span>
            </div>

            <div class="pos-details-grid">
              <div class="detail-row">
                <span class="detail-label">ENTRY</span>
                <span class="detail-val">{{ bot.position.entryPrice }}</span>
              </div>
              <div v-if="bot.position.stopLoss" class="detail-row">
                <span class="detail-label">SL</span>
                <span class="detail-val text-red">{{ formatTarget(bot.position.stopLoss) }}</span>
              </div>
              <div v-if="bot.position.takeProfit" class="detail-row">
                <span class="detail-label">TP</span>
                <span class="detail-val text-green">{{ formatTarget(bot.position.takeProfit) }}</span>
              </div>
              <div v-if="bot.position.shortPrice && bot.position.shortPrice !== bot.position.entryPrice" class="detail-row">
                <span class="detail-label">PEAK</span>
                <span class="detail-val">{{ formatTarget(bot.position.shortPrice) }}</span>
              </div>
            </div>
          </template>

          <div v-else class="bot-card__scanning">
            SCANNING FOR SETUPS
          </div>
        </div>

        <div class="bot-card__footer">
          <span class="footer-trades">{{ bot.totalTrades }} TRADES</span>
          <span v-if="bot.lastTradeDate" class="footer-time">{{ formatTime(bot.lastTradeDate) }}</span>
        </div>
      </div>
    </div>
  </div>

  <div v-if="isLoading" class="loader-container">
    <div class="loader">
      <div>DNA</div>
      <div>TRADE</div>
      <img src="/favicon.png" alt="DNATRADE" class="icon" />
    </div>
  </div>

  <div v-else-if="!isLoading && lines.length === 0" class="no-data">NO DATA</div>

  <template v-else>
    <div class="annotation" style="display: none">
      <span class="annotation--token" />
      <span class="annotation--price" />
    </div>

    <!-- Top Bar Controls -->
    <div class="top-bar-menu">
      <!-- Flat System & Bots Monitor Button / Plaque (FIRST) -->
      <div
        class="system-status-btn cursor-pointer"
        :class="{ 'system-status-btn--active': isMonitorView }"
        @click="toggleMonitorView"
        :title="isMonitorView ? 'Switch to Chart' : 'Switch to System & Bots Monitor'"
      >
        <span
          class="status-indicator"
          :class="systemStatus.status === 'HEALTHY' ? 'status-indicator--green' : 'status-indicator--yellow'"
        />
        <span class="status-btn-text">
          {{ systemStatus.runningBots || botStatusList.length || 4 }}/{{ systemStatus.totalBots || botStatusList.length || 4 }} BOTS
        </span>
        <span
          v-if="systemStatus.activePositionsCount > 0"
          class="status-btn-badge"
        >
          {{ systemStatus.activePositionsCount }} IN POS
        </span>
        <span v-if="isMonitorView" class="status-view-active">
          • MONITOR
        </span>
      </div>

      <!-- Commission toggle (SECOND) -->
      <div
        class="use-commission-container cursor-pointer"
        @click="toggleCommission"
        :title="useCommission ? 'With Commission (click to disable)' : 'Without Commission (click to enable)'"
      >
        <img
          :src="useCommission ? '/icons/money.svg' : '/icons/money-off.svg'"
          alt="DNATRADE"
          class="use-commission-button cursor-pointer"
        />
      </div>

      <!-- Mode toggle (% vs $ Wallet) (THIRD) -->
      <div
        class="calc-mode-container cursor-pointer"
        @click="toggleCalcMode"
        :title="isAbsoluteMode ? 'Dollar Compounding Mode ($100 base) - Click to switch to Relative %' : 'Percentage Mode (%) - Click to switch to Dollar Compounding ($100 base)'"
      >
        <img
          :src="isAbsoluteMode ? '/icons/wallet.svg' : '/icons/percent.svg'"
          alt="Mode"
          class="calc-mode-button cursor-pointer"
        />
      </div>
    </div>

    <!-- Top Right: Fullscreen Toggle Button -->
    <div
      class="top-bar-right"
      :style="{ visibility: isMonitorView ? 'hidden' : 'visible', pointerEvents: isMonitorView ? 'none' : 'auto' }"
    >
      <img
        :src="isFullScreen ? '/icons/collapse.svg' : '/icons/expand.svg'"
        alt="DNATRADE"
        class="full-screen-button cursor-pointer"
        @click="isFullScreen = !isFullScreen"
        :title="isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
      />
    </div>

    <!-- Legend toolbar (hidden when in monitor view or fullscreen) -->
    <div v-show="!isMonitorView && !isFullScreen" class="info-container">
      <!-- Open files -->
      <input
        type="file"
        multiple
        ref="input"
        class="input info clip-left cursor-pointer"
        @change="convertFileDataToLines"
      />

      <!-- Total / Average -->
      <div
        class="total info line clip-right cursor-pointer"
        :class="{
          'total--disabled': !isLineTotalVisible && linesEnabled.length !== 1,
        }"
        @click="updateLineTotalVisibility"
        :title="
          isAbsoluteMode
            ? 'Total Portfolio profit: ' + formatProfit(totalProfit) + ' (Base $' + initialBotCapital + '/bot, Equity: $' + portfolioEquity + ')'
            : 'Portfolio Net PnL: ' + totalProfit + '%'
        "
      >
        <div class="line__details info">
          <span class="line__name">
            {{ isAbsoluteMode ? 'PORTFOLIO (EQ $' + portfolioEquity + ')' : 'PORTFOLIO PNL' }}
          </span>
          <span class="line__last-value">
            {{ formatProfit(totalProfit) }}
          </span>
          <span
            class="round"
            :class="{
              'round--green': parseFloat(totalProfit) > 0,
              'round--red': parseFloat(totalProfit) < 0,
            }"
          />
        </div>
      </div>
    </div>

    <!-- Tickers lines (hidden when in monitor view or fullscreen) -->
    <section v-show="!isMonitorView && !isFullScreen" ref="legend" class="legend">
      <div
        v-for="(line, index) in lines"
        :key="index"
        :style="{
          'background-color': !line.disabled ? line.color : 'transparent',
        }"
        class="line clip-right cursor-pointer"
        :class="{
          'line--disabled': hasLineTotalOnly,
        }"
        @click="updateLineVisibility(index)"
        @dblclick="soloLine(index)"
        :title="'Click to toggle, double-click to view only this chart and trades'"
      >
        <div class="line__details">
          <span class="line__name" v-text="formatBotName(line.name)" />

          <!-- Micro position chip in legend -->
          <span
            v-if="getBotPosition(line.name)"
            class="micro-pos-tag"
            :class="getBotPosition(line.name).side === 'LONG' ? 'micro-pos-tag--long' : 'micro-pos-tag--short'"
            :title="`${getBotPosition(line.name).side} ${getBotPosition(line.name).symbol}`"
          >
            {{ getBotPosition(line.name).symbol }}
          </span>

          <span class="line__last-value" v-text="getLegendValue(index)" />
          <span
            class="round"
            :class="{
              'round--green':
                linesData[index]?.[linesData[index]?.length - 1]?.value > 0,
              'round--red':
                linesData[index]?.[linesData[index]?.length - 1]?.value < 0,
            }"
          />
        </div>
      </div>
    </section>
  </template>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type TimeRange,
  type AutoscaleInfo,
  type SeriesMarker,
  type SeriesMarkerPosition,
  type SeriesMarkerShape,
  type Time,
  type UTCTimestamp,
  type DeepPartial,
  type ChartOptions,
} from "lightweight-charts";
import type { IBotPosition, IBotStatus, IStatusResponse } from "../pages/status";

export interface IServerLine {
  name: string;
  data: string[];
  total?: number;
  offset?: number;
  isDelta?: boolean;
  mtime?: number;
}

export interface ILine {
  name: string;
  fileName?: string;
  mtime?: number;
  data: string[][];
  color: string;
  disabled: boolean;
}

export interface ISeries {
  time: number;
  value: number;
  trade?: string;
  profit?: number;
  profitPercent?: number;
  sum?: number;
  count?: number;
  tokenName?: string;
  price?: number;
}

let chart: IChartApi | null = null;
let lineSeries: (ISeriesApi<"Line"> | null)[] = [];
let lineSeriesTotal: ISeriesApi<"Line"> | null = null;

const totalLineColor = "dimgray";

export default defineComponent({
  name: "Chart",

  data() {
    return {
      isLoading: true as boolean,
      serverLines: [] as IServerLine[],
      refreshInterval: null as ReturnType<typeof setInterval> | null,
      lineWidth: 2.5,
      isFullScreen: false as boolean,
      isLineMarked: false as boolean,
      useCommission: true as boolean,
      isAbsoluteMode: false as boolean,
      initialBotCapital: 100 as number,
      isMonitorView: false as boolean,
      isRefreshing: false as boolean,
      botStatusList: [] as IBotStatus[],
      systemStatus: {
        status: "HEALTHY",
        runningBots: 12,
        totalBots: 12,
        timestamp: "",
        activePositionsCount: 0,
      } as IStatusResponse["system"],

      lines: [] as ILine[],

      linesData: [] as ISeries[][],
      linesDataTotal: [] as ISeries[],

      isLineTotalVisible: true as boolean,

      lineSeriesMarked: null as ISeriesApi<"Line"> | null,

      zoom: null as TimeRange | null,
      zoomCondition: false as boolean,

      tradeDirection: "long" as string,

      colors: [
        "maroon",
        "orange",
        "navy",
        "brown",
        "burlywood",
        "purple",
        "chocolate",
        "cadetblue",
        "blueviolet",
        "coral",
        "teal",
        "cornflowerblue",
        "crimson",
        "darkcyan",
        "darkgoldenrod",
        "darkkhaki",
        "darkmagenta",
        "darkolivegreen",
        "darkorange",
        "darkorchid",
        "darkred",
        "darksalmon",
        "darkseagreen",
        "darkslateblue",
        "darkslategray",
        "darkturquoise",
        "darkviolet",
        "deeppink",
        "deepskyblue",
        "dodgerblue",
        "firebrick",
        "goldenrod",
        "hotpink",
        "indianred",
        "indigo",
        "lightcoral",
        "lightpink",
        "lightsalmon",
        "lightseagreen",
        "lightskyblue",
        "lightsteelblue",
        "magenta",
        "mediumaquamarine",
        "mediumblue",
        "mediumorchid",
        "mediumpurple",
        "mediumseagreen",
        "mediumspringgreen",
        "mediumturquoise",
        "mediumvioletred",
        "midnightblue",
        "olivedrab",
        "orangered",
        "orchid",
        "palevioletred",
        "peru",
        "plum",
        "rosybrown",
        "royalblue",
        "saddlebrown",
        "salmon",
        "sandybrown",
        "seagreen",
        "sienna",
        "skyblue",
        "slateblue",
        "slategray",
        "steelblue",
        "tan",
        "tomato",
        "transparent",
        "turquoise",
        "violet",
        "wheat",
        "whitesmoke",
        "yellowgreen",
      ],
    };
  },

  computed: {
    chartOptions(): DeepPartial<ChartOptions> {
      return {
        height: this.isFullScreen ? window.innerHeight : 335,
        width: window.innerWidth,
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
          fixLeftEdge: true,
          fixRightEdge: true,
          rightOffset: 0,
        },
        rightPriceScale: {
          visible: true,
          autoScale: true,
          scaleMargins: {
            top: 0.12,
            bottom: 0.08,
          },
        },
        leftPriceScale: {
          visible: false,
        },
        handleScale: {
          axisPressedMouseMove: {
            time: true,
            price: false, // Prevents accidental drag of price scale from locking vertical autoscale
          },
          axisDoubleClickReset: {
            time: true,
            price: true,
          },
          mouseWheel: true,
          pinch: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        localization: {
          priceFormatter: (price: number) => this.formatProfit(price),
        },
        layout: {
          background: { color: "transparent" },
        },
      };
    },

    portfolioEquity(): string {
      const isAllLines =
        this.hasLineTotalOnly ||
        this.hasNoLines ||
        this.linesEnabled.length === 0;
      const targetLines = isAllLines ? this.lines : this.linesEnabled;
      const count = targetLines.length || 12;
      const baseCapital = count * this.initialBotCapital;
      const profit = parseFloat(this.totalSumProfit) || 0;
      return (baseCapital + profit).toFixed(2);
    },

    totalProfit(): string {
      // Track reactivity on calc mode & commission
      const _isAbs = this.isAbsoluteMode;
      const _comm = this.useCommission;

      // If a single bot is enabled (solo mode), show its profit from cached series
      if (this.linesEnabled.length === 1) {
        const single = this.linesEnabled[0];
        const idx = this.lines.indexOf(single);
        const sData = this.linesData[idx];
        const lastVal =
          sData && sData.length > 0
            ? sData[sData.length - 1].value
            : parseFloat(single.data?.[single.data.length - 1]?.[8]) || 0;
        return lastVal != null && !isNaN(lastVal) ? lastVal.toFixed(2) : "0.00";
      }

      const totalSeries = this.linesDataTotal;
      const lastValue =
        totalSeries && totalSeries.length > 0
          ? totalSeries[totalSeries.length - 1]?.value
          : 0;
      return lastValue != null && !isNaN(lastValue)
        ? lastValue.toFixed(2)
        : "0.00";
    },

    totalSumProfit(): string {
      const _isAbs = this.isAbsoluteMode;
      const _comm = this.useCommission;

      const isAllLines =
        this.hasLineTotalOnly ||
        this.hasNoLines ||
        this.linesEnabled.length === 0;
      const targetLines = isAllLines ? this.lines : this.linesEnabled;
      let sum = 0;
      for (const line of targetLines) {
        const idx = this.lines.indexOf(line);
        const sData = this.linesData[idx];
        if (sData && sData.length > 0) {
          sum += sData[sData.length - 1].value;
        } else if (line.data && line.data.length > 0) {
          sum += parseFloat(line.data[line.data.length - 1][8]) || 0;
        }
      }
      return sum > 0 ? `+${sum.toFixed(2)}` : sum.toFixed(2);
    },

    linesEnabled(): ILine[] {
      return this.lines.filter((line: ILine) => !line.disabled);
    },

    hasLineTotalOnly(): boolean {
      return this.isLineTotalVisible && this.linesEnabled.length === 0;
    },

    hasNoLines(): boolean {
      return !this.isLineTotalVisible && this.linesEnabled.length === 0;
    },
  },

  watch: {
    isFullScreen(isFullscreen: boolean) {
      if (!chart) return;
      if (isFullscreen) {
        document.body.style.overflow = "hidden";
        chart.applyOptions({ height: window.innerHeight, width: window.innerWidth });
        this.applyLongestScale();
      } else {
        document.body.style.overflow = "";
        chart.applyOptions({ height: this.chartOptions.height, width: window.innerWidth });
        this.applyLongestScale();
      }
    },

    useCommission() {
      this.initChart();
    },

    isAbsoluteMode() {
      this.initChart();
    },

    tradeDirection() {
      this.initChart();
    },
  },

  methods: {
    formatProfit(val: number | string | undefined | null): string {
      if (val == null) return this.isAbsoluteMode ? "$0.00" : "0.00%";
      const num = typeof val === "number" ? val : parseFloat(String(val));
      if (isNaN(num)) return this.isAbsoluteMode ? "$0.00" : "0.00%";
      const abs = Math.abs(num).toFixed(2);
      const sign = abs === "0.00" ? "" : num > 0 ? "+" : "-";
      if (this.isAbsoluteMode) {
        return `${sign}$${abs}`;
      }
      return `${sign}${abs}%`;
    },

    setCalcMode(isAbsolute: boolean): void {
      if (this.isAbsoluteMode === isAbsolute) return;
      this.isAbsoluteMode = isAbsolute;
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(
            "crypto_bot_calc_mode",
            this.isAbsoluteMode ? "dollar" : "percent"
          );
        }
      } catch (e) {
        console.warn("Could not save calc mode to localStorage:", e);
      }
    },

    toggleCalcMode(): void {
      this.setCalcMode(!this.isAbsoluteMode);
    },

    getLegendValue(index: number): string {
      const _ = this.isAbsoluteMode;
      const lineData = this.linesData[index] || [];
      const lineValue = lineData[lineData.length - 1]?.value;
      return this.formatProfit(lineValue);
    },

    //// Init chart
    async initChart(): Promise<void> {
      if (!this.lines.length && this.serverLines?.length) {
        this.convertServerDataToLines({ isUpdate: false });
      }

      const chartContainer = document.getElementById("chart-container");
      if (!chartContainer) {
        console.error("chartContainer element not found");
        return;
      }
      if (chart) {
        chart.remove();
        chart = null;
      }
      lineSeries = [];
      lineSeriesTotal = null;
      chart = createChart(chartContainer, this.chartOptions);

      this.setupChartTotal();
      this.setupChartLines();

      this.applyLongestScale();

      this.setupZoomListener();
      this.setupAnnotations();

      this.refreshMarks();
    },

    /// Setup lines
    setupChartLines(): void {
      if (!chart) return;
      const linesData: ISeries[][] = [];

      for (const line of this.lines) {
        const isVisible = !this.hasLineTotalOnly && !line.disabled;

        const newLineSeries = chart.addLineSeries({
          color: line.color,
          priceScaleId: "right",
          lineWidth: this.lineWidth,
          visible: isVisible,
          priceLineVisible: false,
          lastValueVisible: true,
          priceFormat: {
            type: "custom",
            minMove: 0.01,
            formatter: (val: number) => this.formatProfit(val),
          },
          autoscaleInfoProvider: (original) =>
            this.getSeriesAutoscaleInfo(original),
        });

        const seriesData = this.prepareSeriesData(line.data);

        lineSeries.push(newLineSeries);
        newLineSeries.setData(seriesData);

        linesData.push(seriesData);
      }

      this.linesData = linesData;
    },

    setupChartTotal(): void {
      if (!chart) return;
      const isVisible =
        this.isLineTotalVisible && this.linesEnabled.length !== 1;

      lineSeriesTotal = chart.addLineSeries({
        color: totalLineColor,
        priceScaleId: "right",
        lineWidth: this.lineWidth,
        visible: isVisible,
        priceLineVisible: false,
        lastValueVisible: true,
        priceFormat: {
          type: "custom",
          minMove: 0.01,
          formatter: (val: number) => this.formatProfit(val),
        },
        autoscaleInfoProvider: (original) =>
          this.getSeriesAutoscaleInfo(original),
      });

      const seriesDataTotal = isVisible ? this.prepareSeriesDataTotal() : [];

      lineSeriesTotal.setData(seriesDataTotal);
    },

    getGlobalTimeInfo(): { step: number; startTime: number } {
      let minTime = Infinity;
      const nowSec = Math.floor(Date.now() / 1000);

      for (const line of this.lines) {
        if (!line.data || !line.data.length) continue;
        for (const row of line.data) {
          const dateStr = row[1];
          if (dateStr) {
            const t = Math.floor(Date.parse(dateStr) / 1000);
            if (!isNaN(t) && t < minTime) {
              minTime = t;
            }
          }
        }
      }

      const effectiveMin = minTime < Infinity ? minTime : nowSec - 1800;
      const spanSec = Math.max(1, nowSec - effectiveMin);

      let step = 60; // 1 min default
      if (spanSec > 30 * 86400) {
        step = 3600; // 1 hour for > 30 days
      } else if (spanSec > 7 * 86400) {
        step = 900; // 15 mins for > 7 days
      } else if (spanSec > 2 * 86400) {
        step = 300; // 5 mins for > 2 days
      }

      const startTime = Math.floor(effectiveMin / step) * step;

      return { step, startTime };
    },

    //// Prepare line series
    prepareSeriesData(lineData: string[][]): ISeries[] {
      // Deduplicate rows by (count, dateString) to prevent duplicate trades/ticks
      const seenRowKeys = new Set<string>();
      const dedupedData: string[][] = [];
      for (const row of lineData) {
        if (!row || row.length < 2) continue;
        const count = row[0]?.trim();
        const dateStr = row[1]?.trim();
        const key = count && count !== "Count" ? `${count}_${dateStr}` : dateStr;
        if (key && seenRowKeys.has(key)) continue;
        if (key) seenRowKeys.add(key);
        dedupedData.push(row);
      }

      const tradeArray = dedupedData
        .map((row: string[]) => {
          const [
            count,
            dateString,
            tokenName,
            priceChangePercent,
            trade,
            tradePrice,
            commission,
            profitPercent,
            profitTotalPercent,
          ] = row;

          const parsedPrice = parseFloat(tradePrice);
          const parsedCommission = parseFloat(commission);
          const parsedProfitPercent = parseFloat(profitPercent);
          const parsedProfitTotal = parseFloat(profitTotalPercent);

          return {
            dateString,
            trade: trade ? trade.trim() : "",
            tradePrice: isNaN(parsedPrice) ? 0 : parsedPrice,
            commission: isNaN(parsedCommission) ? 0 : parsedCommission,
            profitPercent: isNaN(parsedProfitPercent) ? 0 : parsedProfitPercent,
            profitTotalPercent: isNaN(parsedProfitTotal) ? 0 : parsedProfitTotal,
            tokenName: tokenName ? tokenName.trim() : "",
            count,
            priceChangePercent,
          };
        })
        .filter(
          (item) => item.dateString && !isNaN(Date.parse(item.dateString))
        );

      if (!this.useCommission) {
        let cumulativeCommissionPercent = 0;

        tradeArray.forEach((trade) => {
          const legCommissionPercent =
            trade.tradePrice > 0
              ? (Math.abs(trade.commission) / trade.tradePrice) * 100
              : 0;
          cumulativeCommissionPercent += legCommissionPercent;

          trade.profitTotalPercent += cumulativeCommissionPercent;
        });
      }

      let currentBalance = this.initialBotCapital;
      let prevProfitTotalPercent = 0;

      const mapped = tradeArray.map(
        ({
          dateString,
          trade,
          tradePrice,
          profitPercent,
          profitTotalPercent,
          tokenName,
          count,
        }) => {
          let value = profitTotalPercent;
          if (this.isAbsoluteMode) {
            const deltaPercent = profitTotalPercent - prevProfitTotalPercent;
            if (deltaPercent !== 0) {
              currentBalance = Math.max(0, currentBalance * (1 + deltaPercent / 100));
            }
            prevProfitTotalPercent = profitTotalPercent;
            value = currentBalance - this.initialBotCapital;
          }

          return {
            time: Math.floor(Date.parse(dateString) / 1000),
            trade,
            price: tradePrice,
            value,
            profitPercent,
            count: parseInt(count, 10) || 0,
            tokenName,
          };
        }
      );

      const { step, startTime: globalStartTime } = this.getGlobalTimeInfo();
      const nowSec = Math.floor(Date.now() / 1000);
      const gridNow = Math.ceil(nowSec / step) * step;

      // Handle empty bot (no trades yet)
      if (mapped.length === 0) {
        const start = Math.min(globalStartTime, gridNow - 1800);
        const seriesData: ISeries[] = [];
        for (let t = start; t <= gridNow; t += step) {
          seriesData.push({
            time: t,
            trade: "HOLD",
            price: 0,
            value: 0,
            tokenName: "",
            count: 0,
            profitPercent: 0,
          });
        }
        return seriesData;
      }

      mapped.sort((a, b) => a.time - b.time);

      // Define anchor trade points
      const anchors = [...mapped];

      // Always extend active open position or completed line horizontally up to current time
      const last = anchors[anchors.length - 1];
      if (gridNow > last.time + 30) {
        anchors.push({
          time: gridNow,
          trade: "HOLD",
          price: last.price,
          value: last.value,
          tokenName: last.tokenName,
          count: 0,
          profitPercent: 0,
        });
      }

      // Map anchor points to the uniform global grid
      const gridAnchors: Array<{ gridTime: number; item: typeof anchors[0] }> = [];
      let prevGrid = -1;
      for (const item of anchors) {
        let g: number;
        if (prevGrid === -1) {
          g = Math.floor(item.time / step) * step;
        } else {
          const target = Math.round(item.time / step) * step;
          g = Math.max(prevGrid + step, target);
        }
        gridAnchors.push({ gridTime: g, item });
        prevGrid = g;
      }

      // Sample along the uniform grid with constant step so:
      // 1. Distance strictly corresponds to real elapsed time (no collapsing).
      // 2. Slopes along segments are mathematically constant (100% straight lines, zero kinks, zero stairs).
      const seriesData: ISeries[] = [];
      for (let i = 0; i < gridAnchors.length; i++) {
        const { gridTime: gCurr, item: itemCurr } = gridAnchors[i];
        if (i === 0) {
          seriesData.push({
            time: gCurr,
            value: itemCurr.value,
            price: itemCurr.price,
            profitPercent: itemCurr.profitPercent,
            count: itemCurr.count,
            tokenName: itemCurr.tokenName,
            trade: itemCurr.trade,
          });
        } else {
          const { gridTime: gPrev, item: itemPrev } = gridAnchors[i - 1];
          const nSteps = Math.floor((gCurr - gPrev) / step);
          const valStart = itemPrev.value;
          const valEnd = itemCurr.value;
          const priceStart = itemPrev.price;
          const priceEnd = itemCurr.price;

          for (let k = 1; k <= nSteps; k++) {
            const t = gPrev + k * step;
            const ratio = k / nSteps;
            const v = valStart + (valEnd - valStart) * ratio;
            const p = priceStart + (priceEnd - priceStart) * ratio;
            const isAnchor = k === nSteps;

            seriesData.push({
              time: t,
              value: v,
              price: p,
              profitPercent: isAnchor ? itemCurr.profitPercent : 0,
              count: isAnchor ? itemCurr.count : 0,
              tokenName: isAnchor ? itemCurr.tokenName : itemPrev.tokenName,
              trade: isAnchor ? itemCurr.trade : "",
            });
          }
        }
      }

      return seriesData;
    },

    prepareSeriesDataTotal(): ISeries[] {
      const isAllLinesSelected: boolean =
        this.hasLineTotalOnly || this.hasNoLines;

      const lines: ILine[] = isAllLinesSelected
        ? this.lines
        : this.linesEnabled;

      if (!lines.length) {
        this.linesDataTotal = [];
        return [];
      }

      const allPreparedLines: ISeries[][] = [];
      for (const line of lines) {
        const idx = this.lines.indexOf(line);
        let sData = this.linesData[idx];
        if (!sData || !sData.length) {
          sData = this.prepareSeriesData(line.data);
          this.linesData[idx] = sData;
        }
        if (sData && sData.length) {
          allPreparedLines.push(sData);
        }
      }

      const allTimesSet = new Set<number>();
      for (const series of allPreparedLines) {
        for (const item of series) {
          allTimesSet.add(item.time);
        }
      }

      const allTimesData = Array.from(allTimesSet).sort((a, b) => a - b);
      if (!allTimesData.length) {
        this.linesDataTotal = [];
        return [];
      }

      // Linear interpolation helper to find a series value at any given timestamp
      const getValueAtTime = (series: ISeries[], targetTime: number): number | null => {
        if (!series || !series.length) return null;
        if (targetTime < series[0].time) return null; // Bot hasn't started yet
        if (targetTime >= series[series.length - 1].time) {
          return series[series.length - 1].value;
        }

        // Binary search for the segment [low, high] containing targetTime
        let low = 0;
        let high = series.length - 1;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (series[mid].time === targetTime) {
            return series[mid].value;
          }
          if (series[mid].time < targetTime) {
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }

        const p1 = series[high];
        const p2 = series[high + 1];
        if (!p1 || !p2) return p1?.value ?? p2?.value ?? null;

        const duration = p2.time - p1.time;
        if (duration <= 0) return p1.value;
        const ratio = (targetTime - p1.time) / duration;
        return p1.value + (p2.value - p1.value) * ratio;
      };

      const linesDataTotal: ISeries[] = allTimesData.map((time: number) => {
        let sum = 0;
        let activeCount = 0;
        for (let k = 0; k < allPreparedLines.length; k++) {
          const val = getValueAtTime(allPreparedLines[k], time);
          if (val !== null) {
            sum += val;
            activeCount++;
          }
        }
        const finalValue = this.isAbsoluteMode
          ? sum
          : activeCount > 0
          ? sum / activeCount
          : 0;

        return {
          time,
          value: finalValue,
        };
      });

      this.linesDataTotal = linesDataTotal;

      return linesDataTotal;
    },

    // Convert / apply server data to lines (supports full reload & incremental delta updates)
    convertServerDataToLines({ isUpdate }: { isUpdate: boolean }): boolean {
      if (!this.serverLines || !this.serverLines.length) return false;

      // 1. Initial load or force reload: populate this.lines completely from server
      if (!this.lines.length || !isUpdate) {
        const lines: ILine[] = this.serverLines.map(
          (file: IServerLine, index: number): ILine => {
            const cleanName = this.normalizeBotName(file.name);
            const existingLine = this.lines.find(
              (l: ILine) => this.normalizeBotName(l.name) === cleanName
            );
            return {
              name: cleanName,
              fileName: file.name,
              mtime: file.mtime,
              data: file.data.map((item: string): string[] => item.split(",")),
              color: this.getColor(index),
              disabled: isUpdate ? (existingLine?.disabled ?? true) : true,
            };
          }
        );

        this.lines = lines;
        return true;
      }

      // 2. Incremental update: prune dead/renamed lines that no longer exist on server
      let hasChanges = false;
      const validCleanNames = new Set(
        this.serverLines.map((f: IServerLine) => this.normalizeBotName(f.name))
      );
      if (this.lines.length > 0) {
        const filtered = this.lines.filter((l: ILine) =>
          validCleanNames.has(this.normalizeBotName(l.fileName || l.name))
        );
        if (filtered.length !== this.lines.length) {
          this.lines = filtered;
          hasChanges = true;
        }
      }

      // 3. Deduplicate this.lines by normalized name to guarantee no duplicate legends
      const seenNames = new Set<string>();
      const dedupedLines: ILine[] = [];
      for (const l of this.lines) {
        const norm = this.normalizeBotName(l.fileName || l.name);
        if (!seenNames.has(norm)) {
          seenNames.add(norm);
          dedupedLines.push(l);
        } else {
          hasChanges = true;
        }
      }
      this.lines = dedupedLines;

      // 4. Update or append server lines
      for (const [index, file] of this.serverLines.entries()) {
        const cleanName = this.normalizeBotName(file.name);
        let line = this.lines.find(
          (l: ILine) =>
            this.normalizeBotName(l.fileName || "") === cleanName ||
            this.normalizeBotName(l.name || "") === cleanName
        );

        if (!line) {
          // Dynamic discovery of a newly added bot file
          const newLine: ILine = {
            name: cleanName,
            fileName: file.name,
            mtime: file.mtime,
            data: file.data.map((item: string): string[] => item.split(",")),
            color: this.getColor(this.lines.length),
            disabled: true,
          };
          this.lines.push(newLine);
          hasChanges = true;
          continue;
        }

        // Canonicalize name and fileName to current server file
        line.name = cleanName;
        line.fileName = file.name;
        if (file.mtime) {
          line.mtime = file.mtime;
        }

        if (file.isDelta) {
          // Incremental: only append new rows if any exist
          if (file.data && file.data.length > 0) {
            const existingKeys = new Set(
              line.data.map((r: string[]) => `${r[0]?.trim()}_${r[1]?.trim()}`)
            );
            const newRows = file.data
              .map((item: string): string[] => item.split(","))
              .filter((r: string[]) => {
                const key = `${r[0]?.trim()}_${r[1]?.trim()}`;
                return !existingKeys.has(key);
              });
            if (newRows.length > 0) {
              line.data.push(...newRows);
              hasChanges = true;
            }
          }
        } else {
          // Full replacement for this line (file reset, shrunk or forced reload)
          const allRows = file.data.map((item: string): string[] => item.split(","));
          const seen = new Set<string>();
          const uniqueRows: string[][] = [];
          for (const r of allRows) {
            const key = `${r[0]?.trim()}_${r[1]?.trim()}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueRows.push(r);
            }
          }
          line.data = uniqueRows;
          hasChanges = true;
        }
      }

      return hasChanges;
    },

    loadCachedLines(): boolean {
      try {
        if (typeof window === "undefined" || !window.localStorage) return false;
        // Purge legacy caches from previous sessions and trade resets
        window.localStorage.removeItem("crypto_bot_chart_lines_v1");
        window.localStorage.removeItem("crypto_bot_chart_lines_v2");
        window.localStorage.removeItem("crypto_bot_chart_lines_v3");
        window.localStorage.removeItem("crypto_bot_chart_lines_v4");
        window.localStorage.removeItem("crypto_bot_chart_lines_v5");
        window.localStorage.removeItem("crypto_bot_chart_lines_v6");
        const raw = window.localStorage.getItem("crypto_bot_chart_lines_v7");
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed[0].name &&
          Array.isArray(parsed[0].data)
        ) {
          // Deduplicate cached lines on load
          const seen = new Set<string>();
          const validLines: ILine[] = [];
          for (const l of parsed) {
            const norm = this.normalizeBotName(l.fileName || l.name);
            if (!seen.has(norm)) {
              seen.add(norm);
              validLines.push({
                ...l,
                name: norm,
                disabled: true,
              });
            }
          }
          this.lines = validLines;
          return validLines.length > 0;
        }
      } catch (err) {
        console.warn("Could not load lines from cache:", err);
      }
      return false;
    },

    saveLinesToCache() {
      try {
        if (typeof window === "undefined" || !window.localStorage) return;
        if (!this.lines || !this.lines.length) return;
        const toSave = this.lines.map((l: ILine) => ({
          name: this.normalizeBotName(l.name),
          fileName: l.fileName,
          mtime: l.mtime,
          data: l.data,
          color: l.color,
          disabled: l.disabled,
        }));
        window.localStorage.setItem(
          "crypto_bot_chart_lines_v7",
          JSON.stringify(toSave)
        );
      } catch (err) {
        console.warn("Could not save lines to cache:", err);
      }
    },

    async convertFileDataToLines(event: Event): Promise<void> {
      const target = event.target as HTMLInputElement | null;
      if (!target || !target.files) return;
      const inputFiles = Array.from(target.files);

      if (!inputFiles.length) return;

      const lines = await Promise.all(
        inputFiles.map(async (file: File, index: number): Promise<ILine> => {
          const lineText = await file.text();
          const lineName = file.name.split(".")[0].replace(/^trades[-_]/i, "");

          const line: ILine = {
            name: lineName,
            fileName: file.name,
            data: lineText
              .trim()
              .split(/\r?\n/)
              .slice(1)
              .filter((item: string) => item.trim().length > 0)
              .map((item: string): string[] => item.split(",")),
            color: this.getColor(index),
            disabled: false,
          };

          return line;
        })
      );

      chart = null;
      lineSeries = [];
      lineSeriesTotal = null;
      this.isLineMarked = false;
      this.linesData = [];
      this.linesDataTotal = [];
      this.isLineTotalVisible = true;
      this.zoom = null;
      this.zoomCondition = false;
      this.lineSeriesMarked = null;

      this.lines = lines;

      const chartContainer = document.getElementById("chart-container");
      if (chartContainer) {
        chartContainer.innerHTML = "";
        chart = createChart(chartContainer, this.chartOptions);

        this.setupChartLines();
        this.setupChartTotal();

        this.applyLongestScale();
        this.setupZoomListener();

        this.refreshMarks();
      }
    },

    //// Updates
    updateChart(): void {
      if (lineSeries.length !== this.lines.length) {
        this.initChart();
        return;
      }
      this.updateLines();
      this.updateLineTotal();
      this.refreshMarks();
    },

    updateLineTotalVisibility(): void {
      if (this.linesEnabled.length === 1) {
        // Exiting solo mode: return to Total Line view
        this.lines.forEach((l) => {
          l.disabled = true;
        });
        this.isLineTotalVisible = true;
        for (let i = 0; i < this.lines.length; i++) {
          lineSeries[i]?.applyOptions({ visible: false });
        }
        this.updateLineTotal();
        this.applyLongestScale();
        this.refreshMarks();
        return;
      }

      this.isLineTotalVisible = !this.isLineTotalVisible;
      this.updateLineTotal();
      this.applyLongestScale();
      this.refreshMarks();
    },

    computeZoomCondition(): boolean {
      return this.linesEnabled && this.linesEnabled.length === 1;
    },

    refreshMarks(): void {
      if (!chart || this.isMonitorView) return;
      if (this.linesEnabled.length === 1) {
        this.setMarks();
      } else {
        this.clearMarks();
      }
    },

    getSeriesAutoscaleInfo(
      original?: (() => AutoscaleInfo | null) | null
    ): AutoscaleInfo {
      const res = original?.();
      if (!res || !res.priceRange) {
        return {
          priceRange: { minValue: -0.5, maxValue: 0.5 },
          margins: { above: 48, below: 24 },
        };
      }
      const { minValue, maxValue } = res.priceRange;
      if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
        return {
          priceRange: { minValue: -0.5, maxValue: 0.5 },
          margins: { above: 48, below: 24 },
        };
      }
      // If flat line (e.g. 0% or min === max), expand symmetrically around value
      if (Math.abs(maxValue - minValue) < 0.0001) {
        const delta =
          Math.abs(minValue) > 0.01 ? Math.abs(minValue) * 0.15 : 0.25;
        return {
          priceRange: {
            minValue: minValue - delta,
            maxValue: maxValue + delta,
          },
          margins: { above: 48, below: 24 },
        };
      }
      // Clean headroom: 48px above (prevents collision with top buttons), 24px below
      return {
        priceRange: {
          minValue,
          maxValue,
        },
        margins: { above: 48, below: 24 },
      };
    },

    getLongestTimeRange(): { from: number; to: number } {
      let minTime = Infinity;
      let maxTime = -Infinity;

      const isAllLines =
        this.hasLineTotalOnly ||
        this.hasNoLines ||
        this.linesEnabled.length === 0;
      const targetLines = isAllLines ? this.lines : this.linesEnabled;

      for (const line of targetLines) {
        if (!line?.data || line.data.length === 0) continue;
        const idx = this.lines.indexOf(line);
        const seriesData = this.linesData[idx] || this.prepareSeriesData(line.data);
        if (!seriesData || seriesData.length === 0) continue;

        const first = seriesData[0].time;
        const last = seriesData[seriesData.length - 1].time;

        if (first < minTime) minTime = first;
        if (last > maxTime) maxTime = last;
      }

      const nowSec = Math.floor(Date.now() / 1000);

      // If no data exists across any line, default to recent 30-minute window
      if (!Number.isFinite(minTime) || !Number.isFinite(maxTime)) {
        return { from: nowSec - 1800, to: nowSec + 120 };
      }

      // If span is tiny (< 30s), give 1-minute window
      if (maxTime - minTime < 30) {
        return { from: minTime - 30, to: maxTime + 30 };
      }

      return {
        from: minTime,
        to: maxTime,
      };
    },

    applyLongestScale(): void {
      if (!chart || this.isMonitorView) return;
      const container = document.getElementById("chart-container");
      if (!container || container.offsetWidth === 0) return;

      try {
        chart.timeScale().fitContent();
      } catch (e) {
        const range = this.getLongestTimeRange();
        if (range && Number.isFinite(range.from) && Number.isFinite(range.to)) {
          chart.timeScale().setVisibleRange(range);
        }
      }

      // Automatically recalibrate and scale vertical height for currently visible lines
      chart.priceScale("right").applyOptions({ autoScale: true });
    },

    zoomToLine(_line?: ILine): void {
      this.applyLongestScale();
    },

    updateLineVisibility(index: number): void {
      const line = this.lines[index];
      if (!line) return;

      // Fast toggle without destroying chart or re-parsing datasets
      line.disabled = !line.disabled;

      if (lineSeries[index]) {
        const isVisible = !this.hasLineTotalOnly && !line.disabled;
        lineSeries[index]?.applyOptions({ visible: isVisible });
      }

      this.updateLineTotal();
      this.refreshMarks();
      chart?.priceScale("right").applyOptions({ autoScale: true });
    },

    soloLine(index: number): void {
      const line = this.lines[index];
      if (!line) return;

      const isAlreadySolo =
        this.linesEnabled.length === 1 && this.linesEnabled[0] === line;

      if (isAlreadySolo) {
        // Re-enable all lines
        this.lines.forEach((l) => {
          l.disabled = false;
        });
      } else {
        // Solo this line
        this.lines.forEach((l, i) => {
          l.disabled = i !== index;
        });
      }

      // Fast path: update all line series visibility in-place
      for (let i = 0; i < this.lines.length; i++) {
        const isVisible = !this.hasLineTotalOnly && !this.lines[i].disabled;
        lineSeries[i]?.applyOptions({ visible: isVisible });
      }

      this.updateLineTotal();
      this.refreshMarks();
      this.applyLongestScale();
    },

    async selectBotChart(botName: string): Promise<void> {
      const clean = this.normalizeBotName(botName);
      const targetIndex = this.lines.findIndex(
        (l) => this.normalizeBotName(l.name || "") === clean
      );
      if (targetIndex === -1) return;

      // 1. Switch to Chart View first so DOM starts rendering #chart-container
      this.isMonitorView = false;

      // 2. Solo this line
      this.lines.forEach((l, i) => {
        l.disabled = i !== targetIndex;
      });

      // 3. Ensure chart container is rendered in DOM and has positive dimensions
      await this.$nextTick();

      if (!chart || lineSeries.length !== this.lines.length) {
        await this.initChart();
      } else {
        for (let i = 0; i < this.lines.length; i++) {
          lineSeries[i]?.applyOptions({ visible: i === targetIndex });
        }
        this.updateLineTotal();
        this.refreshMarks();
        this.applyLongestScale();
      }
    },

    updateLines(): void {
      const linesData: ISeries[][] = [];

      for (const [index, line] of this.lines.entries()) {
        const seriesData = this.prepareSeriesData(line.data);
        const isVisible = !this.hasLineTotalOnly && !line.disabled;

        if (lineSeries[index]) {
          lineSeries[index]?.applyOptions({
            visible: isVisible,
            priceFormat: {
              type: "custom",
              minMove: 0.01,
              formatter: (val: number) => this.formatProfit(val),
            },
          });
          lineSeries[index]?.setData(seriesData);
        } else if (chart) {
          const newLineSeries = chart.addLineSeries({
            color: line.color,
            priceScaleId: "right",
            lineWidth: this.lineWidth,
            visible: isVisible,
            priceLineVisible: false,
            lastValueVisible: true,
            priceFormat: {
              type: "custom",
              minMove: 0.01,
              formatter: (val: number) => this.formatProfit(val),
            },
            autoscaleInfoProvider: (original) =>
              this.getSeriesAutoscaleInfo(original),
          });
          newLineSeries.setData(seriesData);
          lineSeries.push(newLineSeries);
        }
        linesData.push(seriesData);
      }

      this.linesData = linesData;
    },

    updateLineTotal(): void {
      const isVisible =
        this.isLineTotalVisible && this.linesEnabled.length !== 1;

      lineSeriesTotal?.applyOptions({
        visible: isVisible,
        priceFormat: {
          type: "custom",
          minMove: 0.01,
          formatter: (val: number) => this.formatProfit(val),
        },
      });

      const seriesDataTotal = isVisible ? this.prepareSeriesDataTotal() : [];
      lineSeriesTotal?.setData(seriesDataTotal);
    },

    async refreshAllData(): Promise<void> {
      this.isRefreshing = true;
      try {
        await Promise.all([this.fetchData(), this.fetchBotStatus()]);
        const hasUpdates = this.convertServerDataToLines({ isUpdate: true });
        if (hasUpdates) {
          this.updateChart();
          this.saveLinesToCache();
        }
      } finally {
        this.isRefreshing = false;
      }
    },

    setupChartUpdate(): void {
      this.refreshInterval = setInterval(async () => {
        await this.refreshAllData();
      }, 20000);
    },

    //// Listeners
    setupResizeListener(): void {
      const handler = () => {
        if (!chart || this.isMonitorView) return;
        chart.resize(window.innerWidth, this.chartOptions.height, true);
        this.applyLongestScale();
      };

      window.addEventListener("resize", handler);
    },

    async setupZoomListener(): Promise<void> {
      if (!chart) return;
      let zoomDebounceTimer: ReturnType<typeof setTimeout> | null = null;
      const myVisibleTimeRangeChangeHandler = (newVisibleTimeRange: TimeRange | null) => {
        if (!newVisibleTimeRange || this.isMonitorView) return;
        if (zoomDebounceTimer) clearTimeout(zoomDebounceTimer);
        zoomDebounceTimer = setTimeout(() => {
          this.refreshMarks();
        }, 120);
      };

      await chart
        .timeScale()
        .subscribeVisibleTimeRangeChange(myVisibleTimeRangeChangeHandler);
    },

    setupAnnotations(): void {
      if (!chart) return;
      chart.subscribeCrosshairMove((param: MouseEventParams) => {
        const annotation: HTMLElement | null = document.querySelector(".annotation");
        const annotationToken: HTMLElement | null =
          document.querySelector(".annotation--token");
        const annotationPrice: HTMLElement | null =
          document.querySelector(".annotation--price");

        if (!annotation || !annotationToken || !annotationPrice) {
          return;
        }

        if (!param || !param.seriesData || !param.point) {
          annotation.style.display = "none";
          return;
        }

        let annotationTokenText = "";
        let annotationPriceText = "";
        let color = "transparent";

        lineSeries.forEach((series, index) => {
          if (!series) return;
          const seriesData = param.seriesData.get(series);

          if (this.lines[index]?.disabled) return;

          const line = this.linesData[index]?.find(
            (item) =>
              item.time === (seriesData as { time?: number })?.time &&
              item.value === (seriesData as { value?: number })?.value
          );

          if (line?.trade) {
            annotationTokenText += `${line.tokenName}<br>`;
            const formattedPrice =
              typeof line.price === "number"
                ? (line.price < 0.01 ? line.price.toFixed(8) : line.price.toFixed(4))
                : "";
            annotationPriceText += `${formattedPrice}<br>`;
            color = this.lines[index]?.color || "transparent";
          }
        });

        if (annotationTokenText) {
          annotationToken.innerHTML = annotationTokenText;
          annotationPrice.innerHTML = annotationPriceText;
          annotation.style.display = "block";
          annotationToken.style.background = color;
          annotationPrice.style.background = color;
        } else {
          annotation.style.display = "none";
        }
      });
    },

    // Line marks
    setMarks(): void {
      // Clear markers on all series first
      lineSeries.forEach((s) => s?.setMarkers([]));
      this.lineSeriesMarked = null;
      this.isLineMarked = false;

      // Only show markers when an individual bot chart is selected
      if (this.linesEnabled.length === 1) {
        const line = this.linesEnabled[0];
        const index = this.lines.indexOf(line);
        if (index === -1 || !lineSeries[index]) return;

        const lineData = this.linesData[index] || this.prepareSeriesData(line.data);
        const markers: SeriesMarker<Time>[] = lineData
          .filter(({ trade }) => trade === "BUY" || trade === "SELL")
          .map(({ trade, time, count }) => ({
            time: time as UTCTimestamp,
            position: (trade === "BUY" ? "belowBar" : "aboveBar") as SeriesMarkerPosition,
            color: trade === "BUY" ? "green" : "red",
            shape: (trade === "BUY" ? "arrowUp" : "arrowDown") as SeriesMarkerShape,
            id: `${time}-${trade}-${count || 0}`,
          }));

        this.lineSeriesMarked = lineSeries[index];
        this.lineSeriesMarked?.setMarkers(markers);
        this.isLineMarked = true;
      }
    },

    clearMarks(): void {
      lineSeries.forEach((s) => s?.setMarkers([]));
      this.lineSeriesMarked = null;
      this.isLineMarked = false;
    },

    //// Colors
    getColor(index: number): string {
      if (index < this.colors.length) {
        return this.colors[index];
      }

      return this.colors[index % this.colors.length];
    },

    //// API
    async fetchData(forceFull = false) {
      try {
        let url = "/lines";
        if (!forceFull && this.lines && this.lines.length > 0) {
          const counts: Record<string, number> = {};
          const mtimes: Record<string, number> = {};
          const lasts: Record<string, string> = {};
          const firsts: Record<string, string> = {};

          for (const line of this.lines) {
            const key =
              line.fileName || (line.name ? `trades-${line.name}.csv` : "");
            if (key) {
              const len = line.data ? line.data.length : 0;
              counts[key] = len;
              if (line.mtime) {
                mtimes[key] = line.mtime;
              }
              if (len > 0) {
                const firstRow = line.data[0];
                if (firstRow && firstRow[1]) {
                  firsts[key] = String(firstRow[1]).trim();
                }
                const lastRow = line.data[len - 1];
                if (lastRow && lastRow[1]) {
                  lasts[key] = String(lastRow[1]).trim();
                }
              }
            }
          }
          const params = new URLSearchParams();
          params.set("counts", JSON.stringify(counts));
          if (Object.keys(mtimes).length > 0) {
            params.set("mtimes", JSON.stringify(mtimes));
          }
          if (Object.keys(firsts).length > 0) {
            params.set("firsts", JSON.stringify(firsts));
          }
          if (Object.keys(lasts).length > 0) {
            params.set("lasts", JSON.stringify(lasts));
          }
          url = `/lines?${params.toString()}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const serverLines: IServerLine[] = await response.json();
        this.serverLines = serverLines;
        this.isLoading = false;
      } catch (error) {
        console.error("Error fetching lines:", error);
        this.isLoading = false;
        this.serverLines = [];
      }
    },

    async fetchBotStatus() {
      try {
        const response = await fetch("/status");
        if (response.ok) {
          const data = await response.json();
          if (data?.system) {
            this.systemStatus = data.system;
          }
          if (Array.isArray(data?.bots)) {
            this.botStatusList = data.bots;
          }
        }
      } catch (error) {
        console.warn("Could not fetch bot status:", error);
      }
    },

    normalizeBotName(name: string): string {
      if (!name) return "";
      return name
        .trim()
        .toLowerCase()
        .replace(/\.csv$/i, "")
        .replace(/^trades[-_]/i, "")
        .replace(/^(orderbook|ob|mm|vol)[-_]/i, "");
    },

    getBotPosition(lineName: string): IBotPosition | null {
      if (!lineName || !this.botStatusList) return null;
      const clean = this.normalizeBotName(lineName);
      const found = this.botStatusList.find(
        (b: IBotStatus) =>
          this.normalizeBotName(b.name || "") === clean ||
          this.normalizeBotName(b.id || "") === clean
      );
      return found?.position || null;
    },

    getBotColor(botName: string): string {
      const clean = this.normalizeBotName(botName);
      const line = this.lines.find(
        (l: ILine) => this.normalizeBotName(l.name || "") === clean
      );
      return line?.color || "#888";
    },

    formatTarget(val: number | string | null | undefined): string {
      if (val == null) return "-";
      const num = typeof val === "number" ? val : parseFloat(val);
      if (isNaN(num)) return "-";
      if (num < 0.001) return num.toFixed(8);
      if (num < 1) return num.toFixed(6);
      return num.toFixed(4);
    },

    formatTime(dateStr: string): string {
      if (!dateStr) return "";
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch {
        return "";
      }
    },

    formatBotName(name: string): string {
      if (!name) return "";
      return name
        .replace(/\.csv$/i, "")
        .replace(/^trades[-_]/i, "")
        .replace(/^(ORDERBOOK|OB|MM|VOL)[-_]/i, "")
        .toUpperCase();
    },

    toggleCommission(): void {
      this.useCommission = !this.useCommission;
    },

    getBotPnl(bot: IBotStatus | null | undefined): number {
      const _ = this.isAbsoluteMode;
      if (!bot) return 0;
      const clean = this.normalizeBotName(bot.name || bot.id || "");
      const lineIndex = this.lines.findIndex(
        (l: ILine) => this.normalizeBotName(l.name || "") === clean
      );
      if (lineIndex !== -1 && this.linesData[lineIndex]?.length > 0) {
        const lineData = this.linesData[lineIndex];
        const lastPoint = lineData[lineData.length - 1];
        if (lastPoint && lastPoint.value != null && !isNaN(lastPoint.value)) {
          return lastPoint.value;
        }
      }
      return bot.totalProfit ?? 0;
    },

    toggleMonitorView(): void {
      this.isMonitorView = !this.isMonitorView;
      if (!this.isMonitorView) {
        this.$nextTick(() => {
          this.initChart();
        });
      } else {
        this.refreshAllData();
      }
    },
  },

  //// Life cycle
  async mounted(): Promise<void> {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const savedMode = window.localStorage.getItem("crypto_bot_calc_mode");
        if (savedMode === "dollar") {
          this.isAbsoluteMode = true;
        } else if (savedMode === "percent") {
          this.isAbsoluteMode = false;
        }
      }
    } catch (e) {
      console.warn("Could not load calc mode from localStorage:", e);
    }

    const hasCache = this.loadCachedLines();
    if (hasCache) {
      this.isLoading = false;
      await this.$nextTick();
      await this.initChart();
    }

    await this.fetchData(!hasCache);
    this.fetchBotStatus();

    if (!hasCache) {
      await this.initChart();
      this.saveLinesToCache();
    } else {
      const hasUpdates = this.convertServerDataToLines({ isUpdate: true });
      if (hasUpdates) {
        this.updateChart();
        this.saveLinesToCache();
      }
    }

    this.setupResizeListener();
    this.setupChartUpdate();
  },

  unmounted(): void {
    chart?.remove();
    chart = null;
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  },
});
</script>

<style lang="scss">
.annotation {
  position: absolute;
  top: 20px;
  right: 100px;
  text-align: right;
  color: white;

  * {
    padding: 5px 10px;
    display: inline-block;
  }

  .annotation--price {
    margin-left: 2px;
  }
}

.no-data {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 72px;
  font-weight: bold;
  opacity: 0.5;
}

.clip-right,
.clip-right:before {
  clip-path: polygon(100% 0, 100% 30px, calc(100% - 21px) 100%, 0 100%, 0 0);
}

.clip-left,
.clip-left:before {
  clip-path: polygon(21px 0%, 100% 0, 100% 100%, 0 100%, 0% 12px);
}

.top-bar-menu {
  position: absolute;
  top: 7px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 9999;
  flex-wrap: nowrap;

  @media (max-width: 768px) {
    left: 8px;
    top: 6px;
    gap: 6px;
    flex-wrap: nowrap;

    .system-status-btn {
      margin-left: 0;
      font-size: 10px;
      padding: 0 6px;
      height: 24px;

      .status-view-active {
        display: none;
      }
    }

    .calc-mode-container {
      .calc-mode-button {
        width: 22px;
        height: auto;
      }
    }
  }

  .use-commission-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;

    .use-commission-button {
      width: 25px;
      height: auto;
    }
  }

  .calc-mode-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;

    .calc-mode-button {
      width: 25px;
      height: auto;
      transition: opacity 0.15s ease, transform 0.15s ease;

      &:hover {
        opacity: 0.8;
        transform: scale(1.05);
      }
    }
  }

  .system-status-btn {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    gap: 6px;
    height: 25px;
    background: dimgray;
    color: white;
    text-transform: uppercase;
    padding: 0 8px;
    font-size: 11px;
    font-weight: 600;
    margin-left: 0;
    letter-spacing: 0.5px;
    user-select: none;
    border: none;
    box-shadow: none;
    border-radius: 0;
    &--active {
      background: #333;
      color: #fff;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: solid 1px var(--background-color);
      display: inline-block;
      flex-shrink: 0;

      &--green {
        background-color: var(--green-color);
      }

      &--yellow {
        background-color: #d97706;
      }
    }

    .status-btn-text {
      white-space: nowrap;
    }

    .status-btn-badge {
      background: var(--background-color);
      color: dimgray;
      padding: 1px 5px;
      font-size: 10px;
      font-weight: bold;
      white-space: nowrap;
    }

    .status-view-active {
      font-size: 10px;
      opacity: 0.85;
      white-space: nowrap;
    }
  }
}

.top-bar-right {
  position: absolute;
  top: 7px;
  right: 10px;
  display: flex;
  align-items: center;
  z-index: 9999;

  .full-screen-button {
    width: 28px;
    height: auto;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    top: 6px;
    right: 8px;

    .full-screen-button {
      width: 24px;
    }
  }
}

.loader-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-weight: bolder;
  font-family: Arial;
  margin-left: -3vw;
  z-index: 999;

  .loader {
    position: relative;
    transform: scale(1.3);

    :nth-child(1) {
      color: lightgrey;
      font-size: 59px;
      line-height: 44px;
      padding-inline-start: 45.9px;
    }

    :nth-child(2) {
      font-size: 51px;
      line-height: 47px;
      color: darkgray;
      padding-inline-start: 0px;
    }

    .icon {
      position: absolute;
      top: 0;
      left: 1px;
      width: 42px;
      filter: grayscale(1);
    }
  }
}

.info-container {
  display: flex;
  flex-wrap: wrap;
  gap: 1px;
  user-select: none;
  -webkit-user-select: none;

  .input {
    background: var(--background-color);
    position: relative;
    padding: 5px;
    height: 42px;
    padding-left: 50px;
    width: 100%;

    &:before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      z-index: 10;
      width: 100%;
      height: 100%;
      background: burlywood;
    }

    &:after {
      content: "OPEN FILES";
      text-align: right;
      font-weight: bolder;
      white-space: initial;
      color: var(--background-color);
      font-size: 264%;
      line-height: 58px;
      bottom: -18px;
      right: 12px;
      position: absolute;
      z-index: 20;
    }
  }

  .total {
    text-align: end;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    background: var(--total-line-color);
    user-select: none;
    -webkit-user-select: none;

    &--disabled {
      background: none;
    }
  }
}

.legend {
  position: relative;
  font-size: 14px;
  line-height: 18px;
  font-weight: 300;
  display: flex;
  flex-wrap: wrap;
  text-transform: uppercase;
  gap: 1px;
  margin-top: 1px;
  user-select: none;
  -webkit-user-select: none;

  * {
    user-select: none;
    -webkit-user-select: none;
  }
}

.line {
  flex-grow: 1;
  flex-basis: 0;
  user-select: none;
  -webkit-user-select: none;

  &--disabled {
    background-color: lightgrey !important;
  }
}

.line__details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 12px;
  padding-inline: 5px;
  flex-wrap: nowrap;
  flex-grow: 1;

  .line__name,
  .line__last-value {
    background: var(--background-color);
    padding-inline: 7px;
    white-space: nowrap;
  }

  .micro-pos-tag {
    background: var(--background-color);
    font-size: 14px;
    font-weight: 600;
    padding-inline: 7px;
    margin-left: 6px;
    letter-spacing: 0.3px;
    white-space: nowrap;
    border: none;

    &--long {
      color: var(--green-color);
    }

    &--short {
      color: var(--red-color);
    }
  }

  .line__last-value {
    font-weight: bold;
    margin-left: auto;
    margin-right: 16px;
  }

  .round {
    display: inline-block;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    border: solid 1px var(--background-color);
    background-color: var(--background-color);

    &--red {
      background-color: var(--red-color);
    }

    &--green {
      background-color: var(--green-color);
    }
  }
}

// Colors
#colors {
  color: deeppink;
  color: darkmagenta;
  color: darkorchid;
  color: darkviolet;
  color: blueviolet;
  color: mediumslateblue;
  color: mediumpurple;
  color: mediumorchid;
  color: magenta;
  color: fuchsia;
  color: purple;
  color: indigo;
  color: violet;
  color: navy;
  color: mediumblue;
  color: blue;
  color: dodgerblue;
  color: deepskyblue;
  color: powderblue;
  color: skyblue;
  color: lightblue;
  color: aquamarine;
  color: chartreuse;
  color: lime;
  color: greenyellow;
  color: lightgreen;
  color: green;
  color: yellow;
  color: orange;
  color: red;
}

// hide Lightweight Chart logo
#tv-attr-logo {
  display: none !important;
}

// ==========================================
// Flat System & Bots Monitor View (in place of chart)
// ==========================================
.monitor-view {
  width: 100%;
  box-sizing: border-box;
  padding: 40px 10px 16px 10px;
  display: flex;
  flex-direction: column;
  background: var(--background-color);
  font-family: Arial, sans-serif;
  text-transform: uppercase;
  color: dimgray;

  @media (max-width: 768px) {
    padding: 38px 8px 16px 8px;
  }

  .monitor-summary-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: dimgray;
    color: white;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    flex-shrink: 0;

    .text-green { color: var(--green-color); }
    .text-red { color: var(--red-color); }
    .text-yellow { color: #d97706; }

    @media (max-width: 768px) {
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
      padding: 8px 10px;

      .summary-left {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        font-size: 10px;

        .summary-sep {
          display: none;
        }

        .summary-item {
          background: rgba(0, 0, 0, 0.2);
          padding: 2px 5px;
        }
      }
    }

    .summary-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      .summary-sep {
        opacity: 0.5;
      }
    }
  }

  .monitor-bots-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    align-content: start;
    gap: 8px;

    @media (max-width: 900px) {
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
    }

    @media (max-width: 420px) {
      grid-template-columns: 1fr;
    }

    .bot-card {
      height: 164px;
      min-height: 164px;
      max-height: 164px;
      box-sizing: border-box;
      overflow: hidden;
      background: #ffffff;
      border: none;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      padding: 0;
      position: relative;
      min-width: 0;
      user-select: none;
      -webkit-user-select: none;

      &--in-pos {
        border: none;
      }

      .bot-card__color-bar {
        height: 4px;
        width: 100%;
        flex-shrink: 0;
      }

      .bot-card__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 10px;
        background: #fbf9f5;
        border-bottom: 1px solid #ede8e0;

        .bot-card__name {
          font-size: 11px;
          font-weight: 700;
          color: #111827;
          letter-spacing: 0.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
          background: #f0ebe1;
          padding: 2px 7px;
        }

        .bot-card__header-right {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
        }

        .bot-card__pnl {
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
          flex-shrink: 0;
          background: #f0ebe1;
          padding: 2px 7px;
        }
      }

      .bot-card__body {
        flex: 1;
        padding: 5px 8px 6px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;

        .pos-row--main {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 5px;

          .pos-side {
            font-size: 10px;
            font-weight: 800;
            padding: 2px 6px;
            color: white;

            &--long {
              background: var(--green-color);
            }

            &--short {
              background: var(--red-color);
            }
          }

          .pos-symbol {
            font-size: 11px;
            font-weight: 800;
            color: #111827;
            background: #f0ebe1;
            padding: 2px 7px;
          }
        }

        .pos-details-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 3px;
          font-size: 10px;

          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f7f5f0;
            padding: 3px 7px;
            border-bottom: none;
            border-radius: 2px;

            .detail-label {
              color: #374151;
              font-weight: 700;
              font-size: 10px;
              letter-spacing: 0.4px;
            }

            .detail-val {
              font-weight: 800;
              color: #000000;
              font-size: 11px;
            }
          }
        }

        .bot-card__scanning {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10.5px;
          color: #4b5563;
          text-align: center;
          font-weight: 700;
          letter-spacing: 0.8px;
          padding: 14px 0;
        }
      }

      .bot-card__footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 5px 8px;
        border-top: 1px solid #ede8e0;
        font-size: 9.5px;
        color: #4b5563;
        font-weight: 700;
        background: #faf8f5;
        flex-shrink: 0;
      }
    }
  }
}

.text-green { color: var(--green-color); }
.text-red { color: var(--red-color); }
.text-yellow { color: #d97706; }
</style>
