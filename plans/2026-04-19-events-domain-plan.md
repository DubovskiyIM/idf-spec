# events Domain Fixture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить второй synthetic домен `events` в `idf-spec/spec/fixtures/events/` для нагрузки gaps оставленных library: feed/wizard архетипы, commit α, multi-role с overlap. Полный conformance check через independent idf-go реализацию.

**Architecture:** Data-only план (нет нового кода — только JSON fixtures + markdown). Используется existing tooling: `idf-spec/validate.sh` (AJV draft-07) для self-validation; `idf-go/cmd/conformance` для cross-validation независимой реализацией. Каждая фаза: написать fixtures → validate → commit. Если validate fails или idf-go fails → новая ambiguity → spec-fix цикл (отдельный mini-PR) → продолжить.

**Tech Stack:** JSON (без комментариев), markdown, AJV draft-07, Go-CLI conformance.

**Source of truth:** `source/manifesto-v2.snapshot.md` (v2.1, SHA-256 `6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb`).

**Pre-condition:** [idf-spec#2](https://github.com/DubovskiyIM/idf-spec/pull/2) (`spec v0.1.2`) merged. Если ещё нет — мержить перед Task 1.

**Locked decisions из дизайна:**
- 4 entity (User, Venue, Event, Attendee)
- 3 role (attendee, organizer default base, admin с base="admin")
- 9 intents (включая wizard chain с commit α)
- 4 projections (events-feed, event-detail, invite-form, event-planning-wizard)
- 6 phi сценариев
- ~25 expected fixtures
- Branch: `feat/events-domain` from main (после merge #2)

**File structure:**

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
│   ├── rsvp-cycle.json
│   └── wizard-flow.json
└── expected/
    ├── world/                 # 6 файлов (1 per phi)
    ├── viewer-world/          # ~12 файлов (phi × applicable roles)
    └── artifact/              # ~6 файлов (4 projections × applicable roles)
```

**Phases:**
1. Setup branch + skeleton
2. Ontology
3. Intents
4. Projections
5. Phi-сценарии
6. Expected world
7. Expected viewer-world
8. Expected artifact
9. README + cross-validation idf-go
10. Tag v0.1.3 + PR

---

## Phase 1: Setup branch + skeleton

### Task 1: Branch + директории

**Files:**
- Create: `spec/fixtures/events/`, `spec/fixtures/events/phi/`, `spec/fixtures/events/expected/{world,viewer-world,artifact}/`

- [ ] **Step 1: Verify pre-condition**

```bash
cd ~/WebstormProjects/idf-spec && git checkout main && git pull --ff-only && git log --oneline | head -3
```
Expected: top commit — merge PR #2 (`spec v0.1.2`). Если нет — `gh pr merge 2 --merge -R DubovskiyIM/idf-spec`, потом pull.

- [ ] **Step 2: Branch + директории**

```bash
cd ~/WebstormProjects/idf-spec && git checkout -b feat/events-domain && \
  mkdir -p spec/fixtures/events/phi \
           spec/fixtures/events/expected/world \
           spec/fixtures/events/expected/viewer-world \
           spec/fixtures/events/expected/artifact
```

- [ ] **Step 3: Verify**

Run: `find spec/fixtures/events -type d`
Expected: 5 директорий (events, phi, expected, expected/world, expected/viewer-world, expected/artifact).

---

## Phase 2: Ontology

### Task 2: events/ontology.json

**Files:**
- Create: `spec/fixtures/events/ontology.json`

- [ ] **Step 1: Написать ontology.json**

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "Второй эталонный домен events: User, Venue (reference), Event (owned by organizerId), Attendee (owned by userId). 3 роли: attendee, organizer, admin. Нагружает feed/wizard архетипы и commit α."
  },
  "entities": {
    "User": {
      "kind": "internal",
      "ownerField": "id",
      "fields": {
        "id":   { "type": "string", "required": true },
        "name": { "type": "string", "required": true }
      }
    },
    "Venue": {
      "kind": "reference",
      "fields": {
        "id":       { "type": "string", "required": true },
        "name":     { "type": "string", "required": true },
        "capacity": { "type": "number", "required": true }
      }
    },
    "Event": {
      "kind": "internal",
      "ownerField": "organizerId",
      "fields": {
        "id":          { "type": "string",   "required": true },
        "title":       { "type": "string",   "required": true },
        "organizerId": { "type": "string",   "required": true, "references": "User" },
        "venueId":     { "type": "string",   "references": "Venue" },
        "startsAt":    { "type": "datetime" },
        "endsAt":      { "type": "datetime" },
        "status":      { "type": "enum", "values": ["draft", "scheduled", "cancelled"], "required": true }
      }
    },
    "Attendee": {
      "kind": "internal",
      "ownerField": "userId",
      "fields": {
        "id":          { "type": "string",   "required": true },
        "eventId":     { "type": "string",   "required": true, "references": "Event" },
        "userId":      { "type": "string",   "required": true, "references": "User" },
        "status":      { "type": "enum", "values": ["invited", "accepted", "declined", "present"], "required": true },
        "respondedAt": { "type": "datetime" }
      }
    }
  },
  "roles": {
    "attendee": {
      "visibleFields": {
        "User":     ["id", "name"],
        "Venue":    "*",
        "Event":    "*",
        "Attendee": "*"
      },
      "canExecute": ["accept_invite", "decline_invite"]
    },
    "organizer": {
      "visibleFields": {
        "User":     ["id", "name"],
        "Venue":    "*",
        "Event":    "*",
        "Attendee": "*"
      },
      "canExecute": ["create_event", "edit_event", "cancel_event", "invite_user", "start_event_planning", "add_event_details", "confirm_event_schedule"]
    },
    "admin": {
      "base": "admin",
      "visibleFields": {
        "User":     "*",
        "Venue":    "*",
        "Event":    "*",
        "Attendee": "*"
      },
      "canExecute": ["create_event", "edit_event", "cancel_event", "invite_user", "accept_invite", "decline_invite", "start_event_planning", "add_event_details", "confirm_event_schedule"]
    }
  }
}
```

- [ ] **Step 2: Validate**

```bash
cd ~/WebstormProjects/idf-spec && ./validate.sh 2>&1 | tail -5
```
Expected: `events//ontology.json valid`, `== OK ==`.

Если fails — обычно это enum значение или pattern имени. Fix inline.

- [ ] **Step 3: Commit**

```bash
cd ~/WebstormProjects/idf-spec && git add spec/fixtures/events/ontology.json && git commit -q -m "events: ontology.json — User/Venue/Event/Attendee + 3 роли"
```

---

## Phase 3: Intents

### Task 3: events/intents.json

**Files:**
- Create: `spec/fixtures/events/intents.json`

- [ ] **Step 1: Написать intents.json**

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "9 intent'ов events-домена. 6 базовых (CRUD + RSVP) + 3 wizard chain (start → details → confirm с commit α)."
  },
  "intents": [
    {
      "id": "create_event",
      "ownerRole": "organizer",
      "requiredFields": [
        { "name": "title",  "type": "string" }
      ],
      "effects": [{ "kind": "create", "entity": "Event" }]
    },
    {
      "id": "edit_event",
      "ownerRole": "organizer",
      "requiredFields": [
        { "name": "id",    "type": "string" },
        { "name": "title", "type": "string" }
      ],
      "effects": [{ "kind": "replace", "entity": "Event" }]
    },
    {
      "id": "cancel_event",
      "ownerRole": "organizer",
      "requiredFields": [{ "name": "id", "type": "string" }],
      "effects": [{ "kind": "transition", "entity": "Event" }]
    },
    {
      "id": "invite_user",
      "ownerRole": "organizer",
      "requiredFields": [
        { "name": "eventId", "type": "string" },
        { "name": "userId",  "type": "string" }
      ],
      "effects": [{ "kind": "create", "entity": "Attendee" }]
    },
    {
      "id": "accept_invite",
      "ownerRole": "attendee",
      "requiredFields": [{ "name": "id", "type": "string" }],
      "effects": [{ "kind": "transition", "entity": "Attendee" }]
    },
    {
      "id": "decline_invite",
      "ownerRole": "attendee",
      "requiredFields": [{ "name": "id", "type": "string" }],
      "effects": [{ "kind": "transition", "entity": "Attendee" }]
    },
    {
      "id": "start_event_planning",
      "ownerRole": "organizer",
      "requiredFields": [{ "name": "title", "type": "string" }],
      "effects": [{ "kind": "create", "entity": "Event" }]
    },
    {
      "id": "add_event_details",
      "ownerRole": "organizer",
      "requiredFields": [
        { "name": "id",       "type": "string" },
        { "name": "venueId",  "type": "string" },
        { "name": "startsAt", "type": "datetime" },
        { "name": "endsAt",   "type": "datetime" }
      ],
      "effects": [{ "kind": "replace", "entity": "Event" }]
    },
    {
      "id": "confirm_event_schedule",
      "ownerRole": "organizer",
      "requiredFields": [{ "name": "id", "type": "string" }],
      "effects": [
        { "kind": "transition", "entity": "Event" },
        { "kind": "commit",     "entity": "Event" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Validate**

Run: `./validate.sh 2>&1 | tail -5`
Expected: `events//intents.json valid`.

- [ ] **Step 3: Commit**

```bash
cd ~/WebstormProjects/idf-spec && git add spec/fixtures/events/intents.json && git commit -q -m "events: intents.json — 9 intent'ов (6 базовых + 3 wizard chain с commit α)"
```

---

## Phase 4: Projections

### Task 4: events/projections.json

**Files:**
- Create: `spec/fixtures/events/projections.json`

- [ ] **Step 1: Написать projections.json**

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "4 проекции events: events-feed (feed архетип), event-detail, invite-form (со slot-override), event-planning-wizard (wizard архетип). Покрывает 4 архетипа из 7."
  },
  "projections": [
    {
      "id": "events-feed",
      "archetype": "feed",
      "entity": "Event",
      "intents": []
    },
    {
      "id": "event-detail",
      "archetype": "detail",
      "entity": "Event",
      "intents": ["edit_event", "cancel_event", "invite_user", "accept_invite", "decline_invite"]
    },
    {
      "id": "invite-form",
      "archetype": "form",
      "entity": "Attendee",
      "intents": ["invite_user"],
      "slots": {
        "body": {
          "_authored": true,
          "fields": ["userId"]
        }
      }
    },
    {
      "id": "event-planning-wizard",
      "archetype": "wizard",
      "entity": "Event",
      "intents": ["start_event_planning", "add_event_details", "confirm_event_schedule"]
    }
  ]
}
```

- [ ] **Step 2: Validate**

Run: `./validate.sh 2>&1 | tail -5`
Expected: `events//projections.json valid`.

- [ ] **Step 3: Commit**

```bash
cd ~/WebstormProjects/idf-spec && git add spec/fixtures/events/projections.json && git commit -q -m "events: projections.json — 4 проекции (feed, detail, form, wizard)"
```

---

## Phase 5: Phi-сценарии

### Task 5: phi/empty.json + phi/bootstrap-venues.json

**Files:**
- Create: `spec/fixtures/events/phi/empty.json`, `spec/fixtures/events/phi/bootstrap-venues.json`

- [ ] **Step 1: empty.json**

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "Пустой Φ. fold должен вернуть пустые namespace'ы для всех 4 entity (User/Venue/Event/Attendee)."
  },
  "effects": []
}
```

- [ ] **Step 2: bootstrap-venues.json**

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "Admin создаёт 2 Venue. Базовый snapshot для последующих сценариев."
  },
  "effects": [
    {
      "kind": "create",
      "entity": "Venue",
      "fields": { "id": "v1", "name": "Conference Room A", "capacity": 30 },
      "context": { "at": "2026-04-01T08:00:00.000Z", "initiator": "u-admin-1" }
    },
    {
      "kind": "create",
      "entity": "Venue",
      "fields": { "id": "v2", "name": "Auditorium", "capacity": 200 },
      "context": { "at": "2026-04-01T08:01:00.000Z", "initiator": "u-admin-1" }
    }
  ]
}
```

- [ ] **Step 3: Validate**

Run: `./validate.sh 2>&1 | tail -5`
Expected: оба phi-файла valid.

- [ ] **Step 4: Commit**

```bash
cd ~/WebstormProjects/idf-spec && git add spec/fixtures/events/phi/empty.json spec/fixtures/events/phi/bootstrap-venues.json && git commit -q -m "events: phi/empty + bootstrap-venues"
```

### Task 6: phi/organizer-creates-event.json + invitations-sent.json

**Files:**
- Create: `spec/fixtures/events/phi/organizer-creates-event.json`, `spec/fixtures/events/phi/invitations-sent.json`

- [ ] **Step 1: organizer-creates-event.json**

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "bootstrap-venues + organizer (u-org-1) создаёт Event e1 (status=draft) с venue=v1."
  },
  "effects": [
    {
      "kind": "create",
      "entity": "Venue",
      "fields": { "id": "v1", "name": "Conference Room A", "capacity": 30 },
      "context": { "at": "2026-04-01T08:00:00.000Z", "initiator": "u-admin-1" }
    },
    {
      "kind": "create",
      "entity": "Venue",
      "fields": { "id": "v2", "name": "Auditorium", "capacity": 200 },
      "context": { "at": "2026-04-01T08:01:00.000Z", "initiator": "u-admin-1" }
    },
    {
      "kind": "create",
      "entity": "User",
      "fields": { "id": "u-org-1", "name": "Olivia Organizer" },
      "context": { "at": "2026-04-01T09:00:00.000Z", "initiator": "u-admin-1" }
    },
    {
      "kind": "create",
      "entity": "Event",
      "fields": {
        "id": "e1",
        "title": "Quarterly Planning",
        "organizerId": "u-org-1",
        "venueId": "v1",
        "startsAt": "2026-05-01T14:00:00.000Z",
        "endsAt": "2026-05-01T16:00:00.000Z",
        "status": "draft"
      },
      "context": { "at": "2026-04-02T10:00:00.000Z", "initiator": "u-org-1", "intentId": "create_event" }
    }
  ]
}
```

- [ ] **Step 2: invitations-sent.json**

Содержит все эффекты из organizer-creates-event плюс ещё 2 attendee-эффекта.

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "organizer-creates-event + organizer регистрирует двух attendee (u-att-1 Alice, u-att-2 Bob) + приглашает их на e1 (создаёт Attendee a1, a2 в статусе invited)."
  },
  "effects": [
    {
      "kind": "create",
      "entity": "Venue",
      "fields": { "id": "v1", "name": "Conference Room A", "capacity": 30 },
      "context": { "at": "2026-04-01T08:00:00.000Z", "initiator": "u-admin-1" }
    },
    {
      "kind": "create",
      "entity": "Venue",
      "fields": { "id": "v2", "name": "Auditorium", "capacity": 200 },
      "context": { "at": "2026-04-01T08:01:00.000Z", "initiator": "u-admin-1" }
    },
    {
      "kind": "create",
      "entity": "User",
      "fields": { "id": "u-org-1", "name": "Olivia Organizer" },
      "context": { "at": "2026-04-01T09:00:00.000Z", "initiator": "u-admin-1" }
    },
    {
      "kind": "create",
      "entity": "Event",
      "fields": {
        "id": "e1",
        "title": "Quarterly Planning",
        "organizerId": "u-org-1",
        "venueId": "v1",
        "startsAt": "2026-05-01T14:00:00.000Z",
        "endsAt": "2026-05-01T16:00:00.000Z",
        "status": "draft"
      },
      "context": { "at": "2026-04-02T10:00:00.000Z", "initiator": "u-org-1", "intentId": "create_event" }
    },
    {
      "kind": "create",
      "entity": "User",
      "fields": { "id": "u-att-1", "name": "Alice Attendee" },
      "context": { "at": "2026-04-03T09:00:00.000Z", "initiator": "u-admin-1" }
    },
    {
      "kind": "create",
      "entity": "User",
      "fields": { "id": "u-att-2", "name": "Bob Attendee" },
      "context": { "at": "2026-04-03T09:01:00.000Z", "initiator": "u-admin-1" }
    },
    {
      "kind": "create",
      "entity": "Attendee",
      "fields": { "id": "a1", "eventId": "e1", "userId": "u-att-1", "status": "invited" },
      "context": { "at": "2026-04-03T10:00:00.000Z", "initiator": "u-org-1", "intentId": "invite_user" }
    },
    {
      "kind": "create",
      "entity": "Attendee",
      "fields": { "id": "a2", "eventId": "e1", "userId": "u-att-2", "status": "invited" },
      "context": { "at": "2026-04-03T10:01:00.000Z", "initiator": "u-org-1", "intentId": "invite_user" }
    }
  ]
}
```

