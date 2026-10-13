<template>
  <!-- Chart container: ALWAYS in DOM so createChart never fails -->
  <div
    v-show="!isLoading && lines.length > 0 && !isMonitorView"
    class="chart cursor-pointer"
    id="chart-container"
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
          BOTS: <strong>{{ systemStatus.runningBots || 8 }}/{{ systemStatus.totalBots || 8 }} RUNNING</strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          IN POSITION: <strong>{{ systemStatus.activePositionsCount }} / {{ botStatusList.length || 8 }}</strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          TOTAL EQUITY:
          <strong :class="parseFloat(totalProfit) >= 0 ? 'text-green' : 'text-red'">
            {{ totalProfit }}%
          </strong>
        </span>
      </div>

      <div class="summary-right">
        <button class="monitor-action-btn cursor-pointer" @click="refreshAllData" title="Refresh all data">
          REFRESH
        </button>
        <button class="monitor-action-btn monitor-action-btn--close cursor-pointer" @click="toggleMonitorView" title="Back to chart">
          ✕ CHART
        </button>
      </div>
    </div>

    <!-- 8 Bots Flat Grid -->
    <div class="monitor-bots-grid">
      <div
        v-for="bot in botStatusList"
        :key="bot.id"
        class="bot-card"
        :class="{ 'bot-card--in-pos': bot.hasOpenPosition }"
      >
        <div class="bot-card__color-bar" :style="{ backgroundColor: getBotColor(bot.name) }" />

        <div class="bot-card__header">
          <span class="bot-card__name">{{ bot.name }}</span>
          <span class="bot-card__pnl" :class="getBotPnl(bot) >= 0 ? 'text-green' : 'text-red'">
            {{ getBotPnl(bot) > 0 ? '+' : '' }}{{ getBotPnl(bot).toFixed(2) }}%
          </span>
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
      <img
        v-if="!isMonitorView"
        :src="isFullScreen ? '/icons/collapse.svg' : '/icons/expand.svg'"
        alt="DNATRADE"
        class="full-screen-button cursor-pointer"
        @click="isFullScreen = !isFullScreen"
      />

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

        <span class="use-commission-tip">{{
          useCommission ? "With Commission" : "Without Commission"
        }}</span>
      </div>

      <!-- Flat System & Bots Monitor Button / Plaque -->
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
          {{ systemStatus.runningBots || 8 }}/{{ systemStatus.totalBots || 8 }} BOTS
        </span>
        <span
          v-if="systemStatus.activePositionsCount > 0"
          class="status-btn-badge"
        >
          {{ systemStatus.activePositionsCount }} ACTIVE
        </span>
        <span v-if="isMonitorView" class="status-view-active">
          • MONITOR
        </span>
      </div>
    </div>

    <!-- Legend toolbar (hidden when in monitor view) -->
    <div v-show="!isMonitorView" class="info-container">
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

    <!-- Tickers lines (hidden when in monitor view) -->
    <section v-show="!isMonitorView" ref="legend" class="legend">
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
      refreshInterval: null,
      lineWidth: 2.5,
      isFullScreen: false,
      isLineMarked: false,
      useCommission: true,
      isMonitorView: false,
      botStatusList: [],
      systemStatus: {
        status: "HEALTHY",
        runningBots: 8,
        totalBots: 8,
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
        (file: IServerLine, index: number): ILine => {
          const lineName = file.name.split(".")[0].replace(/^trades[-_]/i, "");
          const existingLine = this.lines.find((l: ILine) => l.name === lineName);
          return {
            name: lineName,
            data: file.data.map((item: string): string[] => item.split(",")),
            color: this.getColor(index),
            disabled: isUpdate ? (existingLine?.disabled ?? true) : true,
          };
        }
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
        if (lineSeries[index]) {
          lineSeries[index].setData(seriesData);
        } else if (chart) {
          const newLineSeries = chart.addLineSeries({
            color: line.color,
            priceScaleId: "right",
            lineWidth: this.lineWidth,
            visible: !this.hasLineTotalOnly && !line.disabled,
            priceLineVisible: false,
            lastValueVisible: true,
          });
          newLineSeries.setData(seriesData);
          lineSeries.push(newLineSeries);
        }
        linesData.push(seriesData);
      }

      this.linesData = linesData;
    },

    updateLineTotal() {
      lineSeriesTotal?.applyOptions({
        visible: this.isLineTotalVisible && this.linesEnabled.length !== 1,
      });

      const seriesDataTotal = this.prepareSeriesDataTotal();
      lineSeriesTotal?.setData(seriesDataTotal);
    },

    async refreshAllData() {
      await Promise.all([this.fetchData(), this.fetchBotStatus()]);
      this.convertServerDataToLines({ isUpdate: true });
      this.updateChart();
    },

    setupChartUpdate() {
      this.refreshInterval = setInterval(async () => {
        await this.refreshAllData();
      }, 20000);
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
        this.serverLines = serverLines;
        this.convertServerDataToLines({ isUpdate: Boolean(chart) });
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
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch {
        return dateStr;
      }
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
            chart.timeScale().fitContent();
          }
        });
      } else {
        this.refreshAllData();
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
  left: 82px;
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

  .full-screen-button {
    width: 28px;
    height: auto;
    flex-shrink: 0;
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

    .use-commission-tip {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      display: flex;
      align-items: center;
      visibility: hidden;
      background: grey;
      color: white;
      text-transform: uppercase;
      padding: 2px 8px;
      opacity: 0;
      transition: opacity 0.3s ease, visibility 0.3s ease;
      white-space: nowrap;
      pointer-events: none;
      z-index: 10000;
      font-size: 10px;

      @media (max-width: 768px) {
        display: none;
      }
    }

    &:hover {
      .use-commission-tip {
        visibility: visible;
        opacity: 1;
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
    transition: background 0.15s ease;

    &:hover {
      background: grey;
    }

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
        background-color: green;
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
    background: var(--background-color);
    font-size: 11px;
    font-weight: 600;
    padding-inline: 7px;
    margin-left: 6px;
    letter-spacing: 0.3px;
    white-space: nowrap;
    border: none;

    &--long {
      color: green;
    }

    &--short {
      color: red;
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

    .text-green { color: #4ade80; }
    .text-red { color: #f87171; }
    .text-yellow { color: #facc15; }

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

      .summary-right {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
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

    .summary-right {
      display: flex;
      align-items: center;
      gap: 6px;

      .monitor-action-btn {
        background: transparent;
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.4);
        padding: 3px 8px;
        font-size: 10px;
        font-weight: bold;
        text-transform: uppercase;
        border-radius: 0;
        box-shadow: none;

        &:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: white;
        }

        &--close {
          background: rgba(0, 0, 0, 0.25);
          border-color: rgba(255, 255, 255, 0.6);
        }
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
      background: var(--background-color);
      border: 1px solid dimgray;
      display: flex;
      flex-direction: column;
      padding: 0;
      position: relative;
      box-sizing: border-box;
      min-width: 0;

      &--in-pos {
        border-color: dimgray;
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
        border-bottom: 1px solid rgba(105, 105, 105, 0.25);
        background: rgba(105, 105, 105, 0.08);

        .bot-card__name {
          font-size: 11px;
          font-weight: bold;
          color: dimgray;
          letter-spacing: 0.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }

        .bot-card__pnl {
          font-size: 11px;
          font-weight: bold;
          white-space: nowrap;
          flex-shrink: 0;
          margin-left: 4px;
        }
      }

      .bot-card__body {
        flex: 1;
        padding: 6px 8px;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;

        .pos-row--main {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;

          .pos-side {
            font-size: 10px;
            font-weight: bold;
            padding: 2px 5px;
            color: white;

            &--long {
              background: green;
            }

            &--short {
              background: red;
            }
          }

          .pos-symbol {
            font-size: 11px;
            font-weight: bold;
            color: #222;
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
            border-bottom: 1px dashed rgba(105, 105, 105, 0.15);
            padding-bottom: 2px;

            .detail-label {
              color: grey;
              font-weight: 600;
            }

            .detail-val {
              font-weight: bold;
              color: #333;
            }
          }
        }

        .bot-card__scanning {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: grey;
          text-align: center;
          font-weight: 600;
          letter-spacing: 0.5px;
          padding: 8px 0;
        }
      }

      .bot-card__footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 5px 8px;
        border-top: 1px solid rgba(105, 105, 105, 0.2);
        font-size: 9px;
        color: grey;
        font-weight: 600;
        background: rgba(105, 105, 105, 0.04);
        flex-shrink: 0;
      }
    }
  }
}

.text-green { color: green; }
.text-red { color: red; }
.text-yellow { color: #d97706; }
</style>
