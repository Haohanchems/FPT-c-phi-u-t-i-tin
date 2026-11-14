/* learn.js – extra feature 4: interactive long vs short profit calculator. */
(function () {
    'use strict';

    var form = document.getElementById('calc-form');
    if (!form) { return; }

    var nf = new Intl.NumberFormat('en-US');
    var entry = form.elements.entry;
    var shares = form.elements.shares;
    var exit = form.elements.exit;

    function money(n) {
        var r = Math.round(n);
        return (r > 0 ? '+' : r < 0 ? '−' : '') + nf.format(Math.abs(r)) + ' VND';
    }

    function pct(n) {
        return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(1) + '%';
    }

    function paint(id, text, n) {
        var el = document.getElementById(id);
        el.textContent = text;
        el.classList.toggle('up', n > 0);
        el.classList.toggle('down', n < 0);
    }

    function update() {
        var e = Number(entry.value);
        var q = Number(shares.value);
        var x = Number(exit.value);

        document.getElementById('exit-out').textContent = nf.format(x) + ' VND';

        if (!(e > 0) || !(q > 0)) {
            paint('long-result', 'Enter a price and a number of shares', 0);
            paint('short-result', '', 0);
            return;
        }

        var longPnl = (x - e) * q;
        var shortPnl = -longPnl;
        var move = ((x - e) / e) * 100;

        paint('long-result', money(longPnl) + ' (' + pct(move) + ')', longPnl);
        paint('short-result', money(shortPnl) + ' (' + pct(-move) + ')', shortPnl);

        document.getElementById('calc-note').textContent = x > e
            ? 'The price rose, so the buyer gains and the short seller loses. A price can rise without limit, so a short seller’s loss has no ceiling.'
            : x < e
                ? 'The price fell, so the short seller gains and the buyer loses. The most a short seller can ever gain is 100% (if the price reached zero).'
                : 'The price did not move, so neither side has a gain or loss before fees.';
    }

    form.addEventListener('input', update);
    update();
})();