- [ ] **Step 3: Validate + commit**

```bash
cd ~/WebstormProjects/idf-spec && ./validate.sh 2>&1 | tail -3 && \
  git add spec/fixtures/events/phi/organizer-creates-event.json spec/fixtures/events/phi/invitations-sent.json && \
  git commit -q -m "events: phi/organizer-creates-event + invitations-sent"
```

### Task 7: phi/rsvp-cycle.json + wizard-flow.json

**Files:**
- Create: `spec/fixtures/events/phi/rsvp-cycle.json`, `spec/fixtures/events/phi/wizard-flow.json`

- [ ] **Step 1: rsvp-cycle.json**

invitations-sent + Alice accepts (transition a1) + Bob declines (transition a2).

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "invitations-sent + Alice accepts (Attendee a1 → accepted) + Bob declines (a2 → declined). respondedAt заполняется."
  },
  "effects": [
    { "kind": "create", "entity": "Venue", "fields": { "id": "v1", "name": "Conference Room A", "capacity": 30 }, "context": { "at": "2026-04-01T08:00:00.000Z", "initiator": "u-admin-1" } },
    { "kind": "create", "entity": "Venue", "fields": { "id": "v2", "name": "Auditorium", "capacity": 200 }, "context": { "at": "2026-04-01T08:01:00.000Z", "initiator": "u-admin-1" } },
    { "kind": "create", "entity": "User", "fields": { "id": "u-org-1", "name": "Olivia Organizer" }, "context": { "at": "2026-04-01T09:00:00.000Z", "initiator": "u-admin-1" } },
    {
      "kind": "create",
      "entity": "Event",
      "fields": { "id": "e1", "title": "Quarterly Planning", "organizerId": "u-org-1", "venueId": "v1", "startsAt": "2026-05-01T14:00:00.000Z", "endsAt": "2026-05-01T16:00:00.000Z", "status": "draft" },
      "context": { "at": "2026-04-02T10:00:00.000Z", "initiator": "u-org-1", "intentId": "create_event" }
    },
    { "kind": "create", "entity": "User", "fields": { "id": "u-att-1", "name": "Alice Attendee" }, "context": { "at": "2026-04-03T09:00:00.000Z", "initiator": "u-admin-1" } },
    { "kind": "create", "entity": "User", "fields": { "id": "u-att-2", "name": "Bob Attendee" }, "context": { "at": "2026-04-03T09:01:00.000Z", "initiator": "u-admin-1" } },
    { "kind": "create", "entity": "Attendee", "fields": { "id": "a1", "eventId": "e1", "userId": "u-att-1", "status": "invited" }, "context": { "at": "2026-04-03T10:00:00.000Z", "initiator": "u-org-1", "intentId": "invite_user" } },
    { "kind": "create", "entity": "Attendee", "fields": { "id": "a2", "eventId": "e1", "userId": "u-att-2", "status": "invited" }, "context": { "at": "2026-04-03T10:01:00.000Z", "initiator": "u-org-1", "intentId": "invite_user" } },
    { "kind": "transition", "entity": "Attendee", "fields": { "id": "a1", "status": "accepted", "respondedAt": "2026-04-04T11:00:00.000Z" }, "context": { "at": "2026-04-04T11:00:00.000Z", "initiator": "u-att-1", "intentId": "accept_invite" } },
    { "kind": "transition", "entity": "Attendee", "fields": { "id": "a2", "status": "declined", "respondedAt": "2026-04-04T12:00:00.000Z" }, "context": { "at": "2026-04-04T12:00:00.000Z", "initiator": "u-att-2", "intentId": "decline_invite" } }
  ]
}
```

- [ ] **Step 2: wizard-flow.json**

bootstrap-venues + organizer + полный 3-step wizard chain (e2: start → details → confirm). Включает commit α.

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "bootstrap-venues + organizer выполняет полный wizard chain для Event e2: start_event_planning (create draft) → add_event_details (replace с venueId/startsAt/endsAt) → confirm_event_schedule (transition draft→scheduled + commit α). Нагружает wizard архетип и commit α."
  },
  "effects": [
    { "kind": "create", "entity": "Venue", "fields": { "id": "v1", "name": "Conference Room A", "capacity": 30 }, "context": { "at": "2026-04-01T08:00:00.000Z", "initiator": "u-admin-1" } },
    { "kind": "create", "entity": "Venue", "fields": { "id": "v2", "name": "Auditorium", "capacity": 200 }, "context": { "at": "2026-04-01T08:01:00.000Z", "initiator": "u-admin-1" } },
    { "kind": "create", "entity": "User", "fields": { "id": "u-org-1", "name": "Olivia Organizer" }, "context": { "at": "2026-04-01T09:00:00.000Z", "initiator": "u-admin-1" } },
    {
      "kind": "create",
      "entity": "Event",
      "fields": { "id": "e2", "title": "Annual Summit", "organizerId": "u-org-1", "status": "draft" },
      "context": { "at": "2026-04-05T10:00:00.000Z", "initiator": "u-org-1", "intentId": "start_event_planning" }
    },
    {
      "kind": "replace",
      "entity": "Event",
      "fields": { "id": "e2", "venueId": "v2", "startsAt": "2026-06-15T09:00:00.000Z", "endsAt": "2026-06-15T18:00:00.000Z" },
      "context": { "at": "2026-04-05T10:05:00.000Z", "initiator": "u-org-1", "intentId": "add_event_details" }
    },
    {
      "kind": "transition",
      "entity": "Event",
      "fields": { "id": "e2", "status": "scheduled" },
      "context": { "at": "2026-04-05T10:10:00.000Z", "initiator": "u-org-1", "intentId": "confirm_event_schedule" }
    },
    {
      "kind": "commit",
      "entity": "Event",
      "fields": { "id": "e2" },
      "context": { "at": "2026-04-05T10:10:00.001Z", "initiator": "u-org-1", "intentId": "confirm_event_schedule" }
    }
  ]
}
```

