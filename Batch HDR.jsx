﻿#target photoshop

/*********************************************************************
 Batch HDR Script by David Milligan
*********************************************************************/

/*********************************************************************
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
**********************************************************************/

/*
// BEGIN__HARVEST_EXCEPTION_ZSTRING

<javascriptresource>
<name>Batch HDR...</name>
<menu>automate</menu>
</javascriptresource>

// END__HARVEST_EXCEPTION_ZSTRING
*/

//these lines import the 'Merge To HDR.jsx' script that is built in to photoshop, we will make calls to that script and some of the scripts that it includes
var runMergeToHDRFromScript = true;
var g_ScriptFolderPath = app.path + "/"+ localize("$$$/ScriptingSupport/InstalledScripts=Presets/Scripts");
var g_ScriptPath = File( g_ScriptFolderPath+'/Merge To HDR.jsx' );
$.evalFile( g_ScriptPath ); 
//$.level = 2;

//default settings:
mergeToHDR.useAlignment = false;
mergeToHDR.useACRToning = false;
var numberOfBrackets = 3;
var userCanceled = false;
var sourceFolder;
var outputFolder;
var saveType = "JPEG";
var jpegQuality = 10;
var progress;
var statusText;
var progressWindow;
var fileMask = "*";
var outputFilename = "hdr_output_";
var zeroPadding = 5;

var hdrRadius = 100;
var hdrStrength = 0.5;
var hdrGamma = 1.0;
var hdrExposure = 0.0;
var hdrDetail = 100;
var hdrShadow = 0;
var hdrHighlights = 0;
var hdrVibrance = 20;
var hdrSaturation = 30;
var hdrSmooth = false;
var hdrDeghosting = false;
var hdrCurve = "0,0,255,255";
var estTimeRemaining = "";

var previewDoc;
var originalDoc;

function main()
{
    promptUser();
    
    //make sure user didn't cancel
    if(sourceFolder != null && outputFolder != null && sourceFolder.exists && outputFolder.exists && numberOfBrackets > 0)
    {
        initializeProgress();
        var files =  sourceFolder.getFiles(fileMask);
        var currentFileList = new Array();

        var numberOfFiles = files.length;

        /* convert numberOfFiles to a string to make sure zeropadding is high enough to cover all files */
        var numberOfFilesStr = "" + numberOfFiles;
        if (zeroPadding > 0 && zeroPadding < numberOfFilesStr.length)
        {
            zeroPadding = numberOfFilesStr.length;
        }

        for(var index = 0;  index < numberOfFiles; index++)
        {
            if((index % numberOfBrackets) == numberOfBrackets - 1)
            {
                var start = new Date();
                progress.value = 100 * index / numberOfFiles;
                currentFileList.push(files[index]);
                if(userCanceled) break;
                if(numberOfBrackets > 1)
                {
                    statusText.text = "Merging files "+(index-numberOfBrackets+2)+" - "+(index+1)+" of "+numberOfFiles + estTimeRemaining;
                    //for braketed exposures use the mergeToHDR script to merge the files into a single 32 bit image
                    mergeToHDR.outputBitDepth= 32;
                    
                    mergeToHDR.mergeFilesToHDR( currentFileList, false, hdrDeghosting ? kMergeToHDRDeghostBest : kMergeToHDRDeghostOff );
                    statusText.text = "Toning files "+(index-numberOfBrackets+2)+" - "+(index+1)+" of "+numberOfFiles+ estTimeRemaining;
                }
                else
                {
                    statusText.text = "Loading file "+(index+1)+" of "+numberOfFiles+ estTimeRemaining;
                    //otherwise just open the file
                    doOpenFile(files[index]);
                    statusText.text = "Toning file "+(index+1)+" of "+numberOfFiles+ estTimeRemaining;
                }
                progress.value = 100 * (index + numberOfBrackets / 2 ) / numberOfFiles;
                if(userCanceled) break;
                if(app.activeDocument != null)
                {
                    //apply the actual tone mapping to the HDR image to get it back down to 8 bits
                    doHDRToning();
                }
                
                //save the result and close
                //TODO: add leading zeros to index in filename
                
                if(numberOfBrackets > 1)
                {
                    statusText.text = "Saving result "+(index-numberOfBrackets+2)+" - "+(index+1)+" of "+numberOfFiles+ estTimeRemaining;
                }
                else
                {
                    statusText.text = "Saving result "+(index+1)+" of "+numberOfFiles+ estTimeRemaining;
                }
                if(userCanceled) break;
                doSaveFile(outputFolder.absoluteURI + "/" + outputFilename + ZeroPad(Math.round((index + 1)/numberOfBrackets), zeroPadding) );
                activeDocument.close(SaveOptions.DONOTSAVECHANGES);
                
                //reset our file list
                currentFileList = new Array();
                
                //calculate time remaining
                var end = new Date();
                var timeElapsed = end.getTime() - start.getTime();
                var mins = timeElapsed / 60000 * ((numberOfFiles - index - 1) / numberOfBrackets);
                estTimeRemaining = " | Remaining: " + ZeroPad((mins / 60).toFixed(0),2) + ":" + ZeroPad((mins % 60).toFixed(0),2);
            }
            else
            {
                currentFileList.push(files[index]);
            }
        }
        progressWindow.hide();
    }
}

