<template>
  <!-- Slim top progress bar for initial load, recalculation, and background refresh -->
  <div v-if="isLoading || isBusy || isRefreshing" class="top-progress-bar" aria-hidden="true">
    <div class="top-progress-bar__fill" />
  </div>

  <!-- Crisp flat recalculating overlay when switching leverage/reinvest/commission/coins/live -->
  <div v-if="isBusy && !isLoading" class="busy-overlay" aria-live="polite">
    <div class="busy-badge">
      <span class="busy-spinner" />
      <span class="busy-text">{{ busyLabel || 'LOADING...' }}</span>
    </div>
  </div>

  <!-- Chart container: ALWAYS in DOM so createChart never fails -->
  <div
    v-show="!isLoading && lines.length > 0 && !isMonitorView"
    class="chart cursor-pointer"
    id="chart-container"
    @dblclick="applyLongestScale"
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
          BOTS: <strong>{{ displayBotStatusList.length }}/{{ displayBotStatusList.length }} RUNNING</strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          IN POSITION: <strong>{{ activeLivePositionsCount }} / {{ displayBotStatusList.length }}</strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          {{ !isLiveServer && isLiveOnly ? 'LIVE ' : '' }}PORTFOLIO {{ isAbsoluteMode ? (useCommission ? 'COMPOUND NET PNL' : 'COMPOUND GROSS PNL') : (useCommission ? 'NET PNL' : 'GROSS PNL') }}:
          <strong :class="parseFloat(totalProfit) >= 0 ? 'text-green' : 'text-red'">
            {{ formatProfit(totalProfit) }}
          </strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          MAX DD: <strong class="text-red">{{ formatDrawdown(portfolioMaxDrawdown) }}</strong>
        </span>
        <span class="summary-sep">|</span>
        <span class="summary-item">
          MODE: <strong>{{ isAbsoluteMode ? 'REINVESTMENT (COMPOUND %)' : 'SIMPLE %' }}</strong>
        </span>
        <template v-if="isLiveServer && accountInfo">
          <span class="summary-sep">|</span>
          <span class="summary-item" v-if="accountInfo.balance !== null">
            BALANCE: <strong class="text-green">{{ formatUsd(accountInfo.balance) }}</strong>
          </span>
          <span class="summary-sep" v-if="accountInfo.leverage">|</span>
          <span class="summary-item" v-if="accountInfo.leverage">
            LEVERAGE: <strong>{{ accountInfo.leverage }}x</strong><template v-if="accountInfo.grossExposure !== null"> (GROSS {{ accountInfo.grossExposure.toFixed(2) }}x)</template>
          </span>
        </template>
        <template v-else>
          <span class="summary-sep">|</span>
          <span class="summary-item">
            LEVERAGE: <strong>{{ leverage }}x</strong>
          </span>
        </template>
      </div>
    </div>

    <!-- 11 Bots Flat Grid -->
    <div class="monitor-bots-grid">
      <div
        v-for="bot in displayBotStatusList"
        :key="bot.id"
        class="bot-card cursor-pointer"
        :class="{ 'bot-card--in-pos': bot.hasOpenPosition }"
        @click="selectBotChart(bot.name)"
        :title="`Click to view ${bot.name} chart and trades`"
      >
        <div class="bot-card__color-bar" :style="{ backgroundColor: getBotColor(bot.name) }" />

        <div class="bot-card__header">
          <span class="bot-card__name" :title="getBotDescription(bot.name)">{{ formatBotName(bot.name) }}</span>
          <div class="bot-card__header-right">
            <span class="bot-card__pnl" :class="getBotPnl(bot) >= 0 ? 'text-green' : 'text-red'">
              {{ formatProfit(getBotPnl(bot)) }}
            </span>
          </div>
        </div>

        <div class="bot-card__body">
          <template v-if="bot.positions && bot.positions.length > 0">
            <div
              v-for="pos in bot.positions"
              :key="pos.symbol"
              class="pos-item-container"
              style="margin-bottom: 6px; padding-bottom: 4px;"
            >
              <div class="pos-row pos-row--main" style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <span class="pos-side" :class="pos.side === 'LONG' ? 'pos-side--long' : 'pos-side--short'">
                    {{ pos.side }}
                  </span>
                  <span class="pos-symbol">{{ pos.symbol }}</span>
                </div>
                <span class="pos-entry-price" style="font-size: var(--ui-font-size); font-weight: bold; color: #4b5563;">
                  @{{ formatTarget(pos.entryPrice) }}
                </span>
              </div>
            </div>
          </template>
          <template v-else-if="bot.position">
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
        </div>

        <div class="bot-card__footer">
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
      <table class="annotation-table">
        <tbody class="annotation--body" />
      </table>
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
          {{ displayBotStatusList.length }}/{{ displayBotStatusList.length }} BOTS
        </span>
        <span
          v-if="activeLivePositionsCount > 0"
          class="status-btn-badge"
        >
          {{ activeLivePositionsCount }} IN POS
        </span>
        <span v-if="isMonitorView" class="status-view-active">
          • MONITOR
        </span>
      </div>

      <!-- Live / Full Chart Toggle Button (FIXED IN TOP BAR MENU) -->
      <div
        v-if="!isLiveServer && liveStartTime"
        class="live-toggle-container cursor-pointer"
        :class="{ 'live-toggle--active': isLiveOnly }"
        @click.stop.prevent="toggleLiveOnly"
        :title="isLiveOnly ? 'Current: LIVE ONLY (backtest hidden). Click for FULL CHART' : 'Current: FULL CHART. Click to isolate LIVE ONLY'"
      >
        <span
          class="live-toggle-dot"
          :class="{ 'live-toggle-dot--active': isLiveOnly }"
        />
        <span class="live-toggle-badge">
          {{ isLiveOnly ? 'LIVE ONLY' : 'FULL CHART' }}
        </span>
      </div>

      <!-- Commission toggle (frozen ON on live server) -->
      <div
        class="use-commission-container"
        :class="{
          'use-commission--off': !useCommission,
          'cursor-pointer': !isLiveServer,
          'control--locked': isLiveServer,
        }"
        @click.stop.prevent="!isLiveServer && toggleCommission()"
        :title="
          isLiveServer
            ? 'Live account: real exchange commissions are always included (locked)'
            : useCommission
            ? 'Commission: ON (Net PnL, -0.10% round-trip) - Click to disable'
            : 'Commission: OFF (Gross PnL, no fee) - Click to enable'
        "
      >
        <img
          :src="useCommission ? '/icons/money.svg' : '/icons/money-off.svg'"
          alt="Commission Mode"
          class="use-commission-button"
          draggable="false"
        />
        <span class="use-commission-badge">
          {{ useCommission ? 'COMM ON' : 'COMM OFF' }}
        </span>
      </div>

      <!-- Mode toggle (% vs $ Wallet) (frozen ON on live server) -->
      <div
        class="calc-mode-container"
        :class="{
          'calc-mode--off': !isAbsoluteMode,
          'cursor-pointer': !isLiveServer,
          'control--locked': isLiveServer,
        }"
        @click.stop.prevent="!isLiveServer && toggleCalcMode()"
        :title="
          isLiveServer
            ? 'Live account: real equity compounds automatically (locked)'
            : isAbsoluteMode
            ? 'Reinvestment: ON (Compounding %) - Click to disable'
            : 'Reinvestment: OFF (Simple %) - Click to enable'
        "
      >
        <img
          :src="isAbsoluteMode ? '/icons/wallet.svg' : '/icons/percent.svg'"
          alt="Mode"
          class="calc-mode-button"
          draggable="false"
        />
        <span class="calc-mode-badge">
          {{ isAbsoluteMode ? 'REINVEST ON' : 'REINVEST OFF' }}
        </span>
      </div>

      <!-- Real Account Balance & Current Leverage (LIVE SERVER ONLY, no selector) -->
      <div
        v-if="isLiveServer && accountInfo"
        class="live-account-badge"
        title="Real Binance Futures account balance and active trading leverage"
      >
        <span class="live-account-dot" />
        <span v-if="accountInfo.balance !== null" class="live-account-balance">
          {{ formatUsd(accountInfo.balance) }}
        </span>
        <span v-if="accountInfo.leverage" class="live-account-lev">
          LEV {{ accountInfo.leverage }}x
        </span>
        <span v-if="accountInfo.grossExposure !== null" class="live-account-gross">
          EXP {{ accountInfo.grossExposure.toFixed(2) }}x
        </span>
      </div>

      <!-- Leverage Selector (TEST / DEMO UI ONLY, default 1x = no leverage) -->
      <div
        v-if="!isLiveServer"
        class="leverage-selector"
        title="Simulated trading leverage for backtests & demo (default: 1x / no leverage)"
      >
        <span class="leverage-label">LEV</span>
        <button
          v-for="lev in leverageOptions"
          :key="lev"
          type="button"
          class="leverage-btn cursor-pointer"
          :class="{ 'leverage-btn--active': leverage === lev }"
          @click.stop.prevent="setLeverage(lev)"
        >
          {{ lev }}x
        </button>
      </div>

      <!-- Coin List / Filter Toggle (read-only view on live server, interactive filter on demo/test) -->
      <div
        v-if="allCoins.length > 0"
        class="coin-filter-container cursor-pointer"
        :class="{ 'coin-filter--filtered': !isLiveServer && excludedCoins.size > 0 }"
        @click.stop.prevent="toggleCoinFilter"
        :title="
          isLiveServer
            ? 'Traded coins (' + allCoins.length + ') - Click to view list (read-only)'
            : excludedCoins.size > 0
            ? 'Coins: ' + (allCoins.length - excludedCoins.size) + '/' + allCoins.length + ' active (' + excludedCoins.size + ' excluded) - Click to manage'
            : 'Coins: all ' + allCoins.length + ' active - Click to filter'
        "
      >
        <span class="coin-filter-badge">
          {{ !isLiveServer && excludedCoins.size > 0 ? (allCoins.length - excludedCoins.size) + '/' + allCoins.length + ' COINS' : 'COINS (' + allCoins.length + ')' }}
        </span>
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

    <!-- Floating Draggable Time-Window Scrubber -->
    <div
      v-show="!isMonitorView && !isFullScreen && timelineBounds.span > 0"
      class="timeline-scrubber"
    >
      <div class="timeline-presets">
        <button
          v-for="p in windowPresets"
          :key="p.key"
          type="button"
          class="timeline-preset-btn cursor-pointer"
          :class="{ 'timeline-preset-btn--active': activeWindowPreset === p.key }"
          @click="selectWindowPreset(p.key)"
          :title="p.key === 'ALL' ? 'Show full history' : `Select ${p.label} floating window (drag to slide)`"
        >{{ p.label }}</button>
      </div>

      <div
        ref="timelineTrack"
        class="timeline-track"
        @pointerdown="onTimelineTrackDown"
      >
        <span
          v-for="tick in timelineYearTicks"
          :key="tick.label + '-' + tick.pct"
          class="timeline-year-tick"
          :style="{ left: tick.pct + '%' }"
        >{{ tick.label }}</span>

        <div
          ref="timelineWindow"
          class="timeline-window"
          :class="{ 'timeline-window--dragging': timelineDragMode !== null }"
          :style="timelineWindowStyle"
          @pointerdown.stop="startTimelineDrag($event, 'move')"
        >
          <span
            class="timeline-handle timeline-handle--left"
            @pointerdown.stop="startTimelineDrag($event, 'left')"
          />
          <span
            class="timeline-handle timeline-handle--right"
            @pointerdown.stop="startTimelineDrag($event, 'right')"
          />
        </div>
      </div>

      <div v-if="windowStats" class="timeline-readout">
        <span ref="timelineDatesEl" class="timeline-dates">{{ windowStats.rangeLabel }}</span>
        <span
          ref="timelinePnlEl"
          class="timeline-pnl"
          :class="windowStats.pnl >= 0 ? 'text-green' : 'text-red'"
          title="Return inside selected time window"
        >{{ formatProfit(windowStats.pnl) }}</span>
        <span class="timeline-dd" title="Max Drawdown inside selected time window">
          DD <strong ref="timelineDdEl" class="text-red">{{ formatDrawdown(windowStats.dd) }}</strong>
        </span>
      </div>
    </div>

    <!-- Legend toolbar (hidden when in monitor view or fullscreen) -->
    <div v-show="!isMonitorView && !isFullScreen" class="info-container">
      <!-- Total / Average -->
      <div
        class="total info line clip-right cursor-pointer"
        :class="{
          'total--disabled': !isLineTotalVisible && linesEnabled.length !== 1,
        }"
        @click="updateLineTotalVisibility"
        :title="
          isAbsoluteMode
            ? 'Portfolio Compound Profit: ' + formatProfit(totalProfit)
            : 'Portfolio ' + (useCommission ? 'Net PnL' : 'Gross PnL (No Fee)') + ': ' + formatProfit(totalProfit)
        "
      >
        <div class="line__details info">
          <span class="line__name">
            {{ !isLiveServer && isLiveOnly ? 'LIVE ' : '' }}{{ isAbsoluteMode ? (useCommission ? 'PORTFOLIO COMPOUND PNL' : 'PORTFOLIO COMPOUND GROSS') : (useCommission ? 'PORTFOLIO PNL' : 'PORTFOLIO GROSS') }}
          </span>
          <span class="line__max-dd" :title="'Portfolio Max Drawdown: ' + formatDrawdown(portfolioMaxDrawdown)">
            MAX DD: <strong ref="portfolioDdEl" class="text-red">{{ formatDrawdown(portfolioMaxDrawdown) }}</strong>
          </span>
          <span ref="portfolioValEl" class="line__last-value">
            {{ formatProfit(totalProfit) }}
          </span>
          <span
            ref="portfolioDotEl"
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
      <template v-for="(line, index) in lines" :key="index">
        <div
          v-if="!isLiveOnly || isLineLive(line)"
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
            <span class="line__name" :title="getBotDescription(line.name)" v-text="formatBotName(line.name)" />

            <span class="line__max-dd" :title="'Bot Max Drawdown: ' + formatDrawdown(botMaxDrawdowns[index] || 0)">
              DD: <strong :data-bot-dd="index" class="text-red">{{ formatDrawdown(botMaxDrawdowns[index] || 0) }}</strong>
            </span>

            <span :data-bot-val="index" class="line__last-value" v-text="getLegendValue(index)" />
            <span
              :data-bot-dot="index"
              class="round"
              :class="{
                'round--green': (botWindowMetrics[index]?.pnl || 0) > 0,
                'round--red': (botWindowMetrics[index]?.pnl || 0) < 0,
              }"
            />
          </div>
        </div>
      </template>
    </section>
    <!-- Coin Filter / Viewer Modal (read-only on live server) -->
    <div
      v-if="isCoinFilterOpen"
      class="coin-modal-overlay"
      @click.self="isCoinFilterOpen = false"
    >
      <div class="coin-modal">
        <div class="coin-modal-header">
          <div class="coin-modal-title">
            <span>{{ isLiveServer ? 'TRADED COINS' : 'COIN FILTER' }}</span>
            <span class="coin-modal-subtitle">
              {{ isLiveServer ? '(' + allCoins.length + ' — read-only)' : '(' + (allCoins.length - excludedCoins.size) + '/' + allCoins.length + ' active)' }}
            </span>
          </div>
          <button class="coin-modal-close" @click="isCoinFilterOpen = false">✕</button>
        </div>

        <div class="coin-modal-search-row">
          <input
            v-model="coinFilterSearch"
            type="text"
            class="coin-modal-search"
            placeholder="Search coin (e.g. BTC, ETH)..."
          />
          <template v-if="!isLiveServer">
            <button class="coin-btn-action" @click="selectAllCoins">SELECT ALL</button>
            <button class="coin-btn-action" @click="deselectAllCoins">DESELECT ALL</button>
          </template>
        </div>

        <div class="coin-modal-list">
          <div
            v-for="coin in filteredCoins"
            :key="coin.symbol"
            class="coin-modal-item"
            :class="{
              'cursor-pointer': !isLiveServer,
              'coin-modal-item--excluded': !isLiveServer && excludedCoins.has(coin.symbol),
            }"
            @click="!isLiveServer && toggleCoin(coin.symbol)"
          >
            <input
              v-if="!isLiveServer"
              type="checkbox"
              :checked="!excludedCoins.has(coin.symbol)"
              class="coin-checkbox"
              @click.stop="toggleCoin(coin.symbol)"
            />
            <span class="coin-name">{{ coin.symbol }}</span>
            <span class="coin-trades-count">{{ coin.tradesCount }} trades</span>
            <span
              class="coin-pnl-badge"
              :class="coin.pnlContribution >= 0 ? 'coin-pnl--positive' : 'coin-pnl--negative'"
            >
              {{ coin.pnlContribution >= 0 ? '+' : '' }}{{ coin.pnlContribution.toFixed(2) }}%
            </span>
          </div>
          <div v-if="filteredCoins.length === 0" class="coin-empty-search">
            No coins found
          </div>
        </div>

        <div class="coin-modal-footer">
          <button class="coin-btn-done" @click="isCoinFilterOpen = false">{{ isLiveServer ? 'CLOSE' : 'DONE' }}</button>
        </div>
      </div>
    </div>
  </template>
