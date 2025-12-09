---
name: mermaid-validator
description: Validate Mermaid diagram syntax in markdown files using the @zabaca/mermaid-validate CLI. Use this skill AFTER writing or editing mermaid code blocks in markdown files, or when a mermaid diagram has rendering errors. Triggers on mermaid, diagram, flowchart, sequence diagram validation.
---

# Mermaid Diagram Validator

Validates Mermaid diagram syntax using the official mermaid parser via `@zabaca/mermaid-validate`.

## When to Use

**ALWAYS use this skill after:**
- Writing a new mermaid code block in a markdown file
- Editing an existing mermaid diagram
- Creating or updating architecture diagrams
- Fixing mermaid syntax errors

**Trigger phrases:**
- "validate mermaid"
- "check diagram syntax"
- "mermaid rendering error"
- After any Write/Edit to a `.md` file containing mermaid blocks

## Instructions

### 1. Validate a Single File

Run the validator on the markdown file:

```bash
bunx @zabaca/mermaid-validate <file.md>
```

**Example:**
```bash
bunx @zabaca/mermaid-validate docs/architecture.md
```

### 2. Validate from stdin (for quick checks)

```bash
echo 'graph TD; A-->B' | bunx @zabaca/mermaid-validate -
```

### 3. Validate a Directory

```bash
bunx @zabaca/mermaid-validate docs/
```

### 4. JSON Output (for parsing)

```bash
bunx @zabaca/mermaid-validate --json <file.md>
```

## Interpreting Results

**Success:**
```
✓ file.md:block1
✓ file.md:block2

Summary: 2 valid, 0 invalid
```

**Failure:**
```
✗ file.md:block1 (line 15)
  Parse error on line 2:
  ...A[Function uuid() here]
  ----------------------^
  Expecting 'SQE', 'DOUBLECIRCLEEND'...

Summary: 0 valid, 1 invalid
```

## Common Fixes

### Parentheses in Labels
```mermaid
# Wrong - unquoted parentheses
A[Function uuid() call]

# Correct - use quotes
A["Function uuid() call"]
```

### HTML Tags in Labels
```mermaid
# Wrong - HTML tags
A[Text<br/>More text]

# Correct - use quoted multiline
A["Text
More text"]
```

### Special Characters
```mermaid
# Wrong - unescaped special chars
A[Node → Target]

# Correct - use quotes or escape
A["Node to Target"]
```

## Exit Codes

- `0` - All diagrams valid
- `1` - One or more diagrams invalid

## Workflow Integration

After editing any markdown with mermaid:

1. Save the file
2. Run: `bunx @zabaca/mermaid-validate <file>`
3. Fix any reported errors
4. Re-validate until all pass
5. Commit changes
