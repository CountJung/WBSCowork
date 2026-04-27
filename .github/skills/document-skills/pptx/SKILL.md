---
name: pptx
description: "Presentation creation, editing, and analysis. When Claude needs to work with presentations (.pptx files) for: (1) Creating new presentations, (2) Modifying or editing content, (3) Working with layouts, (4) Adding comments or speaker notes, or any other presentation tasks"
license: Proprietary. LICENSE.txt has complete terms
---

# PPTX creation, editing, and analysis

## Overview

A user may ask you to create, edit, or analyze the contents of a
.pptx file. A .pptx file is essentially a ZIP archive containing XML files and
other resources that you can read or edit. You have different tools and workflows
available for different tasks.

## Reading and analyzing content

### Text extraction
If you just need to read the text contents of a presentation, you should
convert the document to markdown:

```bash
# Convert document to markdown
python -m markitdown path-to-file.pptx
```

### Raw XML access
You need raw XML access for: comments, speaker notes, slide layouts, animations, design elements, and complex formatting.

#### Key file structures
* `ppt/presentation.xml` - Main presentation metadata and slide references
* `ppt/slides/slide{N}.xml` - Individual slide contents
* `ppt/slideLayouts/` - Layout templates for slides
* `ppt/slideMasters/` - Master slide templates
* `ppt/theme/` - Theme and styling information
* `ppt/media/` - Images and other media files

## Creating a new PowerPoint presentation **without a template**

When creating a new PowerPoint presentation from scratch, use the **html2pptx** workflow.

### Design Principles

**CRITICAL**: Before creating any presentation, analyze the content and choose appropriate design elements:
1. Consider the subject matter and tone
2. Check for branding requirements
3. Match palette to content
4. State your approach before writing code

**Requirements**:
- ✅ Use web-safe fonts only: Arial, Helvetica, Times New Roman, Georgia, Courier New, Verdana, Tahoma, Trebuchet MS, Impact
- ✅ Create clear visual hierarchy through size, weight, and color
- ✅ Ensure readability: strong contrast, appropriately sized text, clean alignment
- ✅ Be consistent: repeat patterns, spacing, and visual language across slides

### Color Palette Selection

**Warm Blush** (default for WBSCowork presentations):
- Mauve: `A49393`
- Blush: `EED6D3`
- Rose: `E8B4B8`
- Cream: `FAF7F2`
- Dark text: `3D2B2B`
- Accent dark: `7A5C5C`

### Workflow

1. Create HTML file for each slide with proper dimensions (720pt × 405pt for 16:9)
   - Use `<p>`, `<h1>`-`<h6>`, `<ul>`, `<ol>` for all text content
   - Use `class="placeholder"` for chart/table areas
   - **CRITICAL**: Rasterize gradients and icons as PNG first using Sharp
2. Create and run a JavaScript file using the `html2pptx.js` library
   - The library is at `.github/skills/document-skills/pptx/scripts/html2pptx.js`
   - Use `html2pptx()` to process each HTML file
   - Save with `pptx.writeFile()`

### Layout Tips

- Two-column layout (PREFERRED for charts/tables): header full width, then two columns
- **NEVER vertically stack** charts/tables below text in a single column
- Full-bleed images with text overlays for visual impact

## Editing an existing PowerPoint presentation

### Workflow
1. Unpack: extract the .pptx ZIP manually or use a script
2. Edit XML files (`ppt/slides/slide{N}.xml`)
3. Repack as ZIP with .pptx extension

## Creating Thumbnail Grids

```bash
python scripts/thumbnail.py template.pptx [output_prefix]
```

## Dependencies

Required dependencies:
- **pptxgenjs**: `npm install -g pptxgenjs`
- **playwright**: `npm install -g playwright`
- **sharp**: `npm install -g sharp`
- **markitdown**: `pip install "markitdown[pptx]"`
