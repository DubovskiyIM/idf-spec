# Intent

## Источник

Манифест v2 §6.

## Назначение

Intent — декларативное описание возможности изменить мир. Не функция, не handler; структура данных формата.

Generic effect handler формата механически применяет объявленные `effects` к Φ при подтверждении — domain-автор не пишет императивный код. Это свойство — ключевое: намерения переиспользуемы между материализациями (pixel, voice, agent API, document) без модификации.

## Структура (нормативно)

JSON Schema: [`schemas/intent.schema.json`](../schemas/intent.schema.json).

| Поле             | Тип    | Обязательно | Описание |
|------------------|--------|-------------|----------|
| `id`             | string | MUST        | Стабильный ID, `lower_snake_case`. Идентифицирует intent в `role.canExecute`, `projection.intents`, `effect.context.intentId`. |
| `ownerRole`      | string | MUST        | Имя роли из `ontology.roles`, авторизованной инициировать intent. |
| `requiredFields` | array  | SHOULD      | Поля, обязательные к заполнению viewer'ом перед confirm. |
| `conditions`     | array  | MAY         | Предикаты над миром — Reserved L4 (язык не нормируется). |
| `effects`        | array  | MUST        | Минимум один proto-эффект. |

### requiredFields

Каждый элемент — `{name: string, type: string}`. Эти поля попадают в `slots.body.fields` form-архетипа при кристаллизации; при confirm они MUST присутствовать в `effect.fields`. `type` в v0.1 — opaque строка (рекомендация: использовать имена из `ontology.field.type` — `string`, `number`, `boolean`, `datetime`, `enum`); validation формы — задача host'а, не нормирована в v0.1.

### Proto-эффекты

`effects` в intent — это **шаблоны** эффектов, не готовые эффекты. Каждый proto-эффект имеет обязательные `kind` и `entity`; `fields` опциональны и могут отсутствовать или содержать плейсхолдеры.

В v0.1 плейсхолдеры **не нормируются** — implementer вправе использовать любую конвенцию (`$viewer.id`, `{userId}`, или просто полагаться на то, что `fields` будут заполнены при подтверждении из form data + viewer context). Reserved для v0.2+ (templating language).

Пример proto-эффекта в `borrow_book` intent:
```json
{ "kind": "create", "entity": "Loan" }
```

При confirm host заполняет `fields` из form data (`bookId` из `requiredFields`) + viewer context (`userId = viewer.id`, `borrowedAt = now()`, `status = "active"`, `id = uuid()`).

### Системные intent'ы

Манифест §6 упоминает шестой вид — «системные намерения» (`schedule_timer`, `revoke_timer`). v0.1 их **не нормирует** (Reserved L4 — темпоральный scheduler). Implementer MAY определить такие intent'ы в ontology, но формат не предписывает их семантики в v0.1.

### Conditions

Reserved L4. v0.1 принимает массив `conditions` как opaque, validator не оценивает условия. Это сознательное упрощение для v0.1: любой intent, авторизованный для роли (`role.canExecute`), считается готовым к confirm при заполнении `requiredFields`.

## Cross-references

- [`spec/03-objects/effect.md`](effect.md) — proto-effects превращаются в effects при confirm
- [`spec/03-objects/ontology.md`](ontology.md) — `ownerRole` и `entity` в effects ссылаются на ontology
- [`spec/03-objects/projection.md`](projection.md) — projections группируют intent'ы

## Open questions

### Q-6: Условный язык conditions

**Манифест говорит:** §6 — «conditions — предикаты над миром, которые должны выполняться».

**Ambiguity:** не нормирован язык предикатов (текстовый DSL? JS expression? structured AST?).

**v0.1 нормативная позиция:** opaque массив; validator в v0.1 не оценивает условия (любой intent confirm-able при заполнении requiredFields).

**Reserved for resolution in:** v0.2+.

### Q-7: Templating fields в proto-effects

**v0.1 нормативная позиция:** не нормирован. Implementer SHOULD заполнять fields из form data + viewer context при confirm (рекомендация для library: `userId = viewer.id`, `id = host-сгенерированный uuid`, `borrowedAt = now()`).

**Reserved for resolution in:** v0.2+ (templating language с явной грамматикой плейсхолдеров).

### Q-8: ownerRole consistency

**v0.1 нормативная позиция:** validator MUST проверять, что `intent.ownerRole` соответствует существующей роли в `ontology.roles`. Это referential consistency на уровне самой ontology+intents (не invariant мира).
