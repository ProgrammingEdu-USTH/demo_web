import bpy, bmesh
from mathutils import Vector
D = bpy.data


def parts(o):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    seen, out = set(), []
    for v in bm.verts:
        if v.index in seen: continue
        st, comp = [v], []
        seen.add(v.index)
        while st:
            a = st.pop(); comp.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen: seen.add(b.index); st.append(b)
        ws = [o.matrix_world @ x.co for x in comp]
        mn = [min(w[i] for w in ws) for i in range(3)]; mx = [max(w[i] for w in ws) for i in range(3)]
        # material of first face touching
        f = next((f for f in bm.faces if f.verts[0] in comp), None)
        mat = o.material_slots[f.material_index].material.name if f and o.material_slots else '-'
        out.append((mn, mx, len(comp), mat))
    bm.free()
    return out


for n in ["Desk", "Bookshelf_Upper", "Bookshelf_Lower", "Bookshelf_Books_Group", "Interactive_Trophy_1", "Interactive_Trophy_2",
          "Interactive_Trophy_3", "Interactive_Trophy_4", "Desk_Chair", "Window_Sill", "Right_Wall_Decor"]:
    o = D.objects[n]
    ps = parts(o)
    print("==", n, "scale", tuple(round(s, 3) for s in o.scale), "rot", tuple(round(r, 3) for r in o.rotation_euler), "parts", len(ps))
    for mn, mx, nv, mat in sorted(ps, key=lambda p: (round(p[0][2], 2), p[0][0]))[:40]:
        print("   x %.3f..%.3f  y %.3f..%.3f  z %.3f..%.3f  v=%d %s" % (mn[0], mx[0], mn[1], mx[1], mn[2], mx[2], nv, mat))
for o in bpy.context.scene.objects:
    if o.type == 'MESH' and tuple(round(s, 3) for s in o.scale) != (1, 1, 1):
        print("SCALED", o.name, tuple(o.scale))
