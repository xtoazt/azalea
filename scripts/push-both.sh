#!/bin/bash
# Push to both Azalea repositories

set -e

BRANCH=${1:-main}

echo "🚀 Pushing to both Azalea repositories..."
echo "📦 Primary: xtoazt/azalea"
echo "📦 Organization: xazalea/azalea"
echo ""

# Push to primary repository
echo "Pushing to origin (xtoazt/azalea)..."
git push origin $BRANCH || echo "⚠️  Failed to push to origin"

# Push to organization repository
echo "Pushing to upstream (xazalea/azalea)..."
git push upstream $BRANCH || echo "⚠️  Failed to push to upstream"

echo ""
echo "✅ Done! Both repositories should now be in sync."

