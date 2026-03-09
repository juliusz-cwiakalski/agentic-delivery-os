---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/evaluate-e2e-images.md
---

# E2E Image Evaluation — Agent Instructions

## 1. Overview

**Purpose:** Systematically evaluate every AI-generated image produced by the E2E battle-test suite (`test-text-to-image-e2e-suite.sh`) to compare model quality across providers.

**Method:** Use the `@image-reviewer` agent to analyze each image against its original generation prompt, scoring across 8 quality categories with detailed notes.

**Output:** A `.eval.yaml` sidecar file alongside each generated `.png` image in `tmp/e2e-suite/`.

**Report:** After all evaluations are complete, run the report generator to produce HTML and Markdown comparison reports:

```bash
bash tools/.tests/generate-e2e-report.sh
```

## 2. Prerequisites

Before running the evaluation:

1. **E2E suite has been run** — images exist in `tmp/e2e-suite/`
2. **Each image has a `.yaml` sidecar** — contains generation metadata (prompt, provider, model, settings) written by the `text-to-image` tool
3. **The `@image-reviewer` agent is available** — it performs the visual analysis of each image

### Expected file structure in `tmp/e2e-suite/`

```
tmp/e2e-suite/
├── hero-default--openai--gpt-image-1.png
├── hero-default--openai--gpt-image-1.yaml
├── hero-default--google--imagen-4.0-generate-001.png
├── hero-default--google--imagen-4.0-generate-001.yaml
├── hero-max--openai--gpt-image-1.png
├── hero-max--openai--gpt-image-1.yaml
├── product-default--openai--gpt-image-1.png
├── product-default--openai--gpt-image-1.yaml
└── ...
```

### Filename convention

```
{use_case}-{settings}--{provider}--{model}.png
{use_case}-{settings}--{provider}--{model}.yaml      ← generation metadata
{use_case}-{settings}--{provider}--{model}.eval.yaml  ← evaluation output (you create this)
```

## 3. How to Run the E2E Suite

Generate the images before evaluating them:

```bash
# Generate Tier 1 images (12 use cases × 2 settings × N providers — default):
bash tools/.tests/test-text-to-image-e2e-suite.sh --force-refresh

# Generate all tiers (24 use cases × 2 settings × N providers):
bash tools/.tests/test-text-to-image-e2e-suite.sh --tier all --force-refresh

# Single use case only:
bash tools/.tests/test-text-to-image-e2e-suite.sh --use-case hero --force-refresh

# Preview what would run without calling APIs:
bash tools/.tests/test-text-to-image-e2e-suite.sh --dry-run --tier all
```

The suite is idempotent — re-running fills gaps without regenerating existing images.

## 4. Evaluation Process

### Step-by-step for each image

1. **Discover images:** List all `.png` files in `tmp/e2e-suite/`.
2. **For each `.png` file:**
   a. **Check for existing evaluation:** If `{basename}.eval.yaml` already exists, skip this image (unless `--force` was specified).
   b. **Read the generation sidecar:** Load `{basename}.yaml` to extract:
      - `input.prompt` — the original text prompt
      - `input.provider` — the provider name (e.g., `openai`, `google`)
      - `input.model` — the model identifier
      - `input.width`, `input.height` — requested dimensions
      - `input.quality` — quality setting used
   c. **Parse the filename** to extract: `use_case`, `settings`, `provider`, `model`.
   d. **Load and view the image** — send the `.png` to `@image-reviewer`.
   e. **Evaluate against all 8 scoring categories** using the rubrics defined in Section 5.
   f. **Calculate summary metrics:** `total_score`, `max_possible`, `percentage`.
   g. **Identify strengths and weaknesses:** Top 3 strengths, top 2 weaknesses.
   h. **Write recommendation paragraph** — a concise assessment of the image's fitness for its intended web use case.
   i. **Save as `{basename}.eval.yaml`** in the same directory alongside the image and its generation sidecar.

### Processing guidelines

- Process images **one at a time**, giving each thorough attention.
- Evaluate each image **independently** — do not adjust scores relative to other models or images.
- Be **specific in notes** — reference concrete visual elements, not vague impressions.
- If the `.yaml` sidecar is missing for an image, log a warning and skip that image.

## 5. Scoring Categories

