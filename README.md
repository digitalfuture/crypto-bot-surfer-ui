# **Crypto Bot Surfer UI** 📊
Real-time web dashboard and multi-strategy chart analytics for Crypto Bot Surfer.

---

## 🌟 Overview

**Crypto Bot Surfer UI** is a specialized real-time trading dashboard built with **Astro**, **Vue 3**, and **TradingView Lightweight Charts v4**. It monitors all 12 containerized strategy bots running in the backend, visualizing cumulative profit curves, individual trade entries/exits, win rates, and portfolio drawdown.

---

## 🚀 Key Features

- **TradingView Lightweight Charts v4**: High-performance interactive financial charts.
- **Synchronized Time Scale ($\Delta t = 60\text{s}$)**: Straight lines between trade points with accurate chronological spacing reflecting real elapsed time.
- **Global Uniform Grid**: Synchronized crosshair across all 12 individual strategy curves and total portfolio equity.
- **Clean Naming & Legend**: Formatted strategy labels without legacy prefixes (`vol-`, `orderbook-`, `mm-`).
- **Real-Time Polling**: Auto-refreshes every 20 seconds from backend `/home/report/*.csv` endpoints.

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

---

## 🚢 Deployment

The UI is deployed inside the `chart-container` Docker container, served via Nginx on port 80.
Restarted automatically by `deploy.js` or `/home/deploy.sh`.
