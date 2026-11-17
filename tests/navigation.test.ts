import assert from "node:assert/strict";
import test from "node:test";
import { safeNextPath } from "../src/utils/navigation";

test("login returns to local application paths only", () => {
	assert.equal(
		safeNextPath("/profile?tab=account"),
		"/profile?tab=account",
	);
	for (const path of [
		undefined,
		["/profile"],
		"https://evil.invalid",
		"//evil.invalid",
		"/\\evil.invalid",
		"/%2fevil.invalid",
		"/%5cevil.invalid",
		"/login",
		"/login?next=/profile",
		"/\nevil.invalid",
	]) {
		assert.equal(safeNextPath(path), null, String(path));
	}
});
