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
          BOTS: <strong>{{ systemStatus.runningBots || botStatusList.length || 12 }}/{{ systemStatus.totalBots || botStatusList.length || 12 }} RUNNING</strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          IN POSITION: <strong>{{ systemStatus.activePositionsCount }} / {{ botStatusList.length || 12 }}</strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          AVG PROFIT:
          <strong :class="parseFloat(totalProfit) >= 0 ? 'text-green' : 'text-red'">
            {{ parseFloat(totalProfit) > 0 ? '+' : '' }}{{ totalProfit }}%
          </strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          TOTAL SUM:
          <strong :class="parseFloat(totalSumProfit) >= 0 ? 'text-green' : 'text-red'">
            {{ totalSumProfit }}%
          </strong>
        </span>
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
              {{ getBotPnl(bot) > 0 ? '+' : '' }}{{ getBotPnl(bot).toFixed(2) }}%
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
          {{ systemStatus.runningBots || botStatusList.length || 12 }}/{{ systemStatus.totalBots || botStatusList.length || 12 }} BOTS
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
          'total--disabled': !isLineTotalVisible || linesEnabled.length === 1,
        }"
        @click="updateLineTotalVisibility"
        :title="'Average active bots profit: ' + totalProfit + '%, Total cumulative: ' + totalSumProfit + '%'"
      >
        <div class="line__details info">
          <span class="line__name">AVG (Σ {{ totalSumProfit }}%)</span>
          <span class="line__last-value">{{ parseFloat(totalProfit) > 0 ? '+' : '' }}{{ totalProfit }}</span>
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

<script setup lang="ts">
import { createChart } from "lightweight-charts";

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
</script>

<script lang="ts">
let chart = null;
let lineSeries = [];
let lineSeriesTotal = null;

const totalLineColor = "dimgray";

