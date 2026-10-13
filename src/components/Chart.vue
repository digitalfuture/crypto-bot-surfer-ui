<template>
  <div
    v-show="!isLoading && lines.length > 0"
    class="chart cursor-pointer"
    id="chart-container"
  />

  <div v-if="isLoading" class="loader-container">
    <div class="loader">
      <div>DNA</div>
      <div>TRADE</div>
      <img src="/favicon.png" alt="DNATRADE" class="icon" />
    </div>
  </div>

  <div v-else-if="lines.length === 0" class="no-data">NO DATA</div>

  <template v-else>
    <div class="annotation" style="display: none">
      <span class="annotation--token" />
      <span class="annotation--price" />
    </div>

    <div class="top-bar-menu">
      <img
        :src="isFullScreen ? '/icons/collapse.svg' : '/icons/expand.svg'"
        alt="DNATRADE"
        class="full-screen-button cursor-pointer"
        @click="isFullScreen = !isFullScreen"
      />

      <div class="use-commission-container">
        <img
          :src="useCommission ? '/icons/money.svg' : '/icons/money-off.svg'"
          alt="DNATRADE"
          class="use-commission-button cursor-pointer"
          @click="useCommission = !useCommission"
        />

        <span class="use-commission-tip">{{
          useCommission ? "With Commission" : "Without Commission"
        }}</span>
      </div>

      <!-- Live System & Bots Monitor Pill -->
      <div
        class="system-status-pill cursor-pointer"
        :class="{
          'system-status-pill--healthy': systemStatus.status === 'HEALTHY',
          'system-status-pill--warning': systemStatus.status !== 'HEALTHY',
        }"
        @click="isDrawerOpen = !isDrawerOpen"
        title="Live Bots & Health Monitor"
      >
        <span
          class="status-pulse"
          :class="systemStatus.status === 'HEALTHY' ? 'status-pulse--green' : 'status-pulse--yellow'"
        />
        <span class="status-pill-text">
          {{ systemStatus.runningBots || 5 }}/{{ systemStatus.totalBots || 5 }} BOTS
        </span>
        <span
          v-if="systemStatus.activePositionsCount > 0"
          class="status-pos-badge"
        >
          {{ systemStatus.activePositionsCount }} ACTIVE
        </span>
      </div>
    </div>

    <!-- Legend toolbar-->
    <div class="info-container">
      <!-- Open files -->
      <input
        type="file"
        multiple
        ref="input"
        class="input info clip-left cursor-pointer"
        @change="convertFileDataToLines"
      />

      <!-- Total -->
      <div
        class="total info line clip-right cursor-pointer"
        :class="{
          'total--disabled': !isLineTotalVisible || linesEnabled.length === 1,
        }"
        @click="updateLineTotalVisibility"
      >
        <div class="line__details info">
          <span class="line__name">TOTAL EQUITY</span>
          <span class="line__last-value"> {{ totalProfit }}</span>
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

    <!-- Tickers lines-->
    <section ref="legend" class="legend">
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
        @click="
          linesData[index]?.[linesData[index]?.length - 1] &&
            updateLineVisibility(index)
        "
      >
        <div class="line__details">
          <span class="line__name" v-text="line.name" />

          <!-- Micro position chip in legend -->
          <span
            v-if="getBotPosition(line.name)"
            class="micro-pos-tag"
            :class="getBotPosition(line.name).side === 'LONG' ? 'micro-pos-tag--long' : 'micro-pos-tag--short'"
          >
            {{ getBotPosition(line.name).side }} {{ getBotPosition(line.name).symbol }}
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

    <!-- Drawer Backdrop -->
    <div
      v-if="isDrawerOpen"
      class="drawer-backdrop"
      @click="isDrawerOpen = false"
    />

    <!-- Slide-out Monitor Drawer -->
    <div
      class="monitor-drawer"
      :class="{ 'monitor-drawer--open': isDrawerOpen }"
    >
      <div class="drawer-header">
        <div class="drawer-header__title-group">
          <div class="drawer-title">
            <span class="drawer-dot green"></span>
            SYSTEM & BOTS MONITOR
          </div>
          <div class="drawer-subtitle">
            Watchdog 24/7 • {{ systemStatus.runningBots || 5 }}/{{ systemStatus.totalBots || 5 }} bots active
          </div>
        </div>
        <button class="drawer-close-btn cursor-pointer" @click="isDrawerOpen = false">✕</button>
      </div>

      <div class="drawer-summary">
        <div class="summary-card">
          <div class="summary-label">TOTAL EQUITY</div>
          <div class="summary-value" :class="parseFloat(totalProfit) >= 0 ? 'text-green' : 'text-red'">
            {{ totalProfit }}%
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">IN POSITION</div>
          <div class="summary-value text-accent">
            {{ systemStatus.activePositionsCount }} / {{ botStatusList.length || 5 }}
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">WATCHDOG</div>
          <div class="summary-value" :class="systemStatus.status === 'HEALTHY' ? 'text-green' : 'text-yellow'">
            {{ systemStatus.status }}
          </div>
        </div>
      </div>

      <div class="drawer-bot-list">
        <div
          v-for="bot in botStatusList"
          :key="bot.id"
          class="bot-card"
          :class="{ 'bot-card--in-pos': bot.hasOpenPosition }"
        >
          <div class="bot-card__header">
            <div class="bot-card__name">
              <span class="bot-color-bar" :style="{ backgroundColor: getBotColor(bot.name) }"></span>
              {{ bot.name }}
            </div>
            <div class="bot-card__pnl" :class="bot.totalProfit >= 0 ? 'text-green' : 'text-red'">
              {{ bot.totalProfit > 0 ? '+' : '' }}{{ bot.totalProfit.toFixed(2) }}%
            </div>
          </div>

          <!-- Active position info -->
          <div v-if="bot.position" class="bot-card__pos-details">
            <div class="pos-token-row">
              <span class="pos-side-pill" :class="bot.position.side === 'LONG' ? 'side--long' : 'side--short'">
                {{ bot.position.side }}
              </span>
              <span class="pos-symbol">{{ bot.position.symbol }}</span>
              <span class="pos-entry">Entry: {{ bot.position.entryPrice }}</span>
            </div>

            <div class="pos-targets-grid">
              <div v-if="bot.position.stopLoss" class="target-item target--sl">
                <span class="target-label">Stop-Loss</span>
                <span class="target-val">{{ formatTarget(bot.position.stopLoss) }}</span>
              </div>
              <div v-if="bot.position.takeProfit" class="target-item target--tp">
                <span class="target-label">Take-Profit</span>
                <span class="target-val">{{ formatTarget(bot.position.takeProfit) }}</span>
              </div>
              <div v-if="bot.position.shortPrice && bot.position.shortPrice !== bot.position.entryPrice" class="target-item target--trail">
                <span class="target-label">Trail Peak</span>
                <span class="target-val">{{ formatTarget(bot.position.shortPrice) }}</span>
              </div>
            </div>
          </div>

          <div v-else class="bot-card__scanning">
            <span class="scanning-icon">🔍</span> Scanning market for entry setups
          </div>

          <div class="bot-card__footer">
            <span class="footer-trades">{{ bot.totalTrades }} trades executed</span>
            <span v-if="bot.lastTradeDate" class="footer-time">{{ formatTime(bot.lastTradeDate) }}</span>
          </div>
        </div>
      </div>

      <div class="drawer-footer">
        <div class="drawer-footer__info">
          <span>⚡ Host Watchdog running on dnatrade</span>
          <span>Auto-recovers containers on failure</span>
        </div>
        <button class="drawer-refresh-btn cursor-pointer" @click="fetchBotStatus">
          🔄 Refresh
        </button>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { createChart } from "lightweight-charts";

