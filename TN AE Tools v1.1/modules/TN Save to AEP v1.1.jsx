#target aftereffects
#targetengine "ExportLayersToAEP_v10x"

/*
TN Save to AEP v1.1
*/

(function (thisObj) {

// ==========================================================================
// Session keys
// ==========================================================================
var S_LAST_PATH   = "__ELTA_lastPath_v107";
var S_WIN_BOUNDS  = "__ELTA_lastWin_v107";
var S_WATCH_FLAG  = "__ELTA_watchEnabled_v107";

// base-lock (for first-selected naming)
var S_LOCK_KIND   = "__ELTA_lockKind_v107";   // "items" | "comp" | null
var S_LOCK_TOKEN  = "__ELTA_lockToken_v107";  // stable token (index/name)
var S_LOCK_NAME   = "__ELTA_lockName_v107";   // display base-name (no ext)

// helpers to read/write session
function get(key){ try { return $.global[key]; } catch(e){ return null; } }
function set(key,val){ try { $.global[key] = val; } catch(e){} }

// >>> expose to engine-global so scheduleTask callbacks can see them
$.global.get = get;
$.global.set = set;
$.global.__ELTA_get = get;   // aliases (safe no-ops if unused)
$.global.__ELTA_set = set;

// ==========================================================================
// Small utils
// ==========================================================================
function sanitizeName(s){ return (s||"").replace(/[\/\\:*?"<>|]/g,"_"); }
function baseNameNoExt(s){ s=sanitizeName(s||""); var m=s.match(/^(.*?)(?:\.[^\.]{1,8})?$/); return m?(m[1]||s):s; }
function isAEP(p){ return /\.aep$/i.test(p||""); }
function ensureMasterSaved(){
    if (!app.project.file){ aeMsg("Please save your master project first."); return false; }
    if (app.project.dirty){ aeMsg("Please save your master project (unsaved changes)."); return false; }
    return true;
}
function lastOrDefaultFolder(){
    var last=get(S_LAST_PATH);
    return (last && last!=="") ? last : (app.project.file ? app.project.file.parent.fsName : Folder.desktop.fsName);
}
function indexOfItem(ref){ for(var i=1;i<=app.project.numItems;i++) if(app.project.item(i)===ref) return i; return -1; }
function activeComp(){ var c=app.project.activeItem; if(!(c instanceof CompItem)) throw new Error("Select a composition."); return c; }

// Robust selection detector (scans ALL comps, not just active)
function detectSelections(){
    var compSel = 0, itemsSel = 0;
    try{
        // count selected layers from ANY comp in the project
        for (var i=1;i<=app.project.numItems;i++){
            var it = app.project.item(i);
            if (it instanceof CompItem && it.selectedLayers && it.selectedLayers.length){
                compSel = it.selectedLayers.length; break;
            }
        }
    }catch(_){ }
    try{ itemsSel = (app.project.selection||[]).length; }catch(_){ }
    return {comp:compSel, items:itemsSel};
}

function firstLayerDisplayName(c){
    var L=c.selectedLayers[0]; if(!L) return "Precomp";
    if (L.source && (L.source instanceof FootageItem)) return baseNameNoExt(L.source.name);
    return sanitizeName(L.name);
}
function firstItemDisplayName(){
    var sel=app.project.selection||[];
    if(sel.length===0) return null;
    return baseNameNoExt(sel[0].name);
}

// ==========================================================================
// Temp project + collect helpers
// ==========================================================================
function openTempFromMaster(){ var tmp=new File(Folder.temp.fsName+"/elta_tmp_"+(new Date().getTime())+".aep"); app.project.save(tmp); app.open(tmp); return tmp; }
function backToMaster(master){ app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); app.open(master); }

function ensureFolderByName(name){
    for(var i=1;i<=app.project.numItems;i++){ var it=app.project.item(i);
        if(it instanceof FolderItem && it.parentFolder===app.project.rootFolder && it.name===name) return it; }
    var f=app.project.items.addFolder(name); f.parentFolder=app.project.rootFolder; return f;
}
function moveAllCompsToRoot(){ for(var i=1;i<=app.project.numItems;i++){ var it=app.project.item(i); if(it instanceof CompItem){ try{ it.parentFolder=app.project.rootFolder; }catch(_){}} } }
function moveFootageToFootageFolder(){
    var ff=null;
    for(var i=1;i<=app.project.numItems;i++){ var it=app.project.item(i);
        if(it instanceof FootageItem){ if(!ff) ff=ensureFolderByName("(footage)"); try{ it.parentFolder=ff; }catch(_){ } }
    }
}
function moveOtherCompsToPrecompKeepOne(keepComp){
    var pre=ensureFolderByName("(precomp)");
    for(var i=1;i<=app.project.numItems;i++){ var it=app.project.item(i);
        if(it instanceof CompItem){ if(it!==keepComp){ try{ it.parentFolder=pre; }catch(_){ } } }
    }
    try{ keepComp.parentFolder=app.project.rootFolder; }catch(_){}
}
function pruneEmptyFolders(){
    var again=true, guard=0;
    while(again && guard<10){ again=false; guard++;
        for(var i=app.project.numItems;i>=1;i--){ var it=app.project.item(i);
            if(it instanceof FolderItem && it!==app.project.rootFolder && it.numItems===0){ try{ it.remove(); again=true; }catch(_){ } }
        }
    }
}
function reduceAndTidy(targets, keepAtRoot){
    app.project.reduceProject(targets);
    try{ app.project.removeUnusedFootage(); }catch(_){}
    moveAllCompsToRoot();
    moveFootageToFootageFolder(); // solids also tucked here inside AEP
    if(keepAtRoot) moveOtherCompsToPrecompKeepOne(keepAtRoot);
    pruneEmptyFolders();
}
function hasExternalFootage(){
    for(var i=1;i<=app.project.numItems;i++){
        var it=app.project.item(i);
        if(it instanceof FootageItem){
            try{
                var f = it.mainSource && it.mainSource.file;
                if (f && f.exists) return true;
            }catch(_){ }
        }
    }
    return false;
}

// disk collect + relink
function uniqueDest(folderFs, file){
    var dest=new File(folderFs+"/"+file.name); if(!dest.exists) return dest;
    var stem=file.displayName.replace(/\.[^\.]+$/,""), ext=(file.displayName.match(/(\.[^\.]+)$/)||["",".aep"])[1];
    var n=1,cand; do{ var suf=(n<10?"-0"+n:"-"+n); cand=new File(folderFs+"/"+stem+suf+ext); n++; }while(cand.exists);
    return cand;
}
function tryCopy(src,dst){ try{ return src.copy(dst.fsName); }catch(e){ return false; } }
function isLikelySequence(fi){
    try{
        if(!(fi instanceof FootageItem)) return false;
        if(fi.mainSource && fi.mainSource.isStill) return false;
        if(/\[[#0-9]+\]/.test(fi.name)) return true;
        var f=fi.mainSource && fi.mainSource.file; return !!(f && /(\d{3,})\.[^\.]+$/i.test(f.name));
    }catch(e){ return false; }
}
function relinkAllToCopies(destParentFs){
    var list=[], k, fi, src;
    for(k=1;k<=(app.project.numItems||0);k++){
        fi=app.project.item(k); if(!(fi instanceof FootageItem)) continue;
        try{ src=fi.mainSource && fi.mainSource.file; }catch(_){ src=null; }
        if (src && src.exists) list.push({fi:fi, src:src});
    }
    if (list.length===0) return false;

    var foot=new Folder(destParentFs+"/(footage)"); if(!foot.exists) foot.create();

    for(k=0;k<list.length;k++){
        fi = list[k].fi; src = list[k].src;
        if(isLikelySequence(fi)){
            var m=src.name.match(/^(.*?)(\d+)(\.[^\.]+)$/);
            if(m){
                var prefix=m[1], ext=m[3];
                var files = src.parent.getFiles(function(g){ return g instanceof File && new RegExp("^"+prefix+"\\d+"+ext+"$","i").test(g.name); });
                var first=null;
                for(var i2=0;i2<files.length;i2++){ var d=uniqueDest(foot.fsName, files[i2]); tryCopy(files[i2], d); if(!first) first=d; }
                if(first){ try{ fi.replaceWithSequence(first, true); }catch(_){ try{ fi.replace(first); }catch(__){} } }
            }else{
                var d1=uniqueDest(foot.fsName, src); if(tryCopy(src,d1)){ try{ fi.replace(d1); }catch(__){} }
            }
        }else{
            var d2=uniqueDest(foot.fsName, src); if(tryCopy(src,d2)){ try{ fi.replace(d2); }catch(__){} }
        }
    }
    return true;
}

// wrappers / trim
function trimCompToSpan(comp){
    var minIn=1e9,maxOut=0;
    for(var i=1;i<=comp.numLayers;i++){ var L=comp.layer(i); if(L.inPoint<minIn)minIn=L.inPoint; if(L.outPoint>maxOut)maxOut=L.outPoint; }
    if(minIn===1e9) return;
    var span=Math.max(0.001,maxOut-minIn);
    for(var j=1;j<=comp.numLayers;j++){ comp.layer(j).startTime-=minIn; }
    comp.displayStartTime=0; comp.workAreaStart=0; comp.workAreaDuration=span; comp.duration=span;
}
function wrapperForFootage(ft, name, w,h,fr,dur){
    var c=app.project.items.addComp(name,w,h,1.0,Math.max(0.001,dur),fr);
    var L=c.layers.add(ft); L.startTime=0; L.inPoint=0; L.outPoint=c.duration; return c;
}
function findCompByExactName(nm){ for (var i=1;i<=app.project.numItems;i++){ var it=app.project.item(i); if (it instanceof CompItem && it.name===nm) return it; } return null; }
function uniqueCompName(base){ var name = base, n=1; while (findCompByExactName(name)){ name = base + "-" + (n<10 ? "0"+n : ""+n); n++; } return name; }

// save helpers
function mkdirp(folder){ if(!folder) return false; if(folder.exists) return true; if(mkdirp(folder.parent)) return folder.create(); return false; }
function saveTo(fileObj){
    var parent=fileObj.parent; if(parent && !parent.exists) mkdirp(parent);
    app.project.save(fileObj);
    if(!fileObj.exists){ aeMsg("Save failed:\n"+fileObj.fsName); }
}

// ==========================================================================
// OVERWRITE HELPERS (only these add/replace)
// ==========================================================================
function nextAvailableAEP(fileObj){
    var p=fileObj.fsName, m=p.match(/^(.*?)(?:-([0-9]{2}))?(\.aep)$/i);
    var prefix=m?m[1]:p.replace(/\.aep$/i,""); var n=1, cand;
    do{ var suf=(n<10?"0"+n:""+n); cand=new File(prefix+"-"+suf+".aep"); n++; }while(cand.exists);
    return cand;
}
function nextAvailableBase(folderFs, base){
    var n=1, b=base;
    while ( new File(folderFs+"/"+b+".aep").exists || new Folder(folderFs+"/"+b).exists ){
        n++; var suf=(n<10?"0"+n:""+n); b = base+"-"+suf;
    }
    return b;
}
function collisionPrompt(outPath, allowApplyAll, mem){
    if(mem && mem.applyAll && mem.policy) return mem.policy;
    var d=new Window("dialog","TN Save to AEP v1.1"); d.orientation="column"; d.margins=12; d.alignChildren=["fill","top"];
    var textArea = d.add("statictext",undefined,"Destination exists:\n"+outPath,{multiline:true});
textArea.preferredSize.width = 350;
    var g=d.add("group"); g.orientation="row";
    var bO=g.add("button",undefined,"Overwrite"); var bS=g.add("button",undefined,"Add suffix"); var bC=g.add("button",undefined,"Cancel");
    var cb=null; if(allowApplyAll) cb=d.add("checkbox",undefined,"Apply to all");
    var res=null; bO.onClick=function(){res="overwrite"; d.close(1);}; bS.onClick=function(){res="suffix"; d.close(1);}; bC.onClick=function(){res=null; d.close(0);};
    var ok=d.show(); if(!ok) return null; if(allowApplyAll && cb && cb.value){ mem.policy=res; mem.applyAll=true; } return res;
}

// ==========================================================================
// ScriptUI prompts
// ==========================================================================
function aeMsg(text){
    var d=new Window("dialog","TN Save to AEP v1.1"); d.orientation="column"; d.margins=12; d.alignChildren=["fill","top"];
    var textArea = d.add("statictext",undefined,text,{multiline:true});
textArea.preferredSize.width = 350;
    var g=d.add("group"); g.orientation="row"; g.alignment=["center","center"]; 
    var ok=g.add("button",undefined,"OK"); ok.onClick=function(){ d.close(1); };
    d.show();
}
function aeConfirm(text){
    var d=new Window("dialog","TN Save to AEP v1.1"); d.orientation="column"; d.margins=12; d.alignChildren=["fill","top"];
    var textArea = d.add("statictext",undefined,text,{multiline:true});
textArea.preferredSize.width = 350;
    var g=d.add("group"); g.orientation="row"; g.alignment=["center","center"];
    var yes=g.add("button",undefined,"OK"); var no=g.add("button",undefined,"Cancel");
    var res=null; yes.onClick=function(){ res=true; d.close(1); }; no.onClick=function(){ res=false; d.close(0); };
    var ok=d.show(); return ok?res:false;
}
function aeChoice(text, b1, b2, b3){
    var d=new Window("dialog","TN Save to AEP v1.1"); d.orientation="column"; d.margins=12; d.alignChildren=["fill","top"];
    d.add("statictext",undefined,text,{multiline:true});
    var g=d.add("group"); g.orientation="row"; g.alignment=["right","center"];
    var B1=g.add("button",undefined,b1); var B2=g.add("button",undefined,b2); var B3=g.add("button",undefined,b3||"Cancel");
    var res=null; B1.onClick=function(){ res="b1"; d.close(1); }; B2.onClick=function(){ res="b2"; d.close(1); }; B3.onClick=function(){ res=null; d.close(0); };
    var ok=d.show(); return ok?res:null;
}

function preText(base,names){
    var s = "The following file(s) will be saved in:\n" + base + "\n\n";
    for (var i=0; i<names.length; i++){
        var pretty = (names[i] && names[i].replace) ? names[i].replace(/%20/g, " ") : names[i];
        s += (i+1) + ". " + pretty + "\n";
    }
    return s;
}

function postText(base,names){
    var s = "The following file(s) were saved in:\n" + base + "\n\n";
    for (var i=0; i<names.length; i++){
        var pretty = (names[i] && names[i].replace) ? names[i].replace(/%20/g, " ") : names[i];
        s += (i+1) + ". " + pretty + "\n";
    }
    return s;
}


// ==========================================================================
// EXPORTERS (original 1.02; only OVERWRITE CHECKS added earlier release)
// ==========================================================================

// ONE from Project Panel (items)
function oneFromItems(master, outFile, summary, diskBase){
    var sel=app.project.selection||[]; if(sel.length===0) throw new Error("Select item(s) in the Project panel.");
    var cleaned=[]; for (var s=0;s<sel.length;s++){ if(!(sel[s] instanceof FolderItem)) cleaned.push(sel[s]); }
    if (cleaned.length===0){ aeMsg("Selection contains only folders. Please select items (comps/footage)."); return; }

    var idx=[], firstName=baseNameNoExt(cleaned[0].name);
    for(var i=0;i<cleaned.length;i++) idx.push(indexOfItem(cleaned[i]));

    var baseline=openTempFromMaster();
    try{
        var items=[]; for(var j=0;j<idx.length;j++){ var it=app.project.item(idx[j]); if(it) items.push(it); }
        if(items.length===0) throw new Error("Items not found in temp.");
        var target=null, keep=null;

        if(items.length===1){
            var it=items[0];
            if(it instanceof CompItem){
                target=it; keep=it;
                reduceAndTidy([target], keep);

                if (hasExternalFootage()){
                    var base = diskBase || firstName;
                    var wrap=new Folder(outFile.parent.fsName + "/" + base);
                    if (wrap.exists || new File(wrap.fsName + "/" + base + ".aep").exists){
                        var pol=collisionPrompt(wrap.fsName, false, {});
                        if (pol===null) return;
                        if (pol==="suffix") base = nextAvailableBase(outFile.parent.fsName, base);
                        wrap = new Folder(outFile.parent.fsName + "/" + base);
                    }
                    if(!wrap.exists) wrap.create();
                    relinkAllToCopies(wrap.fsName);
                    var out=new File(wrap.fsName + "/" + base + ".aep"); saveTo(out);
                    if(out.exists) summary.push(base + "/" + out.name);
                    set(S_LAST_PATH, out.parent.fsName);
                }else{
                    var of=new File(outFile.fsName);
                    if (of.exists){
                        var pol2=collisionPrompt(of.fsName, false, {});
                        if (pol2===null) return;
                        if (pol2==="suffix") of = nextAvailableAEP(of);
                    }
                    saveTo(of);
                    if(of.exists) summary.push(of.name);
                    set(S_LAST_PATH, of.parent.fsName);
                }
            } else {
                var W=it.width||0, H=it.height||0, FR=it.frameRate||25, DU=Math.max(0.001,it.duration||30.0);
                if (!W || !H){ var wr=wrapperResPrompt(); if(!wr){ backToMaster(master); return; } W=wr.w; H=wr.h; }
                target=wrapperForFootage(it, firstName, W,H,FR,DU); keep=target;
                reduceAndTidy([target], keep);

                if (hasExternalFootage()){
                    var base2 = diskBase || firstName;
                    var wrap2=new Folder(outFile.parent.fsName + "/" + base2);
                    if (wrap2.exists || new File(wrap2.fsName + "/" + base2 + ".aep").exists){
                        var pol3=collisionPrompt(wrap2.fsName, false, {});
                        if (pol3===null) return;
                        if (pol3==="suffix") base2 = nextAvailableBase(outFile.parent.fsName, base2);
                        wrap2 = new Folder(outFile.parent.fsName + "/" + base2);
                    }
                    if(!wrap2.exists) wrap2.create();
                    relinkAllToCopies(wrap2.fsName);
                    var out2=new File(wrap2.fsName + "/" + base2 + ".aep"); saveTo(out2);
                    if(out2.exists) summary.push(base2 + "/" + out2.name);
                    set(S_LAST_PATH, out2.parent.fsName);
                }else{
                    var of2=new File(outFile.fsName);
                    if (of2.exists){
                        var pol4=collisionPrompt(of2.fsName, false, {});
                        if (pol4===null) return;
                        if (pol4==="suffix") of2 = nextAvailableAEP(of2);
                    }
                    saveTo(of2);
                    if(of2.exists) summary.push(of2.name);
                    set(S_LAST_PATH, of2.parent.fsName);
                }
            }
            return;
        }

        // MULTI
        reduceAndTidy(items, null);
        var externals = hasExternalFootage();

        if (!externals){
            var of3=new File(outFile.fsName);
            if (of3.exists){
                var pol5=collisionPrompt(of3.fsName, false, {});
                if (pol5===null) return;
                if (pol5==="suffix") of3 = nextAvailableAEP(of3);
            }
            saveTo(of3);
            if (of3.exists) summary.push(of3.name);
            set(S_LAST_PATH, of3.parent.fsName);
        } else {
            backToMaster(master);
            var baseline2=openTempFromMaster();
            try{
                items=[]; for(j=0;j<idx.length;j++){ var it2=app.project.item(idx[j]); if(it2) items.push(it2); }
                var firstTemp = items[0];

                var W=1920,H=1080,FR=25,DU=30.0, needRes=false;
                if(firstTemp instanceof CompItem){ W=firstTemp.width; H=firstTemp.height; FR=firstTemp.frameRate; DU=firstTemp.duration; }
                else if(firstTemp instanceof FootageItem){
                    if(firstTemp.width && firstTemp.height){ W=firstTemp.width; H=firstTemp.height; } else needRes=true;
                    FR=firstTemp.frameRate||25; DU=Math.max(0.001, firstTemp.duration||30.0);
                } else { needRes=true; }
                if(needRes){ var wr3=wrapperResPrompt(); if(!wr3){ backToMaster(master); return; } W=wr3.w; H=wr3.h; }

                var wrapperName = uniqueCompName(firstName + "_collect");
                var targetW = app.project.items.addComp(wrapperName, W,H,1.0,DU,FR); var keepW=targetW;
                for(var a=0;a<items.length;a++){ try{ targetW.layers.add(items[a]).startTime=0; }catch(_){ } }
                reduceAndTidy([targetW], keepW);

                var base3 = diskBase || firstName;
                var wrapD=new Folder(outFile.parent.fsName + "/" + base3);
                if (wrapD.exists || new File(wrapD.fsName + "/" + base3 + ".aep").exists){
                    var pol6=collisionPrompt(wrapD.fsName, false, {});
                    if (pol6===null) return;
                    if (pol6==="suffix") base3 = nextAvailableBase(outFile.parent.fsName, base3);
                    wrapD = new Folder(outFile.parent.fsName + "/" + base3);
                }
                if(!wrapD.exists) wrapD.create();
                relinkAllToCopies(wrapD.fsName);
                var out3=new File(wrapD.fsName + "/" + base3 + ".aep"); saveTo(out3);
                if(out3.exists) summary.push(base3 + "/" + out3.name);
                set(S_LAST_PATH, out3.parent.fsName);
            } finally { try{ backToMaster(master); }catch(_){ } }
        }

    } catch(e){
        aeMsg("Error (ONE+Project): " + e.toString());
    } finally { try{ backToMaster(master); }catch(_){ } }
}

// ONE from Current Comp (layers)
function oneFromComp(master, outFile, summary, diskBase){
    var comp=activeComp(), compIdx=indexOfItem(comp);
    var idxs=[]; for (var i=0;i<comp.selectedLayers.length;i++) idxs.push(comp.selectedLayers[i].index);
    var firstName = baseNameNoExt(firstLayerDisplayName(comp));

    var baseline=openTempFromMaster();
    try{
        var c = app.project.item(compIdx); if (!(c instanceof CompItem)) throw new Error("Comp not found in temp.");
        var target=null;

        if (idxs.length===1){
            var L=c.layer(idxs[0]);
            if (L && L.source && (L.source instanceof CompItem)){
                target = L.source;
            } else {
                target = c.layers.precompose([idxs[0]], firstName, true);
                trimCompToSpan(target);
            }
        } else {
            target = c.layers.precompose(idxs, firstName, true);
            trimCompToSpan(target);
        }

        reduceAndTidy([target], target);

        if (hasExternalFootage()){
            var base = diskBase || firstName;
            var wrap = new Folder(outFile.parent.fsName + "/" + base);
            if (wrap.exists || new File(wrap.fsName + "/" + base + ".aep").exists){
                var pol=collisionPrompt(wrap.fsName, false, {});
                if (pol===null) return;
                if (pol==="suffix") base = nextAvailableBase(outFile.parent.fsName, base);
                wrap = new Folder(outFile.parent.fsName + "/" + base);
            }
            if (!wrap.exists) wrap.create();
            relinkAllToCopies(wrap.fsName);
            var out = new File(wrap.fsName + "/" + base + ".aep");
            saveTo(out);
            if (out.exists) summary.push(base + "/" + out.name);
            set(S_LAST_PATH, out.parent.fsName);
        } else {
            var of=new File(outFile.fsName);
            if (of.exists){
                var pol2=collisionPrompt(of.fsName, false, {});
                if (pol2===null) return;
                if (pol2==="suffix") of = nextAvailableAEP(of);
            }
            saveTo(of);
            if (of.exists) summary.push(of.name);
            set(S_LAST_PATH, of.parent.fsName);
        }
    } finally { try{ backToMaster(master); }catch(_){ } }
}

// SEPARATE from Current Comp (layers)
function separateFromComp(master, baseFolderFs, mem, summary){
    var c = activeComp(); var compIdx=indexOfItem(c);
    var snap=[];
    for (var i=0;i<c.selectedLayers.length;i++){
        var L=c.selectedLayers[i];
        snap.push({
            index: L.index,
            isComp: (L.source instanceof CompItem),
            name: (L.source && (L.source instanceof FootageItem)) ? baseNameNoExt(L.source.name) : sanitizeName(L.name)
        });
    }
    if (snap.length===1){
        var nm=baseNameNoExt(snap[0].name);
        var singleOut = new File(baseFolderFs + "/" + nm + ".aep");
        if (singleOut.exists){
            var pol=collisionPrompt(singleOut.fsName,false,mem);
            if (pol===null) return;
            if (pol==="suffix") singleOut = nextAvailableAEP(singleOut);
        }
        oneFromComp(master, singleOut, summary);
        return;
    }
    var baseline=openTempFromMaster();
    try{
        for (var s=0;s<snap.length;s++){
            backToMaster(master);
            var baseline2=openTempFromMaster();
            try{
                var tempComp = app.project.item(compIdx); if (!(tempComp instanceof CompItem)) continue;

                var nm = baseNameNoExt(snap[s].name);
                var outDirect = new File(baseFolderFs + "/" + nm + ".aep");
                var perFolder = new Folder(baseFolderFs + "/" + nm);

                var target=null;
                if (snap[s].isComp){
                    var layer=tempComp.layer(snap[s].index); if (!layer || !(layer.source instanceof CompItem)) continue;
                    target=layer.source;
                } else {
                    var L=tempComp.layer(snap[s].index); if (!L) continue;
                    target=tempComp.layers.precompose([L.index], nm, true);
                    trimCompToSpan(target);
                }

                reduceAndTidy([target], target);

                if (hasExternalFootage()){
                    var needPrompt = perFolder.exists || new File(perFolder.fsName + "/" + nm + ".aep").exists;
                    var out = new File(perFolder.fsName + "/" + nm + ".aep");
                    if (needPrompt){
                        var pol2=collisionPrompt(perFolder.fsName, true, mem);
                        if (pol2===null) continue;
                        if (pol2==="suffix"){
                            var nm2 = nextAvailableBase(baseFolderFs, nm);
                            perFolder = new Folder(baseFolderFs + "/" + nm2);
                            out = new File(perFolder.fsName + "/" + nm2 + ".aep");
                            nm = nm2;
                        }
                    }
                    if (!perFolder.exists) perFolder.create();
                    relinkAllToCopies(perFolder.fsName);
                    saveTo(out);
                    if (out.exists) summary.push(nm + "/" + out.name);
                } else {
                    if (outDirect.exists){
                        var pol3=collisionPrompt(outDirect.fsName,true,mem);
                        if (pol3===null) continue;
                        if (pol3==="suffix") outDirect = nextAvailableAEP(outDirect);
                    }
                    saveTo(outDirect);
                    if (outDirect.exists) summary.push(outDirect.name);
                }
            } finally { try{ backToMaster(master); }catch(_){ } }
        }
        set(S_LAST_PATH, baseFolderFs);
    } finally { try{ backToMaster(master); }catch(_){ } }
}

// SEPARATE from Project Panel (items)
function separateFromItems(master, baseFolderFs, mem, summary){
    var sel=app.project.selection||[]; if (sel.length===0) throw new Error("Select item(s) in the Project panel.");
    if (sel.length===1){
        var nm=baseNameNoExt(sel[0].name);
        var p=new File(baseFolderFs + "/" + nm + ".aep");
        if (p.exists){
            var pol=collisionPrompt(p.fsName,false,mem);
            if (pol===null) return;
            if (pol==="suffix") p = nextAvailableAEP(p);
        }
        oneFromItems(master, p, summary);
        return;
    }
    var idx=[]; for (var i=0;i<sel.length;i++) idx.push(indexOfItem(sel[i]));
    var baseline=openTempFromMaster();
    try{
        for (var k=0;k<idx.length;k++){
            backToMaster(master);
            var baseline2=openTempFromMaster();
            try{
                var it=app.project.item(idx[k]); if (!it) continue;
                var nm=baseNameNoExt(it.name);
                var target=null;

                if (it instanceof CompItem){
                    target=it;
                } else if (it instanceof FootageItem){
                    var W=it.width||0, H=it.height||0, FR=it.frameRate||25, DU=Math.max(0.001, it.duration||30.0);
                    if (!W || !H){ var wr=wrapperResPrompt(); if(!wr) continue; W=wr.w; H=wr.h; }
                    target=wrapperForFootage(it, nm, W,H,FR,DU);
                } else {
                    target=wrapperForFootage(it, nm, 1920,1080,25,30.0);
                }

                reduceAndTidy([target], target);

                if (hasExternalFootage()){
                    var perFolder = new Folder(baseFolderFs + "/" + nm);
                    var out = new File(perFolder.fsName + "/" + nm + ".aep");
                    var needPrompt = perFolder.exists || out.exists;
                    if (needPrompt){
                        var pol2=collisionPrompt(perFolder.fsName, true, mem);
                        if (pol2===null) continue;
                        if (pol2==="suffix"){
                            var nm2 = nextAvailableBase(baseFolderFs, nm);
                            perFolder = new Folder(baseFolderFs + "/" + nm2);
                            out = new File(perFolder.fsName + "/" + nm2 + ".aep");
                            nm = nm2;
                        }
                    }
                    if (!perFolder.exists) perFolder.create();
                    relinkAllToCopies(perFolder.fsName);
                    saveTo(out);
                    if (out.exists) summary.push(nm + "/" + out.name);
                } else {
                    var out2=new File(baseFolderFs + "/" + nm + ".aep");
                    if (out2.exists){
                        var pol3=collisionPrompt(out2.fsName,true,mem);
                        if (pol3===null) continue;
                        if (pol3==="suffix") out2 = nextAvailableAEP(out2);
                    }
                    saveTo(out2);
                    if (out2.exists) summary.push(out2.name);
                }
            } finally { try{ backToMaster(master); }catch(_){ } }
        }
        set(S_LAST_PATH, baseFolderFs);
    } finally { try{ backToMaster(master); }catch(_){ } }
}

// ==========================================================================
// UI (palette)
// ==========================================================================
   function buildUI(thisObj){
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "TN Save to AEP v1.1", undefined, {resizeable:true});
        win.orientation="column"; win.alignChildren=["fill","top"]; win.margins=10;

        // Header
        var head=win.add("group"); head.orientation="row"; head.alignChildren=["right","center"]; head.alignment=["fill","top"];
        var helpBtn=head.add("button", undefined, "?"); helpBtn.preferredSize=[28,22]; helpBtn.minimumSize=[28,22]; helpBtn.maximumSize=[28,22];
        helpBtn.alignment=["right","center"];

        // --- Group 1: Save file(s)/ Layer(s) as ---
        var pSave=win.add("panel", undefined, "Save file(s)/ Layer(s) as:");
        pSave.orientation="row"; pSave.alignChildren=["left","center"]; pSave.margins=10;
        var rbOne = pSave.add("radiobutton", undefined, "One aep file");
        var rbSep = pSave.add("radiobutton", undefined, "Separate aep files");
        rbOne.value = true;

        // --- Group 2: From ---
        var pFrom=win.add("panel", undefined, "From:");
        pFrom.orientation="row"; pFrom.alignChildren=["left","center"]; pFrom.margins=10;
        var rbComp  = pFrom.add("radiobutton", undefined, "Current Comp");
        var rbItems = pFrom.add("radiobutton", undefined, "Project Panel");
        rbComp.value = true;

        // --- Path group ---
        var pPath=win.add("panel", undefined, "File save location:");
        pPath.orientation="column"; pPath.alignChildren=["fill","top"]; pPath.margins=10;

        var row=pPath.add("group"); row.orientation="row"; row.alignChildren=["fill","center"]; row.alignment=["fill","top"];
        var pathField=row.add("edittext", undefined, ""); pathField.characters=44; pathField.alignment=["fill","center"];
        var browse=row.add("button", undefined, "...");
        // Static button rule (fixed size, never clipped)
        browse.preferredSize=[32,24]; browse.minimumSize=[32,24]; browse.maximumSize=[32,24];
        browse.alignment=["right","center"];

        // Save button (fixed)
        var runBtn=pPath.add("button", undefined, "Save");
        runBtn.alignment=["center","top"];
        runBtn.preferredSize=[140,30]; runBtn.minimumSize=[140,30]; runBtn.maximumSize=[140,30];

        // Help
        helpBtn.onClick=function(){
            var msg = "What it does:\n"+
                      "• Save selected layers/items into self-contained AEPs.\n"+
                      "• “One” = one AEP; “Separate” = one per selection.\n"+
                      "• External files are copied beside the AEP in (footage). Solids remain inside the AEP.\n"+
                      "Basics:\n"+
                      "• Source = Current Comp (layers) or Project Panel (items).\n"+
                      "• Manual filename in ONE mode drives the disk name for that run.\n"+
                      "• Stills default to 30s; unknown pixel size will prompt.\n\n"+
                      "v1.1.8 — MDZ";
            aeMsg(msg, true);
        };

    var manualOverride=false, runInProgress=false;
    pathField.onChanging=function(){ manualOverride=true; };

    function currentMode(){ return rbSep.value ? "separate" : "one"; }
    function currentSourceRadio(){ return rbItems.value ? "items" : "comp"; }

    function setLock(kind, token, name){ set(S_LOCK_KIND,kind); set(S_LOCK_TOKEN,token); set(S_LOCK_NAME,name); }
    function clearLock(){ set(S_LOCK_KIND,null); set(S_LOCK_TOKEN,null); set(S_LOCK_NAME,null); }
    function currentLockNameFor(source){ var k=get(S_LOCK_KIND), n=get(S_LOCK_NAME); return (k===source && n)?n:null; }

    function updateLocksFromState(){
        var items=app.project.selection||[];
        var comp=(app.project.activeItem instanceof CompItem) ? app.project.activeItem : null;

        if (items.length===1){ setLock("items", indexOfItem(items[0]), baseNameNoExt(items[0].name)); }
        else if (items.length===0 && get(S_LOCK_KIND)==="items"){ clearLock(); }

        if (comp && comp.selectedLayers && comp.selectedLayers.length===1){
            var nm = baseNameNoExt(firstLayerDisplayName(comp)); setLock("comp", comp.selectedLayers[0].index, nm);
        } else if ((!comp || comp.selectedLayers.length===0) && get(S_LOCK_KIND)==="comp"){ clearLock(); }
    }

    function suggestedBaseName(source){
        var lock=currentLockNameFor(source);
        if (lock) return lock;
        if (source==="comp"){
            try{
                var c=app.project.activeItem;
                if (!(c instanceof CompItem) || c.selectedLayers.length===0) return null;
                return baseNameNoExt(firstLayerDisplayName(c));
            }catch(_){ return null; }
        } else {
            return firstItemDisplayName();
        }
    }

    function suggestPath(){
        var folder = lastOrDefaultFolder();
        var src = currentSourceRadio();
        var nm = suggestedBaseName(src);
        if (currentMode()==="one"){
            return nm ? (folder + "/" + nm + ".aep") : folder;
        } else {
            return folder;
        }
    }

    function refreshPathIfAuto(){ if (!manualOverride && !runInProgress) pathField.text = suggestPath(); }
    rbOne.onClick = rbSep.onClick = rbComp.onClick = rbItems.onClick = refreshPathIfAuto;
    win.onActivate = refreshPathIfAuto;

    function watchTick(){ try{ if (!get(S_WATCH_FLAG)) return; updateLocksFromState(); if (!manualOverride && !runInProgress) refreshPathIfAuto(); }catch(_){ }
        app.scheduleTask("("+watchTick.toString()+")()", 600, false); }
    function startWatcher(){ set(S_WATCH_FLAG,true); app.scheduleTask("("+watchTick.toString()+")()", 600, false); }
    function stopWatcher(){ set(S_WATCH_FLAG,false); }

    function chooseSource(){
        var s=detectSelections();
        if (s.comp===0 && s.items===0){ aeMsg("Select layer(s) or item(s) first."); return null; }
        if (s.comp>0 && s.items>0){
            var pick = aeChoice("You have selections in BOTH panels.\nExport from which source?", "Current Comp", "Project Panel", "Cancel");
            if (pick==="b1") return "comp"; if (pick==="b2") return "items"; return null;
        }
        return (s.comp>0) ? "comp" : "items";
    }

    browse.onClick=function(){
        if (currentMode()==="one"){
            var def=new File( isAEP(pathField.text) ? pathField.text : suggestPath() );
            var f=def.saveDlg("Save AEP as...", "After Effects Project:*.aep");
            if (f){ pathField.text=f.fsName; manualOverride=true; }
        } else {
            var start = (!pathField.text || isAEP(pathField.text)) ? lastOrDefaultFolder() : pathField.text;
            var chosen = Folder.selectDialog("Choose output folder", new Folder(start));
            if (chosen){ pathField.text=chosen.fsName; manualOverride=true; }
        }
    };

    runBtn.onClick=function(){
        if (!ensureMasterSaved()) return;

        var src = chooseSource(); if (!src) return;
        rbComp.value = (src==="comp"); rbItems.value = (src==="items");

        var master = app.project.file;
        var mode   = rbSep.value ? "separate" : "one";
        var preview={base:"",names:[]}, done={base:"",names:[]};

        var manualOverride=false, runInProgress=false;
        runInProgress = true; stopWatcher();

        if (mode==="one"){
            var baseFolder = lastOrDefaultFolder();
            var manualFile = pathField.text && isAEP(pathField.text) ? new File(pathField.text) : null;
            var diskBase = null;

            if (manualFile){
                diskBase = baseNameNoExt(manualFile.name);
                baseFolder = manualFile.parent.fsName;
            } else {
                diskBase = suggestedBaseName(src) || "Project";
            }

            var folderCandidate = new Folder(baseFolder+"/"+diskBase);
            var fileCandidate   = new File(baseFolder+"/"+diskBase+".aep");
            if (folderCandidate.exists || fileCandidate.exists){
                var pol = collisionPrompt(folderCandidate.exists ? folderCandidate.fsName : fileCandidate.fsName, false, {});
                if (pol===null){ runInProgress=false; startWatcher(); return; }
                if (pol==="suffix") diskBase = nextAvailableBase(baseFolder, diskBase);
            }
            var outFile = new File(baseFolder + "/" + diskBase + ".aep");

            preview.base = baseFolder;
            preview.names = [diskBase + ".aep"];
            if (!aeConfirm(preText(preview.base, preview.names))){ runInProgress=false; startWatcher(); return; }

            var names=[];
            if (src==="comp") oneFromComp(master, outFile, names, diskBase);
            else              oneFromItems(master, outFile, names, diskBase);

            done.base = outFile.parent.fsName; done.names = names;
            aeMsg(postText(done.base, done.names));

            pathField.text = suggestPath();
            startWatcher(); runInProgress=false;
            return;
        }

        var baseFolderTxt = pathField.text;
        if (!baseFolderTxt || isAEP(baseFolderTxt)){
            var chosen = Folder.selectDialog("Choose output folder", new Folder(lastOrDefaultFolder()));
            if (!chosen){ runInProgress=false; startWatcher(); return; }
            baseFolderTxt = chosen.fsName; pathField.text=baseFolderTxt;
        }
        preview.base = baseFolderTxt;

        try{
            if (src==="comp"){
                var c=activeComp();
                if (c.selectedLayers.length===0){ aeMsg("Select at least one layer in the comp."); runInProgress=false; startWatcher(); return; }
                for (var i=0;i<c.selectedLayers.length;i++){
                    var L=c.selectedLayers[i];
                    var nm = (L.source && (L.source instanceof FootageItem)) ? baseNameNoExt(L.source.name) : sanitizeName(L.name);
                    preview.names.push(baseNameNoExt(nm)+".aep");
                }
            } else {
                var a=app.project.selection||[]; if (a.length===0){ aeMsg("Select item(s) in the Project panel."); runInProgress=false; startWatcher(); return; }
                for (var j=0;j<a.length;j++) preview.names.push(baseNameNoExt(a[j].name)+".aep");
            }
        }catch(_){ }

        if (!aeConfirm(preText(preview.base, preview.names))){ runInProgress=false; startWatcher(); return; }

        var mem2={policy:null,applyAll:false}, names2=[];
        if (src==="comp") separateFromComp(master, baseFolderTxt, mem2, names2);
        else              separateFromItems(master, baseFolderTxt, mem2, names2);

        done.base = baseFolderTxt; done.names = names2;
        aeMsg(postText(done.base, done.names));

        runInProgress=false; startWatcher();
    };

    var last=get(S_LAST_PATH);
    if (last && last!=="") pathField.text = last + "/" + ((firstItemDisplayName()||"Project") + ".aep");
    else pathField.text = suggestPath();

    startWatcher();

    try{
        win.onClose = function(){
            stopWatcher();
            try{ set(S_WIN_BOUNDS, {x:win.location.x, y:win.location.y}); }catch(_){ }
        };
    }catch(_){ }

    win.onResizing = win.onResize = function(){ this.layout.resize(); };
    return win;
}

// ==========================================================================
// Wrapper resolution prompt
// ==========================================================================
function wrapperResPrompt(){
    var d=new Window("dialog","Wrapper resolution"); d.orientation="column"; d.margins=12; d.alignChildren=["fill","top"];
    d.add("statictext",undefined,"First selected item has no pixel size. Provide a wrapper comp size:",{multiline:true});
    var r=d.add("group"); r.orientation="row";
    var w=r.add("edittext",undefined,"1920"); w.characters=6;
    var x=r.add("statictext",undefined,"×");
    var h=r.add("edittext",undefined,"1080"); h.characters=6;
    var g=d.add("group"); g.orientation="row"; g.alignment=["right","center"];
    var ok=g.add("button",undefined,"OK"); var cancel=g.add("button",undefined,"Cancel");
    var val=null; ok.onClick=function(){ val={w:Math.max(1,parseInt(w.text,10)||1920), h:Math.max(1,parseInt(h.text,10)||1080)}; d.close(1); };
    cancel.onClick=function(){ val=null; d.close(0); };
    var res=d.show(); if(!res) return null; return {w:val.w, h:val.h};
}

// ==========================================================================
// Boot
// ==========================================================================
	var ui = buildUI(thisObj);
	if (ui instanceof Window && !(thisObj instanceof Panel || thisObj instanceof Group)) { 
		ui.center(); 
		ui.show(); 
	}

})(this);
