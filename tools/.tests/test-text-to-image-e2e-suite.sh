#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/test-text-to-image-e2e-suite.sh
#
# test-text-to-image-e2e-suite.sh — E2E battle-test suite for text-to-image
#
# Runs the e2e-providers script multiple times with different prompts and settings
# to battle-test all configured models across realistic web development scenarios.
#
# WARNING: This script calls REAL PAID APIs. It is NOT meant for CI/CD.
# Each full run generates images across all configured providers/models.
# Estimated cost depends on configured providers (~$0.03 avg per generation).
#
# Dependencies: bash>=4, jq, timeout (GNU coreutils)
#
# Usage: bash tools/.tests/test-text-to-image-e2e-suite.sh [options]
#
# Environment variables:
#   SUITE_OUTPUT_DIR  Output directory (default: <repo>/tmp/e2e-suite)
#   TIMEOUT           Timeout per model in seconds (default: 180)
#   VERBOSE           Set to 'true' for debug output
#   FORCE_REFRESH     Set to 'true' to bypass cache and regenerate all images
#
# Exit codes:
#   0 - All runs completed (individual models may have failed)
#   1 - One or more runs failed
#   2 - Usage error

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="test-text-to-image-e2e-suite"
readonly LOG_TAG="(${APP_NAME})"

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly E2E_PROVIDERS_SCRIPT="${SCRIPT_DIR}/test-text-to-image-e2e-providers.sh"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd -P)"

SUITE_OUTPUT_DIR="${SUITE_OUTPUT_DIR:-${REPO_ROOT}/tmp/e2e-suite}"
TIMEOUT="${TIMEOUT:-180}"
VERBOSE="${VERBOSE:-false}"
FORCE_REFRESH="${FORCE_REFRESH:-false}"
DRY_RUN=false

# CLI filters
FILTER_USE_CASE=""
FILTER_SETTINGS=""
FILTER_TIER="1"

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_FAILURE=1
readonly EXIT_USAGE=2

# ============================================================================
# SETTINGS PROFILES
# ============================================================================

# Default: tool defaults (1024x1024, high quality)
readonly SETTINGS_DEFAULT_LABEL="default"
readonly SETTINGS_DEFAULT_WIDTH=""
readonly SETTINGS_DEFAULT_HEIGHT=""
readonly SETTINGS_DEFAULT_QUALITY=""

# Max: push to tool limits (2048x2048, high quality)
readonly SETTINGS_MAX_LABEL="max"
readonly SETTINGS_MAX_WIDTH="2048"
readonly SETTINGS_MAX_HEIGHT="2048"
readonly SETTINGS_MAX_QUALITY="high"

# ============================================================================
# USE CASE PROMPTS
# ============================================================================

readonly USE_CASE_NAMES=(
  # Tier 1 — Core web assets (12)
  "hero"
  "product"
  "blog"
  "logo"
  "food"
  "team"
  "social-post"
  "social-story"
  "icon-set"
  "background"
  "real-estate"
  "testimonial"
  # Tier 2 — Marketing & content (6)
  "banner-promo"
  "infographic"
  "flat-illustration"
  "before-after"
  "email-header"
  "map-style"
  # Tier 3 — Specialty & advanced (6)
  "texture-seamless"
  "mockup-device"
  "certificate"
  "qr-style"
  "avatar"
  "packaging"
)

readonly USE_CASE_LABELS=(
  # Tier 1
  "Hero Banner with Text"
  "E-Commerce Product Photography"
  "Blog Editorial Illustration"
  "Business Logo Design"
  "Restaurant Menu Item Photography"
  "Professional Team Headshot Portrait"
  "Social Media Post (Square)"
  "Social Media Story (Vertical 9:16)"
  "Service Feature Icon"
  "Abstract Section Background"
  "Interior Design / Real Estate Photo"
  "Customer Testimonial Card"
  # Tier 2
  "Promotional Sale Banner"
  "Data Visualization Section"
  "Flat UI Illustration (Feature Section)"
  "Before/After Comparison"
  "Email Newsletter Header"
  "Illustrated Location Map"
  # Tier 3
  "Seamless Tileable Texture"
  "Device Mockup"
  "Certificate / Achievement Badge"
  "Branded QR Code Design"
  "Illustrated Brand Mascot / Avatar"
  "Product Packaging Render"
)

readonly USE_CASE_TIERS=(
  # Tier 1 — Core web assets
  "1" "1" "1" "1" "1" "1" "1" "1" "1" "1" "1" "1"
  # Tier 2 — Marketing & content
  "2" "2" "2" "2" "2" "2"
  # Tier 3 — Specialty & advanced
  "3" "3" "3" "3" "3" "3"
)

