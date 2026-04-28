# hash-function — нормативная спецификация `cyrb53` + `hashOntology`

**Conformance.** Этот документ — нормативное приложение к [`spec/06-evolution.md`](../06-evolution.md) §1. Реализация L3-evolution conformant **MUST** реализовать функции `cyrb53` и `hashOntology` так, чтобы результат byte-в-byte совпадал с тест-векторами в [`hash-function.vectors.json`](./hash-function.vectors.json).

**Reference.** JS reference — `idf-sdk/packages/core/src/schemaVersion.js@0.107.0+`. Эта спека первична; reference impl — следствие.

---

## §1. cyrb53 — 53-bit pure hash

`cyrb53(str: string, seed: u32) → u64` — детерминированная не-криптографическая хэш-функция, возвращающая 53-битное целое число, упакованное в `u64`.

### Требования к окружению

- Доступна 32-битная беззнаковая целочисленная арифметика с обёрткой на переполнение (modulo 2³²).
- Доступно 32-битное целочисленное умножение с обёрткой (`Math.imul` в JS, `wrapping_mul` в Rust, `*` для `u32` в Go при правильном type promotion).
- `str` обрабатывается как последовательность UTF-16 code units (как в `String.charCodeAt(i)` в JS). См. §3 ниже про non-BMP кодпойнты.

### Алгоритм (нормативно)

```
input:  str (UTF-16 code unit sequence), seed (u32, default = 0)
output: 53-битное целое (u64 со старшими 11 битами = 0)

1. Инициализация:
     h1 := 0xdeadbeef XOR seed   (u32)
     h2 := 0x41c6ce57 XOR seed   (u32)

2. Для каждого code unit ch (u16) в str:
     h1 := imul32(h1 XOR ch, 0x9e3779b1)   // 2654435761
     h2 := imul32(h2 XOR ch, 0x5f356495)   // 1597334677

3. Финализация (sequential dependency — h2 использует уже-обновлённое h1):
     h1 := imul32(h1 XOR (h1 >>> 16), 0x85ebca6b) XOR
           imul32(h2 XOR (h2 >>> 13), 0xc2b2ae35)
     h2 := imul32(h2 XOR (h2 >>> 16), 0x85ebca6b) XOR
           imul32(h1 XOR (h1 >>> 13), 0xc2b2ae35)
     // ВАЖНО: вторая строка использует НОВОЕ значение h1, не старое.

4. Сборка результата (u64):
     result := (4294967296 * (h2 AND 0x1fffff)) + h1
     // h1 трактуется как u32 (старший бит — обычный бит)

return result
```

`imul32(a, b)` — 32-битное умножение с обёрткой на переполнение (`(a * b) mod 2³²`).
`>>>` — беззнаковый правый сдвиг (logical shift right).

### Hex-форматирование

Result преобразуется в hex zero-pad'ом до 14 символов:

```
hex(result)  // строчные hex digits, без префикса "0x"
pad_left(hex, "0", 14)
```

Маска `h2 AND 0x1fffff` гарантирует ≤ 21 значимый бит в старшем dword'е, что даёт результат ≤ 2⁵³ − 1, который укладывается в 14 hex-символов (53 бита / 4 = 13.25, padded до 14).

### Свойства

- **Детерминированность:** одинаковый вход → одинаковый выход на всех stack'ах. Cross-stack reproducibility — основной use case.
- **Не криптографический:** collision-resistance ~2²⁶ (birthday paradox для 53-битного диапазона). Покрывает любой реалистичный tenant.
- **Sync, pure:** без I/O, без random, без time.

---

## §2. hashOntology

`hashOntology(ontology: object | null) → string` — стабильный fingerprint онтологии для `effect.context.schemaVersion`.

### Алгоритм (нормативно)

```
input:  ontology (JSON-compatible value, или null)
output: 14-character lowercase hex string

1. Если ontology == null:
     return "00000000000000"

2. canonical := canonicalize(ontology)
     // см. §2.1

3. serialized := JSON.stringify(canonical)
     // RFC 8259 stringification без пробелов; ключи уже отсортированы шагом 2

4. h := cyrb53(serialized, seed=0)

5. return hex_pad14(h)
```

### §2.1 canonicalize