export default {
  name: "Chart",

  data() {
    return {
      isLoading: true,
      serverLines: [],
      refreshInterval: null,
      lineWidth: 2.5,
      isFullScreen: false,
      isLineMarked: false,
      useCommission: true,
      isMonitorView: false,
      isRefreshing: false,
      botStatusList: [],
      systemStatus: {
        status: "HEALTHY",
        runningBots: 12,
        totalBots: 12,
        timestamp: "",
        activePositionsCount: 0,
      },

      lines: [],

      linesData: [],
      linesDataTotal: [],

      isLineTotalVisible: true,

      lineSeriesMarked: null,

      zoom: null,
      zoomCondition: false,

      tradeDirection: "long",

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
    chartOptions() {
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
        layout: {
          background: { color: "transparent" },
        },
      };
    },

    totalProfit() {
      // If a single bot is enabled (solo mode), show its profit
      if (this.linesEnabled.length === 1) {
        const single = this.linesEnabled[0];
        const series = this.prepareSeriesData(single.data);
        const lastVal = series.length > 0 ? series[series.length - 1].value : 0;
        return lastVal != null && !isNaN(lastVal) ? lastVal.toFixed(2) : "0.00";
      }

      if (this.linesDataTotal && this.linesDataTotal.length > 0) {
        const lastValue =
          this.linesDataTotal[this.linesDataTotal.length - 1]?.value;
        if (lastValue != null && !isNaN(lastValue)) {
          return lastValue.toFixed(2);
        }
      }

      // Fallback: calculate directly from prepareSeriesDataTotal
      const fallbackSeries = this.prepareSeriesDataTotal();
      const lastValue = fallbackSeries[fallbackSeries.length - 1]?.value;
      return lastValue != null && !isNaN(lastValue)
        ? lastValue.toFixed(2)
        : "0.00";
    },

    totalSumProfit() {
      const isAllLines =
        this.hasLineTotalOnly ||
        this.hasNoLines ||
        this.linesEnabled.length === 0;
      const targetLines = isAllLines ? this.lines : this.linesEnabled;
      let sum = 0;
      for (const line of targetLines) {
        if (!line?.data || line.data.length === 0) continue;
        const series = this.prepareSeriesData(line.data);
        if (series.length > 0) {
          sum += series[series.length - 1].value;
        }
      }
      return sum > 0 ? `+${sum.toFixed(2)}` : sum.toFixed(2);
    },

    linesEnabled() {
      return this.lines.filter((line: ILine) => !line.disabled);
    },

    hasLineTotalOnly() {
      return this.isLineTotalVisible && this.linesEnabled.length === 0;
    },

    hasNoLines() {
      return !this.isLineTotalVisible && this.linesEnabled.length === 0;
    },
  },

  watch: {
    isFullScreen(isFullscreen) {
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
      this.updateChart();
    },

    tradeDirection() {
      this.updateChart();
    },
  },

  methods: {
    getLegendValue(index) {
      const lineData = this.linesData[index] || [];
      const lineValue = lineData[lineData.length - 1]?.value;
      const result =
        lineValue != null && !isNaN(lineValue)
          ? Number(lineValue).toFixed(2)
          : "0.00";

      return result;
    },

    //// Init chart
    async initChart() {
      this.convertServerDataToLines({ isUpdate: false });

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
    setupChartLines() {
      const linesData = [];

      for (const line of this.lines) {
        const isVisible = !this.hasLineTotalOnly && !line.disabled;

        const newLineSeries = chart.addLineSeries({
          color: line.color,
          priceScaleId: "right",
          lineWidth: this.lineWidth,
          visible: isVisible,
          priceLineVisible: false,
          lastValueVisible: true,
          autoscaleInfoProvider: (original) =>
            this.getSeriesAutoscaleInfo(original),
        });

        const seriesData = this.prepareSeriesData(line.data);

        lineSeries.push(newLineSeries);
        newLineSeries.setData(isVisible ? seriesData : []);

        linesData.push(seriesData);
      }

      this.linesData = linesData;
    },

    setupChartTotal() {
      const isVisible =
        this.isLineTotalVisible && this.linesEnabled.length !== 1;

      lineSeriesTotal = chart.addLineSeries({
        color: totalLineColor,
        priceScaleId: "right",
        lineWidth: this.lineWidth,
        visible: isVisible,
        priceLineVisible: false,
        lastValueVisible: true,
        autoscaleInfoProvider: (original) =>
          this.getSeriesAutoscaleInfo(original),
      });

      const seriesDataTotal = isVisible ? this.prepareSeriesDataTotal() : [];

      lineSeriesTotal.setData(seriesDataTotal);
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

        tradeArray.forEach((trade, index) => {
          // Commission is only deducted in report.js on position CLOSE (not on OPEN)
          const isClose =
            parseInt(trade.count, 10) % 2 === 0 ||
            index % 2 === 1 ||
            trade.profitPercent !== 0;

          if (isClose) {
            const commissionPercent =
              trade.tradePrice > 0
                ? (Math.abs(trade.commission) / trade.tradePrice) * 100
                : 0;
            cumulativeCommissionPercent += commissionPercent;
          }

          trade.profitTotalPercent += cumulativeCommissionPercent;
        });
      }

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
          return {
            time: Math.floor(Date.parse(dateString) / 1000),
            trade,
            price: tradePrice,
            value: profitTotalPercent,
            profitPercent,
            count: parseInt(count, 10) || 0,
            tokenName,
          };
        }
      );

      if (mapped.length === 0) {
        const nowSec = Math.floor(Date.now() / 1000);
        mapped.push(
          {
            time: nowSec - 1800,
            trade: "HOLD",
            price: 0,
            value: 0,
            tokenName: "",
          },
          {
            time: nowSec,
            trade: "HOLD",
            price: 0,
            value: 0,
            tokenName: "",
          }
        );
      } else if (mapped.length === 1) {
        const nowSec = Math.floor(Date.now() / 1000);
        const nextTime = Math.max(mapped[0].time + 60, nowSec);
        mapped.push({
          time: nextTime,
          trade: "HOLD",
          price: mapped[0].price,
          value: mapped[0].value,
          tokenName: mapped[0].tokenName,
        });
      } else if (mapped.length % 2 === 1) {
        // Active open position: extend line horizontally up to current time
        const nowSec = Math.floor(Date.now() / 1000);
        const last = mapped[mapped.length - 1];
        if (nowSec > last.time + 30) {
          mapped.push({
            time: nowSec,
            trade: "HOLD",
            price: last.price,
            value: last.value,
            tokenName: last.tokenName,
          });
        }
      }

      mapped.sort((a, b) => a.time - b.time);

      // Lightweight-charts requires strictly ascending time for line series
      const seriesData: ISeries[] = [];
      let lastTime = -Infinity;
      for (const item of mapped) {
        let time = item.time;
        if (time <= lastTime) {
          time = lastTime + 1;
        }
        seriesData.push({
          ...item,
          time,
        });
        lastTime = time;
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

      const allPreparedLines = lines.map((line: ILine) =>
        this.prepareSeriesData(line.data)
      );

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

      // Pre-index each line by time for O(1) lookups
      const lineMaps = allPreparedLines.map(
        (series) => new Map(series.map((item) => [item.time, item.value]))
      );

      const alignedLines: number[][] = lineMaps.map((lineMap) => {
        const aligned: number[] = [];
        let lastValue = 0;
        for (const time of allTimesData) {
          if (lineMap.has(time)) {
            lastValue = lineMap.get(time)!;
          }
          aligned.push(lastValue);
        }
        return aligned;
      });

      const linesDataTotal: ISeries[] = allTimesData.map(
        (time: number, index: number) => {
          let sum = 0;
          let activeCount = 0;
          for (let k = 0; k < alignedLines.length; k++) {
            const series = allPreparedLines[k];
            // Only count bots that have actually traded and started by this timestamp
            if (series && series.length > 0 && series[0].time <= time) {
              sum += alignedLines[k][index];
              activeCount++;
            }
          }
          const averageValue = activeCount > 0 ? sum / activeCount : 0;

          return {
            time,
            value: averageValue,
          };
        }
      );

      this.linesDataTotal = linesDataTotal;

      return linesDataTotal;
    },

    // Convert / apply server data to lines (supports full reload & incremental delta updates)
    convertServerDataToLines({ isUpdate }: { isUpdate: boolean }): boolean {
      if (!this.serverLines || !this.serverLines.length) return false;

      // Initial load: populate this.lines completely
      if (!this.lines.length || !isUpdate) {
        const lines: ILine[] = this.serverLines.map(
          (file: IServerLine, index: number): ILine => {
            const lineName = file.name.split(".")[0].replace(/^trades[-_]/i, "");
            const existingLine = this.lines.find((l: ILine) => l.name === lineName);
            return {
              name: lineName,
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

      // Delta / incremental update:
      let hasChanges = false;
      for (const [index, file] of this.serverLines.entries()) {
        const lineName = file.name.split(".")[0].replace(/^trades[-_]/i, "");
        let line = this.lines.find(
          (l: ILine) => l.fileName === file.name || l.name === lineName
        );

        if (!line) {
          // Dynamic discovery of a newly added bot file
          const newLine: ILine = {
            name: lineName,
            fileName: file.name,
            mtime: file.mtime,
            data: file.data.map((item: string): string[] => item.split(",")),
            color: this.getColor(index),
            disabled: true,
          };
          this.lines.push(newLine);
          hasChanges = true;
          continue;
        }

        if (!line.fileName) {
          line.fileName = file.name;
        }
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
        // Purge legacy v1, v2, v3 caches from previous sessions
        window.localStorage.removeItem("crypto_bot_chart_lines_v1");
        window.localStorage.removeItem("crypto_bot_chart_lines_v2");
        window.localStorage.removeItem("crypto_bot_chart_lines_v3");
        const raw = window.localStorage.getItem("crypto_bot_chart_lines_v4");
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed[0].name &&
          Array.isArray(parsed[0].data)
        ) {
          // Default initial state: no individual line is selected
          this.lines = parsed.map((l: ILine) => ({
            ...l,
            disabled: true,
          }));
          return true;
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
          name: l.name,
          fileName: l.fileName,
          mtime: l.mtime,
          data: l.data,
          color: l.color,
          disabled: l.disabled,
        }));
        window.localStorage.setItem(
          "crypto_bot_chart_lines_v4",
          JSON.stringify(toSave)
        );
      } catch (err) {
        console.warn("Could not save lines to cache:", err);
      }
    },

    async convertFileDataToLines({ target }) {
      // console.log(event.target.files);
      const inputFiles = [...target.files];

      if (!inputFiles.length) return;

      const lines = await Promise.all(
        inputFiles.map(async (file: File, index: number): Promise<ILine> => {
          const lineText = await file.text();
          const lineName = file.name.split(".")[0].replace(/^trades[-_]/i, "");

          const line: ILine = {
            name: lineName,
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
      chartContainer.innerHTML = "";
      chart = createChart(chartContainer, this.chartOptions);

      this.setupChartLines();
      this.setupChartTotal();

      this.applyLongestScale();
      this.setupZoomListener();

      this.refreshMarks();
    },

    //// Updates
    updateChart() {
      if (lineSeries.length !== this.lines.length) {
        this.initChart();
        return;
      }
      this.updateLines();
      this.updateLineTotal();
      this.refreshMarks();
    },

    updateLineTotalVisibility() {
      const isLastLine = this.linesEnabled.length === 1;

      if (!isLastLine) {
        this.isLineTotalVisible = !this.isLineTotalVisible;
        this.updateLineTotal();
        this.applyLongestScale();
        this.refreshMarks();
      }
    },

    computeZoomCondition() {
      return this.linesEnabled && this.linesEnabled.length === 1;
    },

    refreshMarks() {
      if (!chart || this.isMonitorView) return;
      if (this.linesEnabled.length === 1) {
        this.setMarks();
      } else {
        this.clearMarks();
      }
    },

    getSeriesAutoscaleInfo(original) {
      const res = original?.();
      if (!res || !res.priceRange) {
        return {
          priceRange: { minValue: -0.5, maxValue: 0.5 },
          margins: { above: 48, below: 24 },
        };
      }
      let { minValue, maxValue } = res.priceRange;
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

    getLongestTimeRange() {
      let minTime = Infinity;
      let maxTime = -Infinity;

      const isAllLines =
        this.hasLineTotalOnly ||
        this.hasNoLines ||
        this.linesEnabled.length === 0;
      const targetLines = isAllLines ? this.lines : this.linesEnabled;

      for (const line of targetLines) {
        if (!line?.data || line.data.length === 0) continue;
        const seriesData = this.prepareSeriesData(line.data);
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

    applyLongestScale() {
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

    zoomToLine(line) {
      this.applyLongestScale();
    },

    updateLineVisibility(index: number) {
      const line = this.lines[index];
      if (!line) return;

      // Line
      line.disabled = !line.disabled;

      this.updateLines();
      this.updateLineTotal();
      this.applyLongestScale();
      this.refreshMarks();
    },

    soloLine(index: number) {
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

      this.updateLines();
      this.updateLineTotal();
      this.applyLongestScale();
      this.refreshMarks();
    },

    async selectBotChart(botName: string) {
      const clean = botName?.trim().toUpperCase();
      const targetIndex = this.lines.findIndex(
        (l) => l.name?.toUpperCase() === clean
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

      if (chart) {
        chart.resize(
          window.innerWidth,
          this.chartOptions.height,
          true
        );
      }

      this.updateLines();
      this.updateLineTotal();
      this.applyLongestScale();
      this.refreshMarks();
    },

    updateLines() {
      const linesData = [];

      for (const [index, line] of this.lines.entries()) {
        const seriesData = this.prepareSeriesData(line.data);
        const isVisible = !this.hasLineTotalOnly && !line.disabled;

        if (lineSeries[index]) {
          lineSeries[index].applyOptions({
            visible: isVisible,
          });
          lineSeries[index].setData(isVisible ? seriesData : []);
        } else if (chart) {
          const newLineSeries = chart.addLineSeries({
            color: line.color,
            priceScaleId: "right",
            lineWidth: this.lineWidth,
            visible: isVisible,
            priceLineVisible: false,
            lastValueVisible: true,
            autoscaleInfoProvider: (original) =>
              this.getSeriesAutoscaleInfo(original),
          });
          newLineSeries.setData(isVisible ? seriesData : []);
          lineSeries.push(newLineSeries);
        }
        linesData.push(seriesData);
      }

      this.linesData = linesData;
    },

    updateLineTotal() {
      const isVisible =
        this.isLineTotalVisible && this.linesEnabled.length !== 1;

      lineSeriesTotal?.applyOptions({
        visible: isVisible,
      });

      const seriesDataTotal = isVisible ? this.prepareSeriesDataTotal() : [];
      lineSeriesTotal?.setData(seriesDataTotal);
    },

    async refreshAllData() {
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

    setupChartUpdate() {
      this.refreshInterval = setInterval(async () => {
        await this.refreshAllData();
      }, 20000);
    },

    //// Listeners
    setupResizeListener() {
      const handler = () => {
        if (!chart || this.isMonitorView) return;
        chart.resize(window.innerWidth, this.chartOptions.height, true);
        this.applyLongestScale();
      };

      window.addEventListener("resize", handler);
    },

    async setupZoomListener() {
      let zoomDebounceTimer = null;
      const myVisibleTimeRangeChangeHandler = (newVisibleTimeRange) => {
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

    setupAnnotations() {
      chart.subscribeCrosshairMove((param) => {
        const annotation: HTMLElement = document.querySelector(".annotation");
        const annotationToken: HTMLElement =
          document.querySelector(".annotation--token");
        const annotationPrice: HTMLElement =
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
          const seriesData = param.seriesData.get(series);

          if (this.lines[index]?.disabled) return;

          const line = this.linesData[index]?.find(
            (item) =>
              item.time === seriesData?.time && item.value === seriesData?.value
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
    setMarks() {
      // Clear markers on all series first
      lineSeries.forEach((s) => s?.setMarkers([]));
      this.lineSeriesMarked = null;
      this.isLineMarked = false;

      // Only show markers when an individual bot chart is selected
      if (this.linesEnabled.length === 1) {
        const line = this.linesEnabled[0];
        const index = this.lines.indexOf(line);
        if (index === -1 || !lineSeries[index]) return;

        const lineData = this.prepareSeriesData(line.data);
        const markers = lineData
          .filter(({ trade }) => trade === "BUY" || trade === "SELL")
          .map(({ trade, time, count }) => ({
            time,
            position: trade === "BUY" ? "belowBar" : "aboveBar",
            color: trade === "BUY" ? "green" : "red",
            shape: trade === "BUY" ? "arrowUp" : "arrowDown",
            id: `${time}-${trade}-${count || 0}`,
          }));

        this.lineSeriesMarked = lineSeries[index];
        this.lineSeriesMarked?.setMarkers(markers);
        this.isLineMarked = true;
      }
    },

    clearMarks() {
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

    getBotPosition(lineName: string) {
      if (!lineName || !this.botStatusList) return null;
      const clean = lineName.trim().toUpperCase();
      const found = this.botStatusList.find(
        (b) => b.name?.toUpperCase() === clean || b.id?.toUpperCase() === clean
      );
      return found?.position || null;
    },

    getBotColor(botName: string) {
      const clean = botName?.trim().toUpperCase();
      const line = this.lines.find((l) => l.name?.toUpperCase() === clean);
      return line?.color || "#888";
    },

    formatTarget(val: number) {
      if (val == null || isNaN(val)) return "-";
      if (val < 0.001) return val.toFixed(8);
      if (val < 1) return val.toFixed(6);
      return val.toFixed(4);
    },

    formatTime(dateStr: string) {
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
      return name.replace(/^ORDERBOOK-/i, "OB-");
    },

    toggleCommission() {
      this.useCommission = !this.useCommission;
    },

    getBotPnl(bot) {
      if (!bot) return 0;
      const clean = (bot.name || bot.id || "").trim().toUpperCase();
      const lineIndex = this.lines.findIndex(
        (l) => l.name?.trim().toUpperCase() === clean
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

    toggleMonitorView() {
      this.isMonitorView = !this.isMonitorView;
      if (!this.isMonitorView) {
        this.$nextTick(() => {
          if (chart) {
            chart.resize(
              window.innerWidth - 20,
              this.chartOptions.height,
              true
            );
            this.applyLongestScale();
          }
        });
      } else {
        this.refreshAllData();
      }
    },
  },

  //// Life cycle
  async mounted() {
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

  unmounted() {
    chart?.remove();
    chart = null;
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  },
};
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