- [ ] **Step 3: Validate + commit**

```bash
cd ~/WebstormProjects/idf-spec && ./validate.sh 2>&1 | tail -3 && \
  git add spec/fixtures/events/phi/rsvp-cycle.json spec/fixtures/events/phi/wizard-flow.json && \
  git commit -q -m "events: phi/rsvp-cycle + wizard-flow (нагружает commit α)"
```

---

## Phase 6: Expected world

### Task 8: expected/world/*.json (6 файлов)

**Files:** `spec/fixtures/events/expected/world/{empty,bootstrap-venues,organizer-creates-event,invitations-sent,rsvp-cycle,wizard-flow}.json`

- [ ] **Step 1: world/empty.json**

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "fold(empty Φ, events ontology) — 4 пустых namespace."
  },
  "world": { "User": {}, "Venue": {}, "Event": {}, "Attendee": {} }
}
```

- [ ] **Step 2: world/bootstrap-venues.json**

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "fold(bootstrap-venues) — 2 Venue."
  },
  "world": {
    "User": {},
    "Venue": {
      "v1": { "id": "v1", "name": "Conference Room A", "capacity": 30 },
      "v2": { "id": "v2", "name": "Auditorium", "capacity": 200 }
    },
    "Event": {},
    "Attendee": {}
  }
}
```