# Each prompt is ~200-400 tokens, specific and detailed for web development use cases.
# shellcheck disable=SC2016
readonly USE_CASE_PROMPTS=(
  # hero — Hero Banner with Text on Image
  "Professional website hero banner for a premium coffee subscription service. The image must contain the text 'ROAST & RITUAL' rendered in large, elegant serif typography centered in the upper third, with the tagline 'Artisan Coffee, Delivered Fresh' in smaller sans-serif lettering directly below. The background features a moody, cinematic close-up of freshly roasted arabica coffee beans with visible oil sheen and rich brown tones. Soft steam rises from an artisan ceramic pour-over dripper positioned in the right third of the frame. Warm amber side-lighting creates dramatic shadows and highlights the texture of the beans. A handcrafted stoneware mug sits on a rustic reclaimed-wood surface in the lower left, catching a gentle rim-light. The overall color palette is warm: deep espresso browns, burnt amber, cream highlights, and subtle gold accents. The composition uses the rule of thirds with generous negative space around the text for readability. Professional color grading with lifted shadows and warm split-toning. Shallow depth of field at f/2.8 equivalent keeps text area sharp while background elements have pleasing bokeh. The style is premium commercial photography suitable for a Shopify or Squarespace hero section at 16:9 aspect ratio. No watermarks, no borders."

  # product — E-Commerce Product Photography
  "Professional e-commerce product photograph of premium wireless over-ear headphones in matte charcoal black finish with brushed aluminum accents. The headphones are displayed at a three-quarter angle on a polished white Carrara marble surface with subtle gray veining, showing both the textured protein-leather ear cushion and the precision-machined adjustment slider on the headband. Key light from upper-left at 45 degrees creates a soft gradient shadow falling to the lower right. A secondary fill light from the right softens shadow contrast to 3:1 ratio. The ear cup interior reveals a fine metallic mesh driver cover with laser-etched brand mark. A single small potted succulent with thick jade-green leaves sits three inches behind and to the left, providing a pop of organic color and depth scale. The marble surface shows a subtle, controlled reflection of the product underside. Background transitions smoothly from pure white at top to warm light-gray at the bottom edge. Every surface detail is tack-sharp at f/8 equivalent with focus stacking. No clipped highlights, no crushed shadows, full dynamic range. Color temperature is neutral daylight at 5600K. This image must meet the standard of a product hero shot on the Apple Store or Bang and Olufsen website. No text, no watermarks."

  # blog — Blog Editorial Illustration
  "Vibrant editorial illustration for a technology blog article about artificial intelligence transforming modern healthcare. The scene shows a bright, airy hospital room where a friendly humanoid robot assistant with soft glowing blue eyes and a rounded pearl-white chassis gently holds the hand of an elderly woman seated in a comfortable armchair. The woman has silver hair, warm brown eyes, reading glasses pushed up on her forehead, and a genuine grateful smile. She wears a soft lavender cardigan over a hospital gown. The robot's design is deliberately non-threatening: smooth curves, no sharp edges, subtle breathing-light indicator on its chest pulsing calm blue. Behind them a large window reveals a sunlit healing garden with climbing jasmine and a stone fountain. Floating translucent holographic displays show vital-sign waveforms in clean teal and white UI elements. Natural golden-hour sunlight streams through the window casting long warm shadows across the light oak floor. Color palette: soft sky blues, warm cream whites, healing sage greens, gentle lavender, and touches of warm gold from the sunlight. The mood is optimistic and deeply human, conveying trust between technology and patient. Semi-realistic editorial illustration style with clean confident linework, soft gradients, and subtle paper texture overlay. Composition places the human-robot handshake at the visual center with supporting elements framing the story. Suitable as a 16:9 blog header image. No text overlays."

  # logo — Business Logo Design
  "Professional minimalist logo design for 'VERDE BOTANICS', an upscale organic skincare brand. The design features the brand name 'VERDE BOTANICS' typeset in a refined geometric sans-serif typeface with generous letter-spacing, medium font weight, and perfectly horizontal baseline — rendered in deep forest green hex #1B4332 on a pure white background. Centered above the text is an abstract botanical mark composed of three overlapping semi-transparent ellipses arranged in a radial pattern at 120-degree intervals, forming a stylized three-petal flower or leaf rosette. The ellipses use a gradient progression: the left petal in sage green #8FBC8F, the upper-right in forest green #2D6A4F, and the lower-right in antique gold #BFA048, with the overlapping intersections creating rich darker blended tones. The symbol sits within an implied circular boundary following golden-ratio proportions relative to the text width. A thin horizontal line in #2D6A4F separates the symbol from the text, spanning exactly the width of the word 'BOTANICS'. The overall composition is vertically stacked and perfectly centered. Clean vector-quality rendering with crisp anti-aliased edges, no gradients on the text itself, no drop shadows, no decorative flourishes. The aesthetic balances organic botanical warmth with modern geometric precision, communicating luxury, sustainability, and scientific expertise. Must be visually coherent at sizes from a 32-pixel favicon to a 1200-pixel website header. No background pattern, no tagline, no additional elements."

  # food — Restaurant Menu Item Photography
  "Overhead flat-lay food photograph of a gourmet artisan burger on a dark charcoal slate serving board. The brioche bun has a glossy egg-wash sheen with scattered sesame seeds, sliced open to reveal distinct visible layers: a thick dry-aged beef patty with caramelized crust and pink medium-rare center, melted aged cheddar draping over the edges, crisp butter lettuce, thin-sliced heirloom tomato in deep red, house-made dill pickle chips, and a smear of roasted garlic aioli on the top bun. A small stainless-steel ramekin of truffle fries sits to the upper right, with a craft IPA in a tulip glass positioned in the upper left corner showing amber liquid and a thin white head. Wisps of steam rise naturally from the patty and fries. Warm tungsten side-lighting from the left at 30 degrees creates dramatic texture shadows across the slate surface, with a subtle fill bounce from the right to prevent crushed blacks. Shallow depth of field at f/2.8 keeps the burger layers tack-sharp while the beer glass and fries fall into gentle bokeh. Color palette: deep charcoal slate, warm golden brioche, rich beef browns, vibrant tomato reds, and amber beer tones. A small sprig of fresh thyme garnishes the board edge. The surface shows natural slate texture with hairline scratches. Professional food photography styled for a premium burger restaurant website menu page at 4:3 aspect ratio. No text, no watermarks, no borders."

  # team — Professional Team Headshot Portrait
  "Professional corporate headshot portrait of a confident woman in her early 40s, photographed from the chest up in a three-quarter turn with her body angled slightly left and face turned toward the camera. She has shoulder-length dark brown hair with subtle auburn highlights, styled in a polished professional blowout with a side part. Her expression is warm and approachable with a genuine closed-mouth smile that reaches her eyes, conveying competence and trustworthiness. She wears a tailored navy blue blazer with subtle herringbone texture over a cream silk blouse with a delicate neckline. Minimal jewelry: small gold stud earrings and a thin gold necklace. Background is a subtly blurred modern office environment showing floor-to-ceiling windows with warm natural afternoon light streaming from camera-right, creating a soft Rembrandt lighting pattern with a gentle nose shadow on the far cheek. Key light is the window at 45 degrees camera-right, with a white reflector panel camera-left providing 2:1 fill ratio. Shallow depth of field at f/2.0 equivalent renders the background as soft creamy bokeh with warm tones. Skin tones are natural and accurate: warm undertones, clean retouching that preserves skin texture without over-smoothing. Catch-lights visible in both eyes as rectangular window reflections. Color grading is warm and natural with slightly lifted shadows. Shot at 85mm equivalent focal length for flattering compression. Suitable for a LinkedIn profile or company 'About Us' leadership page. No text, no watermarks, no borders."

  # social-post — Social Media Post (Square)
  "Square-format social media post design for a boutique yoga studio announcing summer classes. The background is a serene sunrise scene shot from a sandy tropical beach looking out over a calm turquoise ocean with gentle waves lapping at the shore. A single silhouetted human figure stands in tree pose (Vrksasana) — one foot planted, the other pressed against the inner thigh, arms extended overhead with palms together — positioned in the right third of the frame against the warm gradient sky that transitions from deep coral at the horizon through soft peach to pale gold above. Overlaid text in the upper-left quadrant reads 'FIND YOUR FLOW' in bold modern geometric sans-serif typography (similar to Montserrat or Futura Bold) rendered in clean white with a subtle 2px drop shadow for legibility against the sky. Below the headline, smaller text reads 'Summer sessions begin June 1' in lightweight sans-serif, also in white. The overall color palette uses the brand colors: coral (#FF6B6B), teal (#2EC4B6), and warm cream (#FFF8F0). A thin teal horizontal rule separates the headline from the subtext. The bottom edge has a subtle cream-colored gradient overlay to create a landing area for profile information. Minimal aesthetic with ample breathing room around all text elements. The composition is balanced, with the silhouette and text forming a visual diagonal. Designed for Instagram feed at 1080x1080 pixels. No watermarks, no borders, no cluttered elements."

  # social-story — Social Media Story (Vertical 9:16)
  "Vertical 9:16 aspect ratio social media story design for a boutique flower shop called 'Petal & Stem'. The top 15 percent of the frame contains the shop name 'PETAL & STEM' in elegant thin-weight serif typography (similar to Playfair Display Light) rendered in dusty rose (#D4A0A0) with generous letter-spacing, centered horizontally against a soft cream (#FFF8F0) background that fades into the main image below. The central 60 percent features a lush, abundant floral arrangement in a handmade speckled ceramic vase with a matte cream glaze — the arrangement includes fully open blush garden roses, pale pink peonies in various stages of bloom, dusty miller foliage, trailing eucalyptus branches with silver-green leaves, and small sprigs of dried lavender. Soft diffused morning window light enters from the upper left, creating gentle shadows and luminous petal translucency. Shallow depth of field at f/1.8 renders the background as a warm creamy bokeh with hints of a whitewashed brick wall. The color palette is soft and cohesive: blush pinks, dusty rose, sage green, cream, and warm whites. The bottom 15 percent of the frame shows a cream gradient overlay with subtle upward-pointing chevron icon centered as a swipe-up indicator, with tiny text 'Shop the arrangement' in dusty rose below it. Professional floral photography styling with intentional asymmetry in the arrangement. Designed for Instagram Stories at 1080x1920 pixels. No watermarks, no borders."

  # icon-set — Service Feature Icon
  "Single flat-design service feature icon for a cloud hosting company representing cloud upload functionality. The icon is a clean geometric cloud shape constructed from two overlapping circles (larger on the right) with a flat bottom edge, centered in the composition. Inside the cloud, a bold upward-pointing arrow with a straight shaft and open chevron head indicates the upload action. The entire icon uses a single color: electric blue (#2563EB) on a pure white (#FFFFFF) background. The design follows strict geometric construction: all curves are perfect arcs, the arrow shaft is exactly centered within the cloud, and all elements align to an invisible 64x64 pixel grid. Line weight is a consistent 2px stroke throughout, with rounded line caps and joins for a friendly feel. The cloud outline and arrow are rendered as outlines only — no fills, no gradients, no shadows, no 3D effects, no textures. The style is modern line-icon consistent with Phosphor Icons, Lucide, or Heroicons design systems. The icon must be visually crisp and legible at 64x64 pixel display size while maintaining clarity at 24x24 minimum. Optical balance is adjusted so the cloud and arrow feel centered even though the cloud shape is asymmetric. The negative space between the arrow and cloud edges is even on all sides. No text, no labels, no background shapes, no decorative elements. Pixel-perfect rendering with clean anti-aliased edges."

  # background — Abstract Section Background
  "Abstract decorative background image for a SaaS pricing page section. The design features a smooth flowing gradient that transitions from deep navy blue (#1E3A5F) anchored in the bottom-left corner through a rich teal midtone (#2A7B9B) in the center to warm coral (#FF8A65) radiating from the top-right corner. The gradient flows along organic, gently undulating curves rather than a linear interpolation, creating a sense of depth and movement. Three to four translucent organic blob shapes in slightly lighter and darker tones of the gradient colors float at different depths, creating a subtle parallax layering effect. The shapes have soft, rounded amoeba-like edges with gentle gaussian blur at their boundaries. A fine film-grain texture overlay at 8-12% opacity adds tactile warmth and prevents color banding in the gradient transitions. The center of the image is deliberately kept as clean negative space — a large unobstructed area approximately 60% of the canvas — suitable for overlaying white text, pricing cards, and call-to-action buttons. No objects, no icons, no text, no patterns, no geometric shapes, no hard edges anywhere in the composition. The overall effect is modern, professional, and calming, similar to the abstract backgrounds used by Linear, Vercel, or Stripe on their marketing pages. The image should tile gracefully if used at full viewport width. Rendered at 16:9 aspect ratio for a full-width website section. No watermarks, no borders."

  # real-estate — Interior Design / Real Estate Photo
  "Bright and airy interior photograph of a modern Scandinavian-style living room suitable for an Airbnb listing hero image or interior design portfolio. The room is spacious with 10-foot ceilings and floor-to-ceiling windows spanning the full back wall, dressed with sheer linen curtains in warm off-white that diffuse warm afternoon sunlight into soft volumetric rays. The flooring is wide-plank natural white oak with a matte finish showing subtle grain variation. A large low-profile cream linen sofa with down-filled cushions anchors the center-right, adorned with four textured throw pillows in muted sage green, warm terracotta, cream boucle, and a geometric mudcloth pattern in charcoal. A chunky hand-knit cream wool throw is casually draped over one arm. In front of the sofa, a round black walnut coffee table with tapered legs holds a small stack of design books and a ceramic vase with dried pampas grass. A large fiddle-leaf fig tree in a tall fluted ceramic planter in warm taupe stands to the left of the windows, its leaves catching the light and casting delicate shadows. The left wall features a curated gallery of three framed botanical prints in thin black frames. A woven jute area rug in natural tones defines the seating area on the oak floor. The camera is positioned at 5-foot height in the room corner, using a 24mm equivalent wide-angle lens to capture the full room depth while maintaining natural perspective without barrel distortion. Warm afternoon light creates long diagonal shadows across the floor. Color palette: warm whites, natural oak, sage green, terracotta, and muted earth tones. The atmosphere is calm, lived-in, and aspirational. No text, no watermarks, no borders."

  # testimonial — Customer Testimonial Card
  "Visual design for a customer testimonial section card on a SaaS landing page. The card has a clean white (#FFFFFF) background with a subtle 1px border in light gray (#E5E7EB) and a soft box-shadow (0 4px 12px rgba(0,0,0,0.08)) giving it a gentle floating effect. In the top-left corner, a small circular portrait (56x56 pixels) shows a smiling middle-aged man with short salt-and-pepper hair, friendly brown eyes, light crow's feet suggesting genuine warmth, wearing a casual navy polo shirt. The portrait has a thin 2px border in the brand accent color. To the right of the portrait, the name 'David Chen' appears in semi-bold dark gray (#1F2937) sans-serif, with 'VP Engineering, Acme Corp' in regular weight medium gray (#6B7280) below. Centered in the card body, a large pull-quote in elegant serif typography (similar to Georgia or Lora) reads: 'This platform reduced our deployment time from hours to minutes. The team adopted it in a single sprint.' — rendered in dark charcoal (#374151) with generous line-height of 1.6. Above the quote, a row of five small gold (#F59E0B) star icons indicates a 5-star rating. At the bottom of the card, a thin horizontal accent bar in navy blue (#1E3A5F) spans the full card width, 3px tall. The overall card dimensions suggest approximately 480px wide by 280px tall. Typography is clean and hierarchical. Generous padding of 32px on all sides. The design is minimalist and professional, suitable for a social proof section on a B2B SaaS landing page. No decorative flourishes, no background patterns. No watermarks, no borders outside the card."

  # banner-promo — Promotional Sale Banner
  "Bold promotional banner design for a Black Friday electronics sale at a premium retailer. The background is a rich matte black (#0A0A0A) with dramatic volumetric red light rays emanating from behind the center product arrangement, creating a theatrical atmosphere. The headline 'BLACK FRIDAY' is rendered in ultra-bold condensed sans-serif typography (similar to Impact or Anton) in pure white (#FFFFFF) spanning the full width of the upper quarter, with each letter casting a subtle red (#DC2626) edge glow. Directly below, 'UP TO 70% OFF' appears in a slightly smaller bold weight with the '70%' numerals highlighted in bright gold (#F59E0B) for emphasis. The center of the composition features three premium electronics products artfully arranged on a reflective black glass surface: a pair of matte black wireless noise-canceling headphones displayed at a dynamic angle on the left, a sleek silver ultrabook laptop open at 120 degrees in the center-back, and a modern smartwatch with a dark face showing a minimal watchface on the right. Each product catches dramatic red and gold accent lighting on their edges, creating separation from the dark background. Subtle gold metallic particle effects float in the background space between the products. A bold red call-to-action pill button at the bottom reads 'SHOP NOW' in white bold text. The overall design conveys urgency, luxury, and premium value. Suitable for a homepage hero banner or email campaign header at 16:9 aspect ratio. No watermarks, no borders."

  # infographic — Data Visualization Section
  "Clean infographic section design for a corporate sustainability annual report, titled '4 Steps to Carbon Neutral' in a confident medium-weight sans-serif typeface (similar to Inter or DM Sans) in dark charcoal (#1F2937) at the top center. Below the title, four numbered steps are arranged in a horizontal row connected by a thin dashed line in medium gray (#9CA3AF) that flows between them like a timeline. Each step features a circular icon (72px diameter) with a colored background: Step 1 'Measure' has a forest green (#166534) circle with a white clipboard-and-chart icon inside; Step 2 'Reduce' has a sky blue (#0284C7) circle with a white downward-trending arrow icon; Step 3 'Offset' has a warm gold (#B45309) circle with a white tree-planting icon; Step 4 'Report' has a teal (#0F766E) circle with a white document-with-checkmark icon. Below each icon, the step number appears in bold matching color, followed by the step name in semi-bold dark gray, then a two-line description in regular medium gray (#6B7280) with 14px equivalent size. The background is clean white with a very subtle grid pattern at 5% opacity for structure. The horizontal connecting line has small filled circles at each node point matching the step color. The overall style is modern corporate infographic: clear visual hierarchy, consistent spacing (32px between elements), limited palette of four accent colors plus neutrals, and professional sans-serif typography throughout. The composition is horizontally balanced and centered, suitable for embedding in a full-width website section at approximately 1200x500 pixel proportions. No decorative flourishes, no stock photography, no watermarks, no borders."

  # flat-illustration — Flat UI Illustration (Feature Section)
  "Modern flat-style vector illustration for a project management SaaS feature section titled 'Team Collaboration.' The scene shows three stylized human figures with simple geometric proportions (oval heads, rectangular torsos, no facial features except minimal dot-eyes) gathered around a large shared digital whiteboard that dominates the center of the composition. The whiteboard is depicted as a rounded rectangle with a white surface and thin gray border, populated with colored sticky notes in coral (#FF6B6B), sky blue (#38BDF8), and warm yellow (#FBBF24) arranged in three columns suggesting a kanban board. Thin connecting lines in light gray link some sticky notes, indicating task dependencies. The leftmost figure (in a coral shirt) reaches up to move a sticky note, the center figure (in a blue shirt) points at the board with one arm while holding a tablet in the other, and the right figure (in a gray shirt) sits cross-legged on the floor with a laptop, looking up at the board. All figures are rendered in a consistent flat style: solid color fills, no gradients, no shadows, no outlines around shapes except where needed for separation. The color palette is strictly limited: coral (#FF6B6B), sky blue (#38BDF8), medium gray (#6B7280), white (#FFFFFF), and a warm off-white (#F9FAFB) background. Subtle geometric decorative elements float in the background: a small circle, a triangle, and a plus sign in 10% opacity gray. The illustration style is consistent with Notion, Linear, or Figma marketing illustrations: clean, minimal, human but abstract. No text labels, no 3D effects, no textures, no watermarks."

  # before-after — Before/After Comparison
  "Side-by-side before-and-after comparison image for a home renovation portfolio website, showing a kitchen transformation. The image is divided exactly in half by a clean 3px vertical line in white running from top to bottom, with a small circular handle icon at the midpoint suggesting an interactive slider. The LEFT half is labeled 'BEFORE' in small white uppercase sans-serif text against a dark overlay at the top-left corner: it shows a dated 1970s kitchen with dark stained oak cabinets with ornate raised-panel doors and tarnished brass knob hardware, yellowed laminate countertops with a rolled front edge, dark brown ceramic tile backsplash in a 4x4 grid pattern, a single fluorescent tube light fixture with a cracked plastic diffuser casting flat harsh light, harvest gold refrigerator, and worn avocado-green linoleum flooring with visible seam lines. The overall lighting is dim, flat, and institutional. The RIGHT half is labeled 'AFTER' in small white uppercase text at the top-right corner: the same kitchen from the exact same camera angle and position is transformed with bright white Shaker-style cabinets with brushed nickel cup-pull hardware, polished Calacatta marble countertops with dramatic gray veining, a white subway tile backsplash in a running bond pattern with dark gray grout lines, three modern matte-black pendant lights hanging over a new center island, stainless steel appliances, and light natural oak hardwood flooring in a wide-plank herringbone pattern. Warm afternoon light streams through a newly enlarged window, casting soft shadows. Both halves share identical camera perspective: straight-on at counter height, 28mm equivalent focal length. No text other than the labels, no watermarks, no borders."

  # email-header — Email Newsletter Header
  "Email newsletter header image designed for a 600-pixel-wide email layout with approximately 200-pixel height proportions (3:1 aspect ratio), for an independent bookstore's monthly newsletter. The scene is a warm, inviting overhead-angle still life: a carefully arranged stack of four hardcover books with visible cloth-bound spines in rich jewel tones (burgundy, forest green, navy, and mustard), with a pair of round tortoiseshell reading glasses resting on top of the stack at a casual angle. To the right of the books, a ceramic mug with a matte terracotta glaze holds steaming black coffee with a thin crema — wisps of steam are faintly visible. Three or four autumn maple leaves in deep orange and warm gold are scattered naturally across the surface around the books and mug. The surface is a weathered natural wood table with visible warm honey-toned grain. Soft warm directional light from the upper left creates gentle shadows to the right of each object. The text 'NOVEMBER READS' is rendered across the upper portion of the image in a warm bookish serif typeface (similar to Libre Baskerville or Crimson Text) in cream white (#FFF8E7) with a subtle warm drop shadow for readability against the background. Below the title, a thin cream horizontal rule. The overall color palette is autumnal and cozy: warm amber, deep burgundy, forest green, terracotta, honey wood, and cream accents. The mood evokes a comfortable reading nook on a crisp autumn afternoon. Simple, bold composition optimized for email rendering at small sizes with instant visual recognition. No watermarks, no borders, no small details that would be lost at email scale."

  # map-style — Illustrated Location Map
  "Whimsical illustrated map of a charming coastal town neighborhood, rendered in a warm hand-drawn editorial illustration style suitable for a local business directory website or tourist brochure. The map shows a four-block area with named streets ('Harbor Lane' and 'Magnolia Street' visible as hand-lettered labels in a friendly rounded sans-serif) intersecting at the center. Four landmark businesses are depicted as delightful miniature cartoon buildings with exaggerated proportions and personality: a farmers market with a striped awning in red and cream, wooden crates of colorful produce visible out front, and a small chalkboard sign; a cozy café with a sage-green painted facade, a scalloped awning, tiny café tables with parasols on the sidewalk, and steam curling from the chimney; a bookshop with a deep blue storefront, a bay window filled with tiny book spines, and a cat sleeping on the windowsill; and a bakery with a warm pink facade, a display window showing tiered cakes, and a bread-shaped hanging sign. The surrounding area is filled in with simple tree canopies in sage and olive green, parked cars as tiny rounded rectangles, and a glimpse of blue harbor water along the bottom edge with two small sailboats. A decorative compass rose with a fleur-de-lis north indicator sits in the upper-right corner. The color palette uses muted earth tones as the base (warm beige for streets, soft sage for parks) with deliberate pops of red, teal (#2EC4B6), and deep blue for the landmarks. Fine ink-like outlines define all shapes with slight irregularity suggesting hand-drawing. The style is warm, friendly, and narratively rich — reminiscent of They Draw and Travel or Rifle Paper Co. illustration. No photorealism, no watermarks, no borders."

  # texture-seamless — Seamless Tileable Texture
  "Seamless tileable texture photograph of a weathered whitewashed brick wall, captured straight-on with the camera sensor plane perfectly parallel to the wall surface to eliminate all perspective distortion. The bricks are standard rectangular format laid in a classic running bond pattern, each brick approximately 8 inches wide by 2.5 inches tall in real-world scale. The whitewash is intentionally uneven and aged: some bricks show 90% opaque white coverage while others reveal 30-40% of the underlying warm terracotta clay color (#C1754C) showing through, creating organic variation. The mortar joints are slightly recessed (3-4mm depth) in a warm light gray (#B8B0A8) with hairline cracks running through some joints. Subtle imperfections add authenticity: small patches where whitewash has flaked away revealing clean brick underneath, a few hairline cracks crossing individual bricks, minor surface pitting, and very slight tonal variation between bricks suggesting they came from different batches. The lighting is perfectly flat and even — frontal diffused illumination that eliminates all directional shadows, ensuring the texture tiles without visible lighting seams. The overall color palette is restrained: warm whites, cream, light gray mortar, and occasional terracotta peekthrough. The image must tile seamlessly in both horizontal and vertical directions when repeated — brick courses align perfectly at top-bottom edges, and the running bond offset pattern continues naturally at left-right edges. No objects, no text, no directional shadows, no vignetting, no color cast. Suitable for use as a CSS background-image with background-repeat. No watermarks, no borders."

  # mockup-device — Device Mockup
  "Clean isometric device mockup showing a modern smartphone and laptop arranged on a minimal white desk surface, designed for an app landing page 'Available on all devices' section. The laptop is a modern thin-bezel ultrabook (similar to MacBook Air proportions) rendered at a 30-degree isometric angle with the screen open at 110 degrees, positioned in the back-left of the composition. The smartphone stands upright in a slight 15-degree tilt in the front-right, overlapping the laptop's base slightly to create depth. Both device frames are rendered in space gray aluminum with precise, accurate proportions: correct screen aspect ratios (16:10 laptop, 19.5:9 phone), realistic bezel widths, and properly rounded corners matching real device radii. Both screens display a generic SaaS dashboard interface: a left sidebar with colored navigation dots, a top bar with a search field and avatar circle, a main content area with two chart widgets (a line graph and a donut chart in blue and teal tones) and three metric cards below — all elements are suggestive shapes with no readable text to maintain genericness. The screen UI uses a clean color palette of white background, light gray (#F3F4F6) cards, blue (#3B82F6) and teal (#14B8A6) accent colors. The white desk surface is pristine with a subtle warm shadow underneath each device (soft, diffused, 15% opacity) grounding them. Background is pure white (#FFFFFF) fading softly. The rendering style is clean and precise with accurate material properties: matte aluminum, glossy screen surface with a faint reflection gradient. No other objects on the desk. No text, no watermarks, no borders."

  # certificate — Certificate / Achievement Badge
  "Elegant digital course completion certificate design for an online learning platform. The certificate has a classic landscape orientation (approximately 11x8.5 proportions) with an ivory (#FFFFF0) textured background that subtly suggests high-quality laid paper with a very fine crosshatch linen texture at 5% opacity. The border is an ornamental frame in rich gold (#B8860B) featuring geometric Art Deco patterns: repeating stepped chevrons along the sides with elegant corner ornaments composed of radiating gold lines and small diamond shapes, all rendered with precise symmetry and consistent 2px line weight. The header reads 'CERTIFICATE OF COMPLETION' in all-caps engraved-style serif typography (similar to Trajan Pro or Cinzel) in dark navy (#1E3A5F), centered, with generous letter-spacing of 0.2em. Below the header, a thin gold horizontal rule with small diamond endpoints spans 60% of the certificate width. The central area contains three lines of placeholder text: 'This certifies that' in small italic serif (navy, 12pt equivalent), a large blank line indicated by a thin gold underscore for the recipient name, and 'has successfully completed' followed by another gold underscore for the course name. Below the content area, a date line formatted as 'Issued: __________ 2024' in small navy serif. In the bottom-right corner, a detailed gold seal rosette approximately 80px in diameter with concentric circles, radiating ribbons, and a central star, suggesting an official embossed seal. In the bottom-left, placeholder lines for instructor signature with a thin horizontal rule and 'Instructor' label below. The overall design conveys authority, elegance, and academic prestige. Color scheme is strictly: ivory, gold, and dark navy. Professional and trustworthy. No photographs, no watermarks, no casual elements."

  # qr-style — Branded QR Code Design
  "Stylized branded QR code design for a farm-to-table restaurant's contactless menu system. The design features a standard QR code matrix pattern approximately 200x200 modules rendered in a brand teal color (#0D9488) on a clean white (#FFFFFF) background. The QR code modules (the small squares that make up the pattern) have subtly rounded corners with a 2px radius, giving the entire code a friendlier, more approachable feel compared to standard sharp-cornered modules. The three finder patterns (large squares in the corners) maintain their standard proportions but also use the rounded corner treatment and the brand teal color. In the exact center of the QR code matrix, a 7x7 module area is replaced with a custom brand icon: a minimal line-art fork crossed with a knife in the brand teal, contained within a small white circle with a 1px teal border, creating a visual brand identifier without disrupting the QR code's error correction capability. The overall QR code is framed by a clean square border with 16px padding on all sides in white, then a thin 1px rounded-rectangle border in light gray (#E5E7EB). Below the QR code, centered, small text reads 'SCAN FOR MENU' in the brand teal color using a clean sans-serif typeface (similar to Inter or SF Pro) at 11px equivalent size with 0.1em letter-spacing. The entire design must look like a real, functional, scannable QR code — maintaining proper quiet zones, finder pattern proportions, and module density. The style is minimal, modern, and brand-consistent. No decorative flourishes, no background patterns, no watermarks."

  # avatar — Illustrated Brand Mascot / Avatar
  "Friendly cartoon mascot character illustration for a cybersecurity startup, depicting a small owl as the brand's guardian figure. The owl has a compact, chibi-inspired body proportion (large head approximately 60% of total height, small rounded body) and is rendered in modern flat illustration style with solid color fills and no outlines. The owl's body is midnight blue (#1E293B) with a lighter chest patch in soft blue-gray (#94A3B8). Its large, expressive round eyes are electric cyan (#06B6D4) with white highlight catchlights, conveying alertness and intelligence. It wears a tiny classic detective hat (deerstalker style) in warm brown (#92400E) perched at a jaunty angle on its head, with the hat rendered in the same flat style. In one wing-hand, it holds a small magnifying glass with a gold (#F59E0B) rim and transparent lens showing a subtle gleam. The owl is perched confidently atop a heraldic shield icon rendered in a slightly darker midnight blue (#0F172A) with a simple keyhole cutout in electric cyan, symbolizing security. Two small pointed ear tufts on the owl's head add personality. The background is transparent (suitable for compositing on any surface). The entire character fits within a compact circular composition suitable for display at 200x200 pixels as an avatar, app icon, or social media profile picture. The style is consistent with modern tech brand mascots like GitHub's Octocat or Hootsuite's Owly: professional but approachable, simple enough to be recognizable at small sizes, distinctive in silhouette. Color palette strictly limited to: midnight blue, electric cyan, warm brown, gold accent, and blue-gray. No gradients, no textures, no realistic rendering, no watermarks."

  # packaging — Product Packaging Render
  "Photorealistic 3D product packaging render of a premium organic tea brand called 'Moonleaf' for an e-commerce product detail page. The packaging is a rigid matte-finish box approximately 4x6x2 inches in proportions, rendered in a deep matte black (#1A1A1A) cardboard stock that shows subtle paper fiber texture under close inspection. The front panel features an elegant gold foil logo: the brand name 'MOONLEAF' in a refined thin-weight serif typeface (similar to Cormorant Garamond Light) with generous letter-spacing, rendered in realistic metallic gold foil that catches the studio lighting with subtle reflective highlights and micro-texture consistent with actual hot-stamped foil. Below the brand name, a delicate botanical line illustration in the same gold foil depicts a single tea plant branch with three leaves and a small flower bud, drawn in a fine 0.5pt line weight with confident, minimal strokes. The side panel visible at the 30-degree viewing angle shows 'JASMINE PEARL' in smaller gold foil text and a subtle tonal pattern of repeating leaf motifs embossed into the black cardstock (visible only through shadow play, not color). The box is shown at a 30-degree angle revealing both the front face (approximately 70% visible) and the right side panel (30% visible), creating a dynamic three-quarter product view. Soft studio lighting consists of a large overhead softbox creating a clean gradient across the box top, with a subtle rim light from the back-right edge highlighting the box silhouette. The box rests on a clean white (#FFFFFF) surface with a soft, diffused shadow underneath (no hard edges). Material rendering is photorealistic: the matte paper absorbs light with a slight velvety texture, while the gold foil elements catch and reflect light sharply. No additional props, no background elements. No watermarks, no borders."
)

