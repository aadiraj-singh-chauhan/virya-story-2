import bpy
import sys
import os
import json

def main():
    # Filter out arguments passed to blender after '--'
    args = sys.argv
    if "--" not in args:
        print("Usage: blender -b file.blend -P convert_blend.py -- [output.glb] [tags.json]")
        return
    
    extra_args = args[args.index("--") + 1:]
    if len(extra_args) < 1:
        print("Please provide at least the output path: -- output.glb [tags.json]")
        return
    
    out_glb = extra_args[0]
    tags_file = extra_args[1] if len(extra_args) > 1 else None

    # Load tags if provided
    tags = {}
    if tags_file and os.path.exists(tags_file):
        try:
            with open(tags_file, 'r') as f:
                tags = json.load(f)
            print(f"Loaded {len(tags)} tagging rules from {tags_file}")
        except Exception as e:
            print(f"Error loading tags file: {e}")

    # Rename objects based on rules
    if tags:
        print("Applying renaming rules to objects...")
        for obj in bpy.data.objects:
            old_name = obj.name
            # 1. Exact match renaming
            if old_name in tags:
                obj.name = tags[old_name]
                print(f"Renamed (exact match): '{old_name}' -> '{obj.name}'")
            else:
                # 2. Wildcard match (e.g. "Cube*" -> "Building*")
                for key, val in tags.items():
                    if "*" in key:
                        prefix = key.replace("*", "")
                        if old_name.startswith(prefix):
                            suffix = old_name[len(prefix):]
                            new_prefix = val.replace("*", "")
                            obj.name = f"{new_prefix}{suffix}"
                            print(f"Renamed (wildcard): '{old_name}' -> '{obj.name}'")
                            break

    # Export to GLB format
    print(f"Exporting scene to GLB: {out_glb}")
    
    # Select all objects to make sure they export
    bpy.ops.object.select_all(action='SELECT')
    
    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format='GLB',
        export_colors=True,
        export_materials='EXPORT',
        export_extras=True,  # Keeps custom attributes/metadata
        use_selection=False
    )
    print("GLB export complete.")

if __name__ == "__main__":
    main()
