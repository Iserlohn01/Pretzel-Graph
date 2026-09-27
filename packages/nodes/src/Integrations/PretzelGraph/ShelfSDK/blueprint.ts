import { defineBlueprint, defineTool, defineField, defineOutput } from "@pretzel-graph/node-sdk";

export const Blueprint = defineBlueprint({
    id: "Integrations.PretzelGraph.ShelfSDK",
    displayName: "Shelf SDK",
    description: "Searches the blueprints that can be placed on a workflow and describes their fields and ports.",
    icon: "PretzelGraphAppIcon",
    accent: "utility",
    toolCompatible: true,
    credentials: [],
    fields: [
        defineField.MultiOption("operation", "Operation", {
            options: [
                { value: "query",       displayName: "Query blueprints" },
                { value: "get",         displayName: "Get blueprint" },
                { value: "derivatives", displayName: "Get derivatives" },
            ],
            initialValue: "query",
        }),
    ],
    inputs: [],
    outputs: [
        defineOutput.Data("result", "Result", {
            tooltip: "Matching blueprint summaries, one blueprint's fields and ports, or the branches its node can take.",
        }),
    ],

    "operation==query": {
        fields: [
            defineField.Json("filters", "Filters", {
                initialValue: {},
                tooltip: "Optional filters: ids, displayName, drawerIds, toolCompatible, proxyCompatible, isDerivable, isIgniter, passive, fieldIds, inputVariants, outputVariants, limit.",
            }),
        ],
    },

    "operation==get": {
        fields: [defineField.String("getBlueprintId", "Blueprint", { required: true, placeholder: "Core.Text.Input" })],
    },

    "operation==derivatives": {
        fields: [defineField.String("derivativesBlueprintId", "Blueprint", { required: true, placeholder: "Core.Developer.DerivativeTest" })],
    },

    "isConvertedToTool==true": defineTool({
        fields:  [],
        inputs:  [],
        outputs: [defineOutput.ToolList("tools", "Shelf Tools")],
    }),
});
