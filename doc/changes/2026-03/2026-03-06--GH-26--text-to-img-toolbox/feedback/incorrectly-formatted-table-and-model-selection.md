## models selecting

if model name is unique and unambiguous, it should be possible to select it by name without providing the provider name.

## models table
I'd expect that columns in the output table are properly aligned, but in this case they are not. 
use characters that are safe for terminals (so that on any terminal etc the width of the characters would be the same)

```bash
./tools/text-to-image --list-models --all-models
```

output:

```txt
Available AI Image Generation Models
=====================================

Status | Provider     | Model ID                       | Quality  | Cost       | Description
-------------------------------------------------------------------------------------------------------------------
✓  | openai       | dall-e-3                       | high     | ~$0.040    | OpenAI latest image generation model
✓  | openai       | dall-e-2                       | medium   | ~$0.020    | OpenAI previous generation model
✓  | stability    | stable-diffusion-xl-1024-v1-0  | high     | ~$0.004    | Legacy v1 engine, best quality
✓  | google       | imagen-4.0-generate-001        | high     | ~$0.040    | Google Imagen 4 standard generation
✓  | google       | imagen-4.0-ultra-generate-001  | high     | ~$0.080    | Google Imagen 4 ultra-high quality
✓  | google       | imagen-4.0-fast-generate-001   | medium   | ~$0.020    | Google Imagen 4 fast generation
✓  | google       | imagen-3.0-generate-001        | high     | ~$0.050    | Google Imagen 3 generation model
-    | huggingface  | stabilityai/stable-diffusion-2-1 | low      | Free tier limited | Open source model via HF Inference
-    | huggingface  | runwayml/stable-diffusion-v1-5 | low      | Free tier limited | Older but reliable
-    | huggingface  | black-forest-labs/flux-1.1-pro | high     | ~$0.010    | Via Hugging Face
-    | bfl          | flux-1.1-pro                   | high     | ~$0.015    | Black Forest Labs flagship model
-    | bfl          | flux-1.0-pro                   | medium   | ~$0.010    | Previous version
     ✓  | replicate    | stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b | medium   | ~$0.005    | Stability AI SDXL on Replicate
     ✓  | replicate    | black-forest-labs/flux-1.1-pro | high     | ~$0.020    | BFL FLUX via Replicate
-    | siliconflow  | stabilityai/stable-diffusion-3-medium | high     | ~$0.003    | SiliconFlow hosted SD3
-    | siliconflow  | stabilityai/stable-diffusion-xl-1.0 | medium   | ~$0.002    | SiliconFlow hosted SDXL
```
