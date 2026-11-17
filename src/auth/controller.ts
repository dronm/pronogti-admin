import type { Auth } from "../types/auth";
import type { UserLoginRequest } from "../types/user";
import type { UserLogin } from "../types/userLogin";
import {
	parseLoginRequest,
	parseLoginResponse,
	parseSessionResponse,
} from "../schemas/user";

export interface AuthAPI {
	login: (credentials: UserLoginRequest) => Promise<unknown>;
	session: () => Promise<unknown>;
	logout: () => Promise<unknown>;
}

export interface AuthState {
	auth: Auth | null;
	user: UserLogin | null;
	restored: boolean;
	busy: boolean;
}

interface ControllerOptions {
	api: AuthAPI;
	onChange?: (state: Readonly<AuthState>) => void;
}

export const initialAuthState = (): AuthState => ({
	auth: null,
	user: null,
	restored: false,
	busy: false,
});

// Only the latest interaction may replace session state. Nothing is persisted
// in browser storage; a reload obtains its authority from GET /admin/session.
export const createAuthController = ({ api, onChange }: ControllerOptions) => {
	let state = initialAuthState();
	let generation = 0;
	let restoring: Promise<void> | null = null;

	const publish = (next: AuthState): void => {
		state = next;
		onChange?.(state);
	};

	const clear = (): void => {
		generation++;
		restoring = null;
		publish({ ...initialAuthState(), restored: true });
	};

	const restore = (force = false): Promise<void> => {
		if (restoring !== null) {
			return restoring;
		}
		if (state.restored && !force) {
			return Promise.resolve();
		}
		const current = ++generation;
		publish({ ...state, busy: true });
		const operation = (async (): Promise<void> => {
			try {
				const response = parseSessionResponse(
					await api.session(),
				);
				if (current === generation) {
					publish({
						...response,
						restored: true,
						busy: false,
					});
				}
			} catch (error: unknown) {
				if (current !== generation) {
					return;
				}
				publish(initialAuthState());
				throw error;
			} finally {
				if (current === generation) {
					restoring = null;
				}
			}
		})();
		restoring = operation;
		return operation;
	};

	const login = async (input: UserLoginRequest): Promise<void> => {
		const credentials = parseLoginRequest(input);
		const current = ++generation;
		restoring = null;
		publish({ ...initialAuthState(), restored: true, busy: true });
		try {
			const response = parseLoginResponse(
				await api.login(credentials),
			);
			if (current === generation) {
				publish({
					...response,
					restored: true,
					busy: false,
				});
			}
		} catch (error: unknown) {
			if (current !== generation) {
				return;
			}
			publish({ ...initialAuthState(), restored: true });
			throw error;
		}
	};

	const logout = async (): Promise<void> => {
		// Start the request while its original nonce is available, then remove
		// the local identity even when logout cannot reach the server.
		const operation = api.logout();
		clear();
		await operation;
	};

	return {
		getState: (): Readonly<AuthState> => state,
		isAuthenticated: (): boolean =>
			state.auth !== null && state.user?.role_id === "admin",
		restore,
		login,
		logout,
		clear,
	};
};
