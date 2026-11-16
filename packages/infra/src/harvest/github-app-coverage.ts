/**
 * GitHub App coverage report for a Hub's sources.
 *
 * Built from the source-aware preflight alone (no harvest), it tells which
 * sources the App cannot read and groups them by organization into the
 * installation changes to request: install the App on an organization, or
 * add repositories to an existing installation.
 * @module harvest/github-app-coverage
 */
import type {
  GitHubSourcePreflightReport,
  GitHubSourcePreflightResult,
} from './github-source-preflight';

/** How a source is read: anonymous-free public access, the App, or not at all. */
export type AppCoverageAccess = 'public' | 'app' | 'uncovered' | 'failed';

/**
 * Why the App cannot read a source.
 * - `app-not-installed`: the App has no installation on the organization.
 * - `repository-not-granted`: the installation is limited to selected
 * repositories and this one is not among them.
 * - `repository-not-found`: the installation covers all repositories, so the
 * repository is missing, renamed or otherwise unreadable; not a scope issue.
 * - `app-not-configured`: no App was configured for the run.
 */
export type AppCoverageReason =
  | 'app-not-installed'
  | 'repository-not-granted'
  | 'repository-not-found'
  | 'app-not-configured';

/** Installation details read with an installation token. */
export interface AppInstallationScope {
  repositorySelection: 'all' | 'selected';
  /** Number of repositories the installation can read. */
  repositoryCount: number;
}

export interface AppCoverageSource {
  sourceId: string;
  /** `owner/repo`, when the source URL is a valid GitHub repository. */
  repository?: string;
  organization?: string;
  access: AppCoverageAccess;
  reason?: AppCoverageReason;
  errorCode?: string;
}

export interface AppCoverageOrganization {
  organization: string;
  /** `undefined` when no App was configured, so installation is unknown. */
  installed?: boolean;
  repositorySelection?: 'all' | 'selected';
  /** Repositories the installation can read, as reported by GitHub. */
  grantedRepositoryCount?: number;
  /** Source repositories the App can read. */
  coveredRepositories: string[];
  /** Source repositories the App cannot read. */
  missingRepositories: string[];
}

/** One installation change to request from the organization owners. */
export interface AppScopeRequest {
  organization: string;
  action: 'install-app' | 'add-repositories';
  /** Repository names (without the owner) to grant. */
  repositories: string[];
}

export interface HubAppCoverageReport {
  hubId: string;
  contentState: 'branch' | 'released';
  app: { appId?: string; clientId?: string };
  /** `true` when every source is readable. */
  complete: boolean;
  totals: { sources: number; public: number; app: number; uncovered: number; failed: number };
  /** Installation changes that would make every App source readable. */
  scopeRequest: AppScopeRequest[];
  /** Organizations whose repositories need the App. */
  organizations: AppCoverageOrganization[];
  sources: AppCoverageSource[];
  warnings: string[];
}

export interface BuildAppCoverageReportInput {
  hubId: string;
  contentState: 'branch' | 'released';
  app: { appId?: string; clientId?: string };
  preflight: GitHubSourcePreflightReport;
  /** Installation scope per organization (lower-case key), where it could be read. */
  installations: ReadonlyMap<string, AppInstallationScope>;
}

const NOT_INSTALLED_CODES = new Set(['GH_APP_AUTH_SETUP_FAILED', 'GH_APP_AUTH_INSTALLATION_MISSING']);
const NOT_READABLE_CODES = new Set(['GH_APP_AUTH_REQUEST_FAILED']);

/**
 * Whether the preflight sent this source to the App (public checks required auth).
 * @param result Preflight result of the source.
 * @returns `true` for App candidates.
 */
function isAppCandidate(result: GitHubSourcePreflightResult): boolean {
  return result.credentialMode === 'app'
    || NOT_INSTALLED_CODES.has(result.errorCode ?? '')
    || NOT_READABLE_CODES.has(result.errorCode ?? '')
    || result.errorCode === 'GH_APP_AUTH_CONFIG_MISSING';
}

