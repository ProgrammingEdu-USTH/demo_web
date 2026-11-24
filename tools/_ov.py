import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
D=bpy.data
def mesh(o):
    oe=o.evaluated_get(bpy.context.evaluated_depsgraph_get()); me=oe.to_mesh(); me.transform(o.matrix_world)
    V=[v.co.copy() for v in me.vertices]; P=[tuple(p.vertices) for p in me.polygons]; M=[p.material_index for p in me.polygons]; oe.to_mesh_clear()
    return V,P,M
a,b=D.objects["Desk"],D.objects["Window_Sill"]
Va,Pa,Ma=mesh(a); Vb,Pb,Mb=mesh(b)
ov=BVHTree.FromPolygons(Va,Pa).overlap(BVHTree.FromPolygons(Vb,Pb))
for i,j in ov[:6]:
    ca=sum((Va[k] for k in Pa[i]),Vector())/len(Pa[i]); cb=sum((Vb[k] for k in Pb[j]),Vector())/len(Pb[j])
    print("desk face", [round(v,3) for v in ca], a.material_slots[Ma[i]].material.name, "| sill face", [round(v,3) for v in cb])
