// The template gallery's sidebar entries, in sidebar order; a null section sits above every section.
export const TEMPLATE_CATEGORIES = {
    "get-started":       { id: "get-started",       section: null,          label: "Get started",        icon: "Star" },
    "assistants":        { id: "assistants",        section: "Use cases",   label: "Assistants & bots",  icon: "MessagesSquare" },
    "email-calendar":    { id: "email-calendar",    section: "Use cases",   label: "Email & calendar",   icon: "Mail" },
    "research":          { id: "research",          section: "Use cases",   label: "Research",           icon: "Search" },
    "data":              { id: "data",              section: "Use cases",   label: "Data",               icon: "Database" },
    "coding":            { id: "coding",            section: "Use cases",   label: "Coding",             icon: "Code" },
    "markets":           { id: "markets",           section: "Use cases",   label: "Markets",            icon: "ChartNoAxesCombined" },
    "agents-tools":      { id: "agents-tools",      section: "Methodology", label: "Agents & tools",     icon: "Bot" },
    "loops":             { id: "loops",             section: "Methodology", label: "Loops & reflection", icon: "RefreshCcw" },
    "routing":           { id: "routing",           section: "Methodology", label: "Routing",            icon: "Split" },
    "human-in-the-loop": { id: "human-in-the-loop", section: "Methodology", label: "Human in the loop",  icon: "ShieldUser" },
    "multi-model":       { id: "multi-model",       section: "Methodology", label: "Multi-model",        icon: "BrainCircuit" },
} as const

export type TemplateCategoryId = keyof typeof TEMPLATE_CATEGORIES

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[TemplateCategoryId]
