/**
 * TN Shape Cleaner v1.1 — (Surgical update)
 * EXACT SAME LOGIC + UI as your current script, except:
 * 1) Reset UI now truly restores defaults (with AE-gray confirm dialog).
 * 2) Swatch click keeps GoodBoyNinja “Edit Value…” picker BUT attaches a temporary
 *    Color Control to the FIRST SELECTED LAYER (no temporary Null layer).
 *    If no comp or no selected layer, shows an AE-gray prompt to select a layer.
 */

(function TN_ShapeCleaner_v111(thisObj){

    // ========= Brand & Prefs =========
    var TITLE = "TN Shape Cleaner v1.1";
    var PREFS = {
        SECTION: "TN_ShapeCleaner_v111",
        WIN_BOUNDS: "win_bounds",
        STROKE_HEX: "stroke_hex",
        FILL_HEX:   "fill_hex"
    };

    // ========= Utils =========
    function clamp01(v){ return Math.min(1, Math.max(0, v)); }
    function rgb1ToHexInt(rgb){ var r=Math.round(clamp01(rgb[0])*255)&0xFF, g=Math.round(clamp01(rgb[1])*255)&0xFF, b=Math.round(clamp01(rgb[2])*255)&0xFF; return (r<<16)|(g<<8)|b; }
    function hexIntToRGB1(hex){ var r=((hex>>16)&0xFF)/255, g=((hex>>8)&0xFF)/255, b=(hex&0xFF)/255; return [clamp01(r), clamp01(g), clamp01(b)]; }
    function haveSetting(k){ try{ return app.settings.haveSetting(PREFS.SECTION,k); }catch(e){ return false; } }
    function getSetting(k,d){ try{ return app.settings.getSetting(PREFS.SECTION,k); }catch(e){ return d; } }
    function setSetting(k,v){ try{ app.settings.saveSetting(PREFS.SECTION,k,String(v)); }catch(e){} }
    function info(m){ try{ alert(m); }catch(e){} }

    // ========= SAFE GoodBoyNinja-style picker (NO temp Null; requires a selected layer) =========
    function pickColorSafe(startRGB){
        var start = (startRGB && startRGB.length===3) ? startRGB : [1,1,1];
        var comp = app.project.activeItem;

        // Require comp + selected layer (no fallback picker; just prompt)
        if(!(comp && comp instanceof CompItem) || comp.selectedLayers.length === 0){
            try{
                var dlg=new Window("dialog", "Select a layer");
                dlg.orientation="column"; dlg.alignChildren=["fill","top"]; dlg.margins=16; dlg.spacing=10;
                dlg.add("statictext", undefined, "Select a layer in the timeline to pick a color.", {multiline:true});
                var ok=dlg.add("button", undefined, "OK", {name:"ok"}); ok.alignment=["center","center"];
                dlg.center(); dlg.show();
            }catch(_e){}
            return start;
        }

        var target = comp.selectedLayers[0];
        var fx=null, prop=null, result=start;

        // Save current selection (layers)
        var prevSel = [];
        try{ var L=comp.selectedLayers; for(var i=0;i<L.length;i++) prevSel.push(L[i]); }catch(_e){}

        try{
            var parade = target.property("ADBE Effect Parade");
            if(!parade){
                // Cannot host effects → prompt and exit
                try{
                    var dlg2=new Window("dialog", "Select a layer");
                    dlg2.orientation="column"; dlg2.alignChildren=["fill","top"]; dlg2.margins=16; dlg2.spacing=10;
                    dlg2.add("statictext", undefined, "Selected layer cannot host effects.\nPick a different layer.", {multiline:true});
                    var ok2=dlg2.add("button", undefined, "OK", {name:"ok"}); ok2.alignment=["center","center"];
                    dlg2.center(); dlg2.show();
                }catch(_ee){}
                return start;
            }

            // TEMP effect on selected layer (no undo group)
            fx = parade.addProperty("ADBE Color Control");
            prop = fx.property("ADBE Color Control-0001");
            try{ prop.setValue(start); }catch(_e){}

            // Make sure the property is selected before Edit Value
            try{ for(var j=0;j<prevSel.length;j++) prevSel[j].selected=false; }catch(_e){}
            try{ prop.selected = true; }catch(_e){}

            app.executeCommand(2240); // Edit Value...

            try{ result = prop.value; }catch(_e){}
        }catch(err){
            // no-op; keep start
        }finally{
            try{ if(fx) fx.remove(); }catch(_e){}
            try{ for(var k=0;k<prevSel.length;k++) prevSel[k].selected=true; }catch(_e){}
        }
        return result;
    }

    // ========= Swatch (safe draw) =========
    function makeSwatch(parent, initialRGB, saveKey){
        var btn = parent.add("button", undefined, "");
        btn.minimumSize=[28,28]; btn.maximumSize=[28,28]; btn.preferredSize=[28,28];

        var current = initialRGB || [1,1,1];
        try{ if(haveSetting(saveKey)){ var raw=parseInt(getSetting(saveKey,""),10); if(!isNaN(raw)&&raw>=0&&raw<=0xFFFFFF) current=hexIntToRGB1(raw); } }catch(_e){}

        btn.onDraw = function(){
            try{
                var g=this.graphics, w=this.size[0], h=this.size[1];
                var brush=g.newBrush(g.BrushType.SOLID_COLOR,[current[0],current[1],current[2],1]);
                g.newPath(); g.rectPath(0.5,0.5,w-1,h-1); g.fillPath(brush);
                var pen=g.newPen(g.PenType.SOLID_COLOR,[0,0,0,1],1);
                g.newPath(); g.rectPath(0.5,0.5,w-1,h-1); g.strokePath(pen);
            }catch(_e){}
        };
        function repaint(){ try{ btn.graphics.invalidate(); }catch(e){ btn.notify("onDraw"); } }

        btn.onClick=function(){
            if(!btn.enabled) return;
            var next=pickColorSafe(current); if(!next||next.length<3) return;
            current=[next[0],next[1],next[2]];
            setSetting(saveKey, rgb1ToHexInt(current));
            repaint();
        };

        btn.getRGB=function(){ return [current[0],current[1],current[2]]; };
        btn.setRGB=function(rgb){ current=[rgb[0],rgb[1],rgb[2]]; setSetting(saveKey,rgb1ToHexInt(current)); repaint(); };

        return btn;
    }

    // ========= Flatten (transplanted) =========
    function deselectAllProps(layer){ var props=(layer&&layer.selectedProperties)?layer.selectedProperties:[]; for(var i=0;i<props.length;i++){ try{ props[i].selected=false; }catch(_e){} } }
    function ungroupAllOnLayer(layer){
        var CMD=3742, contents=layer&&layer.property("ADBE Root Vectors Group"); if(!contents) return;
        var guard=0; while(true){
            var grp=null; for(var i=contents.numProperties;i>=1;i--){ var it=contents.property(i); if(it&&it.matchName==="ADBE Vector Group"){ grp=it; break; } }
            if(!grp) break;
            deselectAllProps(layer); grp.selected=true; app.executeCommand(CMD);
            guard++; if(guard>5000){ info("Ungroup loop guard break on "+layer.name); break; }
        }
    }

    // ========= Delete helpers =========
    function removeByMatchNameRecursive(group, matchName){
        if(!group) return;
        for(var i=group.numProperties;i>=1;i--){
            var p=group.property(i); if(!p) continue;
            if(p.matchName===matchName){ try{ p.remove(); }catch(_e){}; continue; }
            if(p.propertyType===PropertyType.NAMED_GROUP || p.matchName==="ADBE Vector Group" || p.matchName==="ADBE Vectors Group"){
                removeByMatchNameRecursive(p.property("ADBE Vectors Group")||p, matchName);
            }
        }
    }

    // ========= Gradients (unchanged) =========
    var cachedStrokeGrad={colors:null,opacities:null}, cachedFillGrad={colors:null,opacities:null};
    function trySetDefaultGradient(gi){ try{gi.property("ADBE Vector Grad Type").setValue(1);}catch(e){} var c=[0,0,0,0,1,1,1,1]; var o=[0,100,1,100]; try{gi.property("ADBE Vector Grad Colors").setValue(c);}catch(e){} try{gi.property("ADBE Vector Grad Opacities").setValue(o);}catch(e){} }
    function trySetGradient(gi,c,o){ if(!c||!o){ trySetDefaultGradient(gi); return; } try{gi.property("ADBE Vector Grad Type").setValue(1);}catch(e){} try{gi.property("ADBE Vector Grad Colors").setValue(c);}catch(e){} try{gi.property("ADBE Vector Grad Opacities").setValue(o);}catch(e){} }

    // ========= UI =========
    function buildUI(thisObj){
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", TITLE, undefined, {resizeable:true});
        win.orientation="column";
        win.alignChildren=["fill","top"];
        win.spacing=16;
        win.margins=12;
        win.minimumSize=[380,320];

        // Header
        var hdr = win.add("group"); hdr.orientation="row"; hdr.alignment=["fill","top"]; hdr.alignChildren=["left","center"];
        hdr.add("statictext", undefined, "Please select shape layer(s)");
        var flex = hdr.add("group"); flex.alignment=["fill","top"];
        var helpWrap = hdr.add("group"); helpWrap.alignment=["right","center"]; helpWrap.margins=0; helpWrap.spacing=0;
        var helpBtn = helpWrap.add("button", undefined, "?"); helpBtn.minimumSize=[20,20]; helpBtn.maximumSize=[20,20]; helpBtn.preferredSize=[20,20];

        // Group 1: Delete
        var gDel = win.add("panel", undefined, "Delete All Stroke/ Fills in selected Layer(s):");
        gDel.alignment=["fill","top"]; gDel.orientation="column"; gDel.alignChildren=["left","top"]; gDel.margins=10; gDel.spacing=6;
        var chkDelStrokes = gDel.add("checkbox", undefined, "Delete all existing strokes"); chkDelStrokes.value=true;
        var chkDelFills   = gDel.add("checkbox", undefined, "Delete all existing fills");   chkDelFills.value=true;

        // Group 2: Flatten
        var gFlat = win.add("panel", undefined, "Flatten groups in selected layer(s):");
        gFlat.alignment=["fill","top"]; gFlat.orientation="column"; gFlat.alignChildren=["left","center"]; gFlat.margins=10; gFlat.spacing=6;
        var chkFlatten = gFlat.add("checkbox", undefined, "Flatten groups recursively"); chkFlatten.value=true;

        // Group 3: Add Stroke/Fill
        var gAdd = win.add("panel", undefined, "Add Stroke/ Fill to selected Layer(s):");
        gAdd.alignment=["fill","top"]; gAdd.orientation="column"; gAdd.alignChildren=["fill","top"]; gAdd.margins=10; gAdd.spacing=8;

        var rowStrokeHdr = gAdd.add("group"); rowStrokeHdr.alignment=["fill","top"]; rowStrokeHdr.orientation="row"; rowStrokeHdr.alignChildren=["left","center"];
        var chkAddStroke = rowStrokeHdr.add("checkbox", undefined, "Add new stroke"); chkAddStroke.value=true;

        var rowStroke = gAdd.add("group"); rowStroke.alignment=["fill","top"]; rowStroke.orientation="row"; rowStroke.alignChildren=["left","center"];
        var ddStrokeType = rowStroke.add("dropdownlist", undefined, ["Rounded","Butt"]); ddStrokeType.selection=0;
        ddStrokeType.preferredSize=[90,22];
        var txtWidth = rowStroke.add("edittext", undefined, "6"); txtWidth.characters=3; txtWidth.preferredSize=[36,22];
        rowStroke.add("statictext", undefined, "px");
        var ddStrokeStyle = rowStroke.add("dropdownlist", undefined, ["Color","Gradient"]); ddStrokeStyle.selection=0; ddStrokeStyle.preferredSize=[90,22];
        var strokeSwatch = makeSwatch(rowStroke, [1,1,1], PREFS.STROKE_HEX);

        var rowFillHdr = gAdd.add("group"); rowFillHdr.alignment=["fill","top"]; rowFillHdr.orientation="row"; rowFillHdr.alignChildren=["left","center"];
        var chkAddFill = rowFillHdr.add("checkbox", undefined, "Add new fill"); chkAddFill.value=false;

        var rowFill = gAdd.add("group"); rowFill.alignment=["fill","top"]; rowFill.orientation="row"; rowFill.alignChildren=["left","center"];
        var ddFillStyle = rowFill.add("dropdownlist", undefined, ["Color","Gradient"]); ddFillStyle.selection=0; ddFillStyle.preferredSize=[90,22];
        var fillSwatch = makeSwatch(rowFill, [1,1,1], PREFS.FILL_HEX);

        // enable/disable logic (unchanged)
        function setStrokeEnabled(on){ ddStrokeType.enabled=on; txtWidth.enabled=on; ddStrokeStyle.enabled=on; updateStrokeSwatch(); }
        function setFillEnabled(on){ ddFillStyle.enabled=on; updateFillSwatch(); }
        function updateStrokeSwatch(){ strokeSwatch.enabled = (chkAddStroke.value && ddStrokeStyle.selection && ddStrokeStyle.selection.text==="Color"); }
        function updateFillSwatch(){ fillSwatch.enabled   = (chkAddFill.value   && ddFillStyle.selection   && ddFillStyle.selection.text==="Color"); }
        setStrokeEnabled(chkAddStroke.value); setFillEnabled(chkAddFill.value);
        chkAddStroke.onClick=function(){ setStrokeEnabled(chkAddStroke.value); };
        chkAddFill.onClick=function(){ setFillEnabled(chkAddFill.value); };
        ddStrokeStyle.onChange=updateStrokeSwatch; ddFillStyle.onChange=updateFillSwatch;

        // === Bottom row: Reset UI + Run (always visible) ===
        var bottom = win.add("group"); bottom.alignment=["fill","bottom"]; bottom.orientation="row"; bottom.alignChildren=["center","center"]; bottom.spacing=10;
        var resetBtn = bottom.add("button", undefined, "Reset UI");
        var runBtn   = bottom.add("button", undefined, "Run"); runBtn.preferredSize=[80,28];

        // Help dialog (text only now)
        helpBtn.onClick=function(){
            var d=new Window("dialog", TITLE+" — Help");
            d.orientation="column"; d.alignChildren=["fill","top"]; d.margins=16; d.spacing=10;
            var txt="Order:\n  1) Delete Strokes/Fills\n  2) Flatten groups recursively\n  3) Add Stroke/Fill\n\nNotes:\n  • Works on selected Shape Layer(s).\n  • Swatches open a safe color dialog (no undo mismatch).\n  • Gradient option adds G-Stroke / G-Fill.";
            d.add("statictext", undefined, txt, {multiline:true});
            var ok=d.add("button", undefined, "OK"); ok.alignment=["center","center"];
            d.center(); d.show();
        };

        // ===== Bounds persistence (hardened) =====
        function parseBounds(str){
            var a=(str||"").split(","); if(a.length!==4) return null;
            var b=[parseInt(a[0],10),parseInt(a[1],10),parseInt(a[2],10),parseInt(a[3],10)];
            if(isNaN(b[0])||isNaN(b[1])||isNaN(b[2])||isNaN(b[3])) return null;
            if(b[2]<=b[0]||b[3]<=b[1]) return null;
            if((b[2]-b[0])<win.minimumSize[0]||(b[3]-b[1])<win.minimumSize[1]) return null;
            return b;
        }
        function saveBounds(){ try{ var b=win.bounds; setSetting(PREFS.WIN_BOUNDS,[b[0],b[1],b[2],b[3]].join(",")); }catch(e){} }
        function restoreBoundsIfAny(){
            try{
                if(haveSetting(PREFS.WIN_BOUNDS)){
                    var raw=getSetting(PREFS.WIN_BOUNDS,""); var b=parseBounds(raw);
                    if(b) { win.bounds=b; return true; }
                }
            }catch(e){}
            return false;
        }
        function packToPreferred(){
            try{
                win.layout.layout(true);
                var ps = win.preferredSize; var b=win.bounds;
                var w=Math.max(ps[0], win.minimumSize[0]); var h=Math.max(ps[1], win.minimumSize[1]);
                win.bounds=[b[0], b[1], b[0]+w, b[1]+h];
            }catch(_e){}
        }

        // Restore bounds or pack to preferred for a tight first-open
        if(!(thisObj instanceof Panel)){
            var restored=restoreBoundsIfAny();
            if(!restored) packToPreferred();
        }

        // Save ONLY on move
        win.onMove=function(){ saveBounds(); };
        win.onResizing = win.onResize = function(){ this.layout.resize(); };

        // ====== Reset UI button (now truly restores defaults) ======
        resetBtn.onClick=function(){
            // Confirm revert dialog
            var dlg=new Window("dialog", "Reset UI?");
            dlg.orientation="column"; dlg.alignChildren=["fill","top"]; dlg.margins=16; dlg.spacing=10;
            dlg.add("statictext", undefined, "Revert to defaults? You will lose current values.", {multiline:true});
            var row=dlg.add("group"); row.alignment=["center","center"];
            var ok=row.add("button", undefined, "Revert", {name:"ok"});
            var cancel=row.add("button", undefined, "Cancel", {name:"cancel"});
            dlg.center(); var choice=dlg.show();
            if(choice!==1) return;

            // Clear persisted settings
            try{ app.settings.deleteSection(PREFS.SECTION); }catch(e){}

            // Restore control defaults
            chkDelStrokes.value = true;
            chkDelFills.value   = true;
            chkFlatten.value    = true;

            chkAddStroke.value  = true;
            if (ddStrokeType && ddStrokeType.items && ddStrokeType.items.length>0) ddStrokeType.selection = 0; // Rounded
            txtWidth.text       = "6";
            if (ddStrokeStyle && ddStrokeStyle.items && ddStrokeStyle.items.length>0) ddStrokeStyle.selection = 0; // Color
            if (strokeSwatch && strokeSwatch.setRGB) strokeSwatch.setRGB([1,1,1]);

            chkAddFill.value    = false;
            if (ddFillStyle && ddFillStyle.items && ddFillStyle.items.length>0) ddFillStyle.selection = 0; // Color
            if (fillSwatch && fillSwatch.setRGB) fillSwatch.setRGB([1,1,1]);

            setStrokeEnabled(true);
            setFillEnabled(false);

            // Optional: tighten geometry again
            packToPreferred();
        };

        // Final layout pass
        try{ win.layout.layout(true); win.layout.resize(); }catch(_e){}

        // ===== RUN (LOGIC UNCHANGED) =====
        runBtn.onClick=function(){
            var comp=app.project.activeItem;
            if(!(comp && comp instanceof CompItem)){ info("Please activate a composition."); return; }
            var sel=comp.selectedLayers, layers=[]; for(var i=0;i<sel.length;i++){ if(sel[i] && sel[i].matchName==="ADBE Vector Layer") layers.push(sel[i]); }
            if(layers.length===0){ info("Select one or more SHAPE layers."); return; }

            var deleteStrokes=chkDelStrokes.value, deleteFills=chkDelFills.value, doFlatten=chkFlatten.value;
            var addStroke=chkAddStroke.value, addFill=chkAddFill.value;
            var strokeIsGradient=(ddStrokeStyle.selection && ddStrokeStyle.selection.text==="Gradient");
            var sType=(ddStrokeType.selection && ddStrokeType.selection.text)||"Rounded";
            var capValue=(sType==="Butt")?1:2, joinValue=(sType==="Butt")?1:2;
            var sWidth=parseFloat(txtWidth.text); if(!(sWidth>0)) sWidth=6;
            var strokeRGB=strokeSwatch.getRGB(), fillRGB=fillSwatch.getRGB();

            app.beginUndoGroup(TITLE);
            try{
                for(var li=0; li<layers.length; li++){
                    var layer=layers[li], root=layer.property("ADBE Root Vectors Group"); if(!root) continue;

                    if(deleteStrokes){ removeByMatchNameRecursive(root,"ADBE Vector Graphic - Stroke"); removeByMatchNameRecursive(root,"ADBE Vector Graphic - G-Stroke"); }
                    if(deleteFills){   removeByMatchNameRecursive(root,"ADBE Vector Graphic - Fill");   removeByMatchNameRecursive(root,"ADBE Vector Graphic - G-Fill"); }

                    if(doFlatten) ungroupAllOnLayer(layer);

                    root=layer.property("ADBE Root Vectors Group"); if(!root) continue;

                    if(addStroke){
                        if(strokeIsGradient){
                            var gs=root.addProperty("ADBE Vector Graphic - G-Stroke");
                            try{ gs.property("ADBE Vector Stroke Width").setValue(sWidth); }catch(_e){}
                            try{ gs.property("ADBE Vector Stroke Line Cap").setValue(capValue); }catch(_e){}
                            try{ gs.property("ADBE Vector Stroke Line Join").setValue(joinValue); }catch(_e){}
                            if(cachedStrokeGrad.colors && cachedStrokeGrad.opacities) trySetGradient(gs,cachedStrokeGrad.colors,cachedStrokeGrad.opacities);
                            else trySetDefaultGradient(gs);
                        }else{
                            var s=root.addProperty("ADBE Vector Graphic - Stroke");
                            try{ s.property("ADBE Vector Stroke Width").setValue(sWidth); }catch(_e){}
                            try{ s.property("ADBE Vector Stroke Line Cap").setValue(capValue); }catch(_e){}
                            try{ s.property("ADBE Vector Stroke Line Join").setValue(joinValue); }catch(_e){}
                            try{ s.property("ADBE Vector Stroke Color").setValue(strokeRGB); }catch(_e){}
                        }
                    }
                    if(addFill){
                        if(ddFillStyle.selection && ddFillStyle.selection.text==="Gradient"){
                            var gf=root.addProperty("ADBE Vector Graphic - G-Fill");
                            if(cachedFillGrad.colors && cachedFillGrad.opacities) trySetGradient(gf,cachedFillGrad.colors,cachedFillGrad.opacities);
                            else trySetDefaultGradient(gf);
                        }else{
                            var f=root.addProperty("ADBE Vector Graphic - Fill");
                            try{ f.property("ADBE Vector Fill Color").setValue(fillRGB); }catch(_e){}
                        }
                    }
                }
            }catch(err){ info("Error: "+err.toString()); }
            finally{ app.endUndoGroup(); }
        };

        return win;
    }

    var ui = buildUI(thisObj);
    if(ui instanceof Window){ ui.center(); ui.show(); }

})(this);
