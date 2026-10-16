(function(){
"use strict";
/* ============================================================
   Спільний скрипт усіх сторінок сайту. Що саме робити, береться з
   <body data-page="...">:
     home      — головна (посилання, помилки, налаштування)
     exam      — /exam/                  (офіційний іспит)
     topics    — /topics/                (список тем)
     topic     — /topics/<id>test/       (тест за темою; data-topic="<id>")
     tickets   — /tickets/               (список білетів)
     ticket    — /tickets/<N>/           (білет; data-ticket="<N>")
     random    — /tickets/random/        (20 випадкових питань)
     mistakes  — /mistakes/              (робота над помилками)
   ============================================================ */
var $ = function(id){ return document.getElementById(id); };
var LS = {
  get:function(k,d){ try{ var v=localStorage.getItem('pdr25:'+k); return v==null?d:JSON.parse(v);}catch(e){return d;} },
  set:function(k,v){ try{ localStorage.setItem('pdr25:'+k, JSON.stringify(v)); }catch(e){} },
  del:function(k){ try{ localStorage.removeItem('pdr25:'+k); }catch(e){} }
};
var PAGE = document.body.getAttribute('data-page') || '';
var cfg = LS.get('cfg', {instant:true, category:'B'});
// у налаштуваннях лишилось лише «показувати відповідь одразу»;
// «лише звірені» завжди увімкнено, «ховати питання з малюнком» — завжди вимкнено
cfg.verified = true;
cfg.hideImg = false;
if(cfg.instant === undefined) cfg.instant = true;
if(!cfg.category) cfg.category = 'B';
var stats = LS.get('stats', {});       // topicId -> {best:0,total:0}
var mistakes = LS.get('mistakes', []); // question ids

/* ---------- exam structure ---------- */
// Офіційна структура іспиту: 10 ПДР + 4 основи безпеки + 4 будова (за категорією) + 2 домедична допомога
var GROUP_PDR = ['1','2','3','4','5','6','7','8.1','8.2','9','10','11','12','13','14','15',
  '16.1','16.2','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34'];
var GROUP_SAFETY = ['35','36','38','39'];
var GROUP_FIRSTAID = ['37'];
var CATS = [
  {id:'A', label:'A, A1', sections:['40','41','42','43']},
  {id:'B', label:'B, B1', sections:['44','45','46','47']},
  {id:'C', label:'C, C1', sections:['48','49','50','51']},
  {id:'D', label:'D, D1', sections:['52','53','54','55']},
  {id:'E', label:'з причепом', sections:['56','57','58','59']},
  {id:'T', label:'T', sections:['60','61','62','63']}
];
function catSections(id){
  var c = CATS.filter(function(c){ return c.id === id; })[0];
  return c ? c.sections : [];
}
var EXAM_PLAN = [
  {ids:GROUP_PDR, n:10, label:'ПДР'},
  {ids:GROUP_SAFETY, n:4, label:'Основи безпеки руху'},
  {ids:null, n:4, label:'Будова та експлуатація ТЗ'}, // ids filled per-category
  {ids:GROUP_FIRSTAID, n:2, label:'Домедична допомога'}
];

/* ---------- підрозділи «33. Дорожні знаки» ---------- */
// групи знаків лежать у js/signs.js (window.SIGN_GROUPS) — підключається на сторінках /topics/33-<N>test/
var SIGN_TOPIC_ID = '33';
var SIGN_GROUPS = window.SIGN_GROUPS || [];
// n (номер питання в розділі 33) -> id групи, напр. {1:'mandatory', 2:'mandatory', ...}
var SIGN_GROUP_BY_N = {};
SIGN_GROUPS.forEach(function(g){
  g.nums.forEach(function(n){ SIGN_GROUP_BY_N[n] = g.id; });
});

/* ---------- theme ---------- */
var theme = LS.get('theme', null);
if(theme) document.documentElement.setAttribute('data-theme', theme);
else document.documentElement.removeAttribute('data-theme');
$('themeBtn').onclick = function(){
  var cur = document.documentElement.getAttribute('data-theme') ||
    (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  var next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  LS.set('theme', next);
};

/* ---------- справжня видима висота екрана для .wrap ----------
   CSS-одиниці 100vh/100svh «застигають» один раз і не завжди встигають
   оновитись, коли мобільний браузер на льоту ховає/показує свою панель
   адреси. Тут висота рахується наживо через visualViewport і
   записується в CSS-змінну --app-vh (запасний варіант для css). */
(function(){
  function setVH(){
    var h = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
    document.documentElement.style.setProperty('--app-vh', h + 'px');
  }
  setVH();
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', setVH);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', setVH);
  }
})();

/* ---------- lightbox (повноекранний перегляд ілюстрації) ---------- */
if($('qimg') && $('lightbox')){
  $('qimg').onclick = function(){
    $('lightboxImg').src = $('qimgEl').src;
    $('lightboxImg').alt = $('qimgEl').alt;
    $('lightbox').classList.remove('hidden');
  };
  $('lightbox').onclick = function(){ $('lightbox').classList.add('hidden'); };
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && !$('lightbox').classList.contains('hidden')) $('lightbox').classList.add('hidden');
  });
}

