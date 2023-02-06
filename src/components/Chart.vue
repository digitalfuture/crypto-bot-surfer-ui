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
      <input
        type="file"
        multiple
        ref="input"
        class="input info cursor-pointer"
        @change="createLinesFromInput"
      />

      <div
        class="summary info line clip-left cursor-pointer"
        :class="{
          'summary--disabled': !isLineTotalVisible || linesEnabled.length === 1,
        }"
        @click="isLineTotalVisible = !isLineTotalVisible"
      >
        <span class="info__details"> TOTAL: {{ summ }}%</span>
      </div>

      <div
        class="line btc clip-right cursor-pointer"
        :class="{ 'btc--disabled': !isLineBtcVisible }"
        @click="isLineBtcVisible = !isLineBtcVisible"
      >
        <span class="line__name info">BTC / USDT</span>
      </div>
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
          'line--disabled': isLineTotalOnly,
        }"
        @click="updateLineVisibility(index)"
      >
        <span class="line__name" v-text="line.name" />
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
  marked?: boolean;
}

export interface ISeries {
  time: number;
  value: number;
  trade?: string;
}
</script>

<script lang="ts">
export default {
  name: "Chart",

  data() {
    return {
      seriesMaxLength: 300,
      lineWidth: 3,

      chart: null,

      isFullScreen: false,

      lines: [],

      lineSeries: [],
      lineSeriesBtc: [],
      lineSeriesTotal: [],

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
        },
        leftPriceScale: {
          visible: true,
        },
        layout: {
          background: { color: "transparent" },
        },
      };
    },

    summ() {
      const lines = this.isLineTotalOnly ? this.lines : this.linesEnabled;

      const result = lines
        .map((line) => line.data[line.data.length - 1].split(",").reverse()[0])
        .reduce((sum: number, value: string) => {
          return sum + parseFloat(value);
        }, 0);

      return parseFloat((result / lines.length).toFixed(2)) || 0;
    },

    linesEnabled() {
      return this.lines.filter((line: ILine) => !line.disabled);
    },

    isLineTotalOnly() {
      return this.isLineTotalVisible && this.linesEnabled.length === 0;
    },
  },

  watch: {
    isFullScreen(isFullscreen) {
      if (isFullscreen) {
        this.chart.applyOptions({ height: window.innerHeight });
      } else {
        this.chart.applyOptions({ height: this.chartOptions.height });
      }
    },

    isLineBtcVisible(value) {
      this.lineSeriesBtc.applyOptions({ visible: value });
    },

    isLineTotalVisible(value) {
      this.lineSeriesTotal.applyOptions({ visible: value });
    },

    zoom(value) {
      // const diffMs = value.to - value.from;
      // const lineMarked = this.lines.find((line: ILine) => line.marked);
      // console.log(lineMarked);
      // condition: if (diffMs < 20000 && this.linesEnabled.length === 1) {
      //   if (lineMarked) break condition;
      //   const line = this.lines.find((line: ILine) => !line.disabled);
      //   const index = this.lines.indexOf(line);
      //   const lineData = this.getSeriesData(line.data);
      //   const markers = lineData
      //     .filter(({ trade }) => trade)
      //     .map(({ trade, time }) => ({
      //       time,
      //       position: trade === "BUY" ? "belowBar" : "aboveBar",
      //       color: trade === "BUY" ? "green" : "red",
      //       shape: trade === "BUY" ? "arrowUp" : "arrowDown",
      //       id: `${time}-${trade}`,
      //     }));
      //   console.log(markers.slice(0, 2));
      //   this.lineSeriesMarked = this.lineSeries[index];
      //   this.lineSeriesMarked.setMarkers(markers);
      // } else if (lineMarked) {
      //   console.log("lineMarked");
      //   this.lineSeriesMarked.setMarkers([]);
      //   this.lineSeriesMarked = null;
      //   lineMarked.marked = false;
      // }
    },
  },

  methods: {
    ////
    async initChart() {
      const response = await fetch(`http://${window.location.hostname}/files`);
      const serverFiiles: string[] = await response.json();

      this.createLinesFromServer(serverFiiles);

      const chartContainer = document.getElementById("chart-container");
      this.chart = createChart(chartContainer, this.chartOptions);

      this.setupChartBtc();
      this.setupChartLines();
      this.setupChartTotal();

      this.chart.timeScale().fitContent();

      this.setZoomListener();
    },

    setupChartLines() {
      for (const line of this.lines) {
        const lineSeries = this.chart.addLineSeries({
          color: line.color,
          priceScaleId: "right",
          lineWidth: this.lineWidth,
          visible: !this.isLineTotalOnly && !line.disabled,
        });

        const linesData = this.getSeriesData(line.data);

        this.lineSeries.push(lineSeries);
        lineSeries.setData(linesData);
      }
    },

    setupChartBtc() {
      let lineDataBtc = "";

      for (const line of this.lines) {
        const isDataLonger = lineDataBtc.length < line.data.length;

        if (isDataLonger) lineDataBtc = line.data;
      }

      const seriesDataBtc = this.getSeriesDataBtc(lineDataBtc);

      this.lineSeriesBtc = this.chart.addLineSeries({
        color: "black",
        priceScaleId: "left",
        lineWidth: this.lineWidth,
        visible: this.isLineBtcVisible,
        axisLabelVisible: true,
      });

      this.lineSeriesBtc.setData(seriesDataBtc);
    },

    setupChartTotal() {
      const seriesDataTotal = this.getSeriesDataTotal();

      this.lineSeriesTotal = this.chart.addLineSeries({
        color: "white",
        priceScaleId: "right",
        lineWidth: this.lineWidth * 2,
        visible: this.isLineTotalVisible && this.linesEnabled.length !== 1,
      });

      this.lineSeriesTotal.setData(seriesDataTotal);
    },

    ////
    getSeriesData(lineData: string[]): ISeries[] {
      const data = lineData
        .map((row: string) => {
          const [, dateString, , , , trade, , , , profit] = row.split(",");

          return {
            time: Date.parse(dateString) / 1000,
            value: parseFloat(profit),
            trade,
          };
        })
        .filter(this.maxLengthFilter);

      return data;
    },

    getSeriesDataBtc(lineData: string[]) {
      const data = lineData
        .map((row: string) => {
          const [, dateString, btcPrice, , , , , , ,] = row.split(",");

          return {
            time: Date.parse(dateString) / 1000,
            value: parseFloat(btcPrice),
          };
        })
        .filter(this.maxLengthFilter);

      return data;
    },

    getSeriesDataTotal() {
      const lines = this.isLineTotalOnly ? this.lines : this.linesEnabled;

      const seriesDataTotal = lines
        .flatMap((line: ILine): string[] => line.data)
        .map((row: string): ISeries => {
          const [, dateString, , , , , , , profit] = row.split(",");

          return {
            time: Date.parse(dateString) / 1000,
            value: parseFloat(profit),
          };
        })
        .sort((a, b) => a.time - b.time)
        .map((row, index, array) => {
          if (index === 0) return row;

          row.value = parseFloat(
            (array[index - 1].value + row.value).toFixed(2)
          );

          return row;
        })
        .map((row) => {
          row.value = parseFloat((row.value / lines.length).toFixed(2));
          return row;
        })
        .filter(this.maxLengthFilter);

      return seriesDataTotal;
    },

    maxLengthFilter(_: ISeries, index: number, array: []) {
      if (this.linesEnabled.length === 1) return true;
      const step = Math.round(array.length / this.seriesMaxLength);
      return index % step === 0 || index === array.length - 1;
    },

    ////
    // Create lines
    createLinesFromServer(serverFiiles: IServerFile[]) {
      const lines: ILine[] = serverFiiles.map(
        (file: IServerFile, index: number): ILine => ({
          name: file.name.split(".")[0],
          data: file.data.trim().split("\n").slice(1),
          color: this.getColor(index),
          disabled: true,
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
    updateLineVisibility(index: number) {
      const line = this.lines[index];

      line.disabled = !line.disabled;
      this.lineSeries[index].applyOptions({
        visible: !line.disabled,
      });

      this.updateLines(index);
      this.chart.timeScale().fitContent();
    },

    updateLines(index: number) {
      // Total
      const seriesDataTotal = this.getSeriesDataTotal();

      this.lineSeriesTotal.applyOptions({
        visible: this.isLineTotalVisible && this.linesEnabled.length !== 1,
      });

      this.lineSeriesTotal.setData(seriesDataTotal);

      if (this.linesEnabled.length === 1) {
        const line = this.lines[index];

        // BTC / USDT
        const seriesDataBtc = this.getSeriesDataBtc(line.data);
        this.lineSeriesBtc.setData(seriesDataBtc);
      }
    },

    ////
    setResizeListener() {
      const handler = () =>
        this.chart.resize(
          window.innerWidth - 20,
          this.chartOptions.height,
          true
        );

      window.addEventListener("resize", handler);
    },

    async setZoomListener() {
      const myVisibleTimeRangeChangeHandler = (newVisibleTimeRange) => {
        if (newVisibleTimeRange === null) {
          // handle null
        }

        this.zoom = newVisibleTimeRange;
      };

      await this.chart
        .timeScale()
        .subscribeVisibleTimeRangeChange(myVisibleTimeRangeChangeHandler);
    },

    getColor(index: number): string {
      if (index < this.colors.length) {
        return this.colors[index];
      }

      return this.colors[index % this.colors.length];
    },
  },

  mounted() {
    this.initChart();
    this.setResizeListener();
  },

  unmounted() {
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }
  },
};
</script>

<style lang="scss">
.clip-right {
  clip-path: polygon(100% 0, 100% 30px, calc(100% - 21px) 100%, 0 100%, 0 0);
}

.clip-left {
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

  input[type="file"] {
    flex-grow: 0;
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
      clip-path: polygon(21px 0%, 100% 0, 100% 100%, 0 100%, 0% 12px);
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

  .summary {
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
}

.line {
  flex-grow: 1;
  min-width: 33.3%;

  &--disabled {
    background: lightgrey !important;
  }

  .line__name {
    display: inline-block;
    margin: 12px;
    background: var(--background-color);
    padding-inline: 5px;
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