export interface IServerLine {
  name: string;
  data: string[];
}

export interface ILine {
  name: string;
  data: string[][];
  color: string;
  disabled: boolean;
}

export interface ISeries {
  time: number;
  value: number;
  trade?: string;
  profit?: number;
  sum?: number;
  count?: number;
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
      updateTimeout: 1000 * 60 * 3,
      updateInterval: null,
      statusInterval: null,
      lineWidth: 2.5,
      isFullScreen: false,
      isLineMarked: false,
      useCommission: true,
      isDrawerOpen: false,
      botStatusList: [],
      systemStatus: {
        status: "HEALTHY",
        runningBots: 5,
        totalBots: 5,
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
        width: window.innerWidth - 20,
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
          fixLeftEdge: true,
          fixRightEdge: true,
        },
        rightPriceScale: {
          visible: true,
          autoScale: true,
        },
        leftPriceScale: {
          autoScale: true,
          visible: true,
        },
        layout: {
          background: { color: "transparent" },
        },
      };
    },

    totalProfit() {
      const lastValue =
        this.linesDataTotal[this.linesDataTotal.length - 1]?.value;

      return lastValue != null && !isNaN(lastValue)
        ? lastValue.toFixed(2)
        : "0.00";
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
      if (isFullscreen) {
        chart.applyOptions({ height: window.innerHeight });
      } else {
        chart.applyOptions({ height: this.chartOptions.height });
      }
    },

    isLineTotalVisible() {
      this.updateLineTotal();
    },

    zoom(value) {
      const diffMs = value.to - value.from;
      const zoomCondition = diffMs < 20000;

      this.zoomCondition = zoomCondition;
    },

    zoomCondition() {
      if (this.hasLineTotalOnly) return;

      if (this.linesEnabled.length === 1) {
        if (this.zoomCondition) {
          this.setMarks();
        } else {
          this.clearMarks();
        }
      } else {
        this.clearMarks();
      }

      this.updateLineTotal();
    },

    linesEnabled() {
      if (this.linesEnabled.length === 1) {
        if (this.zoomCondition) this.setMarks();
      } else {
        this.clearMarks();
      }

      this.updateLineTotal();
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
      chart = createChart(chartContainer, this.chartOptions);

      this.setupChartTotal();
      this.setupChartLines();

      chart.timeScale().fitContent();

      this.setupZoomListener();
      this.setupAnnotations();
    },

    /// Setup lines
    setupChartLines() {
      const linesData = [];

      for (const line of this.lines) {
        const newLineSeries = chart.addLineSeries({
          color: line.color,
          priceScaleId: "right",
          lineWidth: this.lineWidth,
          visible: !this.hasLineTotalOnly && !line.disabled,
          priceLineVisible: false,
          lastValueVisible: true,
        });

        const seriesData = this.prepareSeriesData(line.data);

        lineSeries.push(newLineSeries);
        newLineSeries.setData(seriesData);

        linesData.push(seriesData);
      }

      this.linesData = linesData;
    },

    setupChartTotal() {
      lineSeriesTotal = chart.addLineSeries({
        color: totalLineColor,
        priceScaleId: "right",
        lineWidth: this.lineWidth,
        visible: this.isLineTotalVisible && this.linesEnabled.length !== 1,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      const seriesDataTotal = this.prepareSeriesDataTotal();

      lineSeriesTotal.setData(seriesDataTotal);
    },

    //// Prepare line series
    prepareSeriesData(lineData: string[][]): ISeries[] {
      const tradeArray = lineData
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
        ({ dateString, trade, tradePrice, profitTotalPercent, tokenName }) => {
          return {
            time: Math.floor(Date.parse(dateString) / 1000),
            trade,
            price: tradePrice,
            value: profitTotalPercent,
            tokenName,
          };
        }
      );

      if (mapped.length === 1) {
        const nowSec = Math.floor(Date.now() / 1000);
        const nextTime = Math.max(mapped[0].time + 60, nowSec);
        mapped.push({
          time: nextTime,
          trade: "HOLD",
          price: mapped[0].price,
          value: mapped[0].value,
          tokenName: mapped[0].tokenName,
        });
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
          for (const aligned of alignedLines) {
            sum += aligned[index];
          }
          const averageValue =
            alignedLines.length > 0 ? sum / alignedLines.length : 0;

          return {
            time,
            value: averageValue,
          };
        }
      );

      this.linesDataTotal = linesDataTotal;

      return linesDataTotal;
    },

    // Convert server data to lines
    convertServerDataToLines({ isUpdate }) {
      const lines: ILine[] = this.serverLines.map(
        (file: IServerLine, index: number): ILine => ({
          name: file.name.split(".")[0].replace(/^trades[-_]/i, ""),
          data: file.data.map((item: string): string[] => item.split(",")),
          color: this.getColor(index),
          disabled: isUpdate ? (this.lines[index]?.disabled ?? true) : true,
        })
      );

      this.lines = lines;
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

      chart.timeScale().fitContent();
      this.setupZoomListener();
    },

    //// Updates
    updateChart() {
      this.updateLines();
      this.updateLineTotal();
    },

    updateLineTotalVisibility() {
      const isLastLine = this.linesEnabled.length === 1;

      if (!isLastLine) {
        this.isLineTotalVisible = !this.isLineTotalVisible;
      }
    },

    updateLineVisibility(index: number) {
      const line = this.lines[index];
      if (!line) return;

      // Line
      line.disabled = !line.disabled;
      lineSeries[index]?.applyOptions({
        visible: !line.disabled,
      });

      // Total line
      this.updateLineTotal();
    },

    updateLines() {
      const linesData = [];

      for (const [index, line] of this.lines.entries()) {
        const seriesData = this.prepareSeriesData(line.data);
        lineSeries[index].setData(seriesData);
        linesData.push(seriesData);
      }

      this.linesData = linesData;
    },

    updateLineTotal() {
      lineSeriesTotal.applyOptions({
        visible: this.isLineTotalVisible && this.linesEnabled.length !== 1,
      });

      const seriesDataTotal = this.prepareSeriesDataTotal();
      lineSeriesTotal.setData(seriesDataTotal);
    },

    setupChartUpdate() {
      this.updateInterval = setInterval(async () => {
        await this.fetchData();

        this.convertServerDataToLines({ isUpdate: true });
        this.updateChart();
      }, this.updateTimeout);
    },

    //// Listeners
    setupResizeListener() {
      const handler = () =>
        chart.resize(window.innerWidth - 20, this.chartOptions.height, true);

      window.addEventListener("resize", handler);
    },

    async setupZoomListener() {
      const myVisibleTimeRangeChangeHandler = (newVisibleTimeRange) => {
        if (newVisibleTimeRange === null) {
          // handle null
        }

        this.zoom = newVisibleTimeRange;
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
      const line = this.linesEnabled[0];
      const index = this.lines.indexOf(line);
      const lineData = this.prepareSeriesData(line.data);
      const markers = lineData
        .filter(({ trade }) => trade === "BUY" || trade === "SELL")
        .map(({ trade, time }) => ({
          time,
          position: trade === "BUY" ? "belowBar" : "aboveBar",
          color: trade === "BUY" ? "green" : "red",
          shape: trade === "BUY" ? "arrowUp" : "arrowDown",
          id: `${time}-${trade}`,
        }));

      this.lineSeriesMarked = lineSeries[index];
      this.lineSeriesMarked?.setMarkers(markers);
      this.isLineMarked = true;
    },

    clearMarks() {
      this.lineSeriesMarked?.setMarkers([]);
      this.lineSeriesMarked = null;
    },

    //// Colors
    getColor(index: number): string {
      if (index < this.colors.length) {
        return this.colors[index];
      }

      return this.colors[index % this.colors.length];
    },

    //// API
    async fetchData() {
      try {
        const response = await fetch("/lines");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const serverLines: IServerLine[] = await response.json();
        this.isLoading = false;
        this.serverLines = serverLines;
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
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch {
        return dateStr;
      }
    },
  },

  //// Life cycle
  async mounted() {
    await this.fetchData();
    this.fetchBotStatus();

    this.initChart();
    this.setupResizeListener();
    this.setupChartUpdate();

    // Auto-refresh bot status every 20 seconds
    this.statusInterval = setInterval(() => {
      this.fetchBotStatus();
    }, 20000);
  },

  unmounted() {
    chart.remove();
    chart = null;
    clearInterval(this.updateInterval);
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
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
  left: 82px;
  display: flex;
  align-items: center;
  z-index: 9999;

  .full-screen-button {
    width: 32px;
    height: auto;
  }

  .use-commission-container {
    display: flex;

    .use-commission-button {
      width: 25px;
      height: auto;
    }

    .use-commission-tip {
      display: flex;
      align-items: center;
      visibility: hidden;
      background: grey;
      color: white;
      text-transform: uppercase;
      padding: 0 8px;
      opacity: 0;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }

    &:hover {
      .use-commission-tip {
        visibility: visible;
        opacity: 1;
      }
    }
  }

  .system-status-pill {
    display: flex;
    align-items: center;
    gap: 7px;
    background: rgba(40, 40, 44, 0.75);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 16px;
    padding: 3px 10px;
    margin-left: 12px;
    color: #eee;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    transition: all 0.2s ease;
    user-select: none;

    &:hover {
      background: rgba(50, 50, 56, 0.95);
      border-color: rgba(255, 255, 255, 0.35);
      transform: translateY(-1px);
    }

    .status-pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #22c55e;
      box-shadow: 0 0 8px #22c55e;
      display: inline-block;

      &--green {
        background-color: #22c55e;
        box-shadow: 0 0 8px #22c55e;
      }

      &--yellow {
        background-color: #eab308;
        box-shadow: 0 0 8px #eab308;
      }
    }

    .status-pill-text {
      white-space: nowrap;
    }

    .status-pos-badge {
      background: rgba(59, 130, 246, 0.25);
      color: #60a5fa;
      padding: 1px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: bold;
      white-space: nowrap;
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
}

.line {
  flex-grow: 1;
  flex-basis: 0;

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
    font-size: 10px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 4px;
    margin-left: 6px;
    letter-spacing: 0.3px;
    white-space: nowrap;

    &--long {
      background: rgba(34, 197, 94, 0.18);
      color: #16a34a;
      border: 1px solid rgba(34, 197, 94, 0.4);
    }

    &--short {
      background: rgba(239, 68, 68, 0.18);
      color: #dc2626;
      border: 1px solid rgba(239, 68, 68, 0.4);
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
      background-color: red;
    }

    &--green {
      background-color: green;
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
// Slide-Out Monitor Drawer & Backdrop
// ==========================================
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 10000;
  animation: fadeIn 0.2s ease;
}

.monitor-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 400px;
  max-width: 92vw;
  background: #18181b;
  color: #f4f4f5;
  box-shadow: -10px 0 35px rgba(0, 0, 0, 0.65);
  border-left: 1px solid #27272a;
  z-index: 10001;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);

  &--open {
    transform: translateX(0);
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid #27272a;
    background: #141416;

    .drawer-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #fafafa;
    }

    .drawer-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 6px #22c55e;
    }

    .drawer-subtitle {
      font-size: 11px;
      color: #71717a;
      margin-top: 4px;
    }

    .drawer-close-btn {
      background: #27272a;
      border: 1px solid #3f3f46;
      color: #a1a1aa;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      &:hover {
        background: #3f3f46;
        color: #fff;
      }
    }
  }

  .drawer-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 14px 18px;
    background: #1e1e24;
    border-bottom: 1px solid #27272a;

    .summary-card {
      text-align: center;
      padding: 8px 4px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.2);

      .summary-label {
        font-size: 10px;
        color: #a1a1aa;
        font-weight: 600;
        letter-spacing: 0.3px;
      }

      .summary-value {
        font-size: 14px;
        font-weight: 700;
        margin-top: 4px;
      }
    }
  }

  .drawer-bot-list {
    flex: 1;
    overflow-y: auto;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;

    .bot-card {
      background: #202025;
      border: 1px solid #2e2e34;
      border-radius: 8px;
      padding: 12px 14px;
      transition: border-color 0.2s;

      &--in-pos {
        border-color: rgba(59, 130, 246, 0.45);
        background: #22222a;
      }

      .bot-card__header {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .bot-card__name {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: #fafafa;
        }

        .bot-color-bar {
          width: 4px;
          height: 14px;
          border-radius: 2px;
          display: inline-block;
        }

        .bot-card__pnl {
          font-size: 12px;
          font-weight: 700;
        }
      }

      .bot-card__pos-details {
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);

        .pos-token-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;

          .pos-side-pill {
            font-size: 10px;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 4px;

            &.side--long {
              background: rgba(34, 197, 94, 0.2);
              color: #4ade80;
              border: 1px solid rgba(34, 197, 94, 0.35);
            }

            &.side--short {
              background: rgba(239, 68, 68, 0.2);
              color: #f87171;
              border: 1px solid rgba(239, 68, 68, 0.35);
            }
          }

          .pos-symbol {
            font-weight: 700;
            color: #fff;
          }

          .pos-entry {
            color: #a1a1aa;
            font-size: 11px;
            margin-left: auto;
          }
        }

        .pos-targets-grid {
          display: flex;
          gap: 12px;
          margin-top: 8px;
          font-size: 10px;

          .target-item {
            display: flex;
            flex-direction: column;

            .target-label {
              color: #71717a;
            }

            .target-val {
              font-weight: 600;
              margin-top: 2px;
            }

            &.target--sl .target-val { color: #f87171; }
            &.target--tp .target-val { color: #4ade80; }
            &.target--trail .target-val { color: #60a5fa; }
          }
        }
      }

      .bot-card__scanning {
        margin-top: 8px;
        font-size: 11px;
        color: #71717a;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .bot-card__footer {
        display: flex;
        justify-content: space-between;
        margin-top: 10px;
        padding-top: 6px;
        border-top: 1px solid rgba(255, 255, 255, 0.04);
        font-size: 10px;
        color: #71717a;
      }
    }
  }

  .drawer-footer {
    padding: 14px 18px;
    border-top: 1px solid #27272a;
    background: #141416;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .drawer-footer__info {
      display: flex;
      flex-direction: column;
      font-size: 10px;
      color: #71717a;
      gap: 2px;
    }

    .drawer-refresh-btn {
      background: #27272a;
      border: 1px solid #3f3f46;
      color: #d4d4d8;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      transition: all 0.2s;

      &:hover {
        background: #3f3f46;
        color: #fff;
      }
    }
  }
}

.text-green { color: #4ade80; }
.text-red { color: #f87171; }
.text-yellow { color: #facc15; }
.text-accent { color: #60a5fa; }

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
