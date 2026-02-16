import { hasPurpose1Consent } from "../../src/utils/gdpr.js";
import { SyncType } from '../../src/userSync.js';

type ConsentParams = {
  gdprConsent?: {
    gdprApplies?: boolean;
    consentString?: string;
  };
  uspConsent?: string;
  gppConsent?: {
    gppString?: string;
    applicableSections?: number[];
  };
};

type UserSync = { type: SyncType; url: string };

let lastSiteId: string | undefined;

export function setUserSyncContext({ siteId }: { siteId?: string }) {
  if (typeof siteId === 'string' && siteId.length > 0) {
    lastSiteId = siteId;
  }
}

const buildConsentQuery = ({ gdprConsent, uspConsent, gppConsent }: ConsentParams): string[] => {
  const params: string[] = [];
  if (gdprConsent) {
    if (typeof gdprConsent.gdprApplies === 'boolean') {
      params.push(`gdpr=${gdprConsent.gdprApplies ? 1 : 0}`);
    }
    if (typeof gdprConsent.consentString === 'string') {
      params.push(`gdpr_consent=${encodeURIComponent(gdprConsent.consentString)}`);
    }
  }
  if (typeof uspConsent === 'string' && uspConsent.length > 0) {
    params.push(`us_privacy=${encodeURIComponent(uspConsent)}`);
  }
  if (gppConsent?.gppString) {
    params.push(`gpp=${encodeURIComponent(gppConsent.gppString)}`);
    if (Array.isArray(gppConsent.applicableSections)) {
      params.push(`gpp_sid=${encodeURIComponent(gppConsent.applicableSections.join(','))}`);
    }
  }
  return params;
};

const appendQueryParams = (url: string, params: string[]): string => {
  if (!params.length) return url;
  const hasQuery = url.includes('?');
  const needsSeparator = !url.endsWith('?') && !url.endsWith('&');
  const separator = hasQuery ? (needsSeparator ? '&' : '') : '?';
  return `${url}${separator}${params.join('&')}`;
};

type LoadCookieWithConsentParams = {
  source?: string;
  coop_sync?: boolean;
  max_sync_count?: number;
  bidders?: string;
  endpoint?: string;
  gdpr?: 0 | 1;
  gdpr_consent: string;
  args?: string;
};

export function buildLoadCookieWithConsentUrl(
  params: LoadCookieWithConsentParams
): string {
  const baseUrl =
    "https://acdn.adnxs.com/prebid/amp/user-sync/load-cookie-with-consent.html";

  const url = new URL(baseUrl);

  const defaults: Partial<LoadCookieWithConsentParams> = {
    source: "pubstackBidAdapter",
    coop_sync: false,
    max_sync_count: 20,
    bidders: "pubstack",
    endpoint: "https://prebid-server.pbstck.com/cookie_sync",
  };

  const merged = { ...defaults, ...params };

  const setIfDefined = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    url.searchParams.set(key, String(value));
  };

  setIfDefined("source", merged.source);
  setIfDefined("coop_sync", merged.coop_sync);
  setIfDefined("max_sync_count", merged.max_sync_count);
  setIfDefined("bidders", merged.bidders);

  setIfDefined("endpoint", merged.endpoint);

  setIfDefined("gdpr", merged.gdpr);
  setIfDefined("gdpr_consent", merged.gdpr_consent);
  setIfDefined("args", merged.args);

  return url.toString();
}

export function getUserSyncs(
  syncOptions: { iframeEnabled: boolean; pixelEnabled: boolean },
  serverResponses,
  gdprConsent,
  uspConsent,
  gppConsent
): UserSync[] {
  if (!syncOptions.iframeEnabled && !syncOptions.pixelEnabled) {
    return [];
  }
  if (!hasPurpose1Consent(gdprConsent)) {
    return [];
  }
  if (!Array.isArray(serverResponses) || serverResponses.length === 0) {
    return [];
  }

  const consentParams = buildConsentQuery({ gdprConsent, uspConsent, gppConsent });
  const syncs: UserSync[] = [];
  const seen = new Set<string>();

  const pushSync = (type: SyncType, url: string, options: { appendConsent?: boolean } = {}) => {
    if (type === 'iframe' ? !syncOptions.iframeEnabled : !syncOptions.pixelEnabled) {
      return;
    }
    const shouldAppendConsent = options.appendConsent !== false;
    const finalUrl = shouldAppendConsent && consentParams.length ? appendQueryParams(url, consentParams) : url;
    const key = `${type}|${finalUrl}`;
    if (!seen.has(key)) {
      seen.add(key);
      syncs.push({ type, url: finalUrl });
    }
  };

  if (syncOptions.iframeEnabled && typeof lastSiteId === 'string' && lastSiteId.length > 0) {
    const params: LoadCookieWithConsentParams = {
      gdpr_consent: gdprConsent?.consentString || '',
      args: `account:${lastSiteId}`,
      gdpr: typeof gdprConsent?.gdprApplies === 'boolean' ? (gdprConsent.gdprApplies ? 1 : 0) : 0
    };
    const iframeUrl = buildLoadCookieWithConsentUrl(params);
    pushSync('iframe', iframeUrl, { appendConsent: false });
  }

  return syncs;
}
