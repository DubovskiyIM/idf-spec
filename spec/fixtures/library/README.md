# library — эталонный домен спеки v0.1

Синтетический минимальный домен. **Не копия production-домена** — спроектирован под покрытие L1+L2 без шума (см. `design/2026-04-19-spec-v0.1-design.md` §5).

Все нормативные спеки (HTTP RFC, OpenAPI, JSON Schema) используют дидактические минимальные примеры в test vectors. `library` следует той же стратегии.

## Сущности

| Сущность | `kind` | `ownerField` | Назначение |
|---|---|---|---|
| `User` | internal | `id` (self-owned) | Пользователь библиотеки. Каждый видит только свой профиль. |
| `Book` | reference | — | Общий каталог книг; виден всем ролям с правильным `visibleFields`. |
| `Loan` | internal | `userId` | Запись о займе. State machine `active → returned`. Видна только владельцу + librarian. |

## Роли

| Роль | base | visibleFields | canExecute |
|---|---|---|---|
| `reader` | (default) | User: [id, name]; Book: \*; Loan: \* | borrow_book, return_book |
| `librarian` | `admin` | все | add_book, remove_book, register_user, update_book_metadata, cancel_loan |

`librarian.base = "admin"` — нормирует row-override (видит все записи независимо от `ownerField`); см. [`../../04-algebra/filter-world.md`](../../04-algebra/filter-world.md) priority 1.

## Намерения (7)

| `id` | `ownerRole` | Эффекты |
|---|---|---|
| `add_book` | librarian | create Book |
| `remove_book` | librarian | remove Book |
| `update_book_metadata` | librarian | replace Book |
| `register_user` | librarian | create User |
| `borrow_book` | reader | create Loan |
| `return_book` | reader | transition Loan |
| `cancel_loan` | librarian | remove Loan |

## Проекции (5, покрывают 4/7 архетипов)

| `id` | `archetype` | Intents в проекции |
|---|---|---|
| `book-catalog` | catalog | add_book, remove_book, update_book_metadata |
| `book-detail` | detail | update_book_metadata, remove_book, borrow_book |
| `borrow-form` | form | borrow_book (со slot-override `body.fields = ["bookId"]`) |
| `my-loans` | catalog | return_book |
| `librarian-dashboard` | dashboard | add_book, register_user, cancel_loan |

Архетипы `feed`, `canvas`, `wizard` не покрыты fixture-вектором (Lightly-tested в v0.1; см. [`../../01-conformance.md`](../../01-conformance.md)).

## Сценарии Φ

| phi-файл | Что моделирует |
|---|---|
| `empty.json` | Пустой Φ; smoke test для fold пустоты. |
| `bootstrap.json` | librarian создаёт три книги (b1, b2, b3). |
| `register-readers.json` | bootstrap + librarian регистрирует Alice (u-r1) и Bob (u-r2). |
| `borrow-cycle.json` | register-readers + Alice одалживает b1 → Loan l1 active. |
| `borrow-and-return.json` | borrow-cycle + Alice возвращает книгу → Loan l1 returned, returnedAt заполнен. |
| `cancel-loan.json` | borrow-cycle + librarian удаляет Loan l1. |
| `update-book.json` | bootstrap + librarian заменяет b3.author. |

Каждый сценарий — самодостаточный Φ; не зависит от прочих в runtime, но логически кумулятивный (последующие включают эффекты предыдущих).

## Использование fixtures для conformance check

Implementer L1+L2 пишет: `parse(input) + apply L1+L2 functions + emit output`. Для каждого фрагмента — отдельный fixture-сравнение:

### L1 conformance

1. **Парсер:** загрузить `ontology.json`, `intents.json`, `projections.json` и каждый файл из `phi/`. Все MUST валидироваться против соответствующих JSON Schema.
2. **fold:** для каждого `phi/<scenario>.json`:
   - применить `fold(phi.effects, ontology) → world`
   - сравнить `world` с `expected/world/<scenario>.json` `world`-полем (semantic equality).
3. **filterWorldForRole:** для каждого (`<scenario>`, `<viewer>`):
   - применить `filterWorldForRole(world, viewer, ontology) → viewerWorld`
   - сравнить с `expected/viewer-world/<scenario>-as-<role>-<id>.json` `viewerWorld`-полем.

### L2 conformance

4. **crystallize:** для каждого (`<scenario>`, `<projection>`, `<viewer>`):
   - получить viewerWorld (шаг 3)
   - применить `crystallize(intents, ontology, projection, viewer, viewerWorld) → artifact`
   - сравнить с `expected/artifact/<scenario>-<projection>-as-<role>-<id>.json` (без `_meta`).

Все шаги pass → L1+L2 conformant.

### Semantic equality

Сравнение — semantic equality:
- **Объекты:** deep-equal с игнорированием порядка ключей.
- **Массивы:** порядок MUST совпадать (массивы в expected — нормативный порядок; см. [`../../04-algebra/crystallize.md`](../../04-algebra/crystallize.md) фаза 3).
- **`_meta`** в expected-файлах — informative, не учитывается при сравнении.

## Имена viewer'ов в fixture-файлах

Конвенция: `<scenario>-<projection>-as-<role>-<viewerId>.json`.

- `librarian-u-lib-1` — librarian с id `u-lib-1` (этот id используется как initiator во всех librarian effects'ах).
- `reader-u-r1` — reader Alice (создаётся `register_user` в register-readers.json).
- `reader-u-r2` — reader Bob (создаётся `register_user` в register-readers.json).
