// A public CSRF nonce. Authentication is held by the HttpOnly administrator cookie.
export interface Auth {
	token: string;
	expires_at?: string;
}
