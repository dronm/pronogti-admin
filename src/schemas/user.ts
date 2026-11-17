import * as v from "valibot";

import { RoleIdSchema } from "./enums/roleId";
import type {
	User,
	UserLoginRequest,
	UserPasswordChangeRequest,
} from "../types/user";
import type {
	UserLoginResponse,
	UserSessionResponse,
} from "../types/userLogin";

export const UserNameSchema = v.pipe(
	v.string("Введите имя пользователя."),
	v.trim(),
	v.nonEmpty("Введите имя пользователя."),
	v.maxLength(50, "Имя пользователя не должно превышать 50 символов."),
);

export const UserPasswordSchema = v.pipe(
	v.string("Введите пароль."),
	v.nonEmpty("Введите пароль."),
	v.check(
		(value) => new TextEncoder().encode(value).length <= 72,
		"Пароль не должен превышать 72 байта UTF-8.",
	),
);

export const UserLoginRequestSchema = v.object({
	name: UserNameSchema,
	pwd: UserPasswordSchema,
});

const UserPasswordChangeRequestSchema = v.pipe(
	v.object({
		new_password: v.pipe(
			UserPasswordSchema,
			v.check(
				(value) => [...value].length >= 6,
				"Пароль должен содержать не менее 6 символов.",
			),
		),
		confirm_password: UserPasswordSchema,
	}),
	v.check(
		(value) => value.new_password === value.confirm_password,
		"Пароли не совпадают.",
	),
);

export const UserSchema = v.object({
	id: v.pipe(
		v.number(),
		v.integer(),
		v.minValue(1),
		v.maxValue(Number.MAX_SAFE_INTEGER),
	),
	name: UserNameSchema,
	role_id: RoleIdSchema,
	locale_id: v.literal("ru"),
});

export const UserDTOSchema = UserSchema;
export const UserKeySchema = v.object({
	id: v.pipe(v.number(), v.integer(), v.minValue(1)),
});

const AuthSchema = v.object({
	token: v.pipe(
		v.string(),
		v.minLength(32),
		v.maxLength(256),
		v.regex(/^[A-Za-z0-9_-]+$/),
	),
	expires_at: v.optional(
		v.pipe(
			v.string(),
			v.check((value) => Number.isFinite(Date.parse(value))),
		),
	),
});

export const UserLoginResponseSchema = v.object({
	auth: AuthSchema,
	user: UserSchema,
});

export const UserSessionResponseSchema = v.union([
	UserLoginResponseSchema,
	v.object({ auth: v.null(), user: v.null() }),
]);

export const parseLoginRequest = (value: unknown): UserLoginRequest => {
	return v.parse(UserLoginRequestSchema, value);
};

export const parsePasswordChangeRequest = (
	value: unknown,
): UserPasswordChangeRequest => {
	return v.parse(UserPasswordChangeRequestSchema, value);
};

export const parseLoginResponse = (value: unknown): UserLoginResponse => {
	return v.parse(UserLoginResponseSchema, value);
};

export const parseSessionResponse = (value: unknown): UserSessionResponse => {
	return v.parse(UserSessionResponseSchema, value);
};

export const userFromDTO = (value: unknown): User => {
	return v.parse(UserSchema, value);
};
