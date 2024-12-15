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

      <div class="use-comission-container">
        <img
          :src="useComission ? '/icons/money.svg' : '/icons/money-off.svg'"
          alt="DNATRADE"
          class="use-comission-button cursor-pointer"
          @click="useComission = !useComission"
        />

        <span class="use-comission-tip">{{
          useComission ? "With Comission" : "Without Comission"
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

      <!-- BTC / USDT -->
      <div
        class="line btc clip-right cursor-pointer"
        :class="{ 'btc--disabled': !isLineBtcVisible }"
        @click="updateLineBtcVisibility"
      >
        <div class="line__details info">
          <span class="line__name">BTC / USDT</span>
          <span class="line__last-value"> {{ btcProfit }} </span>
          <span
            class="round"
            :class="{
              'round--green': parseFloat(btcProfit) > 0,
              'round--red': parseFloat(btcProfit) < 0,
            }"
          />
        </div>
      </div>

      <!-- Market average -->
      <div
        class="line market-average clip-right cursor-pointer"
        :class="{ 'market-average--disabled': !isLineMarketAverageVisible }"
        @click="updateLineMarketAverageVisibility"
      >
        <div class="line__details info">
          <span class="line__name">MARKET EXCEPT BTC</span>
          <span class="line__last-value"> {{ marketAverageProfit }} </span>
          <span
            class="round"
            :class="{
              'round--green': parseFloat(marketAverageProfit) > 0,
              'round--red': parseFloat(marketAverageProfit) < 0,
            }"
          />
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

    <!-- Other lines-->
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
          <span class="line__last-value" v-text="getLineValue(index)" />
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
  btcPrice?: number;
  profit?: number;
  marketAveragePrice?: number;
  sum?: number;
  count?: number;
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
      isLoading: true,
      serverLines: [],
      updateTimeout: 1000 * 60 * 3,
      updateInterval: null,
      lineWidth: 2.5,
      isFullScreen: false,
      isLineMarked: false,
      useComission: true,

      lines: [],

      linesData: [],
      lineDataBtc: [],
      linesDataTotal: [],
      lineDataMarketAverage: [],

      isLineBtcVisible: true,
      isLineMarketAverageVisible: true,
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

    btcProfit() {
      const firstValue = this.lineDataBtc[0].value;
      const lastValue = this.lineDataBtc[this.lineDataBtc.length - 1]?.value;
      const diff = lastValue - firstValue;
      const onePercent = firstValue / 100;
      const profit = diff / onePercent;

      return profit?.toFixed(2);
    },

    marketAverageProfit() {
      const lastValue =
        this.lineDataMarketAverage[this.lineDataMarketAverage.length - 1]
          ?.value;

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

    useComission() {
      this.updateLineTotal();
      this.updateLineBtc();
      this.updateLineMarketAverage();
    },

    tradeDirection() {
      this.updateChart();
    },
  },

  methods: {
    getLineValue(index) {
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

      this.setupChartMarketAverage();
      this.setupChartTotal();
      this.setupChartBtc();
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
        priceScaleId: null,
        lineWidth: this.lineWidth / 2,
        visible: this.isLineMarketAverageVisible,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      lineSeriesMarketAverage.setData(seriesDataMarketAverage);
    },

    //// Prepare line series
    prepareSeriesData(lineData: string[][]): ISeries[] {
      const tradeArray = lineData.map((row: string[]) => {
        const [
          count,
          dateString,
          btcPrice,
          marketAveragePrice,
          tokenName,
          priceChangePercent,
          trade,
          tradePrice,
          comission,
          profit,
          profitTotal,
        ] = row;

        return {
          dateString,
          btcPrice: isNaN(parseFloat(btcPrice)) ? 0 : parseFloat(btcPrice),
          trade,
          tradePrice: isNaN(parseFloat(tradePrice))
            ? 0
            : parseFloat(tradePrice),
          comission: this.useComission
            ? isNaN(parseFloat(comission))
              ? 0
              : parseFloat(comission)
            : 0,
          marketAveragePrice: isNaN(parseFloat(marketAveragePrice))
            ? 0
            : parseFloat(marketAveragePrice),
          profit,
          profitTotal,
          tokenName,
        };
      });

      let profitTotalPercent = 0;
      let lastBuyPrice: number | undefined;
      let lastSellPrice: number | undefined;

      const data = tradeArray.map(
        ({
          dateString,
          btcPrice,
          trade,
          tradePrice,
          comission,
          marketAveragePrice,
          tokenName,
        }) => {
          let onePercent: number = 0;
          let tradeProfit: number = 0;
          let tradeProfitPercent: number = 0;
          let totalProfitPercent: number = 0;

          switch (trade) {
            case "BUY":
              if (lastSellPrice === undefined) {
                lastSellPrice = tradePrice;
              }

              if (
                tradePrice === undefined ||
                lastSellPrice === undefined ||
                isNaN(tradePrice)
              ) {
                console.error("Invalid price or lastSellPrice for BUY:", {
                  tradePrice,
                  lastSellPrice,
                });
                tradeProfit = 0;
                tradeProfitPercent = 0;
              } else {
                tradeProfit = -comission;
                onePercent = tradePrice / 100;
                tradeProfitPercent = tradeProfit / onePercent;

                profitTotalPercent -= comission / onePercent;
                lastBuyPrice = tradePrice;
              }

              break;

            case "SELL":
              if (lastBuyPrice === undefined) {
                lastBuyPrice = tradePrice;
              }

              if (
                tradePrice === undefined ||
                lastBuyPrice === undefined ||
                isNaN(tradePrice)
              ) {
                console.error("Invalid price or lastBuyPrice for SELL:", {
                  tradePrice,
                  lastBuyPrice,
                });
                tradeProfit = 0;
                tradeProfitPercent = 0;
              } else {
                tradeProfit = tradePrice - lastBuyPrice - comission;
                onePercent = lastBuyPrice / 100;
                tradeProfitPercent = tradeProfit / onePercent;

                profitTotalPercent += tradeProfitPercent;
                lastSellPrice = tradePrice;
              }
              break;
          }

          totalProfitPercent = profitTotalPercent;

          // console.log("\n");
          // console.log("trade:", trade);
          // console.log("tradePrice:", tradePrice);
          // console.log("comission:", comission);
          // console.log("totalProfitPercent:", totalProfitPercent);
          // console.log("tradeProfitPercent:", tradeProfitPercent);

          return {
            time: Date.parse(dateString) / 1000,
            trade,
            price: isNaN(tradePrice) ? 0 : tradePrice,
            value: totalProfitPercent,
            btcPrice,
            tokenName,
            marketAveragePrice: isNaN(marketAveragePrice)
              ? 0
              : marketAveragePrice,
          };
        }
      );

      // console.log("data", data);

      return data;
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

    prepareSeriesDataBtc() {
      const isAllLinesSelected: boolean =
        this.hasLineTotalOnly || this.hasNoLines;
      const lines: ILine[] = isAllLinesSelected
        ? this.lines
        : this.linesEnabled;

      const lineDataBtc = lines
        .map((line: ILine): ISeries[] => this.prepareSeriesData(line.data))
        .sort((a, b) => b.length - a.length)[0]
        .map(({ time, btcPrice }) => {
          return {
            time,
            value: btcPrice,
          };
        });

      this.lineDataBtc = lineDataBtc;

      return lineDataBtc;
    },

    prepareSeriesDataMarketAverage() {
      const isAllLinesSelected: boolean =
        this.hasLineTotalOnly || this.hasNoLines;
      const lines: ILine[] = isAllLinesSelected
        ? this.lines
        : this.linesEnabled;

      const lineDataMarketAverage = lines
        .map((line: ILine): ISeries[] => this.prepareSeriesData(line.data))
        .sort((a, b) => b.length - a.length)[0]
        .map(({ time, marketAveragePrice }, index, array) => {
          const initialPrice = array[0].marketAveragePrice;

          return {
            time,
            value: (marketAveragePrice / initialPrice) * 100 - 100,
          };
        });

      this.lineDataMarketAverage = lineDataMarketAverage;

      return lineDataMarketAverage;
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
    updateChart() {
      this.updateLines();
      this.updateLineTotal();
      this.updateLineBtc();
      this.updateLineMarketAverage();
    },

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
      const port = 8081;
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

  .use-comission-container {
    display: flex;

    .use-comission-button {
      width: 25px;
      height: auto;
    }

    .use-comission-tip {
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
      .use-comission-tip {
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
    background: white;

    &--disabled {
      background: none;
    }
  }

  .btc {
    background: black;

    &--disabled {
      background: none;
    }
  }

  .market-average {
    background: grey;

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

#tv-attr-logo {
  display: none !important;
}
</style>
