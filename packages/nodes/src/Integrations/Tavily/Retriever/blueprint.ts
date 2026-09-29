import { defineBlueprint, defineField, defineOutput } from "@pretzel-graph/node-sdk";
import { Tavily } from "@pretzel-graph/nodes/Credentials/Tavily";

export const Blueprint = defineBlueprint({
    id: "Integrations.Tavily.Retriever",
    displayName: "Tavily Retriever",
    description: "Configures a Tavily search retriever. Connect its output to a Search node or an agent.",
    icon: "Tavily",
    accent: "port-Retriever",
    credentials: [Tavily],
    fields: [
        defineField.Integer("maxResults", "Max Results", {
            initialValue: 5,
            min: 1,
            max: 20
        }),
        defineField.MultiOption("searchDepth", "Search Depth", {
            options: [
                { value: "basic", displayName: "Basic" },
                { value: "advanced", displayName: "Advanced" },
            ],

            initialValue: "basic",
            tooltip: "Advanced costs more Tavily credits but returns richer results."
        }),
        defineField.Boolean("includeAnswer", "Include Answer", {
            initialValue: false,
            tooltip: "Tavily pre-summarizes an answer from the search results."
        }),
    ],
    inputs: [

        
    ],
    outputs: [
        defineOutput.Retriever("retriever", "Retriever", {}),
    ],
});
