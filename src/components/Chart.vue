<template>
  <div class="chart" id="chart-container" />

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
      class="full-screen-button"
      :class="{
        'full-screen-button--active': isFullScreen,
      }"
      @click="isFullScreen = !isFullScreen"
    />

    <input
      type="file"
      multiple
      ref="input"
      class="input"
      @change="createLinesFromInput"
    />

    <section ref="legend" class="legend">
      <div
        v-for="(line, index) in lines"
        :key="index"
        :style="{
          background: !line.disabled ? line.color : 'none',
        }"
        class="line"
        @click="line.disabled = !line.disabled"
      >
        <span class="line-name">{{ line.name }}</span>
      </div>

      <div
        v-if="lines.filter((line) => !line.disabled).length"
        class="line line--btc-usdt"
        :style="{ background: !isBtcLineDisabled ? 'black' : 'none' }"
        @click="isBtcLineDisabled = !isBtcLineDisabled"
      >
        <span class="line-name">BTC / USDT</span>
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

      lines: [],

      lineSeries: [],

      isBtcLineDisabled: false,

      isSummChart: false,

      colors: [
        "blueviolet",
        // "mediumpurple",
        "mediumslateblue",
        "steelblue",
        "darkcyan",
        "mediumseagreen",
        // "olivedrab",
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
      ],
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
  },

  watch: {
    isFullScreen() {
      this.updateChart();
    },

    lines: {
      deep: true,
      handler() {
        this.updateChart();
      },
    },

    isBtcLineDisabled: {
      handler() {
        this.updateChart();
      },
    },
  },

  methods: {
    async fetchData() {
      const response = await fetch(`http://${window.location.hostname}/files`);
      const serverFiiles: string[] = await response.json();
      // console.log(data);

      this.createLinesFromServer(serverFiiles);
    },

    createLinesFromServer(serverFiiles: IServerFile[]) {
      this.lines = serverFiiles.map(
        (file: IServerFile, index: number): ILine => ({
          name: file.name.split(".")[0],
          data: file.data,
          color: this.colors[index],
          disabled: false,
        })
      );
    },

    async createLinesFromInput({ currentTarget }) {
      // console.log(event.currentTarget.files);
      const inputFiles = [...currentTarget.files];

      if (!inputFiles.length) return;

      const lines = await Promise.all(
        inputFiles.map(async (file: File, index: number): Promise<ILine> => {
          // console.log("file.text():", await file.text());
          const lineText = await file.text();
          const lineName = file.name.split(".")[0];

          return {
            name: lineName,
            data: lineText,
            color: this.colors[index],
            disabled: false,
          };
        })
      );

      this.lines = lines;
    },

    setupResize() {
      window.addEventListener("resize", () =>
        this.chart.resize(
          window.innerWidth - 20,
          this.chartOptions.height,
          true
        )
      );
    },

    clearChart() {
      this.lineSeries = [];
      const chartContainer = document.getElementById("chart-container");

      chartContainer.innerHTML = "";

      const chartElem = document.createElement("div");
      chartContainer.appendChild(chartElem);

      this.chart = createChart(chartElem, this.chartOptions);
    },

    async getLineData(lineData: string) {
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

    async getLineDataBtc(lineData: string) {
      const cdata = lineData
        .trim()
        .split("\n")
        .slice(1)
        .map((row) => {
          const [, dateString, price, , , , , , ,] = row.split(",");

          return {
            time: Date.parse(dateString) / 1000,
            value: parseFloat(price),
          };
        });

      // console.log(cdata);
      return cdata;
    },

    async updateChart() {
      this.clearChart();

      let btcData = "";

      for (const line of this.lines.filter((line: ILine) => !line.disabled)) {
        // BTC / USDT
        const isDataLonger = btcData.length < line.data.length;
        if (isDataLonger) btcData = line.data;

        const lineSeries = this.chart.addLineSeries({
          color: line.color,
          priceScaleId: "right",
          lineWidth: 2.5,
        });
        this.lineSeries.push(lineSeries);

        const linesData = await this.getLineData(line.data);
        lineSeries.setData(linesData);

        // console.log("this.lineSeries:", this.lineSeries);
      }

      if (!this.isBtcLineDisabled && btcData) {
        const lineSeriesBtc = this.chart.addLineSeries({
          color: "black",
          priceScaleId: "left",
          lineWidth: 2.5,
        });
        this.lineSeries.push(lineSeriesBtc);

        const linesDataBtc = await this.getLineDataBtc(btcData);
        lineSeriesBtc.setData(linesDataBtc);
      }

      this.chart.timeScale().fitContent();
    },
  },

  mounted() {
    this.fetchData();
    this.setupResize();
  },
};
</script>

<style lang="scss">
.memory {
  display: flex;
  justify-content: flex-end;
  width: 33.3%;
}

.full-screen-button {
  position: absolute;
  top: 7px;
  left: 72px;
  width: 32px;
  height: auto;
  z-index: 9999;
  cursor: pointer;
  filter: grayscale(1) brightness(1.4);
}

.legend {
  position: relative;
  margin: 7px 0;
  font-size: 14px;
  font-family: sans-serif;
  line-height: 18px;
  font-weight: 300;
  display: flex;
  flex-wrap: wrap;
  text-transform: uppercase;

  .line {
    flex-grow: 1;
    min-width: 33.3%;
    cursor: pointer;

    .line-name {
      display: inline-block;
      margin: 12px;
      background: var(--background-color);
      padding-inline: 5px;
    }

    &--btc-usdt {
      position: absolute;
      top: -49px;
      right: 0px;
      width: 33.3%;
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
      font-size: 50.5px;
      line-height: 44px;
      color: darkgrey;
      padding-inline-start: 0px;
    }

    .icon {
      position: absolute;
      top: 0;
      left: 0%;
      width: 42px;
      filter: grayscale(1);
    }
  }
}

input[type="file"] {
  background: var(--background-color);
  position: relative;
  padding: 5px;
  width: 33.3%;
  height: 42px;
  cursor: pointer;

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
    font-weight: bolder;
    color: var(--background-color);
    font-size: 7vh;
    line-height: 10vh;
    bottom: 0;
    right: -0.3vh;
    position: absolute;
    z-index: 20;
  }
}

#color-list {
  color: blueviolet;
  // color: mediumpurple;
  color: mediumslateblue;
  color: steelblue;
  color: darkcyan;
  color: mediumseagreen;
  // color: olivedrab;
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
}
</style>
