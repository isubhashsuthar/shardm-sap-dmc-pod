sap.ui.define([
    "sap/m/library",
    "sap/ui/core/library",
    "sap/dm/dme/pod2/model/I18nResourceModel",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/pod2/widget/Widget",
    "sap/dm/dme/pod2/widget/metadata/WidgetProperty",
    "sap/dm/dme/pod2/propertyeditor/BooleanPropertyEditor",
    "sap/dm/dme/pod2/propertyeditor/StringPropertyEditor",
    "sap/dm/dme/pod2/propertyeditor/SelectPropertyEditor",
    "sap/dm/dme/pod2/propertyeditor/ColorPropertyEditor",
    "sap/dm/dme/pod2/propertyeditor/IconPropertyEditor",
    "sap/dm/dme/pod2/propertyeditor/MenuPropertyEditor",
    "sap/dm/dme/pod2/propertyeditor/ResourcePropertyEditor",
    "sap/dm/dme/pod2/propertyeditor/SortingPropertyEditor"
], (
    SapMLibrary,
    SapUiCoreLibrary,
    I18nResourceModel,
    MessageBox,
    JSONModel,
    Widget,
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

    class {{pluginname}} extends Widget {

        static #oI18nModel = new I18nResourceModel({
            bundleName: "{{namespace}}.{{pluginname}}.i18n.i18n"
        });

        static getI18nModel() {
            return this.#oI18nModel;
        }

        static getDisplayName() {
            return this.getI18nText("displayName");
        }

        static getIcon() {
            return "{{icon}}";
        }

        static getCategory() {
            return this.getI18nText("category");
        }

        static getDescription() {
            return this.getI18nText("description");
        }

        _createView() {
            const oConfig = this.getConfig();

            console.log("Creating UI5 Test Widget View");
            // Create Text Field
            const oTextField = new sap.m.Input({
                value: this.getI18nText("textField"),
                editable: false
            });

            // Create Button
            const oButton = new sap.m.Button({
                text: this.getI18nText("buttonText"),
                press: () => {
                    sap.m.MessageToast.show(this.getI18nText("buttonResponse"));
                }
            });

            // Optional: Create a simple container to hold them
            const oVBox = new sap.m.VBox(oConfig.id, {
                items: [oTextField, oButton],
                alignItems: "Start",
                width: "100%"
            });

            return oVBox;
        }

        getProperties() {

            const aProperties = [];
            aProperties.push(
                new WidgetProperty({
                    displayName: this.getI18nText("booleanProperty.displayName"),
                    description: this.getI18nText("booleanProperty.description"),
                    category: this.getI18nText("booleanProperty.category"),
                    propertyEditor: new BooleanPropertyEditor(this,
                        "SampleBoolean", true)
                }),
                new WidgetProperty({
                    displayName: this.getI18nText("stringProperty.displayName"),
                    description: this.getI18nText("stringProperty.description"),
                    category: this.getI18nText("stringProperty.category"),
                    propertyEditor: new StringPropertyEditor(this,
                        "SampleString")
                }),
                new WidgetProperty({
                    displayName: this.getI18nText("selectProperty.displayName"),
                    description: this.getI18nText("selectProperty.description"),
                    category: this.getI18nText("selectProperty.category"),
                    propertyEditor: new SelectPropertyEditor(this,
                        "fixedLayout", ["test1", "test2", "test3"], "test2")
                }),
                new WidgetProperty({
                    displayName: this.getI18nText("colorProperty.displayName"),
                    description: this.getI18nText("colorProperty.description"),
                    category: this.getI18nText("colorProperty.category"),
                    propertyEditor: new ColorPropertyEditor(this, "SampleColor")
                }),
                new WidgetProperty({
                    displayName: this.getI18nText("iconProperty.displayName"),
                    description: this.getI18nText("iconProperty.description"),
                    category: this.getI18nText("iconProperty.category"),
                    propertyEditor: new IconPropertyEditor(this, "SampleIcon")
                }),
                new WidgetProperty({
                    displayName: this.getI18nText("menuProperty.displayName"),
                    description: this.getI18nText("menuProperty.description"),
                    category: this.getI18nText("menuProperty.category"),
                    propertyEditor: new MenuPropertyEditor(this, "SampleMenu")
                }),
                new WidgetProperty({
                    displayName: this.getI18nText("resourceProperty.displayName"),
                    description: this.getI18nText("resourceProperty.description"),
                    category: this.getI18nText("resourceProperty.category"),
                    propertyEditor: new ResourcePropertyEditor(this, "SampleResource")
                }),
                new WidgetProperty({
                    displayName: this.getI18nText("sortingProperty.displayName"),
                    description: this.getI18nText("sortingProperty.description"),
                    category: this.getI18nText("sortingProperty.category"),
                    propertyEditor: new SortingPropertyEditor(this, "SampleSorting", ["1", "2", "3", "4", "5"], "3")
                })
            );

            return aProperties;
        }



    }


    return {{pluginname}};
});