function doOpenFile(filename)
{
    
    const eventOpen = app.charIDToTypeID('Opn ');
    var desc = new ActionDescriptor();
    desc.putPath( typeNULL, new File( filename ) );
    desc.putBoolean( kpreferXMPFromACRStr, true ); //not sure what this does or if it is needed
    executeAction( eventOpen, desc, DialogModes.NO );
    //if we don't convert the image to 32bit the mergeToHDR script will not tone our image when we call it, it will simply downconvert it to 8 bit
    convertTo32Bit ();
}

function convertTo32Bit()
{
    var idCnvM = charIDToTypeID( "CnvM" );
    var desc6 = new ActionDescriptor();
    var idDpth = charIDToTypeID( "Dpth" );
    desc6.putInteger( idDpth, 32 );
    var idMrge = charIDToTypeID( "Mrge" );
    desc6.putBoolean( idMrge, false );
    var idRstr = charIDToTypeID( "Rstr" );
    desc6.putBoolean( idRstr, false );
    executeAction( idCnvM, desc6, DialogModes.NO );
}

function doSaveFile(filename)
{
    switch(saveType)
    {
        case "JPEG":
            var jpgSaveOptions = new JPEGSaveOptions();
            jpgSaveOptions.embedColorProfile = true;
            jpgSaveOptions.formatOptions = FormatOptions.STANDARDBASELINE;
            jpgSaveOptions.matte = MatteType.NONE;
            jpgSaveOptions.quality = jpegQuality;
            activeDocument.saveAs(new File(filename), jpgSaveOptions, true /*Save As Copy*/, Extension.LOWERCASE /*Append Extention*/);
            break;

        case "TIFF":
            var tifSaveOptions = new TiffSaveOptions();
            tifSaveOptions.embedColorProfile = true;
            activeDocument.saveAs(new File(filename), tifSaveOptions, true /*Save As Copy*/, Extension.LOWERCASE /*Append Extention*/);
            break;

        case "TIFF LZW":
            var tifSaveOptions = new TiffSaveOptions();
            tifSaveOptions.embedColorProfile = true;
            tifSaveOptions.imageCompression = TIFFEncoding.TIFFLZW;
            activeDocument.saveAs(new File(filename), tifSaveOptions, true /*Save As Copy*/, Extension.LOWERCASE /*Append Extention*/);
            break;

        case "TIFF ZIP":
            var tifSaveOptions = new TiffSaveOptions();
            tifSaveOptions.embedColorProfile = true;
            tifSaveOptions.imageCompression = TIFFEncoding.TIFFZIP;
            activeDocument.saveAs(new File(filename), tifSaveOptions, true /*Save As Copy*/, Extension.LOWERCASE /*Append Extention*/);
            break;

        default:
            activeDocument.saveAs(new File(filename), undefined, true /*Save As Copy*/, Extension.LOWERCASE /*Append Extention*/);
            break;
    }
}