function classify(
  result: GitHubSourcePreflightResult,
  installations: ReadonlyMap<string, AppInstallationScope>
): Pick<AppCoverageSource, 'access' | 'reason'> {
  if (result.category === 'public-generic') {
    return { access: 'public' };
  }
  if (result.category === 'app-authenticated') {
    return { access: 'app' };
  }
  const code = result.errorCode ?? '';
  if (NOT_INSTALLED_CODES.has(code)) {
    return { access: 'uncovered', reason: 'app-not-installed' };
  }
  if (code === 'GH_APP_AUTH_CONFIG_MISSING') {
    return { access: 'uncovered', reason: 'app-not-configured' };
  }
  if (NOT_READABLE_CODES.has(code)) {
    const scope = installations.get(result.target?.owner.toLowerCase() ?? '');
    return scope?.repositorySelection === 'all'
      ? { access: 'failed', reason: 'repository-not-found' }
      : { access: 'uncovered', reason: 'repository-not-granted' };
  }
  return { access: 'failed' };
}

const sortedUnique = (values: Iterable<string>): string[] =>
  [...new Set(values)].toSorted((left, right) => left.localeCompare(right));

/**
 * Turn a source preflight into an App coverage report.
 * @param input Preflight report, installation scopes and run identity.
 * @returns Per-source access, per-organization coverage and the scope request.
 */
export function buildAppCoverageReport(input: BuildAppCoverageReportInput): HubAppCoverageReport {
  const sources: AppCoverageSource[] = input.preflight.results.map((result) => {
    const target = result.target;
    return {
      sourceId: result.sourceId,
      ...(target === undefined ? {} : { repository: `${target.owner}/${target.repository}`, organization: target.owner }),
      ...classify(result, input.installations),
      ...(result.errorCode === undefined ? {} : { errorCode: result.errorCode })
    };
  });

  const byOrganization = new Map<string, { name: string; covered: Set<string>; missing: Set<string>; notInstalled: boolean; configured: boolean }>();
  input.preflight.results.forEach((result, index) => {
    if (result.target === undefined || !isAppCandidate(result)) {
      return;
    }
    const source = sources[index];
    const key = result.target.owner.toLowerCase();
    const entry = byOrganization.get(key) ?? {
      name: result.target.owner, covered: new Set<string>(), missing: new Set<string>(), notInstalled: false, configured: true
    };
    byOrganization.set(key, entry);
    if (source.access === 'app') {
      entry.covered.add(result.target.repository);
    } else {
      entry.missing.add(result.target.repository);
    }
    entry.notInstalled ||= source.reason === 'app-not-installed';
    entry.configured &&= source.reason !== 'app-not-configured';
  });

  const organizations: AppCoverageOrganization[] = [...byOrganization.entries()]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => {
      const scope = input.installations.get(key);
      return {
        organization: entry.name,
        ...(entry.configured ? { installed: !entry.notInstalled } : {}),
        ...(scope === undefined ? {} : { repositorySelection: scope.repositorySelection, grantedRepositoryCount: scope.repositoryCount }),
        coveredRepositories: sortedUnique(entry.covered),
        missingRepositories: sortedUnique(entry.missing)
      };
    });

  const scopeRequest: AppScopeRequest[] = organizations.flatMap((organization): AppScopeRequest[] => {
    if (organization.missingRepositories.length === 0 || organization.installed === undefined) {
      return [];
    }
    if (!organization.installed) {
      return [{ organization: organization.organization, action: 'install-app', repositories: organization.missingRepositories }];
    }
    if (organization.repositorySelection === 'all') {
      return [];
    }
    return [{ organization: organization.organization, action: 'add-repositories', repositories: organization.missingRepositories }];
  });

  const count = (access: AppCoverageAccess): number => sources.filter((source) => source.access === access).length;
  const warnings: string[] = [];
  if (organizations.length > 0 && organizations.every((organization) => organization.installed === false)) {
    warnings.push('App setup failed for every organization; check the App ID and private key before requesting installations.');
  }
  if (organizations.some((organization) => organization.installed === undefined)) {
    warnings.push('No GitHub App is configured, so installations are unknown; only the organizations needing the App are listed.');
  }
  const notFound = sources.filter((source) => source.reason === 'repository-not-found');
  if (notFound.length > 0) {
    warnings.push(`${String(notFound.length)} source(s) are unreadable although the App covers all repositories of their organization; check that the repositories exist.`);
  }

  return {
    hubId: input.hubId,
    contentState: input.contentState,
    app: input.app,
    complete: sources.every((source) => source.access === 'public' || source.access === 'app'),
    totals: {
      sources: sources.length,
      public: count('public'),
      app: count('app'),
      uncovered: count('uncovered'),
      failed: count('failed')
    },
    scopeRequest,
    organizations,
    sources,
    warnings
  };
}
