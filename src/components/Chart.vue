<template>
  <!-- Chart container: ALWAYS in DOM so createChart never fails -->
  <div
    v-show="!isLoading && lines.length > 0 && !isMonitorView"
    class="chart cursor-pointer"
    id="chart-container"
    @dblclick="applyLongestScale"
    title="Двойной клик для автомасштабирования по всей длине"
  />

  <!-- Flat System & Bots Monitor View (replaces chart when active) -->
  <div
    v-if="!isLoading && lines.length > 0 && isMonitorView"
    class="monitor-view"
  >
    <!-- Flat Summary Bar -->
    <div class="monitor-summary-bar">
      <div class="summary-left">
        <span class="summary-item">
          WATCHDOG:
          <strong :class="systemStatus.status === 'HEALTHY' ? 'text-green' : 'text-yellow'">
            {{ systemStatus.status }}
          </strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          BOTS: <strong>{{ systemStatus.runningBots || botStatusList.length || 12 }}/{{ systemStatus.totalBots || botStatusList.length || 12 }} RUNNING</strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          IN POSITION: <strong>{{ systemStatus.activePositionsCount }} / {{ botStatusList.length || 12 }}</strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          AVG PROFIT:
          <strong :class="parseFloat(totalProfit) >= 0 ? 'text-green' : 'text-red'">
            {{ parseFloat(totalProfit) > 0 ? '+' : '' }}{{ totalProfit }}%
          </strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          TOTAL SUM:
          <strong :class="parseFloat(totalSumProfit) >= 0 ? 'text-green' : 'text-red'">
            {{ totalSumProfit }}%
          </strong>
        </span>
      </div>
    </div>

    <!-- 11 Bots Flat Grid -->
    <div class="monitor-bots-grid">
      <div
        v-for="bot in botStatusList"
        :key="bot.id"
        class="bot-card cursor-pointer"
        :class="{ 'bot-card--in-pos': bot.hasOpenPosition }"
        @click="selectBotChart(bot.name)"
        :title="`Click to view ${bot.name} chart and trades`"
      >
        <div class="bot-card__color-bar" :style="{ backgroundColor: getBotColor(bot.name) }" />

        <div class="bot-card__header">
          <span class="bot-card__name" :title="bot.name">{{ formatBotName(bot.name) }}</span>
          <div class="bot-card__header-right">
            <button
              class="bot-card__info-btn cursor-pointer"
              :class="{ 'bot-card__info-btn--active': isCardInfoOpen(bot.name) }"
              @click.stop="toggleCardInfo(bot.name)"
              :title="isCardInfoOpen(bot.name) ? 'Вернуться к позиции' : 'Описание стратегии: ' + getStrategyInfo(bot.name).title"
            >
              <span v-if="!isCardInfoOpen(bot.name)">i</span>
              <span v-else>✕</span>
            </button>
            <span class="bot-card__pnl" :class="getBotPnl(bot) >= 0 ? 'text-green' : 'text-red'">
              {{ getBotPnl(bot) > 0 ? '+' : '' }}{{ getBotPnl(bot).toFixed(2) }}%
            </span>
          </div>
        </div>

        <div class="bot-card__body">
          <!-- Strategy Info View (Description on flip) -->
          <div
            v-if="isCardInfoOpen(bot.name)"
            class="bot-card__info-view cursor-pointer"
            @click.stop="toggleCardInfo(bot.name)"
            title="Кликните, чтобы вернуться к сделке"
          >
            <div class="info-title">{{ getStrategyInfo(bot.name).title }}</div>
            <div class="info-desc">{{ getStrategyInfo(bot.name).concept }}</div>
            <div class="info-section">
              <span class="info-section-label">ВХОД:</span>
              <span class="info-section-text">{{ getStrategyInfo(bot.name).entry }}</span>
            </div>
            <div class="info-section">
              <span class="info-section-label">РИСК:</span>
              <span class="info-section-text">{{ getStrategyInfo(bot.name).risk }}</span>
            </div>
            <div class="info-hint">↩ К СДЕЛКЕ</div>
          </div>

          <!-- Live Trading View -->
          <template v-else>
            <template v-if="bot.position">
              <div class="pos-row pos-row--main">
                <span class="pos-side" :class="bot.position.side === 'LONG' ? 'pos-side--long' : 'pos-side--short'">
                  {{ bot.position.side }}
                </span>
                <span class="pos-symbol">{{ bot.position.symbol }}</span>
              </div>

              <div class="pos-details-grid">
                <div class="detail-row">
                  <span class="detail-label">ENTRY</span>
                  <span class="detail-val">{{ bot.position.entryPrice }}</span>
                </div>
                <div v-if="bot.position.stopLoss" class="detail-row">
                  <span class="detail-label">SL</span>
                  <span class="detail-val text-red">{{ formatTarget(bot.position.stopLoss) }}</span>
                </div>
                <div v-if="bot.position.takeProfit" class="detail-row">
                  <span class="detail-label">TP</span>
                  <span class="detail-val text-green">{{ formatTarget(bot.position.takeProfit) }}</span>
                </div>
                <div v-if="bot.position.shortPrice && bot.position.shortPrice !== bot.position.entryPrice" class="detail-row">
                  <span class="detail-label">PEAK</span>
                  <span class="detail-val">{{ formatTarget(bot.position.shortPrice) }}</span>
                </div>
              </div>
            </template>

            <div v-else class="bot-card__scanning">
              SCANNING FOR SETUPS
            </div>
          </template>
        </div>

        <div v-if="!isCardInfoOpen(bot.name)" class="bot-card__footer">
          <span class="footer-trades">{{ bot.totalTrades }} TRADES</span>
          <span v-if="bot.lastTradeDate" class="footer-time">{{ formatTime(bot.lastTradeDate) }}</span>
        </div>
      </div>
    </div>
  </div>

  <div v-if="isLoading" class="loader-container">
    <div class="loader">
      <div>DNA</div>
      <div>TRADE</div>
      <img src="/favicon.png" alt="DNATRADE" class="icon" />
    </div>
  </div>

  <div v-else-if="!isLoading && lines.length === 0" class="no-data">NO DATA</div>

  <template v-else>
    <div class="annotation" style="display: none">
      <span class="annotation--token" />
      <span class="annotation--price" />
    </div>

    <!-- Top Bar Controls -->
    <div class="top-bar-menu">
      <!-- Flat System & Bots Monitor Button / Plaque (FIRST) -->
      <div
        class="system-status-btn cursor-pointer"
        :class="{ 'system-status-btn--active': isMonitorView }"
        @click="toggleMonitorView"
        :title="isMonitorView ? 'Switch to Chart' : 'Switch to System & Bots Monitor'"
      >
        <span
          class="status-indicator"
          :class="systemStatus.status === 'HEALTHY' ? 'status-indicator--green' : 'status-indicator--yellow'"
        />
        <span class="status-btn-text">
          {{ systemStatus.runningBots || botStatusList.length || 12 }}/{{ systemStatus.totalBots || botStatusList.length || 12 }} BOTS
        </span>
        <span
          v-if="systemStatus.activePositionsCount > 0"
          class="status-btn-badge"
        >
          {{ systemStatus.activePositionsCount }} IN POS
        </span>
        <span v-if="isMonitorView" class="status-view-active">
          • MONITOR
        </span>
      </div>

      <!-- Commission toggle (SECOND) -->
      <div
        class="use-commission-container cursor-pointer"
        @click="toggleCommission"
        :title="useCommission ? 'With Commission (click to disable)' : 'Without Commission (click to enable)'"
      >
        <img
          :src="useCommission ? '/icons/money.svg' : '/icons/money-off.svg'"
          alt="DNATRADE"
          class="use-commission-button cursor-pointer"
        />
      </div>
    </div>

    <!-- Top Right: Fullscreen Toggle Button -->
    <div
      class="top-bar-right"
      :style="{ visibility: isMonitorView ? 'hidden' : 'visible', pointerEvents: isMonitorView ? 'none' : 'auto' }"
    >
      <img
        :src="isFullScreen ? '/icons/collapse.svg' : '/icons/expand.svg'"
        alt="DNATRADE"
        class="full-screen-button cursor-pointer"
        @click="isFullScreen = !isFullScreen"
        :title="isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
      />
    </div>

    <!-- Legend toolbar (hidden when in monitor view or fullscreen) -->
    <div v-show="!isMonitorView && !isFullScreen" class="info-container">
      <!-- Open files -->
      <input
        type="file"
        multiple
        ref="input"
        class="input info clip-left cursor-pointer"
        @change="convertFileDataToLines"
      />

      <!-- Total / Average -->
      <div
        class="total info line clip-right cursor-pointer"
        :class="{
          'total--disabled': !isLineTotalVisible || linesEnabled.length === 1,
        }"
        @click="updateLineTotalVisibility"
        :title="'Средняя доходность активных ботов: ' + totalProfit + '%, суммарная: ' + totalSumProfit + '%'"
      >
        <div class="line__details info">
          <span class="line__name">AVG (Σ {{ totalSumProfit }}%)</span>
          <span class="line__last-value">{{ parseFloat(totalProfit) > 0 ? '+' : '' }}{{ totalProfit }}</span>
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

    <!-- Tickers lines (hidden when in monitor view or fullscreen) -->
    <section v-show="!isMonitorView && !isFullScreen" ref="legend" class="legend">
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
        @dblclick="soloLine(index)"
        :title="'Click to toggle, double-click to view only this chart and trades'"
      >
        <div class="line__details">
          <span class="line__name" v-text="formatBotName(line.name)" />

          <!-- Micro position chip in legend -->
          <span
            v-if="getBotPosition(line.name)"
            class="micro-pos-tag"
            :class="getBotPosition(line.name).side === 'LONG' ? 'micro-pos-tag--long' : 'micro-pos-tag--short'"
            :title="`${getBotPosition(line.name).side} ${getBotPosition(line.name).symbol}`"
          >
            {{ getBotPosition(line.name).symbol }}
          </span>

          <span class="line__last-value" v-text="getLegendValue(index)" />
          <span
            class="round"
            :class="{
              'round--green':
                linesData[index]?.[linesData[index]?.length - 1]?.value > 0,
              'round--red':
                linesData[index]?.[linesData[index]?.length - 1]?.value < 0,
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
  total?: number;
  offset?: number;
  isDelta?: boolean;
  mtime?: number;
}