function doHDRToning()
{
    //TODO: Reverse engineer the HDR Preset file format and allow user to select a preset file and create the ActionDescriptor from the file
    
    //create the ActionDescriptor that describes the HDR toning settings to use
    var hdDesc = new ActionDescriptor;
    hdDesc.putInteger( stringIDToTypeID( 'version' ), 6 );//I'm not sure what this does
    hdDesc.putInteger(  kmethodStr, 3 );// the toning method to use, 3 = local adaptation
    hdDesc.putDouble( stringIDToTypeID( 'radius' ), hdrRadius );
    hdDesc.putDouble( stringIDToTypeID( 'threshold' ), hdrStrength );// strength
    hdDesc.putDouble( stringIDToTypeID( 'center' ), hdrGamma );// gamma
    hdDesc.putDouble( stringIDToTypeID( 'brightness' ), hdrExposure );// exposure
    hdDesc.putDouble( stringIDToTypeID( 'detail' ), hdrDetail );
    hdDesc.putDouble( stringIDToTypeID( 'shallow' ), hdrShadow );
    hdDesc.putDouble( stringIDToTypeID( 'highlights' ), hdrHighlights );
    hdDesc.putDouble( stringIDToTypeID( 'vibrance' ), hdrVibrance );
    hdDesc.putDouble( stringIDToTypeID( 'saturation' ), hdrSaturation);
    hdDesc.putBoolean( stringIDToTypeID( 'smooth' ), hdrSmooth );
    hdDesc.putBoolean( stringIDToTypeID( 'deghosting' ), hdrDeghosting );
    
    //create the tone curve
    var cDesc = new ActionDescriptor;
    cDesc.putString( stringIDToTypeID( 'name' ), 'Default');
    var cList = new ActionList;
    var points = hdrCurve.split(',');
    for(var i = 0; i < points.length; i++)
    {
        if(i % 2 == 1)
        {
            var pDesc = new ActionDescriptor;
            pDesc.putDouble( stringIDToTypeID( 'horizontal' ), points[i-1] );
            pDesc.putDouble( stringIDToTypeID( 'vertical' ), points[i] );
            pDesc.putBoolean( keyContinuity , false );// ?????
            cList.putObject( charIDToTypeID( 'Pnt ' ), pDesc );
        }
    }
    cDesc.putList( stringIDToTypeID( 'curve' ), cList );
    hdDesc.putObject( kclassContour, classShapingCurve, cDesc );
    
    //call the script that actually invokes the toning plugin
    convertFromHDRNoDialog( outputBitDepth, hdDesc );
}

function initializeProgress()
{
    progressWindow = new Window("palette { text:'Batch HDR Progress', \
        statusText: StaticText { text: 'Processing Images...', preferredSize: [350,20] }, \
        progressGroup: Group { \
            progress: Progressbar { minvalue: 0, maxvalue: 100, value: 0, preferredSize: [300,20] }, \
            cancelButton: Button { text: 'Cancel' } \
        } \
    }");
    statusText = progressWindow.statusText;
    progress = progressWindow.progressGroup.progress;
    progressWindow.progressGroup.cancelButton.onClick = function() { userCanceled = true; }
    progressWindow.show();
}