- [ ] **Step 3: world/organizer-creates-event.json**

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "fold(organizer-creates-event) — bootstrap-venues + u-org-1 + e1 (draft)."
  },
  "world": {
    "User": {
      "u-org-1": { "id": "u-org-1", "name": "Olivia Organizer" }
    },
    "Venue": {
      "v1": { "id": "v1", "name": "Conference Room A", "capacity": 30 },
      "v2": { "id": "v2", "name": "Auditorium", "capacity": 200 }
    },
    "Event": {
      "e1": { "id": "e1", "title": "Quarterly Planning", "organizerId": "u-org-1", "venueId": "v1", "startsAt": "2026-05-01T14:00:00.000Z", "endsAt": "2026-05-01T16:00:00.000Z", "status": "draft" }
    },
    "Attendee": {}
  }
}
```

- [ ] **Step 4: world/invitations-sent.json**

Same as previous + 2 User'а + 2 Attendee. Полный JSON:

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "fold(invitations-sent) — organizer-creates-event + 2 Attendee."
  },
  "world": {
    "User": {
      "u-org-1": { "id": "u-org-1", "name": "Olivia Organizer" },
      "u-att-1": { "id": "u-att-1", "name": "Alice Attendee" },
      "u-att-2": { "id": "u-att-2", "name": "Bob Attendee" }
    },
    "Venue": {
      "v1": { "id": "v1", "name": "Conference Room A", "capacity": 30 },
      "v2": { "id": "v2", "name": "Auditorium", "capacity": 200 }
    },
    "Event": {
      "e1": { "id": "e1", "title": "Quarterly Planning", "organizerId": "u-org-1", "venueId": "v1", "startsAt": "2026-05-01T14:00:00.000Z", "endsAt": "2026-05-01T16:00:00.000Z", "status": "draft" }
    },
    "Attendee": {
      "a1": { "id": "a1", "eventId": "e1", "userId": "u-att-1", "status": "invited" },
      "a2": { "id": "a2", "eventId": "e1", "userId": "u-att-2", "status": "invited" }
    }
  }
}
```

