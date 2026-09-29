import { RuntimeNode } from "@pretzel-graph/node-sdk";
import { Shelf, ToolView, type Foundations } from "@pretzel-graph/shared/domain";

import { Blueprint } from "./blueprint";
import { buildTools } from "./tools";


export class Node extends RuntimeNode<typeof Blueprint> {

    protected override async onRun() {
        const f   = this.fieldValues;
        const api = this.context.internalAPI;

        if (f.isConvertedToTool === true)
            return { tools: buildTools(api) };

        switch (f.operation) {
            case "query":
                return { result: await Shelf.API.Internal.query(api.raw, Shelf.Catalogue.Query.parse(f.filters ?? {})) };

            case "get": {
                const { blueprint } = await Shelf.API.Internal.get(api.raw, f.getBlueprintId as Foundations.Blueprint.Id);

                return { result: blueprint };
            }

            case "derivatives": {
                const { blueprint } = await Shelf.API.Internal.get(api.raw, f.derivativesBlueprintId as Foundations.Blueprint.Id);

                return { result: ToolView.derivativeBranches(blueprint) };
            }
        }

        throw new Error("Unsupported operation");
    }
}
