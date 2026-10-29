export const FIELDS = ["name", "age", "gender", "idType", "idNumber"];

export function classify(label) {
  const t = String(label || "").toLowerCase().replace(/\s+/g, " ");
  if (/(photo\s*id|identity|id\s*proof).*(number|no\b)|\bid\s*number\b/.test(t)) return "idNumber";
  if (/photo\s*id\s*proof|\bid\s*(proof|type)\b|\bidentity\b/.test(t)) return "idType";
  if (/\bgender\b|\bsex\b/.test(t)) return "gender";
  if (/\bage\b/.test(t)) return "age";
  if (/\bname\b/.test(t)) return "name";
  return null;
}

export function validate(profile) {
  const problems = [];
  if (!/^[\p{L} .'-]{2,80}$/u.test((profile.name || "").trim())) problems.push("name");
  if (!Number.isInteger(Number(profile.age)) || Number(profile.age) < 1 || Number(profile.age) > 120) problems.push("age");
  if (!["Male", "Female", "Transgender"].includes(profile.gender)) problems.push("gender");
  if (!["Aadhaar Card", "Passport"].includes(profile.idType)) problems.push("ID type");
  const id = (profile.idNumber || "").replace(/[ -]/g, "");
  if (profile.idType === "Aadhaar Card" && !/^\d{12}$/.test(id)) problems.push("12-digit ID number");
  if (profile.idType === "Passport" && !/^[A-Z0-9]{6,15}$/i.test(id)) problems.push("passport number");
  return problems;
}

export function plan(profiles, count) {
  if (!Array.isArray(profiles) || profiles.length !== count || count < 1) throw Error(`Select exactly ${count} pilgrims in row order.`);
  for (const [i, p] of profiles.entries()) {
    const problems = validate(p);
    if (problems.length) throw Error(`Pilgrim ${i + 1}: check ${problems.join(", ")}.`);
  }
  return profiles.flatMap((p, row) => FIELDS.map(field => ({row, field,
    value: field === "idNumber" ? p.idNumber.replace(/[ -]/g, "") : String(p[field]).trim()})));
}