Each category is scored 0–100. Eight categories, maximum possible total: 800.

---

### 5.1 Prompt Adherence (0–100)

How faithfully does the image match the specific requirements stated in the prompt?

| Score Range | Description |
|-------------|-------------|
| 90–100 | Every element specified in the prompt is present and accurately rendered |
| 70–89 | Most elements present, minor deviations from prompt specifications |
| 50–69 | Several key elements missing or significantly different from prompt |
| 30–49 | Major departures from the prompt, only general theme matches |
| 0–29 | Image bears little resemblance to what was requested |

**Evaluation guidance:** Read the prompt carefully. List every distinct requirement (objects, colors, composition directives, style notes, text requests). Check each one against the image. The score should reflect what fraction of specific requirements are met and how accurately.

---

### 5.2 Visual Quality (0–100)

Technical image quality — sharpness, artifacts, coherent rendering.

| Score Range | Description |
|-------------|-------------|
| 90–100 | Pristine technical quality, no artifacts, no distortions, professional grade |
| 70–89 | Good quality with minor artifacts or softness that doesn't distract |
| 50–69 | Noticeable quality issues (soft areas, minor artifacts, inconsistent detail) |
| 30–49 | Significant artifacts, distortions, or AI glitches (extra fingers, melted features) |
| 0–29 | Severe quality problems rendering the image unusable |

**Evaluation guidance:** Look for AI-specific artifacts: extra/missing fingers, melted facial features, impossible geometry, texture smearing, aliasing, banding, noise, unnatural blur transitions. Also assess overall sharpness and detail resolution.

---

### 5.3 Composition & Layout (0–100)

Visual balance, focal point, negative space, framing, aspect ratio suitability.

| Score Range | Description |
|-------------|-------------|
| 90–100 | Professional composition, clear focal hierarchy, balanced elements, excellent use of space |
| 70–89 | Good composition with minor balance issues |
| 50–69 | Adequate but unremarkable composition, some awkward element placement |
| 30–49 | Poor composition, cluttered or unbalanced, confusing focal point |
| 0–29 | No discernible compositional intent |

**Evaluation guidance:** Check rule of thirds, leading lines, visual weight balance, breathing room around key elements, negative space usage. Consider whether the composition serves the intended use case (e.g., a hero banner needs text-safe space; a product shot needs a clean focal point).

---

### 5.4 Color & Lighting (0–100)

Color palette accuracy (vs prompt), color harmony, lighting quality and mood.

| Score Range | Description |
|-------------|-------------|
| 90–100 | Perfect color palette match, harmonious, lighting creates intended mood precisely |
| 70–89 | Colors mostly match, good harmony, lighting is appropriate |
| 50–69 | Some color deviations, adequate lighting but doesn't create strong mood |
| 30–49 | Significant color mismatches, poor lighting quality |
| 0–29 | Colors entirely wrong, harsh or flat lighting |

**Evaluation guidance:** Compare any specific colors mentioned in the prompt (hex codes, named colors, palette descriptions) against what was rendered. Assess whether the lighting direction, quality (soft vs hard), and color temperature match what was requested. Evaluate overall color harmony.

---

### 5.5 Detail Accuracy (0–100)

Specific elements requested in the prompt — are they present, accurate, well-rendered?

| Score Range | Description |
|-------------|-------------|
| 90–100 | Every specific detail requested is present and accurately rendered |
| 70–89 | Most details present, minor inaccuracies in some elements |
| 50–69 | Several details missing or inaccurate, general concept maintained |
| 30–49 | Many specific details missing, only broad strokes of the concept |
| 0–29 | Critical details absent, image fails to represent the concept |

**Evaluation guidance:** Make a mental checklist of every specific object, material, texture, or detail the prompt requests. Score based on how many are present and how convincingly they're rendered. Pay attention to materials (is "stoneware" distinguishable from generic ceramic?), textures (is "reclaimed wood" convincingly weathered?), and specific arrangements.

---

### 5.6 Text Rendering (0–100)

Quality of any text that appears in or should appear in the image.

**When the prompt REQUESTS text** (e.g., "the text 'ROAST & RITUAL' in large serif typography"):

