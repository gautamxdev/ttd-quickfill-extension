const flows = {spat: "Sri PAT", sed: "Special Entry Darshan (SED)", apd: "Angapradakshinam"};

export function detectFlow(value) {
  try {
    const url = new URL(value);
    if (url.origin !== "https://ttdevasthanams.ap.gov.in") return null;
    const match = url.pathname.match(/^\/(spat|sed|apd)\/(pilgrim-details|slot-booking|slot-booking-acc)\/?$/);
    if (!match) {
      if (!/^\/pilgrim-details\/?$/.test(url.pathname)) return null;
      const id = url.searchParams.get("flow") || url.searchParams.get("flowIdentifier");
      return flows[id] ? {id, name: flows[id]} : null;
    }
    if (match[1] === "sed" && match[2] === "slot-booking-acc") return {id: "sed", name: flows.sed};
    // Some portal pages keep slot-booking in the path and switch section in the query.
    if (match[2] !== "pilgrim-details" && url.searchParams.get("section") !== "pilgrim-details") return null;
    return {id: match[1], name: flows[match[1]]};
  } catch { return null; }
}