# ============================================================================
# RESULT TRACKING
# ============================================================================
declare -a RUN_USE_CASE=()
declare -a RUN_SETTINGS=()
declare -a RUN_EXIT_CODE=()

# ============================================================================
# TRAPS
# ============================================================================
_on_err() {
  local -r line="$1" cmd="$2" code="$3"
  log_err "line ${line}: '${cmd}' exited with ${code}"
}

_on_exit() {
  :
}

_on_interrupt() {
  log_warn "Interrupted — printing partial results"
  print_combined_summary
  exit 130
}

trap '_on_err $LINENO "$BASH_COMMAND" $?' ERR
trap '_on_exit' EXIT
trap '_on_interrupt' INT TERM

# ============================================================================
# UTILITIES
# ============================================================================
log_info()  { printf '[INFO]  %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_warn()  { printf '[WARN]  %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_err()   { printf '[ERROR] %s %s\n' "${LOG_TAG}" "$*" >&2; }
log_debug() { [[ "${VERBOSE}" == "true" ]] && printf '[DEBUG] %s %s\n' "${LOG_TAG}" "$*" >&2 || true; }

die() { log_err "$@"; exit "${EXIT_USAGE}"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

# ============================================================================
# DOMAIN FUNCTIONS
# ============================================================================

# Get settings values for a given profile label
get_settings_width() {
  local -r profile="$1"
  case "${profile}" in
    default) printf '%s' "${SETTINGS_DEFAULT_WIDTH}" ;;
    max)     printf '%s' "${SETTINGS_MAX_WIDTH}" ;;
    *)       die "Unknown settings profile: ${profile}" ;;
  esac
}