| Score Range | Description |
|-------------|-------------|
| 90–100 | Text is perfectly legible, stylistically correct, well-placed |
| 70–89 | Text is readable with minor rendering issues |
| 50–69 | Text is partially readable, some characters malformed |
| 30–49 | Text is present but mostly illegible |
| 0–29 | Text is completely illegible or absent when required |

**When the prompt says "No text overlays" or doesn't request text:**

| Score Range | Description |
|-------------|-------------|
| 100 | No unwanted text appears — perfect |
| 70–99 | Minor text artifacts that don't significantly distract |
| Below 70 | Unwanted text or watermarks appear prominently |

**When text has no relevance to the prompt at all:**

Set `applicable: false`. Still provide a score based on whether unwanted text intrudes.

**Field:** `applicable: true` when the prompt explicitly requests or forbids text; `false` only for prompts with no text relevance whatsoever.

---

### 5.7 Web Readiness (0–100)

How well would this image work on a real website in its intended use case?

| Score Range | Description |
|-------------|-------------|
| 90–100 | Production-ready, a web designer would use this immediately |
| 70–89 | Usable with minor touch-ups, professional quality |
| 50–69 | Might work in a draft or low-priority context, not ideal |
| 30–49 | Would not be used on a professional website |
| 0–29 | Entirely unsuitable for web use |

**Evaluation guidance:** Consider the intended use case from the prompt. A hero banner needs to look premium and support text overlay. A product photo needs clean isolation and accurate rendering. An icon needs crisp geometry at small sizes. A testimonial card needs realistic portraiture. Score based on whether a professional web designer would accept this image for its stated purpose.

---

### 5.8 Style Consistency (0–100)

Does the image maintain a single coherent style throughout? No style mixing or tonal shifts?

| Score Range | Description |
|-------------|-------------|
| 90–100 | Perfectly consistent style, every element belongs together |
| 70–89 | Mostly consistent with minor style variations in background or edges |
| 50–69 | Some noticeable style mixing or inconsistent rendering approaches |
| 30–49 | Significant style clashes between elements |
| 0–29 | Chaotic mix of styles, no coherent visual language |

**Evaluation guidance:** Check that all elements share the same rendering approach. A photorealistic scene shouldn't have cartoon elements. A flat illustration shouldn't have photorealistic textures in one area. Look for tonal shifts, inconsistent level of detail, and style breaks at element boundaries.

## 6. Evaluation YAML Schema

Save each evaluation as `{basename}.eval.yaml` — the same base filename as the image but with `.eval.yaml` extension.

### Schema definition

```yaml
# Image Evaluation — auto-generated by @image-reviewer
# Evaluates AI-generated image quality across 8 scoring categories

evaluation:
  image_file: "{filename}.png"           # Filename of the evaluated image
  use_case: "{use_case}"                 # Use case key (e.g., "hero", "product")
  use_case_label: "{label}"              # Human-readable label (e.g., "Hero Banner with Text")
  settings: "{settings}"                 # Settings profile: "default" or "max"
  provider: "{provider}"                 # Provider key (e.g., "openai", "google")
  model: "{model}"                       # Model identifier (e.g., "gpt-image-1")
  evaluator: "image-reviewer-agent"      # Always this value
  timestamp: "{ISO-8601 UTC}"            # When the evaluation was performed

scores:
  prompt_adherence:
    score: {0-100}
    notes: "{Specific observations about prompt match — reference concrete elements}"
  visual_quality:
    score: {0-100}
    notes: "{Technical quality observations — artifacts, sharpness, coherence}"
  composition:
    score: {0-100}
    notes: "{Layout, balance, focal point, negative space observations}"
  color_and_lighting:
    score: {0-100}
    notes: "{Color palette accuracy, harmony, lighting quality and mood}"
  detail_accuracy:
    score: {0-100}
    notes: "{Specific elements present/missing/inaccurate from the prompt}"
  text_rendering:
    score: {0-100}
    applicable: {true|false}
    notes: "{Text legibility, accuracy, or absence as appropriate}"
  web_readiness:
    score: {0-100}
    notes: "{Fitness for the intended web use case}"
  style_consistency:
    score: {0-100}
    notes: "{Style coherence across all elements}"

summary:
  total_score: {sum of all 8 scores}
  max_possible: 800
  percentage: {total_score / 800 * 100, one decimal}
  strengths:
    - "{Strength 1 — specific and concrete}"
    - "{Strength 2}"
    - "{Strength 3}"
  weaknesses:
    - "{Weakness 1 — specific and concrete}"
    - "{Weakness 2}"
  recommendation: "{1-3 sentence assessment of fitness for the intended web use case, noting any conditions or caveats}"
```