function promptUser()
{
    var setupWindow = new Window("dialog { orientation: 'row', text: 'Batch HDR', alignChildren:'top', \
        leftGroup: Group { orientation: 'column', alignChildren:'fill', \
            inputPanel: Panel { text: 'Input', \
                sourceGroup: Group { \
                    sourceBox: EditText { characters: 40, text: '' }, \
                    sourceBrowse: Button { text: 'Browse' } \
                }, \
                bracketGroup: Group{ \
                    bracketLabel: StaticText { text: 'Number of Brackets: ' }, \
                    bracketBox: EditText { characters: 2 }, \
                    filterLabel: StaticText { text: 'File Filter: ' }, \
                    filterText: EditText { characters: 5 }, \
                    alignCheckBox: Checkbox { text: 'Align' }\
                    deghostCheckBox: Checkbox { text: 'Deghost' }\
                } \
            }, \
            toningPanel: Panel { text: 'Toning', orientation:'row', alignChildren:'top' } ,\
            outputPanel: Panel { text: 'Output', \
                outputGroup: Group { \
                    outputBox: EditText { characters: 40, text: '' }, \
                    outputBrowse: Button { text: 'Browse' } \
                }, \
                outputOptionsGroup: Group { \
                    outputFilenameLabel: StaticText { text: 'Filename Format: ' }, \
                    outputFilenameText: EditText { characters: 10 }, \
                    outputFilenamePost: StaticText { text: '00001.jpg' }, \
                    zeroPaddingGroup: Group { \
                        outputFilenamePaddingLabel: StaticText { text: 'Zero Padding:'}, \
                        outputFilenamePaddingText: EditText { characters: 2, text: '5'}, \
                    } \
                }, \
                saveSettingsGroup: Group { \
                    saveTypeLabel: StaticText { text: 'Save As: ' }, \
                    saveDropDown: DropDownList { }, \
                    jpegQualityLabel: StaticText { text: 'JPEG Quality (1-10): ' }, \
                    jpegQualityText: EditText { characters: 2}, \
                    outputBitDepthLabel: StaticText { text: 'Bit Depth', enabled:false }, \
                    outputBitDepthDropDown: DropDownList { enabled:false }, \
                } \
            } \
        }, \
        rightGroup: Group { orientation: 'column', alignChildren:'fill', \
            okButton: Button { text: 'OK', enabled: false } \
            cancelButton: Button { text: 'Cancel' } \
        } \
    } ");
    
    generateToningPanel(setupWindow.leftGroup.toningPanel);
    
    //shortcut variables
    var sourceBox = setupWindow.leftGroup.inputPanel.sourceGroup.sourceBox;
    var sourceBrowse = setupWindow.leftGroup.inputPanel.sourceGroup.sourceBrowse;
    var bracketBox = setupWindow.leftGroup.inputPanel.bracketGroup.bracketBox;
    var filterText = setupWindow.leftGroup.inputPanel.bracketGroup.filterText;
    var alignCheckBox = setupWindow.leftGroup.inputPanel.bracketGroup.alignCheckBox;
    var outputBox = setupWindow.leftGroup.outputPanel.outputGroup.outputBox;
    var outputBrowse = setupWindow.leftGroup.outputPanel.outputGroup.outputBrowse;
    var outputFilenameText = setupWindow.leftGroup.outputPanel.outputOptionsGroup.outputFilenameText;
    var outputFilenamePost = setupWindow.leftGroup.outputPanel.outputOptionsGroup.outputFilenamePost;
    var outputFilenamePaddingText = setupWindow.leftGroup.outputPanel.outputOptionsGroup.zeroPaddingGroup.outputFilenamePaddingText;
    var saveDropDown = setupWindow.leftGroup.outputPanel.saveSettingsGroup.saveDropDown;
    var jpegQualityText = setupWindow.leftGroup.outputPanel.saveSettingsGroup.jpegQualityText;
    var jpegQualityLabel = setupWindow.leftGroup.outputPanel.saveSettingsGroup.jpegQualityLabel;
    var outputBitDepthDropDown = setupWindow.leftGroup.outputPanel.saveSettingsGroup.outputBitDepthDropDown;
    var outputBitDepthLabel = setupWindow.leftGroup.outputPanel.saveSettingsGroup.outputBitDepthLabel;
    var okButton = setupWindow.rightGroup.okButton;
    var cancelButton = setupWindow.rightGroup.cancelButton;
    var toningPanel = setupWindow.leftGroup.toningPanel;
    var deghostCheckBox = setupWindow.leftGroup.inputPanel.bracketGroup.deghostCheckBox;
    
    //set default values
    bracketBox.text = numberOfBrackets;
    filterText.text = fileMask;
    alignCheckBox.value = mergeToHDR.useAlignment;
    deghostCheckBox.value = hdrDeghosting;
    outputFilenameText.text = outputFilename;
    outputFilenamePaddingText.text = zeroPadding;
    jpegQualityText.text = jpegQuality;
    saveDropDown.add("item", "JPEG");
    saveDropDown.add("item", "TIFF");
    saveDropDown.add("item", "TIFF LZW");
    saveDropDown.add("item", "TIFF ZIP");
    saveDropDown.add("item", "PSD");
    saveDropDown.selection = 0;
    outputBitDepthDropDown.add("item", "8");
    outputBitDepthDropDown.add("item", "16");
    outputBitDepthDropDown.add("item", "32");
    outputBitDepthDropDown.selection = 0;
    
    //event handlers
    sourceBox.onChange = function()
    {
        sourceFolder = new Folder(sourceBox.text);
        okButton.enabled = sourceFolder != null && outputFolder != null && sourceFolder.exists && outputFolder.exists;
    };
    sourceBrowse.onClick = function()
    {
        sourceFolder = Folder.selectDialog ("Select the source folder");
        if(sourceFolder != null)
        {
            sourceBox.text = sourceFolder.fullName;

            if (outputFolder == null)
            {
                outputFolder = sourceFolder;
                outputBox.text = outputFolder.fullName;
            }
        }
        okButton.enabled = sourceFolder != null && outputFolder != null && sourceFolder.exists && outputFolder.exists;
    };
    bracketBox.onChange = function() { numberOfBrackets = bracketBox.text; };
    filterText.onChange = function() { fileMask = filterText.text; };
    alignCheckBox.onChanged = function() { mergeToHDR.useAlignment = alignCheckBox.value; };
    deghostCheckBox.onChanged = function() { hdrDeghosting = deghostCheckBox.value; };
    outputBox.onChange = function()
    {
        outputFolder = new Folder(outputBox.text);
        okButton.enabled = sourceFolder != null && outputFolder != null && sourceFolder.exists && outputFolder.exists;
    };
    outputBrowse.onClick = function()
    {
        outputFolder = Folder.selectDialog ("Select the output folder");
        if(outputFolder != null)
        {
            outputBox.text = outputFolder.fullName;
        }
        okButton.enabled = sourceFolder != null && outputFolder != null && sourceFolder.exists && outputFolder.exists;
    };
    outputFilenameText.onChange = function() { outputFilename = outputFilenameText.text; };

    outputFilenamePaddingText.onChange = function()
    {  
        var paddingNumber = parseInt(this.text);

        if (!isNaN(paddingNumber))
        {
            zeroPadding = paddingNumber;
            outputFilenamePost.text = ZeroPad('1', zeroPadding) + '.jpg';
        }
    };

    saveDropDown.onChange = function()
    {
        saveType = saveDropDown.selection.text;
        jpegQualityText.enabled = saveDropDown.selection.text == "JPEG";
        jpegQualityLabel.enabled = saveDropDown.selection.text == "JPEG";
        if(saveDropDown.selection.text == "JPEG")
        {
            outputBitDepthDropDown.selection = 0;
        }
        outputBitDepthDropDown.enabled = saveDropDown.selection.text != "JPEG";
        outputBitDepthLabel.enabled = saveDropDown.selection.text != "JPEG";
        
    };
    jpegQualityText.onChange = function() { jpegQuality = jpegQualityText.text; };
    outputBitDepthDropDown.onChange = function()
    { 
        outputBitDepth = outputBitDepthDropDown.selection.text; 
        toningPanel.enabled = outputBitDepth != 32;
    }
    okButton.onClick = function() { setupWindow.hide(); cleanUpPreviews(); };
    cancelButton.onClick = function() { sourceFolder = null, setupWindow.hide(); cleanUpPreviews(); };
    
    saveDropDown.onChange();
    outputBitDepthDropDown.onChange();
    
    setupWindow.show();
}

