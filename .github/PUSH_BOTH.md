# Pushing to Both Repositories

This repository is configured to push to both:
- **Primary**: `xtoazt/azalea` (origin)
- **Organization**: `xazalea/azalea` (upstream)

## Push to Both Repositories

To push to both repositories at once:

```bash
git push all main
```

Or push to each individually:

```bash
# Push to primary repository
git push origin main

# Push to organization repository
git push upstream main
```

## Setup

The repository is configured with:
- `origin`: Points to `xtoazt/azalea`
- `upstream`: Points to `xazalea/azalea`
- `all`: Push to both repositories simultaneously

## Notes

- Both repositories should be kept in sync
- The primary repository (`xtoazt/azalea`) is the main development repository
- The organization repository (`xazalea/azalea`) is the official organization repository

