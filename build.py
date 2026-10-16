#!/usr/bin/env python3
"""Генератор сторінок сайту FREE TEST PDR.

Запуск (з папки проєкту):   python3 build.py

Створює статичні HTML-сторінки (кожна в своїй папці, щоб працювали чисті
адреси на GitHub Pages / будь-якому статичному хостингу):

  /                          index.html
  /exam/                     іспит
  /topics/                   список тем
  /topics/<id>test/          тест за темою  (8.1 -> /topics/8-1test/)
  /topics/33-<N>test/        тест за групою дорожніх знаків (33-1test — попереджувальні, ...)
  /tickets/                  список білетів
  /tickets/<N>/              білет №N       (N = 1..TICKET_COUNT)
  /tickets/random/           20 випадкових питань
  /mistakes/                 робота над помилками
  sitemap.xml                оновлюється автоматично

Список і назви тем беруться з js/data.js, групи знаків — з sign-groups.json
(з нього ж створюється js/signs.js), тож після зміни даних достатньо
перезапустити цей скрипт. Ілюстрації (img/*.webp) скрипт не чіпає.
"""
import html
import json
import os
import re
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = "https://freetestpdr.com"
TICKET_COUNT = 40
LASTMOD = date.today().isoformat()

SLOGAN = "Тестові питання правил дорожнього руху України, повністю безкоштовно."
EXAM_NOTE = ("Іспит складається з 20 питань за офіційною структурою: 10 ПДР, 4 з основ безпеки, "
             "4 з будови (залежно від категорії), 2 з домедичної допомоги.")
TICKET_NOTE = ("Кожен білет — це той самий набір із 20 питань за структурою іспиту "
               "(для обраної категорії), поки не зміните категорію чи дані.")

GA = """<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-S39BPPF8ND"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-S39BPPF8ND');
</script>"""


# Виконується ДО підключення стилів, щоб темна тема не «блимала» світлою
# при переході між сторінками (збережена тема читається з localStorage).
THEME_INIT = """<script>
(function(){try{var t=JSON.parse(localStorage.getItem('pdr25:theme'));
if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();
</script>"""


def esc(s):
    return html.escape(s, quote=True)


def load_data():
    with open(os.path.join(ROOT, "js", "data.js"), encoding="utf-8") as f:
        raw = f.read().strip()
    raw = re.sub(r"^window\.PDR_DATA\s*=\s*", "", raw)
    raw = re.sub(r";\s*$", "", raw)
    return json.loads(raw)


def load_sign_groups():
    with open(os.path.join(ROOT, "sign-groups.json"), encoding="utf-8") as f:
        return json.load(f)


def write_signs_js(groups):
    with open(os.path.join(ROOT, "js", "signs.js"), "w", encoding="utf-8") as f:
        f.write("window.SIGN_GROUPS = " + json.dumps(groups, ensure_ascii=False, separators=(",", ":")) + ";\n")


def topic_slug(tid):
    return tid.replace(".", "-") + "test"


# ---------------------------------------------------------------- шматки сторінок
def head(title, desc, path):
    return f"""<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{THEME_INIT}
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{SITE}{path}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Commissioner:wght@400;500;600;700&family=Unbounded:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/styles.css">
<link rel="icon" type="image/png" href="/favicon.png">
{GA}
</head>
"""


HEADER = """  <header class="top">
    <a class="brand" href="/" title="На головну">
      <div class="mark">PDR</div>
      <span class="name">FREE TEST PDR</span>
    </a>
    <button class="icon-btn" id="themeBtn" title="Змінити тему">Тема</button>
  </header>
"""

