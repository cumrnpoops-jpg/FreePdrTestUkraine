(function(){
"use strict";
var DATA = window.PDR_DATA;
var LS = {
  get:function(k,d){ try{ var v=localStorage.getItem('pdr25:'+k); return v==null?d:JSON.parse(v);}catch(e){return d;} },
  set:function(k,v){ try{ localStorage.setItem('pdr25:'+k, JSON.stringify(v)); }catch(e){} },
  del:function(k){ try{ localStorage.removeItem('pdr25:'+k); }catch(e){} }
};
var cfg = LS.get('cfg', {verified:true, hideImg:false, instant:true, category:'B'});
var stats = LS.get('stats', {});      // topicId -> {best:0,total:0}
var mistakes = LS.get('mistakes', []); // question ids
var $ = function(id){ return document.getElementById(id); };

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

/* ---------- theme ---------- */
var theme = LS.get('theme', null);
if(theme) document.documentElement.setAttribute('data-theme', theme);
else document.documentElement.removeAttribute('data-theme');
$('themeBtn').onclick = function(){
  var cur = document.documentElement.getAttribute('data-theme');
  var next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  LS.set('theme', next);
};

/* ---------- lightbox (повноекранний перегляд ілюстрації) ---------- */
$('qimg').onclick = function(){
  $('lightboxImg').src = $('qimgEl').src;
  $('lightboxImg').alt = $('qimgEl').alt;
  $('lightbox').classList.remove('hidden');
};
$('lightbox').onclick = function(){ $('lightbox').classList.add('hidden'); };
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && !$('lightbox').classList.contains('hidden')) $('lightbox').classList.add('hidden');
});

/* ---------- pool ---------- */
var ALL = [];
DATA.forEach(function(s){
  s.questions.forEach(function(q){
    q.topic = s.id; q.topicTitle = s.title; ALL.push(q);
  });
});
function allowed(q){
  if(q.a === null || q.a === undefined) return false;
  if(cfg.verified && !q.v) return false;
  if(cfg.hideImg && q.img) return false;
  return true;
}
function pool(){ return ALL.filter(allowed); }
function topicPool(id){ return ALL.filter(function(q){ return q.topic === id && allowed(q); }); }
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

/* ---------- home ---------- */
function renderHome(filter){
  filter = (filter||'').trim().toLowerCase();
  $('poolCount').textContent = pool().length;
  $('mistCount').textContent = mistakes.length;
  var host = $('topics'); host.innerHTML = '';
  var shown = 0;
  DATA.forEach(function(s){
    var qs = topicPool(s.id);
    if(!qs.length) return;
    if(filter){
      var hitTitle = s.title.toLowerCase().indexOf(filter) > -1 || s.id.indexOf(filter) === 0;
      if(!hitTitle){
        var hitQ = qs.some(function(q){ return q.q.toLowerCase().indexOf(filter) > -1; });
        if(!hitQ) return;
      }
    }
    shown++;
    var st = stats[s.id] || {best:0,total:0};
    var pct = st.total ? Math.round(st.best/st.total*100) : 0;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'topic';
    b.innerHTML = '<span class="num"></span><span class="t"><b></b><small></small>' +
      (st.total ? '<span class="bar"><i style="width:'+pct+'%"></i></span>' : '') +
      '</span><span class="go">›</span>';
    b.querySelector('.num').textContent = s.id;
    b.querySelector('b').textContent = s.title;
    b.querySelector('small').textContent = qs.length + ' пит.' +
      (st.total ? ' · найкраще ' + st.best + '/' + st.total : '') +
      (s.trusted ? '' : ' · відповіді не звірені');
    // b.onclick = function(){ start(qs, s.title, s.id, {}); }; шафл
    b.onclick = function(){ start(qs, s.title, s.id, {preShuffled: true}); };
    host.appendChild(b);
  });
  if(!shown){
    host.innerHTML = '<p class="empty">Нічого не знайшли. Спробуйте інший запит або увімкніть незвірені питання в налаштуваннях.</p>';
  }
}
$('search').oninput = function(){ renderHome(this.value); };

