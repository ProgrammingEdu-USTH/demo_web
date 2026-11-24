import bpy
from mathutils import Vector
for n in ["Coffee_Mug","Interactive_Laptop","Interactive_Phone","Interactive_Notebook","Desk_Plant"]:
    o=bpy.data.objects[n]
    bb=[o.matrix_world @ Vector(c) for c in o.bound_box]
    c=sum(bb,Vector())/8
    print(n,"origin",[round(v,3) for v in o.matrix_world.translation],"bbox centre",[round(v,3) for v in c],"zmin",round(min(v.z for v in bb),3))
