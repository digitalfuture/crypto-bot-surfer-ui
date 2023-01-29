<template>
  <div class="chart" id="chart-container" />

  <template v-if="lines.length && lines.length">
    <input
      type="file"
      multiple
      ref="input"
      class="input"
      @change="createLines"
    />

    <section ref="legend" class="legend">
      <div
        v-for="(line, index) in lines"
        :key="index"
        :style="{
          background: !line.disabled ? line.color : none,
        }"
        class="line"
        @click="line.disabled = !line.disabled"
      >
        <span class="line-name">{{ line.name }}</span>
      </div>

      <div
        v-if="lines.filter((line) => !line.disabled).length"
        class="line"
        :style="{ background: !isBtcLineDisabled ? 'black' : none }"
        @click="isBtcLineDisabled = !isBtcLineDisabled"
      >
        <span class="line-name">BTC / USDT</span>
      </div>
    </section>
  </template>

  <div class="loader" v-else>LOADING</div>
</template>

<script>
import { createChart } from "lightweight-charts";

export default {
  name: "Chart",

  data() {
    return {
      lines: [],

      lineSeries: [],

      isBtcLineDisabled: false,

      isSummChart: false,

      chartOptions: {
        height: 300,
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
      },

      colors: [
        "midnightblue",
        "fuchsia",
        "blueviolet",
        "darkcyan",
        "mediumseagreen",
        "chocolate",
        "red",
        "steelblue",
        "burlywood",
        "blue",
        "crimson",
        "darkviolet",
        "goldenrod",
        "lightcoral",
        "lightsalmon",
        "lightsteelblue",
        "mediumpurple",
        "olivedrab",
        "palevioletred",
        "saddlebrown",
        "tan",
      ],
    };
  },

  watch: {
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
    async getLineData(lineData) {
      const cdata = lineData
        .split("\n")
        .slice(1)
        .map((row) => {
          const [, dateString, , , , , , , , profit] = row.split(",");
          const dateSplit = dateString.split(" ");
          const date = dateSplit[0];
          const time = dateSplit[1];
          const dateFormat = date + " " + time;
          // console.log("dateFormat:", dateFormat);
          return {
            time: Date.parse(dateFormat) / 1000,
            value: parseFloat(profit),
          };
        });
      // console.log(cdata);
      return cdata;
    },

    async getLineDataBtc(lineData) {
      const cdata = lineData
        .split("\n")
        .slice(1)
        .map((row) => {
          const [, dateString, price, , , , , , ,] = row.split(",");
          const dateSplit = dateString.split(" ");
          const date = dateSplit[0];
          const time = dateSplit[1];
          const dateFormat = date + " " + time;
          // console.log("dateFormat:", dateFormat);
          return {
            time: Date.parse(dateFormat) / 1000,
            value: parseFloat(price),
          };
        });

      // console.log(cdata);
      return cdata;
    },

    clearChart() {
      this.lineSeries = [];
      const chartContainer = document.getElementById("chart-container");

      chartContainer.innerHTML = "";

      const chartElem = document.createElement("div");
      chartContainer.appendChild(chartElem);

      this.chart = createChart(chartElem, this.chartOptions);
    },

    async updateChart() {
      this.clearChart();

      let lineBtcData = "";

      for (const line of this.lines.filter((line) => !line.disabled)) {
        // BTC / USDT
        if (line.name.includes("btc")) {
          lineBtcData =
            lineBtcData.length < line.data.length ? line.data : lineBtcData;
        }

        // console.log("this.lineSeriesBtc:", this.lineSeriesBtc);

        const lineSeries = this.chart.addLineSeries({
          color: line.color,
          priceScaleId: "right",
        });
        // console.log("this.lineSeries:", this.lineSeries);
        this.lineSeries.push(lineSeries);

        const linesData = await this.getLineData(line.data);
        lineSeries.setData(linesData);

        // console.log("this.lineSeries:", this.lineSeries);
      }

      if (!this.isBtcLineDisabled && lineBtcData) {
        const lineSeriesBtc = this.chart.addLineSeries({
          color: "black",
          priceScaleId: "left",
        });
        this.lineSeries.push(lineSeriesBtc);

        const linesDataBtc = await this.getLineDataBtc(lineBtcData);
        lineSeriesBtc.setData(linesDataBtc);
      }

      this.chart.timeScale().fitContent();
    },

    async createLines(event) {
      // console.log(event.target.files);
      const files = [...event.target.files];

      this.lines = await Promise.all(
        files.map(async (file, index) => {
          // console.log("file.text():", await file.text());
          const fileText = await file.text();
          const fileName = file.name.split(".")[0];

          return {
            name: fileName,
            data: fileText,
            color: this.colors[index],
            disabled: false,
          };
        })
      );
    },

    async fetchData() {
      const fileData = await fetch(
        `http://${window.location.hostname}/files`
      ).then((res) => res.json());

      // console.log(data);

      this.lines = fileData.map((file, index) => ({
        name: file.name.split(".")[0],
        data: file.data,
        color: this.colors[index],
        disabled: false,
      }));
    },
  },

  mounted() {
    this.fetchData();

    window.addEventListener("resize", () =>
      this.chart.resize(window.innerWidth - 100, 300, true)
    );
  },
};
</script>

<style lang="scss">
.chart {
  margin: 10px;
}

.legend {
  margin: 15px 0;
  font-size: 14px;
  font-family: sans-serif;
  line-height: 18px;
  font-weight: 300;
  display: flex;
  flex-wrap: wrap;
  text-transform: uppercase;

  .line {
    flex-basis: 33.3%;
    cursor: pointer;

    .line-name {
      display: inline-block;
      margin: 10px;
      background: white;
      padding-inline: 5px;
    }
  }
}

.loader {
  width: 100vw;
  height: 100vh;
  position: fixed;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bolder;
  font-size: 50px;
  color: lightgrey;
}
</style>
