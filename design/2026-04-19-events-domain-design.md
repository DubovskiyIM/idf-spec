# Дизайн второго synthetic домена `events` для `spec-v0.1`

**Дата:** 2026-04-19
**Статус:** дизайн-документ. После одобрения — writing-plans → execute → spec v0.1.3.
**Source of truth:** `source/manifesto-v2.snapshot.md` (v2.1, SHA-256 `6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb`).

---

## 1. Цель

`library` (первый эталонный домен) покрыл 4 из 7 архетипов и не нагрузил commit α / Lightly-tested архетипы. Все известные substantive ambiguities (A-1) после полного цикла spec v0.1.0 → v0.1.2 + manifest v2.1 закрыты.

Гипотеза для следующего шага: **второй synthetic домен с другой структурой ambiguities выявит ещё неизвестные gaps**. Если выявит — значит спека неполна (validation signal). Если не выявит — спека самодостаточна для рассчитанного scope L1+L2 (positive validation).

## 2. Что нагружает второй домен (gaps в library)

| Gap | library | events |
|---|---|---|
| Архетип `feed` | не покрыт | ⭐ events-feed (timeline) |
| Архетип `wizard` | не покрыт | ⭐ event-planning-wizard |
| Effect kind `commit` α | не возникает | ⭐ confirm_event_schedule |
| 3+ роли с overlap | 2 (reader, librarian) | ⭐ attendee, organizer, admin |
| Multiple reference entities | 1 (Book) | 2 (Venue + ...) — расширение |
| ownerField + cascade visibility | только prямой owner | ⭐ organizer видит Attendee своих Events (потенциальная ambiguity) |
| datetime fields | borrowedAt опционально | ⭐ event.startsAt/endsAt — first-class |

## 3. Scope (минимальная версия — 4 проекции)

В скоупе:
- 4 entity (User, Venue, Event, Attendee)
- 3 role (attendee, organizer, admin)
- 9 intents (6 базовых + 3 wizard chain)
- 4 projections (events-feed, event-detail, event-planning-wizard, invite-form)
- 6 phi сценариев (5 основных + 1 wizard-flow)
- ~15 expected fixtures (world + viewer-world + artifact)

Out of scope для минимальной v0.1.3 (отложено на 0.1.4):
- `my-attendances` projection (catalog viewer-scoped — уже покрыто в library)
- `organizer-dashboard` projection (dashboard — уже покрыто в library)
- canvas archetype (3-й Lightly-tested — отложено)
- m2m через `role.scope` / assignment-bridge (Reserved L4)
- preapproval guard для intents (Reserved L4)

## 4. Структура домена

### Entities (4)

| Entity | `kind` | `ownerField` | Поля (FieldsOrder) | Назначение |
|---|---|---|---|---|
| `User` | internal | `id` | id, name | Пользователь системы |
| `Venue` | reference | — | id, name, capacity | Справочник переговорных (виден всем) |
| `Event` | internal | `organizerId` | id, title, organizerId, venueId, startsAt, endsAt, status | Событие; status: `draft → scheduled → cancelled`; organizerId references User; venueId references Venue |
| `Attendee` | internal | `userId` | id, eventId, userId, status, respondedAt | Запись о приглашении/RSVP; status: `invited → accepted → present` (или `declined`); eventId references Event; userId references User |

### Roles (3)

| Role | `base` | visibleFields | canExecute |
|---|---|---|---|
| `attendee` | (default) | User: [id, name]; Venue: \*; Event: \*; Attendee: \* | accept_invite, decline_invite, check_in |
| `organizer` | (default) | User: [id, name]; Venue: \*; Event: \*; Attendee: \* | create_event, edit_event, cancel_event, invite_user, start_event_planning, add_event_details, confirm_event_schedule |
| `admin` | `admin` | все: \* | все intents |

**Важно:** organizer не имеет `base="admin"` — он обычная роль с ownerField cascade. Если для некоторых проекций потребуется чтобы organizer видел Attendee для своих Events (а не только свои attendee-записи) — это **потенциальная ambiguity** (Attendee.ownerField=userId, organizer ≠ Attendee.userId). Это **первая возможная находка** этого домена. Если возникнет — фиксируем в backlog как кандидат для нормирования cascade-visibility в спеке.

### Intents (9)

| `id` | `ownerRole` | Effect | Назначение |
|---|---|---|---|
| `create_event` | organizer | create Event (status=draft) | Стандартный create |
| `edit_event` | organizer | replace Event | Стандартный replace |
| `cancel_event` | organizer | transition Event (→cancelled) | transition α |
| `invite_user` | organizer | create Attendee (status=invited) | Cross-entity create |
| `accept_invite` | attendee | transition Attendee (→accepted) | transition α |
| `decline_invite` | attendee | transition Attendee (→declined) | transition α |
| `start_event_planning` | organizer | create Event (status=draft) | **Wizard step 1** |
| `add_event_details` | organizer | replace Event (заполнение venueId, startsAt, endsAt) | **Wizard step 2** |
| `confirm_event_schedule` | organizer | transition Event (draft→scheduled) + **commit α** | **Wizard final + commit** |

### Projections (4)