function cleanUpPreviews()
{
    if(originalDoc != null)
    {
        originalDoc.close(SaveOptions.DONOTSAVECHANGES);
        originalDoc = null;
    }
    if(previewDoc != null)
    {
        previewDoc.close(SaveOptions.DONOTSAVECHANGES);
        previewDoc = null;
    }
}

function generateToningPanel(toningPanel)
{
    var leftToningGroup = toningPanel.add("group{orientation:'column',alignChildren:'fill'}");
    var rightToningGroup = toningPanel.add("group{orientation:'column',alignChildren:'fill'}");
    var presetGroup = leftToningGroup.add("group{orientation:'row'}");
    var presetDropDown = presetGroup.add("dropdownlist");
    var loadPresetButton = presetGroup.add("button", undefined, "Load Preset");
    var edgePanel = leftToningGroup.add("panel",undefined,"Edge Glow");
    var radiusSlider = createSliderControl(edgePanel.add("group"), "  Radius: ", "px", 0, 500, 0, hdrRadius, function(newValue){ hdrRadius = newValue; });
    var strengthSlider = createSliderControl(edgePanel.add("group"), "Strength: ", "", 0, 4.0, 2, hdrStrength, function(newValue){ hdrStrength = newValue; });
    var edgeGroup = edgePanel.add("group");
    var smoothEdgesBox = edgeGroup.add("checkbox",undefined, "Smooth Edges");
    var detailPanel = leftToningGroup.add("panel",undefined,"Tone and Detail");
    var gammaSlider = createSliderControl(detailPanel.add("group"), "  Gamma: ", "", 0.1, 2.0, 2, hdrGamma, function(newValue){ hdrGamma = newValue; });
    var exposureSlider = createSliderControl(detailPanel.add("group"), "Exposure: ", "", -5.0, 5.0, 2, hdrExposure, function(newValue){ hdrExposure = newValue; });
    var detailSlider = createSliderControl(detailPanel.add("group"), "     Detail: ", "%", -300, 300, 0, hdrDetail, function(newValue){ hdrDetail = newValue; });
    var advancedPanel = leftToningGroup.add("panel",undefined,"Advanced");
    var shadowSlider = createSliderControl(advancedPanel.add("group"), "  Shadow: ", "%", -100, 100, 0, hdrShadow, function(newValue){ hdrShadow = newValue; });
    var highlightSlider = createSliderControl(advancedPanel.add("group"), " Highlight: ", "%",  -100, 100, 0, hdrHighlights, function(newValue){ hdrHighlights = newValue; });
    var vibranceSlider = createSliderControl(advancedPanel.add("group"), "  Vibrance: ", "%",  -100, 100, 0, hdrVibrance, function(newValue){ hdrVibrance = newValue; });
    var saturationSlider = createSliderControl(advancedPanel.add("group"), "Saturation: ", "%",  -100, 100, 0, hdrSaturation, function(newValue){ hdrSaturation = newValue; });
    var toningCurvePanel = leftToningGroup.add("panel{text:'Toning Curve',alignChildren:'fill'}");
    var curveBox = toningCurvePanel.add("edittext", undefined, hdrCurve);
    //right side (preview panel)
    var previewGroup = rightToningGroup.add("panel", undefined, "Preview");
    var selectPreviewButton = previewGroup.add("button",undefined,"Select File(s)...");
    var previewButton = previewGroup.add("button",undefined,"Update Preview");
    var zoomGroup = previewGroup.add("group");
    zoomGroup.add("statictext",undefined, "zoom");
    var zoomBox = zoomGroup.add("edittext { text: '100', characters: 3, enabled: false } ");
    var previewZoomSlider = previewGroup.add("slider { minvalue: 10, maxvalue: 200, value: 100, enabled: false }");
    
    //default values
    smoothEdgesBox.value = hdrSmooth;
    previewButton.enabled = app.documents.length > 0;
    var presetFiles = getPresetFiles();
    var updateSliders = function()
    {
        radiusSlider(hdrRadius);
        strengthSlider(hdrStrength);
        smoothEdgesBox.value = hdrSmooth;
        exposureSlider(hdrExposure);
        gammaSlider(hdrGamma);
        detailSlider(hdrDetail);
        shadowSlider(hdrShadow);
        highlightSlider(hdrHighlights);
        vibranceSlider(hdrVibrance);
        saturationSlider(hdrSaturation);
        curveBox.text = hdrCurve;
    }
    if(presetFiles.length > 0)
    {
        for(var f in presetFiles)
        {
            presetDropDown.add("item", presetFiles[f].displayName.replace(".hdt",""));
        }
        presetDropDown.selection = 0;
        loadPreset(presetFiles[0]);
        presetDropDown.onChange = function()
        {
            loadPreset(presetFiles[presetDropDown.selection.index]);
            updateSliders();
        };
    }
    
    //event handlers
    loadPresetButton.onClick = function()
    {
        loadPreset(null);
        updateSliders();
    };
    smoothEdgesBox.onChange = function () { hdrSmooth = smoothEdgesBox.value; };
    curveBox.onChange = function () { hdrCurve = curveBox.text; };
    selectPreviewButton.onClick = function()
    {
        var selectedFiles = File.openDialog("Select file(s) to load for preview", function(){return true;}, true);
        if(selectedFiles != null)
        {
            cleanUpPreviews();
            if(selectedFiles instanceof Array)
            {
                if(selectedFiles.length > 1)
                {
                    mergeToHDR.outputBitDepth= 32;
                    mergeToHDR.mergeFilesToHDR( selectedFiles, false, -2 );
                }
                else
                {
                    doOpenFile(selectedFiles[0].fullName);
                }
            }
            else
            {
                doOpenFile(selectedFiles.fullName);
            }
            originalDoc = app.activeDocument;
            previewButton.enabled = originalDoc != null;
            zoomBox.text = getZoomLevel();
            previewZoomSlider.value = getZoomLevel();
        }
    };
    previewButton.onClick = function()
    {
        if(originalDoc != null)
        {
            var tempOutputBitDepth = outputBitDepth;
            outputBitDepth = 16;
            if(previewDoc != null)
            {
                previewDoc.close(SaveOptions.DONOTSAVECHANGES);
            }
            previewDoc = originalDoc.duplicate("HDR Preview");
            app.activeDocument = previewDoc;
            setZoomLevel(previewZoomSlider.value);
            convertTo32Bit();
            doHDRToning();
            outputBitDepth = tempOutputBitDepth;
            waitForRedraw();
            zoomBox.enabled = previewDoc != null;
            previewZoomSlider.enabled = previewDoc != null;
        }
    };
    zoomBox.onChange = function()
    {
        if(previewDoc != null)
        {
            previewZoomSlider.value = zoomBox.text;
            setZoomLevel(previewZoomSlider.value);
        }
    }
    previewZoomSlider.onChange = function()
    {
        if(previewDoc != null)
        {
            zoomBox.text = previewZoomSlider.value.toFixed(0);
            setZoomLevel(previewZoomSlider.value);
        }
    };
    
    updateSliders();
}


