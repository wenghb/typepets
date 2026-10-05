/**
 * Feedback — lets kids, parents and teachers tell us what to improve.
 *
 * - App pages: a 💬 button in the nav (in the ☰ menu on phones) opens the form in a modal
 *   (a bottom sheet on phones). Bubble Pop pauses itself while any .tp-modal-overlay is open.
 * - /feedback.html renders the same form inline into #feedbackInline (linked from the
 *   landing page, blog and 404 footers).
 * - Every choice is a keycap you press, like the on-screen keyboard in the lessons.
 * - Sends: topic, optional 1–5 rating, the message, the page, browser/screen size and
 *   progress level (sessions, stage, level); the server adds the country. Never the player's name.
 * - The optional reply email sits behind the grown-up gate (app.js `showParentGate`).
 * - Posts JSON to /api/feedback (functions/api/feedback.js).
 */
(function() {
    'use strict';

    const ENDPOINT = '/api/feedback';
    const MAX_MESSAGE = 1000;
    const DEFAULT_PLACEHOLDER = 'Write your message here';

    const RATINGS = [
        { value: 1, icon: '😢', label: 'Not fun' },
        { value: 2, icon: '😕', label: 'Meh' },
        { value: 3, icon: '😐', label: 'Okay' },
        { value: 4, icon: '🙂', label: 'Fun' },
        { value: 5, icon: '😍', label: 'Super fun' }
    ];

    const TOPICS = [
        { value: 'bug', icon: '🐛', label: 'Broken', placeholder: 'What happened? What were you doing when it went wrong?' },
        { value: 'idea', icon: '💡', label: 'Idea', placeholder: 'What should we add or change?' },
        { value: 'difficulty', icon: '🎯', label: 'Hard / easy', placeholder: 'Which part was too hard or too easy?' },
        { value: 'love', icon: '❤️', label: 'Love it', placeholder: 'What do you like best?' },
        { value: 'other', icon: '💬', label: 'Other', placeholder: DEFAULT_PLACEHOLDER }
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

    /** A row of five keycaps (real radios, so arrow keys and screen readers work). */
    function keyRow(name, legendText, options, className) {
        const fieldset = el('fieldset', 'fb-group ' + className);
        fieldset.appendChild(el('legend', 'fb-label', legendText));
        const row = el('div', 'fb-keys');
        options.forEach((opt) => {
            const key = el('label', 'fb-key');
            const input = el('input');
            input.type = 'radio';
            input.name = name;
            input.value = String(opt.value);
            const cap = el('span', 'fb-key-cap');
            const icon = el('span', 'fb-key-icon', opt.icon);
            icon.setAttribute('aria-hidden', 'true');
            cap.appendChild(icon);
            cap.appendChild(el('span', 'fb-key-label', opt.label));
            key.appendChild(input);
            key.appendChild(cap);
            row.appendChild(key);
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
     * opts.onClose: modal mode (header with ✕, Cancel button, fixed footer).
     * opts.topic: preselect a topic.
     */
    function buildForm(container, opts) {
        opts = opts || {};
        const isModal = typeof opts.onClose === 'function';
        const id = 'fb' + (++uid);
        const openedAt = Date.now();
        container.textContent = '';

        const form = el('form', 'fb-form ' + (isModal ? 'fb-form-modal' : 'fb-form-inline'));
        form.noValidate = true;
        form.setAttribute('aria-label', 'Send feedback');

        if (isModal) {
            const head = el('div', 'fb-head');
            const titles = el('div', 'fb-titles');
            titles.appendChild(el('h2', 'fb-title', 'Tell us what you think'));
            titles.appendChild(el('p', 'fb-sub', 'Every message is read by the people who make TypePets.'));
            head.appendChild(titles);
            const closeBtn = button('fb-close', '✕', opts.onClose);
            closeBtn.setAttribute('aria-label', 'Close');
            head.appendChild(closeBtn);
            form.appendChild(head);
        }

        const body = el('div', 'fb-body');
        form.appendChild(body);

        const ratingName = id + '-rating';
        const topicName = id + '-topic';
        body.appendChild(keyRow(ratingName, 'How fun is TypePets?', RATINGS, 'fb-rating'));
        const topics = keyRow(topicName, "What's it about?", TOPICS, 'fb-topics');
        body.appendChild(topics);

        const msgLabel = el('label', 'fb-label', 'Tell us more');
        msgLabel.htmlFor = id + '-msg';
        body.appendChild(msgLabel);
        const message = el('textarea', 'fb-input fb-message');
        message.id = id + '-msg';
        message.rows = 4;
        message.maxLength = MAX_MESSAGE;
        message.placeholder = DEFAULT_PLACEHOLDER;
        message.setAttribute('aria-describedby', id + '-privacy');
        body.appendChild(message);
        const hint = el('div', 'fb-hint');
        const privacy = el('span', null, "🔒 Don't type your name, email or address.");
        privacy.id = id + '-privacy';
        const counter = el('span', 'fb-counter', '0/' + MAX_MESSAGE);
        counter.setAttribute('aria-hidden', 'true');
        hint.appendChild(privacy);
        hint.appendChild(counter);
        body.appendChild(hint);

        // Optional reply email, grown-ups only
        const contactWrap = el('div', 'fb-contact');
        const contactField = el('div', 'fb-contact-field');
        contactField.hidden = true;
        const contactLabel = el('label', 'fb-label', 'Your email');
        contactLabel.htmlFor = id + '-contact';
        const contactInput = el('input', 'fb-input');
        contactInput.id = id + '-contact';
        contactInput.type = 'email';
        contactInput.autocomplete = 'email';
        contactInput.maxLength = 120;
        contactInput.placeholder = 'you@example.com';
        contactField.appendChild(contactLabel);
        contactField.appendChild(contactInput);
        contactField.appendChild(el('p', 'fb-hint', 'Only used to reply to this message.'));
        const contactToggle = button('fb-link', null, () => {
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
        const waveIcon = el('span', null, '👋');
        waveIcon.setAttribute('aria-hidden', 'true');
        contactToggle.appendChild(waveIcon);
        contactToggle.appendChild(el('span', 'fb-link-text', 'Grown-up? Add your email to get a reply'));
        contactWrap.appendChild(contactToggle);
        contactWrap.appendChild(contactField);
        body.appendChild(contactWrap);

        body.appendChild(el('p', 'fb-note',
            "Sent with your message: the page you're on, your browser, screen size, country and progress level. Never your name."));

        const err = el('p', 'fb-error');
        err.setAttribute('role', 'alert');
        body.appendChild(err);

        const foot = el('div', 'fb-foot');
        if (isModal) foot.appendChild(button('btn btn-secondary', 'Cancel', opts.onClose));
        const send = el('button', 'btn btn-primary fb-send', 'Send feedback');
        send.type = 'submit';
        foot.appendChild(send);
        form.appendChild(foot);

        function selected(name) {
            const r = form.querySelector('input[name="' + name + '"]:checked');
            return r ? r.value : null;
        }

        function syncPlaceholder() {
            const t = TOPICS.find((x) => x.value === selected(topicName));
            message.placeholder = t ? t.placeholder : DEFAULT_PLACEHOLDER;
        }
        topics.addEventListener('change', syncPlaceholder);
        message.addEventListener('input', () => {
            counter.textContent = message.value.length + '/' + MAX_MESSAGE;
        });

        // ?topic= comes from the URL on /feedback.html, so only accept known values
        if (TOPICS.some((t) => t.value === opts.topic)) {
            topics.querySelector('input[value="' + opts.topic + '"]').checked = true;
            syncPlaceholder();
        }

        let sending = false;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (sending) return;
            err.textContent = '';
            const ratingVal = selected(ratingName);
            const text = message.value.trim();
            const contact = contactField.hidden ? '' : contactInput.value.trim();
            if (!text && !ratingVal) {
                err.textContent = 'Pick a face or write a message first.';
                message.focus();
                return;
            }
            if (contact && !contactInput.checkValidity()) {
                err.textContent = 'Check the email address, or leave it empty.';
                contactInput.focus();
                return;
            }

            sending = true;
            send.disabled = true;
            send.textContent = 'Sending…';
            const payload = {
                category: selected(topicName) || 'other',
                rating: ratingVal ? parseInt(ratingVal, 10) : null,
                message: text,
                contact: contact,
                page: location.pathname,
                context: collectContext(),
                elapsed_ms: Date.now() - openedAt
            };
            fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then((res) => {
                if (res.status === 201) { showThanks(); return; }
                return res.json().catch(() => ({})).then((data) => {
                    const code = data && data.error;
                    if (res.status === 429) fail('Too many messages are coming in right now. Try again in a few minutes.');
                    else if (code === 'bad_contact') fail('Check the email address, or leave it empty.');
                    else if (code === 'too_fast') fail('That was quick! Press Send feedback again.');
                    else fail("Couldn't send your feedback. Try again in a minute.");
                });
            }).catch(() => {
                fail("Couldn't send. Check your internet connection and try again.");
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
            const icon = el('div', 'fb-thanks-icon', '🎉');
            icon.setAttribute('aria-hidden', 'true');
            done.appendChild(icon);
            done.appendChild(el('h2', 'fb-title', 'Thanks! We got it.'));
            done.appendChild(el('p', 'fb-sub', 'Your feedback goes straight to the people who make TypePets.'));
            const actions = el('div', 'fb-thanks-actions');
            if (isModal) {
                const back = button('btn btn-primary', 'Back to typing', opts.onClose);
                actions.appendChild(back);
                setTimeout(() => back.focus(), 50);
            } else {
                actions.appendChild(button('btn btn-secondary', 'Send more feedback', () => buildForm(container, opts)));
                const open = el('a', 'btn btn-primary', 'Open TypePets');
                open.href = '/pages/home.html';
                actions.appendChild(open);
            }
            done.appendChild(actions);
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
            // Clicking outside only closes an empty form (✕, Cancel and Escape always work)
            closeOnOverlay: () => {
                const msg = m.card.querySelector('.fb-message');
                return !msg || !msg.value.trim();
            }
        });
        m.overlay.classList.add('feedback-overlay'); // bottom sheet on phones
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
        buildForm(inline, { topic: topic });
    } else {
        initNavEntry();
    }
})();
