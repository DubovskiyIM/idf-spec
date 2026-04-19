# idf-spec

Нормативная спецификация формата **Intent-Driven Frontend** (IDF), версия **v0.1**.

## Что это

Отдельный документный проект, адресованный *реализациям* формата: JSON Schema для core-объектов + conformance matrix + эталонные test fixtures. Цель — дать однозначное определение того, что значит «говорить на IDF», достаточное для того, чтобы independent implementer мог реализовать формат **без чтения исходников** референсной реализации.

## Связанные репозитории (на одном уровне)

- `~/WebstormProjects/idf/` — референсная реализация (React/Node прототип, 9 доменов)
- `~/WebstormProjects/idf-sdk/` — SDK monorepo с тем же ядром в виде npm-пакетов
- `~/WebstormProjects/idf-spec/` — **этот репо** (нормативная спека)

## Принцип честного эксперимента

`idf-spec` развивается **независимо** от двух других репозиториев. Подробно — в [`CLAUDE.md`](CLAUDE.md).

Кратко: единственный источник истины при написании спеки — манифест формата (`source/manifesto-v2.snapshot.md`, frozen snapshot с SHA-256 в `source/manifesto-v2.snapshot.sha256`). Опционально допустимы `field-test-*.md` соседнего репо как примеры доменов на уровне дизайна. Любой код прототипа и SDK — read-forbidden.

Если спека пишется, заглядывая в реализацию, она перестаёт быть нормативным документом и становится её зеркалом. Эксперимент теряет смысл.

## Scope v0.1

**В скоупе** (нормативно):

- Conformance classes **L1** (parser + Φ + fold) и **L2** (crystallize + 7 архетипов + mergeProjections)
- 4 аксиомы формата (детерминизм кристаллизации, viewer-scoping как тип данных, irreversibility, audit trail)
- JSON Schema для пяти core-объектов: `ontology`, `intent`, `effect`, `projection`, `artifact`
- Test fixtures: один эталонный домен с полным набором input → expected output векторов

**Вне скоупа v0.1** (резервируется для v0.2+):

- L3 (4 материализации) и L4 (Pattern Bank `structure.apply`, темпоральный scheduler, irreversibility integrity rule, 5 видов invariant'ов)
- Pattern Bank
- Voice / agent API / document материализации
- Base-таксономия ролей, role.scope m2m

## Структура

```
idf-spec/
├── README.md                    # этот файл
├── CLAUDE.md                    # инструкции для AI-сессий, политика изоляции
├── source/
│   ├── manifesto-v2.snapshot.md # frozen snapshot входа
│   └── manifesto-v2.snapshot.sha256
├── design/                      # дизайн-документы (brainstorming output)
└── spec/                        # сама спека (будет добавлено)
    ├── 01-conformance.md
    ├── 02-axioms.md
    ├── 03-objects/
    ├── 04-algebra/
    ├── schemas/                 # JSON Schema файлы
    └── fixtures/                # test vectors
```

## Язык

Спека и документация — на **русском**, как и манифест. JSON Schema field names и normative термины — `lower-camelCase` английские (`ontology`, `effect`, `confirmedAt`).
