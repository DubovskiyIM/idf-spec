# CLAUDE.md — idf-spec

## Цель проекта

Написать `spec-v0.1` для формата IDF — нормативный документ, по которому independent implementer может построить вторую реализацию формата без чтения исходников первой реализации.

## Язык

Все файлы, документация, коммит-сообщения — **на русском**. JSON Schema field names и normative термины (`ontology`, `intent`, `effect`, ...) — `lower-camelCase` английские.

## Git-коммиты

Не добавляй Claude (или другого бота) в соавторы. Коммиты — от имени автора, без `Co-Authored-By: Claude ...` / `🤖 Generated with ...` трейлеров.

## Принцип честного эксперимента

`idf-spec` развивается **в изоляции** от референсной реализации. Это методологический критерий валидности проекта: если спека пишется, заглядывая в код, она становится зеркалом реализации, а не нормой формата. Тогда вторая реализация по этой спеке не даст структурного стресс-теста — она получит наследованный drift между манифестом и React-specifics.

### Allowed reads (white-list)

При работе над спекой можно читать **только** следующее за пределами `idf-spec/`:

- `~/WebstormProjects/idf-spec/source/manifesto-v2.snapshot.md` — frozen snapshot манифеста v2, **единственный нормативный source**
- `~/WebstormProjects/idf/docs/manifesto-v2.md` — допустимо для сверки, что snapshot не устарел; редактировать НЕ нужно
- `~/WebstormProjects/idf/docs/field-test-*.md` — полевые тесты как **примеры доменов на уровне дизайна** (не как образцы реализации); допустимо для понимания, какие задачи формат ставит перед собой
- `~/WebstormProjects/idf/docs/manifesto-v2.md` уже в whitelist выше; других docs из идф читать не нужно

### Forbidden reads (black-list)

Категорически **нельзя** читать при работе над спекой:

- `~/WebstormProjects/idf/src/**` — исходники React-прототипа
- `~/WebstormProjects/idf/server/**` — серверный код референсной реализации
- `~/WebstormProjects/idf/scripts/**` — авторские скрипты
- `~/WebstormProjects/idf-sdk/packages/*/src/**` — исходники SDK-пакетов
- `~/WebstormProjects/idf/**/*.test.{js,jsx,ts,tsx,cjs}` — тесты прототипа (они описывают, как реализация интерпретировала формат, а не сам формат)
- `~/WebstormProjects/idf-sdk/**/*.test.{js,jsx,ts,tsx}` — тесты SDK
- `~/WebstormProjects/idf/docs/implementation-status.md` — снимок реализации, не формата (числа доменов, версии пакетов, имплементационные детали)
- `~/WebstormProjects/idf/docs/archive/**` — архивные манифесты v1.x; нормативный source — только v2 snapshot
- `~/WebstormProjects/idf/docs/superpowers/specs/**` — внутренние spec'и реализации
- Любые `package.json`, `vite.config.js`, `vitest.config.js` соседних репо

### Правило сомнения

Если есть сомнение, относится ли файл к white-list или black-list — **не читай**. Зафиксируй вопрос в дизайн-документе и спроси автора.

### Что делать, если знание уже есть в контексте

Если из предыдущих сессий или CLAUDE.md проекта `idf` ты помнишь имплементационные детали (имена файлов, структуру пакетов, конкретные функции, числа тестов) — **активно их не используй** в тексте спеки. Спека описывает *формат*, а не *как именно одна реализация его интерпретировала*. Жёсткое разделение: «манифест говорит X (нормативно)» vs «реализация выбрала Y (информативно)». В спеке — только X.

## Скоуп v0.1

**В скоупе:**

- L1 (parser + Φ + fold + filterWorldForRole) и L2 (crystallize 6 фаз + 7 архетипов + mergeProjections) — нормативно полностью
- 4 аксиомы формата (§23 манифеста) — нормативно
- JSON Schema для `ontology`, `intent`, `effect`, `projection`, `artifact`
- Один эталонный домен в `spec/fixtures/` с полным input → expected output для всех L1+L2 операций

**Вне скоупа v0.1** (отмечается явно как `Reserved for v0.2+`):

- L3 (4 материализации pixel/voice/agent/document)
- L4 (Pattern Bank `structure.apply`, темпоральный scheduler, irreversibility integrity rule, 5 видов invariant'ов с handler'ами)
- Pattern Bank, voice/agent API/document материализации
- Base-таксономия ролей (`owner|viewer|agent|observer`), role.scope m2m, preapproval guard
- Семантические fieldRoles (`money` / `percentage` / `coordinate` / ...) — упоминаются как hint-механизм, без нормативного списка

## Стиль документов

- Нормативные секции используют MUST / SHOULD / MAY (RFC 2119), переводятся как «обязан» / «следует» / «может»
- JSON Schema: draft-07
- Test fixtures: чистый JSON, no comments
- Markdown файлы — < 500 строк; если разрастается — разбить на подсекции

## Связь с манифестом

Манифест v2 — мотивационный документ; спека v0.1 — его нормативная проекция. Где манифест говорит «эффект имеет вид {α, entity, fields, context}» — спека выражает это как JSON Schema с обязательными полями и допустимыми значениями α (`create | replace | remove | transition | commit`). Где манифест говорит «детерминизм кристаллизации» — спека формулирует это как MUST-aксиому в `02-axioms.md` с проверочным test vector'ом в fixtures.

Спека **не вносит новых аксиом**, не упомянутых в манифесте. Если при написании спеки обнаружится, что в манифесте нет однозначного ответа на нормативный вопрос, — это **сигнал расширить манифест** или явно зафиксировать ambiguity в спеке как `Open question` для следующей итерации.
