const TEMPLATE_ROUTE_PATTERN = /^\/t\/([0-9A-HJKMNP-TV-Z]{26})\/?$/i;

export function getTemplateIdFromPath(pathname: string): string | null {
  const match = TEMPLATE_ROUTE_PATTERN.exec(pathname);
  return match ? match[1].toUpperCase() : null;
}

export function buildTemplatePath(templateId: string): string {
  return `/t/${encodeURIComponent(templateId)}`;
}

export function getTemplateShareUrl(templateId: string, origin?: string): string {
  const resolvedOrigin = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${resolvedOrigin}${buildTemplatePath(templateId)}`;
}