export interface ILine {
  name: string;
  fileName?: string;
  mtime?: number;
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

const STRATEGY_DESCRIPTIONS: Record<string, { title: string; concept: string; entry: string; risk: string }> = {
  "VOL-MOMENTUM": {
    title: "Импульс волатильности (VOL-MOMENTUM / Пул + объем)",
    concept: "Мультисвечной анализ моментума с фильтром объема >= 1.15x и отсевом шума.",
    entry: "Close > EMA 9 > EMA 21, бычья свеча, RSI 52-76, объем > 1.15x от 20-периодного.",
    risk: "Асимметричный Take Profit (1.15x от риска) для максимизации математического ожидания."
  },
  "VOL-BREAKOUT": {
    title: "Институциональный пробой (VOL-BREAKOUT / ATR + ADX)",
    concept: "4 сетапа (Breakout/Breakdown/Continuation/Exhaustion) по закрытой свече и фильтром BTC.",
    entry: "EMA 9/20/50/200 + ADX > 22 + RSI, проверка стакана фьючерсов, спреда и базиса.",
    risk: "Динамический ATR-стоп со swing high/low, учет комиссий биржи и R:R >= 1.45."
  },
  VOLATILITY2: {
    title: "Импульс волатильности (VOL-MOMENTUM / Пул + объем)",
    concept: "Мультисвечной анализ моментума с фильтром объема >= 1.15x и отсевом шума.",
    entry: "Close > EMA 9 > EMA 21, бычья свеча, RSI 52-76, объем > 1.15x от 20-периодного.",
    risk: "Асимметричный Take Profit (1.15x от риска) для максимизации математического ожидания."
  },
  VOLATILITY3: {
    title: "Институциональный пробой (VOL-BREAKOUT / ATR + ADX)",
    concept: "4 сетапа (Breakout/Breakdown/Continuation/Exhaustion) по закрытой свече и фильтром BTC.",
    entry: "EMA 9/20/50/200 + ADX > 22 + RSI, проверка стакана фьючерсов, спреда и базиса.",
    risk: "Динамический ATR-стоп со swing high/low, учет комиссий биржи и R:R >= 1.45."
  },
  CHANNEL: {
    title: "Возврат в канал (BandWidth + %B/RSI)",
    concept: "Mean Reversion с фильтром ширины полос Боллинджера (0.012-0.14) и приоритетом флэтовых монет.",
    entry: "%B <= 0.18 и RSI <= 42 для Long; %B >= 0.82 и RSI >= 58 для Short, отбой тенью >= 22%.",
    risk: "SL за пределами полосы, TP динамически к средней линии SMA 20 (R:R >= 1:1)."
  },
  TREND: {
    title: "Следование тренду (EMA + Donchian)",
    concept: "Истинный пробой канала Дончиана по тренду с защитой от покупок на вершинах (Anti-Chasing).",
    entry: "Веер EMA 9 > 21 > 50, свежий пробой Donchian 20, объем >= 1.25x, нормализация базиса спот-фьючерс.",
    risk: "Защитный SL за фьючерсную EMA21 [0.9-1.35x Vol], трендовый TP 1.55x от риска."
  },
  PULLBACK: {
    title: "Откат по тренду (Trend Dip Bounce)",
    concept: "Покупка на контролируемых коррекциях к динамической поддержке EMA 21/50 по тренду.",
    entry: "Касание зоны EMA 21/50, подтвержденный отскок тенью >= 35%, RSI 44-62, масштабирование спотового базиса.",
    risk: "Структурный SL за минимум отката и EMA50 [0.85-1.3x Vol], TP 1.45x от риска (R:R 1:1.45)."
  },
  SCALPER: {
    title: "Быстрый скальпинг (Micro-Momentum)",
    concept: "Высокочастотная фиксация локальных микроимпульсов волатильности и быстрого оборота депозита.",
    entry: "Веер EMA 7 > 14 > 30, Fast RSI 9 (сладкая точка 59/41), двойной фитильный фильтр и объем >= 1.15x.",
    risk: "Компактный защитный SL 0.85x Vol, быстрый TP 1.15x от риска (высокий winrate скальпинга)."
  },
  "OB-WALL": {
    title: "Плотности стакана (Orderbook Wall)",
    concept: "Торговля от крупных институциональных лимитных стенок в стакане ($40k+).",
    entry: "Отскок от подтвержденной плотности в стакане с защитой от спуфинга.",
    risk: "SL сразу за стенку плотности, TP 1.8x от величины риска."
  },
  "ORDERBOOK-WALL": {
    title: "Плотности стакана (Orderbook Wall)",
    concept: "Торговля от крупных институциональных лимитных стенок в стакане ($40k+).",
    entry: "Отскок от подтвержденной плотности в стакане с защитой от спуфинга.",
    risk: "SL сразу за стенку плотности, TP 1.8x от величины риска."
  },
  "OB-IMBALANCE": {
    title: "Дисбаланс стакана (Orderbook OBI)",
    concept: "Опережающий вход по перекосу ликвидности покупателей и продавцов.",
    entry: "Индекс дисбаланса OBI >= +0.22 при узком спреде стакана <= 0.18%.",
    risk: "SL по волатильности, TP 1.5x при выравнивании стакана."
  },
  "ORDERBOOK-IMBALANCE": {
    title: "Дисбаланс стакана (Orderbook OBI)",
    concept: "Опережающий вход по перекосу ликвидности покупателей и продавцов.",
    entry: "Индекс дисбаланса OBI >= +0.22 при узком спреде стакана <= 0.18%.",
    risk: "SL по волатильности, TP 1.5x при выравнивании стакана."
  },
  "OB-ABSORPTION": {
    title: "Лимитное поглощение (Absorption)",
    concept: "Определение скрытого набора позиции крупным игроком при давлении толпы.",
    entry: "Рыночные продажи поглощены пассивным спросом выше EMA 20, длинный фитиль.",
    risk: "SL под уровнем поглощения, TP 1.8x от величины риска."
  },
  "ORDERBOOK-ABSORPTION": {
    title: "Лимитное поглощение (Absorption)",
    concept: "Определение скрытого набора позиции крупным игроком при давлении толпы.",
    entry: "Рыночные продажи поглощены пассивным спросом выше EMA 20, длинный фитиль.",
    risk: "SL под уровнем поглощения, TP 1.8x от величины риска."
  },
  "LIQUIDITY-SWEEP": {
    title: "Снятие ликвидности (Liquidity Sweep)",
    concept: "Ложный вынос локальных свингов со сбором стопов и подтвержденным реклеймом.",
    entry: "Реклейм уровня, фитиль отбоя >= 38%, подтверждение объема и фильтр тренда EMA 20/50.",
    risk: "SL за экстремум выноса [0.65-1.35x Vol], динамический TP 1.45x вглубь диапазона."
  },
  "MM-INVENTORY": {
    title: "Инвентарь маркет-мейкера (Avellaneda)",
    concept: "Асимметричное котирование и балансировка инвентаря маркет-мейкера.",
    entry: "Отклонение цены от reservation price при накоплении перекоса.",
    risk: "Автоматический хедж и сброс избыточного инвентаря."
  },
  "OB-ICEBERG": {
    title: "Скрытые айсберги (Iceberg Orders)",
    concept: "Обнаружение скрытых институциональных заявок с обновлением объема.",
    entry: "Многократное пополнение видимого объема на одном ценовом уровне.",
    risk: "SL сразу за уровнем айсберга, TP 1.8x по направлению скрытого ордера."
  },
  "ORDERBOOK-ICEBERG": {
    title: "Скрытые айсберги (Iceberg Orders)",
    concept: "Обнаружение скрытых институциональных заявок с обновлением объема.",
    entry: "Многократное пополнение видимого объема на одном ценовом уровне.",
    risk: "SL сразу за уровнем айсберга, TP 1.8x по направлению скрытого ордера."
  }
};

export default {
  name: "Chart",

  data() {
    return {
      isLoading: true,
      serverLines: [],
      refreshInterval: null,
      lineWidth: 2.5,
      isFullScreen: false,
      isLineMarked: false,
      useCommission: true,
      isMonitorView: false,
      isRefreshing: false,
      activeInfoBotMap: {},
      botStatusList: [],
      systemStatus: {
        status: "HEALTHY",
        runningBots: 12,
        totalBots: 12,
        timestamp: "",
        activePositionsCount: 0,
      },

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
          scaleMargins: {
            top: 0.05,
            bottom: 0.05,
          },
        },
        leftPriceScale: {
          visible: false,
        },
        handleScale: {
          axisPressedMouseMove: {
            time: true,
            price: false, // Prevents accidental drag of price scale from locking vertical autoscale
          },
          axisDoubleClickReset: {
            time: true,
            price: true,
          },
          mouseWheel: true,
          pinch: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        layout: {
          background: { color: "transparent" },
        },
      };
    },

    totalProfit() {
      const lastValue =
        this.linesDataTotal[this.linesDataTotal.length - 1]?.value;

      return lastValue != null && !isNaN(lastValue)
        ? lastValue.toFixed(2)
        : "0.00";
    },

    totalSumProfit() {
      let sum = 0;
      for (const line of this.linesEnabled) {
        if (!line?.data || line.data.length === 0) continue;
        const series = this.prepareSeriesData(line.data);
        if (series.length > 0) {
          sum += series[series.length - 1].value;
        }
      }
      return sum > 0 ? `+${sum.toFixed(2)}` : sum.toFixed(2);
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
      if (!chart) return;
      if (isFullscreen) {
        document.body.style.overflow = "hidden";
        chart.applyOptions({ height: window.innerHeight, width: window.innerWidth });
        this.applyLongestScale();
      } else {
        document.body.style.overflow = "";
        chart.applyOptions({ height: this.chartOptions.height, width: window.innerWidth - 20 });
        this.applyLongestScale();
      }
    },

    isLineTotalVisible() {
      this.updateLineTotal();
    },

    zoom(value) {
      this.zoomCondition = this.computeZoomCondition(value);
    },

    zoomCondition() {
      if (this.hasLineTotalOnly) return;

      if (this.zoomCondition) {
        this.setMarks();
      } else {
        this.clearMarks();
      }

      this.updateLineTotal();
    },

    linesEnabled() {
      this.applyLongestScale();

      if (this.zoom) {
        this.zoomCondition = this.computeZoomCondition(this.zoom);
      } else if (this.linesEnabled.length === 1) {
        const seriesData = this.prepareSeriesData(this.linesEnabled[0].data);
        const tradeCount = seriesData.filter(
          (d) => d.trade === "BUY" || d.trade === "SELL"
        ).length;
        this.zoomCondition = tradeCount <= 15;
      } else {
        this.zoomCondition = false;
      }

      if (this.zoomCondition) {
        this.setMarks();
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
      const lineData = this.linesData[index] || [];
      const lineValue = lineData[lineData.length - 1]?.value;
      const result =
        lineValue != null && !isNaN(lineValue)
          ? Number(lineValue).toFixed(2)
          : "0.00";

      return result;
    },

    //// Init chart
    async initChart() {
      this.convertServerDataToLines({ isUpdate: false });

      const chartContainer = document.getElementById("chart-container");
      if (!chartContainer) {
        console.error("chartContainer element not found");
        return;
      }
      if (chart) {
        chart.remove();
        chart = null;
      }
      lineSeries = [];
      lineSeriesTotal = null;
      chart = createChart(chartContainer, this.chartOptions);

      this.setupChartTotal();
      this.setupChartLines();

      this.applyLongestScale();

      this.setupZoomListener();
      this.setupAnnotations();

      if (this.linesEnabled.length === 1 || this.zoomCondition) {
        this.setMarks();
      }
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
          autoscaleInfoProvider: (original) =>
            this.getSeriesAutoscaleInfo(original),
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
        autoscaleInfoProvider: (original) =>
          this.getSeriesAutoscaleInfo(original),
      });

      const seriesDataTotal = this.prepareSeriesDataTotal();

      lineSeriesTotal.setData(seriesDataTotal);
    },

