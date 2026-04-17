export type ToastVariant = "info" | "success" | "warning" | "error";

/** Default duration in ms for toast notifications. */
const DEFAULT_DURATION = 6_000;

/** Longer duration for error/diagnostic toasts so the user has time to read. */
const ERROR_DURATION = 10_000;

/**
 * Show a toast notification in the opencode TUI via the server-side client.
 * Silently no-ops if the client is unavailable or the call fails.
 */
export async function showToast(
	client: unknown,
	variant: ToastVariant,
	message: string,
	title?: string,
	duration?: number,
): Promise<void> {
	if (!client || typeof client !== "object") {
		return;
	}

	const event = {
		type: "tui.toast.show" as const,
		properties: {
			variant,
			message,
			...(title ? { title } : undefined),
			duration: duration ?? (variant === "error" || variant === "warning" ? ERROR_DURATION : DEFAULT_DURATION),
		},
	};

	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const tui = (client as any).tui;
		if (!tui || typeof tui.publish !== "function") {
			return;
		}
		await tui.publish({ body: event });
	} catch {
		// Silently ignore — toast is best-effort, not critical path.
	}
}

/**
 * Show a diagnostics-related toast with a summary of new problems.
 * Strips XML tags from the message for clean TUI display.
 */
export async function showDiagnosticsToast(
	client: unknown,
	summary: string,
	filePath?: string,
): Promise<void> {
	const cleanSummary = stripXmlTags(summary);
	const title = filePath
		? `⚠ Diagnostics: ${filePath}`
		: "⚠ New Diagnostics";

	await showToast(client, "warning", cleanSummary, title, ERROR_DURATION);
}

/**
 * Show an info toast for plugin status updates.
 */
export async function showInfoToast(
	client: unknown,
	message: string,
	title?: string,
): Promise<void> {
	await showToast(client, "info", message, title);
}

function stripXmlTags(text: string): string {
	return text
		.replace(/<\/?system-reminder>/g, "")
		.replace(/<\/?new-diagnostics>/g, "")
		.replace(/\[Plugin Visibility Notice\]/g, "")
		.replace(/\[Plugin Injected Reminder Content\]/g, "")
		.replace(/^- /gm, "")
		.trim();
}
