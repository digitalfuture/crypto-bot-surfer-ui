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
        @change="convertFileDataToLines"
      />

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

      <!-- Market average -->
      <div
        class="line market-average clip-right cursor-pointer"
        :class="{ 'market-average--disabled': !isLineMarketAverageVisible }"
        @click="updateLineMarketAverageVisibility"
      >
        <div class="line__details info">
          <span class="line__name">THE OTHERS / USDT</span>
          <span class="line__last-value"> {{ marketAverageProfit }} </span>
        </div>
      </div>

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
  marketAverageValue?: number;
}
</script>

<script lang="ts">
let chart = null;
let lineSeries = [];
let lineSeriesBtc = null;
let lineSeriesMarketAverage = null;
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
      lineDataMarketAverage: [],
      linesDataTotal: [],

      isLineBtcVisible: true,
      isLineMarketAverageVisible: true,
      isLineTotalVisible: true,

      lineSeriesMarked: null,

      zoom: null,
      zoomCondition: false,

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

    marketAverageProfit() {
      const firstValue = this.lineDataMarketAverage[0].value;
      const lastValue =
        this.lineDataMarketAverage[this.lineDataMarketAverage.length - 1].value;
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

    isLineMarketAverageVisible(value) {
      this.updateLineMarketAverage();
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
      this.updateLineMarketAverage();
    },
  },

  methods: {
    //// Init chart
    async initChart() {
      this.convertServerDataToLines({ isUpdate: false });

      const chartContainer = document.getElementById("chart-container");
      chart = createChart(chartContainer, this.chartOptions);

      this.setupChartMarketAverage();
      this.setupChartTotal();
      this.setupChartBtc();
      this.setupChartLines();

      chart.timeScale().fitContent();

      this.setupZoomListener();
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

    setupChartMarketAverage() {
      const seriesDataMarketAverage = this.prepareSeriesDataMarketAverage();

      lineSeriesMarketAverage = chart.addLineSeries({
        color: "gray",
        priceScaleId: "",
        lineWidth: this.lineWidth / 2,
        visible: this.isLineMarketAverageVisible,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      lineSeriesMarketAverage.setData(seriesDataMarketAverage);
    },

    //// Create line series
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
            marketAverageValue,
          ] = row.split(",");

          return {
            time: Date.parse(dateString) / 1000,
            value: parseFloat(profit),
            btcValue: parseFloat(btcValue),
            marketAverageValue:
              parseFloat(marketAverageValue) / parseFloat(btcValue),
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

    prepareSeriesDataMarketAverage() {
      const data = this.linesDataTotal.map(({ time, marketAverageValue }) => {
        return {
          time,
          value: marketAverageValue,
        };
      });

      this.lineDataMarketAverage = data;

      return data;
    },

    ////
    // Convert server data to lines
    convertServerDataToLines({ isUpdate }) {
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

    async convertFileDataToLines({ target }) {
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
      this.lineDataMarketAverage = [];
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

    //// Updates
    updateLineBtcVisibility() {
      this.isLineBtcVisible = !this.isLineBtcVisible;
    },

    updateLineTotalVisibility() {
      const isLastLine = this.linesEnabled.length === 1;

      if (!isLastLine) {
        this.isLineTotalVisible = !this.isLineTotalVisible;
      }
    },

    updateLineMarketAverageVisibility() {
      this.isLineMarketAverageVisible = !this.isLineMarketAverageVisible;
    },

    updateLineVisibility(index: number) {
      // BTC / USDT line
      this.updateLineBtc();

      // Market change line
      this.updateLineMarketAverage();

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

    updateLineMarketAverage() {
      lineSeriesMarketAverage.applyOptions({
        visible: this.isLineMarketAverageVisible,
      });

      const seriesDataMarketAverage = this.prepareSeriesDataMarketAverage();

      lineSeriesMarketAverage.setData(seriesDataMarketAverage);
    },

    setupChartUpdate() {
      this.updateInterval = setInterval(async () => {
        await this.fetchData();

        this.convertServerDataToLines({ isUpdate: true });
        this.updateLines();
        this.updateLineTotal();
        this.updateLineBtc();
        this.updateLineMarketAverage();
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
      this.lineSeriesMarked.setMarkers(markers);
      this.lineMarked = true;
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

    //// Fetches
    async fetchData() {
      const response = await fetch(`http://${window.location.hostname}/lines`);
      const serverLines: IServerLine[] = await response.json();
      this.serverLines = serverLines;
    },
  },

  //// Life cycle
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
  left: 82px;
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
    min-width: calc(100% / 3 - 1px);

    &--disabled {
      background: none;
    }
  }

  .btc {
    background: black;
    min-width: calc(100% / 3 - 1px);

    &--disabled {
      background: none;
    }
  }

  .market-average {
    background: grey;
    min-width: calc(100% / 3 - 1px);

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

// Lists
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

// $step: 100 / 99; // step between colors
// $colors: (); // empty list for colors

// @for $i from 0 through 99 {
//   $hue: $i * $step; // hue
//   $saturation: 100%; // saturation
//   $value: 100%; // brightness
//   $rgb: hsv(
//     $hue,
//     $saturation,
//     $value
//   ); // RGB color by hue, saturation and brightness
//   $r: nth($rgb, 1); // red channel
//   $g: nth($rgb, 2); // green channel
//   $b: nth($rgb, 3); // blue channel
//   $color: rgb($r, $g, $b); // CSS color
//   $colors: append($colors, $color); // add color to list
// }

// @for $i from 1 through 100 {
//   $color: nth($colors, $i); // get color by index
//   $name: "--color-#{$i}"; // variable name
//   #{$name}: $color; // assign value to variable
// }

// Example
// --color-1: rgb(255, 0, 0);
// --color-2: rgb(255, 25, 0);
// --color-3: rgb(255, 51, 0);
// --color-4: rgb(255, 76, 0);
// --color-5: rgb(255, 102, 0);
// --color-6: rgb(255, 127, 0);
// --color-7: rgb(255, 153, 0);
// --color-8: rgb(255, 178, 0);
// --color-9: rgb(255, 204, 0);
// --color-10: rgb(255, 229,
</style>