    //// Prepare line series
    prepareSeriesData(lineData: string[][]): ISeries[] {
      const tradeArray = lineData
        .map((row: string[]) => {
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

          const parsedPrice = parseFloat(tradePrice);
          const parsedCommission = parseFloat(commission);
          const parsedProfitPercent = parseFloat(profitPercent);
          const parsedProfitTotal = parseFloat(profitTotalPercent);

          return {
            dateString,
            trade: trade ? trade.trim() : "",
            tradePrice: isNaN(parsedPrice) ? 0 : parsedPrice,
            commission: isNaN(parsedCommission) ? 0 : parsedCommission,
            profitPercent: isNaN(parsedProfitPercent) ? 0 : parsedProfitPercent,
            profitTotalPercent: isNaN(parsedProfitTotal) ? 0 : parsedProfitTotal,
            tokenName: tokenName ? tokenName.trim() : "",
            count,
            priceChangePercent,
          };
        })
        .filter(
          (item) => item.dateString && !isNaN(Date.parse(item.dateString))
        );

      if (!this.useCommission) {
        let cumulativeCommissionPercent = 0;

        tradeArray.forEach((trade, index) => {
          // Commission is only deducted in report.js on position CLOSE (not on OPEN)
          const isClose =
            parseInt(trade.count, 10) % 2 === 0 ||
            index % 2 === 1 ||
            trade.profitPercent !== 0;

          if (isClose) {
            const commissionPercent =
              trade.tradePrice > 0
                ? (Math.abs(trade.commission) / trade.tradePrice) * 100
                : 0;
            cumulativeCommissionPercent += commissionPercent;
          }

          trade.profitTotalPercent += cumulativeCommissionPercent;
        });
      }

      const mapped = tradeArray.map(
        ({ dateString, trade, tradePrice, profitTotalPercent, tokenName }) => {
          return {
            time: Math.floor(Date.parse(dateString) / 1000),
            trade,
            price: tradePrice,
            value: profitTotalPercent,
            tokenName,
          };
        }
      );

      if (mapped.length === 1) {
        const nowSec = Math.floor(Date.now() / 1000);
        const nextTime = Math.max(mapped[0].time + 60, nowSec);
        mapped.push({
          time: nextTime,
          trade: "HOLD",
          price: mapped[0].price,
          value: mapped[0].value,
          tokenName: mapped[0].tokenName,
        });
      }

      mapped.sort((a, b) => a.time - b.time);

      // Lightweight-charts requires strictly ascending time for line series
      const seriesData: ISeries[] = [];
      let lastTime = -Infinity;
      for (const item of mapped) {
        let time = item.time;
        if (time <= lastTime) {
          time = lastTime + 1;
        }
        seriesData.push({
          ...item,
          time,
        });
        lastTime = time;
      }

      return seriesData;
    },

