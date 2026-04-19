#!/usr/bin/env bash
# Self-validation спеки: проверяет, что (1) JSON Schemas валидны как
# draft-07 и (2) fixtures валидируются против соответствующих schemas.
# Это infrastructure для авторов спеки, не часть нормативного формата.

set -euo pipefail

cd "$(dirname "$0")"

SCHEMAS_DIR="spec/schemas"
FIXTURES_DIR="spec/fixtures"

if [ ! -d "$SCHEMAS_DIR" ]; then
  echo "Нет $SCHEMAS_DIR — ничего валидировать."
  exit 0
fi

# Step 1: каждый файл в SCHEMAS_DIR должен быть корректным JSON Schema draft-07.
echo "== Schemas (draft-07 well-formedness) =="
shopt -s nullglob
schemas=("$SCHEMAS_DIR"/*.schema.json)
if [ ${#schemas[@]} -eq 0 ]; then
  echo "  (нет .schema.json в $SCHEMAS_DIR)"
else
  for schema in "${schemas[@]}"; do
    echo "  $schema"
    npx ajv compile -s "$schema" --strict=false > /dev/null
  done
fi

# Step 2: fixtures валидируются против схем по конвенции имени.
# Wrapper-схемы (intents-collection, projections-collection, phi)
# валидируют коллекции и phi-файлы; индивидуальные схемы — отдельные
# объекты (ontology, artifact).
if [ -d "$FIXTURES_DIR" ]; then
  echo "== Fixtures =="
  for domain_dir in "$FIXTURES_DIR"/*/; do
    domain="$(basename "$domain_dir")"
    echo "  domain: $domain"

    if [ -f "$domain_dir/ontology.json" ] && [ -f "$SCHEMAS_DIR/ontology.schema.json" ]; then
      npx ajv validate \
        -s "$SCHEMAS_DIR/ontology.schema.json" \
        -d "$domain_dir/ontology.json" \
        --strict=false
    fi

    if [ -f "$domain_dir/intents.json" ] && [ -f "$SCHEMAS_DIR/intents-collection.schema.json" ]; then
      npx ajv validate \
        -s "$SCHEMAS_DIR/intents-collection.schema.json" \
        -r "$SCHEMAS_DIR/intent.schema.json" \
        -d "$domain_dir/intents.json" \
        --strict=false
    fi

    if [ -f "$domain_dir/projections.json" ] && [ -f "$SCHEMAS_DIR/projections-collection.schema.json" ]; then
      npx ajv validate \
        -s "$SCHEMAS_DIR/projections-collection.schema.json" \
        -r "$SCHEMAS_DIR/projection.schema.json" \
        -d "$domain_dir/projections.json" \
        --strict=false
    fi

    if [ -d "$domain_dir/phi" ] && [ -f "$SCHEMAS_DIR/phi.schema.json" ]; then
      phi_files=("$domain_dir/phi"/*.json)
      if [ ${#phi_files[@]} -gt 0 ] && [ -e "${phi_files[0]}" ]; then
        for phi in "${phi_files[@]}"; do
          echo "    phi: $phi"
          npx ajv validate \
            -s "$SCHEMAS_DIR/phi.schema.json" \
            -r "$SCHEMAS_DIR/effect.schema.json" \
            -d "$phi" \
            --strict=false
        done
      fi
    fi

    if [ -d "$domain_dir/expected/artifact" ] && [ -f "$SCHEMAS_DIR/artifact.schema.json" ]; then
      art_files=("$domain_dir/expected/artifact"/*.json)
      if [ ${#art_files[@]} -gt 0 ] && [ -e "${art_files[0]}" ]; then
        for art in "${art_files[@]}"; do
          echo "    artifact: $art"
          npx ajv validate \
            -s "$SCHEMAS_DIR/artifact.schema.json" \
            -d "$art" \
            --strict=false
        done
      fi
    fi
  done
fi

echo "== OK =="