get_settings_height() {
  local -r profile="$1"
  case "${profile}" in
    default) printf '%s' "${SETTINGS_DEFAULT_HEIGHT}" ;;
    max)     printf '%s' "${SETTINGS_MAX_HEIGHT}" ;;
    *)       die "Unknown settings profile: ${profile}" ;;
  esac
}

get_settings_quality() {
  local -r profile="$1"
  case "${profile}" in
    default) printf '%s' "${SETTINGS_DEFAULT_QUALITY}" ;;
    max)     printf '%s' "${SETTINGS_MAX_QUALITY}" ;;
    *)       die "Unknown settings profile: ${profile}" ;;
  esac
}

# Run a single combination: use_case × settings_profile
run_combination() {
  local -r use_case="$1"
  local -r use_case_index="$2"
  local -r settings_profile="$3"

  local -r prompt="${USE_CASE_PROMPTS[${use_case_index}]}"
  local -r output_prefix="${use_case}-${settings_profile}"

  local -r width="$(get_settings_width "${settings_profile}")"
  local -r height="$(get_settings_height "${settings_profile}")"
  local -r quality="$(get_settings_quality "${settings_profile}")"

  local prompt_display="${prompt}"
  if [[ "${#prompt_display}" -gt 80 ]]; then
    prompt_display="${prompt_display:0:80}..."
  fi

  local settings_display="defaults"
  if [[ -n "${width}" || -n "${quality}" ]]; then
    settings_display="${width:-1024}x${height:-1024}"
    [[ -n "${quality}" ]] && settings_display+=", quality=${quality}"
  fi

  printf '\n' >&2
  log_info "================================================================"
  log_info "Use case: ${use_case} (${USE_CASE_LABELS[${use_case_index}]})"
  log_info "Settings: ${settings_profile} (${settings_display})"
  log_info "Prefix: ${output_prefix}"
  log_info "Prompt: ${prompt_display}"
  log_info "================================================================"

  if [[ "${DRY_RUN}" == "true" ]]; then
    local force_display=""
    [[ "${FORCE_REFRESH}" == "true" ]] && force_display=" FORCE=true"
    log_info "[DRY-RUN] Would execute: PROMPT=<${use_case}> OUTPUT_PREFIX=${output_prefix} WIDTH=${width} HEIGHT=${height} QUALITY=${quality}${force_display} bash ${E2E_PROVIDERS_SCRIPT}"
    RUN_USE_CASE+=("${use_case}")
    RUN_SETTINGS+=("${settings_profile}")
    RUN_EXIT_CODE+=("0")
    return 0
  fi

  local exit_code=0
  local force_env="false"
  [[ "${FORCE_REFRESH}" == "true" ]] && force_env="true"
  PROMPT="${prompt}" \
  OUTPUT_PREFIX="${output_prefix}" \
  OUTPUT_DIR="${SUITE_OUTPUT_DIR}" \
  WIDTH="${width}" \
  HEIGHT="${height}" \
  QUALITY="${quality}" \
  TIMEOUT="${TIMEOUT}" \
  VERBOSE="${VERBOSE}" \
  FORCE="${force_env}" \
    bash "${E2E_PROVIDERS_SCRIPT}" || exit_code=$?

  RUN_USE_CASE+=("${use_case}")
  RUN_SETTINGS+=("${settings_profile}")
  RUN_EXIT_CODE+=("${exit_code}")

  if [[ "${exit_code}" -ne 0 ]]; then
    log_warn "Run ${use_case}/${settings_profile} exited with ${exit_code} (some models may have failed)"
  else
    log_info "Run ${use_case}/${settings_profile} completed successfully"
  fi

  return 0
}