QUIZ_BLOCK = """    <!-- ТЕСТ -->
    <section id="quiz" class="hidden">
      <div class="strip" id="strip"></div>
      <div class="qmeta">
        <span id="qpos">1 / 20</span>
        <span class="tag" id="qtopic">Тема</span>
        <span class="tag warn hidden" id="qwarn">відповідь не звірена</span>
        <span class="tag timer hidden" id="qtimer">20:00</span>
      </div>
      <h2 class="qtext" id="qtext"></h2>
      <div class="qbody">
        <div class="qimgwrap hidden" id="qimg"><img id="qimgEl" alt="Ілюстрація до питання" loading="lazy"></div>
        <div class="opts" id="opts"></div>
      </div>
      <div class="verdict hidden" id="verdict"></div>
    </section>

    <!-- РЕЗУЛЬТАТ -->
    <section id="result" class="hidden">
      <div class="hero">
        <div id="verdictBadge"></div>
        <div class="score"><span id="scoreNum">0</span><small id="scoreOf"> / 20</small></div>
        <p id="scoreText">—</p>
        <div class="row-btns">
          <button class="btn" id="againBtn">Пройти ще раз</button>
          <a class="btn secondary" href="/">На головну</a>
        </div>
      </div>
      <div id="review"></div>
    </section>
"""

QUIZ_TAIL = """<div class="footbar hidden" id="footbar">
  <div class="inner">
    <button class="link" id="quitBtn">Вийти</button>
    <button class="btn secondary skip" id="skipBtn">Пропустити</button>
    <button class="btn" id="confirmBtn" style="flex:1">Обрати</button>
    <button class="btn hidden" id="nextBtn" style="flex:1">Далі</button>
  </div>
</div>

<div class="modal-overlay hidden" id="failModal">
  <div class="modal-card">
    <span class="tag bad">Іспит не складено</span>
    <h3 id="failTitle">Три неправильні відповіді</h3>
    <p id="failText">У цьому іспиті дозволено не більше двох помилок. Можна завершити зараз і побачити розбір, або продовжити відповідати на решту питань у тренувальному режимі.</p>
    <button class="btn" id="failFinishBtn">Завершити й переглянути розбір</button>
    <button class="btn secondary" id="failContinueBtn">Продовжити тест</button>
  </div>
</div>

<div class="lightbox hidden" id="lightbox"><img id="lightboxImg" alt=""></div>
"""

CATEGORY_BLOCK = """      <div class="cathead">
        <b>Категорія</b>
        <small>використовується для іспиту й білетів</small>
      </div>
      <div class="catrow" id="catrow"></div>
"""

BACK_HOME = '    <a class="btn secondary intro-back" href="/">На головну</a>\n'


def page(*, title, desc, path, page_id, body, quit_url="/", data_attrs="", with_quiz=False, with_data=False,
         with_signs=False):
    """Збирає повну HTML-сторінку."""
    out = head(title, desc, path)
    out += f'<body data-page="{page_id}" data-quit="{quit_url}"{data_attrs}>\n'
    out += '<div class="wrap">\n' + HEADER + "\n  <main>\n" + body
    if with_quiz:
        out += "\n" + QUIZ_BLOCK
    out += "  </main>\n</div>\n\n"
    if with_quiz:
        out += QUIZ_TAIL + "\n"
    if with_signs:
        out += '<script src="/js/signs.js"></script>\n'
    if with_data:
        out += '<script src="/js/data.js"></script>\n'
    out += '<script src="/js/app.js"></script>\n</body>\n</html>\n'
    return out


def write(path, content):
    """path — URL-шлях, напр. /exam/ ; '/' -> index.html у корені."""
    rel = path.strip("/")
    folder = os.path.join(ROOT, rel) if rel else ROOT
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, "index.html"), "w", encoding="utf-8") as f:
        f.write(content)


# ---------------------------------------------------------------- сторінки
def navcard(href, title_html, small):
    return (f'      <a class="navcard" href="{href}"><span class="t"><b>{title_html}</b>'
            f'<small>{esc(small)}</small></span><span class="go">›</span></a>\n')


