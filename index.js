const lines = [
  {
    color: "blue",
    file: "bottom-gainer-trailing-stop--btc-gain-filter--3m--used-0",
  },
  {
    color: "green",
    file: "bottom-gainer-trailing-stop--btc-gain-filter--3m--used-3",
  },
  {
    color: "yellow",
    file: "bottom-gainer-trailing-stop--btc-gain-filter--3m--used-5",
  },
  {
    color: "hotpink",
    file: "bottom-gainer-trailing-stop--btc-gain-filter--3m--used-7",
  },
  {
    color: "fuchsia",
    file: "top-gainer-trailing-stop--btc-gain-filter--3m--used-0",
  },
  {
    color: "crimson",
    file: "top-gainer-trailing-stop--btc-gain-filter--3m--used-3",
  },
  {
    color: "aqua",
    file: "top-gainer-trailing-stop--btc-gain-filter--3m--used-5",
  },
  {
    color: "teal",
    file: "top-gainer-trailing-stop--btc-gain-filter--3m--used-7",
  },
];

const createLegend = () => {
  const legend = document.getElementById("legend");

  for (const line of lines) {
    console.log(line);
    const rowName = line.file;

    const row = document.createElement("div");
    row.innerHTML = rowName;
    row.style.color = line.color;

    legend.appendChild(row);
  }
};

const getData = async (file) => {
  const res = await fetch(file);

  const resp = await res.text();
  //   console.log(resp);
  const cdata = resp
    .split("\n")
    .slice(1)
    .map((row) => {
      const [, dateString, , , , , , , , profit] = row.split(",");
      const dateSplit = dateString.split(" ");
      const date = dateSplit[0].split("-").reverse().join("-");
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
};

const displayChart = async () => {
  const chartOptions = {
    width: 1500,
    height: 600,
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
  };

  const domElement = document.getElementById("tvchart");
  const chart = LightweightCharts.createChart(domElement, chartOptions);

  for (const line of lines) {
    const data = await getData(line.file + ".csv");
    const lineSeries = chart.addLineSeries({
      color: line.color,
      priceScaleId: "left",
    });

    lineSeries.setData(data);
  }

  chart.timeScale().fitContent();
};

displayChart();
createLegend();