# Look up the tier for a given use case name
_get_tier_for_use_case() {
  local -r target="$1"
  local j
  for (( j=0; j<${#USE_CASE_NAMES[@]}; j++ )); do
    if [[ "${USE_CASE_NAMES[${j}]}" == "${target}" ]]; then
      printf '%s' "${USE_CASE_TIERS[${j}]}"
      return
    fi
  done
  printf '?'
}

# Print the combined summary across all runs
print_combined_summary() {
  local -r total_runs="${#RUN_USE_CASE[@]}"

  if [[ "${total_runs}" -eq 0 ]]; then
    log_info "No runs completed."
    return
  fi

  local total_pass=0
  local total_fail=0

  printf '\n'
  printf '================================================================\n'
  printf 'E2E Battle Test Suite — Combined Summary\n'
  printf '================================================================\n'
  printf '  %-4s | %-18s | %-10s | %s\n' "Tier" "Use Case" "Settings" "Result"
  printf '  %s\n' "$(printf '%0.s-' {1..58})"

  local i
  for (( i=0; i<total_runs; i++ )); do
    local use_case="${RUN_USE_CASE[${i}]}"
    local settings="${RUN_SETTINGS[${i}]}"
    local exit_code="${RUN_EXIT_CODE[${i}]}"
    local tier
    tier="$(_get_tier_for_use_case "${use_case}")"
    local result_icon

    if [[ "${exit_code}" -eq 0 ]]; then
      result_icon="PASS"
      total_pass=$(( total_pass + 1 ))
    else
      result_icon="FAIL (exit ${exit_code})"
      total_fail=$(( total_fail + 1 ))
    fi

    printf '  T%-3s | %-18s | %-10s | %s\n' "${tier}" "${use_case}" "${settings}" "${result_icon}"
  done

  printf '  %s\n' "$(printf '%0.s-' {1..58})"
  printf 'Total runs: %d | Pass: %d | Fail: %d\n' "${total_runs}" "${total_pass}" "${total_fail}"

  if [[ "${DRY_RUN}" != "true" ]]; then
    printf 'Output: %s\n' "${SUITE_OUTPUT_DIR}"
  fi
  printf '================================================================\n'
}

# List all use cases with their prompts
list_cases() {
  printf 'Available use cases (%d total):\n\n' "${#USE_CASE_NAMES[@]}"
  local current_tier=""
  local i
  for (( i=0; i<${#USE_CASE_NAMES[@]}; i++ )); do
    local tier="${USE_CASE_TIERS[${i}]}"
    if [[ "${tier}" != "${current_tier}" ]]; then
      current_tier="${tier}"
      case "${tier}" in
        1) printf '  --- Tier 1: Core web assets ---\n\n' ;;
        2) printf '  --- Tier 2: Marketing & content ---\n\n' ;;
        3) printf '  --- Tier 3: Specialty & advanced ---\n\n' ;;
      esac
    fi
    printf '  [T%s] %s — %s\n' "${tier}" "${USE_CASE_NAMES[${i}]}" "${USE_CASE_LABELS[${i}]}"
    printf '  Prompt:\n'
    # Word-wrap prompt at ~100 chars for readability
    printf '    %s\n\n' "${USE_CASE_PROMPTS[${i}]}"
  done

  printf 'Settings profiles:\n'
  printf '  default — tool defaults (1024x1024, default quality)\n'
  printf '  max     — maximum settings (2048x2048, high quality)\n'
  printf '\nTiers:\n'
  printf '  1 — Core web assets (default)\n'
  printf '  2 — Marketing & content\n'
  printf '  3 — Specialty & advanced\n'
}

# ============================================================================
# CLI
# ============================================================================
usage() {
  cat >&2 <<EOF
Usage: ${APP_NAME} [options]

E2E battle-test suite for text-to-image. Runs the e2e-providers script
multiple times with different prompts and settings to test all configured
models across realistic web development scenarios.

WARNING: This calls REAL PAID APIs. Not for CI/CD use.

Use cases: 24 total, organized into 3 tiers:
  Tier 1 — Core web assets (12): hero, product, blog, logo, food, team,
           social-post, social-story, icon-set, background, real-estate,
           testimonial
  Tier 2 — Marketing & content (6): banner-promo, infographic,
           flat-illustration, before-after, email-header, map-style
  Tier 3 — Specialty & advanced (6): texture-seamless, mockup-device,
           certificate, qr-style, avatar, packaging

Settings:  default (1024x1024, tool defaults), max (2048x2048, high quality)

Matrix: Tier 1 default = 12 use cases × 2 settings = 24 runs.
        All tiers = 24 use cases × 2 settings = 48 runs.

Idempotent: The e2e-providers script skips existing files, so re-running
fills gaps without regenerating. Safe to re-run after partial failures.

Options:
  -h, --help           Show this help message
  -v, --verbose        Enable debug output
  --tier TIER          Run only this tier (1|2|3|all, default: 1)
  --use-case NAME      Run only this use case (overrides --tier)
  --settings PROFILE   Run only this settings profile (default|max)
  --force-refresh      Bypass cache and regenerate all images with fresh API calls
  --list-cases         Show all use cases and their prompts
  --dry-run            Show what would be run without executing

Environment variables:
  SUITE_OUTPUT_DIR     Output directory (default: <repo>/tmp/e2e-suite)
  TIMEOUT              Timeout per model in seconds (default: 180)
  VERBOSE              Set to 'true' for debug output
  FORCE_REFRESH        Set to 'true' to bypass cache and regenerate

Examples:
  # Tier 1 only (default, 24 combinations):
  bash tools/.tests/test-text-to-image-e2e-suite.sh

  # All tiers (48 combinations):
  bash tools/.tests/test-text-to-image-e2e-suite.sh --tier all

  # Specific tier:
  bash tools/.tests/test-text-to-image-e2e-suite.sh --tier 2

  # Dry-run to preview:
  bash tools/.tests/test-text-to-image-e2e-suite.sh --dry-run

  # Dry-run all tiers:
  bash tools/.tests/test-text-to-image-e2e-suite.sh --dry-run --tier all

  # Single use case, single settings:
  bash tools/.tests/test-text-to-image-e2e-suite.sh --use-case hero --settings max

  # List available use cases:
  bash tools/.tests/test-text-to-image-e2e-suite.sh --list-cases

  # Re-run to fill gaps (skips existing images):
  bash tools/.tests/test-text-to-image-e2e-suite.sh

  # Force regeneration (bypass cache, fresh API calls):
  bash tools/.tests/test-text-to-image-e2e-suite.sh --force-refresh
EOF
}

parse_args() {
  while (($#)); do
    case "$1" in
      -h|--help) usage; exit 0 ;;
      -v|--verbose) VERBOSE=true ;;
      --tier)
        shift
        [[ $# -gt 0 ]] || die "--tier requires a value (1|2|3|all)"
        FILTER_TIER="$1"
        ;;
      --use-case)
        shift
        [[ $# -gt 0 ]] || die "--use-case requires a value (see --list-cases)"
        FILTER_USE_CASE="$1"
        ;;
      --settings)
        shift
        [[ $# -gt 0 ]] || die "--settings requires a value (default|max)"
        FILTER_SETTINGS="$1"
        ;;
      --list-cases) list_cases; exit 0 ;;
      --force-refresh) FORCE_REFRESH=true ;;
      --dry-run) DRY_RUN=true ;;
      --) shift; break ;;
      -*) die "Unknown option: $1" ;;
      *) break ;;
    esac
    shift
  done
}

