/* main.js – shared on every page.
   Extra feature 1: live simulated price + SVG chart.
   Extra feature 2: virtual trading engine (buy / sell / short / cover)
                    whose account is saved in localStorage.
   All prices are randomly generated. They are NOT real market data. */
(function () {
    'use strict';

    var KEY = 'fptsim-state-v1';
    var START_PRICE = 100000;       // VND, an arbitrary round starting value
    var START_CASH = 1000000000;    // VND of virtual cash
    var FEE = 0.0015;               // 0.15% per order
    var LOT = 100;                  // orders are multiples of 100 shares
    var PRICE_STEP = 100;           // price moves in steps of 100 VND
    var MIN_PRICE = 10000;
    var MAX_HISTORY = 60;
    var INTERVAL = 2000;            // ms between price updates
    var ORDER_NAMES = { buy: 'Buy', sell: 'Sell', short: 'Short sell', cover: 'Cover short' };

    var nf = new Intl.NumberFormat('en-US');
    var listeners = [];

    /* ---------- helpers ---------- */
    function fmtNum(n) { return nf.format(Math.round(n)); }
    function fmtVND(n) { return fmtNum(n) + ' VND'; }
    function signed(n) {
        var r = Math.round(n);
        return (r > 0 ? '+' : r < 0 ? '−' : '') + nf.format(Math.abs(r));
    }
    function roundStep(p) { return Math.max(MIN_PRICE, Math.round(p / PRICE_STEP) * PRICE_STEP); }

    /* ---------- state ---------- */
    function seedHistory() {
        var p = START_PRICE;
        var h = [p];
        for (var i = 1; i < MAX_HISTORY; i++) {
            p = roundStep(p * (1 + (Math.random() - 0.5) * 0.01));
            h.unshift(p);
        }
        return h;
    }

    function freshAccount() {
        return {
            cash: START_CASH,
            long: { qty: 0, avg: 0 },
            short: { qty: 0, avg: 0 },
            realized: 0,
            orders: []
        };
    }

    function freshState() {
        var s = freshAccount();
        s.history = seedHistory();
        s.price = s.history[s.history.length - 1];
        s.prev = s.price;
        return s;
    }

    function load() {
        try {
            var s = JSON.parse(localStorage.getItem(KEY));
            if (s && typeof s.price === 'number' && Array.isArray(s.history) && s.long && s.short && Array.isArray(s.orders)) {
                return s;
            }
        } catch (e) { /* fall through */ }
        return freshState();
    }

    var state = load();

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    }

    function metrics() {
        var p = state.price, L = state.long, S = state.short;
        var longValue = L.qty * p;
        var shortValue = S.qty * p;
        var longPnl = L.qty * (p - L.avg);
        var shortPnl = S.qty * (S.avg - p);
        return {
            longValue: longValue,
            shortValue: shortValue,
            longPnl: longPnl,
            shortPnl: shortPnl,
            unrealized: longPnl + shortPnl,
            equity: state.cash + longValue - shortValue,
            low: Math.min.apply(null, state.history),
            high: Math.max.apply(null, state.history)
        };
    }

    /* ---------- trading engine ---------- */
    function result(ok, message) { return { ok: ok, message: message }; }

    function trade(side, qty) {
        if (!ORDER_NAMES[side]) { return result(false, 'Choose Buy, Sell, Short or Cover.'); }
        if (!Number.isInteger(qty) || qty < LOT || qty % LOT !== 0) {
            return result(false, 'Quantity must be a whole number of lots (multiples of ' + LOT + ' shares).');
        }

        var p = state.price;
        var value = p * qty;
        var fee = Math.round(value * FEE);
        var L = state.long, S = state.short;

        if (side === 'buy') {
            if (value + fee > state.cash) { return result(false, 'Not enough virtual cash for this order.'); }
            var newQty = L.qty + qty;
            L.avg = (L.avg * L.qty + value) / newQty;
            L.qty = newQty;
            state.cash -= value + fee;
        } else if (side === 'sell') {
            if (qty > L.qty) { return result(false, 'You only own ' + fmtNum(L.qty) + ' shares to sell.'); }
            state.realized += (p - L.avg) * qty - fee;
            L.qty -= qty;
            if (L.qty === 0) { L.avg = 0; }
            state.cash += value - fee;
        } else if (side === 'short') {
            var limit = metrics().equity;
            if ((S.qty + qty) * p > limit) {
                return result(false, 'Short limit reached: total short value cannot exceed your account equity.');
            }
            S.avg = (S.avg * S.qty + value) / (S.qty + qty);
            S.qty += qty;
            state.cash += value - fee;
        } else if (side === 'cover') {
            if (qty > S.qty) { return result(false, 'You only have ' + fmtNum(S.qty) + ' shares short to cover.'); }
            if (value + fee > state.cash) { return result(false, 'Not enough virtual cash to buy back the shares.'); }
            state.realized += (S.avg - p) * qty - fee;
            S.qty -= qty;
            if (S.qty === 0) { S.avg = 0; }
            state.cash -= value + fee;
        }

        state.orders.unshift({ t: Date.now(), side: side, qty: qty, price: p, fee: fee });
        state.orders = state.orders.slice(0, 50);
        save();
        emit();

        return result(true, ORDER_NAMES[side] + ' ' + fmtNum(qty) + ' FPT at ' + fmtVND(p) + ' done (fee ' + fmtVND(fee) + ').');
    }

    function resetAccount() {
        var a = freshAccount();
        state.cash = a.cash;
        state.long = a.long;
        state.short = a.short;
        state.realized = a.realized;
        state.orders = a.orders;
        save();
        emit();
    }

    /* ---------- price simulation ---------- */
    function tick() {
        state.prev = state.price;
        state.price = roundStep(state.price * (1 + (Math.random() - 0.5) * 0.01));
        state.history.push(state.price);
        if (state.history.length > MAX_HISTORY) { state.history.shift(); }
        save();
        emit();
    }

    /* ---------- chart ---------- */
    function drawChart(svg, data) {
        var W = 600, H = 220, PAD = 14;
        var min = Math.min.apply(null, data);
        var max = Math.max.apply(null, data);
        var extra = (max - min) * 0.1 || PRICE_STEP * 5;
        var lo = min - extra, hi = max + extra;
        var stepX = (W - PAD * 2) / (data.length - 1);
        var x = function (i) { return PAD + i * stepX; };
        var y = function (v) { return PAD + (hi - v) * (H - PAD * 2) / (hi - lo); };

        var grid = '';
        for (var g = 0; g < 4; g++) {
            var gy = PAD + g * (H - PAD * 2) / 3;
            grid += '<line class="chart-grid" x1="0" x2="' + W + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"/>';
        }

        var pts = data.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); });
        var area = 'M' + x(0).toFixed(1) + ',' + (H - PAD) + ' L' + pts.join(' L') + ' L' + x(data.length - 1).toFixed(1) + ',' + (H - PAD) + ' Z';
        var last = data.length - 1;

        svg.innerHTML = grid +
            '<path class="chart-area" d="' + area + '"/>' +
            '<polyline class="chart-line" points="' + pts.join(' ') + '"/>' +
            '<circle class="chart-dot" cx="' + x(last).toFixed(1) + '" cy="' + y(data[last]).toFixed(1) + '" r="5"/>';

        svg.setAttribute('aria-label', 'Simulated FPT price over the last ' + data.length + ' updates. Now ' +
            fmtNum(data[last]) + ' VND, low ' + fmtNum(min) + ', high ' + fmtNum(max) + '.');
    }

    /* ---------- order tables ---------- */
    var lastOrderSig = null;

    function renderOrders(force) {
        var bodies = document.querySelectorAll('[data-orders]');
        if (!bodies.length) { return; }
        var sig = state.orders.length + ':' + (state.orders[0] ? state.orders[0].t : 0);
        if (!force && sig === lastOrderSig) { return; }
        lastOrderSig = sig;

        Array.prototype.forEach.call(bodies, function (tbody) {
            var limit = Number(tbody.getAttribute('data-limit')) || 50;
            var rows = state.orders.slice(0, limit);
            tbody.textContent = '';

            if (!rows.length) {
                var tr = document.createElement('tr');
                var td = document.createElement('td');
                td.colSpan = 5;
                td.textContent = 'No orders yet.';
                tr.appendChild(td);
                tbody.appendChild(tr);
                return;
            }

            rows.forEach(function (o) {
                var tr = document.createElement('tr');
                var cells = [
                    new Date(o.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    ORDER_NAMES[o.side],
                    fmtNum(o.qty),
                    fmtNum(o.price),
                    fmtNum(o.fee)
                ];
                cells.forEach(function (c) {
                    var cell = document.createElement('td');
                    cell.textContent = c;
                    tr.appendChild(cell);
                });
                tbody.appendChild(tr);
            });
        });
    }

    /* ---------- DOM bindings: <span data-bind="price"> etc. ---------- */
    function setText(el, text) {
        if (el.textContent !== text) { el.textContent = text; }
    }

    function setSign(el, n) {
        el.classList.toggle('up', n > 0);
        el.classList.toggle('down', n < 0);
    }

    function render() {
        var m = metrics();
        var diff = state.price - state.prev;
        var pct = state.prev ? (diff / state.prev) * 100 : 0;
        var arrow = diff > 0 ? '▲ +' : diff < 0 ? '▼ −' : '■ ';

        var values = {
            'price': fmtNum(state.price),
            'change': arrow + Math.abs(pct).toFixed(2) + '%',
            'low': 'Low ' + fmtNum(m.low),
            'high': 'High ' + fmtNum(m.high),
            'cash': fmtVND(state.cash),
            'equity': fmtVND(m.equity),
            'long-qty': fmtNum(state.long.qty),
            'long-avg': fmtNum(state.long.avg),
            'long-value': fmtNum(m.longValue),
            'long-pnl': signed(m.longPnl),
            'short-qty': fmtNum(state.short.qty),
            'short-avg': fmtNum(state.short.avg),
            'short-value': fmtNum(m.shortValue),
            'short-pnl': signed(m.shortPnl),
            'realized': signed(state.realized) + ' VND',
            'unrealized': signed(m.unrealized) + ' VND'
        };
        var signs = {
            'change': diff,
            'long-pnl': m.longPnl,
            'short-pnl': m.shortPnl,
            'realized': state.realized,
            'unrealized': m.unrealized
        };

        Array.prototype.forEach.call(document.querySelectorAll('[data-bind]'), function (el) {
            var name = el.getAttribute('data-bind');
            if (!(name in values)) { return; }
            var changed = el.textContent !== values[name];
            setText(el, values[name]);
            if (name in signs) { setSign(el, signs[name]); }
            if (name === 'price' && changed) {
                el.classList.remove('flash');
                void el.offsetWidth;   // restart the CSS animation
                el.classList.add('flash');
            }
        });

        var chart = document.getElementById('chart');
        if (chart) { drawChart(chart, state.history); }

        renderOrders(false);
    }

    function emit() {
        render();
        listeners.forEach(function (fn) { fn(state); });
    }

    /* ---------- public API for the page scripts ---------- */
    window.FPT = {
        LOT: LOT,
        FEE: FEE,
        PRICE_STEP: PRICE_STEP,
        getState: function () { return state; },
        subscribe: function (fn) { listeners.push(fn); fn(state); },
        trade: trade,
        reset: resetAccount,
        fmtNum: fmtNum,
        fmtVND: fmtVND,
        signed: signed
    };

    document.addEventListener('DOMContentLoaded', function () {
        renderOrders(true);
        render();
        window.setInterval(tick, INTERVAL);
    });
})();
