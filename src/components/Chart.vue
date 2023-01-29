<template>
  <div ref="chart" class="chart" />

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
        v-for="line in lines"
        v-text="line.name"
        :style="{ color: line.color }"
        class="line"
      />

      <div class="line" :style="{ color: 'black' }">BTC / USDT</div>
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
      ],

      lineSeries: [],
    };
  },

  computed: {
    chart() {
      return createChart(this.$refs.chart, this.chartOptions);
    },
  },

  watch: {
    lines() {
      this.updateChart();
    },
  },

  methods: {
    async getLineData(line) {
      let text;

      if (line.data) {
        text = line.data;
      } else {
        const res = await fetch("data/" + line.name + ".csv");
        text = await res.text();
        //   console.log(resp);
      }

      const cdata = text
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

    async getLineDataBtc(line) {
      let text;

      if (line.data) {
        text = line.data;
      } else {
        const res = await fetch("data/" + line.name + ".csv");
        text = await res.text();
        //   console.log(resp);
      }

      const cdata = text
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

    async updateChart() {
      for (const series of this.lineSeries) {
        series.setData([]);
      }

      this.lineSeries = [];

      let lineBtc;

      for (const line of this.lines) {
        // BTC / USDT
        if (!lineBtc && line.name.includes("btc")) {
          lineBtc = { name: line.name };
          const linesDataBtc = await this.getLineDataBtc(lineBtc);

          const lineSeriesBtc = this.chart.addLineSeries({
            color: "black",
            priceScaleId: "left",
          });

          this.lineSeries.push(lineSeriesBtc);
          lineSeriesBtc.setData(linesDataBtc);

          // console.log("lineSeriesBtc:", lineSeriesBtc);
        }

        const linesData = await this.getLineData(line);

        const lineSeries = this.chart.addLineSeries({
          color: line.color,
          priceScaleId: "right",
        });

        this.lineSeries.push(lineSeries);
        lineSeries.setData(linesData);
        // console.log("lineSeries:", lineSeries);
      }

      this.chart.timeScale().fitContent();
    },

    async createLines(event) {
      // console.log(event.target.files);
      const files = [...event.target.files];

      this.lines = files.map((file, index) => ({
        name: file.name.split(".")[0],
        color: this.colors[index],
      }));
    },

    async fetchData() {
      const data = await fetch("/files").then((res) => res.json());
      // console.log(data);

      this.lines = data.map((file, index) => ({
        name: file.name.split(".")[0],
        data: file.data,
        color: this.colors[index],
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
  margin: 40px 50px;
  font-size: 14px;
  font-family: sans-serif;
  line-height: 18px;
  font-weight: 300;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  text-transform: uppercase;

  .line {
    flex-basis: 30%;
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
  color: blue;
}

.input {
  margin-left: 50px;
}
</style>
