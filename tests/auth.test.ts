import assert from "node:assert/strict";
import test from "node:test";

import { createAuthController, type AuthAPI } from "../src/auth/controller";
import {
	parseLoginRequest,
	parseLoginResponse,
	parsePasswordChangeRequest,
	parseSessionResponse,
} from "../src/schemas/user";

const nonce = "a".repeat(64);
const logged = (id = 1) => ({
	auth: { token: nonce + id },
	user: { id, name: "Administrator", role_id: "admin", locale_id: "ru" },
});

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
};

const fakeAPI = (overrides: Partial<AuthAPI> = {}): AuthAPI => ({
	login: async () => logged(),
	session: async () => ({ auth: null, user: null }),
	logout: async () => null,
	...overrides,
});

test("login validates credentials while preserving password bytes", () => {
	const request = parseLoginRequest({
		name: "  admin  ",
		pwd: " secret ",
	});
	assert.deepEqual(request, { name: "admin", pwd: " secret " });
	assert.throws(() => parseLoginRequest({ name: " ", pwd: "secret" }));
	assert.throws(() => parseLoginRequest({ name: "admin", pwd: "" }));
	assert.throws(() =>
		parseLoginRequest({ name: "admin", pwd: "я".repeat(37) }),
	);
	assert.equal(
		parseLoginRequest({ name: "admin", pwd: "я".repeat(36) }).pwd
			.length,
		36,
	);
});

test("password changes count characters, enforce the byte limit and preserve exact confirmation", () => {
	const change = (password: string, confirmation = password) => ({
		new_password: password,
		confirm_password: confirmation,
	});
	assert.deepEqual(parsePasswordChangeRequest(change(" pass ")), change(" pass "));
	assert.deepEqual(parsePasswordChangeRequest(change("я".repeat(36))), change("я".repeat(36)));
	assert.throws(() => parsePasswordChangeRequest(change("я".repeat(5))));
	assert.throws(() => parsePasswordChangeRequest(change("я".repeat(37))));
	assert.throws(() => parsePasswordChangeRequest(change("secret ", "secret")));
});

test("only complete administrator session responses are accepted", () => {
	assert.equal(parseLoginResponse(logged()).user.role_id, "admin");
	assert.deepEqual(parseSessionResponse({ auth: null, user: null }), {
		auth: null,
		user: null,
	});
	assert.throws(() =>
		parseLoginResponse({
			...logged(),
			user: { ...logged().user, role_id: "client" },
		}),
	);
	assert.throws(() =>
		parseLoginResponse({ ...logged(), auth: { token: "short" } }),
	);
	assert.throws(() =>
		parseLoginResponse({
			...logged(),
			auth: { token: `${nonce}\r\n` },
		}),
	);
	assert.throws(() =>
		parseSessionResponse({ auth: null, user: logged().user }),
	);
});

test("restore is authoritative, coalesced and does not require browser storage", async () => {
	const pending = deferred<unknown>();
	let calls = 0;
	const controller = createAuthController({
		api: fakeAPI({
			session: () => {
				calls++;
				return pending.promise;
			},
		}),
	});
	assert.equal(controller.isAuthenticated(), false);
	const first = controller.restore();
	const second = controller.restore();
	assert.equal(first, second);
	assert.equal(calls, 1);
	pending.resolve(logged());
	await first;
	assert.equal(controller.isAuthenticated(), true);
	assert.equal(controller.getState().restored, true);
	await controller.restore();
	assert.equal(calls, 1);
});

test("a late restore cannot overwrite a newer successful login", async () => {
	const pending = deferred<unknown>();
	const controller = createAuthController({
		api: fakeAPI({ session: () => pending.promise }),
	});
	const restoring = controller.restore();
	await controller.login({ name: "admin", pwd: "secret" });
	pending.resolve({ auth: null, user: null });
	await restoring;
	assert.equal(controller.isAuthenticated(), true);
	assert.equal(controller.getState().user?.id, 1);
});

test("a stale restore failure does not reject the current login flow", async () => {
	const pending = deferred<unknown>();
	const controller = createAuthController({
		api: fakeAPI({ session: () => pending.promise }),
	});
	const restoring = controller.restore();
	await controller.login({ name: "admin", pwd: "secret" });
	pending.reject(new Error("old restore failed"));
	await restoring;
	assert.equal(controller.isAuthenticated(), true);
});

test("a late login cannot resurrect a logged out administrator", async () => {
	const pending = deferred<unknown>();
	const controller = createAuthController({
		api: fakeAPI({ login: () => pending.promise }),
	});
	const logging = controller.login({ name: "admin", pwd: "secret" });
	await controller.logout();
	pending.resolve(logged());
	await logging;
	assert.equal(controller.isAuthenticated(), false);
	assert.equal(controller.getState().user, null);
});

test("only the latest concurrent login may update the identity", async () => {
	const one = deferred<unknown>();
	const two = deferred<unknown>();
	const controller = createAuthController({
		api: fakeAPI({
			login: (credentials) =>
				credentials.name === "one"
					? one.promise
					: two.promise,
		}),
	});
	const first = controller.login({ name: "one", pwd: "secret" });
	const second = controller.login({ name: "two", pwd: "secret" });
	two.resolve(logged(2));
	await second;
	one.resolve(logged(1));
	await first;
	assert.equal(controller.getState().user?.id, 2);
});

test("restore failure remains retryable and never implies authentication", async () => {
	let calls = 0;
	const controller = createAuthController({
		api: fakeAPI({
			session: async () => {
				calls++;
				if (calls === 1) {
					throw new Error("network unavailable");
				}
				return logged();
			},
		}),
	});
	await assert.rejects(controller.restore(), /network unavailable/);
	assert.equal(controller.isAuthenticated(), false);
	assert.equal(controller.getState().restored, false);
	await controller.restore();
	assert.equal(controller.isAuthenticated(), true);
});

test("logout clears the local identity even when the server is unavailable", async () => {
	const controller = createAuthController({
		api: fakeAPI({
			logout: async () => {
				throw new Error("network unavailable");
			},
		}),
	});
	await controller.login({ name: "admin", pwd: "secret" });
	await assert.rejects(controller.logout(), /network unavailable/);
	assert.equal(controller.isAuthenticated(), false);
	assert.equal(controller.getState().auth, null);
});

test("invalid login responses never establish a local administrator", async () => {
	const controller = createAuthController({
		api: fakeAPI({ login: async () => ({ token: "fake" }) }),
	});
	await assert.rejects(
		controller.login({ name: "admin", pwd: "secret" }),
	);
	assert.equal(controller.isAuthenticated(), false);
	assert.equal(controller.getState().busy, false);
});
