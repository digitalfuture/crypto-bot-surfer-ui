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
          useCommission ? "With Comission" : "Without Comission"
        }}</span>
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
          linesData[index][linesData[index].length - 1] &&
            updateLineVisibility(index)
        "
      >
        <div class="line__details">
          <span class="line__name" v-text="line.name" />
          <span class="line__last-value" v-text="getLegendValue(index)" />
          <span
            class="round"
            :class="{
              'round--green':
                linesData[index][linesData[index].length - 1]?.value > 0,
              'round--red':
                linesData[index][linesData[index].length - 1]?.value < 0,
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
      updateTimeout: 1000 * 60 * 3,
      updateInterval: null,
      lineWidth: 2.5,
      isFullScreen: false,
      isLineMarked: false,
      useCommission: true,

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
      const lineData = this.linesData[index];
      const lineValue = lineData[lineData.length - 1]?.value || "0.00";
      const result = lineValue ? parseFloat(lineValue).toFixed(2) : "0.00";

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
      const tradeArray = lineData.map((row: string[]) => {
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

        return {
          dateString,
          trade,
          tradePrice: parseFloat(tradePrice),
          commission: parseFloat(commission),
          profitPercent: parseFloat(profitPercent),
          profitTotalPercent: parseFloat(profitTotalPercent),
          tokenName,
          count,
          priceChangePercent,
        };
      });

      if (!this.useCommission) {
        let cumulativeCommissionPercent = 0;

        tradeArray.forEach((trade) => {
          if (trade.trade === "BUY" || trade.trade === "SELL") {
            const commissionPercent =
              (Math.abs(trade.commission) / trade.tradePrice) * 100;
            cumulativeCommissionPercent += commissionPercent;
          }

          trade.profitTotalPercent += cumulativeCommissionPercent;
        });
      }

      return tradeArray.map(
        ({ dateString, trade, tradePrice, profitTotalPercent, tokenName }) => {
          return {
            time: Date.parse(dateString) / 1000,
            trade,
            price: tradePrice,
            value: profitTotalPercent,
            tokenName,
          };
        }
      );
    },

    prepareSeriesDataTotal(): ISeries[] {
      const isAllLinesSelected: boolean =
        this.hasLineTotalOnly || this.hasNoLines;

      const lines: ILine[] = isAllLinesSelected
        ? this.lines
        : this.linesEnabled;

      const allTimesData = lines
        .flatMap((line: ILine): ISeries[] => this.prepareSeriesData(line.data))
        .sort((a: ISeries, b: ISeries) => a.time - b.time)
        .map(({ time }) => time)
        .filter((time: number, index: number, array: number[]) => {
          return time !== array[index + 1];
        });

      const alignedLines: ISeries[][] = lines.map((line: ILine) => {
        const lineData = this.prepareSeriesData(line.data);
        const alignedLine: ISeries[] = [];

        for (let i = 0; i < allTimesData.length; i++) {
          const time = allTimesData[i];
          const matchingSeries = lineData.find(
            ({ time: seriesTime }) => seriesTime === time
          );

          if (matchingSeries) {
            alignedLine.push(matchingSeries);
          } else {
            const previousSeries = alignedLine[i - 1];

            if (previousSeries) {
              alignedLine.push({
                time,
                value: previousSeries.value,
              });
            } else {
              alignedLine.push({
                time,
                value: 0,
              });
            }
          }
        }

        return alignedLine;
      });

      const linesDataTotal: ISeries[] = allTimesData.map(
        (time: number, index: number) => {
          const sum = alignedLines.reduce((total: number, line: ISeries[]) => {
            return total + line[index].value;
          }, 0);

          const averageValue = sum / alignedLines.length;

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
          name: file.name.split(".")[0],
          data: file.data.map((item: string): string[] => item.split(",")),
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
          const lineText = await file.text();
          const lineName = file.name.split(".")[0];

          const line: ILine = {
            name: lineName,
            data: lineText
              .trim()
              .split("\n")
              .slice(1)
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

        if (!param || !param.seriesData) {
          annotation.style.display = "none";
          return;
        }

        const point = param.point;

        if (!point) {
          annotation.style.display = "none";
          return;
        }

        let annotationTokenText = "";
        let annotationPriceText = "";
        let color = "transparent";

        lineSeries.forEach((series, index) => {
          const seriesData = param.seriesData.get(series);

          if (this.lines[index].disabled) return;

          const line = this.linesData[index].find(
            (item) =>
              item.time === seriesData?.time && item.value === seriesData?.value
          );

          if (line?.trade) {
            annotationTokenText += `${line.tokenName}<br>`;
            annotationPriceText += `${line.price.toFixed(4)}<br>`;
            color = this.lines[index].color;
          }
        });

        if (annotationToken) {
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

    //// API
    async fetchData() {
      const port = window.location["hostname"] === "localhost" ? 8081 : 80;
      const response = await fetch(
        `http://${window.location.hostname}:${port}/lines`
      );
      const serverLines: IServerLine[] = await response.json();
      this.isLoading = false;
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
</style>
