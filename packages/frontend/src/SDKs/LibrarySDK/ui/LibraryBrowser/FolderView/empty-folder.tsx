import { SystemIcons } from "@pretzel-graph/standard-ui/icons";
import { CreateBtn } from "./create-button";

export function EmptyFolder() {
    return (
        <div className="absolute top-1/2 left-1/2 -translate-1/2 flex flex-col gap-2 flex flex-col">
            <SystemIcons.FolderOpen size={32} className="mx-auto" />
            <p className="text-sm">This folder is empty.</p>
            <CreateBtn triggerClassName="mx-auto" align="center"/>
        </div>
    )
}
