/* Daily MST 구독 위젯 — 의존성 없음(ES5). 팝업(모달) 형태: 대시보드 안 버튼 클릭 → 오버레이에 폼.
 * 기본 흐름(현재): 이메일 입력 → 확인 메일. 홀더 게이팅은 나중 — 준비되면 data-mode="wallet"로 전환한다.
 * wallet 모드(보관, 미사용): 지갑 연결 → 서명으로 소유 확인 → (서버가 MST 보유 확인) → 이메일 입력 → 확인 메일.
 * api: POST /api/newsletter/challenge (wallet 모드), POST /api/newsletter/subscribe
 * 설정 우선순위: window.MST_SUBSCRIBE_CONFIG { api, mode } > <script data-api data-mode> > 기본값(공개 api, email) */
(function () {
  var cfg = window.MST_SUBSCRIBE_CONFIG || {};
  var script = document.currentScript;
  var API = (typeof cfg.api === 'string' ? cfg.api : ((script && script.getAttribute('data-api')) || 'https://report.mustree.kr:18443')).replace(/\/+$/, '');
  var MODE = cfg.mode || (script && script.getAttribute('data-mode')) || 'email';
  var CHAIN_ID_HEX = '0x1e1b'; // 7707 (사이트 app.js 와 동일). 서명에는 체인이 필요 없어 전환 실패는 무시한다.
  var root = document.getElementById('mst-subscribe');
  if (!root) return;

  // 스타일은 .mst-sub 아래(모달 카드) 또는 .mst-sub-trigger/.mst-sub-overlay(버튼·배경) 아래에만 둔다. 새 시안이 오면 이 블록만 바꾼다.
  var css = '.mst-sub-trigger{padding:12px 24px;background:linear-gradient(135deg,#60a5fa,#22d3ee);color:#031321;border:0;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 8px 22px rgba(34,211,238,.35);transition:transform .15s ease, box-shadow .15s ease}' +
    '.mst-sub-trigger:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(96,165,250,.42)}' +
    '.mst-sub-overlay{position:fixed;inset:0;background:rgba(17,24,39,.6);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px}' +
    '.mst-sub-overlay.open{display:flex}' +
    '.mst-sub{position:relative;max-width:480px;width:100%;padding:20px;background:#fff;border-radius:8px;font-family:inherit;box-shadow:0 10px 40px rgba(0,0,0,.25)}' +
    '.mst-sub .close{position:absolute;top:10px;right:10px;width:28px;height:28px;background:none;border:0;font-size:20px;line-height:1;color:#888;cursor:pointer}' +
    '.mst-sub h3{margin:0 0 6px;font-size:18px;color:#111827}.mst-sub p{margin:0 0 12px;font-size:14px;color:#555;line-height:1.5}' +
    '.mst-sub input[type=email]{width:100%;box-sizing:border-box;padding:10px;border:1px solid #d4d4d8;font-size:15px;color:#111827}' +
    '.mst-sub input[disabled]{background:#f4f4f5;color:#999}' +
    '.mst-sub button{margin-top:10px;padding:10px 20px;background:linear-gradient(135deg,#3b82f6,#06b6d4);color:#fff;border:0;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 8px 18px rgba(59,130,246,.25)}' +
    '.mst-sub button[disabled]{opacity:.5;cursor:default}.mst-sub .hp{position:absolute;left:-9999px}' +
    '.mst-sub .addr{font-size:13px;color:#333;word-break:break-all}.mst-sub .msg{margin-top:10px;font-size:13px;min-height:1.4em;color:#111827}' +
    '.mst-sub .consent{font-size:12px;color:#666;line-height:1.5;margin:10px 0 0}';
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  var wallet = MODE === 'wallet';

  // root 자리에는 트리거 버튼만 남는다. 폼은 body에 붙인 오버레이(모달)에 있다.
  root.innerHTML = '<button type="button" class="mst-sub-trigger">데일리 리포트 구독</button>';
  var trigger = root.querySelector('.mst-sub-trigger');

  var overlay = document.createElement('div');
  overlay.className = 'mst-sub-overlay';
  overlay.innerHTML = '<div class="mst-sub"><button type="button" class="close" aria-label="닫기">×</button><h3>데일리 리포트 구독</h3>' +
    '<p>' + (wallet ? 'MST 보유 지갑을 연결해 서명으로 소유를 확인한 뒤 이메일을 등록합니다. 서명은 송금·승인이 아닙니다.' : '매일 아침 Daily MST 리포트를 이메일로 받습니다.') + '</p>' +
    '<form>' + (wallet ? '<button type="button" class="connect">지갑 연결</button><p class="addr"></p>' : '') +
    '<input type="email" name="email" placeholder="이메일" required maxlength="254" autocomplete="email"' + (wallet ? ' disabled' : '') + '>' +
    '<span class="hp" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off"></span>' +
    '<button type="submit" class="submit"' + (wallet ? ' disabled' : '') + '>구독 신청</button>' +
    '<p class="consent">머스트리 데일리 리포트와 위클리 레터 수신에 동의합니다. 이메일은 발송 목적으로만 보관하며 메일 하단 링크로 언제든 무료로 수신거부할 수 있습니다.</p>' +
    '<div class="msg"></div></form></div>';
  document.body.appendChild(overlay);

  var form = overlay.querySelector('form'), msg = overlay.querySelector('.msg'), emailInput = form.email, submit = overlay.querySelector('.submit');
  var state = {};
  function say(t) { msg.textContent = t; }
  function post(path, body) {
    return fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return null; }).then(function (j) { return { status: r.status, json: j }; }); });
  }
  function shortAddr(a) { return a.slice(0, 6) + '…' + a.slice(-4); }
  function resetWallet() { state = {}; overlay.querySelector('.addr').textContent = ''; submit.disabled = true; emailInput.disabled = true; }

  function onKeydown(ev) { if (ev.key === 'Escape') closeModal(); }
  function openModal() {
    overlay.classList.add('open');
    document.addEventListener('keydown', onKeydown);
    setTimeout(function () { emailInput.focus(); }, 0);
  }
  function closeModal() {
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKeydown);
  }

  trigger.addEventListener('click', openModal);
  overlay.querySelector('.close').addEventListener('click', closeModal);
  overlay.addEventListener('click', function (ev) { if (ev.target === overlay) closeModal(); }); // 바깥(배경) 클릭만 닫는다 — 카드 클릭은 버블링 전에 여기 안 옴

  if (wallet) {
    overlay.querySelector('.connect').addEventListener('click', function () {
      if (!window.ethereum) { say('MetaMask 같은 지갑 확장이 필요합니다.'); return; }
      var address, connect = overlay.querySelector('.connect');
      connect.disabled = true; say('지갑에서 연결과 서명을 승인해 주세요.');
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(function (accs) {
          address = accs && accs[0];
          if (!address) throw { code: 'no_account' };
          // 체인 전환은 사용자 편의(사이트와 같은 체인 표시)일 뿐, 서명·보유 확인에는 필요 없다 → 실패해도 계속
          return window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] }).catch(function () {});
        })
        .then(function () { return post('/api/newsletter/challenge', { address: address }); })
        .then(function (c) {
          if (c.status !== 200 || !c.json || !c.json.message) throw { code: 'challenge', status: c.status };
          state.challenge = c.json.challenge;
          return window.ethereum.request({ method: 'personal_sign', params: [c.json.message, address] });
        })
        .then(function (sig) {
          state.address = address; state.signature = sig;
          overlay.querySelector('.addr').textContent = '확인된 주소: ' + shortAddr(address);
          emailInput.disabled = false; submit.disabled = false; emailInput.focus();
          say('이메일을 입력하고 구독 신청을 눌러 주세요.');
        })
        .catch(function (e) {
          resetWallet();
          var code = e && e.code;
          if (code === 4001 || code === 'ACTION_REJECTED') say('지갑 연결 또는 서명이 취소되었습니다. 준비되면 다시 [지갑 연결]을 눌러 주세요.');
          else if (code === 'challenge') say(e.status === 429 ? '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' : '서명 문구를 받지 못했습니다. 잠시 후 다시 시도해 주세요.');
          else if (code === 'no_account') say('연결된 지갑 계정이 없습니다. 지갑에서 계정을 선택해 주세요.');
          else say('지갑 연결에 실패했습니다. 지갑 확장을 확인한 뒤 다시 시도해 주세요.');
        })
        .then(function () { connect.disabled = false; });
    });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var body = { email: emailInput.value, website: form.website.value };
    if (wallet) {
      if (!state.signature) { say('먼저 지갑을 연결해 주세요.'); return; }
      body.address = state.address; body.signature = state.signature; body.challenge = state.challenge;
    }
    submit.disabled = true; say('신청 중…');
    post('/api/newsletter/subscribe', body).then(function (r) {
      var reason = r.json && r.json.reason;
      if (r.status === 202) { say('확인 메일을 보냈습니다. 메일함에서 [구독 확정]을 눌러 주세요. 메일이 오지 않았다면 스팸함을 확인해주세요.'); if (wallet) resetWallet(); return; }
      if (r.status === 400) say('이메일 형식을 확인해 주세요.');
      else if (r.status === 403 && reason === 'not_holder') { say('MST를 보유한 지갑이 아닙니다. 보유 지갑으로 다시 연결해 주세요.'); if (wallet) resetWallet(); return; }
      else if (r.status === 403 && reason === 'chain_unavailable') say('지금은 보유 확인을 할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      else if (r.status === 403) { say('지갑 확인에 실패했습니다. 다시 연결해 주세요.'); if (wallet) resetWallet(); return; }
      else if (r.status === 429) say('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
      else say('일시적인 오류입니다. 잠시 후 다시 시도해 주세요.');
      submit.disabled = false;
    }).catch(function () { say('네트워크 오류입니다. 잠시 후 다시 시도해 주세요.'); submit.disabled = false; });
  });
})();
