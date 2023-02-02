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
      alt=""
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
        class="summary info line clip-left"
        :class="{
          'summary--disabled': !isLineTotalVisible || linesEnabled.length === 1,
          'cursor-pointer': linesEnabled.length !== 1,
          'cursor-default': linesEnabled.length === 1,
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
          background: !line.disabled ? line.color : 'none',
        }"
        class="line clip-right cursor-pointer"
        :class="{
          'line--disabled': isLineTotalOnly,
        }"
        @click="line.disabled = !line.disabled"
      >
        <span class="line__name" v-text="line.name" />
      </div>
    </section>
  </template>
</template>

<script setup lang="ts">
export interface IServerFile {
  name: string;
  data: string;
}

export interface ILine {
  name: string;
  data: string;
  color: string;
  disabled: boolean;
}
</script>

<script lang="ts">
import { createChart, LineStyle } from "lightweight-charts";

export default {
  name: "Chart",

  data() {
    return {
      isFullScreen: false,

      lines: [],

      lineSeries: [],

      isLineBtcVisible: true,

      isLineTotalVisible: true,

      colorsReversed: [
        "red",
        "orange",
        "yellow",
        "green",
        "lightgreen",
        "greenyellow",
        "lime",
        "chartreuse",
        "aquamarine",
        "lightblue",
        "skyblue",
        "powderblue",
        "deepskyblue",
        "dodgerblue",
        "blue",
        "mediumblue",
        "navy",
        "violet",
        "indigo",
        "purple",
        "fuchsia",
        "magenta",
        "mediumorchid",
        "mediumpurple",
        "mediumslateblue",
        "blueviolet",
        "darkviolet",
        "darkorchid",
        "darkmagenta",
        "deeppink",
      ],

      colors: [
        // "deeppink",
        // "darkmagenta",
        // "darkorchid",
        // "darkviolet",
        // "blueviolet",
        // "mediumslateblue",
        // "mediumpurple",
        // "mediumorchid",
        // "magenta",
        // "fuchsia",
        // "purple",
        // "indigo",
        // "violet",
        // "navy",
        // "mediumblue",
        // "blue",
        // "dodgerblue",
        // "deepskyblue",
        // "powderblue",
        // "skyblue",
        // "lightblue",
        // "aquamarine",
        // "chartreuse",
        // "lime",
        // "greenyellow",
        // "lightgreen",
        "green",
        "yellow",
        "orange",
        "red",
      ],

      colorsAll: [
        [
          "black",
          "silver",
          "gray",
          "white",
          "maroon",
          "red",
          "purple",
          "fuchsia",
          "green",
          "lime",
          "olive",
          "yellow",
          "navy",
          "blue",
          "teal",
          "aqua",
          "orange",
          "aliceblue",
          "antiquewhite",
          "aquamarine",
          "azure",
          "beige",
          "bisque",
          "blanchedalmond",
          "blueviolet",
          "brown",
          "burlywood",
          "cadetblue",
          "chartreuse",
          "chocolate",
          "coral",
          "cornflowerblue",
          "cornsilk",
          "crimson",
          "darkblue",
          "darkcyan",
          "darkgoldenrod",
          "darkgray",
          "darkgreen",
          "darkgrey",
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
          "darkslategrey",
          "darkturquoise",
          "darkviolet",
          "deeppink",
          "deepskyblue",
          "dimgray",
          "dimgrey",
          "dodgerblue",
          "firebrick",
          "floralwhite",
          "forestgreen",
          "gainsboro",
          "ghostwhite",
          "gold",
          "goldenrod",
          "greenyellow",
          "grey",
          "honeydew",
          "hotpink",
          "indianred",
          "indigo",
          "ivory",
          "khaki",
          "lavender",
          "lavenderblush",
          "lawngreen",
          "lemonchiffon",
          "lightblue",
          "lightcoral",
          "lightcyan",
          "lightgoldenrodyellow",
          "lightgray",
          "lightgreen",
          "lightgrey",
          "lightpink",
          "lightsalmon",
          "lightseagreen",
          "lightskyblue",
          "lightslategray",
          "lightslategrey",
          "lightsteelblue",
          "lightyellow",
          "limegreen",
          "linen",
          "magenta",
          "mediumaquamarine",
          "mediumblue",
          "mediumorchid",
          "mediumpurple",
          "mediumseagreen",
          "mediumslateblue",
          "mediumspringgreen",
          "mediumturquoise",
          "mediumvioletred",
          "midnightblue",
          "mintcream",
          "mistyrose",
          "moccasin",
          "navajowhite",
          "oldlace",
          "olivedrab",
          "orangered",
          "orchid",
          "palegoldenrod",
          "palegreen",
          "paleturquoise",
          "palevioletred",
          "papayawhip",
          "peachpuff",
          "peru",
          "pink",
          "plum",
          "powderblue",
          "rosybrown",
          "royalblue",
          "saddlebrown",
          "salmon",
          "sandybrown",
          "seagreen",
          "seashell",
          "sienna",
          "skyblue",
          "slateblue",
          "slategray",
          "slategrey",
          "snow",
          "springgreen",
          "steelblue",
          "tan",
          "thistle",
          "tomato",
          "transparent",
          "turquoise",
          "violet",
          "wheat",
          "whitesmoke",
          "yellowgreen",
        ],
      ],
    };
  },

  computed: {
    isLoading() {
      return this.lines.length === 0;
    },

    lineWidth() {
      return 2.5;
    },

    chartOptions() {
      return {
        offset: false,
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
        .map((line) => line.data.trim())
        .map((table) => table.split("\n").reverse()[0].split(",").reverse()[0])
        .reduce((sum: number, value: string) => sum + parseFloat(value), 0);

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
    isFullScreen() {
      this.updateChart();
    },

    lines: {
      deep: true,
      handler(value) {
        this.updateChart();
        this.resize();
      },
    },

    isLineBtcVisible: {
      handler() {
        this.updateChart();
        this.resize();
      },
    },

    isLineTotalVisible: {
      handler() {
        this.updateChart();
        this.resize();
      },
    },
  },

  methods: {
    ////
    async updateChart() {
      this.clearChart();

      await this.updateChartBtc();

      for (const line of this.lines) {
        const lineSeries = await this.chart.addLineSeries({
          color: line.color,
          priceScaleId: "right",
          lineWidth: this.lineWidth,
          priceLineVisible: false,
          visible: !this.isLineTotalOnly && !line.disabled,
        });

        const linesData = await this.getSeriesData(line.data);

        this.lineSeries.push(lineSeries);

        lineSeries.setData(linesData);
      }

      await this.updateChartTotal();

      this.chart.timeScale().fitContent();
    },

    async updateChartBtc() {
      if (!this.isLineBtcVisible) return;

      let lineDataBtc = "";

      for (const line of this.lines) {
        const isDataLonger = lineDataBtc.length < line.data.length;

        if (isDataLonger) lineDataBtc = line.data;
      }

      if (lineDataBtc) {
        const lineSeriesBtc = await this.chart.addLineSeries({
          color: "black",
          priceScaleId: "left",
          lineWidth: this.lineWidth,
          priceLineVisible: false,
        });

        this.lineSeries.push(lineSeriesBtc);

        const linesSeriesDataBtc = await this.getSeriesDataBtc(lineDataBtc);

        lineSeriesBtc.setData(linesSeriesDataBtc);
      }
    },

    async updateChartTotal() {
      const seriesDataTotal = await this.getSeriesDataTotal();

      const lineSeriesTotal = await this.chart.addLineSeries({
        color: "aqua",
        priceScaleId: "right",
        lineWidth: this.lineWidth,
        priceLineVisible: false,
        visible: this.isLineTotalVisible && this.linesEnabled.length !== 1,
      });

      this.lineSeries.push(lineSeriesTotal);
      lineSeriesTotal.setData(seriesDataTotal);
    },

    ////
    async getSeriesData(lineData: string) {
      const data = lineData
        .trim()
        .split("\n")
        .slice(1)
        .map((row: string) => {
          const [, dateString, , , , , , , , profit] = row.split(",");

          return {
            time: Date.parse(dateString) / 1000,
            value: parseFloat(profit),
          };
        });

      return data;
    },

    async getSeriesDataBtc(lineData: string) {
      const data = lineData
        .trim()
        .split("\n")
        .slice(1)
        .map((row) => {
          const [, dateString, btcPrice, , , , , , ,] = row.split(",");

          return {
            time: Date.parse(dateString) / 1000,
            value: parseFloat(btcPrice),
          };
        });

      return data;
    },

    async getSeriesDataTotal() {
      const lines = this.isLineTotalOnly ? this.lines : this.linesEnabled;

      const dataProfitAll = lines.map((line: ILine) => {
        const lineData = line.data
          .trim()
          .split("\n")
          .slice(1)
          .map((row: string) => {
            const [, dateString, , , , , , , profit] = row.split(",");

            return {
              time: Date.parse(dateString) / 1000,
              // value: parseFloat((+profit / lines.length).toFixed(2)),
              value: parseFloat(profit),
            };
          });

        return lineData;
      });

      const seriesDataTotal = dataProfitAll
        .flatMap((seriesData) => seriesData)
        .sort((a, b) => a.time - b.time)
        .map((row, index, array) => {
          if (index === 0) return row;

          row.value = parseFloat(
            (array[index - 1].value + row.value).toFixed(2)
          );

          if (row.time === array[index - 1].time) {
            // console.log(index);
            array[index - 1].toDelete = true;
          }

          return row;
        })
        .map((row, index) => {
          row.value = parseFloat((row.value / lines.length).toFixed(2));
          return row;
        });

      // // console.log("seriesDataTotal.length:", seriesDataTotal.length);

      // const indexArray = seriesDataTotal
      //   .filter((row) => row.toDelete)
      //   .map((row, index) => index);

      // // console.log(indexArray);

      // for (var i = indexArray.length - 1; i >= 0; i--) {
      //   seriesDataTotal.splice(indexArray[i], 1);
      // }

      return seriesDataTotal;
    },

    ////
    // Create lines
    async createLinesFromServer(serverFiiles: IServerFile[]) {
      const lines: ILine[] = serverFiiles.map(
        (file: IServerFile, index: number): ILine => ({
          name: file.name.split(".")[0],
          data: file.data,
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
            data: lineText,
            color: this.getColor(index),
            disabled: false,
          };

          return line;
        })
      );

      this.lines = lines;
    },

    ////
    resize() {
      this.chart.resize(window.innerWidth - 20, this.chartOptions.height, true);
    },

    clearChart() {
      this.lineSeries = [];
      const chartContainer = document.getElementById("chart-container");

      chartContainer.innerHTML = "";

      const chartElem = document.createElement("div");
      chartContainer.appendChild(chartElem);

      this.chart = createChart(chartElem, this.chartOptions);
    },

    async fetchData() {
      const response = await fetch(`http://${window.location.hostname}/files`);
      const serverFiiles: string[] = await response.json();
      // console.log(data);

      this.createLinesFromServer(serverFiiles);
    },

    getColor(index: number): string {
      const newIndex = index % this.colors.length;

      console.log(index, this.colors.length, newIndex);

      if (index < this.colors.length) {
        return this.colors[index];
      }

      return this.colors[newIndex];
    },
  },

  mounted() {
    this.fetchData();
    window.addEventListener("resize", this.resize);
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
    background: aqua;
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
