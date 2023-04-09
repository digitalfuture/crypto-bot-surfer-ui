<template>
  <div class="chart cursor-pointer" id="chart-container" />

  <div v-if="isLoading" class="loader-container">
    <div class="loader">
      <div>DNA</div>
      <div>TRADE</div>
      <img src="/favicon.png" alt="DNATRADE" class="icon" />
    </div>
  </div>

  <template v-else>
    <img
      src="/favicon.png"
      alt="DNATRADE"
      class="full-screen-button cursor-pointer"
      :class="{
        'full-screen-button--active': isFullScreen,
      }"
      @click="isFullScreen = !isFullScreen"
    />

    <!-- Legend toolbar-->
    <div class="info-container">
      <!-- Open files -->
      <input
        type="file"
        multiple
        ref="input"
        class="input info clip-left cursor-pointer"
        @change="createLinesFromInput"
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
          <span class="line__name">TOTAL</span>
          <span class="line__last-value"> {{ totalProfit }}</span>
        </div>
      </div>

      <!-- BTC / USDT -->
      <div
        class="line btc clip-right cursor-pointer"
        :class="{ 'btc--disabled': !isLineBtcVisible }"
        @click="updateLineBtcVisibility"
      >
        <div class="line__details info">
          <span class="line__name">BTC / USDT</span>
          <span class="line__last-value"> {{ btcProfit }}% </span>
        </div>
      </div>

      <!-- Market change -->
      <div
        class="line market-change clip-right cursor-pointer"
        :class="{ 'market-change--disabled': !isLineMarketChangeVisible }"
        @click="updateLineMarketChangeVisibility"
      >
        <div class="line__details info">
          <span class="line__name">MARKET CHANGE</span>
          <span class="line__last-value"> {{ marketChangeProfit }} </span>
        </div>
      </div>
    </div>

    <!-- Legrnd lines-->
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
        @click="updateLineVisibility(index)"
      >
        <div class="line__details">
          <span class="line__name" v-text="line.name" />
          <span
            class="line__last-value"
            v-text="linesData[index][linesData[index].length - 1].value"
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
  data: string;
}

export interface ILine {
  name: string;
  data: string[];
  color: string;
  disabled: boolean;
}

export interface ISeries {
  time: number;
  value: number;
  trade?: string;
  btcValue?: number;
  marketChangeValue?: number;
}
</script>

<script lang="ts">
let chart = null;
let lineSeries = [];
let lineSeriesBtc = null;
let lineSeriesMarketChange = null;
let lineSeriesTotal = null;

