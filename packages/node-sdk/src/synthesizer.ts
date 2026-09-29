import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { LC } from "./langchain";
import { Chat, Foundations } from "@pretzel-graph/shared/domain";
import { SystemError } from "@pretzel-graph/shared/domain/SystemError";


// The response metadata a stored message keeps: what providers read back when the message is resent, and what identifies it.
const RESPONSE_METADATA_KEYS = ["model_provider", "output_version", "model_name", "id", "status"] as const;


export class Synthesizer {

    // ─── Projection ─────────────────────────────────────────────
    // Project an LC instance into a plain object whose shape matches
    // the instance's property access paths.  Used for:
    //   1. Sending node outputs to the frontend (data preview)
    //   2. Evaluating routing expressions in IfElse / Switch nodes
    // The original LC instance continues flowing through the graph
    // untouched — projections are read-only snapshots.
    // ─────────────────────────────────────────────────────────────


    /**
     * Project a runtime value into a plain object suitable for
     * frontend display and expression evaluation.
     */
    public static project(
        value: any,
        variant: Foundations.Port.Variant
    ): Foundations.Projection {
        switch (variant) {
            case "Message":
                return this.projectMessage(value);

            case "MessageList":
                if (Array.isArray(value))
                    return value.map(v => this.projectMessage(v));
                return [this.projectMessage(value)];

            case "Document":
                return this.projectDocument(value);

            case "LanguageModel":
                return this.projectLanguageModel(value);

            case "Embeddings":
                return this.projectEmbeddings(value);

            case "Tool":
                return this.projectTool(value);

            case "ToolList":
                if(!value)
                    return [];
                if (Array.isArray(value))
                    return value.map(v => this.projectTool(v));
                return [this.projectTool(value)];

            case "VectorStore":
            case "Retriever":
                // Opaque handles — no useful inspectable properties
                return {};

            case "Skill":
            case "SkillList":
            case "Text":
            case "Data":
            case "DataList":
            case "DataFrame":
            case "Unresolved":
            case "UnresolvedList":
                return value;

            default:
                return value;
        }
    }


    private static projectMessage(msg: any): Foundations.Projection.Message {
        if (typeof msg === "string") {
            return {
                type:              "human",
                content:           msg,
                additional_kwargs: {},
                response_metadata: {},
            };
        }

        if (!(msg instanceof LC.BaseMessage))
            return msg;

        const projected: Foundations.Projection.Message = {
            type:              msg._getType(),
            content:           msg.content,
            additional_kwargs: msg.additional_kwargs,
            response_metadata: this.trimResponseMetadata(msg.response_metadata),
        };

        if (msg.name !== undefined)              projected.name = msg.name;
        if (msg.id !== undefined)                projected.id = msg.id;

        if ("tool_calls" in msg)                 projected.tool_calls = (msg as any).tool_calls;
        if ("invalid_tool_calls" in msg)         projected.invalid_tool_calls = (msg as any).invalid_tool_calls;
        if ("usage_metadata" in msg)             projected.usage_metadata = (msg as any).usage_metadata;
        if ("tool_call_id" in msg)               projected.tool_call_id = (msg as any).tool_call_id;

        return projected;
    }


    private static trimResponseMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
        const trimmed: Record<string, unknown> = {};

        for (const key of RESPONSE_METADATA_KEYS)
            if (metadata?.[key] !== undefined)
                trimmed[key] = metadata[key];

