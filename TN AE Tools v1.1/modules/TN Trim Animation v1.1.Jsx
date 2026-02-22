/* TN Trim Animation v1.1 */

﻿/* Trim Animation (C¹ Overshoot) — UI + Wiggle Path (added)
   - KEEPING YOUR WORKING v1.3 FUNCTIONALITY INTACT
   - Effects layout and names remain EXACTLY as in your approved build (no changes)
   - Adds optional Wiggle Path operator on the same target groups/layers
     (NO new timeline effects are created for wiggle — avoids changing your effects stack)

   Defaults (from your approved preview):
     Marker +0.35s
     IN: 1.00s, IN In=33, IN Out=50
     Start: P=42, Dur=0.50s, EaseIn=33, EaseOut=50
     Overshoot: Len=147%, Amt=8%, Pre-roll=33%, Pointiness=1.5
     OUT: 1.00s, EaseIn=21, EaseOut=25
     Anticipation: Len=25% of OUT, Amt=8%

   Wiggle Path (new, UI-only; parameters written directly to Roughen Paths operator):
     Enable (default OFF), Size, Detail, Points (Corner/Smooth), Wiggles/Second
*/

(function(thisObj){

/* ------------ UI ------------ */
function buildUI(thisObj){
  var w = (thisObj instanceof Panel) ? thisObj : new Window("palette","TN Trim Animation v1.1",undefined,{resizeable:true});

  var pad = 10, colW = 120, valW = 50, gap = 12;
  w.margins = 10;

  var titleBar = w.add("group"); titleBar.alignment = ["fill","top"];
  titleBar.add("statictext", undefined, "TN Trim Animation v1.1").graphics.font = ScriptUI.newFont("Segoe UI", "BOLD", 14);
  titleBar.add("statictext", undefined, ""); titleBar.children[1].alignment = ["fill","fill"]; // spacer
  var helpBtn = titleBar.add("button", undefined, "?"); helpBtn.preferredSize=[28,22]; helpBtn.minimumSize=[28,22]; helpBtn.maximumSize=[28,22];
  helpBtn.alignment=["right","center"];

  /* container */
  var p = w.add("group"); p.orientation="column"; p.alignment=["fill","fill"]; p.alignChildren=["fill","top"];

  function section(label){
    var g = p.add("panel", undefined, label); g.alignment=["fill","top"]; g.margins = 12; g.spacing = 8;
    g.graphics.backgroundColor = g.graphics.newBrush(g.graphics.BrushType.SOLID_COLOR, [0.12,0.12,0.12,1]);
    return g;
  }
	function row2(parent, l1, d1, l2, d2){
	  var g = parent.add("group");
	  g.orientation   = "row";
	  g.margins       = 0;
	  g.spacing       = gap;                 // gap between the two pairs
	  g.alignChildren = ["left","center"];
	  g.alignment     = ["left","top"];      // no fill so it won’t stretch

	  function pair(lbl, defVal){
		var h = g.add("group");
		h.orientation   = "row";
		h.margins       = 0;
		h.spacing       = 6;                 // label↔input gap
		h.alignChildren = ["left","center"];

		var st = h.add("statictext", undefined, lbl);
		st.minimumSize = [colW, 20];
		st.maximumSize = [colW, 20];

		var ed = h.add("edittext", undefined, defVal);
		ed.minimumSize = [valW, 20];
		ed.maximumSize = [valW, 20];
		return ed;
	  }

	  // always make the left pair
	  var e1 = pair(l1, d1);

	  // only make the right pair if l2 has non-whitespace text
	  var e2 = null;
	  if (l2 && String(l2).replace(/\s+/g,"").length){
		e2 = pair(l2, d2);
	  }

	  // keep your return shape so existing code still works
	  return { left: e1, right: e2, e1: e1, e2: e2 };
	}


  // End / IN
  var sIN = section("End");
  sIN.add("statictext", undefined, "Animate IN").enabled=false;
  var rIN1 = row2(sIN, "IN (sec)", "1", " ", "");
  var rIN2 = row2(sIN, "Ease In (IN)", "33", "Ease Out (IN)", "50");

  // Start IN
  var sST = section("Start");
  sST.add("statictext", undefined, "Animate IN").enabled=false;
  var rST1 = row2(sST, "Percentage (%)", "42", "Len (% of Start)", "147");
  var rST2 = row2(sST, "Preroll (% Len)", "33", "Overshoot  Amt. (%)", "8");
  var rST3 = row2(sST, "Pointiness α (0.5–1.5)", "1.5", " ", "");
  var rST4 = row2(sST, "Ease In (Start)", "33", "Ease Out (Start)", "50");

  // Start OUT (merged into Start — no separate panel, no label)
  sST.add("statictext", undefined, "Animate OUT").enabled=false;
  var rO1 = row2(sST, "OUT (sec)", "1.00", " ", "");
  var rO2 = row2(sST, "Len (% of OUT)", "25", "Anticipation  Amt. (%)", "8");
  var rO3 = row2(sST, "Ease In (OUT)", "21", "Ease Out (OUT)", "25");


	// Wiggle path (NEW) — UI-only controls (no extra timeline effects)
	var sW = section("Wiggle path");

	// enable
	var wigEnableRow = sW.add("group");
	wigEnableRow.alignment = ["left","top"];
	var wigEnable = wigEnableRow.add("checkbox", undefined, "Add wiggle path");
	wigEnable.value = true;

	// Size / Detail (your row2)
	var rW1 = row2(sW, "Size", "5", "Detail", "1");

	// Points / Wiggles — tighter, no stretching wrappers
	var rW2 = sW.add("group");
	rW2.orientation = "row";
	rW2.alignment   = ["left","top"];  // was ["fill","top"]
	rW2.margins     = 0;
	rW2.spacing     = gap;

	// --- Left pair: Points (fixed total width = colW + valW) ---
	var rW2A = rW2.add("group");
	rW2A.orientation   = "row";
	rW2A.margins       = 0;
	rW2A.spacing       = 6;
	rW2A.alignChildren = ["left","center"];

	// how much extra width to give the dropdown (extends left)
	var extra = 30;                         // tweak 20–40 to taste
	var lblW  = Math.max(40, colW - extra); // don't let label get too tiny
	var ddW   = valW + (colW - lblW);       // ensures lblW + ddW == colW + valW

	// label loses 'extra' width
	var lbPts = rW2A.add("statictext", undefined, "Points");
	lbPts.minimumSize = [lblW, 20];
	lbPts.maximumSize = [lblW, 20];

	// dropdown gains the same width; right edge stays aligned with Size
	var wigPoints = rW2A.add("dropdownlist", undefined, ["Corner","Smooth"]);
	wigPoints.selection   = 1;              // Smooth
	wigPoints.minimumSize = [ddW, 20];
	wigPoints.maximumSize = [ddW, 20];



	// right pair: Wiggles/Sec.
	var rW2B = rW2.add("group");
	rW2B.orientation = "row";
	rW2B.margins     = 0;
	rW2B.spacing     = 6;
	rW2B.alignment   = ["left","top"];
	// no fixed wrapper width here either
	rW2B.minimumSize = [0, 0];
	rW2B.maximumSize = [9999, 20];

	var lbFreq = rW2B.add("statictext", undefined, "Wiggles/Sec.");
	lbFreq.minimumSize = [colW, 20];
	lbFreq.maximumSize = [colW, 20];
	var wigFreq = rW2B.add("edittext", undefined, "2");
	wigFreq.minimumSize = [valW, 20];
	wigFreq.maximumSize = [valW, 20];


  // Effects target (UNCHANGED): default to Layer
	var sFX = section("Add effects");
	sFX.alignChildren = ["left","center"];        // keep items left inside the panel
	var radios = sFX.add("group");
	radios.orientation = "row";
	radios.spacing = 24;
	radios.alignment = ["left","center"];         // group anchored left
  var toNull = radios.add("radiobutton", undefined, "to Null");
  var toLayer = radios.add("radiobutton", undefined, "to Layer"); toLayer.value = true;

  // Apply button
  var applyRow = w.add("group"); applyRow.alignment=["fill","bottom"]; applyRow.margins=0; applyRow.add("statictext",undefined,"");
  var applyBtn = applyRow.add("button", undefined, "Apply"); applyBtn.alignment = ["center","bottom"];

  // Help
  var helpWin;
  helpBtn.onClick = function(){
    if (helpWin && helpWin.visible){ helpWin.close(); return; }
    helpWin = new Window("palette","Help",undefined,{resizeable:false});
    var txt = helpWin.add("statictext", undefined,
      "• IN animates Trim End 0→100 over IN seconds (its own eases).\n"+
      "• Start animates Trim Start: 0→P over Duration with your eases.\n"+
      "  Overshoot is blended with a C¹ crossfade using Pre-roll%.\n"+
      "• OUT uses OUT eases; Anticipation Len% is of OUT.\n"+
      "• Works on selected shape groups; if none, all top-level groups.\n"+
      "• Wiggle Path (optional) adds a Roughen Paths operator to the same groups.\n"+
      "• 'to Null' creates an empty Shape controller and puts TRIM controls there (wiggle has no effects).",
      {multiline:true});
    txt.maximumSize.width = 420; helpWin.layout.layout(true);
    helpWin.show();
  };

  // Expose values
  w.values = function(){
    function f(e){ return parseFloat(e.text); }
    return {
      INs: f(rIN1.left), easeInIN: f(rIN2.left), easeOutIN: f(rIN2.right),
      P: f(rST1.left), overLen: f(rST1.right),
      preRoll: f(rST2.left), overAmt: f(rST2.right),
      alpha: f(rST3.left),
      easeInStart: f(rST4.left), easeOutStart: f(rST4.right),
      DUR: 0.50, // lock to UI default as per your screenshot
      OUTs: f(rO1.left), antLen: f(rO2.left), antAmt: f(rO2.right),
      easeInOUT: f(rO3.left), easeOutOUT: f(rO3.right),
      toNull: toNull.value,

      // Wiggle
      wigEnable: wigEnable.value,
      wigSize: f(rW1.left),
      wigDetail: f(rW1.right),
      wigPointsIndex: (wigPoints.selection ? wigPoints.selection.index : 1) + 1, // 1 Corner, 2 Smooth
      wigFreq: f(wigFreq)
    };
  };
  w.onResizing = w.onResize = function(){ w.layout.resize(); };

  w.applyBtn = applyBtn;
  return w;
}

/* --------- AE logic (UNCHANGED TRIM; ONLY WIGGLE ADDED) --------- */

function selectedVectorGroupsOnLayer(layer){
  var arr = [];
  var sel = layer.selectedProperties;
  for (var i=0;i<sel.length;i++){
    var p = sel[i];
    if (p instanceof PropertyGroup && p.matchName === "ADBE Vector Group") arr.push(p);
  }
  return arr;
}
function topLevelVectorGroups(layer){
  var out = [];
  var contents = layer.property("ADBE Root Vectors Group");
  if (!contents) return out;
  for (var i=1;i<=contents.numProperties;i++){
    var p = contents.property(i);
    if (p.matchName === "ADBE Vector Group") out.push(p);
  }
  return out;
}
function ensureTrim(group){
  var contents = group.property("ADBE Vectors Group");
  for (var i=1;i<=contents.numProperties;i++){
    var p = contents.property(i);
    if (p.matchName === "ADBE Vector Filter - Trim") return p;
  }
  return contents.addProperty("ADBE Vector Filter - Trim");
}
// NEW: ensure Wiggle Paths operator on a Vector Group
function ensureWigglePaths(group){
  var contents = group.property("ADBE Vectors Group");
  for (var i=1;i<=contents.numProperties;i++){
    var p = contents.property(i);
    if (p.matchName === "ADBE Vector Filter - Roughen") return p; // Wiggle Paths
  }
  var wp = contents.addProperty("ADBE Vector Filter - Roughen");
  wp.name = "Wiggle Paths";
  return wp;
}

function q(s){ return s.replace(/\\/g,"\\\\").replace(/\"/g,'\\"'); }

function addSlider(ctrls, name, defVal){
  var s = ctrls.addProperty("ADBE Slider Control");
  s.name = name; s.property(1).setValue(defVal);
  return s;
}
function addSep(ctrls,label){
  var s = ctrls.addProperty("ADBE Slider Control");
  s.name = "──────── " + label + " ────────";
  s.enabled=false; s.property(1).setValue(0); return s;
}

function createController(comp){
  var L = comp.layers.addShape();
  L.name = "_TrimAnim_CTRL";
  // make it invisible
  var gp = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
  gp.name="Ctrl";
  gp.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
  L.enabled = false; // off in timeline
  return L;
}

function buildStartExpr(prefix, useCtrl, ctrlName){
  var tgt = useCtrl ? ('thisComp.layer("'+q(ctrlName)+'")') : 'thisLayer';
  var fx = 'effect("';
  var pfx = function(n){ return tgt + "." + fx + q(n + prefix) + '")("Slider")'; };

  var EXP =
'function clamp01(x){return Math.max(0,Math.min(1,x));}\n'+
'function easeSmooth01(t,ein,eout){t=clamp01(t);var a=1+4*clamp01(ein/100);var b=1+4*clamp01(eout/100);if(t<0.5)return 0.5*Math.pow(2*t,a);return 1-0.5*Math.pow(2*(1-t),b);} \n'+
'function smoothstep(n){n=clamp01(n);return n*n*(3-2*n);} \n'+
'function bump01(n,a){n=Math.pow(clamp01(n),a);return Math.min(1,Math.max(0,(27/4)*n*Math.pow(1-n,2)));}\n'+

'var P='+pfx("Percentage (%)")+';\n'+
'var DUR='+pfx("Duration (sec)")+';\n'+
'var einS='+pfx("Ease In (Start)")+';\n'+
'var eoutS='+pfx("Ease Out (Start)")+';\n'+
'var overLen='+pfx("Overshoot Len (%)")+';\n'+
'var overAmt='+pfx("Overshoot Amt (%)")+';\n'+
'var preRoll='+pfx("Overshoot Pre-roll (%)")+';\n'+
'var alpha='+pfx("Pointiness α")+';\n'+
'var OUTs='+pfx("OUT (sec)")+';\n'+
'var einO='+pfx("Ease In (OUT)")+';\n'+
'var eoutO='+pfx("Ease Out (OUT)")+';\n'+
'var antLen='+pfx("Anticipation Len (%)")+';\n'+
'var antAmt='+pfx("Anticipation Amt (%)")+';\n'+

'var m=(marker.numKeys>0)?marker.key(1).time:inPoint+0.35;\n'+
'var inP=inPoint; var outP=outPoint;\n'+

'var S0=m; var S1=m+Math.max(1e-6,DUR);\n'+
'var overT=Math.max(0,(overLen/100)*DUR);\n'+
'var gamma=Math.max(0,Math.min(1,preRoll/100));\n'+
'var O0=S1-gamma*overT; var O1=S1+(1-gamma)*overT;\n'+
'var B1=outP; var B0=Math.max(inP,B1-Math.max(0,OUTs));\n'+
'var antT=Math.max(0,(antLen/100)*OUTs);\n'+
'var A1=B0; var A0=Math.max(inP,A1-antT);\n'+

'var peakOver=P+(100-P)*(overAmt/100);\n'+
'var dipAnt=P-P*(antAmt/100);\n'+

'function baseVal(t){ if(t<=S0) return 0; if(t<S1){var n=(t-S0)/Math.max(1e-6,S1-S0); return easeSmooth01(n,einS,eoutS)*P;} return P; }\n'+
'function bumpTrack(t){ if(t<O0||t>O1) return P; var n=(t-O0)/Math.max(1e-6,O1-O0); return P+bump01(n,alpha)*(peakOver-P); }\n'+
'function weightW(t){ if(t<=O0) return 0; if(t<S1){return smoothstep((t-O0)/Math.max(1e-6,S1-O0));} if(t<=O1) return 1; return 0; }\n'+

'var t=time; var y;\n'+
'if(t<A0){ var base=baseVal(t); var bump=bumpTrack(t); var w=weightW(t); y=(1-w)*base+w*bump; }\n'+
'else if(t<A1){ var n=(t-A0)/Math.max(1e-6,A1-A0); y=P+easeSmooth01(n,einO,eoutO)*(dipAnt-P); }\n'+
'else if(t<B1){ var n=(t-B0)/Math.max(1e-6,B1-B0); y=dipAnt+easeSmooth01(n,einO,eoutO)*(100-dipAnt); }\n'+
'else{ y=100; }\n'+
'y;';

  return EXP;
}

function buildEndExpr(useCtrl, ctrlName){
  var tgt = useCtrl ? ('thisComp.layer("'+q(ctrlName)+'")') : 'thisLayer';
  function pfx(n){ return tgt + '.effect("'+ q(n) +'")("Slider")'; }

  var EXP =
'function clamp01(x){return Math.max(0,Math.min(1,x));}\n' +
'function easeSmooth01(t,ein,eout){t=clamp01(t);var a=1+4*clamp01(ein/100);var b=1+4*clamp01(eout/100);if(t<0.5){return 0.5*Math.pow(2*t,a);}return 1-0.5*Math.pow(2*(1-t),b);} \n' +
'var INs=' + pfx('IN (sec)') + ';\n' +
'var einIN=' + pfx('Ease In (IN)') + ';\n' +
'var eoutIN=' + pfx('Ease Out (IN)') + ';\n' +
'var t0=inPoint; var t1=t0+Math.max(1e-6,INs);\n' +
'var t=time; var y;\n' +
'if (t<=t0){ y=0; }\n' +
'else if (t>=t1){ y=100; }\n' +
'else { var n=(t-t0)/(t1-t0); y=easeSmooth01(n,einIN,eoutIN)*100; }\n' +
'y;';
  return EXP;
}


/* Apply */
function apply(values){
  app.beginUndoGroup("Trim Animation UI (C1) + Wiggle Path");

  var comp = app.project.activeItem;
  if (!(comp && comp instanceof CompItem)){ alert("Open a comp and select shape layers/groups."); app.endUndoGroup(); return; }

  // Choose effect target (layer or controller) — UNCHANGED
  var ctrlLayer = null, ctrlName = "_TrimAnim_CTRL";
  var useCtrl = values.toNull;
  if (useCtrl){
    // reuse if exists
    for (var i=1;i<=comp.numLayers;i++){
      if (comp.layer(i).name === ctrlName){ ctrlLayer = comp.layer(i); break; }
    }
    if (!ctrlLayer) ctrlLayer = createController(comp);
  }

  // function to add the full control set onto a layer (either the target layer or the controller)
  function ensureControls(hostLayer, suffix){
    var ctrls = hostLayer.property("ADBE Effect Parade");
    if (!ctrls) return;

    // End IN (shared once on hostLayer)
    if (!ctrls.property("IN (sec)")){
      addSep(ctrls,"End IN");
      addSlider(ctrls,"IN (sec)", values.INs);
      addSlider(ctrls,"Ease In (IN)", values.easeInIN);
      addSlider(ctrls,"Ease Out (IN)", values.easeOutIN);
    }
    // Start IN
    addSep(ctrls,"Start IN"+suffix);
    addSlider(ctrls,"Percentage (%)"+suffix, values.P);
    addSlider(ctrls,"Duration (sec)"+suffix, 0.50);
    addSlider(ctrls,"Ease In (Start)"+suffix, values.easeInStart);
    addSlider(ctrls,"Ease Out (Start)"+suffix, values.easeOutStart);

    // Start IN Overshoot
    addSep(ctrls,"Start IN Overshoot"+suffix);
    addSlider(ctrls,"Overshoot Len (%)"+suffix, values.overLen);
    addSlider(ctrls,"Overshoot Amt (%)"+suffix, values.overAmt);
    addSlider(ctrls,"Overshoot Pre-roll (%)"+suffix, values.preRoll);
    addSlider(ctrls,"Pointiness α"+suffix, values.alpha);
	
	// Start OUT Anticipation
    addSep(ctrls,"Start OUT Anticipation"+suffix);
    addSlider(ctrls,"Anticipation Len (%)"+suffix, values.antLen);
    addSlider(ctrls,"Anticipation Amt (%)"+suffix, values.antAmt);

    // Start OUT
    addSep(ctrls,"Start OUT"+suffix);
    addSlider(ctrls,"OUT (sec)"+suffix, values.OUTs);
    addSlider(ctrls,"Ease In (OUT)"+suffix, values.easeInOUT);
    addSlider(ctrls,"Ease Out (OUT)"+suffix, values.easeOutOUT);
	
	// ──────── Wiggle Path ────────
	addSep(ctrls, "Wiggle Path");
	addSlider(ctrls, "Detail" + suffix, values.wigDetail);          // default 1
	addSlider(ctrls, "Size" + suffix, values.wigSize);               // default 5
	addSlider(ctrls, "Wiggles/Second" + suffix, values.wigFreq);     // default 2

  }

  var any=false;

  for (var i=0;i<comp.selectedLayers.length;i++){
    var L = comp.selectedLayers[i];
    if (L.matchName !== "ADBE Vector Layer") continue;

    any=true;

    // marker default
    if (L.property("Marker").numKeys === 0){
      var mk = new MarkerValue("Trim Start");
      L.property("Marker").setValueAtTime(L.inPoint + 0.35, mk);
    }

    var groupsSel = selectedVectorGroupsOnLayer(L);
    var targets = (groupsSel.length>0) ? groupsSel : topLevelVectorGroups(L);

    for (var g=0; g<targets.length; g++){
      var grp = targets[g];
      var trim = ensureTrim(grp);
      var suffix = (groupsSel.length>0) ? " ("+grp.name+")" : "";

      // where to host controls
      var host = useCtrl ? ctrlLayer : L;
      ensureControls(host, suffix);

      // expressions (UNCHANGED)
      trim.property("ADBE Vector Trim Start").expression = buildStartExpr(suffix, useCtrl, ctrlName);
      trim.property("ADBE Vector Trim End").expression   = buildEndExpr(useCtrl, ctrlName);

	// ---- WIGGLE PATH (NEW) ----
	if (values.wigEnable) {
	  // 1) Ensure the operator
	  var wp = ensureWigglePaths(grp); // matchName "ADBE Vector Filter - Roughen", display "Wiggle Paths"

	  // 2) Resolve the same host you use for other controls (layer or controller)
	  var host = useCtrl ? ctrlLayer : L;

	  // 3) Read the three EFFECT sliders you added (respect per-group suffix)
	  var fxDetail = host.effect("Detail" + suffix);
	  var fxSize   = host.effect("Size" + suffix);
	  var fxFreq   = host.effect("Wiggles/Second" + suffix);

	  // 4) Fallbacks on first run (if effects were just created or missing)
	  var kDetail = fxDetail ? Number(fxDetail(1).value) : Number(values.wigDetail);
	  var kSize   = fxSize   ? Number(fxSize(1).value)   : Number(values.wigSize);
	  var kFreq   = fxFreq   ? Number(fxFreq(1).value)   : Number(values.wigFreq);

	  // 5) Points comes from the UI dropdown (1=Corner, 2=Smooth)
	  //    If you later expose it as an effect too, read it the same way as above.
	  var kPoints = Math.max(1, Math.min(2, Number(values.wigPointsIndex || 2)));

	  // 6) Apply to Wiggle Paths properties
	  var pSize   = wp.property("ADBE Vector Roughen Size");
	  var pDetail = wp.property("ADBE Vector Roughen Detail");
	  var pPoints = wp.property("ADBE Vector Roughen Points");
	  var pFreq   = wp.property("ADBE Vector Roughen Wiggles Per Second");
	  var pTemp   = wp.property("ADBE Vector Roughen Temporal");

	// -- bind Wiggle Paths to EFFECT sliders via expressions --
	var hostName = host.name;

	// helper to bind a property to an effect slider on host (with safe fallback)
	function bindToSlider(prop, effectLabel){
	  if (!prop) return;
	  var expr =
		'var L = thisComp.layer("' + q(hostName) + '");\n' +
		'try { L.effect("' + q(effectLabel) + '")("Slider"); } catch (e) { value; }';
	  if (prop.canSetExpression === true) {
		prop.expression = expr;
	  } else {
		try { var fx = host.effect(effectLabel); if (fx) prop.setValue(fx(1).value); } catch (_){}
	  }
	}

	// bind to effect sliders (respect suffix)
	bindToSlider(pDetail, "Detail" + suffix);
	bindToSlider(pSize,   "Size" + suffix);
	bindToSlider(pFreq,   "Wiggles/Second" + suffix);

	// keep temporal on; points from UI (unless you add a slider later)
	if (pTemp) pTemp.setValue(1);
	if (pPoints) pPoints.setValue(Math.max(1, Math.min(2, Number(values.wigPointsIndex || 2))));

	  if (pPoints) pPoints.setValue(kPoints);   // <-- ensures "Smooth" is respected
	  if (pTemp)   pTemp.setValue(1);           // time-based

	} else {
	  // (keep your existing neutralize block unchanged)
	  var contents = grp.property("ADBE Vectors Group");
	  for (var ri = 1; ri <= contents.numProperties; ri++) {
		var rp = contents.property(ri);
		if (rp.matchName === "ADBE Vector Filter - Roughen") {
		  var s = rp.property("ADBE Vector Roughen Size"); if (s) s.setValue(0);
		  var f = rp.property("ADBE Vector Roughen Wiggles Per Second"); if (f) f.setValue(0);
		}
	  }
	}
	// ---- END WIGGLE ----


    }
  }

  if (!any) alert("Select at least one Shape Layer or Shape Group.");
  app.endUndoGroup();
}

/* boot */
var ui = buildUI(thisObj);
ui.applyBtn.onClick = function(){ apply(ui.values()); };
if (ui instanceof Window) ui.center(), ui.show();

})(this);
