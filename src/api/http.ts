import {
	Conn,
	APIError,
	type ConnRequestOptions,
} from "@katren/vue-collection-lib/api/Conn";

import { API_BASE_URL, API_TIMEOUT } from "@/config/constants";

interface ProjectRequestOptions extends ConnRequestOptions {
	idempotencyKey?: string;
}

export class ProjectConn extends Conn {
	private sessionToken: string | null = null;
	private sessionGeneration = 0;
	public unlogUser: (() => void) | null = null;

	constructor(baseURL: string, timeout: number) {
		// Conn resolves GET query parameters through URL, which needs an
		// absolute origin even when deployment uses a same-origin API prefix.
		const origin =
			typeof window === "undefined"
				? "http://localhost"
				: window.location.origin;
		super(
			new URL(baseURL || "/", origin).href.replace(/\/$/, ""),
			timeout,
		);
	}

	public invalidatePendingResponses = (): void => {
		this.sessionGeneration++;
	};

	public setSessionToken = (token: string | null): void => {
		if (this.sessionToken !== token) {
			this.sessionToken = token;
			this.sessionGeneration++;
		}
	};

	public postIdempotent = <T>(
		endpoint: string,
		data: unknown,
		idempotencyKey: string,
		options: ConnRequestOptions = {},
	): Promise<T> => {
		const requestOptions: ProjectRequestOptions = {
			...options,
			idempotencyKey,
		};
		return this.post<T>(endpoint, data, requestOptions);
	};

	protected override async request<T = unknown>(
		endpoint: string,
		options: RequestInit,
		requestOptions: ProjectRequestOptions = {},
	): Promise<T> {
		if (
			!endpoint.startsWith("/") ||
			endpoint.startsWith("//") ||
			/[\r\n]/.test(endpoint)
		) {
			throw new Error(
				"Administrator API endpoints must be local absolute paths.",
			);
		}
		const generation = this.sessionGeneration;
		const headers = new Headers(options.headers);
		const method = (options.method ?? "GET").toUpperCase();
		const { idempotencyKey, ...transportOptions } = requestOptions;
		if (idempotencyKey !== undefined) {
			headers.set("Idempotency-Key", idempotencyKey);
		}
		headers.delete("X-Admin-Session");
		if (
			!["GET", "HEAD", "OPTIONS"].includes(method) &&
			this.sessionToken !== null
		) {
			headers.set("X-Admin-Session", this.sessionToken);
		}
		try {
			return await super.request<T>(
				endpoint,
				{
					...options,
					credentials: "include",
					redirect: "error",
					headers: Object.fromEntries(
						headers.entries(),
					),
				},
				transportOptions,
			);
		} catch (error: unknown) {
			if (
				error instanceof APIError &&
				error.status === 401 &&
				generation === this.sessionGeneration
			) {
				this.unlogUser?.();
			}
			throw error;
		}
	}
}

const api = new ProjectConn(API_BASE_URL, API_TIMEOUT);

export default api;