        return trimmed;
    }


    // Copies the reasoning item's encrypted content from the dropped response output, so a resent message carries it.
    private static keepEncryptedReasoning(msg: LC.BaseMessage): Record<string, unknown> {
        const kwargs    = msg.additional_kwargs as Record<string, any>;
        const output    = (msg.response_metadata as Record<string, any> | undefined)?.output;
        const reasoning = kwargs.reasoning;

        if (!reasoning || reasoning.encrypted_content || !Array.isArray(output))
            return kwargs;

        const item = output.find((entry: any) => entry?.type === "reasoning" && entry.id === reasoning.id);

        if (!item?.encrypted_content)
            return kwargs;

        return { ...kwargs, reasoning: { ...reasoning, encrypted_content: item.encrypted_content } };
    }


    private static projectDocument(doc: any): Foundations.Projection.Document {
        if (!(doc instanceof LC.Document))
            return doc;

        return {
            pageContent: doc.pageContent,
            metadata:    doc.metadata,
        };
    }


    private static projectLanguageModel(llm: any): Foundations.Projection.LanguageModel {
        const projected: Record<string, any> = {
            type:             llm._llmType?.() ?? "unknown",
            model:            llm.model ?? llm.modelName,
            temperature:      llm.temperature,
            streaming:        llm.streaming,
            topP:             llm.topP,
            topK:             llm.topK,
            maxTokens:        llm.maxTokens,
            maxOutputTokens:  llm.maxOutputTokens,
            stop:             llm.stop,
            stopSequences:    llm.stopSequences,
            frequencyPenalty: llm.frequencyPenalty,
            presencePenalty:  llm.presencePenalty,
            n:                llm.n,
            modelKwargs:      llm.modelKwargs,
        };

        for (const key in projected)
            if (projected[key] === undefined)
                delete projected[key];

        return projected as Foundations.Projection.LanguageModel;
    }


    private static projectEmbeddings(emb: any): Foundations.Projection.Embeddings {
        const projected: Record<string, any> = {
            model:         emb.model ?? emb.modelName,
            dimensions:    emb.dimensions,
            batchSize:     emb.batchSize,
            stripNewLines: emb.stripNewLines,
            maxBatchSize:  emb.maxBatchSize,
        };

        for (const key in projected)
            if (projected[key] === undefined)
                delete projected[key];

        return projected as Foundations.Projection.Embeddings;
    }


    private static projectTool(t: LC.Tool): Foundations.Projection.Tool {
        return {
            name:        t.name,
            description: t.description,
            returnDirect: t.returnDirect ?? false,
        };
    }


    // ─── Synthesis (incoming coercion) ──────────────────────────

    /**
     * Create an LC class instance from a static primitive value.
     * Called when a port input has NO incoming edge — the raw primitives
     * stored in `staticValues` / `initialValue` must be coerced into
     * the class instance the node's `run()` expects.
     */
    public static synthesizeInput(
        input: Foundations.Port.Input,
        staticValue: any
    ): any {
        switch (input.variant) {
            case "Message":
                return this.coerceMessage("human", staticValue as LC.BaseMessage | string);
            case "MessageList":
                if(Array.isArray(staticValue)){
                    if(staticValue.every(el => typeof el === "string")){
                        return staticValue.map(str => this.coerceMessage("human", str));
                    }
                    else if(staticValue.every(el => el !== null && typeof el === "object" && "content" in el && typeof el.content === "string")){
                        return staticValue.map(msgObj => this.coerceMessage("human", msgObj as LC.BaseMessage | string));
                    }
                    else {
                        throw new SystemError(
                            SystemError.Code.CONFIG_INVALID_FIELD,
                            `Invalid initial value for MessageList input — expected an array of strings or message objects.`
                        );
                    }
                }
                else {
                    return [this.coerceMessage("human", staticValue as string)];
                }
            case "Text":
                return String(staticValue);

            case "Document":
                return new LC.Document({ pageContent: String(staticValue) });

            case "Data":
            case "DataList":
            case "DataFrame":
                return staticValue;

            case "LanguageModel":
            case "Embeddings":
            case "VectorStore":
            case "Retriever":
            case "Tool":
            case "ToolList":
            case "Skill":
            case "SkillList":
                throw new Error(
                    `AGGEX Synthesizer: Cannot synthesize variant "${input.variant}" ` +
                    `from a static value — it requires an incoming edge connection.`
                );

            default:
                throw new Error(
                    `AGGEX Synthesizer: Unknown variant "${(input as any).variant}"`
                );
        }
    }


    /**
     * Ensure a runtime value coming from an upstream edge conforms to the
     * expected LC class for the given port variant. Passes through values
     * that are already the correct type; coerces when possible.
     */
    public static ensureReference(
        rawReference: any,
        variant: Foundations.Port.Variant
    ): any {
        switch (variant) {
            case "Message":
                if (rawReference instanceof LC.BaseMessage)
                    return rawReference;
                if (typeof rawReference === "string")
                    return new HumanMessage(rawReference);

                throw new SystemError(
                    SystemError.Code.EXECUTION_TYPE_MISMATCH,
                    `Cannot coerce value of type "${typeof rawReference}" into variant "${variant}"`,
                    { data: { variant } }
                );

            case "Text":
                if (typeof rawReference === "string")
                    return rawReference;
                return String(rawReference);

            case "Document":
                if (rawReference instanceof LC.Document)
                    return rawReference;
                if (typeof rawReference === "string")
                    return new LC.Document({ pageContent: rawReference });
                throw new SystemError(
                    SystemError.Code.EXECUTION_TYPE_MISMATCH,
                    `Cannot coerce value of type "${typeof rawReference}" into variant "${variant}"`,
                    { data: { variant } }
                );

            case "LanguageModel":
                if (rawReference instanceof LC.BaseLanguageModel)
                    return rawReference;
                throw new SystemError(
                    SystemError.Code.EXECUTION_TYPE_MISMATCH,
                    `Cannot coerce value of type "${typeof rawReference}" into variant "${variant}"`,
                    { data: { variant } }
                );

            case "Embeddings":
                if (rawReference instanceof LC.Embeddings)
                    return rawReference;
                throw new SystemError(
                    SystemError.Code.EXECUTION_TYPE_MISMATCH,
                    `Cannot coerce value of type "${typeof rawReference}" into variant "${variant}"`,
                    { data: { variant } }
                );

            case "VectorStore":
                if (rawReference instanceof LC.VectorStore)
                    return rawReference;
                throw new SystemError(
                    SystemError.Code.EXECUTION_TYPE_MISMATCH,
                    `Cannot coerce value of type "${typeof rawReference}" into variant "${variant}"`,
                    { data: { variant } }
                );

            case "Retriever":
                if (rawReference instanceof LC.BaseRetriever)
                    return rawReference;
                throw new SystemError(
                    SystemError.Code.EXECUTION_TYPE_MISMATCH,
                    `Cannot coerce value of type "${typeof rawReference}" into variant "${variant}"`,
                    { data: { variant } }
                );

            case "Tool":
                if (rawReference instanceof LC.Tool)
                    return rawReference;
                throw new SystemError(
                    SystemError.Code.EXECUTION_TYPE_MISMATCH,
                    `Cannot coerce value of type "${typeof rawReference}" into variant "${variant}"`,
                    { data: { variant } }
                );

            case "ToolList":
                if (Array.isArray(rawReference)) {
                    if (rawReference.every(el => el instanceof LC.Tool))
                        return rawReference;
                    throw new SystemError(
                        SystemError.Code.EXECUTION_TYPE_MISMATCH,
                        `Cannot coerce value into variant "${variant}" — expected an array of Tool instances.`,
                        { data: { variant, rawReference } }
                    );
                }
                if (rawReference instanceof LC.Tool)
                    return [rawReference];
                throw new SystemError(
                    SystemError.Code.EXECUTION_TYPE_MISMATCH,
                    `Cannot coerce value into variant "${variant}" — expected a Tool or array of Tools.`,
                    { data: { variant, rawReference } }
                );

            case "MessageList":
                if(Array.isArray(rawReference)){
                    const newMessageList: LC.BaseMessage[] = [];
                    rawReference.forEach(el => {
                        if(el instanceof LC.BaseMessage){
                            newMessageList.push(el);
                        }
                        else if(typeof el === "string"){
                            newMessageList.push(this.coerceMessage("human", el));
                        }
                        else if(typeof el === "object" && "content" in el && typeof el.content === "string"){
                            newMessageList.push(this.coerceMessage("human", el as LC.BaseMessage | string));
                        }
                        else {
                            throw new SystemError(
                                SystemError.Code.EXECUTION_TYPE_MISMATCH,
                                `Cannot coerce value into variant "${variant}" — expected an array of strings or message objects.`,
                                { data: { variant, rawReference } }
                            );
                        }
                    })
                    return newMessageList;
                }
                else if (rawReference instanceof LC.BaseMessage)
                    return [rawReference];
                else if (typeof rawReference === "string")
                    return [new HumanMessage(rawReference)];
                throw new SystemError(
                    SystemError.Code.EXECUTION_TYPE_MISMATCH,
                    `Cannot coerce value into variant "${variant}" — expected an array of BaseMessage`,
                    { data: { variant, rawReference } }
                );

            case "Skill":
                // Pass through — a skill is its plain snapshot object
                return rawReference;

            case "SkillList":
                if (Array.isArray(rawReference))
                    return rawReference;
                return [rawReference];

            case "DataList":
                // Pass through — no canonical LC class for arbitrary data lists
                return rawReference;

            case "Data":
            case "DataFrame":
                // Pass through — no canonical LC class
                return rawReference;
            default:
                throw new SystemError(
                    SystemError.Code.CONFIG_INVALID_FIELD,
                    `Unknown port variant "${variant}"`,
                    { data: { variant } }
                );
        }
    }


    private static extractMessageText(content: LC.BaseMessage["content"]): string {
        if (typeof content === "string")
            return content;

        return content
            .map(block => {
                if (typeof block === "string")
                    return block;

                if (block.type === "text" && "text" in block && typeof block.text === "string")
                    return block.text;

                return "";
            })
            .join("");
    }


    public static lcToChatMessage(msg: LC.BaseMessage): Chat.Message {
        const base = {
            id:         Chat.Message.createId(),
            content:    this.extractMessageText(msg.content),
        };

        const meta = {
            name:              msg.name ?? null,
            lc_id:             msg.id ?? null,
            additional_kwargs: msg.additional_kwargs ? this.keepEncryptedReasoning(msg) : null,
            response_metadata: msg.response_metadata ? this.trimResponseMetadata(msg.response_metadata) : null,
        };

        switch (msg.type) {
            case "ai": {
                const lcMsg = msg as LC.AIMessage;
                return {
                    ...base,
                    role: "ai",
                    data: {
                        isProcessing: false,
                        tool_calls: (lcMsg.tool_calls ?? []).map(tc => ({
                            id:        Chat.ToolCall.Id.parse(tc.id ?? crypto.randomUUID()),
                            name:      tc.name,
                            arguments: tc.args,
                        })),
                        invalid_tool_calls: lcMsg.invalid_tool_calls ?? [],
                        usage_metadata:     lcMsg.usage_metadata ?? null,
                        ...meta,
                    },
                } satisfies Chat.Message.AI;
            }
            case "human":
                return { ...base, role: "human", data: meta } satisfies Chat.Message.Human;
            case "tool": {
                const lcMsg = msg as LC.ToolMessage;
                const status = lcMsg.status ?? "success";

                // LC has no error field — a failed tool carries its reason in content.
                const error = status === "error" ? base.content : undefined;

                return {
                    ...base,
                    role: "tool",
                    data: {
                        tool_call_id: Chat.ToolCall.Id.parse(lcMsg.tool_call_id),
                        tool_name:    lcMsg.name ?? "",
                        status,
                        error,
                        artifact:     lcMsg.artifact ?? null,
                        ...meta,
                    },
                } satisfies Chat.Message.Tool;
            }
            case "system":
                return { ...base, role: "system", data: meta } satisfies Chat.Message.System;
            default:
                throw new Error(`Unsupported LangChain message type "${msg._getType()}"`);
        }
    }


    // A Responses API message with no text had empty content; as "" it would be resent as an empty message
    // between the reasoning and the function call it produced.
    private static restoreAIContent(msg: Chat.Message.AI): LC.AIMessage["content"] {
        const fromResponses = !!msg.data.additional_kwargs?.["__openai_function_call_ids__"];

        return msg.content === "" && fromResponses ? [] : msg.content;
    }


    public static chatMessageToLC(msg: Chat.Message): LC.BaseMessage {
        const meta = {
            name:              msg.data?.name ?? undefined,
            id:                msg.data?.lc_id ?? undefined,
            additional_kwargs: msg.data?.additional_kwargs ?? undefined,
            response_metadata: msg.data?.response_metadata ?? undefined,
        };

        switch (msg.role) {
            case "human":  return new HumanMessage({ content: msg.content, ...meta });
            case "system": return new SystemMessage({ content: msg.content, ...meta });
            case "ai": {
                const a = msg as Chat.Message.AI;
                return new AIMessage({
                    content: this.restoreAIContent(a),
                    tool_calls: (a.data.tool_calls ?? []).map(tc => ({
                        id:   tc.id,
                        name: tc.name,
                        args: tc.arguments,
                        type: "tool_call" as const,
                    })),
                    invalid_tool_calls: (a.data.invalid_tool_calls ?? []).map(tc => ({
                        id:    tc.id ?? undefined,
                        name:  tc.name ?? undefined,
                        args:  tc.args ?? undefined,
                        error: tc.error ?? undefined,
                        type:  "invalid_tool_call" as const,
                    })),
                    usage_metadata:     a.data.usage_metadata ?? undefined,
                    ...meta,
                });
            }
            case "tool": {
                const t = msg as Chat.Message.Tool;
                return new ToolMessage({
                    ...meta,
                    content:      t.content,
                    tool_call_id: t.data.tool_call_id,
                    name:         t.data.tool_name,
                    status:       t.data.status,
                    artifact:     t.data.artifact ?? undefined,
                });
            }
        }
    }


    /**
     * Coerce a string (or BaseMessage) into the specific message subclass.
     */
    public static coerceMessage(
        kind: "human" | "system" | "ai" | string,
        input: LC.BaseMessage | string
    ): LC.BaseMessage {
        const content = typeof input === "string" ? input : input.content;

        switch (kind) {
            case "system":
                return input instanceof SystemMessage ? input : new SystemMessage(content);
            case "human":
                return input instanceof HumanMessage ? input : new HumanMessage(content);
            case "ai":
                return input instanceof AIMessage ? input : new AIMessage(content);
            default:
                throw new SystemError(
                    SystemError.Code.CONFIG_INVALID_FIELD,
                    `Unsupported message role "${kind}" — only human, system, and ai are supported`,
                    { data: { kind } }
                );
        }
    }
}
