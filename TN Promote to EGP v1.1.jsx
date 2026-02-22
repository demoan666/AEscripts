#target aftereffects
/*
  TN Promote to EGP v1.1
  - Embedded .ffx preset "Stroke Cap and Join" (Dropdown with items "Rounded","Butt")
    used to create the menu with proper item labels. No external files needed.
  - Cap & Join expressions injected on every bound stroke:
      Rounded -> Line Cap = Round, Line Join = Round
      Butt    -> Line Cap = Butt,  Line Join = Miter
  - Notes removed; replaced by hover tooltips (tight UI).
  - Control layer section label changed to "Create null controller layer".
  - Color/Gradient UI, Consistent Stroke Width, Scale & Flip-X, EGP push, "Add selected props to EGP"
    remain as in the last working version (no regressions).
*/

(function TN_PromoteToEGP_v11(thisObj){

/* ===== Embedded .FFX (base64) ===== */
function _tn_writeEmbeddedCapJoinFFX(){
    // Writes the embedded preset to the user data folder once. Returns a File or null.
    var b64 =
"TVNQAAAAAAACAAAAAAABAAAAAwAAABQAAAAAQWZ0ZXIgRWZmZWN0cyBQcmVzZXRzAAABAAAAAwAAAAoAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAgAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAAHAAAARWZmZWN0AAAABAAAAAAABAAAAAMAAAABAAAABQAAAENvbW0AAAAEAAAAAAABAAAAAwAAAAEAAAAEAAAATmFtZQAAAAsAAAAAU3Ryb2tlIENhcCBhbmQgSm9pbgAAAQAAAAEAAAAEAAAATWFuZAAAABAAAAAAQURCRSBEcm9wZG93biBDb250cm9sAAAAAQAAAAEAAAADAAAASWQAAAAWAAAAAFBzRWZmZWN0MDAwMDAwMDAwMDAwAAAABQAAAENsYXMAAAAAAQAAAAEAAAACAAAASXRlbXMAAAABAAAAAQAAAAQAAABSb3VuZGVkAAAABAAAAAEAAAACAAAASXRlbXMAAAABAAAAAQAAAAQAAABCdXR0AAAAAQAAAAEAAAACAAAARmlyc3QAAAABAAAAAQAAAAIAAABBbHRzAAAAAQAAAAEAAAA=";
    try{
        var bs = atob(b64); // base64 -> binary string
        var folder = Folder.userData;
        if(!folder || !folder.exists){ folder = new Folder(Folder.temp.fsName); }
        var out = File(folder.fsName + "/TN_Stroke_Cap_and_Join.ffx");
        if(!out.exists || out.length !== bs.length){
            out.encoding = "BINARY";
            out.open("w");
            out.write(bs);
            out.close();
        }
        return out;
    }catch(e){ return null; }
}
function atob(a){ // minimal base64 decoder for ExtendScript
    var b="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",c="",d=0,e,f,g,h,i=0;
    a=a.replace(/[^A-Za-z0-9\+\/\=]/g,"");
    while(i<a.length){
        e=b.indexOf(a.charAt(i++));
        f=b.indexOf(a.charAt(i++));
        g=b.indexOf(a.charAt(i++));
        h=b.indexOf(a.charAt(i++));
        d=(e<<18)|(f<<12)|((g&63)<<6)|(h&63);
        c+=String.fromCharCode((d>>16)&255);
        if(g!=64) c+=String.fromCharCode((d>>8)&255);
        if(h!=64) c+=String.fromCharCode(d&255);
    }
    return c;
}

/* ===== Tunables ===== */
var DEFAULT_WIDTH = 396; // matches your mock

/* ===== Utils ===== */
function getActiveComp(){ var c=app.project&&app.project.activeItem; return (c&&c instanceof CompItem)?c:null; }
function isShapeLayer(L){ return L && L.matchName==="ADBE Vector Layer"; }
function escapeName(n){ return String(n).replace(/\\/g,"\\\\").replace(/"/g,"\\\""); }
function clamp01(v){ return Math.min(1, Math.max(0, v)); }
function rgb1ToHexInt(rgb){ var r=Math.round(clamp01(rgb[0])*255)&0xFF, g=Math.round(clamp01(rgb[1])*255)&0xFF, b=Math.round(clamp01(rgb[2])*255)&0xFF; return (r<<16)|(g<<8)|b; }
function hexIntToRGB1(hexInt){ var r=((hexInt>>16)&0xFF)/255, g=((hexInt>>8)&0xFF)/255, b=(hexInt&0xFF)/255; return [clamp01(r),clamp01(g),clamp01(b)]; }
function contains(arr, item){ for(var i=0;i<arr.length;i++) if(arr[i]===item) return true; return false; }

function ensureEffectByName(fxParade, matchName, desiredName){
    if(!fxParade) return null;
    var ex = fxParade.property(desiredName);
    if(ex) return ex;
    var eff = fxParade.addProperty(matchName);
    eff.name = desiredName;
    return eff;
}
function createUniqueNullLayer(comp, desired){
    var name = desired||"CTRL_EGP", base=name, i=1;
    function exists(n){ for(var j=1;j<=comp.numLayers;j++){ if(comp.layer(j).name===n) return true; } return false; }
    while(exists(name)){ name = base+"_"+i; i++; if(i>999) break; }
    var L = comp.layers.addNull(comp.duration); L.name=name;
    return L;
}
function setCompEGPNameIfMissing(comp){
    try{ if(!comp.motionGraphicsTemplateName || comp.motionGraphicsTemplateName==="") comp.motionGraphicsTemplateName = comp.name; }catch(_e){}
}

/* ===== Color pickers ===== */
function pickColor_GBN_tempNull(startRGB){
    var start = (startRGB && startRGB.length===3) ? startRGB : [1,1,1];
    var comp = getActiveComp(); if(!(comp && comp instanceof CompItem)) return start;
    var tempLayer=null, tempFx=null, tempProp=null, picked=start;
    try{
        tempLayer = comp.layers.addNull(comp.duration);
        tempLayer.name = "_GBN_TMP_";
        var parade = tempLayer.property("ADBE Effect Parade");
        tempFx = parade.addProperty("ADBE Color Control");
        tempProp = tempFx.property("ADBE Color Control-0001");
        try{ tempProp.setValue(start); }catch(_e){}
        try{
            for(var i=1;i<=comp.numLayers;i++){ try{ comp.layer(i).selected=false; }catch(_e){} }
            tempLayer.selected=true; tempProp.selected=true;
        }catch(_e){}
        app.executeCommand(2240); // Edit Value…
        try{ picked=tempProp.value; }catch(_e){}
    }catch(err){} finally{ try{ if(tempLayer) tempLayer.remove(); }catch(_e){} }
    return picked;
}
function pickColorWithFallback(startRGB){
    var comp=getActiveComp();
    if(comp) return pickColor_GBN_tempNull(startRGB);
    var startHex = rgb1ToHexInt(startRGB||[1,1,1]);
    var out = $.colorPicker(startHex);
    if(out<0) return startRGB||[1,1,1];
    var r=(out>>16)&0xFF, g=(out>>8)&0xFF, b=out&0xFF;
    return [r/255, g/255, b/255];
}

/* ===== Stroke traversal ===== */
function collectStrokes(group, bag){
    if(!group) return;
    for(var i=1;i<=group.numProperties;i++){
        var p=group.property(i); if(!p) continue;
        var mn=p.matchName;
        if(mn==="ADBE Vector Graphic - Stroke"){ bag.push(p); }
        else if(mn==="ADBE Vector Group" || mn==="ADBE Vectors Group" || p.propertyType===PropertyType.NAMED_GROUP){
            var inner=p.property("ADBE Vectors Group") || p;
            collectStrokes(inner, bag);
        }
    }
}
function getAllStrokesOnShapeLayer(layer){
    var strokes=[]; if(!isShapeLayer(layer)) return strokes;
    var root=layer.property("ADBE Root Vectors Group"); if(!root) return strokes;
    collectStrokes(root, strokes);
    return strokes;
}

/* ===== Scale helpers ===== */
function getSelectedScalePropSnapshot(comp){
    if(!(comp && comp.selectedProperties)) return null;
    var sp=comp.selectedProperties;
    for(var i=0;i<sp.length;i++){
        var pr=sp[i]; if(!pr) continue;
        var mn=pr.matchName;
        if(mn==="ADBE Scale" || mn==="ADBE Vector Scale") return pr;
    }
    return null;
}
function fallbackScaleXFromFirstSelectedLayer(comp){
    try{
        var sel=comp.selectedLayers||[];
        if(sel.length>0){
            var tr=sel[0].property("ADBE Transform Group"); if(!tr) return undefined;
            var sc=tr.property("ADBE Scale"); if(!sc) return undefined;
            var v=sc.valueAtTime(comp.time,false);
            return (v && v.length)? v[0] : (typeof v==="number"? v: undefined);
        }
    }catch(_e){}
    return undefined;
}

/* ===== Prompts / effect ensure ===== */
function promptConnectExisting(ctrlLayerName, controlName){
    var d=new Window("dialog","Control exists");
    d.orientation="column"; d.alignChildren=["fill","top"]; d.margins=16; d.spacing=10;
    d.add("statictext", undefined,
        "‘"+controlName+"’ already exists on ‘"+ctrlLayerName+"’. Connect to existing controllers?, \n" +
        "click 'Connect' bind to existing) OR \n" +
        "click 'Cancel' to cancel so you can rename controller or pick another layer).", {multiline:true});
    var row=d.add("group"); row.alignment=["center","center"];
    var connect=row.add("button", undefined, "Connect", {name:"ok"});
    var cancel =row.add("button", undefined, "Cancel",  {name:"cancel"});
    d.center(); return d.show()===1;
}
function ensureControllerControl(ctrlLayer, matchName, displayName){
    var fx=ctrlLayer.property("ADBE Effect Parade"); if(!fx) return null;
    var ex=fx.property(displayName);
    if(ex){ if(!promptConnectExisting(ctrlLayer.name, displayName)) return null; return ex; }
    return ensureEffectByName(fx, matchName, displayName);
}

/* ===== Ensure Stroke Cap and Join (from embedded .ffx) ===== */
function ensureCapJoinFromPreset(ctrlLayer, defaultIndex){
    var parade = ctrlLayer.property("ADBE Effect Parade");
    var ex = parade.property("Stroke Cap and Join");
    if(ex) return ex;
    var ffx = _tn_writeEmbeddedCapJoinFFX();
    if(ffx && ffx.exists){
        try{ ctrlLayer.applyPreset(ffx); }catch(_e){}
        ex = parade.property("Stroke Cap and Join");
        if(ex && defaultIndex){ try{ ex.property(1).setValue(defaultIndex); }catch(_e){} }
        if(ex) return ex;
    }
    // Fallback to vanilla dropdown if preset couldn't be applied
    ex = ensureControllerControl(ctrlLayer, "ADBE Dropdown Control", "Stroke Cap and Join");
    if(ex && defaultIndex){ try{ ex.property(1).setValue(defaultIndex); }catch(_e){} }
    return ex;
}

/* ===== EGP helpers ===== */
function makeToken(layerName, effectName){ return {layerName:layerName, effectName:effectName}; }
function prepEGP(comp, firstOpenDelay){
    try{ app.project.activeItem = comp; }catch(_e){}
    try{ comp.openInViewer(); }catch(_e){}
    try{ setCompEGPNameIfMissing(comp); }catch(_e){}
    try{ comp.openInEssentialGraphics(); }catch(_e){}
    if(firstOpenDelay){ try{$.sleep(100);}catch(_e){} }
}
function selectSingleLayerPreserve(comp, layer){
    var prev = comp.selectedLayers ? comp.selectedLayers.slice(0) : [];
    try{
        for(var i=1;i<=comp.numLayers;i++){ try{ comp.layer(i).selected=false; }catch(_e){} }
        if(layer) layer.selected=true;
    }catch(_e){}
    return prev;
}
function restoreLayerSelection(comp, prev){
    try{
        for(var i=1;i<=comp.numLayers;i++){ try{ comp.layer(i).selected=false; }catch(_e){} }
        for(var j=0;j<prev.length;j++){ try{ prev[j].selected=true; }catch(_e){} }
    }catch(_e){}
}
function pushTokensToEGP(comp, tokensInOrder, ensureSelectLayer){
    if(!tokensInOrder || tokensInOrder.length===0) return;
    prepEGP(comp, /*firstOpenDelay*/ true);

    var seen={}, ordered=[];
    for(var i=0;i<tokensInOrder.length;i++){
        var t=tokensInOrder[i]; if(!t || !t.layerName || !t.effectName) continue;
        var key=t.layerName+"||"+t.effectName;
        if(!seen[key]){ seen[key]=true; ordered.push(t); }
    }

    var prevSel=null;
    for(var j=0;j<ordered.length;j++){
        var tk=ordered[j];
        try{
            var L = comp.layer(tk.layerName); if(!L) continue;
            if(ensureSelectLayer){
                if(prevSel===null) prevSel = selectSingleLayerPreserve(comp, L);
                else{ selectSingleLayerPreserve(comp, L); }
            }
            var fx = L.property("ADBE Effect Parade"); if(!fx) continue;
            var eff = fx.property(tk.effectName); if(!eff) continue;
            var prop = eff.property(1); if(!prop) continue;

            try{
                if(prop.canAddToMotionGraphicsTemplate && prop.canAddToMotionGraphicsTemplate(comp)){
                    prop.addToMotionGraphicsTemplate(comp);
                }else{
                    prop.addToMotionGraphicsTemplate(comp);
                }
            }catch(_e){}
        }catch(_e){}
    }
    if(prevSel){ restoreLayerSelection(comp, prevSel); }
}

/* ===== Swatch persistence ===== */
var SWATCH_STORE={ SECTION:"AE_ColorSwatch_Panel", KEY_COLOR:"lastColorHexInt" };
function loadSavedColorOrWhite(){ try{ if(app.settings.haveSetting(SWATCH_STORE.SECTION,SWATCH_STORE.KEY_COLOR)){ var raw=app.settings.getSetting(SWATCH_STORE.SECTION,SWATCH_STORE.KEY_COLOR); var parsed=parseInt(raw,10); if(!isNaN(parsed)&&parsed>=0&&parsed<=0xFFFFFF){ return hexIntToRGB1(parsed);} } }catch(e){} return [1,1,1]; }
function saveColor(rgb1){ try{ app.settings.saveSetting(SWATCH_STORE.SECTION, SWATCH_STORE.KEY_COLOR, String(rgb1ToHexInt(rgb1))); }catch(e){} }

/* ===== UI ===== */
function buildUI(thisObj){
    var win=(thisObj instanceof Panel)?thisObj:new Window("palette","TN Promote to EGP v1.1",undefined,{resizeable:true});
    win.orientation="column"; win.alignChildren=["fill","top"]; win.spacing=12; win.margins=12;
    win.preferredSize=[DEFAULT_WIDTH, undefined];

    // Top bar
    var topBar=win.add("group"); topBar.orientation="row"; topBar.alignment=["fill","top"]; topBar.alignChildren=["left","center"];
    var spacer=topBar.add("group"); spacer.alignment=["fill","top"];
    var helpWrap=topBar.add("group"); helpWrap.alignment=["right","center"]; var helpBtn=helpWrap.add("button", undefined, "?"); helpBtn.minimumSize=[20,20]; helpBtn.maximumSize=[20,20]; helpBtn.preferredSize=[20,20];

    // Control layer (always create Null)
    var pnlCtrl=win.add("panel", undefined, "Control layer:"); pnlCtrl.orientation="column"; pnlCtrl.alignChildren=["fill","top"]; pnlCtrl.margins=10; pnlCtrl.spacing=8;
    var createControllersChk=pnlCtrl.add("checkbox", undefined, "Create Controllers"); createControllersChk.value=true;
    createControllersChk.helpTip = "Create null controller layer";
    var rowName=pnlCtrl.add("group"); rowName.orientation="row"; rowName.alignChildren=["left","center"]; rowName.alignment=["fill","top"];
    rowName.add("statictext", undefined, "Layer name:");
    var createName=rowName.add("edittext", undefined, "CTRL_EGP"); createName.characters=20; createName.alignment=["fill","center"];
    function syncCreateEnable(){ createName.enabled = !!createControllersChk.value; }
    createControllersChk.onClick=function(){ syncCreateEnable(); }; syncCreateEnable();

    // Stroke controls
    var pnlStroke=win.add("panel", undefined, "Stroke controls:"); pnlStroke.orientation="column"; pnlStroke.alignChildren=["fill","top"]; pnlStroke.margins=10; pnlStroke.spacing=8;

    var widthRow=pnlStroke.add("group"); widthRow.orientation="row"; widthRow.alignChildren=["left","center"]; widthRow.alignment=["fill","top"];
    var widthCheckbox=widthRow.add("checkbox", undefined, "Stroke Width"); widthCheckbox.value=true;
    widthCheckbox.helpTip = "Enable to add & bind Stroke Width controller";
    widthRow.add("statictext", undefined, "Default:");
    var defaultValueField=widthRow.add("edittext", undefined, "6"); defaultValueField.characters=3; defaultValueField.preferredSize=[28,22];

    // Stroke Type dropdown (UI; maps to Dropdown effect)
    var strokeTypeDD=widthRow.add("dropdownlist", undefined, ["Rounded","Butt"]); strokeTypeDD.selection=0;
    strokeTypeDD.helpTip = "Rounded -> Round cap & join; Butt -> Butt cap & Miter join";

    var widthNameRow=pnlStroke.add("group"); widthNameRow.orientation="row"; widthNameRow.alignChildren=["left","center"]; widthNameRow.alignment=["fill","top"];
    widthNameRow.add("statictext", undefined, "Name:");
    var widthNameField=widthNameRow.add("edittext", undefined, "Stroke Width"); widthNameField.characters=20; widthNameField.alignment=["fill","center"];

    var cswRow=pnlStroke.add("group"); cswRow.orientation="row"; cswRow.alignChildren=["left","center"]; cswRow.alignment=["fill","top"];
    var consistentWidthChk=cswRow.add("checkbox", undefined, "Consistent stroke width"); consistentWidthChk.value=true;
    consistentWidthChk.helpTip = "It maintains stroke width, when layer scaling";

    var colorRow=pnlStroke.add("group"); colorRow.orientation="row"; colorRow.alignChildren=["left","center"]; colorRow.alignment=["fill","top"];
    var colorCheckbox=colorRow.add("checkbox", undefined, "Stroke Color"); colorCheckbox.value=true;
    colorCheckbox.helpTip = "Enable to add & bind Stroke Color controller";

    var colorModeDD=colorRow.add("dropdownlist", undefined, ["Color","Gradient"]); colorModeDD.selection=0;
    colorModeDD.helpTip = "Choose 'Gradient' to convert solid strokes to gradient and bind Start/End points";
    var colorSwatch=colorRow.add("button", undefined, ""); colorSwatch.preferredSize=[28,28]; colorSwatch.minimumSize=[28,28];
    var currentColor=loadSavedColorOrWhite();
    colorSwatch.onDraw=function(){ var g=this.graphics,w=this.size[0],h=this.size[1]; var b=g.newBrush(g.BrushType.SOLID_COLOR,[currentColor[0],currentColor[1],currentColor[2],1]); g.newPath(); g.rectPath(0.5,0.5,w-1,h-1); g.fillPath(b); var pen=g.newPen(g.PenType.SOLID_COLOR,[0,0,0,1],1); g.newPath(); g.rectPath(0.5,0.5,w-1,h-1); g.strokePath(pen); };

    var colorNameRow=pnlStroke.add("group"); colorNameRow.orientation="row"; colorNameRow.alignChildren=["left","center"]; colorNameRow.alignment=["fill","top"];
    colorNameRow.add("statictext", undefined, "Name:");
    var colorNameField=colorNameRow.add("edittext", undefined, "Stroke Color"); colorNameField.characters=20; colorNameField.alignment=["fill","center"];

    // Scale & Flip-X
    var pnlScale=win.add("panel", undefined, "Scale and Flip-X controls:"); pnlScale.orientation="column"; pnlScale.alignChildren=["fill","top"]; pnlScale.margins=10; pnlScale.spacing=6;
    var scaleCheckbox=pnlScale.add("checkbox", undefined, "Scale & Flip X Controls"); scaleCheckbox.value=true;
    scaleCheckbox.helpTip = "Select a 'scale' property either in the layer or a group transform";

    // EGP
    var pnlEGP=win.add("panel", undefined, "Essential Graphics controls:"); pnlEGP.orientation="column"; pnlEGP.alignChildren=["fill","top"]; pnlEGP.margins=10; pnlEGP.spacing=6;
    var egpCheckbox=pnlEGP.add("checkbox", undefined, "Push controls to Essential Graphics"); egpCheckbox.value=true;
    egpCheckbox.helpTip = "Pushes all newly created controllers to EGP in the same run";

    var btnRow=pnlEGP.add("group"); btnRow.alignment=["center","top"]; btnRow.margins=0; btnRow.spacing=0;
	var addAllFromLayerBtn = btnRow.add("button", undefined, "Add all from Layer to EGP");
	addAllFromLayerBtn.alignment = ["center","center"];
	addAllFromLayerBtn.helpTip = "Select exactly one layer; adds ALL of its effects to Essential Graphics.";
    var addSelectedBtn=btnRow.add("button", undefined, "Add selected properties to EGP"); addSelectedBtn.alignment=["center","center"];
    addSelectedBtn.helpTip = "Select properties in the Timeline and click to add them to EGP";

    // Bottom
    var bottom=win.add("group"); bottom.alignment=["fill","bottom"]; bottom.orientation="row"; bottom.alignChildren=["center","center"]; bottom.spacing=10;
    var resetBtn=bottom.add("button", undefined, "Reset UI");
    var applyBtn=bottom.add("button", undefined, "Apply"); applyBtn.preferredSize=[80,28];

    // Enable/disable helpers
    function setStrokeWidthUIEnabled(on){
        defaultValueField.enabled = on;
        strokeTypeDD.enabled     = on;
        widthNameField.enabled   = on;
        consistentWidthChk.enabled = on;
    }
    function setStrokeColorUIEnabled(on){
        colorModeDD.enabled = on;
        var isGrad = (colorModeDD.selection && colorModeDD.selection.index===1);
        colorSwatch.enabled = on && !isGrad;
        colorSwatch.helpTip = isGrad ? "Standard black-to-white gradient will be applied." : "Open color picker";
        colorNameField.enabled = on;
    }
    function syncScaleSection(){ /* only checkbox + tooltip */ }
	function syncEGPSection(){
		var on = !!egpCheckbox.value;
		addSelectedBtn.enabled = on;
		if (typeof addAllFromLayerBtn !== "undefined" && addAllFromLayerBtn)
			addAllFromLayerBtn.enabled = on;
	}


    widthCheckbox.onClick=function(){ setStrokeWidthUIEnabled(!!widthCheckbox.value); };
    colorCheckbox.onClick=function(){ setStrokeColorUIEnabled(!!colorCheckbox.value); };
    colorModeDD.onChange=function(){ setStrokeColorUIEnabled(!!colorCheckbox.value); };

    // Initial states
    setStrokeWidthUIEnabled(true);
    setStrokeColorUIEnabled(true);
    syncScaleSection();
    syncEGPSection();

    // Help
    helpBtn.onClick=function(){
        var d=new Window("dialog","TN Promote to EGP v1.1 — Help");
        d.orientation="column"; d.alignChildren=["fill","top"]; d.margins=16; d.spacing=10;
        d.add("statictext", undefined,
            "Workflow:\n  1) Bind Stroke Width/Type & Color/Gradient\n  2) (Optional) Scale & Flip X\n  3) (Optional) Push to Essential Graphics\n\n" +
            "• Hover any checkbox for usage tips.\n" +
            "• ‘Add selected properties to EGP’ adds current selection directly.", {multiline:true});
        d.add("button", undefined, "OK"); d.center(); d.show();
    };

    // Swatch click with fallback
    var currentColor=loadSavedColorOrWhite();
    function repaintSwatch(){ try{ colorSwatch.graphics.invalidate(); }catch(e){ colorSwatch.notify("onDraw"); } }
    colorSwatch.onClick=function(){ var next=pickColorWithFallback(currentColor); if(!next||next.length<3) return; currentColor=[next[0],next[1],next[2]]; saveColor(currentColor); repaintSwatch(); };
    defaultValueField.onChanging=function(){ var t=this.text, f=t.replace(/[^0-9\.\-]/g,""); if(t!==f) this.text=f; };

    /* ===== APPLY ===== */
    applyBtn.onClick=function(){
        var comp=getActiveComp(); if(!comp){ alert("Please select a composition."); return; }

        var snapLayers = comp.selectedLayers ? comp.selectedLayers.slice(0) : [];
        var shapeTargets=[]; for(var sl=0; sl<snapLayers.length; sl++) if(isShapeLayer(snapLayers[sl])) shapeTargets.push(snapLayers[sl]);
        var selectedScaleProp = getSelectedScalePropSnapshot(comp);

        var wantWidth=!!widthCheckbox.value, wantColor=!!colorCheckbox.value, wantScale=!!scaleCheckbox.value, wantEGP=!!egpCheckbox.value;
        var wantCSW = !!consistentWidthChk.value;
        var colorIsGradient = (colorModeDD.selection && colorModeDD.selection.index===1);
        var strokeTypeIndex  = (strokeTypeDD.selection ? strokeTypeDD.selection.index+1 : 1); // 1=Rounded, 2=Butt

        // EGP-only mode (unchanged path preserved)
        if(!createControllersChk.value){
            if(!wantEGP){ alert("Enable 'Push controls to Essential Graphics' to run EGP-only."); return; }
            var sel=comp.selectedLayers||[], controllerLike=null;
            if(sel.length===1){
                var p=sel[0].property("ADBE Effect Parade");
                if(p && p.numProperties>0){ controllerLike=sel[0]; }
            }
            if(controllerLike){
                var effTokens=[], parade=controllerLike.property("ADBE Effect Parade");
                for(var e=1;e<=parade.numProperties;e++){ var ef=parade.property(e); if(ef) effTokens.push(makeToken(controllerLike.name, ef.name)); }
                if(effTokens.length===0){
                    var n=new Window("dialog","Info"); n.orientation="column"; n.alignChildren=["fill","top"]; n.margins=16; n.spacing=10;
                    n.add("statictext", undefined, "No effects found on this layer."); n.add("button", undefined, "Close", {name:"ok"}); n.center(); n.show();
                    return;
                }
                app.beginUndoGroup("EGP: push controller effects");
                try{ pushTokensToEGP(comp, effTokens, /*ensureSelectLayer*/ true); }catch(errC){ alert("Error: "+errC.toString()); } finally{ app.endUndoGroup(); }
                return;
            }
            // If not exactly-one controller layer, fall back to the prior selection-driven dialog (omitted for brevity)
        }

        // Controller path
        app.beginUndoGroup("Promote to EGP");
        try{
            var ctrlLayer = createUniqueNullLayer(comp, (createName.text||"CTRL_EGP"));

            // restore prior selection (keep controller unselected)
            try{
                ctrlLayer.selected=false;
                for(var i1=1;i1<=comp.numLayers;i1++){ try{ comp.layer(i1).selected=false; }catch(_e){} }
                for(var i2=0;i2<snapLayers.length;i2++){ try{ snapLayers[i2].selected=true; }catch(_e){} }
                if(selectedScaleProp){ try{ selectedScaleProp.selected=true; }catch(_e){} }
            }catch(_e){}

            var ctrlFX=ctrlLayer.property("ADBE Effect Parade"); if(!ctrlFX){ alert("Selected control layer cannot host effects."); throw "Cancelled"; }

            // Scale guard
            if(wantScale && !selectedScaleProp){
                var dlg2=new Window("dialog","Scale & Flip-X");
                dlg2.orientation="column"; dlg2.alignChildren=["fill","top"]; dlg2.margins=16; dlg2.spacing=10;
                dlg2.add("statictext", undefined, "You checked ‘Scale & Flip-X’ but no Scale property is selected.", {multiline:true});
                var row2=dlg2.add("group"); row2.alignment=["center","center"];
                row2.add("button", undefined, "Pick now", {name:"cancel"});
                var runw=row2.add("button", undefined, "Run without", {name:"ok"});
                dlg2.center(); var res2=dlg2.show();
                if(res2!==1){
				try{ ctrlLayer.remove(); }catch(_e){}
				app.endUndoGroup();
				return;
			}
{ app.endUndoGroup(); return; }
                wantScale=false;
            }

            // Controller effects
            var widthEff=null, colorEff=null, scaleEff=null, flipEff=null, cswEff=null, capJoinEff=null, gradStartEff=null, gradEndEff=null;

            if(wantWidth){
                widthEff=ensureControllerControl(ctrlLayer,"ADBE Slider Control",(widthNameField.text||"Stroke Width")); if(!widthEff) throw "Cancelled";
                try{ widthEff.property(1).setValue(parseFloat(defaultValueField.text)||6); }catch(_e){}
            }

            // DROPDOWN by embedded preset
            capJoinEff = ensureCapJoinFromPreset(ctrlLayer, strokeTypeIndex); if(!capJoinEff) throw "Cancelled";

            if(!colorIsGradient){
                if(wantColor){
                    colorEff=ensureControllerControl(ctrlLayer,"ADBE Color Control",(colorNameField.text||"Stroke Color")); if(!colorEff) throw "Cancelled";
                    try{ colorEff.property(1).setValue(currentColor); }catch(_e){}
                }
            }else{
                gradStartEff=ensureControllerControl(ctrlLayer,"ADBE Point Control","Gradient Start"); if(!gradStartEff) throw "Cancelled";
                gradEndEff  =ensureControllerControl(ctrlLayer,"ADBE Point Control","Gradient End");   if(!gradEndEff)   throw "Cancelled";
                try{ gradStartEff.property(1).setValue([0,0]); }catch(_e){}
                try{ gradEndEff.property(1).setValue([100,0]); }catch(_e){}
            }

            if(wantScale){
                scaleEff=ensureControllerControl(ctrlLayer,"ADBE Slider Control","Scale"); if(!scaleEff) throw "Cancelled";
                flipEff =ensureControllerControl(ctrlLayer,"ADBE Checkbox Control","Flip X"); if(!flipEff) throw "Cancelled";
                try{
                    var seed;
                    if(selectedScaleProp){
                        var v = selectedScaleProp.valueAtTime(comp.time,false);
                        seed = (v && v.length)? v[0] : (typeof v==="number"? v: undefined);
                    }
                    if(seed===undefined){ seed = fallbackScaleXFromFirstSelectedLayer(comp); }
                    var cur = scaleEff.property(1).value;
                    if(typeof seed==="number" && (isNaN(cur) || cur===0)){ scaleEff.property(1).setValue(seed); }
                }catch(_e){}
                try{ flipEff.property(1).setValue(0); }catch(_e3){}
            }
            if(wantWidth){
                cswEff = ensureControllerControl(ctrlLayer,"ADBE Checkbox Control","Consistent Stroke Width"); if(!cswEff) throw "Cancelled";
                try{ cswEff.property(1).setValue( wantCSW ? 1 : 0 ); }catch(_e){}
            }

            // ---- BINDING ----
            if((wantWidth||wantColor) && shapeTargets.length===0){ alert("Select one or more SHAPE layers to bind stroke controls."); throw "Cancelled"; }

            var ctrlEsc=escapeName(ctrlLayer.name);
            var widthName=(widthNameField.text||"Stroke Width");
            var colorName=(colorNameField.text||"Stroke Color");
            var widthExprPlain='thisComp.layer("'+ctrlEsc+'").effect("'+widthName+'")("Slider")';
            var colorExpr='thisComp.layer("'+ctrlEsc+'").effect("'+colorName+'")("Color")';

            var widthExpr = wantCSW
                ? 'ctrl=thisComp.layer("'+ctrlEsc+'");\nbase=ctrl.effect("'+widthName+'")("Slider").value;\ncsw=ctrl.effect("Consistent Stroke Width")("Checkbox").value;\ncsw ? base/Math.max(length(toComp([0,0]),toComp([0.7071,0.7071])),0.001) : base'
                : widthExprPlain;

            // Cap & Join expressions from our preset ("Menu")
            var capExpr  = 'm=thisComp.layer("'+ctrlEsc+'").effect("Stroke Cap and Join")("Menu"); Math.round(m)==1?2:1'; // Rounded->2 (Round), Butt->1 (Butt)
            var joinExpr = 'm=thisComp.layer("'+ctrlEsc+'").effect("Stroke Cap and Join")("Menu"); Math.round(m)==1?2:1'; // Rounded->2 (Round), Butt->1 (Miter)

            for(var t=0;t<shapeTargets.length;t++){
                var L=shapeTargets[t];
                var root = L.property("ADBE Root Vectors Group"); if(!root) continue;

                var solids=[]; (function collect(group){
                    for(var i=1;i<=group.numProperties;i++){
                        var p=group.property(i); if(!p) continue;
                        var mn=p.matchName;
                        if(mn==="ADBE Vector Graphic - Stroke"){ solids.push(p); }
                        else if(mn==="ADBE Vector Group" || mn==="ADBE Vectors Group" || p.propertyType===PropertyType.NAMED_GROUP){
                            var inner=p.property("ADBE Vectors Group") || p; collect(inner);
                        }
                    }
                })(root);

                var grads=[];
                if(colorIsGradient){
                    for(var s=0;s<solids.length;s++){
                        var st=solids[s];
                        var parent=st.parentProperty;
                        var idx=st.propertyIndex;
                        var sw=null; try{ sw=st.property("ADBE Vector Stroke Width").value; }catch(_e){}
                        var gst=parent.addProperty("ADBE Vector Graphic - G-Stroke");
                        try{ parent.property(gst.propertyIndex).moveTo(idx); }catch(_e){}
                        try{ if(sw!==null) gst.property("ADBE Vector Stroke Width").setValue(sw); }catch(_e){}
                        try{ st.remove(); }catch(_e){}
                        grads.push(gst);
                    }
                    (function collectG(group){
                        for(var i=1;i<=group.numProperties;i++){
                            var p=group.property(i); if(!p) continue;
                            var mn=p.matchName;
                            if(mn==="ADBE Vector Graphic - G-Stroke"){ grads.push(p); }
                            else if(mn==="ADBE Vector Group" || mn==="ADBE Vectors Group" || p.propertyType===PropertyType.NAMED_GROUP){
                                var inner=p.property("ADBE Vectors Group") || p; collectG(inner);
                            }
                        }
                    })(root);
                }

                // Bind solids
                for(var s2=0; s2<solids.length; s2++){
                    var st2=solids[s2];
                    if(wantWidth){ try{ st2.property("ADBE Vector Stroke Width").expression = widthExpr; }catch(_e){} }
                    if(wantColor && !colorIsGradient){ try{ st2.property("ADBE Vector Stroke Color").expression = colorExpr; }catch(_e){} }
                    try{ st2.property("ADBE Vector Stroke Line Cap").expression  = capExpr; }catch(_e){}
                    try{ st2.property("ADBE Vector Stroke Line Join").expression = joinExpr; }catch(_e){}
                }
                // Bind gradients
                for(var g=0; g<grads.length; g++){
                    var gs=grads[g];
                    if(wantWidth){ try{ gs.property("ADBE Vector Stroke Width").expression = widthExpr; }catch(_e){} }
                    try{ gs.property("ADBE Vector Stroke Line Cap").expression  = capExpr; }catch(_e){}
                    try{ gs.property("ADBE Vector Stroke Line Join").expression = joinExpr; }catch(_e){}
                    if(colorIsGradient){
                        var gStartExpr='thisComp.layer("'+ctrlEsc+'").effect("Gradient Start")("Point")';
                        var gEndExpr  ='thisComp.layer("'+ctrlEsc+'").effect("Gradient End")("Point")';
                        try{ gs.property("ADBE Vector Grad Start Pt").expression = gStartExpr; }catch(_e){}
                        try{ gs.property("ADBE Vector Grad End Pt").expression   = gEndExpr;   }catch(_e){}
                    }
                }
            }

            // Scale linkage
            if(wantScale && selectedScaleProp){
                var baseVal, is3D=false; try{ baseVal=selectedScaleProp.value; is3D=(baseVal && baseVal.length===3); }catch(_e){}
                var scaleExpr='ctrl=thisComp.layer("'+ctrlEsc+'");\nflip=ctrl.effect("Flip X")("Checkbox");\ns=ctrl.effect("Scale")("Slider");\n'
                             +(is3D?'[flip==1?-s:s, s, s]':'[flip==1?-s:s, s]');
                try{ selectedScaleProp.expression=scaleExpr; }catch(_e){}
            }

            // EGP tokens
            var tokens=[];
            if(wantScale && scaleEff) tokens.push(makeToken(ctrlLayer.name, scaleEff.name));
            if(wantScale && flipEff ) tokens.push(makeToken(ctrlLayer.name, flipEff.name));
            if(wantWidth && widthEff) tokens.push(makeToken(ctrlLayer.name, widthEff.name));
            if(wantWidth && cswEff ) tokens.push(makeToken(ctrlLayer.name, cswEff.name));
            tokens.push(makeToken(ctrlLayer.name, "Stroke Cap and Join"));
            if(!colorIsGradient){
                if(wantColor && colorEff) tokens.push(makeToken(ctrlLayer.name, colorEff.name));
            }else{
                if(gradStartEff) tokens.push(makeToken(ctrlLayer.name, gradStartEff.name));
                if(gradEndEff)   tokens.push(makeToken(ctrlLayer.name, gradEndEff.name));
            }
            if(wantEGP && tokens.length>0){ pushTokensToEGP(comp, tokens, true); }

            alert("Done.");
        }catch(err){ if(err!=="Cancelled") alert("Error: "+err.toString()); }
        finally{ app.endUndoGroup(); }
    };

    // Add selected properties → EGP
	// Add ALL effects from the currently selected layer → EGP
	addAllFromLayerBtn.onClick = function(){
		var comp = getActiveComp();
		if(!comp){ alert("Open a comp and select a layer."); return; }

		var sel = comp.selectedLayers || [];
		if(sel.length !== 1){
			alert("Select exactly one layer to send all its effects to Essential Graphics.");
			return;
		}
		var layer = sel[0];
		var parade = layer.property("ADBE Effect Parade");
		if(!parade || parade.numProperties === 0){
			alert("No effects found on the selected layer.");
			return;
		}

		// Build tokens for every effect on this layer, in order
		var tokens = [];
		for (var i = 1; i <= parade.numProperties; i++){
			var ef = parade.property(i);
			if(ef) tokens.push( makeToken(layer.name, ef.name) );
		}
		if(tokens.length === 0){
			alert("No effects found on the selected layer.");
			return;
		}

		app.beginUndoGroup("EGP: Add all effects from layer");
		try{
			// Reuses your proven pipeline: opens EG panel, ensures MOGRT name, adds props.
			pushTokensToEGP(comp, tokens, /*ensureSelectLayer*/ true);
		}catch(err){
			alert("Error: " + err.toString());
		}finally{
			app.endUndoGroup();
		}
	};

    addSelectedBtn.onClick=function(){
        var comp=getActiveComp();
        if(!comp){ alert("Open a comp and select properties."); return; }
        prepEGP(comp, true);
        if(comp.selectedLayers.length===0){ alert("Please select layers."); return; }
        if(!comp.selectedProperties || comp.selectedProperties.length===0){ alert("Please select properties."); return; }

        app.beginUndoGroup("Add properties to EGP");
        try{
            for(var p=comp.selectedProperties.length-1; p>=0; p--){
                var prop = comp.selectedProperties[p];
                if(prop.propertyType !== PropertyType.PROPERTY) continue;
                try{
                    if(prop.canAddToMotionGraphicsTemplate && prop.canAddToMotionGraphicsTemplate(comp)){
                        prop.addToMotionGraphicsTemplate(comp);
                    }else{
                        prop.addToMotionGraphicsTemplate(comp);
                    }
                }catch(_e){}
            }
        }catch(err){ alert("Error: "+err.toString()); }
        finally{ app.endUndoGroup(); }
    };

    // Reset UI
    resetBtn.onClick=function(){
        var d=new Window("dialog","Reset UI?"); d.orientation="column"; d.alignChildren=["fill","top"]; d.margins=16; d.spacing=10;
        d.add("statictext", undefined, "Revert to defaults? You will lose current values.", {multiline:true});
        var row=d.add("group"); row.alignment=["center","center"];
        var ok=row.add("button", undefined, "Revert", {name:"ok"});
        var cancel=row.add("button", undefined, "Cancel", {name:"cancel"});
        d.center(); if(d.show()!==1) return;

        createControllersChk.value=true; createName.text="CTRL_EGP";
        widthCheckbox.value=true; defaultValueField.text="6"; widthNameField.text="Stroke Width"; strokeTypeDD.selection=0;
        consistentWidthChk.value=true;
        colorCheckbox.value=true; colorModeDD.selection=0; currentColor=[1,1,1]; saveColor(currentColor); repaintSwatch(); setStrokeColorUIEnabled(true);
        scaleCheckbox.value=true; syncScaleSection();
        egpCheckbox.value=true;  syncEGPSection();
        setStrokeWidthUIEnabled(true);
    };

    // Resizing (no jitter)
    topBar.onResizing=topBar.onResize=function(){ this.layout.resize(); };
    win.onResizing=win.onResize=function(){ this.layout.resize(); };

    return win;
}

var ui=buildUI(thisObj);
if(ui instanceof Window){ ui.center(); ui.show(); }

})(this);