### Complete example

```yaml
# Image Evaluation — auto-generated by @image-reviewer
# Evaluates AI-generated image quality across 8 scoring categories

evaluation:
  image_file: "hero-default--google--imagen-4.0-generate-001.png"
  use_case: "hero"
  use_case_label: "Hero Banner with Text"
  settings: "default"
  provider: "google"
  model: "imagen-4.0-generate-001"
  evaluator: "image-reviewer-agent"
  timestamp: "2026-03-09T14:30:00Z"

scores:
  prompt_adherence:
    score: 82
    notes: "Coffee beans and pour-over dripper present. Typography text 'ROAST & RITUAL' is attempted but partially illegible — R and A merge. Tagline text not rendered. Ceramic mug present. Color palette is accurate warm amber/brown."
  visual_quality:
    score: 88
    notes: "Sharp throughout, no visible artifacts. Good detail on coffee beans. Slight softness in the steam rendering. Professional quality overall."
  composition:
    score: 85
    notes: "Good rule of thirds placement. Text area has adequate negative space. Pour-over dripper positioned well in right third. Mug in lower left provides anchoring."
  color_and_lighting:
    score: 90
    notes: "Warm amber palette exactly as requested. Side-lighting creates good shadows. Split-toning visible. Professional color grading."
  detail_accuracy:
    score: 75
    notes: "Present: beans, pour-over, mug, wood surface, steam. Missing: oil sheen on beans not convincing. Reclaimed-wood texture is generic. Stoneware mug looks more ceramic than stoneware."
  text_rendering:
    score: 40
    applicable: true
    notes: "Main text attempted but partially illegible. 'ROAST' readable, '& RITUAL' merges. Tagline 'Artisan Coffee, Delivered Fresh' not present. Serif font choice is correct but execution poor."
  web_readiness:
    score: 78
    notes: "Could serve as a hero image with overlaid HTML text (ignoring the AI-rendered text). Photography quality and mood are appropriate for a premium coffee brand. Would need designer intervention."
  style_consistency:
    score: 92
    notes: "Consistent commercial photography style throughout. No style mixing. Bokeh, lighting, and color grading are coherent."

summary:
  total_score: 630
  max_possible: 800
  percentage: 78.8
  strengths:
    - "Color palette and lighting mood are excellent — premium feel"
    - "Composition follows professional commercial photography rules"
    - "Consistent style throughout the image"
  weaknesses:
    - "Text rendering is the weakest area — a common AI limitation"
    - "Some requested details are present but not convincingly executed"
  recommendation: "Strong as a background/mood image for a coffee brand hero section if text is overlaid via HTML/CSS rather than baked into the image. Not suitable if baked-in text is required."
```

## 7. Workflow for Batch Evaluation

Follow this procedure to evaluate all images in a single batch:

```
1. List all .png files in tmp/e2e-suite/
2. Sort alphabetically for consistent processing order
3. For each .png file:
   a. Derive the base name (strip .png extension)
   b. Check if {basename}.eval.yaml already exists
      — If yes and --force was NOT specified: log "Skipping (already evaluated)" and continue
      — If yes and --force WAS specified: proceed (will overwrite)
   c. Check if {basename}.yaml exists
      — If no: log warning "Missing generation sidecar, skipping" and continue
   d. Read {basename}.yaml to extract:
      — input.prompt (the original generation prompt)
      — input.provider
      — input.model
      — input.width, input.height
      — input.quality
   e. Parse the filename to extract use_case, settings, provider, model:
      — Pattern: {use_case}-{settings}--{provider}--{model}.png
      — Example: hero-default--google--imagen-4.0-generate-001.png
        → use_case=hero, settings=default, provider=google, model=imagen-4.0-generate-001
   f. Look up the use_case_label from the use case map (Section 7.1)
   g. Load the .png image and send to @image-reviewer
   h. Evaluate against all 8 categories using the rubrics in Section 5
   i. Calculate:
      — total_score = sum of all 8 category scores
      — max_possible = 800
      — percentage = total_score / 800 * 100 (one decimal place)
   j. Identify top 3 strengths and top 2 weaknesses (be specific)
   k. Write a recommendation paragraph (1-3 sentences)
   l. Save as {basename}.eval.yaml using the schema in Section 6
   m. Log: "Evaluated: {filename} — {percentage}% ({total_score}/800)"
4. After all images are evaluated, print summary:
   — Total images evaluated
   — Average score across all images
   — Highest and lowest scoring images
5. Run the report generator:
   bash tools/.tests/generate-e2e-report.sh
```

