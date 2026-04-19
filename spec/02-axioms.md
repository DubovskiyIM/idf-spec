# Axioms

Четыре аксиомы формата (манифест v2 §23). Любая реализация, нарушающая одну из них, **не является конформной** — вне зависимости от уровня L1–L4.

## 1. Детерминизм кристаллизации

`crystallize(intents, ontology, projection, viewer, viewerWorld)` — чистая функция. Два вызова с identically equal входом MUST возвращать identically equal artifact (semantic equality).

**Запрещено:** скрытые состояния, временные зависимости (`now()` в crystallize-логике), обращения к сетевым источникам, LLM-побочные эффекты, побочные I/O.

**Cross-reference:** [`04-algebra/crystallize.md`](04-algebra/crystallize.md). Conformance проверяется fixture-векторами [`fixtures/library/expected/artifact/`](fixtures/library/expected/artifact/) — каждый файл MUST воспроизводиться из соответствующего `(intents, ontology, projection, viewer, viewerWorld)` input'а.

**Следствия:**
- artifact может быть кеширован по content hash входа
- регенерация при изменении preference не теряет неизменённые части
- diff двух artifact'ов на одинаковых input'ах MUST быть пустым

## 2. Viewer-scoping — тип данных, не фильтр

`viewerWorld = filterWorldForRole(world, viewer, ontology)` — это **тип данных** для конкретного viewer'а, не post-фильтр render'а.

Любая материализация (в v0.1 — только artifact-генерация через `crystallize`; L3+ материализации pixel/voice/agent/document — Reserved) MUST читать `viewerWorld`, не `world`.

Implementer L1+L2: MUST не передавать `world` в `crystallize`; MUST передавать `viewerWorld`. Это структурное свойство, не accident-фильтр поверх render'а.

**Cross-reference:** [`04-algebra/filter-world.md`](04-algebra/filter-world.md). Conformance проверяется fixture-векторами [`fixtures/library/expected/viewer-world/`](fixtures/library/expected/viewer-world/).

**Следствия:**
- новая материализация получает безопасность бесплатно
- добавление viewer-сценария не требует пересмотра ACL-политик в каждом читателе
- agent API получает viewerWorld в JSON; pixel — в memory; voice — в turns; document — в graph-узлах (всё одно и то же)

## 3. Irreversibility — свойство эффекта, не процесса (нормировано, integrity-rule Reserved L4)

В v0.1 эта аксиома **нормирована, но integrity-правило Reserved L4**.

**Полная формулировка** (для v0.2+): эффект с `context.__irr = {point: "high", at: <past ISO>}` MUST не отменяться через `α: "remove"` на целевой сущности. `α: "replace"` (forward correction) разрешён всегда.

**В v0.1:** implementer L1+L2 MUST принимать поле `context.__irr` как opaque object без интерпретации. Integrity-правило (валидатор блокирует remove на irreversible-помеченной сущности) добавится в v0.2+ как часть L4.

**Cross-reference:** [`03-objects/effect.md`](03-objects/effect.md) (поле `context.__irr`).

**Следствия (для v0.2+):**
- каждый автор намерения декларирует, какие эффекты irreversible
- движок принуждает уважать это решение во всех последующих обращениях
- irreversibility — декларативная, не процедурная

## 4. Audit trail через Φ

Любое изменение мира MUST происходить через confirmed effect в Φ. Мир не редактируется in-place — никаких `world[entity][field] = value`.

**Implementer L1+L2:**
- Persistence-стратегия (как хранить Φ — SQLite, Postgres, append-only files, in-memory) — host-level concern, информативно.
- **Нормативно:** Φ MUST быть append-only; effects MUST не мутировать после confirm.

**Cross-reference:** [`03-objects/effect.md`](03-objects/effect.md) (lifecycle), [`04-algebra/fold.md`](04-algebra/fold.md) (rebuild from Φ).

**Следствия:**
- `rebuild from Φ` всегда даёт текущее состояние мира (свойство fold)
- причинность сохраняется
- audit-запросы («кто изменил это поле? когда? каким intent'ом?») отвечаются запросом к Φ, не требуют отдельной audit-инфраструктуры
- тесты, дебаг, миграция — частные случаи перевычисления мира от Φ

## Cross-references

- [`01-conformance.md`](01-conformance.md) — классы L1–L4
- [`04-algebra/`](04-algebra/) — нормативные алгоритмы, реализующие аксиомы
- [`fixtures/library/`](fixtures/library/) — fixture-векторы, демонстрирующие аксиомы на эталонном домене
