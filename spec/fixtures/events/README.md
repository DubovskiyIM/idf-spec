# events — второй эталонный домен спеки v0.1

Второй synthetic домен. Нагружает gaps, оставленные library: feed/wizard архетипы, commit α, multi-role с overlap, datetime-fields.

**Validation history (шаг 2 эксперимента):**
- spec v0.1.4 (PR #3): добавлено допущение empty `intents` для read-only feed
- spec v0.1.5 (PR #4): нормированы fill rules для feed (entries по datetime DESC) и wizard (steps с isCommit)
- idf-go v0.1.2 (idf-go PR #2): реализация feed/wizard fill
- spec v0.1.3 (этот PR, события fixtures): полный conformance

## Сущности

| Сущность | `kind` | `ownerField` | Особенности |
|---|---|---|---|
| `User` | internal | `id` (self-owned) | Аналог library.User |
| `Venue` | reference | — | Справочник переговорных |
| `Event` | internal | `organizerId` | State machine `draft → scheduled → cancelled`; есть datetime-поля startsAt/endsAt |
| `Attendee` | internal | `userId` | RSVP-запись; FK на Event и User; status `invited → accepted/declined → present` |

## Роли

| Роль | base | Особенности |
|---|---|---|
| `attendee` | (default) | Видит свои Attendee, не видит чужие Event'ы (B-1 documented behavior) |
| `organizer` | (default) | Видит свои Event'ы; не видит чужие Attendee на них (B-1 territory) |
| `admin` | `admin` | Row-override (priority 1 в filterWorldForRole); видит всё |

## Намерения (9)

6 базовых: `create_event`, `edit_event`, `cancel_event`, `invite_user`, `accept_invite`, `decline_invite`.

3 wizard chain: `start_event_planning` → `add_event_details` → **`confirm_event_schedule`** (содержит **commit α**).

## Проекции (4, покрывают 4 архетипа)

| `id` | `archetype` | Особенность |
|---|---|---|
| `events-feed` | **feed** | `intents=[]` (read-only); entries sorted по `startsAt` DESC |
| `event-detail` | detail | 5 intents accessible разным ролям по-разному |
| `invite-form` | form | Slot-override `body.fields=["userId"]` |
| `event-planning-wizard` | **wizard** | 3 step'а; финал имеет `isCommit: true` |

## Phi-сценарии (6)

| Файл | Содержит |
|---|---|
| `empty.json` | Пустой Φ |
| `bootstrap-venues.json` | 2 Venue |
| `organizer-creates-event.json` | + organizer + e1 (draft) |
| `invitations-sent.json` | + 2 attendee Users + 2 Attendee (invited) |
| `rsvp-cycle.json` | + accept/decline transitions |
| `wizard-flow.json` | bootstrap-venues + organizer + e2 wizard chain (start → details → confirm + commit α) |

## Fixtures (~26 файлов)

- 6 expected/world (один per phi)
- 14 expected/viewer-world (phi × applicable viewer)
- 6 expected/artifact (4 projections × applicable role-viewer pairs)

## Conformance check

```bash
# Independent implementation (idf-go) prove L1+L2
cd ~/WebstormProjects/idf-go
go run ./cmd/conformance ../idf-spec/spec/fixtures/events/
# Expected: OVERALL: L1+L2 CONFORMANT
```

## Findings шага 2 (документированы в PR'ах spec v0.1.4 и v0.1.5)

1. **Read-only intents** (spec v0.1.4): library не выявил, что `projection.intents` принципиально может быть пустым (feed без actions). Спека требовала `minItems: 1` → fixed.
2. **feed/wizard fill rules** (spec v0.1.5): library не использовал feed/wizard, поэтому slot-fill для них не был нормирован (только slot-структура). Events forced нормировку.

Оба — substantive spec gaps, выявленные при independent imeплементации второго домена. Это и есть смысл шага 2.

## B-1 documented behavior

В events (3-роль setup) обнажена ambiguity, не блокирующая v0.1:
- organizer не видит Attendee для своих Events (`Attendee.ownerField=userId`, organizer ≠ Attendee.userId)
- attendee не видит Event на которые приглашён (`Event.ownerField=organizerId`, attendee ≠ organizer)

Спека v0.1 не нормирует cascade visibility через FK chains. Это **возможная задача для v0.2** (например, через `role.cascadeVia` или явный `assignment` entity kind). Сейчас зафиксировано как design behavior через expected fixtures.
