# Frontend Tooling Scripts

This directory contains maintenance and automation scripts for the frontend workspace.

## Scripts

### `add-stylelint-to-all-libs.js`
**Purpose**: Batch-add stylelint targets to all libraries in the workspace.

**When to use:**
- Initial setup (✅ already done)
- After adding multiple new libraries without stylelint
- Verify all libraries have stylelint configured
- Update stylelint target configuration across all libraries

**Usage:**
```bash
node tools/scripts/add-stylelint-to-all-libs.js
```

**Status**: ✅ Completed initial run (20/20 libraries configured)

---

### `post-library-generate.js`
**Purpose**: Add stylelint targets to a single newly generated library.

**When to use:**
- After generating a new library with `nx g @nx/angular:library`
- When a library is missing stylelint targets

**Usage:**
```bash
# After generating a library
npx nx g @nx/angular:library my-new-lib

# Add stylelint
node tools/scripts/post-library-generate.js libs/my-new-lib/project.json
```

**Status**: ✅ Available for future use

---

## Workflow

### Creating New Library

```bash
# 1. Generate library
npx nx g @nx/angular:library my-feature --directory=libs/my-feature

# 2. Add stylelint (if not automatic)
node tools/scripts/post-library-generate.js libs/my-feature/project.json

# 3. Verify
npx nx stylelint my-feature
```

### Verifying All Libraries

```bash
# Run to check if any libraries are missing stylelint
node tools/scripts/add-stylelint-to-all-libs.js

# Output will show:
# ✅ Updated: X
# ⏭️  Skipped: Y (already has stylelint)
```

If skipped count equals total libraries, all are configured ✅

---

## Maintenance

These scripts should be kept for:
- Future bulk updates
- Configuration changes
- New team member onboarding
- Documentation reference

**Do not delete** - They're small and provide valuable maintenance capabilities.