</template>

<script lang="ts">
import { defineComponent, markRaw } from "vue";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { IAccountInfo, IBotPosition, IBotStatus, IStatusResponse } from "../pages/status";

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
  profitPercent?: number;
  tradeResult?: number;
  sum?: number;
  count?: number;
  tokenName?: string;
  price?: number;
}

interface ITradeArrow {
  time: number;
  value: number;
  up: boolean;
  color: string;
  filled: boolean;
}

let uChart: uPlot | null = null;
let uAlignedData: uPlot.AlignedData = [[]];
let uArrows: ITradeArrow[] = [];
let uDividerTime: number | null = null;
let uScrubRaf: number | null = null;
let uPendingRange: { from: number; to: number } | null = null;
let uResizeHandler: (() => void) | null = null;

const totalLineColor = "dimgray";

function calcSeriesWindowMetrics(
  s: ISeries[] | undefined,
  from: number,
  to: number,
  isCompound: boolean,
  fastStride = false
): { pnl: number; dd: number } {
  if (!s || s.length === 0) return { pnl: 0, dd: 0 };
  const firstT = s[0].time;
  const lastT = s[s.length - 1].time;
  const isFullRange = from <= firstT + 1 && to >= lastT - 1;

  if (isFullRange) {
    const endVal = s[s.length - 1]?.value || 0;
    const step = fastStride && s.length > 4000 ? Math.floor(s.length / 2000) : 1;
    let peak = 100;
    let maxDd = 0;
    for (let i = 0; i < s.length; i += step) {
      const bal = 100 + (s[i]?.value || 0);
      if (bal > peak) peak = bal;
      const dd = peak > 0 ? ((bal - peak) / peak) * 100 : 0;
      if (dd < maxDd) maxDd = dd;
    }
    if (step > 1) {
      const lastBal = 100 + endVal;
      const ddLast = peak > 0 ? ((lastBal - peak) / peak) * 100 : 0;
      if (ddLast < maxDd) maxDd = ddLast;
    }
    return { pnl: Number(endVal.toFixed(2)), dd: Number(maxDd.toFixed(2)) };
  }

  // Binary search first point >= from, last point <= to
  let lo = 0, hi = s.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s[mid].time < from) lo = mid + 1;
    else hi = mid;
  }
  const iStart = lo;

  lo = iStart; hi = s.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s[mid].time <= to) lo = mid;
    else hi = mid - 1;
  }
  const iEnd = Math.max(iStart, lo);

  const startVal = s[iStart]?.value || 0;
  const endVal = s[iEnd]?.value || 0;
  const startBal = 100 + startVal;
  const endBal = 100 + endVal;

  const pnl = isCompound
    ? startBal > 0
      ? ((endBal - startBal) / startBal) * 100
      : 0
    : endVal - startVal;

  const spanPts = iEnd - iStart;
  const step = fastStride && spanPts > 4000 ? Math.floor(spanPts / 2000) : 1;
  let peak = startBal;
  let maxDd = 0;
  for (let i = iStart; i <= iEnd; i += step) {
    const bal = 100 + (s[i]?.value || 0);
    if (bal > peak) peak = bal;
    const dd = peak > 0 ? ((bal - peak) / peak) * 100 : 0;
    if (dd < maxDd) maxDd = dd;
  }
  if (step > 1) {
    const ddLast = peak > 0 ? ((endBal - peak) / peak) * 100 : 0;
    if (ddLast < maxDd) maxDd = ddLast;
  }

  return { pnl: Number(pnl.toFixed(2)), dd: Number(maxDd.toFixed(2)) };
}

interface ITradeState {
  isOpen: boolean;
  side: "LONG" | "SHORT";
  isHold?: boolean;
  // other positions held right after this trade (or positions held during this hold)
  held: Array<{ token: string; side: "LONG" | "SHORT"; price: number }>;
}

// Per-token open/close replay of a line's trades (legs of one token alternate open -> close)
const tradeStatesCache = new WeakMap<object, Map<object, ITradeState>>();
function getTradeStates(items: ISeries[]): Map<object, ITradeState> {
  const cached = tradeStatesCache.get(items);
  if (cached) return cached;
  const states = new Map<object, ITradeState>();
  const held = new Map<string, { side: "LONG" | "SHORT"; price: number }>();
  for (const item of items) {
    if (item.trade === "HOLD") {
      states.set(item, {
        isOpen: false,
        side: "LONG",
        isHold: true,
        held: [...held].map(([t, p]) => ({ token: t, ...p })),
      });
      continue;
    }
    if (item.trade !== "BUY" && item.trade !== "SELL") continue;
    const token = item.tokenName || "";
    const pos = held.get(token);
    let side: "LONG" | "SHORT";
    if (pos) {
      side = pos.side;
      held.delete(token);
    } else {
      side = item.trade === "BUY" ? "LONG" : "SHORT";
      held.set(token, { side, price: item.price ?? 0 });
    }
    states.set(item, {
      isOpen: !pos,
      side,
      held: [...held].filter(([t]) => t !== token).map(([t, p]) => ({ token: t, ...p })),
    });
  }
  tradeStatesCache.set(items, states);
  return states;
}

const formatTradePrice = (price: number | undefined): string =>
  typeof price === "number" ? (price < 0.01 ? price.toFixed(8) : price.toFixed(4)) : "";

interface IAnchorLists {
  all: ISeries[];
  trades: ISeries[];
}
const anchorsCache = new WeakMap<object, IAnchorLists>();
function getAnchorLists(items: ISeries[]): IAnchorLists {
  const cached = anchorsCache.get(items);
  if (cached) return cached;
  const all: ISeries[] = [];
  const trades: ISeries[] = [];
  for (const item of items) {
    if (
      item.trade === "BUY" ||
      item.trade === "SELL" ||
      item.trade === "LIVE_START"
    ) {
      all.push(item);
      trades.push(item);
    } else if (item.trade === "HOLD") {
      all.push(item);
    }
  }
  const result = { all, trades };
  anchorsCache.set(items, result);
  return result;
}

function findNearestByTime(list: ISeries[], targetTime: number): ISeries | null {
  const n = list.length;
  if (n === 0) return null;
  if (targetTime <= list[0].time) return list[0];
  if (targetTime >= list[n - 1].time) return list[n - 1];

  let lo = 0;
  let hi = n - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = list[mid].time;
    if (t === targetTime) return list[mid];
    if (t < targetTime) lo = mid + 1;
    else hi = mid - 1;
  }
  const prev = list[hi];
  const next = list[lo];
  return Math.abs(targetTime - prev.time) <= Math.abs(next.time - targetTime)
    ? prev
    : next;
}

