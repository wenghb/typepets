/**
 * Feedback — lets kids, parents and teachers tell us what to improve.
 *
 * - App pages: a 💬 button in the nav (in the ☰ menu on phones) opens the form in a modal.
 *   Bubble Pop pauses itself while any .tp-modal-overlay is open.
 * - /feedback.html renders the same form inline into #feedbackInline (linked from the
 *   landing page, blog and 404 footers).
 * - Sends: topic, optional 1–5 rating, the message, the page, browser/screen size and
 *   progress level (sessions, stage, level); the server adds the country. Never the player's name.
 * - The optional reply email sits behind the grown-up gate (app.js `showParentGate`).
 * - Posts JSON to /api/feedback (functions/api/feedback.js).
 */
(function() {
    'use strict';

    const ENDPOINT = '/api/feedback';
    const MAX_MESSAGE = 1000;

    const TOPICS = [
        { id: 'bug', icon: '🐛', label: 'Something is broken', placeholder: 'What happened? What were you doing when it went wrong?' },
        { id: 'idea', icon: '💡', label: 'I have an idea', placeholder: 'What should we add or change?' },
        { id: 'difficulty', icon: '🎯', label: 'Too hard or too easy', placeholder: 'Which part? Was it too hard or too easy?' },
        { id: 'love', icon: '❤️', label: 'I love something', placeholder: 'What do you like best?' },
        { id: 'other', icon: '💬', label: 'Something else', placeholder: 'Type your message here…' }
    ];

    const RATINGS = [
        { value: 1, icon: '😢', label: 'Not fun' },
        { value: 2, icon: '😕', label: 'Meh' },
        { value: 3, icon: '😐', label: 'Okay' },
        { value: 4, icon: '🙂', label: 'Fun' },
        { value: 5, icon: '😍', label: 'Love it' }
    ];

    let uid = 0;

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function button(className, text, onClick) {
        const b = el('button', className, text);
        b.type = 'button';
        if (onClick) b.addEventListener('click', onClick);
        return b;
    }

    /** A row of radio "chips" (real radios, so arrow keys and screen readers work). */
    function chipGroup(name, legendText, options, className) {
        const fieldset = el('fieldset', 'fb-group ' + className);
        fieldset.appendChild(el('legend', 'tp-field-label', legendText));
        const row = el('div', 'fb-options');
        options.forEach((opt) => {
            const label = el('label', 'fb-chip');
            const input = el('input');
            input.type = 'radio';
            input.name = name;
            input.value = String(opt.id || opt.value);
            const face = el('span', 'fb-chip-face');
            face.appendChild(el('span', 'fb-chip-icon', opt.icon));
            face.appendChild(el('span', 'fb-chip-label', opt.label));
            label.appendChild(input);
            label.appendChild(face);
            row.appendChild(label);
        });
        fieldset.appendChild(row);
        return fieldset;
    }

    /** Anonymous context that helps us reproduce problems. No names, no save data. */
    function collectContext() {
        const ctx = {};
        try {
            ctx.lang = navigator.language;
            ctx.screen = window.screen.width + 'x' + window.screen.height;
            ctx.viewport = window.innerWidth + 'x' + window.innerHeight;
            ctx.theme = document.documentElement.getAttribute('data-theme') || 'light';
            ctx.touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        } catch (e) { /* ignore */ }
        try {
            if (typeof TypePetsData !== 'undefined') {
                const s = TypePetsData.getStats();
                const p = TypePetsData.getIntegratedProgress();
                ctx.progress = {
                    sessions: s.total_sessions,
                    avg_wpm: s.avg_wpm,
                    avg_accuracy: s.avg_accuracy,
                    training_stage: p.training_stage,
                    bubble_level: p.bubble_level,
                    articles: p.articles_completed,
                    pet_level: p.pet && p.pet.level
                };
            }
        } catch (e) { /* ignore */ }
        return ctx;
    }

    /**
     * Build the form inside `container`.
     * opts.onClose: shows a Cancel/Close button (modal only).
     * opts.topic: preselect a topic id.
     */
    function buildForm(container, opts) {
        opts = opts || {};
        const id = 'fb' + (++uid);
        const openedAt = Date.now();
        container.textContent = '';

        const form = el('form', 'fb-form');
        form.noValidate = true;
        form.setAttribute('aria-label', 'Send feedback');

        if (opts.heading !== false) {
            form.appendChild(el('div', 'tp-modal-emoji', '💬'));
            form.appendChild(el('h3', null, 'Tell us what you think'));
            form.appendChild(el('p', 'tp-modal-text', 'We read every message and use it to make TypePets better.'));
        }

        const rating = chipGroup(id + '-rating', 'How fun is TypePets?', RATINGS, 'fb-rating');
        form.appendChild(rating);
        const topics = chipGroup(id + '-topic', 'What is it about?', TOPICS, 'fb-topics');
        form.appendChild(topics);

        const msgLabel = el('label', 'tp-field-label', 'Tell us more');
        msgLabel.htmlFor = id + '-msg';
        form.appendChild(msgLabel);
        const message = el('textarea', 'tp-input fb-message');
        message.id = id + '-msg';
        message.rows = 4;
        message.maxLength = MAX_MESSAGE;
        message.placeholder = TOPICS[TOPICS.length - 1].placeholder;
        message.setAttribute('aria-describedby', id + '-privacy');
        form.appendChild(message);
        const meta = el('div', 'fb-meta');
        const privacy = el('span', 'fb-privacy', "🔒 Please don't type your name, email or address.");
        privacy.id = id + '-privacy';
        const counter = el('span', 'fb-counter', '0/' + MAX_MESSAGE);
        counter.setAttribute('aria-hidden', 'true');
        meta.appendChild(privacy);
        meta.appendChild(counter);
        form.appendChild(meta);

        // Optional reply email, grown-ups only
        const contactWrap = el('div', 'fb-contact');
        const contactToggle = button('fb-link', '👋 Grown-up? Add an email if you would like a reply', () => {
            const reveal = () => {
                contactToggle.hidden = true;
                contactField.hidden = false;
                contactInput.focus();
            };
            if (typeof window.showParentGate === 'function') {
                window.showParentGate(reveal, { reason: 'Adding an email is for grown-ups. Please ask one to answer:' });
            } else {
                reveal();
            }
        });
        const contactField = el('div', 'fb-contact-field');
        contactField.hidden = true;
        const contactLabel = el('label', 'tp-field-label', 'Grown-up email (optional)');
        contactLabel.htmlFor = id + '-contact';
        const contactInput = el('input', 'tp-input fb-input-left');
        contactInput.id = id + '-contact';
        contactInput.type = 'email';
        contactInput.autocomplete = 'email';
        contactInput.maxLength = 120;
        contactInput.placeholder = 'you@example.com';
        contactField.appendChild(contactLabel);
        contactField.appendChild(contactInput);
        contactField.appendChild(el('p', 'fb-note', 'We only use it to reply to this message.'));
        contactWrap.appendChild(contactToggle);
        contactWrap.appendChild(contactField);
        form.appendChild(contactWrap);

        // Honeypot: people never see or fill this; simple bots do
        const trap = el('div', 'fb-trap');
        trap.setAttribute('aria-hidden', 'true');
        const trapInput = el('input');
        trapInput.type = 'text';
        trapInput.name = 'website';
        trapInput.tabIndex = -1;
        trapInput.autocomplete = 'off';
        trap.appendChild(trapInput);
        form.appendChild(trap);

        form.appendChild(el('p', 'fb-note',
            "Along with your message we send the page you're on, your browser, screen size and country, " +
            'and your progress level — never your name.'));

        const err = el('p', 'tp-modal-error');
        err.setAttribute('role', 'alert');
        form.appendChild(err);

        const actions = el('div', 'tp-modal-actions');
        const send = el('button', 'btn btn-primary', 'Send feedback');
        send.type = 'submit';
        actions.appendChild(send);
        if (opts.onClose) actions.appendChild(button('btn btn-secondary', 'Cancel', opts.onClose));
        form.appendChild(actions);

        function selected(name) {
            const r = form.querySelector('input[name="' + name + '"]:checked');
            return r ? r.value : null;
        }

        topics.addEventListener('change', () => {
            const t = TOPICS.find((x) => x.id === selected(id + '-topic'));
            if (t) message.placeholder = t.placeholder;
        });
        message.addEventListener('input', () => {
            counter.textContent = message.value.length + '/' + MAX_MESSAGE;
        });

        if (opts.topic && TOPICS.some((t) => t.id === opts.topic)) {
            const r = topics.querySelector('input[value="' + opts.topic + '"]');
            if (r) { r.checked = true; message.placeholder = TOPICS.find((t) => t.id === opts.topic).placeholder; }
        }

        let sending = false;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (sending) return;
            err.textContent = '';
            const ratingVal = selected(id + '-rating');
            const text = message.value.trim();
            const contact = contactField.hidden ? '' : contactInput.value.trim();
            if (!text && !ratingVal) {
                err.textContent = 'Pick a face or type a message first.';
                message.focus();
                return;
            }
            if (contact && !contactInput.checkValidity()) {
                err.textContent = 'That email doesn\'t look right — please check it, or leave it empty.';
                contactInput.focus();
                return;
            }

            sending = true;
            send.disabled = true;
            send.textContent = 'Sending…';
            const payload = {
                category: selected(id + '-topic') || 'other',
                rating: ratingVal ? parseInt(ratingVal, 10) : null,
                message: text,
                contact: contact,
                page: location.pathname,
                context: collectContext(),
                website: trapInput.value,
                elapsed_ms: Date.now() - openedAt
            };
            fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then((res) => {
                if (res.ok) { showThanks(); return; }
                return res.json().catch(() => ({})).then((data) => {
                    if (res.status === 429) {
                        fail('Lots of people are sending feedback right now. Please try again in a few minutes.');
                    } else if (data && data.error === 'bad_contact') {
                        fail('That email doesn\'t look right — please check it, or leave it empty.');
                    } else {
                        fail("Sorry, we couldn't send that right now. Please try again later.");
                    }
                });
            }).catch(() => {
                fail("Sorry, we couldn't send that. Check your internet connection and try again.");
            });
        });

        function fail(text) {
            sending = false;
            send.disabled = false;
            send.textContent = 'Send feedback';
            err.textContent = text;
            send.focus(); // disabling the button dropped focus; bring it back so Enter retries
        }

        function showThanks() {
            container.textContent = '';
            const done = el('div', 'fb-thanks');
            done.setAttribute('role', 'status');
            done.appendChild(el('div', 'tp-modal-emoji', '🎉'));
            done.appendChild(el('h3', null, 'Thank you!'));
            done.appendChild(el('p', 'tp-modal-text',
                'Your feedback was sent. Ideas like yours help us make TypePets more fun for everyone.'));
            const doneActions = el('div', 'tp-modal-actions');
            if (opts.onClose) {
                const close = button('btn btn-primary', 'Back to typing', opts.onClose);
                doneActions.appendChild(close);
                setTimeout(() => close.focus(), 50);
            } else {
                doneActions.appendChild(button('btn btn-secondary', 'Send more feedback', () => buildForm(container, opts)));
                const back = el('a', 'btn btn-primary', 'Open TypePets');
                back.href = '/pages/home.html';
                doneActions.appendChild(back);
            }
            done.appendChild(doneActions);
            container.appendChild(done);
            if (typeof window.spawnConfetti === 'function') window.spawnConfetti(30);
        }

        container.appendChild(form);
        return form;
    }

    function openFeedback(opts) {
        opts = opts || {};
        if (typeof window.tpOpenModal !== 'function') {
            location.href = '/feedback.html';
            return;
        }
        const m = window.tpOpenModal({
            className: 'feedback-modal',
            label: 'Send feedback',
            // Clicking outside only closes an empty form (Cancel and Escape always work)
            closeOnOverlay: () => {
                const msg = m.card.querySelector('.fb-message');
                return !msg || !msg.value.trim();
            }
        });
        buildForm(m.card, { topic: opts.topic, onClose: m.close });
        setTimeout(() => {
            const first = m.card.querySelector('input[type="radio"]');
            if (first) first.focus();
        }, 50);
    }

    function initNavEntry() {
        const nav = document.querySelector('.main-nav');
        if (!nav) return;
        const open = (e) => { e.preventDefault(); openFeedback(); };

        const right = nav.querySelector('.nav-right');
        if (right) {
            const btn = button('feedback-toggle', '💬', open);
            btn.title = 'Send feedback';
            btn.setAttribute('aria-label', 'Send feedback');
            right.insertBefore(btn, right.querySelector('.theme-toggle') || right.firstChild);
        }
        // Phones: the header button is hidden, so add it to the ☰ menu (built by app.js)
        const links = nav.querySelector('.nav-links');
        if (links) {
            const link = el('a', 'nav-link nav-link-feedback', '💬 Send feedback');
            link.href = '/feedback.html';
            link.addEventListener('click', open);
            const support = links.querySelector('.nav-link-support');
            links.insertBefore(link, support || null);
        }
    }

    window.openFeedback = openFeedback;

    const inline = document.getElementById('feedbackInline');
    if (inline) {
        const topic = new URLSearchParams(location.search).get('topic');
        buildForm(inline, { heading: false, topic: topic });
    } else {
        initNavEntry();
    }
})();
