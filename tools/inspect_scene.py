import bpy
out = []
out.append("file: %r  dirty=%s  version=%s" % (bpy.data.filepath, bpy.data.is_dirty, bpy.app.version_string))
out.append("collections: " + ", ".join("%s(%d)" % (c.name, len(c.objects)) for c in bpy.data.collections))
for o in bpy.data.objects:
    d = o.dimensions
    tris = 0
    if o.type == 'MESH':
        tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    mats = [m.name for m in o.data.materials] if o.type == 'MESH' else []
    out.append("%-28s %-6s loc=(%.2f,%.2f,%.2f) dim=(%.2f,%.2f,%.2f) tris=%d par=%s mats=%s" % (
        o.name, o.type, *o.location, *d, tris, o.parent.name if o.parent else '-', mats[:3]))
out.append("images: " + ", ".join("%s[%dx%d]" % (i.name, *i.size) for i in bpy.data.images))
print("\n".join(out))
