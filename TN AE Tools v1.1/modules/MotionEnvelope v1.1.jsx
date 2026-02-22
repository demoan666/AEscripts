/*
Motion Envelope - After Effects Script
Version 5.0 - Manual FFX Application
User applies MotionEnvelope.ffx manually, script generates expressions only
*/

(function(thisObj) {
    "use strict";
    
    var SCRIPT_NAME = "Motion Envelope";
    var VERSION = "5.0";
    var EFFECT_NAME = "Motion Envelope";
    
    var settings = {
        position: false,
        scale: false,
        rotation: false,
        opacity: false
    };
    
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", SCRIPT_NAME + " v" + VERSION, undefined, {resizeable: true});
        
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 10;
        win.margins = 16;
        
        // Instructions
        var instrGroup = win.add("group");
        instrGroup.orientation = "column";
        instrGroup.alignChildren = "left";
        
        var instr1 = instrGroup.add("statictext", undefined, "1. Apply MotionEnvelope.ffx to layer manually");
        instr1.graphics.font = ScriptUI.newFont(instr1.graphics.font.name, ScriptUI.FontStyle.ITALIC, 11);
        
        var instr2 = instrGroup.add("statictext", undefined, "2. Select properties to animate:");
        instr2.graphics.font = ScriptUI.newFont(instr2.graphics.font.name, ScriptUI.FontStyle.ITALIC, 11);
        
        // Property checkboxes
        var propGroup = win.add("panel", undefined, "Animate Properties");
        propGroup.orientation = "column";
        propGroup.alignChildren = "left";
        propGroup.spacing = 8;
        propGroup.margins = 12;
        
        var posCheck = propGroup.add("checkbox", undefined, "Position");
        var scaleCheck = propGroup.add("checkbox", undefined, "Scale");
        var rotCheck = propGroup.add("checkbox", undefined, "Rotation");
        var opaCheck = propGroup.add("checkbox", undefined, "Opacity");
        
        // Buttons
        var btnGroup = win.add("group");
        btnGroup.orientation = "row";
        btnGroup.alignChildren = ["center", "center"];
        btnGroup.spacing = 10;
        
        var applyBtn = btnGroup.add("button", undefined, "Apply Expressions");
        applyBtn.preferredSize.width = 140;
        
        var removeBtn = btnGroup.add("button", undefined, "Remove All");
        removeBtn.preferredSize.width = 100;
        
        // Events
        applyBtn.onClick = function() {
            settings.position = posCheck.value;
            settings.scale = scaleCheck.value;
            settings.rotation = rotCheck.value;
            settings.opacity = opaCheck.value;
            
            if (!settings.position && !settings.scale && !settings.rotation && !settings.opacity) {
                alert("Please select at least one property to animate.");
                return;
            }
            
            applyExpressions();
        };
        
        removeBtn.onClick = function() {
            removeExpressions();
        };
        
        win.onResizing = win.onResize = function() {
            this.layout.resize();
        };
        
        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
        }
        
        return win;
    }
    
    function findMotionEnvelopeEffect(layer) {
        try {
            for (var i = 1; i <= layer.Effects.numProperties; i++) {
                var fx = layer.Effects.property(i);
                if (fx.name.indexOf("Motion Envelope") !== -1) {
                    return fx;
                }
            }
        } catch (e) {}
        return null;
    }
    
    function generatePositionExpression(layer, effect) {
        var expr = "";
        
        expr += "// Motion Envelope - Position\n";
        expr += "function normalizeAngle(angle) {\n";
        expr += "  return ((angle % 360) + 360) % 360;\n";
        expr += "}\n\n";
        
        expr += "var fx = effect(\"" + EFFECT_NAME + "\");\n";
        expr += "var restPos = value;\n";
        expr += "var layerIn = inPoint;\n";
        expr += "var layerOut = outPoint;\n\n";
        
        expr += "var posInEnabled = fx(\"Position\")(\"Position IN\")(\"Enable\")(1);\n";
        expr += "var posOutEnabled = fx(\"Position\")(\"Position OUT\")(\"Enable\")(1);\n\n";
        
        expr += "if (posInEnabled == 0 && posOutEnabled == 0) {\n";
        expr += "  restPos;\n";
        expr += "} else {\n";
        expr += "  var globalInDur = fx(\"Global Settings\")(\"IN Duration (sec)\").value;\n";
        expr += "  var globalOutDur = fx(\"Global Settings\")(\"OUT Duration (sec)\").value;\n\n";
        
        expr += "  var inDur = fx(\"Position\")(\"Position IN\")(\"Duration (sec)\").value;\n";
        expr += "  var outDur = fx(\"Position\")(\"Position OUT\")(\"Duration (sec)\").value;\n";
        expr += "  if (inDur == 0) inDur = globalInDur;\n";
        expr += "  if (outDur == 0) outDur = globalOutDur;\n\n";
        
        expr += "  var holdDuration = Math.max(0, (layerOut - layerIn) - inDur - outDur);\n";
        expr += "  var t = time - layerIn;\n";
        expr += "  var result = restPos;\n\n";
        
        expr += "  if (posInEnabled && t >= 0 && t <= inDur) {\n";
        expr += "    var progress = t / inDur;\n";
        expr += "    var angle = fx(\"Position\")(\"Position IN\")(\"Direction IN\").value;\n";
        expr += "    var distance = fx(\"Position\")(\"Position IN\")(\"Distance (px)\").value;\n";
        expr += "    var normalAngle = normalizeAngle(angle);\n";
        expr += "    var angleRad = (normalAngle * Math.PI) / 180;\n";
        expr += "    var offsetX = distance * Math.cos(angleRad);\n";
        expr += "    var offsetY = distance * Math.sin(angleRad);\n";
        expr += "    var startPos = [restPos[0] - offsetX, restPos[1] - offsetY];\n";
        expr += "    result = [startPos[0] + (restPos[0] - startPos[0]) * progress, startPos[1] + (restPos[1] - startPos[1]) * progress];\n";
        expr += "  }\n\n";
        
        expr += "  else if (t > inDur && t < inDur + holdDuration) {\n";
        expr += "    result = restPos;\n";
        expr += "  }\n\n";
        
        expr += "  else if (posOutEnabled && t >= inDur + holdDuration) {\n";
        expr += "    var outProgress = Math.min(1, (t - inDur - holdDuration) / outDur);\n";
        expr += "    var angle = fx(\"Position\")(\"Position OUT\")(\"Direction OUT\").value;\n";
        expr += "    var distance = fx(\"Position\")(\"Position OUT\")(\"Distance (px)\").value;\n";
        expr += "    var normalAngle = normalizeAngle(angle);\n";
        expr += "    var angleRad = (normalAngle * Math.PI) / 180;\n";
        expr += "    var offsetX = distance * Math.cos(angleRad);\n";
        expr += "    var offsetY = distance * Math.sin(angleRad);\n";
        expr += "    var endPos = [restPos[0] + offsetX, restPos[1] + offsetY];\n";
        expr += "    result = [restPos[0] + (endPos[0] - restPos[0]) * outProgress, restPos[1] + (endPos[1] - restPos[1]) * outProgress];\n";
        expr += "  }\n\n";
        
        expr += "  result;\n";
        expr += "}";
        
        return expr;
    }
    
    function generateScaleExpression(layer, effect) {
        var expr = "";
        
        expr += "// Motion Envelope - Scale\n";
        expr += "var fx = effect(\"" + EFFECT_NAME + "\");\n";
        expr += "var restScale = value;\n";
        expr += "var layerIn = inPoint;\n";
        expr += "var layerOut = outPoint;\n\n";
        
        expr += "var scaleInEnabled = fx(\"Scale\")(\"Scale IN\")(\"Enable\")(1);\n";
        expr += "var scaleOutEnabled = fx(\"Scale\")(\"Scale OUT\")(\"Enable\")(1);\n\n";
        
        expr += "if (scaleInEnabled == 0 && scaleOutEnabled == 0) {\n";
        expr += "  restScale;\n";
        expr += "} else {\n";
        expr += "  var globalInDur = fx(\"Global Settings\")(\"IN Duration (sec)\").value;\n";
        expr += "  var globalOutDur = fx(\"Global Settings\")(\"OUT Duration (sec)\").value;\n\n";
        
        expr += "  var inDur = fx(\"Scale\")(\"Scale IN\")(\"Duration (sec)\").value;\n";
        expr += "  var outDur = fx(\"Scale\")(\"Scale OUT\")(\"Duration (sec)\").value;\n";
        expr += "  if (inDur == 0) inDur = globalInDur;\n";
        expr += "  if (outDur == 0) outDur = globalOutDur;\n\n";
        
        expr += "  var holdDuration = Math.max(0, (layerOut - layerIn) - inDur - outDur);\n";
        expr += "  var t = time - layerIn;\n";
        expr += "  var result = restScale;\n\n";
        
        expr += "  if (scaleInEnabled && t >= 0 && t <= inDur) {\n";
        expr += "    var progress = t / inDur;\n";
        expr += "    var fromPct = fx(\"Scale\")(\"Scale IN\")(\"From %\").value / 100;\n";
        expr += "    var fromScale = [fromPct * restScale[0], fromPct * restScale[1]];\n";
        expr += "    result = [fromScale[0] + (restScale[0] - fromScale[0]) * progress, fromScale[1] + (restScale[1] - fromScale[1]) * progress];\n";
        expr += "  }\n\n";
        
        expr += "  else if (t > inDur && t < inDur + holdDuration) {\n";
        expr += "    result = restScale;\n";
        expr += "  }\n\n";
        
        expr += "  else if (scaleOutEnabled && t >= inDur + holdDuration) {\n";
        expr += "    var outProgress = Math.min(1, (t - inDur - holdDuration) / outDur);\n";
        expr += "    var toPct = fx(\"Scale\")(\"Scale OUT\")(\"To %\").value / 100;\n";
        expr += "    var toScale = [toPct * restScale[0], toPct * restScale[1]];\n";
        expr += "    result = [restScale[0] + (toScale[0] - restScale[0]) * outProgress, restScale[1] + (toScale[1] - restScale[1]) * outProgress];\n";
        expr += "  }\n\n";
        
        expr += "  result;\n";
        expr += "}";
        
        return expr;
    }
    
    function generateRotationExpression(layer, effect) {
        var expr = "";
        
        expr += "// Motion Envelope - Rotation\n";
        expr += "var fx = effect(\"" + EFFECT_NAME + "\");\n";
        expr += "var restRot = value;\n";
        expr += "var layerIn = inPoint;\n";
        expr += "var layerOut = outPoint;\n\n";
        
        expr += "var rotInEnabled = fx(\"Rotate\")(\"Rotate IN\")(\"Enable\")(1);\n";
        expr += "var rotOutEnabled = fx(\"Rotate\")(\"Rotate OUT\")(\"Enable\")(1);\n\n";
        
        expr += "if (rotInEnabled == 0 && rotOutEnabled == 0) {\n";
        expr += "  restRot;\n";
        expr += "} else {\n";
        expr += "  var globalInDur = fx(\"Global Settings\")(\"IN Duration (sec)\").value;\n";
        expr += "  var globalOutDur = fx(\"Global Settings\")(\"OUT Duration (sec)\").value;\n\n";
        
        expr += "  var inDur = fx(\"Rotate\")(\"Rotate IN\")(\"Duration (sec)\").value;\n";
        expr += "  var outDur = fx(\"Rotate\")(\"Rotate OUT\")(\"Duration (sec)\").value;\n";
        expr += "  if (inDur == 0) inDur = globalInDur;\n";
        expr += "  if (outDur == 0) outDur = globalOutDur;\n\n";
        
        expr += "  var holdDuration = Math.max(0, (layerOut - layerIn) - inDur - outDur);\n";
        expr += "  var t = time - layerIn;\n";
        expr += "  var result = restRot;\n\n";
        
        expr += "  if (rotInEnabled && t >= 0 && t <= inDur) {\n";
        expr += "    var progress = t / inDur;\n";
        expr += "    var inAngle = fx(\"Rotate\")(\"Rotate IN\")(\"Angle\").value;\n";
        expr += "    var startRot = restRot + inAngle;\n";
        expr += "    result = startRot + (restRot - startRot) * progress;\n";
        expr += "  }\n\n";
        
        expr += "  else if (t > inDur && t < inDur + holdDuration) {\n";
        expr += "    result = restRot;\n";
        expr += "  }\n\n";
        
        expr += "  else if (rotOutEnabled && t >= inDur + holdDuration) {\n";
        expr += "    var outProgress = Math.min(1, (t - inDur - holdDuration) / outDur);\n";
        expr += "    var outAngle = fx(\"Rotate\")(\"Rotate OUT\")(\"Angle\").value;\n";
        expr += "    var endRot = restRot + outAngle;\n";
        expr += "    result = restRot + (endRot - restRot) * outProgress;\n";
        expr += "  }\n\n";
        
        expr += "  result;\n";
        expr += "}";
        
        return expr;
    }
    
    function generateOpacityExpression(layer, effect) {
        var expr = "";
        
        expr += "// Motion Envelope - Opacity\n";
        expr += "var fx = effect(\"" + EFFECT_NAME + "\");\n";
        expr += "var restOpa = value;\n";
        expr += "var layerIn = inPoint;\n";
        expr += "var layerOut = outPoint;\n\n";
        
        expr += "var opaInEnabled = fx(\"Opacity\")(\"Opacity IN\")(\"Enable\")(1);\n";
        expr += "var opaOutEnabled = fx(\"Opacity\")(\"Opacity OUT\")(\"Enable\")(1);\n\n";
        
        expr += "if (opaInEnabled == 0 && opaOutEnabled == 0) {\n";
        expr += "  restOpa;\n";
        expr += "} else {\n";
        expr += "  var globalInDur = fx(\"Global Settings\")(\"IN Duration (sec)\").value;\n";
        expr += "  var globalOutDur = fx(\"Global Settings\")(\"OUT Duration (sec)\").value;\n\n";
        
        expr += "  var inDur = fx(\"Opacity\")(\"Opacity IN\")(\"Duration (sec)\").value;\n";
        expr += "  var outDur = fx(\"Opacity\")(\"Opacity OUT\")(\"Duration (sec)\").value;\n";
        expr += "  if (inDur == 0) inDur = globalInDur;\n";
        expr += "  if (outDur == 0) outDur = globalOutDur;\n\n";
        
        expr += "  var holdDuration = Math.max(0, (layerOut - layerIn) - inDur - outDur);\n";
        expr += "  var t = time - layerIn;\n";
        expr += "  var result = restOpa;\n\n";
        
        expr += "  if (opaInEnabled && t >= 0 && t <= inDur) {\n";
        expr += "    var progress = t / inDur;\n";
        expr += "    var fromPct = fx(\"Opacity\")(\"Opacity IN\")(\"From %\").value;\n";
        expr += "    result = fromPct + (restOpa - fromPct) * progress;\n";
        expr += "  }\n\n";
        
        expr += "  else if (t > inDur && t < inDur + holdDuration) {\n";
        expr += "    result = restOpa;\n";
        expr += "  }\n\n";
        
        expr += "  else if (opaOutEnabled && t >= inDur + holdDuration) {\n";
        expr += "    var outProgress = Math.min(1, (t - inDur - holdDuration) / outDur);\n";
        expr += "    var toPct = fx(\"Opacity\")(\"Opacity OUT\")(\"To %\").value;\n";
        expr += "    result = restOpa + (toPct - restOpa) * outProgress;\n";
        expr += "  }\n\n";
        
        expr += "  result;\n";
        expr += "}";
        
        return expr;
    }
    
    function applyExpressions() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition.");
            return;
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            alert("Please select at least one layer.");
            return;
        }
        
        app.beginUndoGroup("Apply Motion Envelope Expressions");
        
        var successCount = 0;
        var failCount = 0;
        var missingEffect = [];
        
        try {
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                var effect = findMotionEnvelopeEffect(layer);
                
                if (!effect) {
                    missingEffect.push(layer.name);
                    failCount++;
                    continue;
                }
                
                if (settings.position) {
                    layer.transform.position.expression = generatePositionExpression(layer, effect);
                }
                if (settings.scale) {
                    layer.transform.scale.expression = generateScaleExpression(layer, effect);
                }
                if (settings.rotation) {
                    layer.transform.rotation.expression = generateRotationExpression(layer, effect);
                }
                if (settings.opacity) {
                    layer.transform.opacity.expression = generateOpacityExpression(layer, effect);
                }
                
                successCount++;
            }
            
            if (successCount > 0) {
                alert("Expressions applied to " + successCount + " layer(s).");
            }
            
            if (missingEffect.length > 0) {
                alert("Missing Motion Envelope effect on:\n" + missingEffect.join("\n") + "\n\nPlease apply the FFX manually first.");
            }
            
        } catch (e) {
            alert("Error: " + e.toString() + " (Line: " + e.line + ")");
        }
        
        app.endUndoGroup();
    }
    
    function removeExpressions() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition.");
            return;
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            alert("Please select at least one layer.");
            return;
        }
        
        app.beginUndoGroup("Remove Motion Envelope Expressions");
        
        try {
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                layer.transform.position.expression = "";
                layer.transform.scale.expression = "";
                layer.transform.rotation.expression = "";
                layer.transform.opacity.expression = "";
            }
            alert("All expressions removed from " + selectedLayers.length + " layer(s).");
        } catch (e) {
            alert("Error: " + e.toString());
        }
        
        app.endUndoGroup();
    }
    
    // Build and show UI
	var ui = buildUI(thisObj);
	if (ui instanceof Window && !(thisObj instanceof Panel || thisObj instanceof Group)) { 
		ui.center(); 
		ui.show(); 
	}
    
})(this);