export default defineComponent({
  name: "Chart",

  data() {
    return {
      isLoading: true as boolean,
      serverLines: [] as IServerLine[],
      refreshInterval: null as ReturnType<typeof setInterval> | null,
      lineWidth: 2.5,
      isFullScreen: false as boolean,
      isLineMarked: false as boolean,
      useCommission: true as boolean,
      isAbsoluteMode: false as boolean,
      initialBotCapital: 100 as number,
      liveStartTime: null as number | null,
      isLiveOnly: false as boolean,
      isLiveServer: false as boolean,
      leverage: 1 as number,
      windowPresets: [
        { key: "1M", label: "1M", days: 30 },
        { key: "3M", label: "3M", days: 91 },
        { key: "6M", label: "6M", days: 182 },
        { key: "1Y", label: "1Y", days: 365 },
        { key: "2Y", label: "2Y", days: 730 },
        { key: "ALL", label: "ALL", days: 0 },
      ],
      activeWindowPreset: "ALL" as string,
      winFrom: 0 as number,
      winTo: 0 as number,
      timelineDragMode: null as "move" | "left" | "right" | null,
      timelineDragStartX: 0 as number,
      timelineDragInitFrom: 0 as number,
      timelineDragInitTo: 0 as number,
      isScrubbingTimeline: false as boolean,
      leverageOptions: [1, 2, 3, 5] as number[],
      accountInfo: null as IAccountInfo | null,
      liveBadgeX: null as number | null,
      isMonitorView: false as boolean,
      isRefreshing: false as boolean,
      isBusy: false as boolean,
      busyLabel: "" as string,
      botStatusList: [] as IBotStatus[],
      systemStatus: {
        status: "HEALTHY",
        runningBots: 12,
        totalBots: 12,
        timestamp: "",
        activePositionsCount: 0,
      } as IStatusResponse["system"],

      lines: [] as ILine[],

      linesData: [] as ISeries[][],
      linesDataTotal: [] as ISeries[],

      isLineTotalVisible: true as boolean,

      markedLineIndex: -1 as number,

      zoomCondition: false as boolean,

      tradeDirection: "long" as string,
      isCoinFilterOpen: false as boolean,
      coinFilterSearch: "" as string,
      excludedCoins: new Set<string>(),

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
    chartHeight(): number {
      return this.isFullScreen ? window.innerHeight : 335;
    },

    portfolioEquity(): string {
      const isAllLines =
        this.hasLineTotalOnly ||
        this.hasNoLines ||
        this.linesEnabled.length === 0;
      const baseLines = this.isLiveOnly
        ? this.lines.filter((l) => this.isLineLive(l))
        : this.lines;
      const targetLines = isAllLines ? baseLines : this.linesEnabled;
      const count = targetLines.length || 1;
      const baseCapital = count * this.initialBotCapital;
      const profit = parseFloat(this.totalSumProfit) || 0;
      return (baseCapital + profit).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    activePrimarySeries(): ISeries[] {
      const _isAbs = this.isAbsoluteMode;
      const _comm = this.useCommission;
      if (this.linesEnabled.length === 1) {
        const idx = this.lines.indexOf(this.linesEnabled[0]);
        if (idx >= 0 && this.linesData[idx]?.length) return this.linesData[idx];
      }
      if (this.linesDataTotal && this.linesDataTotal.length > 0) {
        return this.linesDataTotal;
      }
      let best: ISeries[] = [];
      for (const s of this.linesData) {
        if (s && s.length > best.length) best = s;
      }
      return best;
    },

    timelineBounds(): { min: number; max: number; span: number } {
      const s = this.activePrimarySeries;
      if (!s || s.length < 2) return { min: 0, max: 0, span: 0 };
      const min = Number(s[0].time) || 0;
      const max = Number(s[s.length - 1].time) || 0;
      return { min, max, span: Math.max(0, max - min) };
    },

    timelineYearTicks(): Array<{ label: string; pct: number }> {
      const { min, max, span } = this.timelineBounds;
      if (span <= 0) return [];
      const ticks: Array<{ label: string; pct: number }> = [];
      const dMin = new Date(min * 1000);
      const dMax = new Date(max * 1000);
      if (span >= 380 * 86400) {
        for (let yr = dMin.getUTCFullYear(); yr <= dMax.getUTCFullYear(); yr++) {
          const ts = Date.UTC(yr, 0, 1) / 1000;
          if (ts >= min && ts <= max) {
            const pct = ((ts - min) / span) * 100;
            if (pct <= 96) ticks.push({ label: String(yr), pct });
          }
        }
      } else {
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        let yr = dMin.getUTCFullYear();
        let mo = dMin.getUTCMonth();
        while (yr < dMax.getUTCFullYear() || (yr === dMax.getUTCFullYear() && mo <= dMax.getUTCMonth())) {
          const ts = Date.UTC(yr, mo, 1) / 1000;
          if (ts >= min && ts <= max) {
            const pct = ((ts - min) / span) * 100;
            if (pct <= 94) ticks.push({ label: `${months[mo]} ${String(yr).slice(-2)}`, pct });
          }
          mo++;
          if (mo > 11) { mo = 0; yr++; }
        }
      }
      return ticks;
    },

    timelineWindowStyle(): Record<string, string> {
      const { min, max, span } = this.timelineBounds;
      if (span <= 0) return { left: "0%", width: "100%" };
      const from = this.winFrom > 0 ? Math.max(min, Math.min(max, this.winFrom)) : min;
      const to = this.winTo > 0 ? Math.max(from, Math.min(max, this.winTo)) : max;
      const leftPct = ((from - min) / span) * 100;
      const widthPct = Math.max(1.2, ((to - from) / span) * 100);
      return {
        left: `${Math.min(100 - widthPct, Math.max(0, leftPct)).toFixed(3)}%`,
        width: `${Math.min(100, widthPct).toFixed(3)}%`,
      };
    },

    activeWindowRange(): { from: number; to: number } {
      const { min, max, span } = this.timelineBounds;
      if (span <= 0) return { from: 0, to: 0 };
      const from = this.winFrom > 0 ? Math.max(min, Math.min(max, this.winFrom)) : min;
      const to = this.winTo > 0 ? Math.max(from, Math.min(max, this.winTo)) : max;
      return { from, to };
    },

    windowStats(): { rangeLabel: string; pnl: number; dd: number } | null {
      const s = this.activePrimarySeries;
      const { span } = this.timelineBounds;
      if (!s || s.length < 2 || span <= 0) return null;
      const { from, to } = this.activeWindowRange;
      const m = calcSeriesWindowMetrics(s, from, to, this.isAbsoluteMode, false);
      const fmtDate = (sec: number, showDay: boolean) => {
        const iso = new Date(sec * 1000).toISOString();
        return showDay ? iso.slice(0, 10) : iso.slice(0, 7);
      };
      const showDay = (to - from) < 120 * 86400;
      return {
        rangeLabel: `${fmtDate(from, showDay)} → ${fmtDate(to, showDay)}`,
        pnl: m.pnl,
        dd: m.dd,
      };
    },

    botWindowMetrics(): Array<{ pnl: number; dd: number }> {
      const _isAbs = this.isAbsoluteMode;
      const _comm = this.useCommission;
      const { from, to } = this.activeWindowRange;
      return this.linesData.map((series) =>
        calcSeriesWindowMetrics(series, from, to, this.isAbsoluteMode, false)
      );
    },

    botMaxDrawdowns(): number[] {
      return this.botWindowMetrics.map((m) => m.dd);
    },

    portfolioMaxDrawdown(): number {
      const _isAbs = this.isAbsoluteMode;
      const _comm = this.useCommission;
      if (this.windowStats) return this.windowStats.dd;
      return 0;
    },

    totalProfit(): string {
      const _isAbs = this.isAbsoluteMode;
      const _comm = this.useCommission;
      if (this.windowStats) return this.windowStats.pnl.toFixed(2);
      return "0.00";
    },

    totalSumProfit(): string {
      const _isAbs = this.isAbsoluteMode;
      const _comm = this.useCommission;

      const isAllLines =
        this.hasLineTotalOnly ||
        this.hasNoLines ||
        this.linesEnabled.length === 0;
      const baseLines = this.isLiveOnly
        ? this.lines.filter((l) => this.isLineLive(l))
        : this.lines;
      const targetLines = isAllLines ? baseLines : this.linesEnabled;
      let sum = 0;
      for (const line of targetLines) {
        const idx = this.lines.indexOf(line);
        const sData = this.linesData[idx];
        if (sData && sData.length > 0) {
          sum += sData[sData.length - 1].value;
        } else if (line.data && line.data.length > 0 && (!this.isLiveOnly || this.isLineLive(line))) {
          sum += parseFloat(line.data[line.data.length - 1][8]) || 0;
        }
      }
      return sum > 0 ? `+${sum.toFixed(2)}` : sum.toFixed(2);
    },

    linesEnabled(): ILine[] {
      return this.lines.filter(
        (line: ILine) => (!this.isLiveOnly || this.isLineLive(line)) && !line.disabled
      );
    },

    hasLineTotalOnly(): boolean {
      return this.isLineTotalVisible && this.linesEnabled.length === 0;
    },

    hasNoLines(): boolean {
      return !this.isLineTotalVisible && this.linesEnabled.length === 0;
    },

    allCoins(): Array<{ symbol: string; tradesCount: number; pnlContribution: number }> {
      const counts: Record<string, number> = {};
      const pnls: Record<string, number> = {};

      const baseLines = this.isLiveOnly
        ? this.lines.filter((l) => this.isLineLive(l))
        : this.lines;
      const targetLines = this.linesEnabled.length === 1 ? this.linesEnabled : baseLines;
      for (const line of targetLines) {
        if (!line?.data) continue;
        for (const row of line.data) {
          if (!row || row.length < 5) continue;
          if (this.isLiveOnly && this.liveStartTime) {
            const tSec = Math.floor(Date.parse(row[1]?.trim()) / 1000);
            if (!isNaN(tSec) && tSec < this.liveStartTime) continue;
          }
          const token = row[2]?.trim();
          const trade = row[4]?.trim();
          if (!token || token === "PORTFOLIO" || token === "ACCOUNT") continue;
          if (trade !== "BUY" && trade !== "SELL") continue;
          const sym = token.split(/\s+/)[0];
          counts[sym] = (counts[sym] || 0) + 1;
          const res = parseFloat(row[3]) || parseFloat(row[7]) || 0;
          if (!isNaN(res) && res !== 0) {
            pnls[sym] = (pnls[sym] || 0) + res;
          }
        }
      }

      return Object.keys(counts)
        .map((sym) => ({
          symbol: sym,
          tradesCount: counts[sym],
          pnlContribution: pnls[sym] || 0,
        }))
        .sort((a, b) => b.tradesCount - a.tradesCount);
    },

    displayBotStatusList(): IBotStatus[] {
      if (this.isLiveOnly) {
        return this.botStatusList.filter((b) => this.isBotLive(b.name || b.id));
      }
      return this.botStatusList;
    },

    activeLivePositionsCount(): number {
      const symbols = new Set<string>();
      for (const b of this.displayBotStatusList) {
        if (b.positions && b.positions.length > 0) {
          for (const p of b.positions) symbols.add(p.symbol);
        } else if (b.position?.symbol) {
          symbols.add(b.position.symbol);
        }
      }
      return symbols.size;
    },

    filteredCoins(): Array<{ symbol: string; tradesCount: number; pnlContribution: number }> {
      const q = this.coinFilterSearch.trim().toUpperCase();
      if (!q) return this.allCoins;
      return this.allCoins.filter((c) => c.symbol.toUpperCase().includes(q));
    },
  },

  watch: {
    isFullScreen(isFullscreen: boolean) {
      if (!uChart) return;
      if (isFullscreen) {
        document.body.style.overflow = "hidden";
        uChart.setSize({ width: window.innerWidth, height: window.innerHeight });
        this.applyLongestScale();
      } else {
        document.body.style.overflow = "";
        uChart.setSize({ width: window.innerWidth, height: this.chartHeight });
        this.applyLongestScale();
      }
    },

    useCommission() {
      this.runWithBusy("RECALCULATING...", () => {
        this.linesData = [];
        this.linesDataTotal = [];
        this.initChart();
      });
    },

    isAbsoluteMode() {
      this.runWithBusy("RECALCULATING...", () => {
        this.linesData = [];
        this.linesDataTotal = [];
        this.initChart();
      });
    },

    leverage() {
      this.runWithBusy(`APPLYING ${this.leverage}x...`, () => {
        this.linesData = [];
        this.linesDataTotal = [];
        this.initChart();
      });
    },

    isLiveServer(val: boolean) {
      if (val) {
        this.isLiveOnly = false;
        this.leverage = 1;
        this.useCommission = true;
        this.isAbsoluteMode = true;
        this.excludedCoins.clear();
      }
      if (uChart) {
        this.runWithBusy("UPDATING CHART...", () => {
          this.linesData = [];
          this.linesDataTotal = [];
          this.initChart();
        });
      }
    },

    tradeDirection() {
      this.runWithBusy("RECALCULATING...", () => {
        this.linesData = [];
        this.linesDataTotal = [];
        this.initChart();
      });
    },
  },

  methods: {
    formatProfit(val: number | string | undefined | null): string {
      if (val == null) return "0.00%";
      const num = typeof val === "number" ? val : parseFloat(String(val));
      if (isNaN(num)) return "0.00%";
      const abs = Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const sign = abs === "0.00" ? "" : num > 0 ? "+" : "-";
      return `${sign}${abs}%`;
    },

    formatUsd(val: number | string | undefined | null): string {
      if (val == null) return "$0.00";
      const num = typeof val === "number" ? val : parseFloat(String(val));
      if (isNaN(num)) return "$0.00";
      return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    setLeverage(lev: number): void {
      if (this.isLiveServer || this.leverage === lev) return;
      this.isBusy = true;
      this.busyLabel = `APPLYING ${lev}x...`;
      this.leverage = lev;
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("crypto_bot_leverage", String(lev));
        }
      } catch (e) {
        console.warn("Could not save leverage to localStorage:", e);
      }
    },

    formatDrawdown(val: number | string | undefined | null): string {
      if (val == null) return "0.00%";
      const num = typeof val === "number" ? val : parseFloat(String(val));
      if (isNaN(num) || num === 0) return "0.00%";
      const abs = Math.abs(num).toFixed(2);
      return `-${abs}%`;
    },

    toggleCoinFilter(): void {
      this.isCoinFilterOpen = !this.isCoinFilterOpen;
    },

    toggleCoin(symbol: string): void {
      if (this.isLiveServer) return;
      if (this.excludedCoins.has(symbol)) {
        this.excludedCoins.delete(symbol);
      } else {
        this.excludedCoins.add(symbol);
      }
      this.saveExcludedCoins();
      this.onCoinFilterChanged();
    },

    selectAllCoins(): void {
      if (this.isLiveServer) return;
      this.excludedCoins.clear();
      this.saveExcludedCoins();
      this.onCoinFilterChanged();
    },

    deselectAllCoins(): void {
      if (this.isLiveServer) return;
      for (const c of this.allCoins) {
        this.excludedCoins.add(c.symbol);
      }
      this.saveExcludedCoins();
      this.onCoinFilterChanged();
    },

    saveExcludedCoins(): void {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(
            "crypto_bot_excluded_coins",
            JSON.stringify([...this.excludedCoins])
          );
        }
      } catch (e) {
        console.warn("Could not save excluded coins to localStorage:", e);
      }
    },

    runWithBusy(label: string, fn: () => void | Promise<void>): void {
      this.isBusy = true;
      this.busyLabel = label;
      const seq = ((this as any).__busySeq = ((this as any).__busySeq || 0) + 1);
      if (typeof window === "undefined") {
        Promise.resolve(fn()).finally(() => {
          if ((this as any).__busySeq === seq) {
            this.isBusy = false;
            this.busyLabel = "";
          }
        });
        return;
      }
      // Wait for Vue DOM commit + 2 animation frames so the browser actually paints
      // the loading overlay BEFORE synchronous chart recalculation blocks the main thread.
      this.$nextTick(() => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            window.setTimeout(async () => {
              if ((this as any).__busySeq !== seq) return;
              try {
                await fn();
              } finally {
                if ((this as any).__busySeq === seq) {
                  this.isBusy = false;
                  this.busyLabel = "";
                }
              }
            }, 0);
          });
        });
      });
    },

    onCoinFilterChanged(): void {
      this.runWithBusy("FILTERING COINS...", () => {
        this.linesData = [];
        this.linesDataTotal = [];
        this.initChart();
      });
    },

    getBotMaxDrawdown(index: number): number {
      const _isAbs = this.isAbsoluteMode;
      const _comm = this.useCommission;

      const series = this.linesData[index];
      if (!series || series.length === 0) return 0;

      let peak = 100;
      let maxDd = 0;
      for (let i = 0; i < series.length; i++) {
        const bal = 100 + (series[i]?.value || 0);
        if (bal > peak) {
          peak = bal;
        }
        const dd = peak > 0 ? ((bal - peak) / peak) * 100 : 0;
        if (dd < maxDd) {
          maxDd = dd;
        }
      }

      return Number(maxDd.toFixed(2));
    },

    setCalcMode(isAbsolute: boolean): void {
      if (this.isLiveServer || this.isAbsoluteMode === isAbsolute) return;
      this.isBusy = true;
      this.busyLabel = "RECALCULATING...";
      this.isAbsoluteMode = isAbsolute;
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(
            "crypto_bot_calc_mode",
            this.isAbsoluteMode ? "dollar" : "percent"
          );
        }
      } catch (e) {
        console.warn("Could not save calc mode to localStorage:", e);
      }
    },

    toggleCalcMode(): void {
      this.setCalcMode(!this.isAbsoluteMode);
    },

    isLineLive(line: ILine): boolean {
      if (this.isLiveServer) return true;
      if (!line || !line.data || !line.data.length) return false;
      return line.data.some((row) => {
        const trade = row[4]?.trim();
        const token = row[2]?.trim();
        return trade === "LIVE_START" || token === "LIVE_START";
      });
    },

    isBotLive(botName: string): boolean {
      if (!botName) return false;
      const clean = this.normalizeBotName(botName);
      const line = this.lines.find(
        (l) =>
          this.normalizeBotName(l.name || "") === clean ||
          this.normalizeBotName(l.fileName || "") === clean
      );
      if (line) return this.isLineLive(line);
      const bot = this.botStatusList.find(
        (b) =>
          this.normalizeBotName(b.name || "") === clean ||
          this.normalizeBotName(b.id || "") === clean
      );
      return (bot as any)?.isLive ?? false;
    },

    getLegendValue(index: number): string {
      const m = this.botWindowMetrics[index];
      if (m) return this.formatProfit(m.pnl);
      const lineData = this.linesData[index] || [];
      const lineValue = lineData[lineData.length - 1]?.value;
      return this.formatProfit(lineValue);
    },

    //// Init chart (uPlot high-performance Canvas engine)
    buildUPlotAlignedData(): uPlot.AlignedData {
      const timeSet = new Set<number>();
      if (this.linesDataTotal && this.linesDataTotal.length) {
        for (const p of this.linesDataTotal) timeSet.add(p.time);
      }
      for (const s of this.linesData) {
        if (!s || !s.length) continue;
        for (const p of s) timeSet.add(p.time);
      }
      const xArr = Array.from(timeSet).sort((a, b) => a - b);
      if (xArr.length === 0) {
        const now = Math.floor(Date.now() / 1000);
        const empty: (number | null)[][] = [[now - 60, now], [0, 0]];
        for (let i = 0; i < this.lines.length; i++) empty.push([null, null]);
        return empty as uPlot.AlignedData;
      }

      const alignSeries = (series: ISeries[] | undefined): (number | null)[] => {
        const out: (number | null)[] = new Array(xArr.length).fill(null);
        if (!series || series.length === 0) return out;
        let p = 0;
        const n = series.length;
        for (let i = 0; i < xArr.length; i++) {
          const t = xArr[i];
          while (p < n && series[p].time < t) p++;
          if (p < n && series[p].time === t) {
            // If multiple consecutive entries share the same timestamp, take the latest value
            while (p + 1 < n && series[p + 1].time === t) p++;
            out[i] = series[p].value;
          }
        }
        return out;
      };

      const aligned: (number | null)[][] = [xArr, alignSeries(this.linesDataTotal)];
      for (let i = 0; i < this.lines.length; i++) {
        aligned.push(alignSeries(this.linesData[i]));
      }
      return aligned as uPlot.AlignedData;
    },

    isBotLineVisible(index: number): boolean {
      const line = this.lines[index];
      if (!line) return false;
      const isLiveBot = this.isLineLive(line);
      return (!this.isLiveOnly || isLiveBot) && !this.hasLineTotalOnly && !line.disabled;
    },

    isTotalLineShown(): boolean {
      return this.isLineTotalVisible && this.linesEnabled.length !== 1;
    },

    async initChart(): Promise<void> {
      if (!this.lines.length && this.serverLines?.length) {
        this.convertServerDataToLines({ isUpdate: false });
      }

      // Pre-detect liveStartTime across all loaded lines
      if (!this.liveStartTime) {
        for (const line of this.lines) {
          if (!line.data) continue;
          for (const row of line.data) {
            const cleanTrade = row[4]?.trim() || "";
            const cleanToken = row[2]?.trim() || "";
            if (cleanTrade === "LIVE_START" || cleanToken === "LIVE_START") {
              const tSec = Math.floor(Date.parse(row[1]?.trim()) / 1000);
              if (!isNaN(tSec)) {
                this.liveStartTime = tSec;
                break;
              }
            }
          }
          if (this.liveStartTime) break;
        }
      }

      const chartContainer = document.getElementById("chart-container");
      if (!chartContainer) {
        console.error("chartContainer element not found");
        return;
      }

      if (uChart) {
        uChart.destroy();
        uChart = null;
      }
      chartContainer.innerHTML = "";
      uArrows = [];
      this.markedLineIndex = -1;
      this.isLineMarked = false;

      // Prepare per-bot and portfolio total series (markRaw avoids Vue Proxy overhead on ~100k points!)
      const nextLinesData: ISeries[][] = [];
      for (const line of this.lines) {
        nextLinesData.push(markRaw(this.prepareSeriesData(line.data)));
      }
      this.linesData = nextLinesData;
      this.linesDataTotal = markRaw(this.isTotalLineShown() ? this.prepareSeriesDataTotal() : []);

      uDividerTime = !this.isLiveServer && this.liveStartTime ? this.liveStartTime : null;
      uAlignedData = this.buildUPlotAlignedData();

      const self = this;
      let zoomDebounceTimer: ReturnType<typeof setTimeout> | null = null;
      let annotationTimer: ReturnType<typeof setTimeout> | null = null;
      let lastRenderedKey = "";

      const hideAnnotation = () => {
        if (annotationTimer) {
          clearTimeout(annotationTimer);
          annotationTimer = null;
        }
        lastRenderedKey = "";
        const annotation = document.querySelector(".annotation") as HTMLElement | null;
        if (annotation) annotation.style.display = "none";
      };

      // Plugin 1: LIVE dashed divider + trade BUY/SELL arrows + right-axis last-value pills
      const drawOverlaysPlugin = (): uPlot.Plugin => ({
        hooks: {
          draw: [
            (u: uPlot) => {
              const ctx = u.ctx;
              const dpr = window.devicePixelRatio || 1;
              const { left, top, width, height } = u.bbox;

              ctx.save();
              ctx.beginPath();
              ctx.rect(left, top, width, height);
              ctx.clip();

              // 1. Golden dashed LIVE TRADING vertical divider
              if (uDividerTime !== null && !self.isLiveServer) {
                const xCss = u.valToPos(uDividerTime, "x", false);
                if (Number.isFinite(xCss)) {
                  const xPx = left + xCss * dpr;
                  if (xPx >= left - 4 && xPx <= left + width + 4) {
                    ctx.save();
                    ctx.strokeStyle = "rgba(234, 179, 8, 0.95)";
                    ctx.lineWidth = 2 * dpr;
                    ctx.setLineDash([6 * dpr, 4 * dpr]);
                    ctx.beginPath();
                    ctx.moveTo(xPx, top);
                    ctx.lineTo(xPx, top + height);
                    ctx.stroke();
                    ctx.restore();
                  }
                }
              }

              // 2. Trade open (outline) & close (filled) arrows when zoomed in
              if (uArrows.length > 0) {
                const xMin = u.scales.x.min ?? -Infinity;
                const xMax = u.scales.x.max ?? Infinity;
                const w = 11 * dpr;
                const h = 14 * dpr;
                const gap = 7 * dpr;
                ctx.lineWidth = 1.5 * dpr;
                for (let i = 0; i < uArrows.length; i++) {
                  const a = uArrows[i];
                  if (a.time < xMin || a.time > xMax) continue;
                  const xCss = u.valToPos(a.time, "x", false);
                  const yCss = u.valToPos(a.value, "y", false);
                  if (!Number.isFinite(xCss) || !Number.isFinite(yCss)) continue;
                  const x = left + xCss * dpr;
                  const y = top + yCss * dpr;
                  const tip = a.up ? y + gap : y - gap;
                  const dir = a.up ? 1 : -1;
                  const head = tip + dir * h * 0.5;
                  const base = tip + dir * h;
                  ctx.beginPath();
                  ctx.moveTo(x, tip);
                  ctx.lineTo(x + w / 2, head);
                  ctx.lineTo(x + w * 0.18, head);
                  ctx.lineTo(x + w * 0.18, base);
                  ctx.lineTo(x - w * 0.18, base);
                  ctx.lineTo(x - w * 0.18, head);
                  ctx.lineTo(x - w / 2, head);
                  ctx.closePath();
                  if (a.filled) {
                    ctx.fillStyle = a.color;
                    ctx.fill();
                  } else {
                    ctx.strokeStyle = a.color;
                    ctx.stroke();
                  }
                }
              }

              ctx.restore();

              // 3. Clean colored last-value pill on the right axis for visible series
              ctx.save();
              ctx.font = `bold ${11 * dpr}px Arial`;
              ctx.textBaseline = "middle";
              ctx.textAlign = "left";
              for (let sIdx = 1; sIdx < u.series.length; sIdx++) {
                const ser = u.series[sIdx];
                if (!ser.show) continue;
                const arr = u.data[sIdx];
                if (!arr || !arr.length) continue;
                let lastVal: number | null = null;
                for (let k = arr.length - 1; k >= 0; k--) {
                  if (arr[k] != null) {
                    lastVal = arr[k] as number;
                    break;
                  }
                }
                if (lastVal === null) continue;
                const yCss = u.valToPos(lastVal, "y", false);
                if (!Number.isFinite(yCss)) continue;
                const yPx = top + yCss * dpr;
                if (yPx < top || yPx > top + height) continue;
                const text = self.formatProfit(lastVal);
                const bg = typeof ser.stroke === "string" ? ser.stroke : "dimgray";
                const padX = 5 * dpr;
                const pillH = 16 * dpr;
                const pillW = Math.min(72 * dpr, ctx.measureText(text).width + padX * 2);
                const xPill = left + width + 2 * dpr;
                ctx.fillStyle = bg;
                ctx.fillRect(xPill, yPx - pillH / 2, pillW, pillH);
                ctx.fillStyle = "#ffffff";
                ctx.fillText(text, xPill + padX, yPx);
              }
              ctx.restore();
            },
          ],
        },
      });

      // Plugin 2: TradingView-style smooth drag-pan + wheel zoom + 2-way scrubber sync
      const panWheelZoomPlugin = (): uPlot.Plugin => ({
        hooks: {
          ready: [
            (u: uPlot) => {
              const over = u.over;
              if (!over) return;

              // Left-button mouse/touch horizontal drag pan
              let panActive = false;
              let panStartX = 0;
              let panInitMin = 0;
              let panInitMax = 0;

              const onPanMove = (e: PointerEvent) => {
                if (!panActive) return;
                const { min: fullMin, max: fullMax, span } = self.timelineBounds;
                if (span <= 0) return;
                const rect = over.getBoundingClientRect();
                if (rect.width <= 0) return;
                const dx = e.clientX - panStartX;
                const dur = panInitMax - panInitMin;
                const dt = -(dx / rect.width) * dur;
                let nMin = panInitMin + dt;
                let nMax = panInitMax + dt;
                if (nMin < fullMin) { nMin = fullMin; nMax = Math.min(fullMax, fullMin + dur); }
                if (nMax > fullMax) { nMax = fullMax; nMin = Math.max(fullMin, fullMax - dur); }
                self.applyTimelineRange(nMin, nMax, true);
              };

              const onPanUp = () => {
                if (!panActive) return;
                panActive = false;
                self.isScrubbingTimeline = false;
                self.commitPendingTimelineToVue();
                window.removeEventListener("pointermove", onPanMove);
                window.removeEventListener("pointerup", onPanUp);
                window.removeEventListener("pointercancel", onPanUp);
              };

              over.addEventListener("pointerdown", (e: PointerEvent) => {
                if (e.button !== 0) return;
                const scMin = u.scales.x.min;
                const scMax = u.scales.x.max;
                if (scMin == null || scMax == null) return;
                panActive = true;
                self.isScrubbingTimeline = true;
                panStartX = e.clientX;
                panInitMin = scMin;
                panInitMax = scMax;
                hideAnnotation();
                window.addEventListener("pointermove", onPanMove);
                window.addEventListener("pointerup", onPanUp);
                window.addEventListener("pointercancel", onPanUp);
              });

              // Wheel zoom anchored at cursor X (auto-scales Y in ~1ms)
              over.addEventListener(
                "wheel",
                (e: WheelEvent) => {
                  e.preventDefault();
                  const { min: fullMin, max: fullMax, span } = self.timelineBounds;
                  if (span <= 0) return;
                  const scMin = u.scales.x.min ?? fullMin;
                  const scMax = u.scales.x.max ?? fullMax;
                  const curSpan = scMax - scMin;
                  const rect = over.getBoundingClientRect();
                  const leftPct = rect.width > 0 ? Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) : 0.5;
                  const xAnchor = scMin + leftPct * curSpan;
                  const factor = e.deltaY < 0 ? 0.8 : 1.25;
                  const minSpan = Math.min(span, 3 * 86400);
                  const newSpan = Math.max(minSpan, Math.min(span, curSpan * factor));
                  let nMin = xAnchor - leftPct * newSpan;
                  let nMax = nMin + newSpan;
                  if (nMin < fullMin) { nMin = fullMin; nMax = Math.min(fullMax, fullMin + newSpan); }
                  if (nMax > fullMax) { nMax = fullMax; nMin = Math.max(fullMin, fullMax - newSpan); }
                  hideAnnotation();
                  u.setScale("x", { min: nMin, max: nMax });
                },
                { passive: false }
              );

              over.addEventListener("mouseleave", hideAnnotation);
            },
          ],
          setScale: [
            (u: uPlot, scaleKey: string) => {
              if (scaleKey !== "x" || self.isMonitorView) return;
              const fromSec = u.scales.x.min;
              const toSec = u.scales.x.max;
              if (fromSec == null || toSec == null) return;
              if (!self.isScrubbingTimeline) {
                const { min, max, span } = self.timelineBounds;
                if (span > 0) {
                  self.winFrom = Math.max(min, Math.min(max, fromSec));
                  self.winTo = Math.max(self.winFrom, Math.min(max, toSec));
                  if (self.winTo - self.winFrom >= span * 0.985) {
                    self.activeWindowPreset = "ALL";
                  } else {
                    const matched = self.windowPresets.find(
                      (p) => p.days > 0 && Math.abs((self.winTo - self.winFrom) - p.days * 86400) < 4 * 86400
                    );
                    self.activeWindowPreset = matched ? matched.key : "";
                  }
                }
              }
              if (zoomDebounceTimer) clearTimeout(zoomDebounceTimer);
              zoomDebounceTimer = setTimeout(() => {
                self.refreshMarks();
              }, 90);
            },
          ],
        },
      });

      // Plugin 3: Hover trade annotation tooltip (320ms delay + ±14px magnetic snap to real trades)
      const hoverAnnotationPlugin = (): uPlot.Plugin => ({
        hooks: {
          setCursor: [
            (u: uPlot) => {
              const annotation = document.querySelector(".annotation") as HTMLElement | null;
              const annotationBody = document.querySelector(".annotation--body") as HTMLElement | null;
              if (!annotation || !annotationBody) return;

              if (annotationTimer) {
                clearTimeout(annotationTimer);
                annotationTimer = null;
              }
              annotation.style.display = "none";

              const left = u.cursor.left;
              const top = u.cursor.top;
              const plotW = u.over?.clientWidth || u.width;
              const plotH = u.over?.clientHeight || u.height;
              if (
                left == null ||
                top == null ||
                left < 0 ||
                top < 0 ||
                left > plotW ||
                top > plotH ||
                self.isScrubbingTimeline
              ) {
                lastRenderedKey = "";
                return;
              }

              const cursorTime = u.posToVal(left, "x");
              if (!Number.isFinite(cursorTime)) return;

              const pointX = left;
              const pointY = top;
              const chartW = chartContainer.clientWidth || window.innerWidth || 1200;

              annotationTimer = setTimeout(() => {
                if (!uChart) return;

                const snapToAnchor = (seriesList: ISeries[], targetTime: number): ISeries | null => {
                  if (!seriesList || seriesList.length === 0) return null;
                  const { all, trades } = getAnchorLists(seriesList);
                  if (all.length === 0) return null;
                  const nearestTrade = findNearestByTime(trades, targetTime);
                  if (nearestTrade) {
                    const tradeX = uChart.valToPos(nearestTrade.time, "x", false);
                    if (Number.isFinite(tradeX) && Math.abs(tradeX - pointX) <= 14) {
                      return nearestTrade;
                    }
                  }
                  return findNearestByTime(all, targetTime);
                };

                type AnnRow = {
                  side: "LONG" | "SHORT" | "HOLD" | "LIVE" | "";
                  label: string;
                  token: string;
                  price: string;
                };
                const rows: AnnRow[] = [];
                let color = "#1e293b";
                let snappedKey = "";

                const pushTradeRows = (
                  line: ISeries,
                  seriesList: ISeries[],
                  defaultHeader: string,
                  lineColor: string
                ) => {
                  if (line.trade === "BUY" || line.trade === "SELL") {
                    const state = getTradeStates(seriesList).get(line);
                    const side: "LONG" | "SHORT" =
                      state?.side === "LONG" || state?.side === "SHORT"
                        ? state.side
                        : line.trade === "BUY"
                        ? "LONG"
                        : "SHORT";
                    const action = state ? (state.isOpen ? " OPEN" : " CLOSE") : "";
                    rows.push({
                      side,
                      label: `${side}${action}`,
                      token: line.tokenName || "",
                      price: formatTradePrice(line.price),
                    });
                    for (const p of state?.held ?? []) {
                      const pSide: "LONG" | "SHORT" = p.side === "LONG" ? "LONG" : "SHORT";
                      rows.push({
                        side: pSide,
                        label: pSide,
                        token: p.token,
                        price: formatTradePrice(p.price),
                      });
                    }
                    color = lineColor;
                  } else if (line.trade === "LIVE_START") {
                    rows.push({ side: "LIVE", label: "LIVE", token: "LIVE TRADING START", price: "Real execution" });
                    color = "#b45309";
                  } else if (line.trade === "HOLD") {
                    const state = getTradeStates(seriesList).get(line);
                    const pnl = Number(line.profitPercent) || 0;
                    const pnlStr = `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%`;
                    const headerLabel = line.tokenName ? `${line.tokenName} (Mark-to-Market)` : defaultHeader;
                    rows.push({ side: "HOLD", label: "HOLD", token: headerLabel, price: pnlStr });
                    for (const p of state?.held ?? []) {
                      const pSide: "LONG" | "SHORT" = p.side === "LONG" ? "LONG" : "SHORT";
                      rows.push({
                        side: pSide,
                        label: pSide,
                        token: p.token,
                        price: formatTradePrice(p.price),
                      });
                    }
                    color = lineColor;
                  }
                };

                let bestCandidate: {
                  idx: number;
                  item: ISeries;
                  seriesList: ISeries[];
                  lineColor: string;
                  distSq: number;
                } | null = null;

                if (!self.hasLineTotalOnly) {
                  self.lines.forEach((lineObj, index) => {
                    if (!lineObj || lineObj.disabled) return;
                    if (self.isLiveOnly && !self.isLineLive(lineObj)) return;
                    const seriesList = self.linesData[index];
                    if (!seriesList || seriesList.length === 0) return;
                    const snapped = snapToAnchor(seriesList, cursorTime);
                    if (!snapped) return;
                    const sx = uChart!.valToPos(snapped.time, "x", false);
                    const sy = uChart!.valToPos(snapped.value, "y", false);
                    const dx = Number.isFinite(sx) ? sx - pointX : 0;
                    const dy = Number.isFinite(sy) ? sy - pointY : 0;
                    const distSq = dx * dx + dy * dy;
                    if (!bestCandidate || distSq < bestCandidate.distSq) {
                      bestCandidate = {
                        idx: index,
                        item: snapped,
                        seriesList,
                        lineColor: lineObj.color || "#1e293b",
                        distSq,
                      };
                    }
                  });
                }

                if (bestCandidate) {
                  const c = bestCandidate as {
                    idx: number;
                    item: ISeries;
                    seriesList: ISeries[];
                    lineColor: string;
                  };
                  snappedKey = `line:${c.idx}:${c.item.time}:${c.item.trade}:${c.item.count}`;
                  pushTradeRows(c.item, c.seriesList, "HOLD (Mark-to-Market)", c.lineColor);
                } else if (self.isTotalLineShown()) {
                  const activeIdx = self.lines.findIndex(
                    (l) => !l.disabled && (!self.isLiveOnly || self.isLineLive(l))
                  );
                  const primaryList = self.linesData[activeIdx >= 0 ? activeIdx : 0];
                  const snapped = primaryList ? snapToAnchor(primaryList, cursorTime) : null;
                  if (snapped) {
                    snappedKey = `total:${snapped.time}:${snapped.trade}:${snapped.count}`;
                    pushTradeRows(
                      snapped,
                      primaryList,
                      "PORTFOLIO (Mark-to-Market)",
                      totalLineColor || "#3b82f6"
                    );
                  }
                }

                if (rows.length > 0) {
                  if (snappedKey !== lastRenderedKey) {
                    lastRenderedKey = snappedKey;
                    const esc = (s: string) =>
                      String(s)
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;");
                    annotationBody.innerHTML = rows
                      .map((r) => {
                        const sideClass =
                          r.side === "LONG"
                            ? "ann-side--long"
                            : r.side === "SHORT"
                            ? "ann-side--short"
                            : "ann-side--meta";
                        return `<tr><td class="ann-side ${sideClass}">${esc(r.label)}</td><td class="ann-token" style="background:${color}">${esc(r.token)}</td><td class="ann-price" style="background:${color}">${esc(r.price)}</td></tr>`;
                      })
                      .join("");
                  }

                  const isCursorOnRight = pointX > chartW / 2;
                  if (isCursorOnRight) {
                    annotation.style.right = "auto";
                    annotation.style.left = "12px";
                    annotation.style.top = "50px";
                  } else {
                    annotation.style.left = "auto";
                    annotation.style.right = "84px";
                    annotation.style.top = "50px";
                  }
                  annotation.style.display = "block";
                } else {
                  annotation.style.display = "none";
                }
              }, 320);
            },
          ],
        },
      });

      const uSeries: uPlot.Series[] = [
        {},
        {
          label: "PORTFOLIO",
          stroke: totalLineColor,
          width: this.lineWidth,
          show: this.isTotalLineShown(),
          spanGaps: true,
          points: { show: false },
        },
      ];
      for (let i = 0; i < this.lines.length; i++) {
        uSeries.push({
          label: this.lines[i].name,
          stroke: this.lines[i].color,
          width: this.lineWidth,
          show: this.isBotLineVisible(i),
          spanGaps: true,
          points: { show: false },
        });
      }

      const opts: uPlot.Options = {
        width: chartContainer.clientWidth || window.innerWidth,
        height: this.chartHeight,
        legend: { show: false },
        select: { show: false, left: 0, top: 0, width: 0, height: 0 },
        cursor: {
          drag: { x: false, y: false },
          points: { show: false },
          x: true,
          y: true,
        },
        padding: [16, 4, 4, 8],
        scales: {
          x: { time: true },
          y: {
            auto: true,
            range: (_u, dataMin, dataMax) => {
              if (
                dataMin == null ||
                dataMax == null ||
                !Number.isFinite(dataMin) ||
                !Number.isFinite(dataMax)
              ) {
                return [-0.5, 0.5];
              }
              if (Math.abs(dataMax - dataMin) < 0.0001) {
                const d = Math.abs(dataMin) > 0.01 ? Math.abs(dataMin) * 0.15 : 0.25;
                return [dataMin - d, dataMax + d];
              }
              const spanY = dataMax - dataMin;
              return [dataMin - spanY * 0.08, dataMax + spanY * 0.18];
            },
          },
        },
        axes: [
          {
            side: 2,
            size: 44,
            gap: 4,
            font: "12px Arial",
            stroke: "dimgray",
            grid: { stroke: "rgba(105, 105, 105, 0.12)", width: 1 },
            ticks: { show: false },
          },
          {
            side: 1,
            size: 78,
            font: "12px Arial",
            stroke: "dimgray",
            grid: { stroke: "rgba(105, 105, 105, 0.12)", width: 1 },
            ticks: { show: false },
            values: (_u, vals) => vals.map((v) => (v == null ? "" : self.formatProfit(v))),
          },
        ],
        series: uSeries,
        plugins: [drawOverlaysPlugin(), panWheelZoomPlugin(), hoverAnnotationPlugin()],
      };

      uChart = new uPlot(opts, uAlignedData, chartContainer);
      this.applyLongestScale();
      this.clearMarks();
      setTimeout(() => this.refreshMarks(), 120);
    },

    attachVerticalDivider(): void {
      uDividerTime = !this.isLiveServer && this.liveStartTime ? this.liveStartTime : null;
      uChart?.redraw(false);
    },

    getGlobalTimeInfo(): { step: number; startTime: number } {
      let minTime = Infinity;
      const nowSec = Math.floor(Date.now() / 1000);

      if (this.isLiveOnly && this.liveStartTime) {
        minTime = this.liveStartTime;
      } else {
        for (const line of this.lines) {
          if (!line.data || !line.data.length) continue;
          for (const row of line.data) {
            const dateStr = row[1];
            if (dateStr) {
              const t = Math.floor(Date.parse(dateStr) / 1000);
              if (!isNaN(t) && t < minTime) {
                minTime = t;
              }
            }
          }
        }
      }

      const effectiveMin = minTime < Infinity ? minTime : nowSec - 1800;
      const spanSec = Math.max(1, nowSec - effectiveMin);

      let step = 60; // 1 min default
      if (spanSec > 30 * 86400) {
        step = 3600; // 1 hour for > 30 days
      } else if (spanSec > 7 * 86400) {
        step = 900; // 15 mins for > 7 days
      } else if (spanSec > 2 * 86400) {
        step = 300; // 5 mins for > 2 days
      }

      const startTime = Math.floor(effectiveMin / step) * step;

      return { step, startTime };
    },

    //// Prepare line series
    prepareSeriesData(lineData: string[][]): ISeries[] {
      // Deduplicate rows by (count, dateString) to prevent duplicate trades/ticks
      const seenRowKeys = new Set<string>();
      const dedupedData: string[][] = [];
      for (const row of lineData) {
        if (!row || row.length < 2) continue;
        const count = row[0]?.trim();
        const dateStr = row[1]?.trim();
        const key = count && count !== "Count" ? `${count}_${dateStr}` : dateStr;
        if (key && seenRowKeys.has(key)) continue;
        if (key) seenRowKeys.add(key);
        dedupedData.push(row);
      }

      // Detect liveStartTime and liveStartIdx
      let liveStartIdx = -1;
      let hasExplicitLiveStart = false;
      for (let i = 0; i < dedupedData.length; i++) {
        const row = dedupedData[i];
        const cleanTrade = row[4]?.trim() || "";
        const cleanToken = row[2]?.trim() || "";
        if (cleanTrade === "LIVE_START" || cleanToken === "LIVE_START") {
          liveStartIdx = i;
          hasExplicitLiveStart = true;
          const tSec = Math.floor(Date.parse(row[1]?.trim()) / 1000);
          if (!isNaN(tSec)) {
            this.liveStartTime = tSec;
          }
          break;
        }
      }

      // If LIVE ONLY mode and line is pure backtest (no LIVE_START), hide data completely
      if (!this.isLiveServer && this.isLiveOnly && !hasExplicitLiveStart) {
        return [];
      }

      if (liveStartIdx === -1 && this.liveStartTime) {
        for (let i = 0; i < dedupedData.length; i++) {
          const tSec = Math.floor(Date.parse(dedupedData[i][1]?.trim()) / 1000);
          if (!isNaN(tSec) && tSec >= this.liveStartTime) {
            liveStartIdx = i;
            break;
          }
        }
      }

      let workingData = dedupedData;
      let liveBaseProfit = 0;
      if (this.isLiveOnly && liveStartIdx >= 0) {
        liveBaseProfit = parseFloat(dedupedData[liveStartIdx][8]) || 0;
        workingData = dedupedData.slice(liveStartIdx);
      }

      const hasHoldRows = workingData.some((r) => r[4]?.trim() === "HOLD");
      const hasExcluded = !this.isLiveServer && this.excludedCoins && this.excludedCoins.size > 0;

      let cumExcludedPnl = 0;
      let runningCumulativeProfit = 0;

      const tradeArray: Array<{
        dateString: string;
        trade: string;
        tradePrice: number;
        commission: number;
        profitPercent: number;
        profitTotalPercent: number;
        tokenName: string;
        count: string;
        priceChangePercent: string;
      }> = [];

      for (const row of workingData) {
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

        if (!dateString || isNaN(Date.parse(dateString))) continue;

        const cleanTrade = trade ? trade.trim() : "";
        const cleanToken = tokenName ? tokenName.trim() : "";
        const sym = cleanToken.split(/\s+/)[0];

        if (cleanTrade === "LIVE_START" || cleanToken === "LIVE_START") {
          const tSec = Math.floor(Date.parse(dateString) / 1000);
          if (!isNaN(tSec)) {
            this.liveStartTime = tSec;
          }
          tradeArray.push({
            dateString,
            trade: "LIVE_START",
            tradePrice: 0,
            commission: 0,
            profitPercent: 0,
            profitTotalPercent: this.isLiveOnly
              ? 0
              : isNaN(parseFloat(profitTotalPercent))
              ? 0
              : parseFloat(profitTotalPercent),
            tokenName: "LIVE TRADING START",
            count,
            priceChangePercent: "0",
          });
          continue;
        }
        const isExcluded = hasExcluded && sym && this.excludedCoins.has(sym);

        const parsedPrice = parseFloat(tradePrice);
        const parsedCommission = parseFloat(commission);
        const parsedProfitPercent = parseFloat(profitPercent);
        let parsedProfitTotal = parseFloat(profitTotalPercent);

        if (this.isLiveOnly && !isNaN(parsedProfitTotal)) {
          parsedProfitTotal -= liveBaseProfit;
        }

        if (isExcluded && (cleanTrade === "BUY" || cleanTrade === "SELL")) {
          if (hasHoldRows) {
            const res = parseFloat(priceChangePercent);
            if (!isNaN(res) && res !== 0) {
              cumExcludedPnl += res;
            }
          }
          // Omit trade rows of excluded coins from chart markers/anchors
          continue;
        }

        if (hasExcluded) {
          if (hasHoldRows) {
            if (!isNaN(parsedProfitTotal)) {
              parsedProfitTotal -= cumExcludedPnl;
            }
          } else {
            if (!isNaN(parsedProfitPercent)) {
              runningCumulativeProfit += parsedProfitPercent;
              parsedProfitTotal = runningCumulativeProfit;
            }
          }
        }

        tradeArray.push({
          dateString,
          trade: cleanTrade,
          tradePrice: isNaN(parsedPrice) ? 0 : parsedPrice,
          commission: isNaN(parsedCommission) ? 0 : parsedCommission,
          profitPercent: isNaN(parsedProfitPercent) ? 0 : parsedProfitPercent,
          profitTotalPercent: isNaN(parsedProfitTotal) ? 0 : parsedProfitTotal,
          tokenName: cleanToken,
          count,
          priceChangePercent,
        });
      }

      if (!this.useCommission) {
        let cumulativeCommissionPercent = 0;

        tradeArray.forEach((trade) => {
          const legCommissionPercent =
            trade.tradePrice > 0
              ? (Math.abs(trade.commission) / trade.tradePrice) * 100
              : 0;
          cumulativeCommissionPercent += legCommissionPercent;

          trade.profitTotalPercent += cumulativeCommissionPercent;
        });
      }

      let currentBalance = this.initialBotCapital;
      let prevProfitTotalPercent = 0;
      const effLev = this.isLiveServer ? 1 : (this.leverage || 1);

      const mapped = tradeArray.map(
        ({
          dateString,
          trade,
          tradePrice,
          profitPercent,
          profitTotalPercent,
          tokenName,
          count,
          priceChangePercent,
        }) => {
          let value = profitTotalPercent * effLev;
          if (this.isAbsoluteMode) {
            const deltaPercent = (profitTotalPercent - prevProfitTotalPercent) * effLev;
            if (deltaPercent !== 0) {
              currentBalance = Math.max(0, currentBalance * (1 + deltaPercent / 100));
            }
            prevProfitTotalPercent = profitTotalPercent;
            value = currentBalance - this.initialBotCapital;
          }

          return {
            time: Math.floor(Date.parse(dateString) / 1000),
            trade,
            price: tradePrice,
            value,
            profitPercent,
            // equity-curve reports put each trade's own result here (their "Profit %" is 0)
            tradeResult: parseFloat(priceChangePercent) || 0,
            count: parseInt(count, 10) || 0,
            tokenName,
          };
        }
      );

      const { step, startTime: globalStartTime } = this.getGlobalTimeInfo();
      const nowSec = Math.floor(Date.now() / 1000);
      const gridNow = Math.ceil(nowSec / step) * step;

      // Handle empty bot (no trades yet)
      if (mapped.length === 0) {
        const start = Math.min(globalStartTime, gridNow - 1800);
        const seriesData: ISeries[] = [];
        for (let t = start; t <= gridNow; t += step) {
          seriesData.push({
            time: t,
            trade: "HOLD",
            price: 0,
            value: 0,
            tokenName: "",
            count: 0,
            profitPercent: 0,
          });
        }
        return seriesData;
      }

      mapped.sort((a, b) => a.time - b.time);

      // Define anchor trade points
      const anchors = [...mapped];

      // Always extend active open position or completed line horizontally up to current time
      const last = anchors[anchors.length - 1];
      if (gridNow > last.time + 30) {
        anchors.push({
          time: gridNow,
          trade: "HOLD",
          price: last.price,
          value: last.value,
          tokenName: last.tokenName,
          count: 0,
          profitPercent: 0,
        });
      }

      // Map anchor points to the uniform global grid
      const gridAnchors: Array<{ gridTime: number; item: typeof anchors[0] }> = [];
      let prevGrid = -1;
      for (const item of anchors) {
        let g: number;
        if (prevGrid === -1) {
          g = Math.floor(item.time / step) * step;
        } else {
          const target = Math.round(item.time / step) * step;
          g = Math.max(prevGrid + step, target);
        }
        gridAnchors.push({ gridTime: g, item });
        prevGrid = g;
      }

      // Sample along the uniform grid with constant step so:
      // 1. Distance strictly corresponds to real elapsed time (no collapsing).
      // 2. Slopes along segments are mathematically constant (100% straight lines, zero kinks, zero stairs).
      const seriesData: ISeries[] = [];
      for (let i = 0; i < gridAnchors.length; i++) {
        const { gridTime: gCurr, item: itemCurr } = gridAnchors[i];
        if (i === 0) {
          seriesData.push({
            time: gCurr,
            value: itemCurr.value,
            price: itemCurr.price,
            profitPercent: itemCurr.profitPercent,
            tradeResult: itemCurr.tradeResult,
            count: itemCurr.count,
            tokenName: itemCurr.tokenName,
            trade: itemCurr.trade,
          });
        } else {
          const { gridTime: gPrev, item: itemPrev } = gridAnchors[i - 1];
          const nSteps = Math.floor((gCurr - gPrev) / step);
          const valStart = itemPrev.value;
          const valEnd = itemCurr.value;
          const priceStart = itemPrev.price;
          const priceEnd = itemCurr.price;

          for (let k = 1; k <= nSteps; k++) {
            const t = gPrev + k * step;
            const ratio = k / nSteps;
            const v = valStart + (valEnd - valStart) * ratio;
            const p = priceStart + (priceEnd - priceStart) * ratio;
            const isAnchor = k === nSteps;

            seriesData.push({
              time: t,
              value: v,
              price: p,
              profitPercent: isAnchor ? itemCurr.profitPercent : 0,
              tradeResult: isAnchor ? itemCurr.tradeResult : 0,
              count: isAnchor ? itemCurr.count : 0,
              tokenName: isAnchor ? itemCurr.tokenName : itemPrev.tokenName,
              trade: isAnchor ? itemCurr.trade : "",
            });
          }
        }
      }

      return seriesData;
    },

    prepareSeriesDataTotal(): ISeries[] {
      const isAllLinesSelected: boolean =
        this.hasLineTotalOnly || this.hasNoLines;

      const baseLines = this.isLiveOnly
        ? this.lines.filter((l) => this.isLineLive(l))
        : this.lines;

      const lines: ILine[] = isAllLinesSelected
        ? baseLines
        : this.linesEnabled;

      if (!lines.length) {
        this.linesDataTotal = [];
        return [];
      }

      const allPreparedLines: ISeries[][] = [];
      for (const line of lines) {
        const idx = this.lines.indexOf(line);
        let sData = this.linesData[idx];
        if (!sData || !sData.length) {
          sData = this.prepareSeriesData(line.data);
          this.linesData[idx] = sData;
        }
        if (sData && sData.length) {
          allPreparedLines.push(sData);
        }
      }

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

      // Linear interpolation helper to find a series value at any given timestamp
      const getValueAtTime = (series: ISeries[], targetTime: number): number | null => {
        if (!series || !series.length) return null;
        if (targetTime < series[0].time) return null; // Bot hasn't started yet
        if (targetTime >= series[series.length - 1].time) {
          return series[series.length - 1].value;
        }

        // Binary search for the segment [low, high] containing targetTime
        let low = 0;
        let high = series.length - 1;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (series[mid].time === targetTime) {
            return series[mid].value;
          }
          if (series[mid].time < targetTime) {
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }

        const p1 = series[high];
        const p2 = series[high + 1];
        if (!p1 || !p2) return p1?.value ?? p2?.value ?? null;

        const duration = p2.time - p1.time;
        if (duration <= 0) return p1.value;
        const ratio = (targetTime - p1.time) / duration;
        return p1.value + (p2.value - p1.value) * ratio;
      };

      const linesDataTotal: ISeries[] = allTimesData.map((time: number) => {
        let sum = 0;
        let activeCount = 0;
        for (let k = 0; k < allPreparedLines.length; k++) {
          const val = getValueAtTime(allPreparedLines[k], time);
          if (val !== null) {
            sum += val;
            activeCount++;
          }
        }
        const finalValue = activeCount > 0 ? sum / activeCount : 0;

        return {
          time,
          value: finalValue,
        };
      });

      this.linesDataTotal = linesDataTotal;

      return linesDataTotal;
    },

    // Convert / apply server data to lines (supports full reload & incremental delta updates)
    convertServerDataToLines({ isUpdate }: { isUpdate: boolean }): boolean {
      if (!this.serverLines || !this.serverLines.length) return false;

      // 1. Initial load or force reload: populate this.lines completely from server
      if (!this.lines.length || !isUpdate) {
        const lines: ILine[] = this.serverLines.map(
          (file: IServerLine, index: number): ILine => {
            const cleanName = this.normalizeBotName(file.name);
            const existingLine = this.lines.find(
              (l: ILine) => this.normalizeBotName(l.name) === cleanName
            );
            return {
              name: cleanName,
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

      // 2. Incremental update: prune dead/renamed lines that no longer exist on server
      let hasChanges = false;
      const validCleanNames = new Set(
        this.serverLines.map((f: IServerLine) => this.normalizeBotName(f.name))
      );
      if (this.lines.length > 0) {
        const filtered = this.lines.filter((l: ILine) =>
          validCleanNames.has(this.normalizeBotName(l.fileName || l.name))
        );
        if (filtered.length !== this.lines.length) {
          this.lines = filtered;
          hasChanges = true;
        }
      }

      // 3. Deduplicate this.lines by normalized name to guarantee no duplicate legends
      const seenNames = new Set<string>();
      const dedupedLines: ILine[] = [];
      for (const l of this.lines) {
        const norm = this.normalizeBotName(l.fileName || l.name);
        if (!seenNames.has(norm)) {
          seenNames.add(norm);
          dedupedLines.push(l);
        } else {
          hasChanges = true;
        }
      }
      this.lines = dedupedLines;

      // 4. Update or append server lines
      for (const [index, file] of this.serverLines.entries()) {
        const cleanName = this.normalizeBotName(file.name);
        let line = this.lines.find(
          (l: ILine) =>
            this.normalizeBotName(l.fileName || "") === cleanName ||
            this.normalizeBotName(l.name || "") === cleanName
        );

        if (!line) {
          // Dynamic discovery of a newly added bot file
          const newLine: ILine = {
            name: cleanName,
            fileName: file.name,
            mtime: file.mtime,
            data: file.data.map((item: string): string[] => item.split(",")),
            color: this.getColor(this.lines.length),
            disabled: true,
          };
          this.lines.push(newLine);
          hasChanges = true;
          continue;
        }

        // Canonicalize name and fileName to current server file
        line.name = cleanName;
        line.fileName = file.name;
        if (file.mtime) {
          line.mtime = file.mtime;
        }

        if (file.isDelta) {
          // Incremental: only append new rows if any exist
          if (file.data && file.data.length > 0) {
            const existingKeys = new Set(
              line.data.map((r: string[]) => `${r[0]?.trim()}_${r[1]?.trim()}`)
            );
            const newRows = file.data
              .map((item: string): string[] => item.split(","))
              .filter((r: string[]) => {
                const key = `${r[0]?.trim()}_${r[1]?.trim()}`;
                return !existingKeys.has(key);
              });
            if (newRows.length > 0) {
              line.data.push(...newRows);
              hasChanges = true;
            }
          }
        } else {
          // Full replacement for this line (file reset, shrunk or forced reload)
          const allRows = file.data.map((item: string): string[] => item.split(","));
          const seen = new Set<string>();
          const uniqueRows: string[][] = [];
          for (const r of allRows) {
            const key = `${r[0]?.trim()}_${r[1]?.trim()}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueRows.push(r);
            }
          }
          line.data = uniqueRows;
          hasChanges = true;
        }
      }

      return hasChanges;
    },

    openLinesCacheDB(): Promise<IDBDatabase | null> {
      return new Promise((resolve) => {
        if (typeof window === "undefined" || !window.indexedDB) {
          resolve(null);
          return;
        }
        try {
          const req = window.indexedDB.open("dnatrade_chart_cache", 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains("cache")) {
              db.createObjectStore("cache");
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    },

    async loadCachedLines(): Promise<boolean> {
      try {
        if (typeof window === "undefined") return false;
        // Purge legacy 5MB-limited localStorage caches
        if (window.localStorage) {
          for (let v = 1; v <= 9; v++) {
            window.localStorage.removeItem(`crypto_bot_chart_lines_v${v}`);
          }
        }
        const db = await this.openLinesCacheDB();
        if (!db) return false;
        const parsed = await new Promise<any>((resolve) => {
          try {
            const tx = db.transaction("cache", "readonly");
            const store = tx.objectStore("cache");
            const req = store.get("chart_lines_v10");
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });
        db.close();
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed[0].name &&
          Array.isArray(parsed[0].data)
        ) {
          const seen = new Set<string>();
          const validLines: ILine[] = [];
          for (const l of parsed) {
            const norm = this.normalizeBotName(l.fileName || l.name);
            if (!seen.has(norm)) {
              seen.add(norm);
              validLines.push({
                ...l,
                name: norm,
                disabled: true,
              });
            }
          }
          this.lines = validLines;
          return validLines.length > 0;
        }
      } catch (err) {
        console.warn("Could not load lines from IndexedDB cache:", err);
      }
      return false;
    },

    async saveLinesToCache(): Promise<void> {
      try {
        if (typeof window === "undefined") return;
        if (!this.lines || !this.lines.length) return;
        const db = await this.openLinesCacheDB();
        if (!db) return;
        // Unwrap Vue reactive Proxies into plain arrays/objects for IndexedDB structured clone
        const toSave = this.lines.map((l: ILine) => ({
          name: this.normalizeBotName(l.name),
          fileName: l.fileName ? String(l.fileName) : undefined,
          mtime: typeof l.mtime === "number" ? l.mtime : undefined,
          data: Array.isArray(l.data)
            ? l.data.map((row: any) => (Array.isArray(row) ? row.slice() : row))
            : [],
          color: l.color ? String(l.color) : undefined,
          disabled: Boolean(l.disabled),
        }));
        await new Promise<void>((resolve) => {
          try {
            const tx = db.transaction("cache", "readwrite");
            tx.objectStore("cache").put(toSave, "chart_lines_v10");
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
            tx.onabort = () => resolve();
          } catch {
            resolve();
          }
        });
        db.close();
      } catch (err) {
        console.warn("Could not save lines to IndexedDB cache:", err);
      }
    },

    //// Updates
    syncUPlotSeriesVisibility(): void {
      if (!uChart) return;
      uChart.batch(() => {
        uChart!.setSeries(1, { show: this.isTotalLineShown() });
        for (let i = 0; i < this.lines.length; i++) {
          uChart!.setSeries(2 + i, { show: this.isBotLineVisible(i) });
        }
      });
    },

    updateChart(): void {
      if (!uChart || uChart.series.length !== this.lines.length + 2) {
        this.initChart();
        return;
      }
      this.updateLines();
      this.updateLineTotal();
      this.refreshMarks();
    },

    updateLineTotalVisibility(): void {
      if (this.linesEnabled.length === 1) {
        // Exiting solo mode: return to Total Line view
        this.lines.forEach((l) => {
          l.disabled = true;
        });
        this.isLineTotalVisible = true;
        this.syncUPlotSeriesVisibility();
        this.updateLineTotal();
        this.applyLongestScale();
        this.refreshMarks();
        return;
      }

      this.isLineTotalVisible = !this.isLineTotalVisible;
      this.syncUPlotSeriesVisibility();
      this.updateLineTotal();
      this.applyLongestScale();
      this.refreshMarks();
    },

    computeZoomCondition(): boolean {
      if (!uChart || this.linesEnabled.length !== 1) return false;
      const fromSec = uChart.scales.x.min;
      const toSec = uChart.scales.x.max;
      if (fromSec == null || toSec == null) return false;
      const durationSec = toSec - fromSec;
      // ~90 days (7,776,000s): optimal threshold for displaying trade markers without clutter
      const MAX_ZOOM_SECONDS = 90 * 86400;
      return durationSec > 0 && durationSec <= MAX_ZOOM_SECONDS;
    },

    refreshMarks(): void {
      if (!uChart || this.isMonitorView) return;
      if (this.computeZoomCondition()) {
        this.setMarks();
      } else {
        this.clearMarks();
      }
    },

    getLongestTimeRange(): { from: number; to: number } {
      let minTime = Infinity;
      let maxTime = -Infinity;

      const isAllLines =
        this.hasLineTotalOnly ||
        this.hasNoLines ||
        this.linesEnabled.length === 0;
      const baseLines = this.isLiveOnly
        ? this.lines.filter((l) => this.isLineLive(l))
        : this.lines;
      const targetLines = isAllLines ? baseLines : this.linesEnabled;

      for (const line of targetLines) {
        if (!line?.data || line.data.length === 0) continue;
        const idx = this.lines.indexOf(line);
        const seriesData = this.linesData[idx] || this.prepareSeriesData(line.data);
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

      // If span is tiny (< 30s), give 1-minute window
      if (maxTime - minTime < 30) {
        return { from: minTime - 30, to: maxTime + 30 };
      }

      return {
        from: minTime,
        to: maxTime,
      };
    },

    toggleLiveOnly(): void {
      this.isLiveOnly = !this.isLiveOnly;
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(
            "crypto_bot_live_only",
            this.isLiveOnly ? "true" : "false"
          );
        }
      } catch (e) {
        console.warn("Could not save live only mode to localStorage:", e);
      }
      if (this.isLiveOnly) {
        const soloedNonLive = this.lines.some(
          (l) => !l.disabled && !this.isLineLive(l)
        );
        if (soloedNonLive) {
          this.lines.forEach((l) => {
            l.disabled = true;
          });
          this.isLineTotalVisible = true;
        }
      }
      this.runWithBusy(this.isLiveOnly ? "LOADING LIVE..." : "LOADING FULL CHART...", () => {
        this.linesData = [];
        this.linesDataTotal = [];
        this.updateChart();
        this.$nextTick(() => {
          this.applyLongestScale();
          this.updateLiveBadgePosition();
        });
      });
    },

    updateLiveBadgePosition(): void {
      // Live toggle button is fixed in top-bar-menu
    },

    applyLongestScale(): void {
      if (!uChart || this.isMonitorView) return;
      const range = this.getLongestTimeRange();
      if (range && Number.isFinite(range.from) && Number.isFinite(range.to) && range.to > range.from) {
        this.isScrubbingTimeline = true;
        uChart.setScale("x", { min: range.from, max: range.to });
        this.isScrubbingTimeline = false;
      }
      this.syncTimelineToFull();
      this.refreshMarks();
      this.updateLiveBadgePosition();
    },

    syncTimelineToFull(): void {
      const { min, max, span } = this.timelineBounds;
      if (span <= 0) return;
      this.winFrom = min;
      this.winTo = max;
      this.activeWindowPreset = "ALL";
    },

    computeWindowStatsFast(from: number, to: number): { rangeLabel: string; pnl: number; dd: number } | null {
      const s = this.activePrimarySeries;
      if (!s || s.length < 2) return null;
      const m = calcSeriesWindowMetrics(s, from, to, this.isAbsoluteMode, true);
      const fmtDate = (sec: number, showDay: boolean) => {
        const iso = new Date(sec * 1000).toISOString();
        return showDay ? iso.slice(0, 10) : iso.slice(0, 7);
      };
      const showDay = (to - from) < 120 * 86400;
      return {
        rangeLabel: `${fmtDate(from, showDay)} → ${fmtDate(to, showDay)}`,
        pnl: m.pnl,
        dd: m.dd,
      };
    },

    updateScrubberDomDirect(from: number, to: number): void {
      const { min, span } = this.timelineBounds;
      if (span <= 0) return;
      const winEl = this.$refs.timelineWindow as HTMLElement | undefined;
      if (winEl) {
        const leftPct = ((from - min) / span) * 100;
        const widthPct = Math.max(1.2, ((to - from) / span) * 100);
        winEl.style.left = `${Math.min(100 - widthPct, Math.max(0, leftPct)).toFixed(3)}%`;
        winEl.style.width = `${Math.min(100, widthPct).toFixed(3)}%`;
      }
      const st = this.computeWindowStatsFast(from, to);
      if (st) {
        const dEl = this.$refs.timelineDatesEl as HTMLElement | undefined;
        const pEl = this.$refs.timelinePnlEl as HTMLElement | undefined;
        const ddEl = this.$refs.timelineDdEl as HTMLElement | undefined;
        if (dEl) dEl.textContent = st.rangeLabel;
        if (pEl) {
          pEl.textContent = this.formatProfit(st.pnl);
          pEl.className = `timeline-pnl ${st.pnl >= 0 ? "text-green" : "text-red"}`;
        }
        if (ddEl) ddEl.textContent = this.formatDrawdown(st.dd);

        // Live-update Portfolio summary bar inside the selected window (zero Vue re-render!)
        const portValEl = this.$refs.portfolioValEl as HTMLElement | undefined;
        const portDdEl = this.$refs.portfolioDdEl as HTMLElement | undefined;
        const portDotEl = this.$refs.portfolioDotEl as HTMLElement | undefined;
        if (portValEl) portValEl.textContent = this.formatProfit(st.pnl);
        if (portDdEl) portDdEl.textContent = this.formatDrawdown(st.dd);
        if (portDotEl) {
          portDotEl.className = `round ${st.pnl > 0 ? "round--green" : st.pnl < 0 ? "round--red" : ""}`;
        }
      }

      // Live-update each strategy row in the legend inside the selected window
      const legendEl = this.$refs.legend as HTMLElement | undefined;
      if (legendEl && this.linesData.length > 0) {
        for (let i = 0; i < this.linesData.length; i++) {
          const m = calcSeriesWindowMetrics(this.linesData[i], from, to, this.isAbsoluteMode, true);
          const vEl = legendEl.querySelector(`[data-bot-val="${i}"]`) as HTMLElement | null;
          const dEl = legendEl.querySelector(`[data-bot-dd="${i}"]`) as HTMLElement | null;
          const dotEl = legendEl.querySelector(`[data-bot-dot="${i}"]`) as HTMLElement | null;
          if (vEl) vEl.textContent = this.formatProfit(m.pnl);
          if (dEl) dEl.textContent = this.formatDrawdown(m.dd);
          if (dotEl) {
            dotEl.className = `round ${m.pnl > 0 ? "round--green" : m.pnl < 0 ? "round--red" : ""}`;
          }
        }
      }
    },

    commitPendingTimelineToVue(): void {
      if (uPendingRange) {
        this.winFrom = uPendingRange.from;
        this.winTo = uPendingRange.to;
      } else if (uChart && uChart.scales.x.min != null && uChart.scales.x.max != null) {
        this.winFrom = uChart.scales.x.min;
        this.winTo = uChart.scales.x.max;
      }
    },

    applyTimelineRange(fromSec: number, toSec: number, directOnly = false): void {
      const { min, max, span } = this.timelineBounds;
      if (!uChart || span <= 0) return;
      const minDur = Math.min(span, 3 * 86400);
      let f = Math.max(min, Math.min(max - minDur, fromSec));
      let t = Math.max(f + minDur, Math.min(max, toSec));
      if (t - f < minDur) f = Math.max(min, t - minDur);
      uPendingRange = { from: f, to: t };
      if (!directOnly) {
        this.winFrom = f;
        this.winTo = t;
      }
      if (uScrubRaf !== null) return;
      uScrubRaf = requestAnimationFrame(() => {
        uScrubRaf = null;
        if (!uChart || !uPendingRange) return;
        const { from, to } = uPendingRange;
        // Zero Vue re-renders during drag: direct DOM + 1ms uPlot canvas setScale!
        this.updateScrubberDomDirect(from, to);
        uChart.setScale("x", { min: from, max: to });
      });
    },

    selectWindowPreset(key: string): void {
      const { min, max, span } = this.timelineBounds;
      if (span <= 0) return;
      if (key === "ALL") {
        this.applyLongestScale();
        return;
      }
      const preset = this.windowPresets.find((p) => p.key === key);
      if (!preset || !preset.days) return;
      const dur = preset.days * 86400;
      if (dur >= span) {
        this.applyLongestScale();
        return;
      }
      // Keep right edge where user currently is (or latest bar if currently viewing ALL)
      const anchorRight =
        this.activeWindowPreset === "ALL" || this.winTo <= 0
          ? max
          : Math.max(min + dur, Math.min(max, this.winTo));
      const from = Math.max(min, anchorRight - dur);
      const to = Math.min(max, from + dur);
      this.activeWindowPreset = key;
      this.isScrubbingTimeline = true;
      this.applyTimelineRange(from, to);
      setTimeout(() => {
        this.isScrubbingTimeline = false;
        this.refreshMarks();
      }, 60);
    },

    onTimelineTrackDown(e: PointerEvent): void {
      const track = this.$refs.timelineTrack as HTMLElement | undefined;
      const { min, max, span } = this.timelineBounds;
      if (!track || span <= 0) return;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const clickT = min + ratio * span;
      // If currently showing ALL, open a 1Y (or 30% of span) window centered on click
      const curDur =
        this.winTo > this.winFrom && this.winTo - this.winFrom < span * 0.98
          ? this.winTo - this.winFrom
          : Math.min(365 * 86400, span * 0.35);
      let from = clickT - curDur / 2;
      let to = clickT + curDur / 2;
      if (from < min) { from = min; to = Math.min(max, min + curDur); }
      if (to > max) { to = max; from = Math.max(min, max - curDur); }
      if (this.activeWindowPreset === "ALL") {
        this.activeWindowPreset = Math.abs(curDur - 365 * 86400) < 86400 ? "1Y" : "";
      }
      this.isScrubbingTimeline = true;
      this.applyTimelineRange(from, to);
      this.startTimelineDrag(e, "move");
    },

    startTimelineDrag(e: PointerEvent, mode: "move" | "left" | "right"): void {
      const { min, max, span } = this.timelineBounds;
      if (span <= 0) return;
      e.preventDefault();
      this.timelineDragMode = mode;
      this.isScrubbingTimeline = true;
      this.timelineDragStartX = e.clientX;
      this.timelineDragInitFrom = this.winFrom > 0 ? this.winFrom : min;
      this.timelineDragInitTo = this.winTo > 0 ? this.winTo : max;
      window.addEventListener("pointermove", this.onTimelinePointerMove);
      window.addEventListener("pointerup", this.onTimelinePointerUp);
      window.addEventListener("pointercancel", this.onTimelinePointerUp);
    },

    onTimelinePointerMove(e: PointerEvent): void {
      if (!this.timelineDragMode) return;
      const track = this.$refs.timelineTrack as HTMLElement | undefined;
      const { min, max, span } = this.timelineBounds;
      if (!track || span <= 0) return;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;

      const dx = e.clientX - this.timelineDragStartX;
      const dt = (dx / rect.width) * span;
      const minDur = Math.min(span, 3 * 86400);

      if (this.timelineDragMode === "move") {
        const dur = this.timelineDragInitTo - this.timelineDragInitFrom;
        let from = this.timelineDragInitFrom + dt;
        let to = from + dur;
        if (from < min) { from = min; to = min + dur; }
        if (to > max) { to = max; from = max - dur; }
        this.applyTimelineRange(from, to, true);
      } else if (this.timelineDragMode === "left") {
        const from = Math.max(min, Math.min(this.timelineDragInitTo - minDur, this.timelineDragInitFrom + dt));
        this.activeWindowPreset = "";
        this.applyTimelineRange(from, this.timelineDragInitTo, true);
      } else if (this.timelineDragMode === "right") {
        const to = Math.min(max, Math.max(this.timelineDragInitFrom + minDur, this.timelineDragInitTo + dt));
        this.activeWindowPreset = "";
        this.applyTimelineRange(this.timelineDragInitFrom, to, true);
      }
    },

    onTimelinePointerUp(): void {
      window.removeEventListener("pointermove", this.onTimelinePointerMove);
      window.removeEventListener("pointerup", this.onTimelinePointerUp);
      window.removeEventListener("pointercancel", this.onTimelinePointerUp);
      this.timelineDragMode = null;
      this.commitPendingTimelineToVue();
      const { span } = this.timelineBounds;
      if (span > 0 && this.winTo - this.winFrom >= span * 0.99) {
        this.activeWindowPreset = "ALL";
      }
      setTimeout(() => {
        this.isScrubbingTimeline = false;
        this.refreshMarks();
      }, 40);
    },

    zoomToLine(_line?: ILine): void {
      this.applyLongestScale();
    },

    updateLineVisibility(index: number): void {
      const line = this.lines[index];
      if (!line) return;

      // Fast toggle in-place (< 1ms in uPlot)
      line.disabled = !line.disabled;
      this.syncUPlotSeriesVisibility();
      this.updateLineTotal();
      this.refreshMarks();
    },

    soloLine(index: number): void {
      const line = this.lines[index];
      if (!line) return;

      const isAlreadySolo =
        this.linesEnabled.length === 1 && this.linesEnabled[0] === line;

      if (isAlreadySolo) {
        this.lines.forEach((l) => {
          l.disabled = this.isLiveOnly ? !this.isLineLive(l) : false;
        });
      } else {
        this.lines.forEach((l, i) => {
          l.disabled = i !== index;
        });
      }

      this.syncUPlotSeriesVisibility();
      this.updateLineTotal();
      this.refreshMarks();
      this.applyLongestScale();
    },

    async selectBotChart(botName: string): Promise<void> {
      const clean = this.normalizeBotName(botName);
      const targetIndex = this.lines.findIndex(
        (l) => this.normalizeBotName(l.name || "") === clean ||
               this.normalizeBotName(l.fileName || "") === clean
      );
      if (targetIndex === -1) return;

      const targetLine = this.lines[targetIndex];
      if (this.isLiveOnly && !this.isLineLive(targetLine)) {
        this.isLiveOnly = false;
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem("crypto_bot_live_only", "false");
          }
        } catch (e) {}
      }

      // 1. Switch to Chart View first so DOM starts rendering #chart-container
      this.isMonitorView = false;

      // 2. Solo this line
      this.lines.forEach((l, i) => {
        l.disabled = i !== targetIndex;
      });

      // 3. Ensure chart container is rendered in DOM and has positive dimensions
      await this.$nextTick();

      if (!uChart || uChart.series.length !== this.lines.length + 2) {
        await this.initChart();
      } else {
        this.syncUPlotSeriesVisibility();
        this.updateLineTotal();
        this.refreshMarks();
        this.applyLongestScale();
      }
    },

    updateLines(): void {
      const linesData: ISeries[][] = [];
      for (const line of this.lines) {
        linesData.push(markRaw(this.prepareSeriesData(line.data)));
      }
      this.linesData = linesData;
      this.linesDataTotal = markRaw(this.isTotalLineShown() ? this.prepareSeriesDataTotal() : []);
      if (uChart) {
        const curMin = uChart.scales.x.min;
        const curMax = uChart.scales.x.max;
        const wasAll = this.activeWindowPreset === "ALL";
        uAlignedData = this.buildUPlotAlignedData();
        uChart.setData(uAlignedData, wasAll);
        this.syncUPlotSeriesVisibility();
        if (!wasAll && curMin != null && curMax != null) {
          uChart.setScale("x", { min: curMin, max: curMax });
        }
      }
      this.attachVerticalDivider();
    },

    updateLineTotal(): void {
      const isVisible = this.isTotalLineShown();
      this.linesDataTotal = markRaw(isVisible ? this.prepareSeriesDataTotal() : []);
      if (uChart) {
        const curMin = uChart.scales.x.min;
        const curMax = uChart.scales.x.max;
        const wasAll = this.activeWindowPreset === "ALL";
        uAlignedData = this.buildUPlotAlignedData();
        uChart.setData(uAlignedData, wasAll);
        uChart.setSeries(1, { show: isVisible });
        if (!wasAll && curMin != null && curMax != null) {
          uChart.setScale("x", { min: curMin, max: curMax });
        }
      }
      this.attachVerticalDivider();
    },

    async refreshAllData(): Promise<void> {
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

    setupChartUpdate(): void {
      this.refreshInterval = setInterval(async () => {
        await this.refreshAllData();
      }, 20000);
    },

    //// Listeners
    setupResizeListener(): void {
      if (uResizeHandler) {
        window.removeEventListener("resize", uResizeHandler);
      }
      uResizeHandler = () => {
        if (!uChart || this.isMonitorView) return;
        const container = document.getElementById("chart-container");
        const w = container?.clientWidth || window.innerWidth;
        uChart.setSize({ width: w, height: this.chartHeight });
      };
      window.addEventListener("resize", uResizeHandler);
    },

    // Line marks (drawn directly on uPlot canvas via drawOverlaysPlugin)
    setMarks(): void {
      if (this.linesEnabled.length !== 1) return;
      const line = this.linesEnabled[0];
      const index = this.lines.indexOf(line);
      if (index === -1 || !uChart) return;

      if (this.isLineMarked && this.markedLineIndex === index) {
        return;
      }

      const lineData = this.linesData[index] || this.prepareSeriesData(line.data);
      const openByToken = new Map<string, boolean>();
      const arrows: ITradeArrow[] = [];
      for (const { trade, time, tokenName, profitPercent, tradeResult, value } of lineData) {
        if (trade !== "BUY" && trade !== "SELL") continue;
        const token = tokenName || "";
        const isOpen = !openByToken.get(token);
        openByToken.set(token, isOpen);
        if (isOpen) {
          arrows.push({
            time,
            value,
            up: trade === "BUY",
            color: trade === "BUY" ? "green" : "red",
            filled: false,
          });
        } else {
          arrows.push({
            time,
            value,
            up: trade === "BUY",
            color: (tradeResult || Number(profitPercent) || 0) >= 0 ? "green" : "red",
            filled: true,
          });
        }
      }

      uArrows = arrows;
      this.markedLineIndex = index;
      this.isLineMarked = true;
      uChart.redraw(false);
    },

    clearMarks(): void {
      if (!this.isLineMarked && uArrows.length === 0) return;
      uArrows = [];
      this.markedLineIndex = -1;
      this.isLineMarked = false;
      uChart?.redraw(false);
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
            if (typeof (data.system as any).isLiveServer === "boolean") {
              this.isLiveServer = (data.system as any).isLiveServer;
            }
          }
          if (data?.account) {
            this.accountInfo = data.account;
          }
          if (Array.isArray(data?.bots)) {
            this.botStatusList = data.bots;
          }
        }
      } catch (error) {
        console.warn("Could not fetch bot status:", error);
      }
    },

    normalizeBotName(name: string): string {
      if (!name) return "";
      return name
        .trim()
        .toLowerCase()
        .replace(/\.csv$/i, "")
        .replace(/^trades[-_]/i, "")
        .replace(/^(orderbook|ob|mm|vol)[-_]/i, "");
    },

    getBotPositions(lineName: string): IBotPosition[] {
      if (!lineName || !this.botStatusList) return [];
      const clean = this.normalizeBotName(lineName);
      const found = this.botStatusList.find(
        (b: IBotStatus) =>
          this.normalizeBotName(b.name || "") === clean ||
          this.normalizeBotName(b.id || "") === clean
      );
      if (found?.positions && found.positions.length > 0) {
        return found.positions;
      }
      return found?.position ? [found.position] : [];
    },

    getBotPosition(lineName: string): IBotPosition | null {
      const posList = this.getBotPositions(lineName);
      return posList.length > 0 ? posList[0] : null;
    },

    getBotColor(botName: string): string {
      const clean = this.normalizeBotName(botName);
      const line = this.lines.find(
        (l: ILine) => this.normalizeBotName(l.name || "") === clean
      );
      return line?.color || "#888";
    },

    formatTarget(val: number | string | null | undefined): string {
      if (val == null) return "-";
      const num = typeof val === "number" ? val : parseFloat(val);
      if (isNaN(num)) return "-";
      if (num < 0.001) return num.toFixed(8);
      if (num < 1) return num.toFixed(6);
      return num.toFixed(4);
    },

    formatTime(dateStr: string): string {
      if (!dateStr) return "";
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch {
        return "";
      }
    },

    hideInitialLoader(): void {
      if (typeof document === "undefined") return;
      const el = document.getElementById("initial-dna-loader");
      if (!el || el.classList.contains("is-hidden")) return;
      requestAnimationFrame(() => {
        el.classList.add("is-hidden");
        setTimeout(() => {
          el.remove();
        }, 180);
      });
    },

    formatBotName(name: string): string {
      if (!name) return "";
      const key = name
        .replace(/\.csv$/i, "")
        .replace(/^trades[-_]/i, "")
        .replace(/^(ORDERBOOK|OB|MM|VOL)[-_]/i, "")
        .toLowerCase();
      const labels: Record<string, string> = {
        "trend-mtf-v2": "SUPERTREND + MOMENTUM - LIVE",
        "trend-mtf": "SUPERTREND + MOMENTUM - LIVE",
        "trend-mtf-live": "SUPERTREND + MOMENTUM - LIVE",
        "lsma-mtf": "LINEAR REGRESSION",
        "vrev-mtf": "RANGE REVERSAL",
        "trend-mtf-smartlab": "SMARTLAB TREND",
      };
      return labels[key] || key.replace(/[-_]+/g, " ").toUpperCase();
    },

    getBotDescription(name: string): string {
      if (!name) return "";
      const key = name
        .replace(/\.csv$/i, "")
        .replace(/^trades[-_]/i, "")
        .replace(/^(ORDERBOOK|OB|MM|VOL)[-_]/i, "")
        .toLowerCase();
      const desc: Record<string, string> = {
        "trend-mtf-v2": "SuperTrend (4h/8h/12h/1d) + Cross-Sectional Momentum + Contrarian 14d Sizer",
        "trend-mtf": "SuperTrend (4h/8h/12h/1d) + Cross-Sectional Momentum + Contrarian 14d Sizer",
        "trend-mtf-live": "SuperTrend (4h/8h/12h/1d) + Cross-Sectional Momentum + Contrarian 14d Sizer",
        "lsma-mtf": "Dual Linear Regression 14/50 Crossover (4h/8h/12h/1d)",
        "vrev-mtf": "2-Line Sequential Regression V-Reversal in Range, ADX <= 22 (4h/8h/12h/1d)",
        "trend-mtf-smartlab": "SmartLab Multi-Timeframe Trend",
      };
      return desc[key] || this.formatBotName(name);
    },

    toggleCommission(): void {
      if (this.isLiveServer) return;
      this.isBusy = true;
      this.busyLabel = "RECALCULATING...";
      this.useCommission = !this.useCommission;
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(
            "crypto_bot_use_commission",
            this.useCommission ? "true" : "false"
          );
        }
      } catch (e) {
        console.warn("Could not save commission mode to localStorage:", e);
      }
    },

    getBotPnl(bot: IBotStatus | null | undefined): number {
      const _ = this.isAbsoluteMode;
      if (!bot) return 0;
      const clean = this.normalizeBotName(bot.name || bot.id || "");
      const lineIndex = this.lines.findIndex(
        (l: ILine) => this.normalizeBotName(l.name || "") === clean
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

    toggleMonitorView(): void {
      this.isMonitorView = !this.isMonitorView;
      if (!this.isMonitorView) {
        this.$nextTick(() => {
          this.initChart();
        });
      } else {
        this.refreshAllData();
      }
    },
  },

  //// Life cycle
  async mounted(): Promise<void> {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const savedMode = window.localStorage.getItem("crypto_bot_calc_mode");
        if (savedMode === "dollar") {
          this.isAbsoluteMode = true;
        } else if (savedMode === "percent") {
          this.isAbsoluteMode = false;
        }

        const savedComm = window.localStorage.getItem(
          "crypto_bot_use_commission"
        );
        if (savedComm === "false") {
          this.useCommission = false;
        } else if (savedComm === "true") {
          this.useCommission = true;
        }

        if (this.isLiveServer) {
        this.isLiveOnly = false;
      }
      const savedLiveOnly = window.localStorage.getItem(
          "crypto_bot_live_only"
        );
        if (savedLiveOnly === "false") {
          this.isLiveOnly = false;
        } else if (savedLiveOnly === "true") {
          this.isLiveOnly = true;
        }

        const savedLev = window.localStorage.getItem("crypto_bot_leverage");
        if (savedLev) {
          const parsedLev = Number(savedLev);
          if ([1, 2, 3, 5].includes(parsedLev)) {
            this.leverage = parsedLev;
          }
        }

        const savedCoins = window.localStorage.getItem("crypto_bot_excluded_coins");
        if (savedCoins) {
          try {
            const list = JSON.parse(savedCoins);
            if (Array.isArray(list)) {
              this.excludedCoins = new Set(list);
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn("Could not load settings from localStorage:", e);
    }

    try {
      const hasCache = await this.loadCachedLines();
      if (hasCache) {
        this.isLoading = false;
        await this.$nextTick();
        await this.initChart();
        this.hideInitialLoader();
      }

      await Promise.all([this.fetchData(!hasCache), this.fetchBotStatus()]);

      if (!hasCache) {
        await this.$nextTick();
        await this.initChart();
        this.saveLinesToCache();
        this.hideInitialLoader();
      } else {
        const hasUpdates = this.convertServerDataToLines({ isUpdate: true });
        if (hasUpdates) {
          this.updateChart();
          this.saveLinesToCache();
        }
      }
    } finally {
      this.hideInitialLoader();
    }

    this.setupResizeListener();
    this.setupChartUpdate();
  },

  unmounted(): void {
    window.removeEventListener("pointermove", this.onTimelinePointerMove);
    window.removeEventListener("pointerup", this.onTimelinePointerUp);
    window.removeEventListener("pointercancel", this.onTimelinePointerUp);
    if (uResizeHandler) {
      window.removeEventListener("resize", uResizeHandler);
      uResizeHandler = null;
    }
    if (uScrubRaf !== null) {
      cancelAnimationFrame(uScrubRaf);
      uScrubRaf = null;
    }
    uChart?.destroy();
    uChart = null;
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  },
});
</script>

<style lang="scss">
.annotation {
  position: absolute;
  top: 76px;
  right: 60px;
  color: white;
  // above the chart canvas (trade markers), safely below top button bar
  z-index: 1000;
  pointer-events: none;
  border-radius: 0;
  box-shadow: none;
  border: none;
  background: transparent;
  text-transform: uppercase;

  .annotation-table {
    border-collapse: separate;
    border-spacing: 1px;
    border: none;
    font-size: var(--ui-font-size);
    line-height: 1.3;
  }

  .ann-side,
  .ann-token,
  .ann-price {
    padding: 3px 8px;
    white-space: nowrap;
    border: none;
    border-radius: 0;
    font-size: var(--ui-font-size);
    text-align: left;
  }

  .ann-side {
    font-weight: 700;
    letter-spacing: 0.4px;
    min-width: 98px;
    color: #ffffff;
  }

  .ann-side--long {
    background: #15803d;
  }

  .ann-side--short {
    background: #b91c1c;
  }

  .ann-side--meta {
    background: #334155;
  }

  .ann-token {
    font-weight: 500;
  }

  .ann-price {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
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

.top-bar-menu {
  position: absolute;
  top: 7px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 9999;
  flex-wrap: nowrap;
  font-size: var(--ui-font-size);

  @media (max-width: 768px) {
    left: 8px;
    top: 6px;
    gap: 6px;
    flex-wrap: nowrap;

    .system-status-btn {
      margin-left: 0;
      font-size: var(--ui-font-size);
      padding: 0 6px;
      height: 24px;

      .status-view-active {
        display: none;
      }
    }

    .live-toggle-container {
      padding: 0 5px;
      .live-toggle-badge {
        font-size: var(--ui-font-size);
      }
    }

    .use-commission-container {
      padding: 0 4px;
      .use-commission-badge {
        display: none;
      }
    }

    .calc-mode-container {
      padding: 0 4px;
      .calc-mode-badge {
        display: none;
      }
      .calc-mode-button {
        width: 18px;
        height: 18px;
      }
    }
  }

  .live-toggle-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 25px;
    padding: 0 8px 0 6px;
    border-radius: 0;
    background: rgba(0, 0, 0, 0.05);
    border: none;
    box-shadow: none;
    flex-shrink: 0;
    cursor: pointer;

    .live-toggle-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #6b7280;
      box-shadow: none;
      flex-shrink: 0;

      &--active {
        background: var(--green-color);
        box-shadow: none;
      }
    }

    .live-toggle-badge {
      font-size: var(--ui-font-size);
      font-weight: 700;
      letter-spacing: 0.4px;
      user-select: none;
      line-height: 1;
      color: #374151;
      pointer-events: none;
      white-space: nowrap;
    }

    &.live-toggle--active {
      background: rgba(21, 128, 61, 0.12);

      .live-toggle-badge {
        color: #15803d;
      }
    }
  }

  .use-commission-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 25px;
    padding: 0 6px 0 4px;
    border-radius: 0;
    background: rgba(0, 0, 0, 0.05);
    border: none;
    flex-shrink: 0;
    cursor: pointer;

    .use-commission-button {
      width: 18px;
      height: 18px;
      pointer-events: none;
      user-select: none;
    }

    .use-commission-badge {
      font-size: var(--ui-font-size);
      font-weight: 700;
      letter-spacing: 0.4px;
      user-select: none;
      line-height: 1;
      color: #15803d;
      pointer-events: none;
    }

    &.use-commission--off {
      background: rgba(185, 28, 28, 0.1);

      .use-commission-badge {
        color: #b91c1c;
      }
    }
  }

  .calc-mode-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 25px;
    padding: 0 6px 0 4px;
    border-radius: 0;
    background: rgba(21, 128, 61, 0.12);
    border: none;
    flex-shrink: 0;
    cursor: pointer;

    .calc-mode-button {
      width: 18px;
      height: 18px;
      pointer-events: none;
      user-select: none;
    }

    .calc-mode-badge {
      font-size: var(--ui-font-size);
      font-weight: 700;
      letter-spacing: 0.4px;
      user-select: none;
      line-height: 1;
      color: #15803d;
      pointer-events: none;
      white-space: nowrap;
    }

    &.calc-mode--off {
      background: rgba(185, 28, 28, 0.1);

      .calc-mode-badge {
        color: #b91c1c;
      }
    }
  }

  .control--locked {
    cursor: default !important;
    opacity: 0.78;
  }

  .leverage-selector {
    display: inline-flex;
    align-items: center;
    height: 25px;
    border: none;
    background: rgba(100, 116, 139, 0.1);
    flex-shrink: 0;
    user-select: none;

    .leverage-label {
      font-size: var(--ui-font-size);
      font-weight: 700;
      letter-spacing: 0.4px;
      color: #475569;
      padding: 0 6px;
      line-height: 1;
    }

    .leverage-btn {
      height: 100%;
      padding: 0 6px;
      border: none;
      background: transparent;
      color: #334155;
      font-size: var(--ui-font-size);
      font-weight: 700;
      letter-spacing: 0.3px;
      line-height: 1;

      &:hover {
        background: rgba(15, 23, 42, 0.08);
      }

      &.leverage-btn--active {
        background: #1e293b;
        color: #ffffff;
      }
    }
  }

  .live-account-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 25px;
    padding: 0 8px;
    border: none;
    background: rgba(21, 128, 61, 0.12);
    flex-shrink: 0;
    user-select: none;
    white-space: nowrap;

    .live-account-dot {
      width: 6px;
      height: 6px;
      background: #15803d;
      flex-shrink: 0;
    }

    .live-account-balance {
      font-size: var(--ui-font-size);
      font-weight: 700;
      color: #15803d;
      letter-spacing: 0.3px;
    }

    .live-account-lev {
      font-size: var(--ui-font-size);
      font-weight: 700;
      color: #1e293b;
      letter-spacing: 0.3px;
    }

    .live-account-gross {
      font-size: var(--ui-font-size);
      font-weight: 600;
      color: #475569;
      letter-spacing: 0.3px;
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
    font-size: var(--ui-font-size);
    font-weight: 600;
    margin-left: 0;
    letter-spacing: 0.4px;
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
      border: none;
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
      font-size: var(--ui-font-size);
      font-weight: bold;
      white-space: nowrap;
    }

    .status-view-active {
      font-size: var(--ui-font-size);
      opacity: 0.85;
      white-space: nowrap;
    }
  }
}

.top-bar-right {
  position: absolute;
  top: 7px;
  right: 10px;
  display: flex;
  align-items: center;
  z-index: 9999;

  .full-screen-button {
    width: 25px;
    height: 25px;
    padding: 3px;
    background: rgba(0, 0, 0, 0.05);
    border: none;
    border-radius: 0;
    box-shadow: none;
    box-sizing: border-box;
    display: block;
    flex-shrink: 0;
    cursor: pointer;
    user-select: none;
  }

  @media (max-width: 768px) {
    top: 6px;
    right: 8px;

    .full-screen-button {
      width: 24px;
      height: 24px;
      padding: 3px;
    }
  }
}

.top-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(30, 41, 59, 0.12);
  z-index: 9999;
  overflow: hidden;
  pointer-events: none;
}

.top-progress-bar__fill {
  position: absolute;
  top: 0;
  left: -40%;
  width: 40%;
  height: 100%;
  background: #15803d;
  animation: top-progress-slide 1.1s ease-in-out infinite;
}

@keyframes top-progress-slide {
  0% {
    left: -40%;
  }
  100% {
    left: 100%;
  }
}

.busy-overlay {
  position: fixed;
  inset: 0;
  z-index: 9990;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.45);
  pointer-events: all;
}

.busy-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  background: #1e293b;
  color: #ffffff;
  border: none;
  font-size: var(--ui-font-size);
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  user-select: none;
}

.busy-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #22c55e;
  border-radius: 50%;
  animation: busy-spin 0.65s linear infinite;
  flex-shrink: 0;
}

@keyframes busy-spin {
  to {
    transform: rotate(360deg);
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

/* Floating Draggable Time-Window Scrubber */
.timeline-scrubber {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 10px;
  background: var(--background-color);
  font-size: var(--ui-font-size);
  user-select: none;
  -webkit-user-select: none;
  flex-wrap: wrap;
}

.timeline-presets {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.timeline-preset-btn {
  height: 22px;
  padding: 0 7px;
  background: rgba(105, 105, 105, 0.12);
  color: dimgray;
  font-size: var(--ui-font-size);
  font-weight: 700;
  letter-spacing: 0.3px;
  border: none;
  border-radius: 0;
  transition: background-color 0.12s ease, color 0.12s ease;

  &:hover {
    background: rgba(105, 105, 105, 0.24);
    color: #1f2937;
  }

  &--active {
    background: dimgray;
    color: antiquewhite;

    &:hover {
      background: #4b5563;
      color: antiquewhite;
    }
  }
}

.timeline-track {
  position: relative;
  flex: 1 1 220px;
  min-width: 140px;
  height: 22px;
  background: rgba(105, 105, 105, 0.1);
  cursor: pointer;
  overflow: hidden;
  touch-action: none;
}

.timeline-year-tick {
  position: absolute;
  top: 0;
  bottom: 0;
  display: inline-flex;
  align-items: center;
  padding-left: 4px;
  font-size: var(--ui-font-size);
  color: rgba(105, 105, 105, 0.72);
  pointer-events: none;
  white-space: nowrap;
}

.timeline-window {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(105, 105, 105, 0.28);
  cursor: grab;
  touch-action: none;

  &:hover {
    background: rgba(105, 105, 105, 0.36);
  }

  &--dragging {
    cursor: grabbing;
    background: rgba(105, 105, 105, 0.42);
  }
}

.timeline-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 7px;
  background: rgba(75, 85, 99, 0.65);
  cursor: ew-resize;

  &:hover {
    background: #1f2937;
  }

  &--left {
    left: 0;
  }

  &--right {
    right: 0;
  }
}

.timeline-readout {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  font-size: var(--ui-font-size);
  color: dimgray;
  white-space: nowrap;
}

.timeline-dates {
  font-weight: 700;
  letter-spacing: 0.2px;
}

.timeline-pnl {
  font-weight: 700;
}

.timeline-dd {
  color: dimgray;
}

.info-container {
  display: flex;
  flex-wrap: wrap;
  gap: 1px;
  user-select: none;
  -webkit-user-select: none;

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
  font-size: var(--ui-font-size);
  line-height: 18px;
  font-weight: 400;
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
  font-size: var(--ui-font-size);

  .line__name,
  .line__last-value,
  .line__max-dd {
    background: var(--background-color);
    padding-inline: 7px;
    height: 20px;
    line-height: 20px;
    font-size: var(--ui-font-size);
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    box-sizing: border-box;
  }

  .line__max-dd {
    font-size: var(--ui-font-size);
    font-weight: 600;
    margin-left: auto;
    margin-right: 12px;
    letter-spacing: 0.3px;
    opacity: 0.95;
    white-space: nowrap;

    @media (max-width: 600px) {
      font-size: var(--ui-font-size);
      margin-right: 6px;
    }

    strong {
      color: #ef4444;
      font-weight: 700;
    }
  }

  .line__last-value {
    font-weight: bold;
    margin-left: 0;
    margin-right: 16px;
  }

  .round {
    display: inline-block;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    border: none;
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

// uPlot flat DNA TRADE styling overrides
.uplot {
  font-family: Arial, sans-serif !important;
  font-size: var(--ui-font-size) !important;
  background: transparent !important;
}

.uplot .u-wrap {
  background: transparent !important;
}

.uplot .u-cursor-x,
.uplot .u-cursor-y {
  border-color: rgba(105, 105, 105, 0.45) !important;
}

.uplot .u-over {
  cursor: grab;
}

.uplot .u-over:active {
  cursor: grabbing;
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
  font-size: var(--ui-font-size);
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
    font-size: var(--ui-font-size);
    font-weight: 600;
    letter-spacing: 0.4px;
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
        font-size: var(--ui-font-size);

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
      min-height: 172px;
      box-sizing: border-box;
      overflow: hidden;
      background: #ffffff;
      border: none;
      box-shadow: none;
      display: flex;
      flex-direction: column;
      padding: 0;
      position: relative;
      min-width: 0;
      user-select: none;
      -webkit-user-select: none;

      &--in-pos {
        border: none;
        box-shadow: none;
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
        border-bottom: none;

        .bot-card__name {
          font-size: var(--ui-font-size);
          font-weight: 700;
          color: #111827;
          letter-spacing: 0.4px;
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

        .bot-card__pnl {
          font-size: var(--ui-font-size);
          font-weight: 800;
          white-space: nowrap;
          flex-shrink: 0;
          background: #f0ebe1;
          padding: 2px 7px;
        }
      }

      .bot-card__body {
        flex: 1;
        padding: 6px 8px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;

        .pos-row--main {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 5px;

          .pos-side {
            font-size: var(--ui-font-size);
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
            font-size: var(--ui-font-size);
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
          font-size: var(--ui-font-size);

          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f7f5f0;
            padding: 3px 7px;
            border: none;
            border-radius: 0;

            .detail-label {
              color: #374151;
              font-weight: 700;
              font-size: var(--ui-font-size);
              letter-spacing: 0.3px;
            }

            .detail-val {
              font-weight: 800;
              color: #000000;
              font-size: var(--ui-font-size);
            }
          }
        }

        .bot-card__scanning {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--ui-font-size);
          color: #4b5563;
          text-align: center;
          font-weight: 700;
          letter-spacing: 0.5px;
          padding: 14px 0;
        }
      }

      .bot-card__footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 5px 8px;
        border-top: none;
        font-size: var(--ui-font-size);
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

  .coin-filter-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 25px;
    padding: 0 8px 0 6px;
    border-radius: 0;
    background: rgba(0, 0, 0, 0.05);
    border: none;
    flex-shrink: 0;
    cursor: pointer;

    .coin-filter-badge {
      font-size: var(--ui-font-size);
      font-weight: 700;
      letter-spacing: 0.4px;
      user-select: none;
      line-height: 1;
      color: #374151;
      white-space: nowrap;
    }

    &.coin-filter--filtered {
      background: rgba(234, 88, 12, 0.14);

      .coin-filter-badge {
        color: #c2410c;
      }
    }
  }

.coin-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: none;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.coin-modal {
  width: 90%;
  max-width: 500px;
  max-height: 85vh;
  background: #ffffff;
  border-radius: 0;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: none;
  font-size: var(--ui-font-size);

  .coin-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: none;
    background: #f9fafb;

    .coin-modal-title {
      font-size: var(--ui-font-size);
      font-weight: 700;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 8px;

      .coin-modal-subtitle {
        font-size: var(--ui-font-size);
        font-weight: 500;
        color: #6b7280;
      }
    }

    .coin-modal-close {
      background: transparent;
      border: none;
      font-size: var(--ui-font-size);
      color: #9ca3af;
      cursor: pointer;
      padding: 4px;
      line-height: 1;

      &:hover {
        color: #111827;
      }
    }
  }

  .coin-modal-search-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-bottom: none;

    .coin-modal-search {
      flex: 1;
      padding: 6px 10px;
      font-size: var(--ui-font-size);
      border: none;
      background: #f3f4f6;
      border-radius: 0;
      outline: none;

      &:focus {
        background: #e5e7eb;
      }
    }

    .coin-btn-action {
      background: #f3f4f6;
      border: none;
      border-radius: 0;
      padding: 6px 10px;
      font-size: var(--ui-font-size);
      font-weight: 600;
      color: #374151;
      cursor: pointer;
      white-space: nowrap;

      &:hover {
        background: #e5e7eb;
      }
    }
  }

  .coin-modal-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0;
    max-height: 55vh;

    .coin-modal-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      transition: background 0.1s ease;

      &:hover {
        background: #f9fafb;
      }

      &.coin-modal-item--excluded {
        opacity: 0.55;
        background: #fdf2f2;
      }

      .coin-checkbox {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }

      .coin-name {
        font-size: var(--ui-font-size);
        font-weight: 700;
        color: #1f2937;
        flex: 1;
      }

      .coin-trades-count {
        font-size: var(--ui-font-size);
        color: #6b7280;
        font-weight: 500;
      }

      .coin-pnl-badge {
        font-size: var(--ui-font-size);
        font-weight: 700;
        min-width: 65px;
        text-align: right;

        &.coin-pnl--positive {
          color: #15803d;
        }

        &.coin-pnl--negative {
          color: #b91c1c;
        }
      }
    }

    .coin-empty-search {
      padding: 24px;
      text-align: center;
      font-size: var(--ui-font-size);
      color: #9ca3af;
    }
  }

  .coin-modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: 10px 16px;
    border-top: none;
    background: #f9fafb;

    .coin-btn-done {
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 0;
      padding: 6px 16px;
      font-size: var(--ui-font-size);
      font-weight: 700;
      cursor: pointer;

      &:hover {
        background: #1d4ed8;
      }
    }
  }
}
</style>
