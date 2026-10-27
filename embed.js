// One-line install: <script src=".../embed.js" data-store="yourstore.com" async></script>
// Adds a "Find my routine" button that opens SkinMatch in a modal iframe.
(() => {
  const me = document.currentScript;
  const store = me?.dataset.store || '';
  const base = me ? new URL('./', me.src).href : '/';
  const btn = document.createElement('button');
  btn.textContent = 'Find my routine';
  btn.setAttribute('style', 'position:fixed;right:16px;bottom:16px;z-index:2147483000;padding:16px 22px;border:0;background:#2b2216;color:#e4e2da;font:600 16px system-ui,sans-serif;box-shadow:0 0 0 2px #e4e2da;cursor:pointer');
  btn.onclick = () => {
    const wrap = document.createElement('div');
    wrap.setAttribute('style', 'position:fixed;inset:0;z-index:2147483001;background:rgba(20,15,9,.6);display:flex;align-items:center;justify-content:center');
    const frame = document.createElement('iframe');
    const qs = new URLSearchParams({ store, embed: '1' });
    for (const k of ['off', 'am', 'pm', 'both']) if (me?.dataset[k]) qs.set(k, me.dataset[k]); // merchant's review
    frame.src = `${base}?${qs}`;
    frame.title = 'SkinMatch skin check';
    frame.allow = 'camera';
    frame.setAttribute('style', 'width:min(440px,100vw);height:min(820px,100vh);border:0;background:#2b2216');
    const close = document.createElement('button');
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close skin check');
    close.setAttribute('style', 'position:absolute;top:12px;right:16px;font:28px system-ui;color:#fff;background:none;border:0;cursor:pointer');
    close.onclick = () => wrap.remove();
    wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
    wrap.append(frame, close);
    document.body.append(wrap);
  };
  document.body.append(btn);
})();
