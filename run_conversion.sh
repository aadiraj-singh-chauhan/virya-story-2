#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

if [ "$#" -lt 2 ]; then
    echo "Usage: ./run_conversion.sh <input.blend> <output_optimized.glb> [tags.json]"
    echo ""
    echo "Example tags.json format:"
    echo "{"
    echo "  \"OldObjectName\": \"NewObjectName\","
    echo "  \"Cube*\": \"Building_Warehouse*\""
    echo "}"
    exit 1
fi

BLEND_FILE=$1
OUT_GLB=$2
TAGS_JSON=$3

# Use absolute paths if possible
ABS_BLEND=$(pwd)/$BLEND_FILE
ABS_OUT=$(pwd)/$OUT_GLB
ABS_TAGS=""
if [ -n "$TAGS_JSON" ]; then
    ABS_TAGS=$(pwd)/$TAGS_JSON
fi

TEMP_GLB="temp_raw_export.glb"

echo "============================================="
echo "Starting conversion of $BLEND_FILE..."
echo "============================================="

# 1. Run Blender in headless mode to rename elements and export raw GLB
if [ -x "/Applications/Blender.app/Contents/MacOS/Blender" ]; then
    /Applications/Blender.app/Contents/MacOS/Blender -b "$BLEND_FILE" -P scripts/convert_blend.py -- "$TEMP_GLB" "$ABS_TAGS"
else
    echo "Error: Blender not found at /Applications/Blender.app/Contents/MacOS/Blender."
    echo "Please ensure Blender is installed at /Applications/Blender.app."
    exit 1
fi

if [ ! -f "$TEMP_GLB" ]; then
    echo "Error: Exported GLB file was not created."
    exit 1
fi

echo "============================================="
echo "Compressing and optimizing GLB..."
echo "============================================="

# 2. Run gltf-transform optimization to compress the GLB
npx gltf-transform optimize "$TEMP_GLB" "$OUT_GLB"

# 3. Clean up the temporary uncompressed GLB
rm "$TEMP_GLB"

echo "============================================="
echo "Success! Optimized model saved to: $OUT_GLB"
echo "============================================="