function createSliderControl(group,label,postLabel,min,max,round,value,onValueChanged)
{
    var ignoreChange = false;
    group.add("statictext", undefined, label);
    var slider = group.add("slider",undefined,value,min,max);
    slider.alignment = "fill";
    var box = group.add("edittext",undefined,value);
    box.characters = 6;
    group.add("statictext", undefined, postLabel);
    slider.onChange = function()
    {
        if(!ignoreChange)
        {
            ignoreChange = true;
            box.text = slider.value.toFixed(round);
            onValueChanged(slider.value);
            ignoreChange = false;
        }
    };
    box.onChange = function()
    {
        if(!ignoreChange)
        {
            ignoreChange = true;
            slider.value = box.text;
            onValueChanged(box.text);
            ignoreChange = false;
        }
    };
    return function(newValue)
    {
        slider.value = newValue;
        box.text = newValue.toFixed(round);
    };
}

//forces a redraw while a script dialog is active (for preview)
var waitForRedraw = function()
{
    var desc = new ActionDescriptor();
    desc.putEnumerated(charIDToTypeID("Stte"), charIDToTypeID("Stte"), charIDToTypeID("RdCm"));
    executeAction(charIDToTypeID("Wait"), desc, DialogModes.NO);
}

function getZoomLevel()
{
    var ref = new ActionReference();
    ref.putEnumerated( charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt") );
    var desc = executeActionGet(ref);
    return Number(desc.getDouble(stringIDToTypeID('zoom'))*100).toFixed(1);
}

function setZoomLevel( zoom )
{
    if(zoom < 1 ) zoom =1;
    var ref = new ActionReference();
    ref.putEnumerated( charIDToTypeID("capp"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt") );
    var getScrRes = executeActionGet(ref).getObjectValue(stringIDToTypeID('unitsPrefs')).getUnitDoubleValue(stringIDToTypeID('newDocPresetScreenResolution'))/72;
    var docRes = activeDocument.resolution;
    activeDocument.resizeImage( undefined, undefined, getScrRes/(zoom/100), ResampleMethod.NONE );
    var desc = new ActionDescriptor();
    ref = null;
    ref = new ActionReference();
    ref.putEnumerated( charIDToTypeID( "Mn  " ), charIDToTypeID( "MnIt" ), charIDToTypeID( 'PrnS' ) );
    desc.putReference( charIDToTypeID( "null" ), ref );
    executeAction( charIDToTypeID( "slct" ), desc, DialogModes.NO );
    activeDocument.resizeImage( undefined, undefined, docRes, ResampleMethod.NONE );
}

function ZeroPad(number,numZeros)
{
    var result = number.toString();
    while(result.length < numZeros)
    {
        result = "0" + result;
    }
    return result;
}

var getPresetFiles = function()
{
    var presetFolder = new Folder(app.path + "/Presets/HDR Toning");
    return presetFolder.getFiles("*.hdt");
}

var loadPreset = function(presetFile)
{
    if(presetFile == null)
    {
        presetFile = File.openDialog("Select Preset","*.hdt");
    }
    if(presetFile != null)
    {
        var binaryData = new Array();
        presetFile.encoding = "BINARY";
        presetFile.open('r');
        while(!presetFile.eof)
        {
            binaryData.push(presetFile.readch().charCodeAt(0));
        }
        presetFile.close();
        if(binaryData.length >= 40)
        {
            var curvePointCount = getUInt16(binaryData,38);
            if(binaryData.length >= 104 + curvePointCount * 4)
            {
                var curvePointStr = "";
                for(var i = 0; i < curvePointCount; i++)
                {
                    curvePointStr += getUInt16(binaryData, 42 + i * 4) + "," + getUInt16(binaryData, 40 + i * 4) + ((i < curvePointCount - 1) ? "," : "");
                }
                hdrCurve = curvePointStr;
                
                hdrStrength =  getFloat32(binaryData,8);
                hdrRadius = getFloat32(binaryData, 48 + 5 * curvePointCount);
                hdrExposure = getFloat32(binaryData, 72 + 5 * curvePointCount);
                hdrSaturation = getFloat32(binaryData, 76 + 5 * curvePointCount);
                hdrDetail = getFloat32(binaryData, 80 + 5 * curvePointCount);
                hdrShadow = getFloat32(binaryData, 84 + 5 * curvePointCount);
                hdrHighlights = getFloat32(binaryData, 88 + 5 * curvePointCount);
                hdrGamma = getFloat32(binaryData, 92 + 5 * curvePointCount);
                hdrVibrance = getFloat32(binaryData, 96 + 5 * curvePointCount);
                hdrSmooth = getUInt16(binaryData, 100 + 5 * curvePointCount) != 0;
            }
            else
            {
                alert("Error Loading File", "Error", true);
            }
        }
        else
        {
            alert("Error Loading File", "Error", true);
        }
    }
}

function getUInt16(byteArray,offset)
{
    return byteArray[offset] * 0x100 + byteArray[offset + 1];
}

function getUInt32(byteArray,offset)
{
    return byteArray[offset] * 0x1000000 + byteArray[offset + 1] * 0x10000 + byteArray[offset + 2] * 0x100 + byteArray[offset + 3];
}

function getFloat32(byteArray,offset)
{
    var bytes = getUInt32(byteArray,offset);
    var sign = (bytes & 0x80000000) ? -1 : 1;
    var exponent = ((bytes >> 23) & 0xFF) - 127;
    var significand = (bytes & ~(-1 << 23));
    
    if (exponent == 128)
        return sign * ((significand) ? Number.NaN : Number.POSITIVE_INFINITY);
    
    if (exponent == -127) {
        if (significand == 0) return sign * 0.0;
        exponent = -126;
        significand /= (1 << 22);
    } else significand = (significand | (1 << 23)) / (1 << 23);
    
    return sign * significand * Math.pow(2, exponent);
}

main();
        