| `id` | `archetype` | Intents | Entity | Особенность |
|---|---|---|---|---|
| `events-feed` | **feed** | (нет — read-only feed) | Event | Timeline по startsAt DESC; первое нагружение архетипа feed |
| `event-detail` | detail | edit_event, cancel_event, invite_user, accept_invite, decline_invite | Event | Multiple roles доступны разные intents |
| `invite-form` | form | invite_user | Attendee | Authored slot-override на body.fields = ["userId"] |
| `event-planning-wizard` | **wizard** | start_event_planning, add_event_details, confirm_event_schedule | Event | Multi-step + commit α |

### Phi-сценарии (6)

1. `empty.json` — пустой Φ
2. `bootstrap-venues.json` — 2 Venue созданы admin'ом
3. `organizer-creates-event.json` — bootstrap-venues + organizer создаёт Event (draft)
4. `invitations-sent.json` — organizer-creates-event + 2 Attendee invited
5. `rsvp-cycle.json` — invitations-sent + 1 accept + 1 decline
6. `wizard-flow.json` — bootstrap-venues + полный 3-step wizard chain (start → add details → confirm + commit α)

## 5. Файловая структура

```
spec/fixtures/events/
├── README.md
├── ontology.json
├── intents.json
├── projections.json
├── phi/
│   ├── empty.json
│   ├── bootstrap-venues.json
│   ├── organizer-creates-event.json
│   ├── invitations-sent.json
│   └── rsvp-cycle.json
└── expected/
    ├── world/                                    # 5 файлов
    ├── viewer-world/                              # ~10 файлов (5 phi × 2 viewer'а среднее)
    └── artifact/                                  # ~6 файлов (4 projections × applicable roles)
```

Итого ~25 fixture-файлов (как и оценка).

## 6. Потенциальные новые ambiguities (что ищем)

Заранее зафиксирую гипотезы — если возникнут при написании, это finding для backlog:

- **B-1: organizer-cascade visibility.** Должен ли organizer видеть Attendee для своих Events? Спека сейчас не нормирует cascade — Attendee.ownerField=userId, organizer не matches. Варианты решения, если возникнет:
  - Добавить organizer admin-flag для конкретных entity (per-entity adminFor — Q-25 alternative)
  - Признать ambiguity и use spec-extension (как было для A-1)
  - Спроектировать события так, чтобы organizer видел Attendee только через event-detail (cross-projection composition — Reserved L4)

- **B-2: Wizard semantics в crystallize.** Архетип wizard минимально нормирован в спеке (`slots.body.steps`). Что должно быть в каждом step? Как commit α инициируется? Это первое realистичное использование — может выявить нормативные пробелы.

- **B-3: Feed timeline-сортировка.** events-feed — items упорядочены по startsAt DESC. Спека crystallize.md фаза 3 для catalog нормирует «по id ASC», но не упоминает ничего про feed архетип. Нужен нормативный порядок sort.

- **B-4: Multiple references в одной Entity.** Attendee имеет 2 FK (eventId, userId). Спека `field.references` нормирована, но как эти FK влияют на primary/secondary heuristic в crystallize? Скорее всего FK поля исключаются (как в Loan: status — primary, не userId) — но это inferred, не нормировано.

Если хотя бы одна гипотеза материализуется — это substantive finding, валидирующий ROI шага 2.

## 7. Critical-path

После написания fixtures:

1. `cd ~/WebstormProjects/idf-spec && ./validate.sh` — все JSON Schemas + новые fixtures валидны
2. `cd ~/WebstormProjects/idf-go && go run ./cmd/conformance ../idf-spec/spec/fixtures/events/` — независимая Go-реализация прогоняет conformance на новом домене
3. Если CONFORMANT — спека самодостаточна, домен покрыл gaps без ambiguities (positive validation)
4. Если FAILS — анализ failures → spec-fix цикл (как с A-1)

## 8. Open questions для самого дизайна

- **D1: phi-сценарии для wizard.** Wizard pipeline (start → add details → confirm) генерирует 3 intent'а, каждый со своим effect. Делаем отдельный phi-сценарий `wizard-flow.json`? Или включаем в существующие? **Рекомендация:** отдельный 6-й phi-сценарий `wizard-flow.json` — это естественное place для commit α.
- **D2: Сколько (scenario × viewer) пар для events?** В library было 18. Здесь: 5 phi × 3 роли = 15 (минус duplicates где роль не существует). Достаточно для покрытия.
- **D3: Cleanup worktree после.** `~/WebstormProjects/idf-manifest-v2.1/` после merge всех PR'ов уже не нужен — удалить в этом цикле.

---

## Следующие шаги

1. Self-review этого design-doc (placeholder/contradiction/scope/ambiguity)
2. Запросить ревизию у автора
3. Invoke `superpowers:writing-plans` для составления implementation plan'а:
   - Phase 1: ontology.json + JSON Schema validation
   - Phase 2: intents.json
   - Phase 3: projections.json
   - Phase 4: phi/*.json (5-6 сценариев)
   - Phase 5: expected/world/*.json
   - Phase 6: expected/viewer-world/*.json (3 роли × сценарии)
   - Phase 7: expected/artifact/*.json (4 projections × applicable roles)
   - Phase 8: events/README.md + cross-validation через idf-go
   - Phase 9 (если ambiguity найдена): spec-fix + tag v0.1.3

После одобрения design-doc — writing-plans skill.