def build_home():
    body = f"""    <!-- ГОЛОВНА -->
    <section id="home">
      <h1 class="lead">{esc(SLOGAN)}</h1>

      <nav class="navlist" aria-label="Розділи сайту">
{navcard("/exam/", "Іспит", "20 питань за офіційною структурою іспиту")}{navcard("/topics/", "Питання за темами", "Список усіх тем тестів ПДР")}{navcard("/tickets/", "Білети", "Білети правил дорожнього руху України")}{navcard("/mistakes/", 'Помилки (<span id="mistCount">0</span>)', "Питання, у яких ви помилилися")}      </nav>

      <h2 class="sect-title">Налаштування</h2>
      <div class="sheet">
        <div class="set">
          <div class="t"><b>Показувати відповідь одразу</b>
            <small>Вимкніть, щоб бачити результат лише наприкінці тесту.</small></div>
          <button class="sw" id="swInstant" role="switch" aria-checked="true"><i></i></button>
        </div>
        <div class="set">
          <div class="t"><b>Скинути прогрес</b>
            <small>Видаляє статистику за темами та збережені помилки.</small></div>
          <button class="btn secondary" style="width:auto;padding:8px 14px" id="resetBtn">Скинути</button>
        </div>
      </div>

      <p class="seo-text">{esc(SLOGAN)}</p>
    </section>
"""
    write("/", page(
        title="FREE TEST PDR — безкоштовні тести ПДР України",
        desc="Тестові питання правил дорожнього руху України, повністю безкоштовно: іспит, білети, питання за темами.",
        path="/", page_id="home", body=body))


def build_exam():
    body = f"""    <!-- ІСПИТ: вступ -->
    <section id="intro">
      <h1 class="pagetitle">Іспит правил дорожнього руху України</h1>
      <div class="hero">
{CATEGORY_BLOCK}        <button class="btn" id="startBtn">Почати іспит</button>
        <p class="note">{esc(EXAM_NOTE)}</p>
      </div>
{BACK_HOME}    </section>
"""
    write("/exam/", page(
        title="Іспит правил дорожнього руху України — безкоштовний тест ПДР онлайн",
        desc="Безкоштовний іспит з правил дорожнього руху України: 20 питань за офіційною структурою (10 ПДР, 4 основи безпеки, 4 будова ТЗ, 2 домедична допомога).",
        path="/exam/", page_id="exam", quit_url="/exam/", body=body, with_quiz=True, with_data=True))


def group_counts(data, groups):
    """Скільки доступних питань у кожній групі знаків (розділ 33, поле n)."""
    s33 = next(s for s in data if s["id"] == "33")
    by_n = {}
    for g in groups:
        for n in g["nums"]:
            by_n[n] = g["id"]
    counts = {g["id"]: 0 for g in groups}
    for q in s33["questions"]:
        if q.get("a") is not None and q.get("v") and by_n.get(q["n"]) in counts:
            counts[by_n[q["n"]]] += 1
    return counts


def group_slug(i):
    return f"33-{i}test"


def build_topics(data, groups, gcounts):
    items = ""
    for s in data:
        n = sum(1 for q in s["questions"] if q.get("a") is not None and q.get("v"))
        if not n:
            continue
        if s["id"] == "33":
            # «Дорожні знаки» розкривається списком груп (нативний <details>)
            subs = (f'          <a class="topic sub" href="/topics/{topic_slug("33")}/">'
                    f'<span class="t"><b>Усі питання розділу</b><small>{n} пит.</small></span>'
                    f'<span class="go">›</span></a>\n')
            for i, g in enumerate(groups, 1):
                if not gcounts[g["id"]]:
                    continue
                subs += (f'          <a class="topic sub" href="/topics/{group_slug(i)}/" data-topic="33.{i}">'
                         f'<span class="t"><b>{esc(g["label"])}</b><small>{gcounts[g["id"]]} пит.</small></span>'
                         f'<span class="go">›</span></a>\n')
            items += (f'      <details class="topic-group" data-topic="33">\n'
                      f'        <summary class="topic"><span class="num">33</span><span class="t">'
                      f'<b>{esc(s["title"])}</b><small>{n} пит.</small></span><span class="go">›</span></summary>\n'
                      f'        <div class="subtopics">\n{subs}        </div>\n      </details>\n')
            continue
        items += (f'      <a class="topic" href="/topics/{topic_slug(s["id"])}/" data-topic="{esc(s["id"])}">'
                  f'<span class="num">{esc(s["id"])}</span><span class="t"><b>{esc(s["title"])}</b>'
                  f'<small>{n} пит.</small></span><span class="go">›</span></a>\n')
    body = f"""    <!-- ТЕМИ -->
    <section id="topicsPage">
      <h1 class="pagetitle">Тестові питання по темам правил дорожнього руху України</h1>
      <input class="search" id="search" type="search" placeholder="Пошук теми або питання" autocomplete="off">
      <div id="topicList">
{items}      </div>
      <p class="empty hidden" id="topicsEmpty">Нічого не знайшли. Спробуйте інший запит.</p>
{BACK_HOME}    </section>
"""
    write("/topics/", page(
        title="Питання за темами правил дорожнього руху України — тести ПДР безкоштовно",
        desc="Список усіх тем тестів ПДР України: тестові питання по темам правил дорожнього руху, повністю безкоштовно.",
        path="/topics/", page_id="topics", body=body))