```
canonicalize(value):
  if value is null OR value is primitive (number, string, boolean):
    return value
  if value is array:
    return [canonicalize(x) for x in value]      // порядок СОХРАНЯЕТСЯ
  if value is object:
    sorted_keys := sort(keys(value))             // лексикографически
    return { k: canonicalize(value[k]) for k in sorted_keys }
```

**Object keys сортируются лексикографически** (важно: автор может редактировать онтологию вручную и порядок ключей в JSON не должен влиять на хэш).

**Массивы сохраняют порядок** (порядок в массиве семантичен — например, `roles: ["admin", "viewer"]` ≠ `roles: ["viewer", "admin"]`).

### §2.2 JSON.stringify-эквивалент

Stack-impl **MUST** использовать сериализацию, эквивалентную RFC 8259 без отступов:
- `null` → `null`
- `true` / `false` → `true` / `false`
- numbers → как в JS `JSON.stringify` (целое: `42`, double: `1.5`, без trailing `.0`)
- strings → JSON-escaped UTF-8 в double quotes (`"a\nb"`)
- arrays → `[v1,v2,v3]`
- objects → `{"k1":v1,"k2":v2}`

Между парами ключ-значение и элементами массива — **без пробелов**. Это совпадает с дефолтом `JSON.stringify(value)` в JS.

---

## §3. Кодировка строк (non-normative для v0.1)

Reference JS impl использует `charCodeAt(i)` который возвращает UTF-16 code units (16-бит каждый). Для BMP code points это совпадает с UTF-32. Для non-BMP (emoji, исторические скрипты) `charCodeAt` возвращает surrogate pairs как два отдельных code units.

Stack-port'ы (Go/Rust/Swift) **MUST** обрабатывать строки как UTF-16 code unit sequence для cross-stack совместимости. Конкретно:

- **Go:** конвертировать `string` → `utf16.Encode([]rune(s))` → `[]uint16`, затем итерировать.
- **Rust:** `s.encode_utf16().collect::<Vec<u16>>()`.
- **Swift:** `s.utf16` view (естественный путь — это и есть internal repr).

Test-vectors §4 покрывают только ASCII, но cross-stack-diff harness валидирует это implicitly через ontology-фикстуры (которые ASCII).

---

## §4. Тест-векторы

[`hash-function.vectors.json`](./hash-function.vectors.json) содержит:

- 6 `cyrb53-string` векторов: `cyrb53(input, seed=0)` → ожидаемый 14-char hex.
- 8 `hashOntology` векторов: `hashOntology(input)` → ожидаемый 14-char hex.

Реализация L3-evolution conformant **MUST** проходить все 14 векторов byte-в-byte. Любое отклонение → `effect.context.schemaVersion` будет drift'иться между stack'ами и upcaster pipeline сломается.

### Sample vectors (для быстрой sanity-проверки)

| Input | Output |
|---|---|
| `cyrb53("", 0)` | `0bdcb81aee8d83` |
| `cyrb53("abc", 0)` | `11f9f91ac18c8d` |
| `hashOntology(null)` | `00000000000000` |
| `hashOntology({})` | `1bc27f5a56d1e7` |
| `hashOntology({entities:{Task:{fields:{}}}})` | `159c4399c937de` |
| `hashOntology({a:1,b:2,c:3})` | `167bc0dd9eccc2` |
| `hashOntology({c:3,a:1,b:2})` | `167bc0dd9eccc2` (=, order-independent) |
| `hashOntology({roles:["admin","viewer"]})` | `0456c4bf6b1aa9` |
| `hashOntology({roles:["viewer","admin"]})` | `03b6c6567446e1` (≠, array order matters) |

---

## §5. Stability

Эта спека **MUST** оставаться неизменной для одной major-версии формата. Если cyrb53 заменяется (например на SHA-256 или BLAKE3) — это **versioning event самой hash-функции**, требующий координации:

1. Новая major-версия `idf-spec`.
2. Все stack-impl обновляются синхронно.
3. Все существующие `effect.context.schemaVersion` в Φ становятся «legacy hash»; реализации **MAY** rehash при первом fold или хранить два hash'а параллельно.

Cyrb53 выбран из-за: pure JS совместимости (без зависимостей), детерминизма, скорости (~100 MB/s в современном V8), и достаточной collision-resistance для use case (fingerprint в Φ-effect'ах). 53 бита — максимум, который укладывается в JS double без потери точности (`Number.MAX_SAFE_INTEGER = 2⁵³ − 1`), что делает результаты прямо comparable как numbers.
