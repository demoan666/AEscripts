﻿#target aftereffects
/* ==========================================================================
   TN AE Tools v1.1 — Modular Host (Dynamic Loader)
   Discovers tools in /modules folder and embeds them in tabs
   ========================================================================== */

(function TN_AE_Tools_Host(thisObj) {
    var APP_SECTION = "TN_AE_Tools";
    var KEY_ACTIVE_TAB = "activeTab";

    // ---------- Utils ----------
    function removeExt(n){ return n.replace(/\.(jsx|jsxbin)$/i,""); }
    function parseVersionFromText(t){ var m=/v(\d+(?:\.\d+)?)/i.exec(t||""); return m?m[1]:""; }
    function readSetting(k,def){ 
        try{ 
            if(app.settings.haveSetting(APP_SECTION,k)) 
                return app.settings.getSetting(APP_SECTION,k);
        }catch(e){} 
        return def; 
    }
    function writeSetting(k,v){ 
        try{ 
            app.settings.saveSetting(APP_SECTION,k,String(v)); 
        }catch(e){} 
    }

    function getHostFolder(){
        try {
            if (typeof $.fileName === "string" && $.fileName.length){
                var f = new File($.fileName);
                if (f && f.parent && f.parent.exists) return f.parent;
            }
        } catch(e){}
        
        try {
            var stack = $.stack || "";
            var lines = stack.split("\n");
            if (lines.length > 0) {
                var firstLine = lines[0].replace(/^\[/, "").replace(/\].*$/, "");
                var f = new File(firstLine);
                if (f && f.parent && f.parent.exists) return f.parent;
            }
        } catch(e){}
        
        alert("[Warning] Host folder unresolved. Using Folder.current.");
        return Folder.current;
    }

    function getModulesFolder(){ 
        return new Folder(getHostFolder().fsName + "/modules"); 
    }

    function listModuleFiles(){
        var mf = getModulesFolder();
        if (!mf.exists) {
            alert("[Error] Modules folder not found:\n" + mf.fsName);
            return [];
        }
        
        var out = [];
        var jsxFiles = mf.getFiles("*.jsx");
        var jsxbinFiles = mf.getFiles("*.jsxbin");
        
        if (jsxFiles) {
            for (var i = 0; i < jsxFiles.length; i++) {
                if (jsxFiles[i] instanceof File) out.push(jsxFiles[i]);
            }
        }
        if (jsxbinFiles) {
            for (var i = 0; i < jsxbinFiles.length; i++) {
                if (jsxbinFiles[i] instanceof File) out.push(jsxbinFiles[i]);
            }
        }
        
        return out;
    }

    function getDisplayTitle(f){
        var base = removeExt(f.name);
        // Remove version number
        var m = /(.*)\s+v\d+(?:\.\d+)?/i.exec(base);
        var title = m ? m[1] : base;
        // Decode URL-encoded characters (like %20 for space)
        title = decodeURI(title);
        return title;
    }
    
    function getVersion(f){ 
        return parseVersionFromText(f.name) || ""; 
    }

    // ---------- Load Module Into Tab ----------
    function loadModuleIntoTab(moduleFile, tabContainer) {
        try {
            // Read the module file
            if (!moduleFile.exists) {
                throw new Error("Module file not found: " + moduleFile.fsName);
            }

            moduleFile.open("r");
            var moduleCode = moduleFile.read();
            moduleFile.close();

            // Instead of wrapping, we need to execute the module with the tab as thisObj
            // The module code is wrapped in (function TN_ModuleName(thisObj){ ... })(this);
            // We need to replace 'this' with our tab container
            
            // Find the last occurrence of })(this); and replace 'this' with our container reference
            var lastParen = moduleCode.lastIndexOf("})(this);");
            if (lastParen > -1) {
                // Store tab reference in global scope temporarily
                $.global.__TN_TAB_CONTAINER__ = tabContainer;
                
                // Replace (this) with reference to our stored container
                moduleCode = moduleCode.substring(0, lastParen) + "})($.global.__TN_TAB_CONTAINER__);";
                
                // Execute the modified module code
                eval(moduleCode);
                
                // Clean up global reference
                delete $.global.__TN_TAB_CONTAINER__;
            } else {
                // Fallback: try direct eval with thisObj set
                throw new Error("Module format not recognized - expected (function...)(this) pattern");
            }

            return true;

        } catch(err) {
            // Show error in the tab
            tabContainer.orientation = "column";
            tabContainer.alignChildren = ["fill", "top"];
            tabContainer.margins = 20;
            
            var errorTitle = tabContainer.add("statictext", undefined, "Error Loading Module");
            errorTitle.graphics.font = ScriptUI.newFont(errorTitle.graphics.font.name, "Bold", 14);
            
            tabContainer.add("statictext", undefined, "");
            tabContainer.add("statictext", undefined, "Module: " + moduleFile.name);
            tabContainer.add("statictext", undefined, "");
            
            var errorMsg = tabContainer.add("statictext", undefined, err.toString(), {multiline: true});
            errorMsg.preferredSize = [350, 100];
            
            tabContainer.add("statictext", undefined, "");
            
            var launchBtn = tabContainer.add("button", undefined, "Try Launch Separately");
            launchBtn.onClick = function() {
                try {
                    $.evalFile(moduleFile);
                } catch(e) {
                    alert("Failed to launch: " + e.toString());
                }
            };
            
            return false;
        }
    }

    // ---------- Settings Tab ----------
    function buildSettingsUI(container) {
        container.orientation = "column";
        container.alignChildren = ["fill", "top"];
        container.spacing = 15;
        container.margins = 20;

        var title = container.add("statictext", undefined, "TN AE Tools v1.1");
        title.graphics.font = ScriptUI.newFont(title.graphics.font.name, "Bold", 16);
        title.alignment = ["center", "top"];

        container.add("statictext", undefined, "");

        var infoPanel = container.add("panel", undefined, "Information");
        infoPanel.orientation = "column";
        infoPanel.alignChildren = ["fill", "top"];
        infoPanel.margins = 15;
        infoPanel.spacing = 8;

        infoPanel.add("statictext", undefined, "Modular AE Tools Suite");
        infoPanel.add("statictext", undefined, "Version: 1.1");
        infoPanel.add("statictext", undefined, "");
        
        var modulesFolder = getModulesFolder();
        infoPanel.add("statictext", undefined, "Modules folder:");
        var pathText = infoPanel.add("statictext", undefined, modulesFolder.fsName, {multiline: true});
        pathText.preferredSize = [350, 40];
        
        infoPanel.add("statictext", undefined, "");
        
        var moduleFiles = listModuleFiles();
        infoPanel.add("statictext", undefined, "Loaded " + moduleFiles.length + " module(s):");
        
        for (var i = 0; i < moduleFiles.length; i++) {
            infoPanel.add("statictext", undefined, "  • " + moduleFiles[i].name);
        }

        container.add("statictext", undefined, "");

        var actionsPanel = container.add("panel", undefined, "Actions");
        actionsPanel.orientation = "column";
        actionsPanel.alignChildren = ["center", "top"];
        actionsPanel.margins = 15;
        actionsPanel.spacing = 10;

        var openFolderBtn = actionsPanel.add("button", undefined, "Open Modules Folder");
        openFolderBtn.preferredSize = [180, 30];
        openFolderBtn.onClick = function() {
            try {
                modulesFolder.execute();
            } catch(e) {
                alert("Could not open folder:\n" + e.toString());
            }
        };

        actionsPanel.add("statictext", undefined, "");

        var reloadBtn = actionsPanel.add("button", undefined, "Reload Tools");
        reloadBtn.preferredSize = [180, 30];
        reloadBtn.onClick = function() {
            alert("Please close and reopen TN AE Tools to reload modules.");
        };

        container.add("statictext", undefined, "");

        return container;
    }

    // ---------- Main UI Builder ----------
    function buildUI(thisObj) {
        var isPanel = (thisObj instanceof Panel);
        var win;
        
        try {
            if (isPanel) {
                win = thisObj;
            } else {
                win = new Window("palette", "TN AE Tools v1.1", undefined, {resizeable: true});
                win.preferredSize = [500, 650];
            }
        } catch(e) {
            alert("Failed to create window: " + e.toString());
            return null;
        }
        
        win.orientation = "column";
        win.alignChildren = ["fill", "fill"];
        win.spacing = 0;
        win.margins = 8;

        // Simple header
        var header = win.add("group");
        header.orientation = "row";
        header.alignChildren = ["center", "center"];
        header.alignment = ["fill", "top"];
        header.margins = [0, 5, 0, 10];
        
        var title = header.add("statictext", undefined, "TN AE Tools v1.1");
        title.graphics.font = ScriptUI.newFont(title.graphics.font.name, "Bold", 14);
        title.alignment = ["center", "center"];

        // Tab container with padding
        var tabContainer = win.add("group");
        tabContainer.orientation = "column";
        tabContainer.alignment = ["fill", "fill"];
        tabContainer.margins = [5, 0, 5, 5];

        var tabs = tabContainer.add("tabbedpanel");
        tabs.alignChildren = ["left", "top"]; // Top-left alignment
        tabs.alignment = ["fill", "fill"];
        
        // Force horizontal scrolling with arrows instead of dropdown
        try {
            tabs.properties = {scrollable: true};
        } catch(e) {}
        
        try {
            tabs.preferredSize = [490, 600];
            tabs.minimumSize = [300, 400];
        } catch(e) {}

        // Get module files
        var moduleFiles = listModuleFiles();
        
        if (moduleFiles.length === 0) {
            var emptyTab = tabs.add("tab", undefined, "No Modules");
            emptyTab.orientation = "column";
            emptyTab.alignChildren = ["center", "center"];
            emptyTab.alignment = ["fill", "fill"];
            
            emptyTab.add("statictext", undefined, "No modules found!");
            emptyTab.add("statictext", undefined, "");
            emptyTab.add("statictext", undefined, "Expected location:");
            emptyTab.add("statictext", undefined, getModulesFolder().fsName);
            
            var openBtn = emptyTab.add("button", undefined, "Open Modules Folder");
            openBtn.onClick = function() {
                try { 
                    getModulesFolder().execute(); 
                } catch(e) { 
                    alert("Cannot open: " + e.toString()); 
                }
            };
            
        } else {
            // Order modules as specified
            var targetOrder = [
                "TN Shape Cleaner v1.1.jsx",
                "TN Trim Animation v1.1.jsx", 
                "TN Promote to EGP v1.1.jsx",
                "TN Save to AEP v1.1.jsx"
            ];
            
            // Create ordered list (case-insensitive)
            var orderedFiles = [];
            var usedFiles = {};
            
            // Add files in target order
            for (var i = 0; i < targetOrder.length; i++) {
                for (var j = 0; j < moduleFiles.length; j++) {
                    if (moduleFiles[j].name.toLowerCase() === targetOrder[i].toLowerCase() && !usedFiles[moduleFiles[j].name]) {
                        orderedFiles.push(moduleFiles[j]);
                        usedFiles[moduleFiles[j].name] = true;
                        break;
                    }
                }
            }
            
            // Add remaining files not in target order
            for (var i = 0; i < moduleFiles.length; i++) {
                if (!usedFiles[moduleFiles[i].name]) {
                    orderedFiles.push(moduleFiles[i]);
                }
            }

            // Create tabs and load modules
            for (var i = 0; i < orderedFiles.length; i++) {
                var moduleFile = orderedFiles[i];
                var tabName = getDisplayTitle(moduleFile);
                
                // Create tab
                var tab = tabs.add("tab", undefined, tabName);
                tab.orientation = "column";
                tab.alignChildren = ["left", "top"]; // Top-left alignment
                tab.alignment = ["fill", "fill"];
                tab.margins = 0;
                tab.spacing = 0;
                
                // Load module into this tab
                loadModuleIntoTab(moduleFile, tab);
            }
        }

        // Settings tab (always present)
        var settingsTab = tabs.add("tab", undefined, "Settings");
        buildSettingsUI(settingsTab);

        // --- Decorative Logo (always visible, bottom-right, 20px offsets, actual size, non-interactive) ---
        // Placed in a dedicated footer group that stays outside/under the tabbed panel.
        var footer = win.add("group");
        footer.orientation = "row";
        footer.alignment = ["fill", "bottom"];
        // Inside padding: left, top, right, bottom -> right/bottom = 20px offsets for the image
        footer.margins = [0, 0, 20, 20];
        footer.alignChildren = ["right", "bottom"];

        // Flexible spacer to push the logo all the way to the right
        var _spacer = footer.add("group");
        _spacer.alignment = ["fill", "fill"];

        // Logo container (no interactivity)
        var logoHolder = footer.add("group");
        logoHolder.orientation = "row";
        logoHolder.alignment = ["right", "bottom"];
        logoHolder.enabled = false; // ensures decorative-only, non-clickable behavior

        try {
            var logoPath = getHostFolder().fsName + "/assets/icons/TriNet_Logo.png";
            var logoFile = new File(logoPath);
            if (logoFile.exists) {
                // Add at native size (no preferredSize set)
                logoHolder.add("image", undefined, logoFile);
            } else {
                // If not found, we keep silent per "decorative only" requirement (no alerts).
                // (No fallback UI so nothing else in the script is affected.)
            }
        } catch (e) {
            // Swallow any decorative-load error to avoid affecting main tool.
        }
        // --- End Decorative Logo ---

        // Tab change handler
        tabs.onChange = function() {
            try {
                if (tabs.selection && tabs.selection.text) {
                    writeSetting(KEY_ACTIVE_TAB, tabs.selection.text);
                }
                
                // Trigger layout update for active tab
                if (tabs.selection && tabs.selection.layout) {
                    tabs.selection.layout.layout(true);
                }
            } catch(e) {}
        };

        // Restore last active tab
        var lastTab = readSetting(KEY_ACTIVE_TAB, "");
        if (lastTab && tabs.children.length > 0) {
            for (var i = 0; i < tabs.children.length; i++) {
                if (tabs.children[i].text === lastTab) {
                    tabs.selection = tabs.children[i];
                    break;
                }
            }
        }
        if (!tabs.selection && tabs.children.length > 0) {
            tabs.selection = tabs.children[0];
        }

        // Show window
        if (!isPanel) {
            win.center();
            win.show();
        }
        
        // Handle window resizing
        win.onResizing = win.onResize = function() {
            this.layout.resize();
        };

        return win;
    }

    // Initialize
    try {
        buildUI(thisObj);
    } catch(err) {
        alert("TN AE Tools failed to start:\n" + err.toString());
    }

})(this);
