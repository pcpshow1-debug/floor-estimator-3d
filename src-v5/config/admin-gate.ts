// Client-side gate for the static admin page. Hash only — never the password.
export const adminPasswordHash = "scrypt$7f81e28c906a543af03af4236513a442$47bfe532edb6a42e4b3ed221c8140bf0aecfbdc031c38dbea45be1d070523c20";
export const adminScryptParams = { N: 16384, r: 8, p: 1 } as const;