export default {
  name: "Chart",

  data() {
    return {
      serverLines: [],
      updateTimeout: 1000 * 60 * 3,
      updateInterval: null,
      lineWidth: 2.5,
      isFullScreen: false,
      isLineMarked: false,

      lines: [],

      linesData: [],
      lineDataBtc: [],
      lineDataMarketChange: [],
      linesDataTotal: [],

      isLineBtcVisible: true,
      isLineMarketChangeVisible: true,
      isLineTotalVisible: true,

      colors: [
        "maroon",
        "purple",
        "navy",
        "teal",
        "orange",
        "blueviolet",
        "brown",
        "burlywood",
        "cadetblue",
        "chocolate",
        "coral",
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
        "dimgray",
        "dimgray",
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

      zoom: null,
      zoomCondition: false,
      lineSeriesMarked: null,
    };
  },

  computed: {
    isLoading() {
      return this.lines.length === 0;
    },

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

    btcProfit() {
      const firstValue = this.lineDataBtc[0].value;
      const lastValue = this.lineDataBtc[this.lineDataBtc.length - 1].value;
      const diff = lastValue - firstValue;
      const onePercent = firstValue / 100;
      const profit = diff / onePercent;

      return profit?.toFixed(2);
    },

    totalProfit() {
      return this.linesDataTotal[this.linesDataTotal.length - 1]?.value || 0;
    },

    marketChangeProfit() {
      const lastValue =
        this.lineDataMarketChange[this.lineDataMarketChange.length - 1].value;

      return lastValue?.toFixed(2);
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

    isLineBtcVisible(value) {
      this.updateLineBtc();
    },

    isLineMarketChangeVisible(value) {
      this.updateLineMarketChange();
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
      this.updateLineBtc();
    },

    linesEnabled() {
      if (this.linesEnabled.length === 1) {
        if (this.zoomCondition) this.setMarks();
      } else {
        this.clearMarks();
      }

      this.updateLineTotal();
      this.updateLineBtc();
      this.updateLineMarketChange();
    },
  },

  methods: {
    ////
    async initChart() {
      this.createLinesFromServer({ isUpdate: false });

      const chartContainer = document.getElementById("chart-container");
      chart = createChart(chartContainer, this.chartOptions);

      this.setupChartLines();
      this.setupChartTotal();
      this.setupChartBtc();
      this.setupChartMarketChange();

      chart.timeScale().fitContent();

      this.setupZoomListener();
    },

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

    setupChartBtc() {
      const seriesDataBtc = this.prepareSeriesDataBtc();

      lineSeriesBtc = chart.addLineSeries({
        color: "black",
        priceScaleId: "left",
        lineWidth: this.lineWidth,
        visible: this.isLineBtcVisible,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      lineSeriesBtc.setData(seriesDataBtc);
    },

    setupChartMarketChange() {
      const seriesDataMarketChange = this.prepareSeriesDataMarketChange();

      lineSeriesMarketChange = chart.addLineSeries({
        color: "gray",
        priceScaleId: "right",
        lineWidth: this.lineWidth,
        visible: this.isLineMarketChangeVisible,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      lineSeriesMarketChange.setData(seriesDataMarketChange);
    },

    setupChartTotal() {
      lineSeriesTotal = chart.addLineSeries({
        color: "white",
        priceScaleId: "right",
        lineWidth: this.lineWidth * 2,
        visible: this.isLineTotalVisible && this.linesEnabled.length !== 1,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      const seriesDataTotal = this.prepareSeriesDataTotal();

      lineSeriesTotal.setData(seriesDataTotal);
    },

    ////
    prepareSeriesData(lineData: string[]): ISeries[] {
      const data = lineData.map((row: string) => {
        const [, dateString, , , , trade, , , , profit] = row.split(",");

        return {
          time: Date.parse(dateString) / 1000,
          value: parseFloat(parseFloat(profit).toFixed(2)),
          trade,
        };
      });

      return data;
    },

    prepareSeriesDataTotal() {
      const lines =
        this.hasLineTotalOnly || this.hasNoLines
          ? this.lines
          : this.linesEnabled;

      const linesDataTotal = lines
        .flatMap((line: ILine): string[] => line.data)
        .map((row: string): ISeries => {
          const [
            ,
            dateString,
            btcValue,
            ,
            ,
            ,
            ,
            ,
            profit,
            ,
            marketChangeValue,
          ] = row.split(",");

          return {
            time: Date.parse(dateString) / 1000,
            value: parseFloat(profit),
            btcValue: parseFloat(btcValue),
            marketChangeValue: parseFloat(marketChangeValue),
          };
        })
        .sort((a: ISeries, b: ISeries) => a.time - b.time)
        .map((row: ISeries, index: number, array: ISeries[]) => {
          if (index === 0) return row;

          row.value = parseFloat(
            (array[index - 1].value + row.value).toString()
          );

          return row;
        })
        .map((row: ISeries) => {
          row.value = parseFloat((row.value / lines.length).toFixed(2));
          return row;
        })
        .filter((line: ISeries, index: number, array: ISeries[]) => {
          return line.time !== array[index + 1]?.time;
        });

      this.linesDataTotal = linesDataTotal;

      return linesDataTotal;
    },

    prepareSeriesDataBtc() {
      const data = this.linesDataTotal.map(({ time, btcValue }) => {
        return {
          time,
          value: btcValue,
        };
      });

      this.lineDataBtc = data;

      return data;
    },

    prepareSeriesDataMarketChange() {
      const data = this.linesDataTotal.map(({ time, marketChangeValue }) => {
        return {
          time,
          value: marketChangeValue,
        };
      });

      this.lineDataMarketChange = data;

      return data;
    },

    ////
    // Create lines
    createLinesFromServer({ isUpdate }) {
      const lines: ILine[] = this.serverLines.map(
        (file: IServerLine, index: number): ILine => ({
          name: file.name.split(".")[0],
          data: file.data.trim().split("\n").slice(1),
          color: this.getColor(index),
          disabled: isUpdate ? this.lines[index].disabled : true,
        })
      );

      this.lines = lines;
    },

    async createLinesFromInput({ target }) {
      // console.log(event.target.files);
      const inputFiles = [...target.files];

      if (!inputFiles.length) return;

      const lines = await Promise.all(
        inputFiles.map(async (file: File, index: number): Promise<ILine> => {
          // console.log("file.text():", await file.text());
          const lineText = await file.text();
          const lineName = file.name.split(".")[0];

          const line: ILine = {
            name: lineName,
            data: lineText.trim().split("\n").slice(1),
            color: this.getColor(index),
            disabled: false,
          };

          return line;
        })
      );

      chart = null;
      lineSeries = [];
      lineSeriesBtc = null;
      lineSeriesTotal = null;
      this.isLineMarked = false;
      this.linesData = [];
      this.lineDataBtc = [];
      this.lineDataMarketChange = [];
      this.linesDataTotal = [];
      this.isLineBtcVisible = true;
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
      this.setupChartBtc();

      chart.timeScale().fitContent();
      this.setupZoomListener();
    },

    ////
    updateLineBtcVisibility() {
      this.isLineBtcVisible = !this.isLineBtcVisible;
    },

    updateLineTotalVisibility() {
      const isLastLine = this.linesEnabled.length === 1;

      if (!isLastLine) {
        this.isLineTotalVisible = !this.isLineTotalVisible;
      }
    },

    updateLineMarketChangeVisibility() {
      this.isLineMarketChangeVisible = !this.isLineMarketChangeVisible;
    },

    updateLineVisibility(index: number) {
      // BTC / USDT line
      this.updateLineBtc();

      // Market change line
      this.updateLineMarketChange();

      // Total line
      this.updateLineTotal();

      // Line
      const line = this.lines[index];

      line.disabled = !line.disabled;
      lineSeries[index].applyOptions({
        visible: !line.disabled,
      });
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

    updateLineBtc() {
      lineSeriesBtc.applyOptions({ visible: this.isLineBtcVisible });

      const seriesDataBtc = this.prepareSeriesDataBtc();

      lineSeriesBtc.setData(seriesDataBtc);
    },

    updateLineMarketChange() {
      lineSeriesMarketChange.applyOptions({
        visible: this.isLineMarketChangeVisible,
      });

      const seriesDataMarketChange = this.prepareSeriesDataMarketChange();

      lineSeriesMarketChange.setData(seriesDataMarketChange);
    },

    ////
    setupResizeListener() {
      const handler = () =>
        chart.resize(window.innerWidth - 20, this.chartOptions.height, true);

      window.addEventListener("resize", handler);
    },

    setupChartUpdate() {
      this.updateInterval = setInterval(async () => {
        await this.fetchData();

        this.createLinesFromServer({ isUpdate: true });
        this.updateLines();
        this.updateLineTotal();
        this.updateLineBtc();
        this.updateLineMarketChange();
      }, this.updateTimeout);
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

    getColor(index: number): string {
      if (index < this.colors.length) {
        return this.colors[index];
      }

      return this.colors[index % this.colors.length];
    },

    setMarks() {
      const line = this.linesEnabled[0];
      const index = this.lines.indexOf(line);
      const lineData = this.prepareSeriesData(line.data);
      const markers = lineData
        .filter(({ trade }) => trade)
        .filter((trade) => trade === ("BUY" || "SELL"))
        .map(({ trade, time }) => ({
          time,
          position: trade === "BUY" ? "belowBar" : "aboveBar",
          color: trade === "BUY" ? "green" : "red",
          shape: trade === "BUY" ? "arrowUp" : "arrowDown",
          id: `${time}-${trade}`,
        }));

      this.lineSeriesMarked = lineSeries[index];
      this.lineSeriesMarked.setMarkers(markers);
      this.lineMarked = true;
    },

    clearMarks() {
      this.lineSeriesMarked?.setMarkers([]);
      this.lineSeriesMarked = null;
    },

    async fetchData() {
      const response = await fetch(`http://${window.location.hostname}/lines`);
      const serverLines: IServerLine[] = await response.json();
      this.serverLines = serverLines;
    },
  },

  async mounted() {
    await this.fetchData();
    this.initChart();
    this.setupResizeListener();
    this.setupChartUpdate();
  },

  unmounted() {
    chart.remove();
    chart = null;
    clearInterval(this.updateInterval);
  },
};
</script>

<style lang="scss">
.clip-right,
.clip-right:before {
  clip-path: polygon(100% 0, 100% 30px, calc(100% - 21px) 100%, 0 100%, 0 0);
}

.clip-left,
.clip-left:before {
  clip-path: polygon(21px 0%, 100% 0, 100% 100%, 0 100%, 0% 12px);
}

.full-screen-button {
  position: absolute;
  top: 7px;
  left: 72px;
  width: 32px;
  height: auto;
  z-index: 9999;
  filter: grayscale(1) brightness(1.4);
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

  .info {
    flex-grow: 1;
  }

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
    background: white;
    width: 100%;

    &--disabled {
      background: none;
    }
  }

  .btc {
    background: black;
    min-width: calc(50% - 1px);

    &--disabled {
      background: none;
    }
  }

  .market-change {
    background: grey;
    min-width: calc(50% - 1px);

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
  min-width: calc(100% / 3 - 1px);

  &--disabled {
    background-color: lightgrey !important;
  }
}

.line__details {
  display: flex;
  justify-content: space-between;
  margin: 12px;
  padding-inline: 5px;
  flex-wrap: nowrap;

  .line__name,
  .line__last-value {
    background: var(--background-color);
    padding-inline: 7px;
  }

  .line__last-value {
    margin-left: 7px;
    font-weight: bold;
  }
}

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
</style>
