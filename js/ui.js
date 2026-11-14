/* ui.js – loaded in <head>. Applies the saved theme before first paint,
   then wires up the dark-mode toggle (extra feature 3) and the mobile menu. */
(function () {
    'use strict';

    var root = document.documentElement;
    root.classList.add('js');

    try {
        var saved = localStorage.getItem('fptsim-theme');
        if (saved === 'light' || saved === 'dark') {
            root.setAttribute('data-theme', saved);
        }
    } catch (e) { /* storage blocked: follow the system setting */ }

    document.addEventListener('DOMContentLoaded', function () {
        /* ----- Light / dark toggle ----- */
        var themeBtn = document.getElementById('theme-toggle');
        var mq = window.matchMedia('(prefers-color-scheme: dark)');

        function isDark() {
            var t = root.getAttribute('data-theme');
            return t ? t === 'dark' : mq.matches;
        }

        function syncTheme() {
            if (themeBtn) { themeBtn.setAttribute('aria-pressed', String(isDark())); }
        }

        if (themeBtn) {
            syncTheme();
            themeBtn.addEventListener('click', function () {
                var next = isDark() ? 'light' : 'dark';
                root.setAttribute('data-theme', next);
                try { localStorage.setItem('fptsim-theme', next); } catch (e) { /* ignore */ }
                syncTheme();
            });
            if (mq.addEventListener) { mq.addEventListener('change', syncTheme); }
        }

        /* ----- Mobile menu ----- */
        var navBtn = document.getElementById('nav-toggle');
        var nav = document.getElementById('site-nav');

        if (navBtn && nav) {
            var setOpen = function (open) {
                nav.classList.toggle('open', open);
                navBtn.setAttribute('aria-expanded', String(open));
            };

            navBtn.addEventListener('click', function () {
                setOpen(navBtn.getAttribute('aria-expanded') !== 'true');
            });

            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') { setOpen(false); }
            });
        }
    });
})();