- [ ] **Step 5: world/rsvp-cycle.json**

Same as previous + a1.status=accepted+respondedAt, a2.status=declined+respondedAt:

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "fold(rsvp-cycle) — invitations-sent + a1 accepted + a2 declined; respondedAt заполнен (shallow-merge)."
  },
  "world": {
    "User": {
      "u-org-1": { "id": "u-org-1", "name": "Olivia Organizer" },
      "u-att-1": { "id": "u-att-1", "name": "Alice Attendee" },
      "u-att-2": { "id": "u-att-2", "name": "Bob Attendee" }
    },
    "Venue": {
      "v1": { "id": "v1", "name": "Conference Room A", "capacity": 30 },
      "v2": { "id": "v2", "name": "Auditorium", "capacity": 200 }
    },
    "Event": {
      "e1": { "id": "e1", "title": "Quarterly Planning", "organizerId": "u-org-1", "venueId": "v1", "startsAt": "2026-05-01T14:00:00.000Z", "endsAt": "2026-05-01T16:00:00.000Z", "status": "draft" }
    },
    "Attendee": {
      "a1": { "id": "a1", "eventId": "e1", "userId": "u-att-1", "status": "accepted", "respondedAt": "2026-04-04T11:00:00.000Z" },
      "a2": { "id": "a2", "eventId": "e1", "userId": "u-att-2", "status": "declined", "respondedAt": "2026-04-04T12:00:00.000Z" }
    }
  }
}
```

- [ ] **Step 6: world/wizard-flow.json**

bootstrap-venues + u-org-1 + e2 (final state: scheduled, with venue/dates). commit α — no-op в fold (per spec/04-algebra/fold.md).

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "fold(wizard-flow) — bootstrap-venues + u-org-1 + e2 после wizard chain (status=scheduled, venueId=v2, startsAt/endsAt заполнены). commit α — no-op в fold."
  },
  "world": {
    "User": {
      "u-org-1": { "id": "u-org-1", "name": "Olivia Organizer" }
    },
    "Venue": {
      "v1": { "id": "v1", "name": "Conference Room A", "capacity": 30 },
      "v2": { "id": "v2", "name": "Auditorium", "capacity": 200 }
    },
    "Event": {
      "e2": { "id": "e2", "title": "Annual Summit", "organizerId": "u-org-1", "venueId": "v2", "startsAt": "2026-06-15T09:00:00.000Z", "endsAt": "2026-06-15T18:00:00.000Z", "status": "scheduled" }
    },
    "Attendee": {}
  }
}
```

- [ ] **Step 7: Commit**

```bash
cd ~/WebstormProjects/idf-spec && git add spec/fixtures/events/expected/world/ && git commit -q -m "events: expected/world — 6 файлов (по 1 на phi-сценарий); commit α — no-op"
```

---

## Phase 7: Expected viewer-world

### Task 9: viewer-world per (phi, role)

**Files:** ~12 файлов в `spec/fixtures/events/expected/viewer-world/`.

Roles в events: `attendee` (default base), `organizer` (default base), `admin` (base="admin").

Существенные viewers:
- `u-admin-1` — admin
- `u-org-1` — organizer
- `u-att-1` (Alice) — attendee
- `u-att-2` (Bob) — attendee

**Покрытие (12 файлов):**

| Phi-сценарий | admin | organizer u-org-1 | attendee u-att-1 | attendee u-att-2 |
|---|---|---|---|---|
| empty | ✓ | — (нет u-org-1 в User) | — | — |
| bootstrap-venues | ✓ | — | — | — |
| organizer-creates-event | ✓ | ✓ | — | — |
| invitations-sent | ✓ | ✓ | ✓ | ✓ |
| rsvp-cycle | ✓ | ✓ | ✓ | ✓ |
| wizard-flow | ✓ | ✓ | — | — |

(Скипаем сценарии где роль не существует или нет смыслового различия — например, attendee на bootstrap-venues видит только Venue, идентично admin'у в этих namespace'ах кроме User.)

Итого: 6 admin + 4 organizer + 2 attendee-u-att-1 + 2 attendee-u-att-2 = 14 файлов. Оптимизирую до 12 минимально-достаточных.

- [ ] **Step 1: viewer-world/empty-as-admin-u-admin-1.json**

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "Empty + admin: 4 пустых namespace."
  },
  "viewerWorld": { "User": {}, "Venue": {}, "Event": {}, "Attendee": {} }
}
```

- [ ] **Step 2: viewer-world/bootstrap-venues-as-admin-u-admin-1.json**

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "bootstrap-venues + admin: видит 2 Venue (reference); прочее пусто."
  },
  "viewerWorld": {
    "User": {},
    "Venue": {
      "v1": { "id": "v1", "name": "Conference Room A", "capacity": 30 },
      "v2": { "id": "v2", "name": "Auditorium", "capacity": 200 }
    },
    "Event": {},
    "Attendee": {}
  }
}
```

