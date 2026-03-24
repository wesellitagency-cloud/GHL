import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => l.split("=").map((s) => s.trim()))
);

const GHL_API_KEY = env.GHL_API_KEY;
const GHL_LOCATION_ID = env.GHL_LOCATION_ID;

if (!GHL_API_KEY || !GHL_LOCATION_ID) {
  console.error("Missing GHL_API_KEY or GHL_LOCATION_ID in .env.local");
  process.exit(1);
}

const templateBody = `Hi {{contact.first_name}},

Thanks for reaching out to {{location.name}}! We received your inquiry and wanted to make sure you had a direct line to our team.

Here are a few things our customers love about working with us:
- Fast response times
- Free estimates
- Licensed and insured professionals

Ready to get started? Book a time that works for you here:
{{calendar.link}}

Looking forward to helping you out!

— The {{location.name}} Team`;

const htmlBody = `<p>Hi {{contact.first_name}},</p>
<p>Thanks for reaching out to {{location.name}}! We received your inquiry and wanted to make sure you had a direct line to our team.</p>
<p>Here are a few things our customers love about working with us:</p>
<ul>
  <li>Fast response times</li>
  <li>Free estimates</li>
  <li>Licensed and insured professionals</li>
</ul>
<p>Ready to get started? Book a time that works for you here:<br>{{calendar.link}}</p>
<p>Looking forward to helping you out!</p>
<p>— The {{location.name}} Team</p>`;

async function createTemplate() {
  console.log("Creating email template in GoHighLevel...");

  const res = await fetch(
    `https://services.leadconnectorhq.com/locations/${GHL_LOCATION_ID}/emails/builder`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "We'd love to help with your project",
        subject: "We'd love to help with your project",
        body: htmlBody,
      }),
    }
  );

  const responseText = await res.text();

  if (!res.ok) {
    console.error(`GHL API error ${res.status}:`, responseText);

    // Try fallback endpoint
    console.log("\nTrying fallback endpoint /templates ...");
    const res2 = await fetch(
      `https://services.leadconnectorhq.com/locations/${GHL_LOCATION_ID}/templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: "2021-07-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "We'd love to help with your project",
          subject: "We'd love to help with your project",
          body: htmlBody,
          type: "email",
        }),
      }
    );

    const responseText2 = await res2.text();
    if (!res2.ok) {
      console.error(`Fallback API error ${res2.status}:`, responseText2);
      process.exit(1);
    }

    console.log("Template created successfully (via /templates):");
    console.log(JSON.parse(responseText2));
    return;
  }

  console.log("Template created successfully:");
  console.log(JSON.parse(responseText));
}

createTemplate().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
