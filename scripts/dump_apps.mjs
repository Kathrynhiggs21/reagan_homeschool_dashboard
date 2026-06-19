import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);
const [rows] = await conn.execute(
  `SELECT app_name, app_url, status, sign_in_email, sign_in_username,
          (password_encrypted IS NOT NULL) AS has_pw, preferred_google_account,
          has_family_tier, is_paid, monthly_cost, category, notes
   FROM app_accounts ORDER BY sort_order, app_name`
);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
