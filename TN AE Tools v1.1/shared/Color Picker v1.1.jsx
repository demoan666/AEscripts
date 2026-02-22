/**
 * Color Picker v1.1.1 — Hardened Undo Handling
 * ----------------------------------------------------------------------
 * Locked logic & UI:
 *  - Script launches → GUI opens → user clicks 28×28 swatch → picker opens → swatch updates.
 *  - Swatch-only UI, persistence of color + floating palette window.
 *
 * Improvements over v1.1:
 *  - Hardened undo handling: only beginUndoGroup after comp+property ready.
 *  - Always endUndoGroup in finally, regardless of errors.
 *  - Restore previous selection state after running GBN path.
 *  - Bail to fallback BEFORE starting undo group if prerequisites fail.
 */

(function (thisObj) {
    // ---------------- Utils ----------------
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function clamp01(v) { return clamp(v, 0, 1); }
    function rgb01_to_int(rgb) {
        var r = clamp(Math.round(rgb[0] * 255), 0, 255);
        var g = clamp(Math.round(rgb[1] * 255), 0, 255);
        var b = clamp(Math.round(rgb[2] * 255), 0, 255);
        return (r << 16) | (g << 8) | b;
    }
    function int_to_rgb01(n) {
        var r = (n >> 16) & 0xFF, g = (n >> 8) & 0xFF, b = n & 0xFF;
        return [r/255, g/255, b/255];
    }

    // ---------------- Settings ----------------
    var SETTINGS = { sect:"ColorPicker_v1_1", keyColor:"lastColorInt", keyBounds:"lastBounds" };
    function saveColor(rgb01){ try{ app.settings.saveSetting(SETTINGS.sect, SETTINGS.keyColor, String(rgb01_to_int(rgb01))); }catch(e){} }
    function loadColor(){ try{ if(app.settings.haveSetting(SETTINGS.sect, SETTINGS.keyColor)){ var n=parseInt(app.settings.getSetting(SETTINGS.sect, SETTINGS.keyColor),10); if(!isNaN(n)) return int_to_rgb01(n); } }catch(e){} return [1,1,1]; }
    function saveBounds(w){ try{ if(!(w instanceof Window)) return; var b=w.bounds; var packed=[b[0],b[1],b[2]-b[0],b[3]-b[1]].join(","); app.settings.saveSetting(SETTINGS.sect, SETTINGS.keyBounds, packed); }catch(e){} }
    function restoreBounds(w){ try{ if(!(w instanceof Window)) return; if(!app.settings.haveSetting(SETTINGS.sect, SETTINGS.keyBounds)) return; var raw=app.settings.getSetting(SETTINGS.sect, SETTINGS.keyBounds); var p=(raw||"").split(","); if(p.length!==4) return; var x=parseInt(p[0],10),y=parseInt(p[1],10),ww=parseInt(p[2],10),hh=parseInt(p[3],10); if([x,y,ww,hh].some(function(n){return isNaN(n);})){return;} w.bounds=[x,y,x+Math.max(120,ww),y+Math.max(80,hh)]; }catch(e){} }

    // ---------------- GBN picker ----------------
    function pickColor_GBN(startRGB01){
        var comp = (app.project && app.project.activeItem && app.project.activeItem instanceof CompItem) ? app.project.activeItem : null;
        if (!comp) return null;
        var prevSel = []; if (comp) { for (var i=1; i<=comp.numLayers; i++){ if(comp.layer(i).selected) prevSel.push(comp.layer(i)); } }
        var result = null;
        try {
            var tempNull = comp.layers.addNull(); tempNull.enabled=false; tempNull.name="__cp_temp__";
            var fx = tempNull.property("ADBE Effect Parade").addProperty("ADBE Color Control");
            var colorProp = fx.property(1);
            colorProp.setValue(startRGB01);
            // Ensure property is selected
            app.executeCommand(app.findMenuCommandId("Deselect All"));
            colorProp.selected=true;
            var editCmd=app.findMenuCommandId("Edit Value..."); if(!editCmd) editCmd=app.findMenuCommandId("Edit Value…");
            if (!editCmd){ tempNull.remove(); return null; }
            app.beginUndoGroup("Color Picker v1.1.1 (GBN)");
            app.executeCommand(editCmd);
            var v=colorProp.value; result=[v[0],v[1],v[2]];
        }catch(e){ result=null; }
        finally{
            try{ if(tempNull) tempNull.remove(); }catch(e2){}
            try{ app.endUndoGroup(); }catch(e3){}
            // restore previous selection
            if (comp){ for (var i=1;i<=comp.numLayers;i++){ comp.layer(i).selected=false; } for (var j=0;j<prevSel.length;j++){ try{ prevSel[j].selected=true; }catch(e4){} } }
        }
        return result;
    }

    // ---------------- Native picker ----------------
    function pickColor_native(startRGB01){ var seed=rgb01_to_int(startRGB01); var picked=$.colorPicker(seed); if(picked===-1) return null; return int_to_rgb01(picked); }

    // ---------------- UI ----------------
    function buildUI(thisObj){
        var pal=(thisObj instanceof Panel)? thisObj : new Window("palette","Color Picker v1.1.1",undefined,{resizeable:true});
        pal.margins=6; pal.spacing=5; pal.alignChildren=["left","top"];
        var sw=pal.add("button",undefined,""); sw.preferredSize=[28,28]; sw.minimumSize=[28,28];
        var current=loadColor();
        sw.onDraw=function(){ var g=this.graphics; var br=g.newBrush(g.BrushType.SOLID_COLOR,current); g.newPath(); var w=this.size[0],h=this.size[1]; g.rectPath(0.5,0.5,w-1,h-1); g.fillPath(br); var pn=g.newPen(g.PenType.SOLID_COLOR,[0,0,0,1],1); g.strokePath(pn); };
        function repaint(){ try{sw.graphics.invalidate();}catch(e){sw.notify("onDraw");} }
        sw.onClick=function(){ var picked=null; try{ picked=pickColor_GBN(current);}catch(e){picked=null;} if(!picked) picked=pickColor_native(current); if(picked){ current=picked; saveColor(current); repaint(); } };
        if(pal instanceof Window){ restoreBounds(pal); pal.onResizing=pal.onResize=function(){this.layout.resize(); saveBounds(pal);}; pal.onMove=function(){saveBounds(pal);}; pal.onClose=function(){saveBounds(pal);}; pal.layout.layout(true); pal.show(); } else { pal.onResizing=pal.onResize=function(){this.layout.resize();}; }
        return pal;
    }

    buildUI(thisObj);
})(this);