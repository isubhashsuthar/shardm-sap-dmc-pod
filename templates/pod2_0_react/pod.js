const aModules = await new Promise((fnResolve, fnReject) => {
    sap.ui.require([
        "sap/dm/dme/pod2/api/ApiClient",
        "sap/dm/dme/pod2/context/PodContext"
    ], (...aModules) => fnResolve(aModules), fnReject);
});

const [
    ApiClient,
    PodContext
] = aModules;

export {
    ApiClient,
    PodContext as default,
    PodContext
}