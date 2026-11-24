---
title: "JSON Schema"
description: "Endpoint schemas are checked by PromptGate itself (draft 2020-12, no extra dependency). The validator implements the keywords structured LLM output and request…"
---

<!-- Generated from docs/json-schema.md by scripts/sync-docs.mjs. Edit the source, not this file. -->

[Endpoint](/endpoints/#schemas) schemas are checked by PromptGate
itself (draft 2020-12, no extra dependency). The validator implements
the keywords structured LLM output and request validation use, and is
run against the official [JSON Schema test
suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite) on
every build: 1,078 cases pass; 44 cases need keywords listed below as
unsupported.

## Supported

- `type` (also a list), `enum`, `const`
- objects: `properties`, `required`, `additionalProperties`,
  `patternProperties`, `minProperties`, `maxProperties`
- arrays: `items`, `prefixItems`, `minItems`, `maxItems`, `uniqueItems`
- strings: `minLength`, `maxLength`, `pattern` (RE2: no look-around),
  `format` — `date`, `date-time`, `time`, `email`, `uri`, `uuid`, `ipv4`,
  `ipv6`
- numbers: `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`,
  `multipleOf`
- `allOf`, `anyOf`, `oneOf`, `not`, and `$ref` within the schema
  (`#/$defs/…`, recursion allowed)
- annotations such as `title`, `description`, `default`, `examples`

## Not supported

Anything else — remote `$ref`, `if`/`then`/`else`, `unevaluated*`,
`dependent*`, `contains`, other formats — is an error when the config
loads, so a schema is never half-checked. Checking a typical answer
takes about 10 µs.