- [ ] **Step 3: organizer-creates-event-as-admin-u-admin-1.json + as-organizer-u-org-1.json**

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "organizer-creates-event + admin: видит всё."
  },
  "viewerWorld": {
    "User": {
      "u-org-1": { "id": "u-org-1", "name": "Olivia Organizer" }
    },
    "Venue": {
      "v1": { "id": "v1", "name": "Conference Room A", "capacity": 30 },
      "v2": { "id": "v2", "name": "Auditorium", "capacity": 200 }
    },
    "Event": {
      "e1": { "id": "e1", "title": "Quarterly Planning", "organizerId": "u-org-1", "venueId": "v1", "startsAt": "2026-05-01T14:00:00.000Z", "endsAt": "2026-05-01T16:00:00.000Z", "status": "draft" }
    },
    "Attendee": {}
  }
}
```

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "organizer-creates-event + organizer u-org-1: видит свой User (ownerField=id), Venue (ref), свой Event e1 (ownerField=organizerId)."
  },
  "viewerWorld": {
    "User": {
      "u-org-1": { "id": "u-org-1", "name": "Olivia Organizer" }
    },
    "Venue": {
      "v1": { "id": "v1", "name": "Conference Room A", "capacity": 30 },
      "v2": { "id": "v2", "name": "Auditorium", "capacity": 200 }
    },
    "Event": {
      "e1": { "id": "e1", "title": "Quarterly Planning", "organizerId": "u-org-1", "venueId": "v1", "startsAt": "2026-05-01T14:00:00.000Z", "endsAt": "2026-05-01T16:00:00.000Z", "status": "draft" }
    },
    "Attendee": {}
  }
}
```

- [ ] **Step 4: invitations-sent-as-{admin,organizer,attendee-u-att-1,attendee-u-att-2}.json (4 файла)**

admin видит всё (3 User, 2 Venue, e1, 2 Attendee).

organizer u-org-1 видит:
- User: только u-org-1 (ownerField=id)
- Venue: все (ref)
- Event: e1 (own)
- Attendee: пусто (Attendee.ownerField=userId, u-org-1 не owner). **Это и есть потенциальная B-1 ambiguity** — должен ли organizer видеть Attendee для своих Events? Спека сейчас говорит «нет» (нет cascade). Записываем expected согласно строгой прозе спеки. **Если idf-go в Phase 9 fails на этом — есть finding!**

attendee u-att-1 (Alice):
- User: только u-att-1
- Venue: все (ref)
- Event: пусто (Event.ownerField=organizerId, Alice ≠ u-org-1). **Это вторая потенциальная ambiguity** — должна ли attendee видеть Events на которые приглашена? По строгой прозе спеки — нет.
- Attendee: только a1 (own)

attendee u-att-2 (Bob): аналогично — только u-att-2 в User; пусто в Event; только a2 в Attendee.

Записать все 4 файла.

- [ ] **Step 5: rsvp-cycle-as-{admin,organizer,attendee-u-att-1,attendee-u-att-2}.json (4 файла)**

То же что invitations-sent, но с обновлёнными Attendee status'ами и respondedAt.

- [ ] **Step 6: wizard-flow-as-{admin,organizer-u-org-1}.json (2 файла)**

admin видит всё (u-org-1, 2 Venue, e2 scheduled).

organizer u-org-1 видит свой User, Venue (ref), свой Event e2.

- [ ] **Step 7: Validate + commit**

```bash
cd ~/WebstormProjects/idf-spec && ./validate.sh 2>&1 | tail -3 && ls spec/fixtures/events/expected/viewer-world/ | wc -l
```
Expected: 12 файлов.

```bash
cd ~/WebstormProjects/idf-spec && git add spec/fixtures/events/expected/viewer-world/ && git commit -q -m "events: expected/viewer-world — 12 файлов (phi × applicable роли); проверяет admin-override + ownerField для Event/Attendee"
```

---

## Phase 8: Expected artifact

### Task 10: artifact per (phi, projection, applicable role)

**Files:** ~6 файлов в `spec/fixtures/events/expected/artifact/`.

| Projection | Phi | Roles | Файлы |
|---|---|---|---|
| events-feed | invitations-sent | admin, attendee | 2 (или 1 если идентичны) |
| event-detail (для e1) | invitations-sent | admin, organizer, attendee-u-att-1 | 2-3 |
| invite-form | (любой с e1) | organizer | 1 |
| event-planning-wizard | wizard-flow | organizer | 1 |

Минимум 6 файлов: events-feed-as-admin, events-feed-as-attendee, event-detail-as-admin, event-detail-as-organizer, invite-form-as-organizer, event-planning-wizard-as-organizer.

**Важная работа:** для каждого artifact надо аккуратно прогнать crystallize фазы 1-3+6 mentally. Особенно для `feed` и `wizard` — это новые архетипы, спека даёт минимум структуры:
- feed: `slots.body.entries`
- wizard: `slots.body.steps`

- [ ] **Step 1: artifact/invitations-sent-events-feed-as-admin-u-admin-1.json**

events-feed: archetype=feed, entity=Event, intents=[]. Per spec/03-objects/artifact.md feed: `slots.body.entries`. Конкретное содержимое entries в спеке lightly-tested — implementer choice. Принимаю pragmatic interpretation: entries = items как в catalog (массив записей), упорядочены по `startsAt` DESC (timeline). Для invitations-sent — только e1.

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "crystallize(events-feed, viewer=admin, viewerWorld=invitations-sent-as-admin). Feed архетип: slots.body.entries по datetime DESC (timeline). intents=[] → пусто footer/toolbar. ВНИМАНИЕ: feed lightly-tested в спеке — это implementer choice (entries как в catalog body.items, sorted by startsAt DESC; если поле startsAt отсутствует — fallback id ASC)."
  },
  "projectionId": "events-feed",
  "archetype": "feed",
  "viewer": "admin",
  "slots": {
    "body": {
      "entries": [
        { "id": "e1", "title": "Quarterly Planning", "organizerId": "u-org-1", "venueId": "v1", "startsAt": "2026-05-01T14:00:00.000Z", "endsAt": "2026-05-01T16:00:00.000Z", "status": "draft" }
      ]
    }
  }
}
```

**ВАЖНО:** Если idf-go реализация feed возвращает `slots.body.entries = []` (потому что spec не нормирует heuristic) — это finding (B-3 в дизайне). Мы записываем expected как pragmatic implementation; mismatch = ambiguity для backlog.

- [ ] **Step 2: artifact/invitations-sent-events-feed-as-attendee-u-att-1.json**

Attendee с u-att-1 на invitations-sent: viewerWorld.Event = пусто (потенциальная B-1). Если так — feed.entries = [].

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "crystallize(events-feed, viewer=attendee-u-att-1). Attendee не видит чужие Event'ы (Event.ownerField=organizerId; Alice ≠ u-org-1) → пустой feed. Если кому-то это нелогично — это finding для спеки (B-1: cascade visibility через Attendee)."
  },
  "projectionId": "events-feed",
  "archetype": "feed",
  "viewer": "attendee",
  "slots": {
    "body": {
      "entries": []
    }
  }
}
```

