---
name: docx
description: "Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. When Claude needs to work with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks"
license: Proprietary. LICENSE.txt has complete terms
---

# DOCX creation, editing, and analysis

## Overview

A user may ask you to create, edit, or analyze the contents of a .docx file.
A .docx file is essentially a ZIP archive containing XML files and other resources.

## Workflow Decision Tree

### Reading/Analyzing Content
Use text extraction or raw XML access sections below.

### Creating New Document
Use "Creating a new Word document" workflow.

### Editing Existing Document
- **Your own document + simple changes**: Use basic OOXML editing workflow
- **Someone else's document**: Use **Redlining workflow** (recommended default)
- **Legal, academic, business, or government docs**: Use **Redlining workflow** (required)

## Reading and analyzing content

### Text extraction
```bash
# Convert document to markdown with tracked changes
pandoc --track-changes=all path-to-file.docx -o output.md
```

### Key file structures
* `word/document.xml` - Main document contents
* `word/comments.xml` - Comments
* `word/media/` - Embedded images and media
* Tracked changes use `<w:ins>` (insertions) and `<w:del>` (deletions) tags

## Creating a new Word document

Use **docx-js** (the `docx` npm package) to create Word documents with JavaScript/TypeScript.

### Workflow
1. Install: `npm install docx` (or use globally installed version)
2. Create a JavaScript/TypeScript file using Document, Paragraph, TextRun components
3. Export as .docx using `Packer.toBuffer()` or `Packer.toFile()`

### Basic Example

```javascript
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const fs = require('fs');

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({
        text: "Document Title",
        heading: HeadingLevel.TITLE,
      }),
      new Paragraph({
        children: [
          new TextRun("Normal paragraph text. "),
          new TextRun({ text: "Bold text", bold: true }),
          new TextRun({ text: " Italic text", italics: true }),
        ],
      }),
    ],
  }],
});

Packer.toFile(doc, "output.docx").then(() => {
  console.log("Document created");
});
```

### Headings

```javascript
new Paragraph({
  text: "Section Title",
  heading: HeadingLevel.HEADING_1,
})
```

### Lists

```javascript
new Paragraph({
  text: "List item",
  bullet: { level: 0 },
})
```

### Tables

```javascript
const { Table, TableRow, TableCell, WidthType } = require('docx');

new Table({
  rows: [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("Cell 1")] }),
        new TableCell({ children: [new Paragraph("Cell 2")] }),
      ],
    }),
  ],
  width: { size: 100, type: WidthType.PERCENTAGE },
})
```

### Images

```javascript
const { ImageRun } = require('docx');
const fs = require('fs');

new Paragraph({
  children: [
    new ImageRun({
      data: fs.readFileSync("image.png"),
      transformation: { width: 400, height: 300 },
    }),
  ],
})
```

## Dependencies

- **docx**: `npm install -g docx` (for creating new documents)
- **pandoc**: `sudo apt-get install pandoc` (for text extraction)
