/* portfolio.js – reset button for the virtual account. */
(function () {
    'use strict';

    var F = window.FPT;
    var btn = document.getElementById('reset-btn');
    var msg = document.getElementById('reset-msg');
    if (!F || !btn) { return; }

    btn.addEventListener('click', function () {
        if (window.confirm('Reset your virtual account to 1,000,000,000 VND and delete all orders?')) {
            F.reset();
            msg.textContent = 'Account reset.';
        }
    });
})();
