---
phase: quick-18
plan: 18
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/public/bidaxiom-logo.png
  - apps/web/public/bidaxiom-icon.png
autonomous: true
requirements: []

must_haves:
  truths:
    - Logo images have transparent padding removed
    - File sizes are reduced from 2+ MB to reasonable sizes
    - Visual appearance maintains quality without excess whitespace
  artifacts:
    - path: "apps/web/public/bidaxiom-logo.png"
      provides: "Cropped full logo"
      max_size: "500KB"
    - path: "apps/web/public/bidaxiom-icon.png"
      provides: "Cropped icon"
      max_size: "100KB"
  key_links:
    - from: "Logo PNG files"
      to: "UI components"
      via: "Next.js Image src"
      pattern: "/bidaxiom-(logo|icon)\\.png"
---

<objective>
Crop BidAxiom logo images to remove transparent padding and reduce file sizes.

Purpose: Current logo files are 2.0-2.1 MB each due to excessive transparent padding around the actual logo graphics. This impacts page load performance and wastes bandwidth for static assets that appear on every page.

Output: Optimized PNG files with transparent padding cropped to content bounds.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/quick/17-replace-company-branding-with-static-bid/17-SUMMARY.md
@apps/web/public/bidaxiom-logo.png
@apps/web/public/bidaxiom-icon.png
</context>

<tasks>

<task type="auto">
  <name>Task 1: Crop transparent padding from logo images</name>
  <files>
    apps/web/public/bidaxiom-logo.png
    apps/web/public/bidaxiom-icon.png
  </files>
  <action>
Install sharp library for image processing:
```bash
cd apps/web
npm install --save-dev sharp
```

Create cropping script `crop-logos.js` in apps/web:
```javascript
const sharp = require('sharp');
const path = require('path');

async function cropLogo(filename) {
  const inputPath = path.join(__dirname, 'public', filename);
  const outputPath = path.join(__dirname, 'public', filename);

  // Read image metadata to get original size
  const metadata = await sharp(inputPath).metadata();
  console.log(`\n${filename} - Original: ${metadata.width}x${metadata.height}, ${(metadata.size / 1024 / 1024).toFixed(2)} MB`);

  // Trim transparent padding (removes all fully transparent edge pixels)
  await sharp(inputPath)
    .trim()
    .toFile(outputPath.replace('.png', '-temp.png'));

  // Replace original with trimmed version
  const fs = require('fs');
  fs.renameSync(outputPath.replace('.png', '-temp.png'), outputPath);

  // Get new metadata
  const newMetadata = await sharp(outputPath).metadata();
  console.log(`${filename} - Cropped: ${newMetadata.width}x${newMetadata.height}, ${(newMetadata.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Reduction: ${((1 - newMetadata.size / metadata.size) * 100).toFixed(1)}%`);
}

async function main() {
  await cropLogo('bidaxiom-logo.png');
  await cropLogo('bidaxiom-icon.png');
  console.log('\n✓ Logo images cropped successfully');
}

main().catch(console.error);
```

Run the script:
```bash
node crop-logos.js
```

Verify output shows file size reduction and new dimensions. Then cleanup:
```bash
rm crop-logos.js
npm uninstall sharp
```

**Why sharp:** Node.js image processing library that handles transparent PNG trimming natively via `.trim()` method. Faster and more reliable than ImageMagick for this use case.

**Why install/uninstall pattern:** sharp is a dev dependency with large native binaries (~20 MB); install for one-time processing, then uninstall to avoid bloating the dev environment.
  </action>
  <verify>
```bash
ls -lh apps/web/public/bidaxiom-*.png
```

Both files should be significantly smaller (expected: logo < 500 KB, icon < 100 KB).
  </verify>
  <done>
- `bidaxiom-logo.png` file size reduced from 2.0 MB to under 500 KB
- `bidaxiom-icon.png` file size reduced from 2.1 MB to under 100 KB
- Both images have transparent padding removed
- Visual quality maintained (no compression artifacts)
  </done>
</task>

<task type="auto">
  <name>Task 2: Verify UI components still render correctly</name>
  <files>
    apps/web/components/layout/sidebar.tsx
    apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
  </files>
  <action>
Verify that cropped images render correctly in UI components without layout shifts or distortion.

Check usage in sidebar:
```bash
grep -n "bidaxiom" apps/web/components/layout/sidebar.tsx
```

Check usage in sign-in page:
```bash
grep -n "bidaxiom" "apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx"
```

Both components use Next.js Image with explicit width/height props:
- Sidebar full logo: 140x32
- Sidebar icon: 32x32
- Sign-in logo: 200x48

Next.js Image will handle the new dimensions automatically via object-fit. No code changes needed.

Note: If cropped images have different aspect ratios than the hardcoded dimensions, Next.js will maintain aspect ratio and scale to fit within the specified bounds using `object-fit: contain` (default behavior).
  </action>
  <verify>
```bash
# No verification command needed - this is a visual check task
echo "Visual verification in browser required after cropping"
```
  </verify>
  <done>
- Confirmed UI components use Next.js Image with explicit dimensions
- Next.js Image handles cropped dimensions automatically
- No code changes required for UI components
  </done>
</task>

<task type="auto">
  <name>Task 3: Commit optimized logo files</name>
  <files>
    apps/web/public/bidaxiom-logo.png
    apps/web/public/bidaxiom-icon.png
  </files>
  <action>
Commit the optimized logo files to git:

```bash
node C:/Users/erict/.claude/get-shit-done/bin/gsd-tools.cjs commit "perf(quick-18): crop transparent padding from BidAxiom logo images" --files apps/web/public/bidaxiom-logo.png apps/web/public/bidaxiom-icon.png
```

Include commit message noting file size reduction percentage from Task 1 output.
  </action>
  <verify>
```bash
git log -1 --stat
```

Should show commit with two files changed (bidaxiom-logo.png, bidaxiom-icon.png).
  </verify>
  <done>
- Optimized logo files committed to git
- Commit message documents file size reduction
- Git history shows binary file changes
  </done>
</task>

</tasks>

<verification>
1. Both PNG files significantly smaller (logo < 500 KB, icon < 100 KB)
2. No transparent padding visible around logo graphics
3. UI components in sidebar and sign-in page render without distortion
4. Git commit created with optimized images
</verification>

<success_criteria>
- File sizes reduced by 80%+ from original 2+ MB sizes
- Transparent padding removed from edges of both images
- No visual quality degradation
- UI components render correctly without code changes
- Changes committed to git
</success_criteria>

<output>
After completion, create `.planning/quick/18-crop-bidaxiom-logo-images-to-remove-tran/18-SUMMARY.md`
</output>
