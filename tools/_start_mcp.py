import bpy, addon_utils
def _go():
    addon_utils.enable('addon', default_set=False)
    import addon
    s = addon.BlenderMCPServer(host='127.0.0.1', port=9876)
    bpy.types.blendermcp_server = s
    s.start()
    bpy.context.scene.blendermcp_server_running = True
    return None
bpy.app.timers.register(_go, first_interval=3)
