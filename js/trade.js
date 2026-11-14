/* trade.js – order ticket, estimated total and simulated order book. */
(function () {
    'use strict';

    var F = window.FPT;
    var form = document.getElementById('order-form');
    if (!F || !form) { return; }

    var qtyInput = form.elements.qty;
    var estimate = document.getElementById('est-total');
    var estLabel = document.getElementById('est-label');
    var message = document.getElementById('order-msg');
    var book = document.getElementById('book-body');

    var LABELS = {
        buy: 'You pay (incl. fee)',
        sell: 'You receive (after fee)',
        short: 'You receive (after fee)',
        cover: 'You pay (incl. fee)'
    };

    function updateEstimate() {
        var s = F.getState();
        var side = form.elements.side.value;
        var qty = Number(qtyInput.value) || 0;
        var value = s.price * qty;
        var fee = value * F.FEE;
        var total = (side === 'buy' || side === 'cover') ? value + fee : value - fee;
        estLabel.textContent = LABELS[side];
        estimate.textContent = F.fmtVND(total);
    }

    /* Simulated order book: 3 asks above and 3 bids below the price */
    function renderBook() {
        var p = F.getState().price;
        var rows = [];
        var i, qty, price;

        for (i = 3; i >= 1; i--) {
            price = p + i * F.PRICE_STEP;
            qty = (5 + Math.floor(Math.random() * 40)) * F.LOT;
            rows.push(['Ask', price, qty, 'down']);
        }
        for (i = 1; i <= 3; i++) {
            price = p - i * F.PRICE_STEP;
            qty = (5 + Math.floor(Math.random() * 40)) * F.LOT;
            rows.push(['Bid', price, qty, 'up']);
        }

        book.textContent = '';
        rows.forEach(function (r) {
            var tr = document.createElement('tr');
            [r[0], F.fmtNum(r[1]), F.fmtNum(r[2]), F.fmtNum(r[1] * r[2])].forEach(function (text, idx) {
                var td = document.createElement('td');
                td.textContent = text;
                if (idx < 2) { td.className = r[3]; }
                tr.appendChild(td);
            });
            book.appendChild(tr);
        });
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var res = F.trade(form.elements.side.value, Number(qtyInput.value));
        message.textContent = res.message;
        message.className = 'msg ' + (res.ok ? 'ok' : 'err');
    });

    form.addEventListener('input', updateEstimate);
    form.addEventListener('change', updateEstimate);

    F.subscribe(function () {
        updateEstimate();
        renderBook();
    });
})();