- [ ] **Step 3: artifact/invitations-sent-event-detail-as-admin-u-admin-1.json**

detail для Event e1, admin доступны все intents.

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "crystallize(event-detail, viewer=admin). Detail для e1 (первая по id ASC). admin доступны все intents проекции (canExecute содержит все)."
  },
  "projectionId": "event-detail",
  "archetype": "detail",
  "viewer": "admin",
  "slots": {
    "header": {
      "title": "Quarterly Planning"
    },
    "body": {
      "fields": [
        { "name": "id",          "value": "e1" },
        { "name": "title",       "value": "Quarterly Planning" },
        { "name": "organizerId", "value": "u-org-1" },
        { "name": "venueId",     "value": "v1" },
        { "name": "startsAt",    "value": "2026-05-01T14:00:00.000Z" },
        { "name": "endsAt",      "value": "2026-05-01T16:00:00.000Z" },
        { "name": "status",      "value": "draft" }
      ]
    },
    "footer": {
      "actions": [
        { "intentId": "accept_invite", "label": "accept_invite", "confirmation": "standard" },
        { "intentId": "cancel_event",  "label": "cancel_event",  "confirmation": "standard" },
        { "intentId": "decline_invite","label": "decline_invite","confirmation": "standard" },
        { "intentId": "edit_event",    "label": "edit_event",    "confirmation": "standard" },
        { "intentId": "invite_user",   "label": "invite_user",   "confirmation": "standard" }
      ]
    }
  }
}
```

(actions sorted by intent.id ASC. cancel_event — kind=transition → "standard"; нет remove → нет destructive в этой проекции.)

primaryField для Event — first non-id non-FK field в FieldsOrder. FieldsOrder для Event: [id, title, organizerId, venueId, startsAt, endsAt, status]. Skip id. Skip organizerId (FK), skip venueId (FK). Первое подходящее: `title`. Так что header.title = e1.title = "Quarterly Planning". ✓

- [ ] **Step 4: artifact/invitations-sent-event-detail-as-organizer-u-org-1.json**

organizer видит e1 (own). Доступны: edit_event, cancel_event, invite_user, start/add/confirm wizard intents — но только из projection.intents. projection.intents = [edit_event, cancel_event, invite_user, accept_invite, decline_invite]. canExecute organizer = [create_event, edit_event, cancel_event, invite_user, start_event_planning, add_event_details, confirm_event_schedule].

Intersect: edit_event, cancel_event, invite_user. (accept/decline — attendee-only).

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "crystallize(event-detail, viewer=organizer). organizer доступны edit_event/cancel_event/invite_user; accept_invite/decline_invite — attendee-only."
  },
  "projectionId": "event-detail",
  "archetype": "detail",
  "viewer": "organizer",
  "slots": {
    "header": {
      "title": "Quarterly Planning"
    },
    "body": {
      "fields": [
        { "name": "id",          "value": "e1" },
        { "name": "title",       "value": "Quarterly Planning" },
        { "name": "organizerId", "value": "u-org-1" },
        { "name": "venueId",     "value": "v1" },
        { "name": "startsAt",    "value": "2026-05-01T14:00:00.000Z" },
        { "name": "endsAt",      "value": "2026-05-01T16:00:00.000Z" },
        { "name": "status",      "value": "draft" }
      ]
    },
    "footer": {
      "actions": [
        { "intentId": "cancel_event", "label": "cancel_event", "confirmation": "standard" },
        { "intentId": "edit_event",   "label": "edit_event",   "confirmation": "standard" },
        { "intentId": "invite_user",  "label": "invite_user",  "confirmation": "standard" }
      ]
    }
  }
}
```

- [ ] **Step 5: artifact/invitations-sent-invite-form-as-organizer-u-org-1.json**

form архетип. mainIntent = invite_user (intents.length===1). header.title = "invite_user". body — slot-override: `{_authored: true, fields: ["userId"]}`.

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "crystallize(invite-form, viewer=organizer). Form архетип; intents.length===1 → header.title=intent.id. mergeProjections заменил body на authored ['userId']."
  },
  "projectionId": "invite-form",
  "archetype": "form",
  "viewer": "organizer",
  "slots": {
    "header": {
      "title": "invite_user"
    },
    "body": {
      "_authored": true,
      "fields": ["userId"]
    },
    "footer": {
      "submit": { "intentId": "invite_user", "label": "invite_user", "confirmation": "standard" }
    }
  }
}
```

- [ ] **Step 6: artifact/wizard-flow-event-planning-wizard-as-organizer-u-org-1.json**

wizard архетип. spec/03-objects/artifact.md говорит `slots.body.steps`. Структура steps — opaque в v0.1 (Lightly-tested). Принимаю pragmatic interpretation: каждый step = ref на intent с meta.

```json
{
  "_meta": {
    "specVersion": "0.1",
    "manifestSha256": "6f204b7f139fcdfea9144b84c5c226d45a6e1e38fe8cd09763473b43d3f3e6fb",
    "description": "crystallize(event-planning-wizard, viewer=organizer). Wizard архетип; slots.body.steps — массив step-объектов с intent reference + confirmation. Структура lightly-tested в v0.1; implementer choice: каждый step = {intentId, label, confirmation, isCommit}. Если idf-go даёт другую структуру — finding для backlog (B-2)."
  },
  "projectionId": "event-planning-wizard",
  "archetype": "wizard",
  "viewer": "organizer",
  "slots": {
    "body": {
      "steps": [
        { "intentId": "start_event_planning",   "label": "start_event_planning",   "confirmation": "standard", "isCommit": false },
        { "intentId": "add_event_details",     "label": "add_event_details",      "confirmation": "standard", "isCommit": false },
        { "intentId": "confirm_event_schedule","label": "confirm_event_schedule", "confirmation": "standard", "isCommit": true  }
      ]
    }
  }
}
```

(`isCommit: true` для последнего intent'а потому что у него `effects` содержит `kind: commit`.)

- [ ] **Step 7: Validate + commit**

```bash
cd ~/WebstormProjects/idf-spec && ./validate.sh 2>&1 | tail -3 && \
  ls spec/fixtures/events/expected/artifact/ | wc -l