def build_topic(s):
    tid = s["id"]
    n = sum(1 for q in s["questions"] if q.get("a") is not None and q.get("v"))
    slug = topic_slug(tid)
    path = f"/topics/{slug}/"
    heading = f'Тема {tid} - {s["title"]}'
    body = f"""    <h1 class="pagetitle">{esc(heading)}</h1>
    <p class="empty hidden" id="topicEmpty">У цій темі поки немає питань. <a href="/topics/">До списку тем</a></p>
"""
    write(path, page(
        title=f"{heading} — тест ПДР онлайн безкоштовно",
        desc=f"Тестові питання правил дорожнього руху України. {heading}: {n} питань з відповідями, повністю безкоштовно.",
        path=path, page_id="topic", quit_url="/topics/", body=body,
        data_attrs=f' data-topic="{esc(tid)}"', with_quiz=True, with_data=True))
    return path


def build_topic_group(s33, i, g, count):
    """Тест по групі знаків: /topics/33-<i>test/ (напр. 33-1test — попереджувальні знаки)."""
    path = f"/topics/{group_slug(i)}/"
    heading = f'Тема 33.{i} - {s33["title"]}: {g["label"]}'
    body = f"""    <h1 class="pagetitle">{esc(heading)}</h1>
    <p class="empty hidden" id="topicEmpty">У цій групі поки немає питань. <a href="/topics/">До списку тем</a></p>
"""
    write(path, page(
        title=f"{heading} — тест ПДР онлайн безкоштовно",
        desc=f"Тестові питання правил дорожнього руху України. {g['label']} (тема 33, дорожні знаки): {count} питань з відповідями, безкоштовно.",
        path=path, page_id="topic", quit_url="/topics/", body=body,
        data_attrs=f' data-topic="33.{i}" data-group="{esc(g["id"])}"',
        with_quiz=True, with_data=True, with_signs=True))
    return path


def build_tickets():
    grid = "".join(f'          <a href="/tickets/{n}/" data-ticket="{n}">{n}<small>білет</small></a>\n'
                   for n in range(1, TICKET_COUNT + 1))
    body = f"""    <!-- БІЛЕТИ: вибір категорії й номера, старт на цій самій сторінці -->
    <section id="intro">
      <h1 class="pagetitle">Білети правил дорожнього руху України</h1>
      <div class="hero">
{CATEGORY_BLOCK}        <div class="cathead">
          <b>Білет</b>
          <small>оберіть номер білета</small>
        </div>
        <div class="tgrid">
{grid}        </div>
        <button class="btn" id="startBtn" style="margin-top:18px" disabled>Оберіть білет</button>
        <p class="note">{esc(TICKET_NOTE)}</p>
      </div>
      <a class="navcard tickets-random" href="/tickets/random/"><span class="t"><b>20 випадкових питань</b><small>Тест із випадкових питань усіх тем</small></span><span class="go">›</span></a>
{BACK_HOME}    </section>
"""
    write("/tickets/", page(
        title="Білети правил дорожнього руху України — безкоштовні тести ПДР",
        desc=f"Безкоштовні білети ПДР України: {TICKET_COUNT} білетів по 20 питань за структурою офіційного іспиту, а також 20 випадкових питань.",
        path="/tickets/", page_id="tickets", quit_url="/tickets/", body=body, with_quiz=True, with_data=True))


