sap.ui.define([
    "sap/dm/dme/pod2/widget/IntegrationWidget",
    "sap/dm/dme/pod2/widget/metadata/WidgetProperty",
    "sap/dm/dme/pod2/propertyeditor/BooleanPropertyEditor",
    "sap/dm/dme/pod2/propertyeditor/StringPropertyEditor",
    "sap/dm/dme/pod2/propertyeditor/SelectPropertyEditor",
    "sap/dm/dme/pod2/propertyeditor/ColorPropertyEditor",
    "sap/dm/dme/pod2/propertyeditor/IconPropertyEditor",
    "sap/dm/dme/pod2/propertyeditor/MenuPropertyEditor",
    "sap/dm/dme/pod2/propertyeditor/ResourcePropertyEditor",
    "sap/dm/dme/pod2/propertyeditor/SortingPropertyEditor"
],
    /**
     * @param {typeof sap.dm.dme.pod2.widget.IntegrationWidget} IntegrationWidget
     * @param {typeof sap.dm.dme.pod2.widget.metadata.WidgetProperty} WidgetProperty
     * @param {typeof sap.dm.dme.pod2.propertyeditor.BooleanPropertyEditor} BooleanPropertyEditor
     * @param {typeof sap.dm.dme.pod2.propertyeditor.StringPropertyEditor} StringPropertyEditor
     * @param {typeof sap.dm.dme.pod2.propertyeditor.SelectPropertyEditor} SelectPropertyEditor
     * @param {typeof sap.dm.dme.pod2.propertyeditor.ColorPropertyEditor} ColorPropertyEditor
     * @param {typeof sap.dm.dme.pod2.propertyeditor.IconPropertyEditor} IconPropertyEditor
     * @param {typeof sap.dm.dme.pod2.propertyeditor.MenuPropertyEditor} MenuPropertyEditor
     * @param {typeof sap.dm.dme.pod2.propertyeditor.ResourcePropertyEditor} ResourcePropertyEditor
     * @param {typeof sap.dm.dme.pod2.propertyeditor.SortingPropertyEditor} SortingPropertyEditor
     */
    (
        IntegrationWidget,
        WidgetProperty,
        BooleanPropertyEditor,
        StringPropertyEditor,
        SelectPropertyEditor,
        ColorPropertyEditor,
        IconPropertyEditor,
        MenuPropertyEditor,
        ResourcePropertyEditor,
        SortingPropertyEditor
    ) => {
        "use strict";

        const BUILD_PATH = "{{namespacePath}}/{{pluginname}}/app/build";

        /**
         * @alias {{namespace}}.react.widget.{{pluginname}}
         * @extends sap.dm.dme.pod2.widget.IntegrationWidget
         */
        class {{pluginname}} extends IntegrationWidget {
    static #oManifest;



    static getDisplayName() {
        return "{{PODname}}";
    }

            static getDescription() {
        return "{{description}}";
    }

            static getIcon() {
        return "{{icon}}";
    }

            static getCategory() {
        return "{{PODGroup}}";
    }

            static async getEntryPoint() {
        try {
            if (!this.#oManifest) {
                const sManifestUrl = sap.ui.require.toUrl(`${BUILD_PATH}/asset-manifest.json`);
                this.#oManifest = await (await window.fetch(sManifestUrl)).json();
            }
            const sMain = this.#oManifest.files["main.js"];
            return `${BUILD_PATH}${sMain}`;
        } catch (oError) {
            throw new Error("To use the DemoPluginWidget you first need to build the React " +
                'project using "npm i" followed by "npm run build".', { cause: oError });
        }
    }

            static getStyleSheet() {
        const sMain = this.#oManifest.files["main.css"];
        return `${BUILD_PATH}${sMain}`;
    }


    getProperties() {
                return [
                     ...super.getProperties(),
                     new WidgetProperty({
                         displayName: "Sample Boolean Property",
                         description: "Display the sample boolean property.",
                         category: "Custom Properties",
                         propertyEditor: new BooleanPropertyEditor(this,
                             "SampleBoolean", true)
                     }),
                        new WidgetProperty({
                            displayName: "Sample String Property",
                            description: "Display the sample string property.",
                            category: "Custom Properties",
                            propertyEditor: new StringPropertyEditor(this,
                                "SampleString" )
                        })
                        ,
                        new WidgetProperty({
                            displayName: "Sample Select Property",
                            description: "Display the sample select property.",
                            category: "Custom Properties",
                            propertyEditor: new SelectPropertyEditor(this,
                                "fixedLayout", [ "test1", "test2", "test3" ], "test2")
                        }),
                        new WidgetProperty({
                            displayName: "Sample Color Property",
                            description: "Display the sample color property.",
                            category: "Custom Properties",
                            propertyEditor: new ColorPropertyEditor(this, "SampleColor")
                        }),
                        new WidgetProperty({
                            displayName: "Sample Icon Property",
                            description: "Display the sample icon property.",
                            category: "Custom Properties",
                            propertyEditor: new IconPropertyEditor(this, "SampleIcon")
                        }),
                        new WidgetProperty({
                            displayName: "Sample Menu Property",
                            description: "Display the sample menu property.",
                            category: "Custom Properties",
                            propertyEditor: new MenuPropertyEditor(this, "SampleMenu")
                        }),
                        new WidgetProperty({
                            displayName: "Sample Resource Property",
                            description: "Display the sample resource property.",
                            category: "Custom Properties",
                            propertyEditor: new ResourcePropertyEditor(this, "SampleResource")
                        }),
                        new WidgetProperty({
                            displayName: "Sample Sorting Property",
                            description: "Display the sample sorting property.",
                            category: "Custom Properties",
                            propertyEditor: new SortingPropertyEditor(this, "SampleSorting",["1", "2", "3", "4", "5"], "3")
                        })
                 ];
            }
}

        return {{pluginname}};
    });