    prepareSeriesDataTotal(): ISeries[] {
      const isAllLinesSelected: boolean =
        this.hasLineTotalOnly || this.hasNoLines;

      const lines: ILine[] = isAllLinesSelected
        ? this.lines
        : this.linesEnabled;

      if (!lines.length) {
        this.linesDataTotal = [];
        return [];
      }

      const allPreparedLines = lines.map((line: ILine) =>
        this.prepareSeriesData(line.data)
      );

      const allTimesSet = new Set<number>();
      for (const series of allPreparedLines) {
        for (const item of series) {
          allTimesSet.add(item.time);
        }
      }

      const allTimesData = Array.from(allTimesSet).sort((a, b) => a - b);
      if (!allTimesData.length) {
        this.linesDataTotal = [];
        return [];
      }

      // Pre-index each line by time for O(1) lookups
      const lineMaps = allPreparedLines.map(
        (series) => new Map(series.map((item) => [item.time, item.value]))
      );

      const alignedLines: number[][] = lineMaps.map((lineMap) => {
        const aligned: number[] = [];
        let lastValue = 0;
        for (const time of allTimesData) {
          if (lineMap.has(time)) {
            lastValue = lineMap.get(time)!;
          }
          aligned.push(lastValue);
        }
        return aligned;
      });

      const linesDataTotal: ISeries[] = allTimesData.map(
        (time: number, index: number) => {
          let sum = 0;
          let activeCount = 0;
          for (let k = 0; k < alignedLines.length; k++) {
            const series = allPreparedLines[k];
            // Only count bots that have actually traded and started by this timestamp
            if (series && series.length > 0 && series[0].time <= time) {
              sum += alignedLines[k][index];
              activeCount++;
            }
          }
          const averageValue = activeCount > 0 ? sum / activeCount : 0;

          return {
            time,
            value: averageValue,
          };
        }
      );

      this.linesDataTotal = linesDataTotal;

      return linesDataTotal;
    },

    // Convert / apply server data to lines (supports full reload & incremental delta updates)
    convertServerDataToLines({ isUpdate }: { isUpdate: boolean }): boolean {
      if (!this.serverLines || !this.serverLines.length) return false;

      // Initial load: populate this.lines completely
      if (!this.lines.length || !isUpdate) {
        const lines: ILine[] = this.serverLines.map(
          (file: IServerLine, index: number): ILine => {
            const lineName = file.name.split(".")[0].replace(/^trades[-_]/i, "");
            const existingLine = this.lines.find((l: ILine) => l.name === lineName);
            return {
              name: lineName,
              fileName: file.name,
              mtime: file.mtime,
              data: file.data.map((item: string): string[] => item.split(",")),
              color: this.getColor(index),
              disabled: isUpdate ? (existingLine?.disabled ?? true) : true,
            };
          }
        );

        this.lines = lines;
        return true;
      }

      // Delta / incremental update:
      let hasChanges = false;
      for (const [index, file] of this.serverLines.entries()) {
        const lineName = file.name.split(".")[0].replace(/^trades[-_]/i, "");
        let line = this.lines.find(
          (l: ILine) => l.fileName === file.name || l.name === lineName
        );

        if (!line) {
          // Dynamic discovery of a newly added bot file
          const newLine: ILine = {
            name: lineName,
            fileName: file.name,
            mtime: file.mtime,
            data: file.data.map((item: string): string[] => item.split(",")),
            color: this.getColor(index),
            disabled: true,
          };
          this.lines.push(newLine);
          hasChanges = true;
          continue;
        }

        if (!line.fileName) {
          line.fileName = file.name;
        }
        if (file.mtime) {
          line.mtime = file.mtime;
        }

        if (file.isDelta) {
          // Incremental: only append new rows if any exist
          if (file.data && file.data.length > 0) {
            const newRows = file.data.map((item: string): string[] => item.split(","));
            line.data.push(...newRows);
            hasChanges = true;
          }
        } else {
          // Full replacement for this line (file reset, shrunk or forced reload)
          const allRows = file.data.map((item: string): string[] => item.split(","));
          line.data = allRows;
          hasChanges = true;
        }
      }

      return hasChanges;
    },

