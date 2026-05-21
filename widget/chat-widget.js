/* ============================================================
   Toque de Cor – Chat Widget (Embeddable, Vanilla JS)
   Uso: 
     window.ToqueDeCor = { apiUrl: 'https://app.toquedeor.com.br', storeId: 'uuid-da-loja' };
     <script src="chat-widget.js" defer></script>
   ============================================================ */
(function () {
  'use strict';

  var cfg = window.ToqueDeCor || {};
  var API_URL = (cfg.apiUrl || '').replace(/\/$/, '');
  var STORE_ID = cfg.storeId || null;

  var conversationId = null;
  var isOpen = false;
  var sessionPhone = null;

  // ── Inject CSS if not already present ──────────────────────
  if (!document.getElementById('tc-widget-css')) {
    var link = document.createElement('link');
    link.id = 'tc-widget-css';
    link.rel = 'stylesheet';
    link.href = API_URL + '/widget/chat-widget.css';
    document.head.appendChild(link);
  }

  // ── Build DOM ───────────────────────────────────────────────
  var btn = document.createElement('button');
  btn.id = 'tc-chat-btn';
  btn.setAttribute('aria-label', 'Abrir chat');
  btn.innerHTML = [
    '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    '<span class="tc-notif"></span>',
  ].join('');

  var win = document.createElement('div');
  win.id = 'tc-chat-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', 'Chat Toque de Cor');
  win.innerHTML = [
    '<div class="tc-header">',
    '  <div class="tc-header-avatar">🎨</div>',
    '  <div class="tc-header-info">',
    '    <div class="tc-header-name">Toque de Cor</div>',
    '    <div class="tc-header-sub">Assistente de Vendas · Online</div>',
    '  </div>',
    '  <button class="tc-header-close" aria-label="Fechar"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>',
    '</div>',
    '<div id="tc-messages"></div>',
    '<div class="tc-input-area">',
    '  <input id="tc-input" type="text" placeholder="Escreva sua mensagem..." autocomplete="off" maxlength="500" />',
    '  <button id="tc-send" aria-label="Enviar">',
    '    <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    '  </button>',
    '</div>',
    '<div class="tc-footer">Powered by Toque de Cor · Assistente Virtual</div>',
  ].join('');

  document.body.appendChild(btn);
  document.body.appendChild(win);

  var messagesEl = document.getElementById('tc-messages');
  var inputEl    = document.getElementById('tc-input');
  var sendBtn    = document.getElementById('tc-send');

  // ── Toggle ──────────────────────────────────────────────────
  function openChat() {
    isOpen = true;
    win.classList.add('open');
    btn.innerHTML = [
      '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    ].join('');
    inputEl.focus();
    if (!conversationId) startConversation();
  }

  function closeChat() {
    isOpen = false;
    win.classList.remove('open');
    btn.innerHTML = [
      '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      '<span class="tc-notif"></span>',
    ].join('');
  }

  btn.addEventListener('click', function () { isOpen ? closeChat() : openChat(); });
  win.querySelector('.tc-header-close').addEventListener('click', closeChat);

  // ── Messages ────────────────────────────────────────────────
  function formatTime(date) {
    var d = new Date(date);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }

  function appendMessage(text, role, ts) {
    var div = document.createElement('div');
    div.className = 'tc-msg ' + (role === 'bot' ? 'bot' : 'user');
    // basic markdown: **bold**, newlines
    var safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    safeText = safeText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    safeText = safeText.replace(/\n/g, '<br/>');
    div.innerHTML = safeText + '<span class="tc-msg-time">' + formatTime(ts || Date.now()) + '</span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showTyping() {
    var el = document.createElement('div');
    el.className = 'tc-typing';
    el.id = 'tc-typing-indicator';
    el.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function removeTyping() {
    var el = document.getElementById('tc-typing-indicator');
    if (el) el.remove();
  }

  // ── API helpers ─────────────────────────────────────────────
  function post(path, body) {
    return fetch(API_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  // ── Session phone prompt ────────────────────────────────────
  function ensurePhone() {
    if (sessionPhone) return Promise.resolve(sessionPhone);
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:absolute;inset:0;background:rgba(255,255,255,0.97);z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px;';
      overlay.innerHTML = [
        '<p style="font-size:0.85rem;color:#475569;text-align:center;font-weight:600;">Para começar, informe seu WhatsApp:</p>',
        '<input id="tc-phone-inp" type="tel" placeholder="+55 11 99999-0000" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 14px;font-size:0.85rem;width:100%;max-width:240px;outline:none;" />',
        '<button id="tc-phone-btn" style="background:#E63946;color:#fff;border:none;border-radius:8px;padding:8px 24px;font-size:0.85rem;font-weight:600;cursor:pointer;">Iniciar Conversa</button>',
      ].join('');
      win.querySelector('#tc-messages').parentNode.insertBefore(overlay, win.querySelector('.tc-input-area'));
      var inp = overlay.querySelector('#tc-phone-inp');
      var okBtn = overlay.querySelector('#tc-phone-btn');
      inp.focus();
      function submit() {
        var val = inp.value.replace(/\D/g, '');
        if (val.length < 10) { inp.style.borderColor = '#E63946'; return; }
        sessionPhone = val;
        overlay.remove();
        resolve(sessionPhone);
      }
      okBtn.addEventListener('click', submit);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    });
  }

  // ── Start conversation ──────────────────────────────────────
  function startConversation() {
    ensurePhone().then(function (phone) {
      var typing = showTyping();
      return post('/api/chat/start', { phone: phone, channel: 'WEB', storeId: STORE_ID })
        .then(function (res) {
          removeTyping();
          var data = res.data || {};
          conversationId = data.conversationId || data.id;
          if (data.welcomeMessage) {
            appendMessage(data.welcomeMessage, 'bot', new Date());
          }
        });
    }).catch(function () {
      removeTyping();
      appendMessage('Desculpe, não consegui iniciar a conversa. Tente novamente.', 'bot', new Date());
    });
  }

  // ── Send message ────────────────────────────────────────────
  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || !conversationId) return;
    inputEl.value = '';
    sendBtn.disabled = true;
    appendMessage(text, 'user', new Date());
    var typing = showTyping();
    post('/api/chat/' + conversationId + '/message', { message: text })
      .then(function (res) {
        removeTyping();
        var reply = (res.data && res.data.reply) || (res.data && res.data.content) || '';
        if (reply) appendMessage(reply, 'bot', new Date());
      })
      .catch(function () {
        removeTyping();
        appendMessage('Erro ao processar sua mensagem. Tente novamente.', 'bot', new Date());
      })
      .finally(function () { sendBtn.disabled = false; });
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // ── Public API ───────────────────────────────────────────────
  window.ToqueDeCor = Object.assign(window.ToqueDeCor || {}, {
    open: openChat,
    close: closeChat,
    toggle: function () { isOpen ? closeChat() : openChat(); },
  });
})();