### 7.1 Use Case Label Map

| Use Case Key | Label | Tier |
|-------------|-------|------|
| `hero` | Hero Banner with Text | 1 |
| `product` | E-Commerce Product Photography | 1 |
| `blog` | Blog Editorial Illustration | 1 |
| `logo` | Business Logo Design | 1 |
| `food` | Restaurant Menu Item Photography | 1 |
| `team` | Professional Team Headshot Portrait | 1 |
| `social-post` | Social Media Post (Square) | 1 |
| `social-story` | Social Media Story (Vertical 9:16) | 1 |
| `icon-set` | Service Feature Icon | 1 |
| `background` | Abstract Section Background | 1 |
| `real-estate` | Interior Design / Real Estate Photo | 1 |
| `testimonial` | Customer Testimonial Card | 1 |
| `banner-promo` | Promotional Sale Banner | 2 |
| `infographic` | Data Visualization Section | 2 |
| `flat-illustration` | Flat UI Illustration (Feature Section) | 2 |
| `before-after` | Before/After Comparison | 2 |
| `email-header` | Email Newsletter Header | 2 |
| `map-style` | Illustrated Location Map | 2 |
| `texture-seamless` | Seamless Tileable Texture | 3 |
| `mockup-device` | Device Mockup | 3 |
| `certificate` | Certificate / Achievement Badge | 3 |
| `qr-style` | Branded QR Code Design | 3 |
| `avatar` | Illustrated Brand Mascot / Avatar | 3 |
| `packaging` | Product Packaging Render | 3 |

## 8. Tips for Consistent Evaluation

### Scoring discipline

- **Evaluate each image independently** — do not adjust scores based on how other models performed on the same prompt. Each evaluation stands on its own.
- **Be rigorous with the rubric** — a 90+ score means genuinely exceptional quality. Reserve it for images that are truly outstanding in that category.
- **Calibrate to realistic expectations** — most good AI-generated images score 65–85 in most categories. Scores above 85 should be reserved for notably strong performance; scores below 50 indicate significant problems.
- **Use the full range** — don't cluster all scores in the 70–80 band. Differentiate meaningfully between categories where the image excels versus where it falls short.

### Category-specific guidance

- **Text rendering** is the weakest capability of current AI image generation models. Expect lower scores here, especially for prompts requesting specific text strings. This is a known limitation, not a reason to grade on a curve — score what you see.
- **For icon/logo use cases**, prioritize crispness, simplicity, geometric precision, and scalability over photorealism.
- **For photography use cases** (product, food, team, real-estate), prioritize realism, natural lighting, material accuracy, and believable physics over text rendering.
- **For illustration use cases** (blog, flat-illustration, map-style), prioritize style consistency, color harmony, and compositional storytelling.
- **When the prompt specifies exact values** (hex colors, precise measurements, specific angles, named fonts), evaluate literally against those specifications.

### Web readiness considerations

- Consider the **intended web use case** when scoring web_readiness. A hero banner needs to support text overlay. A product photo needs clean backgrounds. An icon needs to be legible at 24px.
- Images that are strong in photography quality but have poor text rendering can still score well for web_readiness if the text would typically be overlaid via HTML/CSS.
- Consider whether the aspect ratio and composition leave room for responsive web layouts.

### Writing evaluation notes

- **Be specific and concrete** — reference visible elements, not vague impressions. Say "the left hand has six fingers" not "some quality issues present."
- **Mention what's present AND what's missing** — especially for prompt_adherence and detail_accuracy.
- **Keep notes concise** — 1–3 sentences per category is sufficient. Focus on the most impactful observations.
- **Use consistent terminology** — "artifact" for AI rendering glitches, "distortion" for geometric issues, "softness" for lack of sharpness, "banding" for gradient steps.
