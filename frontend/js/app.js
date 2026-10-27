/* ============================================================
   AI 对话机器人 — 前端逻辑
   使用 axios 对接后端（流式 SSE + 非流式降级）
   ============================================================ */

(function () {
  'use strict';

  // 若以 file:// 直接打开，则指向本地后端；由后端托管时同源即可
  const isFileProtocol = window.location.protocol === 'file:';
  const BASE_URL = isFileProtocol ? 'http://localhost:8000' : '';

  // 普通请求客户端
  const api = axios.create({ baseURL: BASE_URL, timeout: 120000 });
  // 流式请求客户端（fetch adapter 支持 ReadableStream）
  const streamApi = axios.create({
    baseURL: BASE_URL,
    adapter: 'fetch',
    timeout: 0, // 流式不设超时
  });

  // 对话历史（发给后端）
  const history = [];

  // DOM
  const chatEl = document.getElementById('chat');
  const messagesEl = document.getElementById('messages');
  const welcomeEl = document.getElementById('welcome');
  const suggestionsEl = document.getElementById('suggestions');
  const form = document.querySelector('.composer');
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const clearBtn = document.getElementById('clearBtn');
  const themeToggle = document.getElementById('themeToggle');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  // marked 配置
  if (window.marked) {
    marked.setOptions({ gfm: true, breaks: true });
  }

  // ---------- 主题 ----------
  const savedTheme = localStorage.getItem('chat-theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
  syncThemeIcon();

  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    localStorage.setItem('chat-theme', cur);
    syncThemeIcon();
  });

  function syncThemeIcon() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelector('.icon-moon').style.display = dark ? 'none' : 'block';
    document.querySelector('.icon-sun').style.display = dark ? 'block' : 'none';
  }

  // ---------- 健康检查 ----------
  checkHealth();
  async function checkHealth() {
    try {
      const res = await api.get('/api/health');
      if (res.data && res.data.status === 'ok') {
        setStatus(true, 'DeepSeek 在线 · ' + (res.data.model || ''));
      } else {
        setStatus(false, '后端异常');
      }
    } catch (e) {
      setStatus(false, '后端未连接');
    }
  }

  function setStatus(online, text) {
    statusDot.classList.toggle('online', online);
    statusText.textContent = text;
  }

  // ---------- 发送 ----------
  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  input.addEventListener('input', autoResize);

  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  }

  async function send() {
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;

    hideWelcome();
    history.push({ role: 'user', content: text });
    appendMessage('user', text);

    input.value = '';
    autoResize();

    // AI 占位消息（打字动画）
    const aiMsg = appendMessage('ai', null, true);
    setSendEnabled(false);

    try {
      await streamReply(aiMsg);
    } catch (err) {
      // 流式失败 → 降级为非流式
      try {
        aiMsg.bubble.textContent = '';
        showTyping(aiMsg.bubble);
        const reply = await nonStreamReply();
        history.push({ role: 'assistant', content: reply });
        renderFinal(aiMsg.bubble, reply);
      } catch (err2) {
        renderError(aiMsg.bubble, err2);
      }
    } finally {
      setSendEnabled(true);
      input.focus();
    }
  }

  async function streamReply(aiMsg) {
    const res = await streamApi.post('/api/chat/stream', { messages: history }, {
      responseType: 'stream',
    });
    const reader = res.data.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    showStreaming(aiMsg.bubble, '');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        let obj;
        try {
          obj = JSON.parse(payload);
        } catch (e) {
          continue;
        }
        if (obj.error) throw new Error(obj.error);
        if (obj.delta) {
          full += obj.delta;
          showStreaming(aiMsg.bubble, full);
        }
        if (obj.done) {
          history.push({ role: 'assistant', content: full });
          renderFinal(aiMsg.bubble, full);
          return;
        }
      }
    }

    // 正常结束（未收到 done 标记时兜底）
    if (full) {
      history.push({ role: 'assistant', content: full });
      renderFinal(aiMsg.bubble, full);
    }
  }

  async function nonStreamReply() {
    const res = await api.post('/api/chat', { messages: history });
    return res.data.reply || '';
  }

  // ---------- 消息渲染 ----------
  function appendMessage(role, content, isAiPlaceholder) {
    const msg = document.createElement('div');
    msg.className = 'msg ' + (role === 'user' ? 'user' : 'ai');

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    if (role === 'user') {
      avatar.textContent = '我';
    } else {
      avatar.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M12 2a4 4 0 0 0-4 4v.5A5 5 0 0 0 4 11v4a3 3 0 0 0 3 3h2a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H8.5A3.5 3.5 0 0 1 12 8.5 3.5 3.5 0 0 1 15.5 11H15a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2a3 3 0 0 0 3-3v-4a5 5 0 0 0-4-5.5V6a4 4 0 0 0-4-4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="9.5" cy="9" r="0.7" fill="currentColor"/><circle cx="14.5" cy="9" r="0.7" fill="currentColor"/></svg>';
    }

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (role === 'user') {
      bubble.textContent = content;
    } else if (isAiPlaceholder) {
      showTyping(bubble);
    } else {
      renderFinal(bubble, content || '');
    }

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    messagesEl.appendChild(msg);
    scrollToBottom();
    return { el: msg, bubble };
  }

  function showTyping(bubble) {
    bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  }

  function showStreaming(bubble, text) {
    bubble.classList.add('streaming');
    // 流式期间用纯文本显示（转义 + 光标），避免 Markdown 闪烁
    const div = document.createElement('div');
    div.textContent = text || '';
    const caret = document.createElement('span');
    caret.className = 'caret';
    bubble.innerHTML = '';
    bubble.appendChild(div);
    bubble.appendChild(caret);
    scrollToBottom();
  }

  function renderFinal(bubble, markdown) {
    bubble.classList.remove('streaming');
    const div = document.createElement('div');
    div.className = 'md';
    if (window.marked) {
      div.innerHTML = marked.parse(markdown || '');
    } else {
      div.textContent = markdown || '';
    }
    bubble.innerHTML = '';
    bubble.appendChild(div);
    scrollToBottom();
  }

  function renderError(bubble, err) {
    bubble.classList.remove('streaming');
    bubble.innerHTML = '';
    const div = document.createElement('div');
    div.style.color = 'var(--text-2)';
    const msg = err && err.message ? err.message : String(err);
    div.textContent = '⚠️ 出错了：' + msg;
    bubble.appendChild(div);
    scrollToBottom();
  }

  function scrollToBottom() {
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function hideWelcome() {
    welcomeEl.style.display = 'none';
  }

  function setSendEnabled(v) {
    sendBtn.disabled = !v;
  }

  // ---------- 欢迎页建议 ----------
  suggestionsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    input.value = chip.dataset.q;
    send();
  });

  // ---------- 清空对话 ----------
  clearBtn.addEventListener('click', () => {
    history.length = 0;
    messagesEl.innerHTML = '';
    welcomeEl.style.display = '';
  });
})();