```
Expected: 6 файлов.

```bash
cd ~/WebstormProjects/idf-spec && git add spec/fixtures/events/expected/artifact/ && git commit -q -m "events: expected/artifact — 6 файлов; lightly-tested feed/wizard через pragmatic interpretation"
```

---

## Phase 9: README + cross-validation idf-go

### Task 11: events/README.md

**Files:** `spec/fixtures/events/README.md`

- [ ] **Step 1: Написать README**

(По образцу library/README.md, с таблицами entities/roles/intents/projections/phi и описанием conformance check.)

- [ ] **Step 2: Commit**

```bash
cd ~/WebstormProjects/idf-spec && git add spec/fixtures/events/README.md && git commit -q -m "events: README.md — описание домена и conformance check"
```

### Task 12: Cross-validation через idf-go

**Files:** только run (никаких изменений).

- [ ] **Step 1: Validate idf-spec full**

```bash
cd ~/WebstormProjects/idf-spec && ./validate.sh 2>&1 | tail -5
```
Expected: все fixtures (library + events) валидны.

- [ ] **Step 2: Run idf-go conformance на events**

```bash
cd ~/WebstormProjects/idf-go && go run ./cmd/conformance ../idf-spec/spec/fixtures/events/ 2>&1 | tail -15
```

**Возможные исходы:**

**A. CONFORMANT** — все 6/6 fold + 12/12 viewer-world + 6/6 artifact match. Спека самодостаточна для events. Гипотеза §26 манифеста на 2-м домене **strongly validated**.

**B. FAILS на viewer-world** — обычно проблема organizer-cascade (B-1) или attendee не видит Events на которые приглашена. Если так:
1. Записать конкретный mismatch в новый файл `idf-spec/feedback/from-events-domain.md`
2. Либо (B-1.a) изменить expected fixtures чтобы соответствовать строгой прозе спеки (привести в соответствие с idf-go) — finding документируется как "ambiguity not blocked, just unconventional".
3. Либо (B-1.b) если ambiguity substantive — открыть spec-fix цикл (как с A-1): manifest update + spec update + fixture update + idf-go test re-run + tag.

**C. FAILS на artifact** — обычно проблема feed/wizard rendering (B-2/B-3). Implementer choice не совпал с моим. Решение:
1. Если idf-go даёт более minimal вывод — смягчить expected или закрепить в спеке нормативно.
2. Documentation в feedback.

- [ ] **Step 3: Если CONFORMANT — закрыть фазу**

```bash
cd ~/WebstormProjects/idf-spec && git log --oneline | head -5
```

- [ ] **Step 4: Если FAILS — анализ + spec-fix цикл (отдельный mini-PR)**

Зафиксировать конкретные failures в `idf-spec/feedback/from-events-domain.md`. Если ambiguity substantive → open следующий PR на спеку.

---

## Phase 10: Tag + PR

### Task 13: Tag + PR

**Files:** только git operations.

- [ ] **Step 1: Tag v0.1.3**

```bash
cd ~/WebstormProjects/idf-spec && git tag -a v0.1.3 -m "spec-v0.1.3: второй synthetic домен events (feed/wizard/commit α/multi-role)" && git push origin feat/events-domain v0.1.3 2>&1 | tail -3
```

- [ ] **Step 2: PR**

```bash
cd ~/WebstormProjects/idf-spec && gh pr create --base main --head feat/events-domain --title "spec v0.1.3: второй synthetic домен events (нагружает feed/wizard/commit α)" --body "...(см. дизайн-doc для содержимого)..." 2>&1 | tail -3
```

(Body PR'а содержит ссылку на дизайн-doc + summary findings из cross-validation idf-go.)

- [ ] **Step 3: Worktree cleanup (если ещё существует)**

```bash
cd ~/WebstormProjects/idf && git worktree remove ../idf-manifest-v2.1 2>&1 | tail -2
```

(Worktree был создан для manifest v2.1 sync; больше не нужен.)

---

## Self-review плана

**1. Spec coverage:**
- Phase 2 (ontology) — 4 entity, 3 role с обоими типами (default + admin) ✓
- Phase 3 (intents) — 9 intents включая wizard chain с commit α ✓
- Phase 4 (projections) — 4 проекции, нагружают feed + wizard + form + detail ✓
- Phase 5 (phi) — 6 сценариев включая wizard-flow ✓
- Phase 6-8 (expected) — все 24 файла (6 world + 12 viewer-world + 6 artifact) ✓
- Phase 9 — cross-validation idf-go ✓
- Гипотезы B-1/B-2/B-3 из дизайна — явно тестируются в Task 9 (Step 4 для B-1 через Attendee viewerWorld) и Task 10 (Step 1 B-3, Step 6 B-2)

**2. Placeholder scan:** все Steps содержат конкретный JSON или конкретные команды. Outline для events/README.md (Task 11 Step 1) — это reference на library/README.md как образец, не placeholder.

**3. Type consistency:** имена согласованы (User/Venue/Event/Attendee везде; viewer roles везде attendee/organizer/admin).

**4. Известные риски:**
- **Phase 9 Outcome B (FAILS на viewer-world)** — высокая вероятность, что-то найдётся. План явно предусматривает spec-fix цикл с примечанием «documentировать в feedback».
- **Phase 9 Outcome C (FAILS на artifact для feed/wizard)** — средняя вероятность, потому что я записал expected pragmatically (с heuristic, который не нормирован спекой). Implementer choice — может разойтись.
- Ambiguity по cancel_event (transition vs remove) — я записал transition, не remove (status → cancelled). Это нормирует state-machine как «cancellation = transition». Если idf-go примет remove — finding (но это design choice, не impl).

---

## Plan complete

Сохранён: `idf-spec/plans/2026-04-19-events-domain-plan.md`.

## Execution choice

Auto mode active. Перехожу к **inline execution** через `superpowers:executing-plans`.