def build_ticket(n):
    path = f"/tickets/{n}/"
    heading = f"Білет №{n} правил дорожнього руху України"
    body = f"""    <!-- БІЛЕТ: вступ -->
    <section id="intro">
      <h1 class="pagetitle">{esc(heading)}</h1>
      <div class="hero">
{CATEGORY_BLOCK}        <button class="btn" id="startBtn">Почати білет</button>
        <p class="note">{esc(TICKET_NOTE)}</p>
      </div>
      <a class="btn secondary intro-back" href="/tickets/">Усі білети</a>
    </section>
"""
    write(path, page(
        title=f"{heading} — тест ПДР онлайн безкоштовно",
        desc=f"Білет №{n} з правил дорожнього руху України: 20 питань за структурою офіційного іспиту, безкоштовно онлайн.",
        path=path, page_id="ticket", quit_url="/tickets/", body=body,
        data_attrs=f' data-ticket="{n}"', with_quiz=True, with_data=True))
    return path


def build_random():
    path = "/tickets/random/"
    body = """    <!-- 20 ВИПАДКОВИХ: вступ -->
    <section id="intro">
      <h1 class="pagetitle">20 випадкових питань правил дорожнього руху України</h1>
      <div class="hero">
        <button class="btn" id="startBtn">Почати тест</button>
        <p class="note">Двадцять випадкових питань з усіх тем. Тест без обмеження часу, а правильна відповідь показується одразу (це можна змінити в налаштуваннях на головній сторінці).</p>
      </div>
      <a class="btn secondary intro-back" href="/tickets/">Усі білети</a>
    </section>
"""
    write(path, page(
        title="20 випадкових питань правил дорожнього руху України — тест ПДР безкоштовно",
        desc="Двадцять випадкових питань з правил дорожнього руху України: швидкий безкоштовний тест онлайн.",
        path=path, page_id="random", quit_url="/tickets/", body=body, with_quiz=True, with_data=True))
    return path


def build_mistakes():
    body = """    <!-- ПОМИЛКИ: вступ -->
    <section id="intro">
      <h1 class="pagetitle">Помилки</h1>
      <div class="hero">
        <p style="margin-top:0">Питань для повторення: <b id="mistCount">0</b>. Правильна відповідь прибирає питання зі списку помилок.</p>
        <button class="btn" id="startBtn">Почати</button>
        <p class="empty hidden" id="mistEmpty">Помилок поки немає. Пройдіть тест, і сюди потраплять питання, у яких ви помилилися.</p>
      </div>
""" + BACK_HOME + """    </section>
"""
    write("/mistakes/", page(
        title="Помилки — повторення питань ПДР",
        desc="Повторення питань правил дорожнього руху України, у яких ви помилилися.",
        path="/mistakes/", page_id="mistakes", quit_url="/", body=body, with_quiz=True, with_data=True))


def build_sitemap(paths):
    urls = ""
    for p, prio in paths:
        urls += (f"  <url>\n    <loc>{SITE}{p}</loc>\n    <lastmod>{LASTMOD}</lastmod>\n"
                 f"    <changefreq>monthly</changefreq>\n    <priority>{prio}</priority>\n  </url>\n")
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '</urlset>\n')
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(xml)


def main():
    data = load_data()
    groups = load_sign_groups()
    write_signs_js(groups)
    gcounts = group_counts(data, groups)
    s33 = next(s for s in data if s["id"] == "33")
    sitemap = [("/", "1.0"), ("/exam/", "0.9"), ("/topics/", "0.9"), ("/tickets/", "0.9"),
               ("/tickets/random/", "0.6")]
    build_home()
    build_exam()
    build_topics(data, groups, gcounts)
    build_tickets()
    build_random()
    build_mistakes()
    for s in data:
        if any(q.get("a") is not None and q.get("v") for q in s["questions"]):
            sitemap.append((build_topic(s), "0.8"))
    for i, g in enumerate(groups, 1):
        if gcounts[g["id"]]:
            sitemap.append((build_topic_group(s33, i, g, gcounts[g["id"]]), "0.7"))
    for n in range(1, TICKET_COUNT + 1):
        sitemap.append((build_ticket(n), "0.7"))
    build_sitemap(sitemap)
    print(f"Готово: {len(sitemap)} сторінок у sitemap.xml")


if __name__ == "__main__":
    main()
