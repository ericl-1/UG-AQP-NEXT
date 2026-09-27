#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VALIDATION_ENV="$PROJECT_DIR/.validation-venv"

if [ ! -x "$VALIDATION_ENV/bin/python" ]; then
  python3 -m venv "$VALIDATION_ENV"
  "$VALIDATION_ENV/bin/python" -m pip install -r "$PROJECT_DIR/validation/requirements.txt"
fi

"$VALIDATION_ENV/bin/python" "$PROJECT_DIR/validation/reference_validation.py"
