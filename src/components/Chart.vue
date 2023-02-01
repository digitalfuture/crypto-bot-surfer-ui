<template>
  <div class="chart pointer" id="chart-container" />

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
      class="full-screen-button pointer"
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
        class="input info pointer"
        @change="createLinesFromInput"
      />

      <div
        v-if="lines.filter((line) => !line.disabled).length"
        class="summary info line clip-left pointer"
        :class="{ 'background-aquamarine': isLineTotalVisible }"
        @click="isLineTotalVisible = !isLineTotalVisible"
      >
        <span class="info__details"> TOTAL: {{ summ }}%</span>
      </div>

      <div
        v-if="lines.filter((line) => !line.disabled).length"
        class="line clip-right pointer"
        :class="{ 'background-black': isLineBtcVisible }"
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
        class="line clip-right pointer"
        @click="line.disabled = !line.disabled"
      >
        <span class="line__name">{{ line.name }}</span>
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
import { createChart } from "lightweight-charts";

export default {
  name: "Chart",

  data() {
    return {
      isFullScreen: false,

      lineTotal: null,

      lines: [],

      lineSeries: [],

      isLineBtcVisible: true,

      isLineTotalVisible: false,

      isOnlyTotal: true,

      colors: [
        "steelblue",
        "darkcyan",
        "mediumseagreen",
        "tan",
        // "goldenrod",
        // "orange",
        "lightsalmon",
        // "lightcoral",
        // "palevioletred",
        "chocolate",
        "saddlebrown",
        "brown",
        "mediumvioletred",
        "fuchsia",
        "blueviolet",
        // "mediumpurple",
        "mediumslateblue",
      ],
    };
  },

  computed: {
    isLoading() {
      return this.lines.length === 0;
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
      const result = this.lines
        .filter((line: ILine) => !line.disabled)
        .map((line) => line.data.trim())
        .map((table) => table.split("\n").reverse()[0].split(",").reverse()[0])
        .reduce((sum: number, value: string) => sum + parseFloat(value), 0);

      return parseFloat((result / this.linesEnabled.length).toFixed(2));
    },

    linesEnabled() {
      return this.lines.filter((line: ILine) => !line.disabled);
    },
  },

  watch: {
    isFullScreen() {
      this.updateChart();
    },

    lines: {
      deep: true,
      handler() {
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

      for (const line of this.linesEnabled) {
        const lineSeries = await this.chart.addLineSeries({
          color: line.color,
          priceScaleId: "right",
          lineWidth: 2.5,
        });

        const linesData = await this.getSeriesData(line.data);

        this.lineSeries.push(lineSeries);

        lineSeries.setData(linesData);
      }

      await this.updateChartTotal();
      await this.updateChartBtc();

      this.chart.timeScale().fitContent();
    },

    //
    async updateChartBtc() {
      if (!this.isLineBtcVisible) return;

      let lineDataBtc = "";

      for (const line of this.linesEnabled) {
        const isDataLonger = lineDataBtc.length < line.data.length;

        if (isDataLonger) lineDataBtc = line.data;
      }

      if (lineDataBtc) {
        const lineSeriesBtc = await this.chart.addLineSeries({
          color: "black",
          priceScaleId: "left",
          lineWidth: 2.5,
        });

        this.lineSeries.push(lineSeriesBtc);

        const linesSeriesDataBtc = await this.getSeriesDataBtc(lineDataBtc);

        lineSeriesBtc.setData(linesSeriesDataBtc);
      }
    },

    async updateChartTotal() {
      if (!this.isLineTotalVisible) return;

      const seriesDataTotal = await this.getSeriesDataTotal();

      const lineSeriesTotal = await this.chart.addLineSeries({
        color: "aquamarine",
        priceScaleId: "right",
        lineWidth: 2.5,
      });
      this.lineSeries.push(lineSeriesTotal);
      // console.log(seriesDataTotal);

      // seriesDataTotal.forEach((row) => console.log(row.time));

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
      const dataProfitAll = this.linesEnabled.map((line: ILine) => {
        const lineData = line.data
          .trim()
          .split("\n")
          .slice(1)
          .map((row: string, index: number) => {
            const [, dateString, , , , , , , profit] = row.split(",");

            return {
              time: Date.parse(dateString) / 1000,
              value: parseFloat(
                (+profit / this.linesEnabled.length).toFixed(2)
              ),
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
          color: this.colors[index],
          disabled: false,
        })
      );

      const seriesDataTotal = await this.getSeriesDataTotal();
      console.log(lines);
      console.log(seriesDataTotal);

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
            color: this.colors[index],
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
      right: 7px;
      position: absolute;
      z-index: 20;
    }
  }

  .summary {
    text-align: end;
    display: flex;
    justify-content: flex-end;
    align-items: center;

    .info__details {
      display: inline-block;
      margin: 12px;
      background: var(--background-color);
      padding-inline: 5px;
    }
  }
}

.legend {
  position: relative;
  margin: 7px 0;
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

  .line__name {
    display: inline-block;
    margin: 12px;
    background: var(--background-color);
    padding-inline: 5px;
  }
}

#color-list {
  color: steelblue;
  color: darkcyan;
  color: mediumseagreen;
  color: tan;
  // color: goldenrod;
  // color: orange;
  color: lightsalmon;
  // color: lightcoral;
  // color: palevioletred;
  color: chocolate;
  color: saddlebrown;
  color: brown;
  color: mediumvioletred;
  color: fuchsia;
  color: blueviolet;
  // color: mediumpurple;
  color: mediumslateblue;
}

.background-aquamarine {
  background: aquamarine;
}

.background-black {
  background: black;
}
</style>
