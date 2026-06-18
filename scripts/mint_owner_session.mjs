import { SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "");
const openId = process.env.OWNER_OPEN_ID;
const appId = process.env.VITE_APP_ID;
const name = process.env.OWNER_NAME || "Owner";

const exp = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);
const token = await new SignJWT({ openId, appId, name })
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setExpirationTime(exp)
  .sign(secret);

console.log(token);