/* ---------- дані питань ---------- */
var DATA = [];
var ALL = [];
function buildAll(){
  DATA = window.PDR_DATA || [];
  ALL = [];
  DATA.forEach(function(s){
    s.questions.forEach(function(q){
      q.topic = s.id; q.topicTitle = s.title;
      if(s.id === SIGN_TOPIC_ID) q.signGroup = SIGN_GROUP_BY_N[q.n] || null;
      ALL.push(q);
    });
  });
}
buildAll();
// на сторінках без data.js (головна, список тем) файл підтягується лише за потреби
function ensureData(cb){
  if(window.PDR_DATA){ if(!ALL.length) buildAll(); cb(); return; }
  var s = document.createElement('script');
  s.src = '/js/data.js';
  s.onload = function(){ buildAll(); cb(); };
  document.head.appendChild(s);
}
function topicTitleById(id){
  for(var i=0;i<DATA.length;i++) if(DATA[i].id === id) return DATA[i].title;
  return '';
}

/* ---------- pool ---------- */
function allowed(q){
  if(q.a === null || q.a === undefined) return false;
  if(cfg.verified && !q.v) return false;
  if(cfg.hideImg && q.img) return false;
  return true;
}
function pool(){ return ALL.filter(allowed); }
function topicPool(id){ return ALL.filter(function(q){ return q.topic === id && allowed(q); }); }
function signGroupPool(groupId){
  return ALL.filter(function(q){ return q.topic === SIGN_TOPIC_ID && q.signGroup === groupId && allowed(q); });
}
function relaxedAllowed(q){ return q.a !== null && q.a !== undefined; }
function poolByIds(ids, relaxed){
  var f = relaxed ? relaxedAllowed : allowed;
  return ALL.filter(function(q){ return ids.indexOf(q.topic) > -1 && f(q); });
}
// бере n питань з груп ids: спершу зі «звірених», за нестачі добирає нефільтровані
function pickFromGroup(ids, n, rng){
  var strict = poolByIds(ids, false);
  var chosen = shuffle(strict, rng).slice(0, n);
  if(chosen.length < n){
    var have = {}; chosen.forEach(function(q){ have[q.id] = true; });
    var relaxed = poolByIds(ids, true).filter(function(q){ return !have[q.id]; });
    chosen = chosen.concat(shuffle(relaxed, rng).slice(0, n - chosen.length));
  }
  return chosen;
}
function buildComposition(catId, rng){
  var plan = EXAM_PLAN.map(function(p){ return p.ids ? p : {ids:catSections(catId), n:p.n, label:p.label}; });
  var picked = [], shortfall = false;
  plan.forEach(function(p){
    var got = pickFromGroup(p.ids, p.n, rng);
    got.forEach(function(q){ q.groupLabel = p.label; });
    if(got.length < p.n) shortfall = true;
    picked = picked.concat(got);
  });
  return {list: shuffle(picked, rng), shortfall: shortfall};
}
/* ---------- seeded random (для білетів — щоб один номер завжди давав той самий набір) ---------- */
function hashSeed(str){
  var h = 1779033703 ^ str.length;
  for(var i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
function shuffle(a, rng){
  rng = rng || Math.random;
  a = a.slice();
  for(var i=a.length-1;i>0;i--){ var j=Math.floor(rng()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}

/* ---------- screens ---------- */
// секції сторінки з тестом: intro (вступ/вибір категорії), quiz, result
function show(name){
  ['intro','quiz','result'].forEach(function(n){
    var el = $(n); if(el) el.classList.toggle('hidden', n !== name);
  });
  var fb = $('footbar'); if(fb) fb.classList.toggle('hidden', name !== 'quiz');
  window.scrollTo(0,0);
}
// куди вести після «Вийти» (задається на кожній сторінці в data-quit)
function quitUrl(){ return document.body.getAttribute('data-quit') || '/'; }

/* ---------- quiz engine ---------- */
var S = null;
var lastStarter = null; // функція, що запускає той самий тест знову («Пройти ще раз»)
var EXAM_MINUTES = 20;
var MAX_MISTAKES = 2; // дозволено помилок; третя — провал
var pending = null;   // обраний, але ще не підтверджений варіант поточного питання

function start(qs, title, topicId, opts){
  if(!qs.length){ return; }
  if(S && S.timerId){ clearInterval(S.timerId); }
  opts = opts || {};
  var list = opts.preShuffled ? qs.slice() : shuffle(qs);
  if(opts.limit) list = list.slice(0, opts.limit);
  S = {list:list, i:0, answers:[], title:title, topicId:topicId||null, limit:opts.limit||null,
       ticketNum:opts.ticketNum||null, category:opts.category||null, finished:false,
       strict:!!opts.strict, failShown:false, failReason:null, continued:false,
       examEndAt: opts.strict ? (Date.now() + EXAM_MINUTES*60*1000) : null, timerId:null};
  show('quiz');
  renderQ();
  if(S.examEndAt != null) startTimer(); else $('qtimer').classList.add('hidden');
}
/* ---------- таймер іспиту (20 хв, лише для «Екзамен» і білетів) ---------- */
function startTimer(){
  if(S.timerId) clearInterval(S.timerId);
  $('qtimer').classList.remove('hidden');
  $('qtimer').classList.remove('bad');
  tickTimer();
  S.timerId = setInterval(tickTimer, 1000);
}
function clearTimer(){
  if(S && S.timerId){ clearInterval(S.timerId); S.timerId = null; }
}
function tickTimer(){
  if(!S || S.examEndAt == null || S.failShown) return;
  var remain = S.examEndAt - Date.now();
  if(remain <= 0){
    clearTimer();
    failExam('time');
    return;
  }
  var mm = Math.floor(remain / 60000);
  var ss = Math.floor((remain % 60000) / 1000);
  $('qtimer').textContent = mm + ':' + (ss < 10 ? '0' : '') + ss;
}
// провал іспиту — або через вийшов час, або через 3 неправильні відповіді
function failExam(reason){
  if(!S || S.failShown) return;
  S.failShown = true;
  S.failReason = reason;
  clearTimer();
  var badge = $('qtimer');
  badge.classList.remove('hidden');
  badge.classList.add('bad');
  badge.textContent = reason === 'time' ? 'Іспит не складено: вийшов час' : 'Іспит не складено через помилки';
  showFailModal(reason);
}
function renderQ(){
  var q = S.list[S.i];
  pending = null;
  $('qpos').textContent = (S.i+1) + ' / ' + S.list.length;
  var topicLabel = q.groupLabel ? (q.groupLabel + ' · ' + q.topicTitle) : q.topicTitle;
  $('qtopic').textContent = topicLabel.length > 40 ? topicLabel.slice(0,39) + '…' : topicLabel;
  $('qwarn').classList.toggle('hidden', !!q.v);
  if(S.examEndAt != null) $('qtimer').classList.remove('hidden');
  $('qtext').textContent = q.q;
  if(q.img){
    var imgEl = $('qimgEl');
    imgEl.onerror = function(){ $('qimg').classList.add('hidden'); };
    imgEl.onload = function(){ $('qimg').classList.remove('hidden'); };
    $('qimg').classList.remove('hidden');
    imgEl.src = '/img/' + q.id + '.webp';
    imgEl.alt = 'Ілюстрація до питання ' + (S.i+1);
  } else {
    $('qimg').classList.add('hidden');
  }
  $('verdict').classList.add('hidden');
  buildStrip();
  // options
  var host = $('opts'); host.innerHTML = '';
  var given = S.answers[S.i];
  q.o.forEach(function(text, idx){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    b.innerHTML = '<span class="k"></span><span class="x"></span>';
    b.querySelector('.k').textContent = (idx+1);
    b.querySelector('.x').textContent = text;
    // на мобільних тап по кнопці інколи піднімає сторінку вгору, бо браузер
    // прагне «показати» щойно сфокусований елемент над нижньою панеллю;
    // прибираємо це, не даючи кнопці отримати нативний фокус при натисканні
    b.onmousedown = function(e){ e.preventDefault(); };
    if(given){
      b.disabled = true;
      if(cfg.instant){
        if(idx === q.a) b.classList.add('correct');
        if(idx === given.pick && !given.ok) b.classList.add('wrong');
      } else if(idx === given.pick){
        b.classList.add('picked');
      }
    } else {
      b.onclick = function(){ selectOption(idx); };
    }
    host.appendChild(b);
  });
  if(given && cfg.instant){
    var v = $('verdict');
    v.className = 'verdict ' + (given.ok ? 'ok' : 'bad');
    v.textContent = given.ok ? 'Правильно.' : 'Правильна відповідь — ' + (q.a+1) + '.';
  }
  updateFooter();
}
// клік по варіанту лише підсвічує вибір — без оцінки правильності
function selectOption(idx){
  if(S.answers[S.i] !== undefined) return;
  pending = idx;
  var btns = $('opts').querySelectorAll('.opt');
  for(var i=0;i<btns.length;i++) btns[i].classList.remove('picked');
  btns[idx].classList.add('picked');
  updateFooter();
}
function answeredCount(){
  var n = 0;
  for(var k=0;k<S.list.length;k++) if(S.answers[k] !== undefined) n++;
  return n;
}
// перемикає нижню панель між «Пропустити/Обрати» (до відповіді) і «Далі» (після)
function updateFooter(){
  var given = S.answers[S.i];
  var confirmBtn = $('confirmBtn'), nextBtn = $('nextBtn'), skipBtn = $('skipBtn');
  if(given){
    confirmBtn.classList.add('hidden');
    skipBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');
    var all = answeredCount() === S.list.length;
    var last = S.i === S.list.length - 1;
    if(last && !all){
      nextBtn.textContent = 'Далі';
    } else {
      nextBtn.textContent = (all || last) ? 'Завершити тест' : 'Далі';
    }
    nextBtn.disabled = false;
  } else {
    nextBtn.classList.add('hidden');
    confirmBtn.classList.remove('hidden');
    skipBtn.classList.remove('hidden');
    confirmBtn.disabled = (pending === null);
  }
}
function buildStrip(){
  var strip = $('strip');
  strip.innerHTML = '';
  S.list.forEach(function(q, k){
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = (k + 1);
    b.title = 'Питання ' + (k + 1);
    b.setAttribute('aria-label', 'Питання ' + (k + 1));
    strip.appendChild(b);
  });
  markStrip();
}
function markStrip(){
  var kids = $('strip').children;
  for(var k=0;k<kids.length;k++){
    var a = S.answers[k], cls = '';
    if(a !== undefined) cls = cfg.instant ? (a.ok ? 'ok' : 'bad') : 'done';
    if(k === S.i) cls = cls ? cls + ' now' : 'now';
    kids[k].className = cls;
    kids[k].onclick = (function(n){ return function(){ goTo(n); }; })(k);
  }
  var cur = kids[S.i];
  if(cur){
    var strip = $('strip');
    strip.scrollLeft = cur.offsetLeft - (strip.clientWidth / 2) + (cur.clientWidth / 2);
  }
}
function goTo(k){
  if(!S || S.finished || k === S.i || k < 0 || k >= S.list.length) return;
  S.i = k;
  renderQ();
}
function answer(idx){
  var q = S.list[S.i];
  if(S.answers[S.i] !== undefined) return;
  var ok = idx === q.a;
  S.answers[S.i] = {pick:idx, ok:ok, id:q.id};
  var btns = $('opts').querySelectorAll('.opt');
  for(var i=0;i<btns.length;i++){ btns[i].disabled = true; btns[i].classList.remove('picked'); }
  if(cfg.instant){
    btns[q.a].classList.add('correct');
    if(!ok) btns[idx].classList.add('wrong');
    var v = $('verdict');
    v.className = 'verdict ' + (ok ? 'ok' : 'bad');
    v.textContent = ok ? 'Правильно.' : 'Правильна відповідь — ' + (q.a+1) + '.';
  } else {
    btns[idx].classList.add('picked');
  }
  if(!ok && mistakes.indexOf(q.id) === -1){ mistakes.push(q.id); LS.set('mistakes', mistakes); }
  if(ok){
    var mi = mistakes.indexOf(q.id);
    if(mi > -1 && S.topicId === '__mistakes__'){ mistakes.splice(mi,1); LS.set('mistakes', mistakes); }
  }
  pending = null;
  markStrip();
  updateFooter();
  if(S.strict && !S.failShown && !ok && wrongCount() > MAX_MISTAKES){
    var delay = cfg.instant ? 500 : 0;
    setTimeout(function(){ failExam('mistakes'); }, delay);
  }
}
function wrongCount(){
  var n = 0;
  for(var k=0;k<S.answers.length;k++){ var a = S.answers[k]; if(a && !a.ok) n++; }
  return n;
}
function showFailModal(reason){
  var right = S.answers.filter(function(a){ return a && a.ok; }).length;
  var wrong = wrongCount();
  var answered = answeredCount();
  if(reason === 'time'){
    $('failTitle').textContent = 'Вийшов час';
    $('failText').textContent = 'На проходження іспиту відведено ' + EXAM_MINUTES + ' хвилин, і час вийшов. ' +
      'Відповідено на ' + answered + ' із ' + S.list.length + ' питань, правильно — ' + right +
      '. Можна завершити зараз і побачити розбір, або продовжити відповідати у тренувальному режимі.';
  } else {
    $('failTitle').textContent = 'Три неправильні відповіді';
    $('failText').textContent = 'Неправильних відповідей: ' + wrong + ' із дозволених ' + MAX_MISTAKES +
      '. Відповідено на ' + answered + ' із ' + S.list.length + ' питань, правильно — ' + right + '.';
  }
  $('failModal').classList.remove('hidden');
}
function finish(){
  clearTimer();
  S.finished = true;
  var right = S.answers.filter(function(a){ return a && a.ok; }).length;
  var total = S.list.length;
  var wrong = wrongCount();
  $('scoreNum').textContent = right;
  $('scoreOf').textContent = ' / ' + total;
  var scoreEl = $('scoreNum').parentNode;
  var badge = $('verdictBadge');
  if(S.strict){
    var passed = wrong <= MAX_MISTAKES;
    scoreEl.className = 'score ' + (passed ? 'pass' : 'fail');
    badge.innerHTML = '<span class="verdict-badge ' + (passed ? 'pass' : 'fail') + '">' +
      (passed ? 'Іспит складено' : 'Іспит не складено') + '</span>';
    $('scoreText').textContent = passed ?
      'Помилок: ' + wrong + ' із дозволених ' + MAX_MISTAKES + '. Так виглядає результат складеного іспиту.' :
      'Помилок: ' + wrong + ' — більше, ніж дозволені ' + MAX_MISTAKES + '. На реальному іспиті це означало б провал.';
  } else {
    scoreEl.className = 'score';
    badge.innerHTML = '';
    var pct = right/total;
    $('scoreText').textContent = pct === 1 ? 'Ідеально. Усі відповіді правильні.' :
      pct >= 0.9 ? 'Добре — цього рівня достатньо для іспиту (дозволено 2 помилки з 20).' :
      pct >= 0.7 ? 'Непогано, але помилок ще забагато. Перегляньте розбір нижче.' :
      'Варто повернутися до теорії за цими темами.';
  }
  var isTopic = S.topicId && ['__mistakes__','__exam__','__official__','__ticket__'].indexOf(S.topicId) === -1;
  if(isTopic){
    var st = stats[S.topicId] || {best:0,total:total};
    if(right >= st.best || st.total !== total){ st.best = Math.max(right, st.best); st.total = total; }
    stats[S.topicId] = st; LS.set('stats', stats);
  }
  var host = $('review'); host.innerHTML = '';
  var wrongList = 0;
  S.list.forEach(function(q, i){
    var a = S.answers[i];
    if(a && a.ok) return;
    wrongList++;
    var d = document.createElement('div');
    d.className = 'rev';
    if(q.img){
      var thumb = document.createElement('div'); thumb.className = 'revimg';
      var im = document.createElement('img'); im.src = '/img/' + q.id + '.webp'; im.alt = ''; im.loading = 'lazy';
      im.onerror = function(){ thumb.classList.add('hidden'); };
      thumb.appendChild(im); d.appendChild(thumb);
    }
    var body = document.createElement('div'); body.className = 'revbody';
    var p = document.createElement('p'); p.textContent = (i+1) + '. ' + q.q; body.appendChild(p);
    var g = document.createElement('div'); g.className = 'a ok';
    g.textContent = 'Правильно: ' + q.o[q.a]; body.appendChild(g);
    if(a){
      var b = document.createElement('div'); b.className = 'a bad';
      b.textContent = 'Ваш вибір: ' + q.o[a.pick]; body.appendChild(b);
    } else {
      var s2 = document.createElement('div'); s2.className = 'a bad'; s2.textContent = 'Без відповіді'; body.appendChild(s2);
    }
    d.appendChild(body);
    host.appendChild(d);
  });
  if(!wrongList) host.innerHTML = '<p class="empty">Помилок немає — розбирати нічого.</p>';
  show('result');
}

/* ---------- кнопки тесту (є лише на сторінках, де проходять тест) ---------- */
if($('quiz')){
  $('failFinishBtn').onclick = function(){ $('failModal').classList.add('hidden'); finish(); };
  $('failContinueBtn').onclick = function(){ $('failModal').classList.add('hidden'); S.continued = true; };
  // не даємо кнопкам нативний фокус: інакше після приховування/заміни кнопки
  // браузер підкидає сторінку наверх
  [$('confirmBtn'), $('skipBtn'), $('nextBtn'), $('quitBtn')].forEach(function(b){
    b.onmousedown = function(e){ e.preventDefault(); };
  });
  $('confirmBtn').onclick = function(){
    if(pending === null) return;
    answer(pending);
  };
  $('skipBtn').onclick = function(){
    if(S.answers[S.i] !== undefined) return;
    pending = null;
    if(S.i < S.list.length - 1){ S.i++; renderQ(); }
    else { finish(); }
  };
  $('nextBtn').onclick = function(){
    var all = answeredCount() === S.list.length;
    var last = S.i === S.list.length - 1;
    // останнє питання, але ще не на все відповіли — ведемо до першого пропущеного
    if(last && !all){
      for(var k = 0; k < S.list.length; k++){
        if(S.answers[k] === undefined){ goTo(k); break; }
      }
      return;
    }
    if(all || last) finish();
    else { S.i++; renderQ(); }
  };
  $('quitBtn').onclick = function(){
    if(confirm('Вийти з тесту? Результат не збережеться.')){
      clearTimer();
      location.href = quitUrl();
    }
  };
  $('againBtn').onclick = function(){ if(lastStarter) lastStarter(); };
  document.addEventListener('keydown', function(e){
    if($('quiz').classList.contains('hidden') || !S) return;
    if(e.key >= '1' && e.key <= '9'){
      var b = $('opts').children[parseInt(e.key,10)-1];
      if(b && !b.disabled) b.click();
    } else if(e.key === 'Enter'){
      if(!$('nextBtn').classList.contains('hidden') && !$('nextBtn').disabled) $('nextBtn').click();
      else if(!$('confirmBtn').classList.contains('hidden') && !$('confirmBtn').disabled) $('confirmBtn').click();
    } else if(e.key === 'ArrowRight'){ goTo(S.i + 1); }
    else if(e.key === 'ArrowLeft'){ goTo(S.i - 1); }
  });
}

/* ---------- лого/назва → головна (з підтвердженням, якщо тест іде) ---------- */
(function(){
  var brand = document.querySelector('a.brand');
  if(!brand) return;
  brand.addEventListener('click', function(e){
    if(S && !S.finished){
      if(confirm('Ви зараз проходите тест. Перейти на головну? Результат тесту не збережеться.')){
        clearTimer();
      } else {
        e.preventDefault();
      }
    }
  });
})();

/* ---------- вибір категорії ---------- */
function renderCatRow(){
  var host = $('catrow'); if(!host) return;
  host.innerHTML = '';
  CATS.forEach(function(c){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (cfg.category === c.id ? ' on' : '');
    b.innerHTML = c.id + '<small>' + c.label + '</small>';
    b.onclick = function(){
      cfg.category = c.id; LS.set('cfg', cfg);
      renderCatRow();
    };
    host.appendChild(b);
  });
}

/* ---------- точки входу: запуск тестів ---------- */
function startOfficialExam(){
  var built = buildComposition(cfg.category, Math.random);
  if(built.list.length < 20 || built.shortfall){
    if(!confirm('За поточних налаштувань бракує звірених питань за категорією ' + cfg.category +
      ', частину добрано з незвірених. Продовжити?')) return;
  }
  start(built.list, 'Екзамен · категорія ' + cfg.category, '__official__', {preShuffled:true, category:cfg.category, strict:true});
}
function startTicket(num){
  var rng = hashSeed('pdr25:' + cfg.category + ':' + num);
  var built = buildComposition(cfg.category, rng);
  start(built.list, 'Білет ' + num + ' · категорія ' + cfg.category, '__ticket__',
    {preShuffled:true, ticketNum:num, category:cfg.category, strict:true});
}
function startRandom(){
  var p = pool();
  if(p.length < 5){ alert('Замало питань за поточних налаштувань.'); return; }
  start(p, 'Випадковий тест', '__exam__', {limit:20});
}
function startMistakes(){
  var set = {};
  mistakes.forEach(function(id){ set[id] = true; });
  var qs = ALL.filter(function(q){ return set[q.id] && q.a !== null; });
  if(!qs.length){ return; }
  start(qs, 'Робота над помилками', '__mistakes__', {limit:Math.min(qs.length, 20)});
}
function runStarter(fn){ lastStarter = fn; fn(); }

/* ============================================================
   Ініціалізація залежно від сторінки
   ============================================================ */
function initHome(){
  var mc = $('mistCount'); if(mc) mc.textContent = mistakes.length;
  var sw = $('swInstant');
  if(sw){
    sw.setAttribute('aria-checked', cfg.instant ? 'true' : 'false');
    sw.onclick = function(){
      cfg.instant = !cfg.instant;
      sw.setAttribute('aria-checked', cfg.instant ? 'true' : 'false');
      LS.set('cfg', cfg);
    };
  }
  var rb = $('resetBtn');
  if(rb){
    rb.onclick = function(){
      stats = {}; mistakes = []; LS.del('stats'); LS.del('mistakes');
      if(mc) mc.textContent = 0;
      rb.textContent = 'Скинуто';
      setTimeout(function(){ rb.textContent = 'Скинути'; }, 1400);
    };
  }
}

function initTopics(){
  // прогрес по темах (і по групах знаків) із localStorage
  Array.prototype.forEach.call(document.querySelectorAll('#topicList [data-topic]'), function(el){
    var st = stats[el.getAttribute('data-topic')];
    if(!st || !st.total) return;
    var pct = Math.round(st.best/st.total*100);
    var t = el.querySelector('.t');
    t.querySelector('small').textContent += ' · найкраще ' + st.best + '/' + st.total;
    var bar = document.createElement('span');
    bar.className = 'bar';
    bar.innerHTML = '<i style="width:' + pct + '%"></i>';
    t.appendChild(bar);
  });
  // пошук: за назвою/номером теми одразу, за текстом питань — після підвантаження data.js
  var items = Array.prototype.slice.call(document.querySelectorAll('#topicList > [data-topic]'));
  var input = $('search'), empty = $('topicsEmpty');
  if(!input) return;
  function apply(){
    var f = input.value.trim().toLowerCase();
    var shown = 0;
    items.forEach(function(el){
      var id = el.getAttribute('data-topic');
      var title = el.querySelector('b').textContent.toLowerCase();
      var hit = !f || title.indexOf(f) > -1 || id.indexOf(f) === 0;
      if(!hit && ALL.length){
        hit = ALL.some(function(q){ return q.topic === id && q.q.toLowerCase().indexOf(f) > -1; });
      }
      el.classList.toggle('hidden', !hit);
      if(hit) shown++;
    });
    if(empty) empty.classList.toggle('hidden', shown > 0);
  }
  input.oninput = function(){
    apply();
    if(input.value.trim() && !ALL.length) ensureData(apply);
  };
}

function initTopic(){
  // data-topic: «6», «33» або «33.1» (група знаків); data-group — id групи знаків
  var id = document.body.getAttribute('data-topic');
  var group = document.body.getAttribute('data-group');
  var mainId = group ? SIGN_TOPIC_ID : id;
  var title = 'Тема ' + id + ' - ' + topicTitleById(mainId);
  var qs = group ? signGroupPool(group) : topicPool(mainId);
  if(!qs.length){
    $('quiz').classList.add('hidden');
    $('topicEmpty').classList.remove('hidden');
    return;
  }
  runStarter(function(){ start(qs, title, id, {preShuffled: true}); });
}

function initExam(){
  renderCatRow();
  $('startBtn').onclick = function(){ runStarter(startOfficialExam); };
}
function initTicket(){
  var num = parseInt(document.body.getAttribute('data-ticket'), 10);
  renderCatRow();
  $('startBtn').onclick = function(){ runStarter(function(){ startTicket(num); }); };
}
function initTickets(){
  renderCatRow();
  var btn = $('startBtn'), picked = null;
  var links = Array.prototype.slice.call(document.querySelectorAll('.tgrid a[data-ticket]'));
  links.forEach(function(a){
    a.addEventListener('click', function(e){
      // звичайний клік — лише вибір номера; Ctrl/Cmd/середня кнопка відкривають /tickets/<N>/
      if(e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      picked = parseInt(a.getAttribute('data-ticket'), 10);
      links.forEach(function(x){ x.classList.toggle('on', x === a); });
      btn.disabled = false;
      btn.textContent = 'Почати білет №' + picked;
    });
  });
  btn.disabled = true;
  btn.onclick = function(){
    if(picked == null) return;
    var num = picked;
    runStarter(function(){ startTicket(num); });
  };
}
function initRandom(){
  $('startBtn').onclick = function(){ runStarter(startRandom); };
}
function initMistakes(){
  var count = ALL.filter(function(q){ return mistakes.indexOf(q.id) > -1 && q.a !== null; }).length;
  $('mistCount').textContent = count;
  if(!count){
    $('mistEmpty').classList.remove('hidden');
    $('startBtn').classList.add('hidden');
    return;
  }
  $('startBtn').onclick = function(){ runStarter(startMistakes); };
}

switch(PAGE){
  case 'home':     initHome(); break;
  case 'topics':   initTopics(); break;
  case 'topic':    initTopic(); break;
  case 'exam':     initExam(); break;
  case 'tickets':  initTickets(); break;
  case 'ticket':   initTicket(); break;
  case 'random':   initRandom(); break;
  case 'mistakes': initMistakes(); break;
}
})();