/* ---------- settings ---------- */
function sw(el, key, after){
  el.setAttribute('aria-checked', cfg[key] ? 'true' : 'false');
  el.onclick = function(){
    cfg[key] = !cfg[key];
    el.setAttribute('aria-checked', cfg[key] ? 'true' : 'false');
    LS.set('cfg', cfg);
    if(after) after();
  };
}
sw($('swVerified'), 'verified', function(){ renderHome($('search').value); });
sw($('swImg'), 'hideImg', function(){ renderHome($('search').value); });
sw($('swInstant'), 'instant');
$('setBtn').onclick = function(){ show('settings'); };
$('setBack').onclick = function(){ show('home'); renderHome($('search').value); };
$('resetBtn').onclick = function(){
  stats = {}; mistakes = []; LS.del('stats'); LS.del('mistakes');
  renderHome($('search').value);
  $('resetBtn').textContent = 'Скинуто';
  setTimeout(function(){ $('resetBtn').textContent = 'Скинути'; }, 1400);
};

/* ---------- screens ---------- */
function show(name){
  ['home','settings','quiz','result','tickets'].forEach(function(n){ $(n).classList.toggle('hidden', n !== name); });
  $('footbar').classList.toggle('hidden', name !== 'quiz');
  window.scrollTo(0,0);
}

