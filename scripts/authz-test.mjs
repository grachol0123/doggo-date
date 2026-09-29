// Authz test: proves API-level authorization guards on the critical routes still work together.
// Zero dependencies on purpose. Run against a live local server: BASE_URL=http://localhost:4321 node scripts/authz-test.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const PASSWORD = "AuthzTestPassw0rd!";
const OWNER_A_USER_ID = "77777777-7777-4777-8777-777777777777";
const OWNER_A_EMAIL = "authz-owner-a@doggo-date.test";
const OWNER_B_EMAIL = "authz-owner-b@doggo-date.test";
const OWNER_A_FIXTURE = {
  name: "Authz Owner A Dog",
  ageYears: "4",
  description: "Dedicated authorization test fixture for owner A.",
  breed: "Labrador",
  activityLevel: "walker",
  interests: ["walks", "fetch"],
};
const OWNER_B_FIXTURE = {
  name: "Authz Owner B Dog",
  description: "Dedicated authorization test fixture for owner B.",
};

const ownerAJar = new Map();
const ownerBJar = new Map();
const state = {
  ownerADogId: "",
  ownerAUpdatedDescription: `Updated by authz script at ${new Date().toISOString()}`,
};

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(jar, response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((attr) => /max-age=0/i.test(attr.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

function buildForm(entries) {
  const form = new URLSearchParams();

  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      for (const item of value) {
        form.append(key, item);
      }
      continue;
    }

    form.append(key, value);
  }

  return form;
}

async function request(path, { jar, method = "GET", form, json } = {}) {
  const headers = {
    Origin: BASE_URL,
    ...(jar && cookieHeader(jar) ? { Cookie: cookieHeader(jar) } : {}),
    ...(form instanceof URLSearchParams ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
  };

  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers,
    body: json !== undefined ? JSON.stringify(json) : form?.toString(),
  });

  if (jar) {
    storeCookies(jar, response);
  }

  const text = await response.text();
  let parsedJson = null;

  try {
    parsedJson = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON response body (e.g. an HTML redirect target) — leave parsedJson as null.
  }

  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
    text,
    json: parsedJson,
  };
}

async function signIn(jar, email) {
  return request("/api/auth/signin", {
    jar,
    method: "POST",
    form: buildForm([
      ["email", email],
      ["password", PASSWORD],
    ]),
  });
}

