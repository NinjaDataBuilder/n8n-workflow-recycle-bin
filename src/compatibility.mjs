export const SUPPORT_MATRIX = Object.freeze([
  Object.freeze({
    range: '2.32.x',
    coreApi: true,
    externalHooks: true,
    sidebarAdapter: 'v2.32',
    status: 'supported',
  }),
]);

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(version).trim());
  if (!match) throw new Error(`Invalid n8n version: ${version}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function resolveCompatibility(version) {
  const parsed = parseVersion(version);
  const match = SUPPORT_MATRIX.find((entry) =>
    entry.range === `${parsed.major}.${parsed.minor}.x`,
  );

  if (!match) {
    return Object.freeze({
      status: 'unsupported',
      version: `${parsed.major}.${parsed.minor}.${parsed.patch}`,
      reason: 'No tested UI adapter exists for this n8n release line. Installation must stop before changing the instance.',
    });
  }

  return Object.freeze({ ...match, version: `${parsed.major}.${parsed.minor}.${parsed.patch}` });
}

export function assertCompatible(version) {
  const compatibility = resolveCompatibility(version);
  if (compatibility.status !== 'supported') throw new Error(compatibility.reason);
  return compatibility;
}
