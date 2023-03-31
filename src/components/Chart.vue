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

    <div class="info-container">
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

      <div
        class="total info line clip-right cursor-pointer"
        :class="{
          'total--disabled': !isLineTotalVisible || linesEnabled.length === 1,
        }"
        @click="updatelineTotalVisibility"
      >
        <div class="line__details info">
          <span class="line__name">TOTAL</span>
          <span class="line__last-value"> {{ totalProfit }}%</span>
        </div>
      </div>

      <input
        type="file"
        multiple
        ref="input"
        class="input info clip-left cursor-pointer"
        @change="createLinesFromInput"
      />
    </div>

    <section ref="legend" class="legend">
      <div
        v-for="(line, index) in lines"
        :key="index"
        :style="{
          background: !line.disabled ? line.color : 'transparent',
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

export interface IServerFile {
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
}
</script>

<script lang="ts">
let chart = null;
let lineSeries = [];
let lineSeriesBtc = null;
let lineSeriesTotal = null;

export default {
  name: "Chart",

  data() {
    return {
      serverFiles: [],
      updateTimeout: 1000 * 60 * 3,
      updateInterval: null,
      lineWidth: 2.5,
      isFullScreen: false,
      isLineMarked: false,

      lines: [],

      linesData: [],
      lineDataBtc: [],
      linesDataTotal: [],

      isLineBtcVisible: true,
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
        height: this.isFullScreen ? window.innerHeight : 340,
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
      return this.linesDataTotal[this.linesDataTotal.length - 1]?.value || 0;
    },

    btcProfit() {
      const firstValue = this.lineDataBtc[0].value;
      const lastValue = this.lineDataBtc[this.lineDataBtc.length - 1].value;
      const diff = lastValue - firstValue;
      const onePercent = firstValue / 100;
      const profit = diff / onePercent;

      return profit?.toFixed(2);
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

        const seriesData = this.getSeriesData(line.data);

        lineSeries.push(newLineSeries);
        newLineSeries.setData(seriesData);

        linesData.push(seriesData);
      }

      this.linesData = linesData;
    },

    setupChartBtc() {
      const seriesDataBtc = this.getSeriesDataBtc();

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

    setupChartTotal() {
      lineSeriesTotal = chart.addLineSeries({
        color: "white",
        priceScaleId: "right",
        lineWidth: this.lineWidth * 2,
        visible: this.isLineTotalVisible && this.linesEnabled.length !== 1,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      const seriesDataTotal = this.getSeriesDataTotal();

      lineSeriesTotal.setData(seriesDataTotal);
    },

    ////
    getSeriesData(lineData: string[]): ISeries[] {
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

    getSeriesDataBtc() {
      const data = this.linesDataTotal.map(({ time, btcValue }) => {
        return {
          time,
          value: btcValue,
        };
      });

      this.lineDataBtc = data;

      return data;
    },

    getSeriesDataTotal() {
      const lines =
        this.hasLineTotalOnly || this.hasNoLines
          ? this.lines
          : this.linesEnabled;

      const linesDataTotal = lines
        .flatMap((line: ILine): string[] => line.data)
        .map((row: string): ISeries => {
          const [, dateString, btcValue, , , , , , profit] = row.split(",");

          return {
            time: Date.parse(dateString) / 1000,
            value: parseFloat(profit),
            btcValue: parseFloat(btcValue),
          };
        })
        .sort((a: ISeries, b: ISeries) => a.time - b.time)
        .map((row: ISeries, index: number, array: ISeries[]) => {
          if (index === 0) return row;

          row.value = parseFloat(
            (array[index - 1].value + row.value).toFixed(2)
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

    ////
    // Create lines
    createLinesFromServer({ isUpdate }) {
      const lines: ILine[] = this.serverFiles.map(
        (file: IServerFile, index: number): ILine => ({
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

      this.lines = lines;
    },

    ////
    updateLineBtcVisibility() {
      this.isLineBtcVisible = !this.isLineBtcVisible;
    },

    updatelineTotalVisibility() {
      const isLastLine = this.linesEnabled.length === 1;

      if (!isLastLine) {
        this.isLineTotalVisible = !this.isLineTotalVisible;
      }
    },

    updateLineVisibility(index: number) {
      // BTC / USDT line
      this.updateLineBtc(index);

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
        const seriesData = this.getSeriesData(line.data);
        lineSeries[index].setData(seriesData);
        linesData.push(seriesData);
      }

      this.linesData = linesData;
    },

    updateLineTotal() {
      lineSeriesTotal.applyOptions({
        visible: this.isLineTotalVisible && this.linesEnabled.length !== 1,
      });

      const seriesDataTotal = this.getSeriesDataTotal();
      lineSeriesTotal.setData(seriesDataTotal);
    },

    updateLineBtc() {
      lineSeriesBtc.applyOptions({ visible: this.isLineBtcVisible });

      const seriesDataBtc = this.getSeriesDataBtc();
      lineSeriesBtc.setData(seriesDataBtc);
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
      const lineData = this.getSeriesData(line.data);
      const markers = lineData
        .filter(({ trade }) => trade)
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
      const response = await fetch(`http://${window.location.hostname}/files`);
      const serverFiles: IServerFile[] = await response.json();
      this.serverFiles = serverFiles;
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
  margin-bottom: 7px;

  .info {
    flex-grow: 1;
    min-width: 33.3%;
  }

  .input {
    background: var(--background-color);
    position: relative;
    padding: 5px;
    width: 33.3%;
    height: 42px;
    padding-left: 50px;
    margin-bottom: 7px;

    &:before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      z-index: 10;
      width: 100%;
      height: 100%;
      background: black;
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
    margin-bottom: 7px;

    &--disabled {
      background: none;
    }

    .info__details {
      display: inline-block;
      margin: 12px;
      background: var(--background-color);
      padding-inline: 5px;
    }
  }

  .btc {
    background: black;
    margin-bottom: 7px;

    &--disabled {
      background: none;
    }
  }
}

.legend {
  margin-top: -7px;
  position: relative;
  font-size: 14px;
  line-height: 18px;
  font-weight: 300;
  display: flex;
  flex-wrap: wrap;
  text-transform: uppercase;
  gap: 1px;
}

.line {
  flex-grow: 1;
  min-width: 33.3%;

  &--disabled {
    background: lightgrey !important;
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