function extractDogIdFromDashboard(html, ownerUserId) {
  const escapedOwnerId = ownerUserId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const uuidPattern = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
  const patterns = [
    new RegExp(`"dog":\\{[^}]*"id":"${uuidPattern}"[^}]*"owner_id":"${escapedOwnerId}"[^}]*\\}`, "i"),
    new RegExp(`"dog":\\{[^}]*"owner_id":"${escapedOwnerId}"[^}]*"id":"${uuidPattern}"[^}]*\\}`, "i"),
    new RegExp(`"id":"${uuidPattern}"[^<]{0,600}"owner_id":"${escapedOwnerId}"`, "i"),
    new RegExp(`"owner_id":"${escapedOwnerId}"[^<]{0,600}"id":"${uuidPattern}"`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return "";
}

function ok(summary) {
  return { ok: true, summary, expected: "" };
}

function fail(summary, expected) {
  return { ok: false, summary, expected };
}

const steps = [
  [
    "anonymous next-candidate rejects unauthenticated access",
    async () => {
      const response = await request("/api/dogs/next-candidate");
      const passes = response.status === 401 && response.json?.status === "unauthenticated";

      return passes
        ? ok(`${response.status} ${JSON.stringify(response.json)}`)
        : fail(
            `${response.status} ${response.location || response.text.slice(0, 120)}`,
            'expected 401 {"status":"unauthenticated"}',
          );
    },
  ],
  [
    "anonymous swipes rejects unauthenticated access",
    async () => {
      const response = await request("/api/swipes", {
        method: "POST",
        json: {
          targetDogId: "11111111-1111-4111-8111-111111111111",
          decision: "like",
        },
      });
      const passes = response.status === 401 && response.json?.status === "unauthenticated";

      return passes
        ? ok(`${response.status} ${JSON.stringify(response.json)}`)
        : fail(
            `${response.status} ${response.location || response.text.slice(0, 120)}`,
            'expected 401 {"status":"unauthenticated"}',
          );
    },
  ],
  [
    "anonymous dogs/save redirects to signin",
    async () => {
      const response = await request("/api/dogs/save", { method: "POST" });
      const passes = response.status === 302 && response.location.startsWith("/auth/signin");

      return passes
        ? ok(`${response.status} ${response.location}`)
        : fail(`${response.status} ${response.location}`, "expected 302 /auth/signin");
    },
  ],
  [
    "owner A next-candidate excludes owner A dog",
    async () => {
      const signinResponse = await signIn(ownerAJar, OWNER_A_EMAIL);
      if (signinResponse.status !== 302 || signinResponse.location !== "/") {
        return fail(`${signinResponse.status} ${signinResponse.location}`, "expected owner A signin to redirect to /");
      }

      const dashboardResponse = await request("/dashboard/dog", { jar: ownerAJar });
      if (dashboardResponse.status !== 200) {
        return fail(
          `${dashboardResponse.status} ${dashboardResponse.location}`,
          "expected owner A dashboard to render",
        );
      }

      state.ownerADogId = extractDogIdFromDashboard(dashboardResponse.text, OWNER_A_USER_ID);

      const candidateResponse = await request("/api/dogs/next-candidate", { jar: ownerAJar });
      const candidateDog = candidateResponse.json?.dog;
      const excludesOwnerById = state.ownerADogId ? candidateDog?.id !== state.ownerADogId : true;
      const excludesOwnerByUser = candidateDog?.owner_id !== OWNER_A_USER_ID;
      const passes =
        candidateResponse.status === 200 &&
        candidateResponse.json?.status === "ok" &&
        Boolean(candidateDog?.id) &&
        excludesOwnerById &&
        excludesOwnerByUser;

      return passes
        ? ok(
            `${candidateResponse.status} candidate=${candidateDog.id} owner=${candidateDog.owner_id} ownDog=${
              state.ownerADogId || "unavailable"
            }`,
          )
        : fail(
            `${candidateResponse.status} ${JSON.stringify(candidateResponse.json)}`,
            "expected 200 {status:'ok'} with a candidate not owned by owner A and not matching owner A's dog id",
          );
    },
  ],
  [
    "owner A dogs/save updates only owner A dog",
    async () => {
      const saveResponse = await request("/api/dogs/save", {
        jar: ownerAJar,
        method: "POST",
        form: buildForm([
          ["name", OWNER_A_FIXTURE.name],
          ["age_years", OWNER_A_FIXTURE.ageYears],
          ["description", state.ownerAUpdatedDescription],
          ["breed", OWNER_A_FIXTURE.breed],
          ["activity_level", OWNER_A_FIXTURE.activityLevel],
          ["temperament", ["friendly", "focused"]],
          ["interests", OWNER_A_FIXTURE.interests],
        ]),
      });

      if (saveResponse.status !== 302 || saveResponse.location !== "/dashboard/dog?saved=1") {
        return fail(`${saveResponse.status} ${saveResponse.location}`, "expected 302 /dashboard/dog?saved=1");
      }

      const dashboardResponse = await request("/dashboard/dog", { jar: ownerAJar });
      const updatedOwnDog =
        dashboardResponse.status === 200 &&
        dashboardResponse.text.includes(OWNER_A_FIXTURE.name) &&
        dashboardResponse.text.includes(state.ownerAUpdatedDescription);

      return updatedOwnDog
        ? ok(`${saveResponse.status} ${saveResponse.location}`)
        : fail(
            `${dashboardResponse.status} owner A dashboard missing updated data`,
            "expected owner A dashboard HTML to include the updated description after save",
          );
    },
  ],
  [
    "owner B dashboard remains unchanged after owner A save",
    async () => {
      const signinResponse = await signIn(ownerBJar, OWNER_B_EMAIL);
      if (signinResponse.status !== 302 || signinResponse.location !== "/") {
        return fail(`${signinResponse.status} ${signinResponse.location}`, "expected owner B signin to redirect to /");
      }

      const dashboardResponse = await request("/dashboard/dog", { jar: ownerBJar });
      const remainsUntouched =
        dashboardResponse.status === 200 &&
        dashboardResponse.text.includes(OWNER_B_FIXTURE.name) &&
        dashboardResponse.text.includes(OWNER_B_FIXTURE.description) &&
        !dashboardResponse.text.includes(state.ownerAUpdatedDescription);

      return remainsUntouched
        ? ok(`${dashboardResponse.status} owner B fixture still present`)
        : fail(
            `${dashboardResponse.status} owner B dashboard did not match original fixture state`,
            `expected HTML to include "${OWNER_B_FIXTURE.name}" and "${OWNER_B_FIXTURE.description}" but not owner A's updated description`,
          );
    },
  ],
];

let failed = 0;
for (const [name, run] of steps) {
  const actual = await run();
  console.log(`${actual.ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.summary}`);
  if (!actual.ok) {
    failed++;
    console.log(`      ${actual.expected}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll authz steps passed");
process.exit(failed ? 1 : 0);