# Validate filter values
validate_filters() {
  if [[ -n "${FILTER_TIER}" ]]; then
    case "${FILTER_TIER}" in
      1|2|3|all) ;;
      *) die "Unknown tier: ${FILTER_TIER}. Valid: 1, 2, 3, all" ;;
    esac
  fi

  if [[ -n "${FILTER_USE_CASE}" ]]; then
    local valid=false
    local name
    for name in "${USE_CASE_NAMES[@]}"; do
      if [[ "${name}" == "${FILTER_USE_CASE}" ]]; then
        valid=true
        break
      fi
    done
    [[ "${valid}" == "true" ]] || die "Unknown use case: ${FILTER_USE_CASE}. Run --list-cases to see valid names."
  fi

  if [[ -n "${FILTER_SETTINGS}" ]]; then
    case "${FILTER_SETTINGS}" in
      default|max) ;;
      *) die "Unknown settings profile: ${FILTER_SETTINGS}. Valid: default, max" ;;
    esac
  fi
}

# ============================================================================
# MAIN
# ============================================================================
main() {
  parse_args "$@"
  validate_filters

  require_cmd bash
  require_cmd jq
  require_cmd timeout

  [[ -f "${E2E_PROVIDERS_SCRIPT}" ]] || die "E2E providers script not found: ${E2E_PROVIDERS_SCRIPT}"

  local -r settings_profiles=("default" "max")

  log_info "================================================================"
  log_info "E2E Battle Test Suite — Starting"
  log_info "================================================================"
  log_info "Output directory: ${SUITE_OUTPUT_DIR}"
  log_info "Timeout per model: ${TIMEOUT}s"
  log_info "Tier filter: ${FILTER_TIER}"
  [[ -n "${FILTER_USE_CASE}" ]] && log_info "Filter use case: ${FILTER_USE_CASE}"
  [[ -n "${FILTER_SETTINGS}" ]] && log_info "Filter settings: ${FILTER_SETTINGS}"
  [[ "${FORCE_REFRESH}" == "true" ]] && log_info "Force refresh: enabled (bypassing cache)"
  [[ "${DRY_RUN}" == "true" ]] && log_info "Mode: DRY-RUN (no actual API calls)"

  if [[ "${DRY_RUN}" != "true" ]]; then
    mkdir -p "${SUITE_OUTPUT_DIR}"
  fi

  local i
  for (( i=0; i<${#USE_CASE_NAMES[@]}; i++ )); do
    local use_case="${USE_CASE_NAMES[${i}]}"
    local tier="${USE_CASE_TIERS[${i}]}"

    # Apply use-case filter (overrides tier filter)
    if [[ -n "${FILTER_USE_CASE}" ]]; then
      if [[ "${use_case}" != "${FILTER_USE_CASE}" ]]; then
        continue
      fi
    else
      # Apply tier filter (only when no use-case filter is active)
      if [[ "${FILTER_TIER}" != "all" && "${tier}" != "${FILTER_TIER}" ]]; then
        continue
      fi
    fi

    local profile
    for profile in "${settings_profiles[@]}"; do
      # Apply settings filter
      if [[ -n "${FILTER_SETTINGS}" && "${profile}" != "${FILTER_SETTINGS}" ]]; then
        continue
      fi

      run_combination "${use_case}" "${i}" "${profile}"
    done
  done

  print_combined_summary

  # Exit with failure if any run failed
  local any_failed=false
  local j
  for (( j=0; j<${#RUN_EXIT_CODE[@]}; j++ )); do
    if [[ "${RUN_EXIT_CODE[${j}]}" -ne 0 ]]; then
      any_failed=true
      break
    fi
  done

  if [[ "${any_failed}" == "true" ]]; then
    log_info "Some runs had failures — exiting with status 1"
    exit "${EXIT_FAILURE}"
  fi
  exit "${EXIT_SUCCESS}"
}

# Testable main guard
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
