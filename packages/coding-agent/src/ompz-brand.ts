/**
 * Fork identity: the CLI command name users type. Kept as a leaf module so
 * renderers (ui-helpers) and the updater (update-cli) share it without pulling
 * each other's dependency graphs.
 */
export const OMPZ_CLI = "ompz";
