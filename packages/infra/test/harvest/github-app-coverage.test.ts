import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  type AppInstallationScope,
  buildAppCoverageReport,
} from '../../src/harvest/github-app-coverage';
import type {
  GitHubSourcePreflightResult,
} from '../../src/harvest/github-source-preflight';

const result = (
  sourceId: string,
  repository: string,
  outcome: Pick<GitHubSourcePreflightResult, 'category' | 'credentialMode' | 'errorCode'>
): GitHubSourcePreflightResult => {
  const [owner, name] = repository.split('/');
  return {
    sourceId,
    target: { host: 'github.com', owner, repository: name },
    operations: [],
    ...outcome
  };
};
const publicSource = (id: string, repository: string): GitHubSourcePreflightResult =>
  result(id, repository, { category: 'public-generic', credentialMode: 'generic' });
const appSource = (id: string, repository: string): GitHubSourcePreflightResult =>
  result(id, repository, { category: 'app-authenticated', credentialMode: 'app' });
const unresolvedSource = (id: string, repository: string, errorCode: string): GitHubSourcePreflightResult =>
  result(id, repository, { category: 'unresolved', credentialMode: 'none', errorCode });

const build = (
  results: GitHubSourcePreflightResult[],
  installations: [string, AppInstallationScope][] = []
) => buildAppCoverageReport({
  hubId: 'hub',
  contentState: 'released',
  app: { appId: '123' },
  preflight: { valid: false, results, appRoutes: [] },
  installations: new Map(installations)
});

describe('buildAppCoverageReport', () => {
  it('turns missing installations and ungranted repositories into a scope request', () => {
    const report = build([
      publicSource('public', 'open/tools'),
      appSource('covered', 'granted-org/alpha'),
      unresolvedSource('not-granted-b', 'granted-org/beta', 'GH_APP_AUTH_REQUEST_FAILED'),
      unresolvedSource('not-granted-b-again', 'granted-org/beta', 'GH_APP_AUTH_REQUEST_FAILED'),
      unresolvedSource('not-granted-a', 'granted-org/aardvark', 'GH_APP_AUTH_REQUEST_FAILED'),
      unresolvedSource('not-installed', 'new-org/gamma', 'GH_APP_AUTH_SETUP_FAILED')
    ], [['granted-org', { repositorySelection: 'selected', repositoryCount: 3 }]]);

    expect(report.complete).toBe(false);
    expect(report.totals).toEqual({ sources: 6, public: 1, app: 1, uncovered: 4, failed: 0 });
    expect(report.scopeRequest).toEqual([
      { organization: 'granted-org', action: 'add-repositories', repositories: ['aardvark', 'beta'] },
      { organization: 'new-org', action: 'install-app', repositories: ['gamma'] }
    ]);
    expect(report.organizations).toEqual([
      {
        organization: 'granted-org',
        installed: true,
        repositorySelection: 'selected',
        grantedRepositoryCount: 3,
        coveredRepositories: ['alpha'],
        missingRepositories: ['aardvark', 'beta']
      },
      { organization: 'new-org', installed: false, coveredRepositories: [], missingRepositories: ['gamma'] }
    ]);
    expect(report.sources.find((source) => source.sourceId === 'not-installed')).toEqual({
      sourceId: 'not-installed',
      repository: 'new-org/gamma',
      organization: 'new-org',
      access: 'uncovered',
      reason: 'app-not-installed',
      errorCode: 'GH_APP_AUTH_SETUP_FAILED'
    });
    expect(report.warnings).toEqual([]);
  });

  it('reports unreadable repositories under an all-repositories installation as failures, not scope requests', () => {
    const report = build(
      [unresolvedSource('gone', 'all-org/gone', 'GH_APP_AUTH_REQUEST_FAILED')],
      [['all-org', { repositorySelection: 'all', repositoryCount: 40 }]]
    );

    expect(report.sources[0]).toMatchObject({ access: 'failed', reason: 'repository-not-found' });
    expect(report.scopeRequest).toEqual([]);
    expect(report.warnings).toEqual([expect.stringContaining('check that the repositories exist')]);
  });

  it('lists the organizations that need the App when no App is configured, without a scope request', () => {
    const report = build([unresolvedSource('private', 'org/private', 'GH_APP_AUTH_CONFIG_MISSING')]);

    expect(report.sources[0]).toMatchObject({ access: 'uncovered', reason: 'app-not-configured' });
    expect(report.organizations).toEqual([{ organization: 'org', coveredRepositories: [], missingRepositories: ['private'] }]);
    expect(report.scopeRequest).toEqual([]);
    expect(report.warnings).toEqual([expect.stringContaining('No GitHub App is configured')]);
  });

  it('warns when setup failed for every organization and keeps other failures out of the scope request', () => {
    const report = build([
      unresolvedSource('a', 'one/a', 'GH_APP_AUTH_SETUP_FAILED'),
      unresolvedSource('b', 'two/b', 'GH_APP_AUTH_INSTALLATION_MISSING'),
      unresolvedSource('broken', 'three/c', 'GH_SOURCE_PREFLIGHT_UNRESOLVED')
    ]);

    expect(report.sources.find((source) => source.sourceId === 'broken')).toMatchObject({ access: 'failed' });
    expect(report.scopeRequest.map((request) => [request.organization, request.action])).toEqual([
      ['one', 'install-app'],
      ['two', 'install-app']
    ]);
    expect(report.warnings).toEqual([expect.stringContaining('App setup failed for every organization')]);
  });

  it('is complete when every source is public or read through the App', () => {
    const report = build([publicSource('public', 'open/tools'), appSource('private', 'org/private')]);

    expect(report.complete).toBe(true);
    expect(report.scopeRequest).toEqual([]);
  });
});