    loadCachedLines(): boolean {
      try {
        if (typeof window === "undefined" || !window.localStorage) return false;
        // Purge legacy v1 and v2 cache from previous sessions
        window.localStorage.removeItem("crypto_bot_chart_lines_v1");
        window.localStorage.removeItem("crypto_bot_chart_lines_v2");
        const raw = window.localStorage.getItem("crypto_bot_chart_lines_v3");
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed[0].name &&
          Array.isArray(parsed[0].data)
        ) {
          this.lines = parsed;
          return true;
        }
      } catch (err) {
        console.warn("Could not load lines from cache:", err);
      }
      return false;
    },

    saveLinesToCache() {
      try {
        if (typeof window === "undefined" || !window.localStorage) return;
        if (!this.lines || !this.lines.length) return;
        const toSave = this.lines.map((l: ILine) => ({
          name: l.name,
          fileName: l.fileName,
          mtime: l.mtime,
          data: l.data,
          color: l.color,
          disabled: l.disabled,
        }));
        window.localStorage.setItem(
          "crypto_bot_chart_lines_v3",
          JSON.stringify(toSave)
        );
      } catch (err) {
        console.warn("Could not save lines to cache:", err);
      }
    },

    async convertFileDataToLines({ target }) {
      // console.log(event.target.files);
      const inputFiles = [...target.files];

      if (!inputFiles.length) return;

      const lines = await Promise.all(
        inputFiles.map(async (file: File, index: number): Promise<ILine> => {
          const lineText = await file.text();
          const lineName = file.name.split(".")[0].replace(/^trades[-_]/i, "");

          const line: ILine = {
            name: lineName,
            data: lineText
              .trim()
              .split(/\r?\n/)
              .slice(1)
              .filter((item: string) => item.trim().length > 0)
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

      this.applyLongestScale();
      this.setupZoomListener();

      if (this.linesEnabled.length === 1 || this.zoomCondition) {
        this.setMarks();
      }
    },

    //// Updates
    updateChart() {
      if (lineSeries.length !== this.lines.length) {
        this.initChart();
        return;
      }
      this.updateLines();
      this.updateLineTotal();
      if (this.linesEnabled.length === 1 || this.zoomCondition) {
        this.setMarks();
      }
    },

    updateLineTotalVisibility() {
      const isLastLine = this.linesEnabled.length === 1;

      if (!isLastLine) {
        this.isLineTotalVisible = !this.isLineTotalVisible;
      }
    },

    computeZoomCondition(value) {
      if (!value || !value.from || !value.to) return false;
      const visibleSec = value.to - value.from;

      // 1. If an individual chart is selected
      if (this.linesEnabled.length === 1) {
        const line = this.linesEnabled[0];
        const seriesData = this.prepareSeriesData(line.data);
        if (!seriesData || seriesData.length === 0) return false;

        const tradePoints = seriesData.filter(
          (d) => d.trade === "BUY" || d.trade === "SELL"
        );
        const tradeCount = tradePoints.length;

        // If this bot has few trades overall (<= 15 trades), they don't crowd each other:
        // they should immediately be visible on this individual chart!
        if (tradeCount <= 15) {
          return true;
        }

        const firstTime = seriesData[0].time;
        const lastTime = seriesData[seriesData.length - 1].time;
        const botSpanSec = Math.max(1, lastTime - firstTime);

        // If this bot started recently and has a short span (<= 6 hours / 21600s),
        // its whole history is already a detailed view:
        if (botSpanSec <= 21600) {
          return true;
        }

        // For bots with long history and many trades (e.g. 50+ trades over 24h):
        // Show trades if zoomed in relative to this bot's span (visible window <= 55% of bot span)
        // OR if visible window <= 5 hours (18000s)
        // OR if visible trades in current window <= 25 trades
        const visibleTrades = tradePoints.filter(
          (t) => t.time >= value.from && t.time <= value.to
        );

        if (
          visibleSec <= 18000 ||
          visibleSec <= botSpanSec * 0.55 ||
          visibleTrades.length <= 25
        ) {
          return true;
        }

        return false;
      }

      // 2. If multiple lines are enabled
      // Only show markers when zoomed into a tight window (<= 3 hours / 10800s)
      return visibleSec <= 10800;
    },

    getSeriesAutoscaleInfo(original) {
      const res = original?.();
      if (!res || !res.priceRange) {
        return {
          priceRange: { minValue: -0.5, maxValue: 0.5 },
          margins: { above: 10, below: 10 },
        };
      }
      let { minValue, maxValue } = res.priceRange;
      if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
        return {
          priceRange: { minValue: -0.5, maxValue: 0.5 },
          margins: { above: 10, below: 10 },
        };
      }
      // If flat line (e.g. 0% or min === max), expand symmetrically around value
      if (Math.abs(maxValue - minValue) < 0.0001) {
        const delta =
          Math.abs(minValue) > 0.01 ? Math.abs(minValue) * 0.15 : 0.25;
        return {
          priceRange: {
            minValue: minValue - delta,
            maxValue: maxValue + delta,
          },
          margins: { above: 10, below: 10 },
        };
      }
      // Maximally scale to full height while keeping exact headroom for trade arrow markers
      return {
        priceRange: {
          minValue,
          maxValue,
        },
        margins: { above: 18, below: 18 },
      };
    },

    getLongestTimeRange() {
      let minTime = Infinity;
      let maxTime = -Infinity;

      // Scan all lines in the system
      for (const line of this.lines) {
        if (!line?.data || line.data.length === 0) continue;
        const seriesData = this.prepareSeriesData(line.data);
        if (!seriesData || seriesData.length === 0) continue;

        const first = seriesData[0].time;
        const last = seriesData[seriesData.length - 1].time;

        if (first < minTime) minTime = first;
        if (last > maxTime) maxTime = last;
      }

      const nowSec = Math.floor(Date.now() / 1000);

      // If no data exists across any line, default to recent 30-minute window
      if (!Number.isFinite(minTime) || !Number.isFinite(maxTime)) {
        return { from: nowSec - 1800, to: nowSec + 120 };
      }

      // If maxTime is older than nowSec but within current trading session (6 hours),
      // extend up to nowSec so current time is aligned at right
      if (nowSec > maxTime && nowSec - maxTime < 21600) {
        maxTime = nowSec;
      }

      const span = maxTime - minTime;
      // If very short span (< 5 mins), ensure comfortable 15-minute window
      if (span < 300) {
        const center = Math.floor((minTime + maxTime) / 2);
        return {
          from: center - 600,
          to: center + 300,
        };
      }

      const pad = Math.max(60, Math.floor(span * 0.04));
      return {
        from: minTime - pad,
        to: maxTime + pad,
      };
    },

    applyLongestScale() {
      if (!chart) return;
      const range = this.getLongestTimeRange();
      if (range && Number.isFinite(range.from) && Number.isFinite(range.to)) {
        try {
          chart.timeScale().setVisibleRange(range);
        } catch (e) {
          chart.timeScale().fitContent();
        }
      } else {
        chart.timeScale().fitContent();
      }

      // Automatically recalibrate and scale vertical height for currently visible lines
      chart.priceScale("right").applyOptions({ autoScale: true });
    },

    zoomToLine(line) {
      this.applyLongestScale();
    },

    updateLineVisibility(index: number) {
      const line = this.lines[index];
      if (!line) return;

      // Line
      line.disabled = !line.disabled;
      lineSeries[index]?.applyOptions({
        visible: !line.disabled,
      });

      // Total line
      this.updateLineTotal();

      this.zoom = null;
      this.applyLongestScale();

      if (this.linesEnabled.length === 1) {
        const seriesData = this.prepareSeriesData(this.linesEnabled[0].data);
        const tradeCount = seriesData.filter(
          (d) => d.trade === "BUY" || d.trade === "SELL"
        ).length;
        this.zoomCondition = tradeCount <= 15;
      } else if (this.zoom) {
        this.zoomCondition = this.computeZoomCondition(this.zoom);
      } else {
        this.zoomCondition = false;
      }

      if (this.zoomCondition) {
        this.setMarks();
      } else {
        this.clearMarks();
      }
    },

    soloLine(index: number) {
      const line = this.lines[index];
      if (!line) return;

      const isAlreadySolo =
        this.linesEnabled.length === 1 && this.linesEnabled[0] === line;

      if (isAlreadySolo) {
        // Re-enable all lines
        this.lines.forEach((l, i) => {
          l.disabled = false;
          lineSeries[i]?.applyOptions({ visible: true });
        });
        this.zoom = null;
        this.applyLongestScale();
        this.clearMarks();
      } else {
        // Solo this line
        this.lines.forEach((l, i) => {
          l.disabled = i !== index;
          lineSeries[i]?.applyOptions({ visible: i === index });
        });
        this.zoom = null;
        this.applyLongestScale();
        const seriesData = this.prepareSeriesData(line.data);
        const tradeCount = seriesData.filter(
          (d) => d.trade === "BUY" || d.trade === "SELL"
        ).length;
        this.zoomCondition = tradeCount <= 15;

        if (this.zoomCondition) {
          this.setMarks();
        } else {
          this.clearMarks();
        }
      }

      this.updateLineTotal();
    },

    async selectBotChart(botName: string) {
      const clean = botName?.trim().toUpperCase();
      const targetIndex = this.lines.findIndex(
        (l) => l.name?.toUpperCase() === clean
      );
      if (targetIndex === -1) return;

      // Solo this line
      this.lines.forEach((l, i) => {
        l.disabled = i !== targetIndex;
        lineSeries[i]?.applyOptions({ visible: i === targetIndex });
      });

      // Switch to Chart View
      this.isMonitorView = false;
      this.updateLineTotal();

      // Ensure chart container is rendered in DOM
      await this.$nextTick();

      if (chart) {
        chart.resize(
          window.innerWidth - 20,
          this.chartOptions.height,
          true
        );
        this.zoom = null;
        this.applyLongestScale();
      }

      const seriesData = this.prepareSeriesData(this.lines[targetIndex].data);
      const tradeCount = seriesData.filter(
        (d) => d.trade === "BUY" || d.trade === "SELL"
      ).length;
      this.zoomCondition = tradeCount <= 15;

      if (this.zoomCondition) {
        this.setMarks();
      } else {
        this.clearMarks();
      }
    },

    updateLines() {
      const linesData = [];

      for (const [index, line] of this.lines.entries()) {
        const seriesData = this.prepareSeriesData(line.data);
        if (lineSeries[index]) {
          lineSeries[index].setData(seriesData);
        } else if (chart) {
          const newLineSeries = chart.addLineSeries({
            color: line.color,
            priceScaleId: "right",
            lineWidth: this.lineWidth,
            visible: !this.hasLineTotalOnly && !line.disabled,
            priceLineVisible: false,
            lastValueVisible: true,
            autoscaleInfoProvider: (original) =>
              this.getSeriesAutoscaleInfo(original),
          });
          newLineSeries.setData(seriesData);
          lineSeries.push(newLineSeries);
        }
        linesData.push(seriesData);
      }

      this.linesData = linesData;
    },

    updateLineTotal() {
      lineSeriesTotal?.applyOptions({
        visible: this.isLineTotalVisible && this.linesEnabled.length !== 1,
      });

      const seriesDataTotal = this.prepareSeriesDataTotal();
      lineSeriesTotal?.setData(seriesDataTotal);
    },

    async refreshAllData() {
      this.isRefreshing = true;
      try {
        await Promise.all([this.fetchData(), this.fetchBotStatus()]);
        const hasUpdates = this.convertServerDataToLines({ isUpdate: true });
        if (hasUpdates) {
          this.updateChart();
          this.saveLinesToCache();
        }
      } finally {
        this.isRefreshing = false;
      }
    },

    setupChartUpdate() {
      this.refreshInterval = setInterval(async () => {
        await this.refreshAllData();
      }, 20000);
    },

    //// Listeners
    setupResizeListener() {
      const handler = () =>
        chart.resize(window.innerWidth - 20, this.chartOptions.height, true);

      window.addEventListener("resize", handler);
    },

    async setupZoomListener() {
      const myVisibleTimeRangeChangeHandler = (newVisibleTimeRange) => {
        if (!newVisibleTimeRange) return;
        this.zoom = newVisibleTimeRange;
        // Dynamically auto-scale price scale to fill full height for visible data
        chart?.priceScale("right")?.applyOptions({ autoScale: true });
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

        if (!annotation || !annotationToken || !annotationPrice) {
          return;
        }

        if (!param || !param.seriesData || !param.point) {
          annotation.style.display = "none";
          return;
        }

        let annotationTokenText = "";
        let annotationPriceText = "";
        let color = "transparent";

        lineSeries.forEach((series, index) => {
          const seriesData = param.seriesData.get(series);

          if (this.lines[index]?.disabled) return;

          const line = this.linesData[index]?.find(
            (item) =>
              item.time === seriesData?.time && item.value === seriesData?.value
          );

          if (line?.trade) {
            annotationTokenText += `${line.tokenName}<br>`;
            const formattedPrice =
              typeof line.price === "number"
                ? (line.price < 0.01 ? line.price.toFixed(8) : line.price.toFixed(4))
                : "";
            annotationPriceText += `${formattedPrice}<br>`;
            color = this.lines[index]?.color || "transparent";
          }
        });

        if (annotationTokenText) {
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
      // Clear markers on all series first
      lineSeries.forEach((s) => s?.setMarkers([]));
      this.lineSeriesMarked = null;
      this.isLineMarked = false;

      if (this.linesEnabled.length === 1) {
        const line = this.linesEnabled[0];
        const index = this.lines.indexOf(line);
        if (index === -1 || !lineSeries[index]) return;

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
        this.lineSeriesMarked?.setMarkers(markers);
        this.isLineMarked = true;
      } else if (this.zoomCondition && this.linesEnabled.length > 0) {
        this.linesEnabled.forEach((line) => {
          const index = this.lines.indexOf(line);
          if (index !== -1 && lineSeries[index]) {
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
            lineSeries[index]?.setMarkers(markers);
          }
        });
        this.isLineMarked = true;
      }
    },

    clearMarks() {
      lineSeries.forEach((s) => s?.setMarkers([]));
      this.lineSeriesMarked = null;
      this.isLineMarked = false;
    },

    //// Colors
    getColor(index: number): string {
      if (index < this.colors.length) {
        return this.colors[index];
      }

      return this.colors[index % this.colors.length];
    },

    //// API
    async fetchData(forceFull = false) {
      try {
        let url = "/lines";
        if (!forceFull && this.lines && this.lines.length > 0) {
          const counts: Record<string, number> = {};
          const mtimes: Record<string, number> = {};
          const lasts: Record<string, string> = {};
          const firsts: Record<string, string> = {};

          for (const line of this.lines) {
            const key =
              line.fileName || (line.name ? `trades-${line.name}.csv` : "");
            if (key) {
              const len = line.data ? line.data.length : 0;
              counts[key] = len;
              if (line.mtime) {
                mtimes[key] = line.mtime;
              }
              if (len > 0) {
                const firstRow = line.data[0];
                if (firstRow && firstRow[1]) {
                  firsts[key] = String(firstRow[1]).trim();
                }
                const lastRow = line.data[len - 1];
                if (lastRow && lastRow[1]) {
                  lasts[key] = String(lastRow[1]).trim();
                }
              }
            }
          }
          const params = new URLSearchParams();
          params.set("counts", JSON.stringify(counts));
          if (Object.keys(mtimes).length > 0) {
            params.set("mtimes", JSON.stringify(mtimes));
          }
          if (Object.keys(firsts).length > 0) {
            params.set("firsts", JSON.stringify(firsts));
          }
          if (Object.keys(lasts).length > 0) {
            params.set("lasts", JSON.stringify(lasts));
          }
          url = `/lines?${params.toString()}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const serverLines: IServerLine[] = await response.json();
        this.serverLines = serverLines;
        this.isLoading = false;
      } catch (error) {
        console.error("Error fetching lines:", error);
        this.isLoading = false;
        this.serverLines = [];
      }
    },

    async fetchBotStatus() {
      try {
        const response = await fetch("/status");
        if (response.ok) {
          const data = await response.json();
          if (data?.system) {
            this.systemStatus = data.system;
          }
          if (Array.isArray(data?.bots)) {
            this.botStatusList = data.bots;
          }
        }
      } catch (error) {
        console.warn("Could not fetch bot status:", error);
      }
    },

    getBotPosition(lineName: string) {
      if (!lineName || !this.botStatusList) return null;
      const clean = lineName.trim().toUpperCase();
      const found = this.botStatusList.find(
        (b) => b.name?.toUpperCase() === clean || b.id?.toUpperCase() === clean
      );
      return found?.position || null;
    },

    getBotColor(botName: string) {
      const clean = botName?.trim().toUpperCase();
      const line = this.lines.find((l) => l.name?.toUpperCase() === clean);
      return line?.color || "#888";
    },

    formatTarget(val: number) {
      if (val == null || isNaN(val)) return "-";
      if (val < 0.001) return val.toFixed(8);
      if (val < 1) return val.toFixed(6);
      return val.toFixed(4);
    },

    formatTime(dateStr: string) {
      if (!dateStr) return "";
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch {
        return "";
      }
    },

    formatBotName(name: string): string {
      if (!name) return "";
      return name.replace(/^ORDERBOOK-/i, "OB-");
    },

    toggleCardInfo(botName: string) {
      if (!botName) return;
      const clean = botName.trim().toUpperCase();
      this.activeInfoBotMap[clean] = !this.activeInfoBotMap[clean];
    },

    isCardInfoOpen(botName: string): boolean {
      if (!botName) return false;
      const clean = botName.trim().toUpperCase();
      return Boolean(this.activeInfoBotMap[clean]);
    },

    getStrategyInfo(name: string) {
      if (!name) {
        return {
          title: "Стратегия",
          concept: "Алгоритмическая торговая система",
          entry: "-",
          risk: "-",
        };
      }
      const clean = name.trim().toUpperCase().replace(/^TRADES[-_]/i, "").replace(/\.CSV$/i, "");
      return (
        STRATEGY_DESCRIPTIONS[clean] ||
        STRATEGY_DESCRIPTIONS[clean.replace(/^OB-/, "ORDERBOOK-")] ||
        STRATEGY_DESCRIPTIONS[clean.replace(/^ORDERBOOK-/, "OB-")] || {
          title: name,
          concept: "Алгоритмическая количественная стратегия",
          entry: "По техническим и биржевым сигналам",
          risk: "Динамический стоп-лосс и тейк-профит",
        }
      );
    },

    toggleCommission() {
      this.useCommission = !this.useCommission;
    },

    getBotPnl(bot) {
      if (!bot) return 0;
      const clean = (bot.name || bot.id || "").trim().toUpperCase();
      const lineIndex = this.lines.findIndex(
        (l) => l.name?.trim().toUpperCase() === clean
      );
      if (lineIndex !== -1 && this.linesData[lineIndex]?.length > 0) {
        const lineData = this.linesData[lineIndex];
        const lastPoint = lineData[lineData.length - 1];
        if (lastPoint && lastPoint.value != null && !isNaN(lastPoint.value)) {
          return lastPoint.value;
        }
      }
      return bot.totalProfit ?? 0;
    },

    toggleMonitorView() {
      this.isMonitorView = !this.isMonitorView;
      if (!this.isMonitorView) {
        this.$nextTick(() => {
          if (chart) {
            chart.resize(
              window.innerWidth - 20,
              this.chartOptions.height,
              true
            );
            this.applyLongestScale();
          }
        });
      } else {
        this.refreshAllData();
      }
    },
  },

  //// Life cycle
  async mounted() {
    const hasCache = this.loadCachedLines();
    if (hasCache) {
      this.isLoading = false;
      await this.$nextTick();
      await this.initChart();
    }

    await this.fetchData(!hasCache);
    this.fetchBotStatus();

    if (!hasCache) {
      await this.initChart();
      this.saveLinesToCache();
    } else {
      const hasUpdates = this.convertServerDataToLines({ isUpdate: true });
      if (hasUpdates) {
        this.updateChart();
        this.saveLinesToCache();
      }
    }

    this.setupResizeListener();
    this.setupChartUpdate();
  },

  unmounted() {
    chart?.remove();
    chart = null;
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
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
  left: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 9999;
  flex-wrap: nowrap;

  @media (max-width: 768px) {
    left: 8px;
    top: 6px;
    gap: 6px;
    flex-wrap: nowrap;

    .system-status-btn {
      margin-left: 0;
      font-size: 10px;
      padding: 0 6px;
      height: 24px;

      .status-view-active {
        display: none;
      }
    }
  }

  .use-commission-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;

    .use-commission-button {
      width: 25px;
      height: auto;
    }
  }

  .system-status-btn {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    gap: 6px;
    height: 25px;
    background: dimgray;
    color: white;
    text-transform: uppercase;
    padding: 0 8px;
    font-size: 11px;
    font-weight: 600;
    margin-left: 0;
    letter-spacing: 0.5px;
    user-select: none;
    border: none;
    box-shadow: none;
    border-radius: 0;
    &--active {
      background: #333;
      color: #fff;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: solid 1px var(--background-color);
      display: inline-block;
      flex-shrink: 0;

      &--green {
        background-color: var(--green-color);
      }

      &--yellow {
        background-color: #d97706;
      }
    }

    .status-btn-text {
      white-space: nowrap;
    }

    .status-btn-badge {
      background: var(--background-color);
      color: dimgray;
      padding: 1px 5px;
      font-size: 10px;
      font-weight: bold;
      white-space: nowrap;
    }

    .status-view-active {
      font-size: 10px;
      opacity: 0.85;
      white-space: nowrap;
    }
  }
}

.top-bar-right {
  position: absolute;
  top: 7px;
  right: 0;
  display: flex;
  align-items: center;
  z-index: 9999;

  .full-screen-button {
    width: 28px;
    height: auto;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    top: 6px;
    right: 0;

    .full-screen-button {
      width: 24px;
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
  user-select: none;
  -webkit-user-select: none;

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
    user-select: none;
    -webkit-user-select: none;

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
  user-select: none;
  -webkit-user-select: none;

  * {
    user-select: none;
    -webkit-user-select: none;
  }
}

.line {
  flex-grow: 1;
  flex-basis: 0;
  user-select: none;
  -webkit-user-select: none;

  &--disabled {
    background-color: lightgrey !important;
  }
}

.line__details {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

  .micro-pos-tag {
    background: var(--background-color);
    font-size: 14px;
    font-weight: 600;
    padding-inline: 7px;
    margin-left: 6px;
    letter-spacing: 0.3px;
    white-space: nowrap;
    border: none;

    &--long {
      color: var(--green-color);
    }

    &--short {
      color: var(--red-color);
    }
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
      background-color: var(--red-color);
    }

    &--green {
      background-color: var(--green-color);
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

// ==========================================
// Flat System & Bots Monitor View (in place of chart)
// ==========================================
.monitor-view {
  width: 100%;
  box-sizing: border-box;
  padding: 40px 10px 16px 10px;
  display: flex;
  flex-direction: column;
  background: var(--background-color);
  font-family: Arial, sans-serif;
  text-transform: uppercase;
  color: dimgray;

  @media (max-width: 768px) {
    padding: 38px 8px 16px 8px;
  }

  .monitor-summary-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: dimgray;
    color: white;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    flex-shrink: 0;

    .text-green { color: var(--green-color); }
    .text-red { color: var(--red-color); }
    .text-yellow { color: #d97706; }

    @media (max-width: 768px) {
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
      padding: 8px 10px;

      .summary-left {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        font-size: 10px;

        .summary-sep {
          display: none;
        }

        .summary-item {
          background: rgba(0, 0, 0, 0.2);
          padding: 2px 5px;
        }
      }
    }

    .summary-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      .summary-sep {
        opacity: 0.5;
      }
    }
  }

  .monitor-bots-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    align-content: start;
    gap: 8px;

    @media (max-width: 900px) {
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
    }

    @media (max-width: 420px) {
      grid-template-columns: 1fr;
    }

    .bot-card {
      height: 164px;
      min-height: 164px;
      max-height: 164px;
      box-sizing: border-box;
      overflow: hidden;
      background: #ffffff;
      border: none;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      padding: 0;
      position: relative;
      min-width: 0;
      user-select: none;
      -webkit-user-select: none;

      &--in-pos {
        border: none;
      }

      .bot-card__color-bar {
        height: 4px;
        width: 100%;
        flex-shrink: 0;
      }

      .bot-card__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 10px;
        background: #fbf9f5;
        border-bottom: 1px solid #ede8e0;

        .bot-card__name {
          font-size: 11px;
          font-weight: 700;
          color: #111827;
          letter-spacing: 0.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
          background: #f0ebe1;
          padding: 2px 7px;
        }

        .bot-card__header-right {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
        }

        .bot-card__info-btn {
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: #ede6dc;
          border: 1px solid #dcd5cb;
          color: #4b5563;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-family: Arial, sans-serif;
          font-weight: 800;
          padding: 0;
          line-height: 1;
          cursor: pointer;

          &--active {
            background: #111827;
            color: #fff;
            border-color: #111827;
          }
        }

        .bot-card__pnl {
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
          flex-shrink: 0;
          background: #f0ebe1;
          padding: 2px 7px;
        }
      }

      .bot-card__body {
        flex: 1;
        padding: 5px 8px 6px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;

        .bot-card__info-view {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 0;
          font-size: 10px;
          line-height: 1.3;
          text-transform: none;
          overflow: hidden;

          .info-title {
            font-weight: 800;
            color: #111827;
            font-size: 10px;
            margin-bottom: 3px;
            border-bottom: 1px solid #ede8e0;
            padding-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-transform: none;
          }

          .info-desc {
            color: #374151;
            font-size: 9px;
            line-height: 1.25;
            margin-bottom: 3px;
            text-transform: none;
          }

          .info-section {
            margin-bottom: 2px;
            font-size: 8.5px;
            line-height: 1.25;
            text-transform: none;

            &-label {
              font-weight: 800;
              color: #111827;
              margin-right: 3px;
            }

            &-text {
              color: #4b5563;
            }
          }

          .info-hint {
            font-size: 8.5px;
            color: #4b5563;
            background: #f0ebe1;
            padding: 2px 5px;
            text-align: center;
            font-weight: 700;
            text-transform: uppercase;
            margin-top: 2px;
            border-radius: 2px;
          }
        }

        .pos-row--main {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 5px;

          .pos-side {
            font-size: 10px;
            font-weight: 800;
            padding: 2px 6px;
            color: white;

            &--long {
              background: var(--green-color);
            }

            &--short {
              background: var(--red-color);
            }
          }

          .pos-symbol {
            font-size: 11px;
            font-weight: 800;
            color: #111827;
            background: #f0ebe1;
            padding: 2px 7px;
          }
        }

        .pos-details-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 3px;
          font-size: 10px;

          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f7f5f0;
            padding: 3px 7px;
            border-bottom: none;
            border-radius: 2px;

            .detail-label {
              color: #374151;
              font-weight: 700;
              font-size: 10px;
              letter-spacing: 0.4px;
            }

            .detail-val {
              font-weight: 800;
              color: #000000;
              font-size: 11px;
            }
          }
        }

        .bot-card__scanning {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10.5px;
          color: #4b5563;
          text-align: center;
          font-weight: 700;
          letter-spacing: 0.8px;
          padding: 14px 0;
        }
      }

      .bot-card__footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 5px 8px;
        border-top: 1px solid #ede8e0;
        font-size: 9.5px;
        color: #4b5563;
        font-weight: 700;
        background: #faf8f5;
        flex-shrink: 0;
      }
    }
  }
}

.text-green { color: var(--green-color); }
.text-red { color: var(--red-color); }
.text-yellow { color: #d97706; }
</style>