/* ---------- quiz engine ---------- */
var S = null;
function shuffle(a, rng){
  rng = rng || Math.random;
  a = a.slice();
  for(var i=a.length-1;i>0;i--){ var j=Math.floor(rng()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}
function start(qs, title, topicId, opts){
  if(!qs.length){ return; }
  if(S && S.timerId){ clearInterval(S.timerId); }
  opts = opts || {};
  var list = opts.preShuffled ? qs.slice() : shuffle(qs);
  if(opts.limit) list = list.slice(0, opts.limit);
  S = {list:list, i:0, answers:[], title:title, topicId:topicId||null, limit:opts.limit||null,
       ticketNum:opts.ticketNum||null, category:opts.category||null,
       strict:!!opts.strict, failShown:false, failReason:null, continued:false,
       examEndAt: opts.strict ? (Date.now() + EXAM_MINUTES*60*1000) : null, timerId:null};
  show('quiz');
  renderQ();
  if(S.examEndAt != null) startTimer(); else $('qtimer').classList.add('hidden');
}
/* ---------- таймер іспиту (20 хв, лише для «Екзамен» і білетів) ---------- */
var EXAM_MINUTES = 20;
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
var pending = null; // обраний, але ще не підтверджений варіант поточного питання
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
    imgEl.src = 'img/' + q.id + '.webp';
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
if (last && !all) {
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
  if(!S || k === S.i || k < 0 || k >= S.list.length) return;
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
var MAX_MISTAKES = 2; // дозволено помилок; третя — провал
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
$('failFinishBtn').onclick = function(){ $('failModal').classList.add('hidden'); finish(); };
$('failContinueBtn').onclick = function(){ $('failModal').classList.add('hidden'); S.continued = true; };
// той самий фікс, що й для кнопок-варіантів: не даємо кнопці нативний фокус,
// інакше після приховування/заміни кнопки браузер підкидає сторінку наверх
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
  
  // Якщо це останнє питання, але ще не на все відповіли
  if (last && !all) {
    // Шукаємо перше ліворуч чи праворуч питання, на яке ще НЕМАЄ відповіді
    var nextUnanswered = -1;
    for(var k = 0; k < S.list.length; k++){
      if(S.answers[k] === undefined){
        nextUnanswered = k;
        break; // Знайшли перше пропущене — зупиняємо пошук
      }
    }
    if(nextUnanswered !== -1){
      goTo(nextUnanswered); // Перекидаємо на нього
    }
    return;
  }
  
  // Стандартна логіка: якщо все пройшли або це справжній кінець — завершуємо, інакше йдемо на +1
  if(all || last) {
    finish();
  } else {
    S.i++; 
    renderQ();
  }
};
$('quitBtn').onclick = function(){ if(confirm('Вийти з тесту? Результат не збережеться.')){ clearTimer(); show('home'); renderHome($('search').value); } };

function finish(){
  clearTimer();
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
  var wrong = 0;
  S.list.forEach(function(q, i){
    var a = S.answers[i];
    if(a && a.ok) return;
    wrong++;
    var d = document.createElement('div');
    d.className = 'rev';
    if(q.img){
      var thumb = document.createElement('div'); thumb.className = 'revimg';
      var im = document.createElement('img'); im.src = 'img/' + q.id + '.webp'; im.alt = ''; im.loading = 'lazy';
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
  if(!wrong) host.innerHTML = '<p class="empty">Помилок немає — розбирати нічого.</p>';
  show('result');
}
$('againBtn').onclick = function(){
  if(S.topicId === '__exam__') startExam();
  else if(S.topicId === '__mistakes__') startMistakes();
  else if(S.topicId === '__official__') startOfficialExam();
  else if(S.topicId === '__ticket__') startTicket(S.ticketNum);
  //else start(topicPool(S.topicId), S.title, S.topicId, {limit:S.limit}); шафл знову
  else start(topicPool(S.topicId), S.title, S.topicId, {limit:S.limit, preShuffled: true});
};
$('homeBtn').onclick = function(){ show('home'); renderHome($('search').value); };

/* ---------- entry points ---------- */
function startExam(){
  var p = pool();
  if(p.length < 5){ alert('Замало питань за поточних налаштувань.'); return; }
  start(p, 'Випадковий тест', '__exam__', {limit:20});
}
function startMistakes(){
  var set = {};
  mistakes.forEach(function(id){ set[id] = true; });
  var qs = ALL.filter(function(q){ return set[q.id] && q.a !== null; });
  if(!qs.length){ alert('Помилок поки немає. Пройдіть тест — сюди потраплять питання, у яких ви помилилися.'); return; }
  start(qs, 'Робота над помилками', '__mistakes__', {limit:Math.min(qs.length, 20)});
}
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
$('examBtn').onclick = startExam;
$('mistakesBtn').onclick = startMistakes;
$('officialBtn').onclick = startOfficialExam;

/* ---------- category chips ---------- */
function renderCatRow(elId){
  var host = $(elId); if(!host) return;
  host.innerHTML = '';
  CATS.forEach(function(c){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (cfg.category === c.id ? ' on' : '');
    b.innerHTML = c.id + '<small>' + c.label + '</small>';
    b.onclick = function(){
      cfg.category = c.id; LS.set('cfg', cfg);
      renderCatRow('catrow'); renderCatRow('catrowTickets');
      if(!$('tickets').classList.contains('hidden')) renderTickets();
    };
    host.appendChild(b);
  });
}

/* ---------- tickets ---------- */
var TICKET_COUNT = 40;
function renderTickets(){
  var host = $('ticketGrid'); host.innerHTML = '';
  for(var n=1;n<=TICKET_COUNT;n++){
    (function(n){
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = n + '<small>білет</small>';
      b.onclick = function(){ startTicket(n); };
      host.appendChild(b);
    })(n);
  }
}
$('ticketsBtn').onclick = function(){ renderCatRow('catrowTickets'); renderTickets(); show('tickets'); };
$('ticketsBack').onclick = function(){ show('home'); };

document.addEventListener('keydown', function(e){
  if($('quiz').classList.contains('hidden')) return;
  if(e.key >= '1' && e.key <= '9'){
    var b = $('opts').children[parseInt(e.key,10)-1];
    if(b && !b.disabled) b.click();
  } else if(e.key === 'Enter'){
    if(!$('nextBtn').classList.contains('hidden') && !$('nextBtn').disabled) $('nextBtn').click();
    else if(!$('confirmBtn').classList.contains('hidden') && !$('confirmBtn').disabled) $('confirmBtn').click();
  } else if(e.key === 'ArrowRight'){ goTo(S.i + 1); }
  else if(e.key === 'ArrowLeft'){ goTo(S.i - 1); }
});

$('subhead').textContent = ALL.length + ' питань · ' + DATA.length + ' тем';
renderCatRow('catrow');
renderHome('');
})();

