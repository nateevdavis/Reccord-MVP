#!/bin/bash
# Quick check for Apple Music env vars

echo "Checking .env file for Apple Music variables..."
echo ""

# Check if variables exist
if grep -q "APPLE_MUSIC_TEAM_ID" .env 2>/dev/null; then
    TEAM_ID=$(grep "APPLE_MUSIC_TEAM_ID" .env | cut -d'=' -f2 | tr -d ' "')
    echo "✅ APPLE_MUSIC_TEAM_ID found: $TEAM_ID"
else
    echo "❌ APPLE_MUSIC_TEAM_ID not found"
fi

if grep -q "APPLE_MUSIC_KEY_ID" .env 2>/dev/null; then
    KEY_ID=$(grep "APPLE_MUSIC_KEY_ID" .env | cut -d'=' -f2 | tr -d ' "')
    echo "✅ APPLE_MUSIC_KEY_ID found: $KEY_ID"
else
    echo "❌ APPLE_MUSIC_KEY_ID not found"
fi

if grep -q "APPLE_MUSIC_PRIVATE_KEY" .env 2>/dev/null; then
    PRIVATE_KEY_LINE=$(grep "APPLE_MUSIC_PRIVATE_KEY" .env)
    if echo "$PRIVATE_KEY_LINE" | grep -q '\\n'; then
        echo "✅ APPLE_MUSIC_PRIVATE_KEY found (with escaped newlines)"
    elif echo "$PRIVATE_KEY_LINE" | grep -q 'BEGIN PRIVATE KEY'; then
        echo "✅ APPLE_MUSIC_PRIVATE_KEY found (with BEGIN marker)"
    else
        echo "⚠️  APPLE_MUSIC_PRIVATE_KEY found but format unclear"
    fi
    # Show first 50 chars
    echo "   Preview: $(echo "$PRIVATE_KEY_LINE" | cut -c1-50)..."
else
    echo "❌ APPLE_MUSIC_PRIVATE_KEY not found"
fi

echo ""
echo "Expected format:"
echo 'APPLE_MUSIC_TEAM_ID=BKHZ2KHLG2'
echo 'APPLE_MUSIC_KEY_ID=CWY29376H7'
echo 'APPLE_MUSIC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgyrsie0yyQqGTaJqK\\nhHdvAm3SvH0jxboSFUSPvEbMRsegCgYIKoZIzj0DAQehRANCAARWI7fIgGQGVJ1q\\n1EFH9JwSqiEwTUCKc14yEDXLAzGIsTtXNX4Pm82oMHyTe6aj6x7FuF9yOhFReKS4\\n/NrpqaOX\\n-----END PRIVATE KEY-----"'

