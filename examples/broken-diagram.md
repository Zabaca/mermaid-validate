# Broken diagrams (intentionally invalid)

Every diagram in this file fails validation **on purpose**. It exists to show
what the most common mermaid mistakes look like, and what `mermaid-validate`
reports for each.

Running `mermaid-validate examples/broken-diagram.md` exits with code `1`.

## 1. Unquoted parentheses in a label

Mermaid's parser reads `(` inside `[...]` as the start of a new shape.

```mermaid
graph TD
    A[Function uuid() here] --> B[End]
```

Reported error:

```text
✗ examples/broken-diagram.md:block1 (line 14)
  Parse error on line 2:
  ...A[Function uuid() here] --> B[End]
  -----------------------^
  Expecting 'SQE', 'DOUBLECIRCLEEND', 'PE', ...
```

Fix: quote the label — `A["Function uuid() here"]`.

## 2. Dangling arrow

Two arrows in a row leave the parser with nothing to connect.

```mermaid
graph TD
    A --> --> B
```

Fix: give every arrow a source and a target — `A --> B`.

## 3. Misspelled diagram type

`sequenceDiagam` (missing the second "r") is not a diagram type mermaid knows.

```mermaid
sequenceDiagam
    Alice->>Bob: Hello
```

Fix: `sequenceDiagram`.
