#!/usr/bin/env node
'use strict';

var require$$0$2 = require('node:fs');
var require$$0 = require('node:path');
var require$$0$1 = require('node:crypto');

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

var collection = {};

var generateSkill = {};

var dist = {};

var domain = {};

var types$8 = {};

/**
 * Domain layer — Bundle types.
 *
 * `Bundle` is the catalog/runtime entry as fetched from a source adapter and
 * shown to users (Marketplace, `cli index search`, etc.). It is distinct
 * from `Collection` (`../collection/types.ts`), which is the pre-build,
 * author-facing shape of a `deployment-manifest.yml`.
 *
 * Mirrors the shape already in production at
 * `src/types/registry.ts` (`Bundle`, `BundleDependency`, `BundleUpdate`) so
 * that the extension's `RegistryManager`/`BundleInstaller` can eventually
 * delegate to this type with zero field-mapping (see migration plan §7.5).
 * @module domain/bundle/types
 */
Object.defineProperty(types$8, "__esModule", { value: true });

var id = {};

/**
 * Domain layer — Bundle ID generation.
 *
 * IMPORTANT: this logic must stay in sync with `src/utils/bundleNameUtils.ts`
 * (`generateBuildScriptBundleId`) and `lib/src/bundle-id.ts`
 * (`generateBundleId`) until those call sites are migrated onto this
 * implementation (migration plan §7.5/§7.7). The format is unchanged:
 * `{owner}-{repo}-{collectionId}-v{version}`.
 * @module domain/bundle/id
 */
Object.defineProperty(id, "__esModule", { value: true });
id.generateBundleId = generateBundleId;
id.generateGitHubReleaseBundleId = generateGitHubReleaseBundleId;
id.isManifestIdMatch = isManifestIdMatch;
/**
 * Generate the canonical bundle ID for a collection.
 * @param repoSlug - Repository slug (`owner/repo` or already-hyphenated `owner-repo`).
 * @param collectionId - Collection identifier.
 * @param version - Version string, without a leading `v`.
 * @returns Canonical bundle ID, e.g. `owner-repo-my-collection-v1.0.0`.
 */
function generateBundleId(repoSlug, collectionId, version) {
    const normalizedSlug = repoSlug.replaceAll('/', '-');
    return `${normalizedSlug}-${collectionId}-v${version}`;
}
/**
 * Generate the canonical bundle ID for a GitHub release, as fetched at
 * runtime by the GitHub source adapter.
 *
 * IMPORTANT: this is a *distinct* format from {@link generateBundleId}
 * (ported from `src/utils/bundleNameUtils.ts`'s `generateGitHubBundleId`,
 * not `generateBuildScriptBundleId`) — no `v` prefix before the version,
 * and it falls back to the raw release tag when the manifest doesn't
 * declare its own collection id. Do not consolidate these two: they are
 * used by different producers (build-time collection bundler vs. the
 * runtime GitHub adapter reading whatever a release happens to contain)
 * that must keep matching their own historical ID format for
 * already-published bundles.
 * @param owner - Repository owner.
 * @param repo - Repository name.
 * @param tagName - Git tag name of the release (e.g. `v1.0.0`).
 * @param manifestId - Collection id from the release's deployment manifest, if present.
 * @param manifestVersion - Version from the release's deployment manifest, if present.
 * @returns Canonical bundle ID, e.g. `owner-repo-my-collection-1.0.0` or, lacking
 * a manifest id, `owner-repo-v1.0.0`.
 */
function generateGitHubReleaseBundleId(owner, repo, tagName, manifestId, manifestVersion) {
    const cleanVersion = manifestVersion ?? tagName.replace(/^v/, '');
    return manifestId ? `${owner}-${repo}-${manifestId}-${cleanVersion}` : `${owner}-${repo}-${tagName}`;
}
/**
 * Check whether a manifest's declared id/version match a bundle id.
 *
 * For GitHub-sourced collection bundles, the manifest may declare just
 * the collection id (e.g. `my-collection`) while the bundle id is the
 * full computed id produced by {@link generateGitHubReleaseBundleId}
 * (e.g. `owner-repo-my-collection-1.0.0` or `owner-repo-my-collection-v1.0.0`).
 * This accepts an exact match as well as both suffix forms, with or
 * without the `v` version prefix.
 *
 * IMPORTANT: this logic must stay in sync with
 * `src/utils/bundle-name-utils.ts` (`isManifestIdMatch`) until that
 * call site is migrated onto this implementation (migration plan §7.5/§7.7).
 * @param manifestId - The `id` field from the deployment manifest.
 * @param manifestVersion - The `version` field from the deployment manifest.
 * @param bundleId - The computed bundle id to match against.
 * @returns `true` if `manifestId`/`manifestVersion` identify `bundleId`.
 */
function isManifestIdMatch(manifestId, manifestVersion, bundleId) {
    return manifestId === bundleId
        || bundleId.endsWith(`-${manifestId}-v${manifestVersion}`)
        || bundleId.endsWith(`-${manifestId}-${manifestVersion}`);
}

var version = {};

var re$2 = {exports: {}};

// Note: this is the semver.org version of the spec that it implements
// Not necessarily the package version of this code.
const SEMVER_SPEC_VERSION = '2.0.0';

const MAX_LENGTH$1 = 256;
const MAX_SAFE_INTEGER$1 = Number.MAX_SAFE_INTEGER ||
/* istanbul ignore next */ 9007199254740991;

// Max safe segment length for coercion.
const MAX_SAFE_COMPONENT_LENGTH = 16;

// Max safe length for a build identifier. The max length minus 6 characters for
// the shortest version with a build 0.0.0+BUILD.
const MAX_SAFE_BUILD_LENGTH = MAX_LENGTH$1 - 6;

const RELEASE_TYPES = [
  'major',
  'premajor',
  'minor',
  'preminor',
  'patch',
  'prepatch',
  'prerelease',
];

var constants$2 = {
  MAX_LENGTH: MAX_LENGTH$1,
  MAX_SAFE_COMPONENT_LENGTH,
  MAX_SAFE_BUILD_LENGTH,
  MAX_SAFE_INTEGER: MAX_SAFE_INTEGER$1,
  RELEASE_TYPES,
  SEMVER_SPEC_VERSION,
  FLAG_INCLUDE_PRERELEASE: 0b001,
  FLAG_LOOSE: 0b010,
};

const debug$1 = (
  typeof process === 'object' &&
  process.env &&
  process.env.NODE_DEBUG &&
  /\bsemver\b/i.test(process.env.NODE_DEBUG)
) ? (...args) => console.error('SEMVER', ...args)
  : () => {};

var debug_1 = debug$1;

(function (module, exports) {

	const {
	  MAX_SAFE_COMPONENT_LENGTH,
	  MAX_SAFE_BUILD_LENGTH,
	  MAX_LENGTH,
	} = constants$2;
	const debug = debug_1;
	exports = module.exports = {};

	// The actual regexps go on exports.re
	const re = exports.re = [];
	const safeRe = exports.safeRe = [];
	const src = exports.src = [];
	const safeSrc = exports.safeSrc = [];
	const t = exports.t = {};
	let R = 0;

	const LETTERDASHNUMBER = '[a-zA-Z0-9-]';

	// Replace some greedy regex tokens to prevent regex dos issues. These regex are
	// used internally via the safeRe object since all inputs in this library get
	// normalized first to trim and collapse all extra whitespace. The original
	// regexes are exported for userland consumption and lower level usage. A
	// future breaking change could export the safer regex only with a note that
	// all input should have extra whitespace removed.
	const safeRegexReplacements = [
	  ['\\s', 1],
	  ['\\d', MAX_LENGTH],
	  [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH],
	];

	const makeSafeRegex = (value) => {
	  for (const [token, max] of safeRegexReplacements) {
	    value = value
	      .split(`${token}*`).join(`${token}{0,${max}}`)
	      .split(`${token}+`).join(`${token}{1,${max}}`);
	  }
	  return value
	};

	const createToken = (name, value, isGlobal) => {
	  const safe = makeSafeRegex(value);
	  const index = R++;
	  debug(name, index, value);
	  t[name] = index;
	  src[index] = value;
	  safeSrc[index] = safe;
	  re[index] = new RegExp(value, isGlobal ? 'g' : undefined);
	  safeRe[index] = new RegExp(safe, isGlobal ? 'g' : undefined);
	};

	// The following Regular Expressions can be used for tokenizing,
	// validating, and parsing SemVer version strings.

	// ## Numeric Identifier
	// A single `0`, or a non-zero digit followed by zero or more digits.

	createToken('NUMERICIDENTIFIER', '0|[1-9]\\d*');
	createToken('NUMERICIDENTIFIERLOOSE', '\\d+');

	// ## Non-numeric Identifier
	// Zero or more digits, followed by a letter or hyphen, and then zero or
	// more letters, digits, or hyphens.

	createToken('NONNUMERICIDENTIFIER', `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);

	// ## Main Version
	// Three dot-separated numeric identifiers.

	createToken('MAINVERSION', `(${src[t.NUMERICIDENTIFIER]})\\.` +
	                   `(${src[t.NUMERICIDENTIFIER]})\\.` +
	                   `(${src[t.NUMERICIDENTIFIER]})`);

	createToken('MAINVERSIONLOOSE', `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.` +
	                        `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.` +
	                        `(${src[t.NUMERICIDENTIFIERLOOSE]})`);

	// ## Pre-release Version Identifier
	// A numeric identifier, or a non-numeric identifier.
	// Non-numeric identifiers include numeric identifiers but can be longer.
	// Therefore non-numeric identifiers must go first.

	createToken('PRERELEASEIDENTIFIER', `(?:${src[t.NONNUMERICIDENTIFIER]
	}|${src[t.NUMERICIDENTIFIER]})`);

	createToken('PRERELEASEIDENTIFIERLOOSE', `(?:${src[t.NONNUMERICIDENTIFIER]
	}|${src[t.NUMERICIDENTIFIERLOOSE]})`);

	// ## Pre-release Version
	// Hyphen, followed by one or more dot-separated pre-release version
	// identifiers.

	createToken('PRERELEASE', `(?:-(${src[t.PRERELEASEIDENTIFIER]
	}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);

	createToken('PRERELEASELOOSE', `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]
	}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);

	// ## Build Metadata Identifier
	// Any combination of digits, letters, or hyphens.

	createToken('BUILDIDENTIFIER', `${LETTERDASHNUMBER}+`);

	// ## Build Metadata
	// Plus sign, followed by one or more period-separated build metadata
	// identifiers.

	createToken('BUILD', `(?:\\+(${src[t.BUILDIDENTIFIER]
	}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);

	// ## Full Version String
	// A main version, followed optionally by a pre-release version and
	// build metadata.

	// Note that the only major, minor, patch, and pre-release sections of
	// the version string are capturing groups.  The build metadata is not a
	// capturing group, because it should not ever be used in version
	// comparison.

	createToken('FULLPLAIN', `v?${src[t.MAINVERSION]
	}${src[t.PRERELEASE]}?${
	  src[t.BUILD]}?`);

	createToken('FULL', `^${src[t.FULLPLAIN]}$`);

	// like full, but allows v1.2.3 and =1.2.3, which people do sometimes.
	// also, 1.0.0alpha1 (prerelease without the hyphen) which is pretty
	// common in the npm registry.
	createToken('LOOSEPLAIN', `[v=\\s]*${src[t.MAINVERSIONLOOSE]
	}${src[t.PRERELEASELOOSE]}?${
	  src[t.BUILD]}?`);

	createToken('LOOSE', `^${src[t.LOOSEPLAIN]}$`);

	createToken('GTLT', '((?:<|>)?=?)');

	// Something like "2.*" or "1.2.x".
	// Note that "x.x" is a valid xRange identifier, meaning "any version"
	// Only the first item is strictly required.
	createToken('XRANGEIDENTIFIERLOOSE', `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
	createToken('XRANGEIDENTIFIER', `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);

	createToken('XRANGEPLAIN', `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})` +
	                   `(?:\\.(${src[t.XRANGEIDENTIFIER]})` +
	                   `(?:\\.(${src[t.XRANGEIDENTIFIER]})` +
	                   `(?:${src[t.PRERELEASE]})?${
	                     src[t.BUILD]}?` +
	                   `)?)?`);

	createToken('XRANGEPLAINLOOSE', `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})` +
	                        `(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})` +
	                        `(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})` +
	                        `(?:${src[t.PRERELEASELOOSE]})?${
	                          src[t.BUILD]}?` +
	                        `)?)?`);

	createToken('XRANGE', `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
	createToken('XRANGELOOSE', `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);

	// Coercion.
	// Extract anything that could conceivably be a part of a valid semver
	createToken('COERCEPLAIN', `${'(^|[^\\d])' +
	              '(\\d{1,'}${MAX_SAFE_COMPONENT_LENGTH}})` +
	              `(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?` +
	              `(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
	createToken('COERCE', `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
	createToken('COERCEFULL', src[t.COERCEPLAIN] +
	              `(?:${src[t.PRERELEASE]})?` +
	              `(?:${src[t.BUILD]})?` +
	              `(?:$|[^\\d])`);
	createToken('COERCERTL', src[t.COERCE], true);
	createToken('COERCERTLFULL', src[t.COERCEFULL], true);

	// Tilde ranges.
	// Meaning is "reasonably at or greater than"
	createToken('LONETILDE', '(?:~>?)');

	createToken('TILDETRIM', `(\\s*)${src[t.LONETILDE]}\\s+`, true);
	exports.tildeTrimReplace = '$1~';

	createToken('TILDE', `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
	createToken('TILDELOOSE', `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);

	// Caret ranges.
	// Meaning is "at least and backwards compatible with"
	createToken('LONECARET', '(?:\\^)');

	createToken('CARETTRIM', `(\\s*)${src[t.LONECARET]}\\s+`, true);
	exports.caretTrimReplace = '$1^';

	createToken('CARET', `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
	createToken('CARETLOOSE', `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);

	// A simple gt/lt/eq thing, or just "" to indicate "any version"
	createToken('COMPARATORLOOSE', `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
	createToken('COMPARATOR', `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);

	// An expression to strip any whitespace between the gtlt and the thing
	// it modifies, so that `> 1.2.3` ==> `>1.2.3`
	createToken('COMPARATORTRIM', `(\\s*)${src[t.GTLT]
	}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
	exports.comparatorTrimReplace = '$1$2$3';

	// Something like `1.2.3 - 1.2.4`
	// Note that these all use the loose form, because they'll be
	// checked against either the strict or loose comparator form
	// later.
	createToken('HYPHENRANGE', `^\\s*(${src[t.XRANGEPLAIN]})` +
	                   `\\s+-\\s+` +
	                   `(${src[t.XRANGEPLAIN]})` +
	                   `\\s*$`);

	createToken('HYPHENRANGELOOSE', `^\\s*(${src[t.XRANGEPLAINLOOSE]})` +
	                        `\\s+-\\s+` +
	                        `(${src[t.XRANGEPLAINLOOSE]})` +
	                        `\\s*$`);

	// Star ranges basically just allow anything at all.
	createToken('STAR', '(<|>)?=?\\s*\\*');
	// >=0.0.0 is like a star
	createToken('GTE0', '^\\s*>=\\s*0\\.0\\.0\\s*$');
	createToken('GTE0PRE', '^\\s*>=\\s*0\\.0\\.0-0\\s*$'); 
} (re$2, re$2.exports));

var reExports = re$2.exports;

// parse out just the options we care about
const looseOption = Object.freeze({ loose: true });
const emptyOpts = Object.freeze({ });
const parseOptions$1 = options => {
  if (!options) {
    return emptyOpts
  }

  if (typeof options !== 'object') {
    return looseOption
  }

  return options
};
var parseOptions_1 = parseOptions$1;

const numeric = /^[0-9]+$/;
const compareIdentifiers$1 = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b ? 0 : a < b ? -1 : 1
  }

  const anum = numeric.test(a);
  const bnum = numeric.test(b);

  if (anum && bnum) {
    a = +a;
    b = +b;
  }

  return a === b ? 0
    : (anum && !bnum) ? -1
    : (bnum && !anum) ? 1
    : a < b ? -1
    : 1
};

const rcompareIdentifiers = (a, b) => compareIdentifiers$1(b, a);

var identifiers$1 = {
  compareIdentifiers: compareIdentifiers$1,
  rcompareIdentifiers,
};

const debug = debug_1;
const { MAX_LENGTH, MAX_SAFE_INTEGER } = constants$2;
const { safeRe: re$1, t: t$1 } = reExports;

const parseOptions = parseOptions_1;
const { compareIdentifiers } = identifiers$1;

const isPrereleaseIdentifier = (prerelease, identifier) => {
  const identifiers = identifier.split('.');
  if (identifiers.length > prerelease.length) {
    return false
  }

  for (let i = 0; i < identifiers.length; i++) {
    if (compareIdentifiers(prerelease[i], identifiers[i]) !== 0) {
      return false
    }
  }

  return true
};

let SemVer$e = class SemVer {
  constructor (version, options) {
    options = parseOptions(options);

    if (version instanceof SemVer) {
      if (version.loose === !!options.loose &&
        version.includePrerelease === !!options.includePrerelease) {
        return version
      } else {
        version = version.version;
      }
    } else if (typeof version !== 'string') {
      throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`)
    }

    if (version.length > MAX_LENGTH) {
      throw new TypeError(
        `version is longer than ${MAX_LENGTH} characters`
      )
    }

    debug('SemVer', version, options);
    this.options = options;
    this.loose = !!options.loose;
    // this isn't actually relevant for versions, but keep it so that we
    // don't run into trouble passing this.options around.
    this.includePrerelease = !!options.includePrerelease;

    const m = version.trim().match(options.loose ? re$1[t$1.LOOSE] : re$1[t$1.FULL]);

    if (!m) {
      throw new TypeError(`Invalid Version: ${version}`)
    }

    this.raw = version;

    // these are actually numbers
    this.major = +m[1];
    this.minor = +m[2];
    this.patch = +m[3];

    if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
      throw new TypeError('Invalid major version')
    }

    if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
      throw new TypeError('Invalid minor version')
    }

    if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
      throw new TypeError('Invalid patch version')
    }

    // numberify any prerelease numeric ids
    if (!m[4]) {
      this.prerelease = [];
    } else {
      this.prerelease = m[4].split('.').map((id) => {
        if (/^[0-9]+$/.test(id)) {
          const num = +id;
          if (num >= 0 && num < MAX_SAFE_INTEGER) {
            return num
          }
        }
        return id
      });
    }

    this.build = m[5] ? m[5].split('.') : [];
    this.format();
  }

  format () {
    this.version = `${this.major}.${this.minor}.${this.patch}`;
    if (this.prerelease.length) {
      this.version += `-${this.prerelease.join('.')}`;
    }
    return this.version
  }

  toString () {
    return this.version
  }

  compare (other) {
    debug('SemVer.compare', this.version, this.options, other);
    if (!(other instanceof SemVer)) {
      if (typeof other === 'string' && other === this.version) {
        return 0
      }
      other = new SemVer(other, this.options);
    }

    if (other.version === this.version) {
      return 0
    }

    return this.compareMain(other) || this.comparePre(other)
  }

  compareMain (other) {
    if (!(other instanceof SemVer)) {
      other = new SemVer(other, this.options);
    }

    if (this.major < other.major) {
      return -1
    }
    if (this.major > other.major) {
      return 1
    }
    if (this.minor < other.minor) {
      return -1
    }
    if (this.minor > other.minor) {
      return 1
    }
    if (this.patch < other.patch) {
      return -1
    }
    if (this.patch > other.patch) {
      return 1
    }
    return 0
  }

  comparePre (other) {
    if (!(other instanceof SemVer)) {
      other = new SemVer(other, this.options);
    }

    // NOT having a prerelease is > having one
    if (this.prerelease.length && !other.prerelease.length) {
      return -1
    } else if (!this.prerelease.length && other.prerelease.length) {
      return 1
    } else if (!this.prerelease.length && !other.prerelease.length) {
      return 0
    }

    let i = 0;
    do {
      const a = this.prerelease[i];
      const b = other.prerelease[i];
      debug('prerelease compare', i, a, b);
      if (a === undefined && b === undefined) {
        return 0
      } else if (b === undefined) {
        return 1
      } else if (a === undefined) {
        return -1
      } else if (a === b) {
        continue
      } else {
        return compareIdentifiers(a, b)
      }
    } while (++i)
  }

  compareBuild (other) {
    if (!(other instanceof SemVer)) {
      other = new SemVer(other, this.options);
    }

    let i = 0;
    do {
      const a = this.build[i];
      const b = other.build[i];
      debug('build compare', i, a, b);
      if (a === undefined && b === undefined) {
        return 0
      } else if (b === undefined) {
        return 1
      } else if (a === undefined) {
        return -1
      } else if (a === b) {
        continue
      } else {
        return compareIdentifiers(a, b)
      }
    } while (++i)
  }

  // preminor will bump the version up to the next minor release, and immediately
  // down to pre-release. premajor and prepatch work the same way.
  inc (release, identifier, identifierBase) {
    if (release.startsWith('pre')) {
      if (!identifier && identifierBase === false) {
        throw new Error('invalid increment argument: identifier is empty')
      }
      // Avoid an invalid semver results
      if (identifier) {
        const match = `-${identifier}`.match(this.options.loose ? re$1[t$1.PRERELEASELOOSE] : re$1[t$1.PRERELEASE]);
        if (!match || match[1] !== identifier) {
          throw new Error(`invalid identifier: ${identifier}`)
        }
      }
    }

    switch (release) {
      case 'premajor':
        this.prerelease.length = 0;
        this.patch = 0;
        this.minor = 0;
        this.major++;
        this.inc('pre', identifier, identifierBase);
        break
      case 'preminor':
        this.prerelease.length = 0;
        this.patch = 0;
        this.minor++;
        this.inc('pre', identifier, identifierBase);
        break
      case 'prepatch':
        // If this is already a prerelease, it will bump to the next version
        // drop any prereleases that might already exist, since they are not
        // relevant at this point.
        this.prerelease.length = 0;
        this.inc('patch', identifier, identifierBase);
        this.inc('pre', identifier, identifierBase);
        break
      // If the input is a non-prerelease version, this acts the same as
      // prepatch.
      case 'prerelease':
        if (this.prerelease.length === 0) {
          this.inc('patch', identifier, identifierBase);
        }
        this.inc('pre', identifier, identifierBase);
        break
      case 'release':
        if (this.prerelease.length === 0) {
          throw new Error(`version ${this.raw} is not a prerelease`)
        }
        this.prerelease.length = 0;
        break

      case 'major':
        // If this is a pre-major version, bump up to the same major version.
        // Otherwise increment major.
        // 1.0.0-5 bumps to 1.0.0
        // 1.1.0 bumps to 2.0.0
        if (
          this.minor !== 0 ||
          this.patch !== 0 ||
          this.prerelease.length === 0
        ) {
          this.major++;
        }
        this.minor = 0;
        this.patch = 0;
        this.prerelease = [];
        break
      case 'minor':
        // If this is a pre-minor version, bump up to the same minor version.
        // Otherwise increment minor.
        // 1.2.0-5 bumps to 1.2.0
        // 1.2.1 bumps to 1.3.0
        if (this.patch !== 0 || this.prerelease.length === 0) {
          this.minor++;
        }
        this.patch = 0;
        this.prerelease = [];
        break
      case 'patch':
        // If this is not a pre-release version, it will increment the patch.
        // If it is a pre-release it will bump up to the same patch version.
        // 1.2.0-5 patches to 1.2.0
        // 1.2.0 patches to 1.2.1
        if (this.prerelease.length === 0) {
          this.patch++;
        }
        this.prerelease = [];
        break
      // This probably shouldn't be used publicly.
      // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
      case 'pre': {
        const base = Number(identifierBase) ? 1 : 0;

        if (this.prerelease.length === 0) {
          this.prerelease = [base];
        } else {
          let i = this.prerelease.length;
          while (--i >= 0) {
            if (typeof this.prerelease[i] === 'number') {
              this.prerelease[i]++;
              i = -2;
            }
          }
          if (i === -1) {
            // didn't increment anything
            if (identifier === this.prerelease.join('.') && identifierBase === false) {
              throw new Error('invalid increment argument: identifier already exists')
            }
            this.prerelease.push(base);
          }
        }
        if (identifier) {
          // 1.2.0-beta.1 bumps to 1.2.0-beta.2,
          // 1.2.0-beta.fooblz or 1.2.0-beta bumps to 1.2.0-beta.0
          let prerelease = [identifier, base];
          if (identifierBase === false) {
            prerelease = [identifier];
          }
          if (isPrereleaseIdentifier(this.prerelease, identifier)) {
            const prereleaseBase = this.prerelease[identifier.split('.').length];
            if (isNaN(prereleaseBase)) {
              this.prerelease = prerelease;
            }
          } else {
            this.prerelease = prerelease;
          }
        }
        break
      }
      default:
        throw new Error(`invalid increment argument: ${release}`)
    }
    this.raw = this.format();
    if (this.build.length) {
      this.raw += `+${this.build.join('.')}`;
    }
    return this
  }
};

var semver$2 = SemVer$e;

const SemVer$d = semver$2;
const parse$7 = (version, options, throwErrors = false) => {
  if (version instanceof SemVer$d) {
    return version
  }
  try {
    return new SemVer$d(version, options)
  } catch (er) {
    if (!throwErrors) {
      return null
    }
    throw er
  }
};

var parse_1 = parse$7;

const parse$6 = parse_1;
const valid$2 = (version, options) => {
  const v = parse$6(version, options);
  return v ? v.version : null
};
var valid_1 = valid$2;

const parse$5 = parse_1;
const clean$1 = (version, options) => {
  const s = parse$5(version.trim().replace(/^[=v]+/, ''), options);
  return s ? s.version : null
};
var clean_1 = clean$1;

const SemVer$c = semver$2;

const inc$1 = (version, release, options, identifier, identifierBase) => {
  if (typeof (options) === 'string') {
    identifierBase = identifier;
    identifier = options;
    options = undefined;
  }

  try {
    return new SemVer$c(
      version instanceof SemVer$c ? version.version : version,
      options
    ).inc(release, identifier, identifierBase).version
  } catch (er) {
    return null
  }
};
var inc_1 = inc$1;

const parse$4 = parse_1;

const diff$1 = (version1, version2) => {
  const v1 = parse$4(version1, null, true);
  const v2 = parse$4(version2, null, true);
  const comparison = v1.compare(v2);

  if (comparison === 0) {
    return null
  }

  const v1Higher = comparison > 0;
  const highVersion = v1Higher ? v1 : v2;
  const lowVersion = v1Higher ? v2 : v1;
  const highHasPre = !!highVersion.prerelease.length;
  const lowHasPre = !!lowVersion.prerelease.length;

  if (lowHasPre && !highHasPre) {
    // Going from prerelease -> no prerelease requires some special casing

    // If the low version has only a major, then it will always be a major
    // Some examples:
    // 1.0.0-1 -> 1.0.0
    // 1.0.0-1 -> 1.1.1
    // 1.0.0-1 -> 2.0.0
    if (!lowVersion.patch && !lowVersion.minor) {
      return 'major'
    }

    // If the main part has no difference
    if (lowVersion.compareMain(highVersion) === 0) {
      if (lowVersion.minor && !lowVersion.patch) {
        return 'minor'
      }
      return 'patch'
    }
  }

  // add the `pre` prefix if we are going to a prerelease version
  const prefix = highHasPre ? 'pre' : '';

  if (v1.major !== v2.major) {
    return prefix + 'major'
  }

  if (v1.minor !== v2.minor) {
    return prefix + 'minor'
  }

  if (v1.patch !== v2.patch) {
    return prefix + 'patch'
  }

  // high and low are prereleases
  return 'prerelease'
};

var diff_1 = diff$1;

const SemVer$b = semver$2;
const major$1 = (a, loose) => new SemVer$b(a, loose).major;
var major_1 = major$1;

const SemVer$a = semver$2;
const minor$1 = (a, loose) => new SemVer$a(a, loose).minor;
var minor_1 = minor$1;

const SemVer$9 = semver$2;
const patch$1 = (a, loose) => new SemVer$9(a, loose).patch;
var patch_1 = patch$1;

const parse$3 = parse_1;
const prerelease$1 = (version, options) => {
  const parsed = parse$3(version, options);
  return (parsed && parsed.prerelease.length) ? parsed.prerelease : null
};
var prerelease_1 = prerelease$1;

const SemVer$8 = semver$2;
const compare$b = (a, b, loose) =>
  new SemVer$8(a, loose).compare(new SemVer$8(b, loose));

var compare_1 = compare$b;

const compare$a = compare_1;
const rcompare$1 = (a, b, loose) => compare$a(b, a, loose);
var rcompare_1 = rcompare$1;

const compare$9 = compare_1;
const compareLoose$1 = (a, b) => compare$9(a, b, true);
var compareLoose_1 = compareLoose$1;

const SemVer$7 = semver$2;
const compareBuild$3 = (a, b, loose) => {
  const versionA = new SemVer$7(a, loose);
  const versionB = new SemVer$7(b, loose);
  return versionA.compare(versionB) || versionA.compareBuild(versionB)
};
var compareBuild_1 = compareBuild$3;

const compareBuild$2 = compareBuild_1;
const sort$1 = (list, loose) => list.sort((a, b) => compareBuild$2(a, b, loose));
var sort_1 = sort$1;

const compareBuild$1 = compareBuild_1;
const rsort$1 = (list, loose) => list.sort((a, b) => compareBuild$1(b, a, loose));
var rsort_1 = rsort$1;

const compare$8 = compare_1;
const gt$4 = (a, b, loose) => compare$8(a, b, loose) > 0;
var gt_1 = gt$4;

const compare$7 = compare_1;
const lt$3 = (a, b, loose) => compare$7(a, b, loose) < 0;
var lt_1 = lt$3;

const compare$6 = compare_1;
const eq$2 = (a, b, loose) => compare$6(a, b, loose) === 0;
var eq_1 = eq$2;

const compare$5 = compare_1;
const neq$2 = (a, b, loose) => compare$5(a, b, loose) !== 0;
var neq_1 = neq$2;

const compare$4 = compare_1;
const gte$3 = (a, b, loose) => compare$4(a, b, loose) >= 0;
var gte_1 = gte$3;

const compare$3 = compare_1;
const lte$3 = (a, b, loose) => compare$3(a, b, loose) <= 0;
var lte_1 = lte$3;

const eq$1 = eq_1;
const neq$1 = neq_1;
const gt$3 = gt_1;
const gte$2 = gte_1;
const lt$2 = lt_1;
const lte$2 = lte_1;

const cmp$1 = (a, op, b, loose) => {
  switch (op) {
    case '===':
      if (typeof a === 'object') {
        a = a.version;
      }
      if (typeof b === 'object') {
        b = b.version;
      }
      return a === b

    case '!==':
      if (typeof a === 'object') {
        a = a.version;
      }
      if (typeof b === 'object') {
        b = b.version;
      }
      return a !== b

    case '':
    case '=':
    case '==':
      return eq$1(a, b, loose)

    case '!=':
      return neq$1(a, b, loose)

    case '>':
      return gt$3(a, b, loose)

    case '>=':
      return gte$2(a, b, loose)

    case '<':
      return lt$2(a, b, loose)

    case '<=':
      return lte$2(a, b, loose)

    default:
      throw new TypeError(`Invalid operator: ${op}`)
  }
};
var cmp_1 = cmp$1;

const SemVer$6 = semver$2;
const parse$2 = parse_1;
const { safeRe: re, t } = reExports;

const coerce$1 = (version, options) => {
  if (version instanceof SemVer$6) {
    return version
  }

  if (typeof version === 'number') {
    version = String(version);
  }

  if (typeof version !== 'string') {
    return null
  }

  options = options || {};

  let match = null;
  if (!options.rtl) {
    match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
  } else {
    // Find the right-most coercible string that does not share
    // a terminus with a more left-ward coercible string.
    // Eg, '1.2.3.4' wants to coerce '2.3.4', not '3.4' or '4'
    // With includePrerelease option set, '1.2.3.4-rc' wants to coerce '2.3.4-rc', not '2.3.4'
    //
    // Walk through the string checking with a /g regexp
    // Manually set the index so as to pick up overlapping matches.
    // Stop when we get a match that ends at the string end, since no
    // coercible string can be more right-ward without the same terminus.
    const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
    let next;
    while ((next = coerceRtlRegex.exec(version)) &&
        (!match || match.index + match[0].length !== version.length)
    ) {
      if (!match ||
            next.index + next[0].length !== match.index + match[0].length) {
        match = next;
      }
      coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
    }
    // leave it in a clean state
    coerceRtlRegex.lastIndex = -1;
  }

  if (match === null) {
    return null
  }

  const major = match[2];
  const minor = match[3] || '0';
  const patch = match[4] || '0';
  const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : '';
  const build = options.includePrerelease && match[6] ? `+${match[6]}` : '';

  return parse$2(`${major}.${minor}.${patch}${prerelease}${build}`, options)
};
var coerce_1 = coerce$1;

const parse$1 = parse_1;
const constants$1 = constants$2;
const SemVer$5 = semver$2;

const truncate$1 = (version, truncation, options) => {
  if (!constants$1.RELEASE_TYPES.includes(truncation)) {
    return null
  }

  const clonedVersion = cloneInputVersion(version, options);
  return clonedVersion && doTruncation(clonedVersion, truncation)
};

const cloneInputVersion = (version, options) => {
  const versionStringToParse = (
    version instanceof SemVer$5 ? version.version : version
  );

  return parse$1(versionStringToParse, options)
};

const doTruncation = (version, truncation) => {
  if (isPrerelease(truncation)) {
    return version.version
  }

  version.prerelease = [];

  switch (truncation) {
    case 'major':
      version.minor = 0;
      version.patch = 0;
      break
    case 'minor':
      version.patch = 0;
      break
  }

  return version.format()
};

const isPrerelease = (type) => {
  return type.startsWith('pre')
};

var truncate_1 = truncate$1;

var lrucache;
var hasRequiredLrucache;

function requireLrucache () {
	if (hasRequiredLrucache) return lrucache;
	hasRequiredLrucache = 1;

	class LRUCache {
	  constructor () {
	    this.max = 1000;
	    this.map = new Map();
	  }

	  get (key) {
	    const value = this.map.get(key);
	    if (value === undefined) {
	      return undefined
	    } else {
	      // Remove the key from the map and add it to the end
	      this.map.delete(key);
	      this.map.set(key, value);
	      return value
	    }
	  }

	  delete (key) {
	    return this.map.delete(key)
	  }

	  set (key, value) {
	    const deleted = this.delete(key);

	    if (!deleted && value !== undefined) {
	      // If cache is full, delete the least recently used item
	      if (this.map.size >= this.max) {
	        const firstKey = this.map.keys().next().value;
	        this.delete(firstKey);
	      }

	      this.map.set(key, value);
	    }

	    return this
	  }
	}

	lrucache = LRUCache;
	return lrucache;
}

var range;
var hasRequiredRange;

function requireRange () {
	if (hasRequiredRange) return range;
	hasRequiredRange = 1;

	const SPACE_CHARACTERS = /\s+/g;

	// hoisted class for cyclic dependency
	class Range {
	  constructor (range, options) {
	    options = parseOptions(options);

	    if (range instanceof Range) {
	      if (
	        range.loose === !!options.loose &&
	        range.includePrerelease === !!options.includePrerelease
	      ) {
	        return range
	      } else {
	        return new Range(range.raw, options)
	      }
	    }

	    if (range instanceof Comparator) {
	      // just put it in the set and return
	      this.raw = range.value;
	      this.set = [[range]];
	      this.formatted = undefined;
	      return this
	    }

	    this.options = options;
	    this.loose = !!options.loose;
	    this.includePrerelease = !!options.includePrerelease;

	    // First reduce all whitespace as much as possible so we do not have to rely
	    // on potentially slow regexes like \s*. This is then stored and used for
	    // future error messages as well.
	    this.raw = range.trim().replace(SPACE_CHARACTERS, ' ');

	    // First, split on ||
	    this.set = this.raw
	      .split('||')
	      // map the range to a 2d array of comparators
	      .map(r => this.parseRange(r.trim()))
	      // throw out any comparator lists that are empty
	      // this generally means that it was not a valid range, which is allowed
	      // in loose mode, but will still throw if the WHOLE range is invalid.
	      .filter(c => c.length);

	    if (!this.set.length) {
	      throw new TypeError(`Invalid SemVer Range: ${this.raw}`)
	    }

	    // if we have any that are not the null set, throw out null sets.
	    if (this.set.length > 1) {
	      // keep the first one, in case they're all null sets
	      const first = this.set[0];
	      this.set = this.set.filter(c => !isNullSet(c[0]));
	      if (this.set.length === 0) {
	        this.set = [first];
	      } else if (this.set.length > 1) {
	        // if we have any that are *, then the range is just *
	        for (const c of this.set) {
	          if (c.length === 1 && isAny(c[0])) {
	            this.set = [c];
	            break
	          }
	        }
	      }
	    }

	    this.formatted = undefined;
	  }

	  get range () {
	    if (this.formatted === undefined) {
	      this.formatted = '';
	      for (let i = 0; i < this.set.length; i++) {
	        if (i > 0) {
	          this.formatted += '||';
	        }
	        const comps = this.set[i];
	        for (let k = 0; k < comps.length; k++) {
	          if (k > 0) {
	            this.formatted += ' ';
	          }
	          this.formatted += comps[k].toString().trim();
	        }
	      }
	    }
	    return this.formatted
	  }

	  format () {
	    return this.range
	  }

	  toString () {
	    return this.range
	  }

	  parseRange (range) {
	    // strip build metadata so it can't bleed into the version
	    range = range.replace(BUILDSTRIPRE, '');

	    // memoize range parsing for performance.
	    // this is a very hot path, and fully deterministic.
	    const memoOpts =
	      (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) |
	      (this.options.loose && FLAG_LOOSE);
	    const memoKey = memoOpts + ':' + range;
	    const cached = cache.get(memoKey);
	    if (cached) {
	      return cached
	    }

	    const loose = this.options.loose;
	    // `1.2.3 - 1.2.4` => `>=1.2.3 <=1.2.4`
	    const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
	    range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
	    debug('hyphen replace', range);

	    // `> 1.2.3 < 1.2.5` => `>1.2.3 <1.2.5`
	    range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
	    debug('comparator trim', range);

	    // `~ 1.2.3` => `~1.2.3`
	    range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
	    debug('tilde trim', range);

	    // `^ 1.2.3` => `^1.2.3`
	    range = range.replace(re[t.CARETTRIM], caretTrimReplace);
	    debug('caret trim', range);

	    // At this point, the range is completely trimmed and
	    // ready to be split into comparators.

	    let rangeList = range
	      .split(' ')
	      .map(comp => parseComparator(comp, this.options))
	      .join(' ')
	      .split(/\s+/)
	      // >=0.0.0 is equivalent to *
	      .map(comp => replaceGTE0(comp, this.options));

	    if (loose) {
	      // in loose mode, throw out any that are not valid comparators
	      rangeList = rangeList.filter(comp => {
	        debug('loose invalid filter', comp, this.options);
	        return !!comp.match(re[t.COMPARATORLOOSE])
	      });
	    }
	    debug('range list', rangeList);

	    // if any comparators are the null set, then replace with JUST null set
	    // if more than one comparator, remove any * comparators
	    // also, don't include the same comparator more than once
	    const rangeMap = new Map();
	    const comparators = rangeList.map(comp => new Comparator(comp, this.options));
	    for (const comp of comparators) {
	      if (isNullSet(comp)) {
	        return [comp]
	      }
	      rangeMap.set(comp.value, comp);
	    }
	    if (rangeMap.size > 1 && rangeMap.has('')) {
	      rangeMap.delete('');
	    }

	    const result = [...rangeMap.values()];
	    cache.set(memoKey, result);
	    return result
	  }

	  intersects (range, options) {
	    if (!(range instanceof Range)) {
	      throw new TypeError('a Range is required')
	    }

	    return this.set.some((thisComparators) => {
	      return (
	        isSatisfiable(thisComparators, options) &&
	        range.set.some((rangeComparators) => {
	          return (
	            isSatisfiable(rangeComparators, options) &&
	            thisComparators.every((thisComparator) => {
	              return rangeComparators.every((rangeComparator) => {
	                return thisComparator.intersects(rangeComparator, options)
	              })
	            })
	          )
	        })
	      )
	    })
	  }

	  // if ANY of the sets match ALL of its comparators, then pass
	  test (version) {
	    if (!version) {
	      return false
	    }

	    if (typeof version === 'string') {
	      try {
	        version = new SemVer(version, this.options);
	      } catch (er) {
	        return false
	      }
	    }

	    for (let i = 0; i < this.set.length; i++) {
	      if (testSet(this.set[i], version, this.options)) {
	        return true
	      }
	    }
	    return false
	  }
	}

	range = Range;

	const LRU = requireLrucache();
	const cache = new LRU();

	const parseOptions = parseOptions_1;
	const Comparator = requireComparator();
	const debug = debug_1;
	const SemVer = semver$2;
	const {
	  safeRe: re,
	  src,
	  t,
	  comparatorTrimReplace,
	  tildeTrimReplace,
	  caretTrimReplace,
	} = reExports;
	const { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = constants$2;

	// unbounded global build-metadata stripper used by parseRange
	const BUILDSTRIPRE = new RegExp(src[t.BUILD], 'g');

	const isNullSet = c => c.value === '<0.0.0-0';
	const isAny = c => c.value === '';

	// take a set of comparators and determine whether there
	// exists a version which can satisfy it
	const isSatisfiable = (comparators, options) => {
	  let result = true;
	  const remainingComparators = comparators.slice();
	  let testComparator = remainingComparators.pop();

	  while (result && remainingComparators.length) {
	    result = remainingComparators.every((otherComparator) => {
	      return testComparator.intersects(otherComparator, options)
	    });

	    testComparator = remainingComparators.pop();
	  }

	  return result
	};

	// comprised of xranges, tildes, stars, and gtlt's at this point.
	// already replaced the hyphen ranges
	// turn into a set of JUST comparators.
	const parseComparator = (comp, options) => {
	  comp = comp.replace(re[t.BUILD], '');
	  debug('comp', comp, options);
	  comp = replaceCarets(comp, options);
	  debug('caret', comp);
	  comp = replaceTildes(comp, options);
	  debug('tildes', comp);
	  comp = replaceXRanges(comp, options);
	  debug('xrange', comp);
	  comp = replaceStars(comp, options);
	  debug('stars', comp);
	  return comp
	};

	const isX = id => !id || id.toLowerCase() === 'x' || id === '*';

	const invalidXRangeOrder = (M, m, p) => (
	  (isX(M) && !isX(m)) ||
	  (isX(m) && p && !isX(p))
	);

	// ~, ~> --> * (any, kinda silly)
	// ~2, ~2.x, ~2.x.x, ~>2, ~>2.x ~>2.x.x --> >=2.0.0 <3.0.0-0
	// ~2.0, ~2.0.x, ~>2.0, ~>2.0.x --> >=2.0.0 <2.1.0-0
	// ~1.2, ~1.2.x, ~>1.2, ~>1.2.x --> >=1.2.0 <1.3.0-0
	// ~1.2.3, ~>1.2.3 --> >=1.2.3 <1.3.0-0
	// ~1.2.0, ~>1.2.0 --> >=1.2.0 <1.3.0-0
	// ~0.0.1 --> >=0.0.1 <0.1.0-0
	const replaceTildes = (comp, options) => {
	  return comp
	    .trim()
	    .split(/\s+/)
	    .map((c) => replaceTilde(c, options))
	    .join(' ')
	};

	const replaceTilde = (comp, options) => {
	  const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
	  // if we're including prereleases in the match, then the lower bound is
	  // -0, the lowest possible prerelease value, just like x-ranges and carets.
	  // this keeps `~1.2` equivalent to the `1.2.x` x-range it's documented as.
	  const z = options.includePrerelease ? '-0' : '';
	  return comp.replace(r, (_, M, m, p, pr) => {
	    debug('tilde', comp, _, M, m, p, pr);
	    let ret;

	    if (isX(M)) {
	      ret = '';
	    } else if (isX(m)) {
	      ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
	    } else if (isX(p)) {
	      // ~1.2 == >=1.2.0 <1.3.0-0
	      ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
	    } else if (pr) {
	      debug('replaceTilde pr', pr);
	      ret = `>=${M}.${m}.${p}-${pr
	      } <${M}.${+m + 1}.0-0`;
	    } else {
	      // ~1.2.3 == >=1.2.3 <1.3.0-0
	      ret = `>=${M}.${m}.${p
	      } <${M}.${+m + 1}.0-0`;
	    }

	    debug('tilde return', ret);
	    return ret
	  })
	};

	// ^ --> * (any, kinda silly)
	// ^2, ^2.x, ^2.x.x --> >=2.0.0 <3.0.0-0
	// ^2.0, ^2.0.x --> >=2.0.0 <3.0.0-0
	// ^1.2, ^1.2.x --> >=1.2.0 <2.0.0-0
	// ^1.2.3 --> >=1.2.3 <2.0.0-0
	// ^1.2.0 --> >=1.2.0 <2.0.0-0
	// ^0.0.1 --> >=0.0.1 <0.0.2-0
	// ^0.1.0 --> >=0.1.0 <0.2.0-0
	const replaceCarets = (comp, options) => {
	  return comp
	    .trim()
	    .split(/\s+/)
	    .map((c) => replaceCaret(c, options))
	    .join(' ')
	};

	const replaceCaret = (comp, options) => {
	  debug('caret', comp, options);
	  const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
	  const z = options.includePrerelease ? '-0' : '';
	  return comp.replace(r, (_, M, m, p, pr) => {
	    debug('caret', comp, _, M, m, p, pr);
	    let ret;

	    if (isX(M)) {
	      ret = '';
	    } else if (isX(m)) {
	      ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
	    } else if (isX(p)) {
	      if (M === '0') {
	        ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
	      } else {
	        ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
	      }
	    } else if (pr) {
	      debug('replaceCaret pr', pr);
	      if (M === '0') {
	        if (m === '0') {
	          ret = `>=${M}.${m}.${p}-${pr
	          } <${M}.${m}.${+p + 1}-0`;
	        } else {
	          ret = `>=${M}.${m}.${p}-${pr
	          } <${M}.${+m + 1}.0-0`;
	        }
	      } else {
	        ret = `>=${M}.${m}.${p}-${pr
	        } <${+M + 1}.0.0-0`;
	      }
	    } else {
	      debug('no pr');
	      if (M === '0') {
	        if (m === '0') {
	          ret = `>=${M}.${m}.${p
	          } <${M}.${m}.${+p + 1}-0`;
	        } else {
	          ret = `>=${M}.${m}.${p
	          } <${M}.${+m + 1}.0-0`;
	        }
	      } else {
	        ret = `>=${M}.${m}.${p
	        } <${+M + 1}.0.0-0`;
	      }
	    }

	    debug('caret return', ret);
	    return ret
	  })
	};

	const replaceXRanges = (comp, options) => {
	  debug('replaceXRanges', comp, options);
	  return comp
	    .split(/\s+/)
	    .map((c) => replaceXRange(c, options))
	    .join(' ')
	};

	const replaceXRange = (comp, options) => {
	  comp = comp.trim();
	  const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
	  return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
	    debug('xRange', comp, ret, gtlt, M, m, p, pr);
	    if (invalidXRangeOrder(M, m, p)) {
	      return comp
	    }

	    const xM = isX(M);
	    const xm = xM || isX(m);
	    const xp = xm || isX(p);
	    const anyX = xp;

	    if (gtlt === '=' && anyX) {
	      gtlt = '';
	    }

	    // if we're including prereleases in the match, then we need
	    // to fix this to -0, the lowest possible prerelease value
	    pr = options.includePrerelease ? '-0' : '';

	    if (xM) {
	      if (gtlt === '>' || gtlt === '<') {
	        // nothing is allowed
	        ret = '<0.0.0-0';
	      } else {
	        // nothing is forbidden
	        ret = '*';
	      }
	    } else if (gtlt && anyX) {
	      // we know patch is an x, because we have any x at all.
	      // replace X with 0
	      if (xm) {
	        m = 0;
	      }
	      p = 0;

	      if (gtlt === '>') {
	        // >1 => >=2.0.0
	        // >1.2 => >=1.3.0
	        gtlt = '>=';
	        if (xm) {
	          M = +M + 1;
	          m = 0;
	          p = 0;
	        } else {
	          m = +m + 1;
	          p = 0;
	        }
	      } else if (gtlt === '<=') {
	        // <=0.7.x is actually <0.8.0, since any 0.7.x should
	        // pass.  Similarly, <=7.x is actually <8.0.0, etc.
	        gtlt = '<';
	        if (xm) {
	          M = +M + 1;
	        } else {
	          m = +m + 1;
	        }
	      }

	      if (gtlt === '<') {
	        pr = '-0';
	      }

	      ret = `${gtlt + M}.${m}.${p}${pr}`;
	    } else if (xm) {
	      ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
	    } else if (xp) {
	      ret = `>=${M}.${m}.0${pr
	      } <${M}.${+m + 1}.0-0`;
	    }

	    debug('xRange return', ret);

	    return ret
	  })
	};

	// Because * is AND-ed with everything else in the comparator,
	// and '' means "any version", just remove the *s entirely.
	const replaceStars = (comp, options) => {
	  debug('replaceStars', comp, options);
	  // Looseness is ignored here.  star is always as loose as it gets!
	  return comp
	    .trim()
	    .replace(re[t.STAR], '')
	};

	const replaceGTE0 = (comp, options) => {
	  debug('replaceGTE0', comp, options);
	  return comp
	    .trim()
	    .replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], '')
	};

	// This function is passed to string.replace(re[t.HYPHENRANGE])
	// M, m, patch, prerelease, build
	// 1.2 - 3.4.5 => >=1.2.0 <=3.4.5
	// 1.2.3 - 3.4 => >=1.2.0 <3.5.0-0 Any 3.4.x will do
	// 1.2 - 3.4 => >=1.2.0 <3.5.0-0
	// TODO build?
	const hyphenReplace = incPr => ($0,
	  from, fM, fm, fp, fpr, fb,
	  to, tM, tm, tp, tpr) => {
	  if (isX(fM)) {
	    from = '';
	  } else if (isX(fm)) {
	    from = `>=${fM}.0.0${incPr ? '-0' : ''}`;
	  } else if (isX(fp)) {
	    from = `>=${fM}.${fm}.0${incPr ? '-0' : ''}`;
	  } else if (fpr) {
	    from = `>=${from}`;
	  } else {
	    from = `>=${from}${incPr ? '-0' : ''}`;
	  }

	  if (isX(tM)) {
	    to = '';
	  } else if (isX(tm)) {
	    to = `<${+tM + 1}.0.0-0`;
	  } else if (isX(tp)) {
	    to = `<${tM}.${+tm + 1}.0-0`;
	  } else if (tpr) {
	    to = `<=${tM}.${tm}.${tp}-${tpr}`;
	  } else if (incPr) {
	    to = `<${tM}.${tm}.${+tp + 1}-0`;
	  } else {
	    to = `<=${to}`;
	  }

	  return `${from} ${to}`.trim()
	};

	const testSet = (set, version, options) => {
	  for (let i = 0; i < set.length; i++) {
	    if (!set[i].test(version)) {
	      return false
	    }
	  }

	  if (version.prerelease.length && !options.includePrerelease) {
	    // Find the set of versions that are allowed to have prereleases
	    // For example, ^1.2.3-pr.1 desugars to >=1.2.3-pr.1 <2.0.0
	    // That should allow `1.2.3-pr.2` to pass.
	    // However, `1.2.4-alpha.notready` should NOT be allowed,
	    // even though it's within the range set by the comparators.
	    for (let i = 0; i < set.length; i++) {
	      debug(set[i].semver);
	      if (set[i].semver === Comparator.ANY) {
	        continue
	      }

	      if (set[i].semver.prerelease.length > 0) {
	        const allowed = set[i].semver;
	        if (allowed.major === version.major &&
	            allowed.minor === version.minor &&
	            allowed.patch === version.patch) {
	          return true
	        }
	      }
	    }

	    // Version has a -pre, but it's not one of the ones we like.
	    return false
	  }

	  return true
	};
	return range;
}

var comparator;
var hasRequiredComparator;

function requireComparator () {
	if (hasRequiredComparator) return comparator;
	hasRequiredComparator = 1;

	const ANY = Symbol('SemVer ANY');
	// hoisted class for cyclic dependency
	class Comparator {
	  static get ANY () {
	    return ANY
	  }

	  constructor (comp, options) {
	    options = parseOptions(options);

	    if (comp instanceof Comparator) {
	      if (comp.loose === !!options.loose) {
	        return comp
	      } else {
	        comp = comp.value;
	      }
	    }

	    comp = comp.trim().split(/\s+/).join(' ');
	    debug('comparator', comp, options);
	    this.options = options;
	    this.loose = !!options.loose;
	    this.parse(comp);

	    if (this.semver === ANY) {
	      this.value = '';
	    } else {
	      this.value = this.operator + this.semver.version;
	    }

	    debug('comp', this);
	  }

	  parse (comp) {
	    const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
	    const m = comp.match(r);

	    if (!m) {
	      throw new TypeError(`Invalid comparator: ${comp}`)
	    }

	    this.operator = m[1] !== undefined ? m[1] : '';
	    if (this.operator === '=') {
	      this.operator = '';
	    }

	    // if it literally is just '>' or '' then allow anything.
	    if (!m[2]) {
	      this.semver = ANY;
	    } else {
	      this.semver = new SemVer(m[2], this.options.loose);
	    }
	  }

	  toString () {
	    return this.value
	  }

	  test (version) {
	    debug('Comparator.test', version, this.options.loose);

	    if (this.semver === ANY || version === ANY) {
	      return true
	    }

	    if (typeof version === 'string') {
	      try {
	        version = new SemVer(version, this.options);
	      } catch (er) {
	        return false
	      }
	    }

	    return cmp(version, this.operator, this.semver, this.options)
	  }

	  intersects (comp, options) {
	    if (!(comp instanceof Comparator)) {
	      throw new TypeError('a Comparator is required')
	    }

	    if (this.operator === '') {
	      if (this.value === '') {
	        return true
	      }
	      return new Range(comp.value, options).test(this.value)
	    } else if (comp.operator === '') {
	      if (comp.value === '') {
	        return true
	      }
	      return new Range(this.value, options).test(comp.semver)
	    }

	    options = parseOptions(options);

	    // Special cases where nothing can possibly be lower
	    if (options.includePrerelease &&
	      (this.value === '<0.0.0-0' || comp.value === '<0.0.0-0')) {
	      return false
	    }
	    if (!options.includePrerelease &&
	      (this.value.startsWith('<0.0.0') || comp.value.startsWith('<0.0.0'))) {
	      return false
	    }

	    // Same direction increasing (> or >=)
	    if (this.operator.startsWith('>') && comp.operator.startsWith('>')) {
	      return true
	    }
	    // Same direction decreasing (< or <=)
	    if (this.operator.startsWith('<') && comp.operator.startsWith('<')) {
	      return true
	    }
	    // same SemVer and both sides are inclusive (<= or >=)
	    if (
	      (this.semver.version === comp.semver.version) &&
	      this.operator.includes('=') && comp.operator.includes('=')) {
	      return true
	    }
	    // opposite directions less than
	    if (cmp(this.semver, '<', comp.semver, options) &&
	      this.operator.startsWith('>') && comp.operator.startsWith('<')) {
	      return true
	    }
	    // opposite directions greater than
	    if (cmp(this.semver, '>', comp.semver, options) &&
	      this.operator.startsWith('<') && comp.operator.startsWith('>')) {
	      return true
	    }
	    return false
	  }
	}

	comparator = Comparator;

	const parseOptions = parseOptions_1;
	const { safeRe: re, t } = reExports;
	const cmp = cmp_1;
	const debug = debug_1;
	const SemVer = semver$2;
	const Range = requireRange();
	return comparator;
}

const Range$9 = requireRange();
const satisfies$4 = (version, range, options) => {
  try {
    range = new Range$9(range, options);
  } catch (er) {
    return false
  }
  return range.test(version)
};
var satisfies_1 = satisfies$4;

const Range$8 = requireRange();

// Mostly just for testing and legacy API reasons
const toComparators$1 = (range, options) =>
  new Range$8(range, options).set
    .map(comp => comp.map(c => c.value).join(' ').trim().split(' '));

var toComparators_1 = toComparators$1;

const SemVer$4 = semver$2;
const Range$7 = requireRange();

const maxSatisfying$1 = (versions, range, options) => {
  let max = null;
  let maxSV = null;
  let rangeObj = null;
  try {
    rangeObj = new Range$7(range, options);
  } catch (er) {
    return null
  }
  versions.forEach((v) => {
    if (rangeObj.test(v)) {
      // satisfies(v, range, options)
      if (!max || maxSV.compare(v) === -1) {
        // compare(max, v, true)
        max = v;
        maxSV = new SemVer$4(max, options);
      }
    }
  });
  return max
};
var maxSatisfying_1 = maxSatisfying$1;

const SemVer$3 = semver$2;
const Range$6 = requireRange();
const minSatisfying$1 = (versions, range, options) => {
  let min = null;
  let minSV = null;
  let rangeObj = null;
  try {
    rangeObj = new Range$6(range, options);
  } catch (er) {
    return null
  }
  versions.forEach((v) => {
    if (rangeObj.test(v)) {
      // satisfies(v, range, options)
      if (!min || minSV.compare(v) === 1) {
        // compare(min, v, true)
        min = v;
        minSV = new SemVer$3(min, options);
      }
    }
  });
  return min
};
var minSatisfying_1 = minSatisfying$1;

const SemVer$2 = semver$2;
const Range$5 = requireRange();
const gt$2 = gt_1;

const minVersion$1 = (range, loose) => {
  range = new Range$5(range, loose);

  let minver = new SemVer$2('0.0.0');
  if (range.test(minver)) {
    return minver
  }

  minver = new SemVer$2('0.0.0-0');
  if (range.test(minver)) {
    return minver
  }

  minver = null;
  for (let i = 0; i < range.set.length; ++i) {
    const comparators = range.set[i];

    let setMin = null;
    comparators.forEach((comparator) => {
      // Clone to avoid manipulating the comparator's semver object.
      const compver = new SemVer$2(comparator.semver.version);
      switch (comparator.operator) {
        case '>':
          if (compver.prerelease.length === 0) {
            compver.patch++;
          } else {
            compver.prerelease.push(0);
          }
          compver.raw = compver.format();
          /* fallthrough */
        case '':
        case '>=':
          if (!setMin || gt$2(compver, setMin)) {
            setMin = compver;
          }
          break
        case '<':
        case '<=':
          /* Ignore maximum versions */
          break
        /* istanbul ignore next */
        default:
          throw new Error(`Unexpected operation: ${comparator.operator}`)
      }
    });
    if (setMin && (!minver || gt$2(minver, setMin))) {
      minver = setMin;
    }
  }

  if (minver && range.test(minver)) {
    return minver
  }

  return null
};
var minVersion_1 = minVersion$1;

const Range$4 = requireRange();
const validRange$1 = (range, options) => {
  try {
    // Return '*' instead of '' so that truthiness works.
    // This will throw if it's invalid anyway
    return new Range$4(range, options).range || '*'
  } catch (er) {
    return null
  }
};
var valid$1 = validRange$1;

const SemVer$1 = semver$2;
const Comparator$2 = requireComparator();
const { ANY: ANY$1 } = Comparator$2;
const Range$3 = requireRange();
const satisfies$3 = satisfies_1;
const gt$1 = gt_1;
const lt$1 = lt_1;
const lte$1 = lte_1;
const gte$1 = gte_1;

const outside$3 = (version, range, hilo, options) => {
  version = new SemVer$1(version, options);
  range = new Range$3(range, options);

  let gtfn, ltefn, ltfn, comp, ecomp;
  switch (hilo) {
    case '>':
      gtfn = gt$1;
      ltefn = lte$1;
      ltfn = lt$1;
      comp = '>';
      ecomp = '>=';
      break
    case '<':
      gtfn = lt$1;
      ltefn = gte$1;
      ltfn = gt$1;
      comp = '<';
      ecomp = '<=';
      break
    default:
      throw new TypeError('Must provide a hilo val of "<" or ">"')
  }

  // If it satisfies the range it is not outside
  if (satisfies$3(version, range, options)) {
    return false
  }

  // From now on, variable terms are as if we're in "gtr" mode.
  // but note that everything is flipped for the "ltr" function.

  for (let i = 0; i < range.set.length; ++i) {
    const comparators = range.set[i];

    let high = null;
    let low = null;

    comparators.forEach((comparator) => {
      if (comparator.semver === ANY$1) {
        comparator = new Comparator$2('>=0.0.0');
      }
      high = high || comparator;
      low = low || comparator;
      if (gtfn(comparator.semver, high.semver, options)) {
        high = comparator;
      } else if (ltfn(comparator.semver, low.semver, options)) {
        low = comparator;
      }
    });

    // If the edge version comparator has a operator then our version
    // isn't outside it
    if (high.operator === comp || high.operator === ecomp) {
      return false
    }

    // If the lowest version comparator has an operator and our version
    // is less than it then it isn't higher than the range
    if ((!low.operator || low.operator === comp) &&
        ltefn(version, low.semver)) {
      return false
    } else if (low.operator === ecomp && ltfn(version, low.semver)) {
      return false
    }
  }
  return true
};

var outside_1 = outside$3;

// Determine if version is greater than all the versions possible in the range.
const outside$2 = outside_1;
const gtr$1 = (version, range, options) => outside$2(version, range, '>', options);
var gtr_1 = gtr$1;

const outside$1 = outside_1;
// Determine if version is less than all the versions possible in the range
const ltr$1 = (version, range, options) => outside$1(version, range, '<', options);
var ltr_1 = ltr$1;

const Range$2 = requireRange();
const intersects$1 = (r1, r2, options) => {
  r1 = new Range$2(r1, options);
  r2 = new Range$2(r2, options);
  return r1.intersects(r2, options)
};
var intersects_1 = intersects$1;

// given a set of versions and a range, create a "simplified" range
// that includes the same versions that the original range does
// If the original range is shorter than the simplified one, return that.
const satisfies$2 = satisfies_1;
const compare$2 = compare_1;
var simplify = (versions, range, options) => {
  const set = [];
  let first = null;
  let prev = null;
  const v = versions.sort((a, b) => compare$2(a, b, options));
  for (const version of v) {
    const included = satisfies$2(version, range, options);
    if (included) {
      prev = version;
      if (!first) {
        first = version;
      }
    } else {
      if (prev) {
        set.push([first, prev]);
      }
      prev = null;
      first = null;
    }
  }
  if (first) {
    set.push([first, null]);
  }

  const ranges = [];
  for (const [min, max] of set) {
    if (min === max) {
      ranges.push(min);
    } else if (!max && min === v[0]) {
      ranges.push('*');
    } else if (!max) {
      ranges.push(`>=${min}`);
    } else if (min === v[0]) {
      ranges.push(`<=${max}`);
    } else {
      ranges.push(`${min} - ${max}`);
    }
  }
  const simplified = ranges.join(' || ');
  const original = typeof range.raw === 'string' ? range.raw : String(range);
  return simplified.length < original.length ? simplified : range
};

const Range$1 = requireRange();
const Comparator$1 = requireComparator();
const { ANY } = Comparator$1;
const satisfies$1 = satisfies_1;
const compare$1 = compare_1;

// Complex range `r1 || r2 || ...` is a subset of `R1 || R2 || ...` iff:
// - Every simple range `r1, r2, ...` is a null set, OR
// - Every simple range `r1, r2, ...` which is not a null set is a subset of
//   some `R1, R2, ...`
//
// Simple range `c1 c2 ...` is a subset of simple range `C1 C2 ...` iff:
// - If c is only the ANY comparator
//   - If C is only the ANY comparator, return true
//   - Else if in prerelease mode, return false
//   - else replace c with `[>=0.0.0]`
// - If C is only the ANY comparator
//   - if in prerelease mode, return true
//   - else replace C with `[>=0.0.0]`
// - Let EQ be the set of = comparators in c
// - If EQ is more than one, return true (null set)
// - Let GT be the highest > or >= comparator in c
// - Let LT be the lowest < or <= comparator in c
// - If GT and LT, and GT.semver > LT.semver, return true (null set)
// - If any C is a = range, and GT or LT are set, return false
// - If EQ
//   - If GT, and EQ does not satisfy GT, return true (null set)
//   - If LT, and EQ does not satisfy LT, return true (null set)
//   - If EQ satisfies every C, return true
//   - Else return false
// - If GT
//   - If GT.semver is lower than any > or >= comp in C, return false
//   - If GT is >=, and GT.semver does not satisfy every C, return false
//   - If GT.semver has a prerelease, and not in prerelease mode
//     - If no C has a prerelease and the GT.semver tuple, return false
// - If LT
//   - If LT.semver is greater than any < or <= comp in C, return false
//   - If LT is <=, and LT.semver does not satisfy every C, return false
//   - If LT.semver has a prerelease, and not in prerelease mode
//     - If no C has a prerelease and the LT.semver tuple, return false
// - Else return true

const subset$1 = (sub, dom, options = {}) => {
  if (sub === dom) {
    return true
  }

  sub = new Range$1(sub, options);
  dom = new Range$1(dom, options);
  let sawNonNull = false;

  OUTER: for (const simpleSub of sub.set) {
    for (const simpleDom of dom.set) {
      const isSub = simpleSubset(simpleSub, simpleDom, options);
      sawNonNull = sawNonNull || isSub !== null;
      if (isSub) {
        continue OUTER
      }
    }
    // the null set is a subset of everything, but null simple ranges in
    // a complex range should be ignored.  so if we saw a non-null range,
    // then we know this isn't a subset, but if EVERY simple range was null,
    // then it is a subset.
    if (sawNonNull) {
      return false
    }
  }
  return true
};

const minimumVersionWithPreRelease = [new Comparator$1('>=0.0.0-0')];
const minimumVersion = [new Comparator$1('>=0.0.0')];

const simpleSubset = (sub, dom, options) => {
  if (sub === dom) {
    return true
  }

  if (sub.length === 1 && sub[0].semver === ANY) {
    if (dom.length === 1 && dom[0].semver === ANY) {
      return true
    } else if (options.includePrerelease) {
      sub = minimumVersionWithPreRelease;
    } else {
      sub = minimumVersion;
    }
  }

  if (dom.length === 1 && dom[0].semver === ANY) {
    if (options.includePrerelease) {
      return true
    } else {
      dom = minimumVersion;
    }
  }

  const eqSet = new Set();
  let gt, lt;
  for (const c of sub) {
    if (c.operator === '>' || c.operator === '>=') {
      gt = higherGT(gt, c, options);
    } else if (c.operator === '<' || c.operator === '<=') {
      lt = lowerLT(lt, c, options);
    } else {
      eqSet.add(c.semver);
    }
  }

  if (eqSet.size > 1) {
    return null
  }

  let gtltComp;
  if (gt && lt) {
    gtltComp = compare$1(gt.semver, lt.semver, options);
    if (gtltComp > 0) {
      return null
    } else if (gtltComp === 0 && (gt.operator !== '>=' || lt.operator !== '<=')) {
      return null
    }
  }

  // will iterate one or zero times
  for (const eq of eqSet) {
    if (gt && !satisfies$1(eq, String(gt), options)) {
      return null
    }

    if (lt && !satisfies$1(eq, String(lt), options)) {
      return null
    }

    for (const c of dom) {
      if (!satisfies$1(eq, String(c), options)) {
        return false
      }
    }

    return true
  }

  let higher, lower;
  let hasDomLT, hasDomGT;
  // if the subset has a prerelease, we need a comparator in the superset
  // with the same tuple and a prerelease, or it's not a subset
  let needDomLTPre = lt &&
    !options.includePrerelease &&
    lt.semver.prerelease.length ? lt.semver : false;
  let needDomGTPre = gt &&
    !options.includePrerelease &&
    gt.semver.prerelease.length ? gt.semver : false;
  // exception: <1.2.3-0 is the same as <1.2.3
  if (needDomLTPre && needDomLTPre.prerelease.length === 1 &&
      lt.operator === '<' && needDomLTPre.prerelease[0] === 0) {
    needDomLTPre = false;
  }

  for (const c of dom) {
    hasDomGT = hasDomGT || c.operator === '>' || c.operator === '>=';
    hasDomLT = hasDomLT || c.operator === '<' || c.operator === '<=';
    if (gt) {
      if (needDomGTPre) {
        if (c.semver.prerelease && c.semver.prerelease.length &&
            c.semver.major === needDomGTPre.major &&
            c.semver.minor === needDomGTPre.minor &&
            c.semver.patch === needDomGTPre.patch) {
          needDomGTPre = false;
        }
      }
      if (c.operator === '>' || c.operator === '>=') {
        higher = higherGT(gt, c, options);
        if (higher === c && higher !== gt) {
          return false
        }
      } else if (gt.operator === '>=' && !c.test(gt.semver)) {
        return false
      }
    }
    if (lt) {
      if (needDomLTPre) {
        if (c.semver.prerelease && c.semver.prerelease.length &&
            c.semver.major === needDomLTPre.major &&
            c.semver.minor === needDomLTPre.minor &&
            c.semver.patch === needDomLTPre.patch) {
          needDomLTPre = false;
        }
      }
      if (c.operator === '<' || c.operator === '<=') {
        lower = lowerLT(lt, c, options);
        if (lower === c && lower !== lt) {
          return false
        }
      } else if (lt.operator === '<=' && !c.test(lt.semver)) {
        return false
      }
    }
    if (!c.operator && (lt || gt) && gtltComp !== 0) {
      return false
    }
  }

  // if there was a < or >, and nothing in the dom, then must be false
  // UNLESS it was limited by another range in the other direction.
  // Eg, >1.0.0 <1.0.1 is still a subset of <2.0.0
  if (gt && hasDomLT && !lt && gtltComp !== 0) {
    return false
  }

  if (lt && hasDomGT && !gt && gtltComp !== 0) {
    return false
  }

  // we needed a prerelease range in a specific tuple, but didn't get one
  // then this isn't a subset.  eg >=1.2.3-pre is not a subset of >=1.0.0,
  // because it includes prereleases in the 1.2.3 tuple
  if (needDomGTPre || needDomLTPre) {
    return false
  }

  return true
};

// >=1.2.3 is lower than >1.2.3
const higherGT = (a, b, options) => {
  if (!a) {
    return b
  }
  const comp = compare$1(a.semver, b.semver, options);
  return comp > 0 ? a
    : comp < 0 ? b
    : b.operator === '>' && a.operator === '>=' ? b
    : a
};

// <=1.2.3 is higher than <1.2.3
const lowerLT = (a, b, options) => {
  if (!a) {
    return b
  }
  const comp = compare$1(a.semver, b.semver, options);
  return comp < 0 ? a
    : comp > 0 ? b
    : b.operator === '<' && a.operator === '<=' ? b
    : a
};

var subset_1 = subset$1;

// just pre-load all the stuff that index.js lazily exports
const internalRe = reExports;
const constants = constants$2;
const SemVer = semver$2;
const identifiers = identifiers$1;
const parse = parse_1;
const valid = valid_1;
const clean = clean_1;
const inc = inc_1;
const diff = diff_1;
const major = major_1;
const minor = minor_1;
const patch = patch_1;
const prerelease = prerelease_1;
const compare = compare_1;
const rcompare = rcompare_1;
const compareLoose = compareLoose_1;
const compareBuild = compareBuild_1;
const sort = sort_1;
const rsort = rsort_1;
const gt = gt_1;
const lt = lt_1;
const eq = eq_1;
const neq = neq_1;
const gte = gte_1;
const lte = lte_1;
const cmp = cmp_1;
const coerce = coerce_1;
const truncate = truncate_1;
const Comparator = requireComparator();
const Range = requireRange();
const satisfies = satisfies_1;
const toComparators = toComparators_1;
const maxSatisfying = maxSatisfying_1;
const minSatisfying = minSatisfying_1;
const minVersion = minVersion_1;
const validRange = valid$1;
const outside = outside_1;
const gtr = gtr_1;
const ltr = ltr_1;
const intersects = intersects_1;
const simplifyRange = simplify;
const subset = subset_1;
var semver$1 = {
  parse,
  valid,
  clean,
  inc,
  diff,
  major,
  minor,
  patch,
  prerelease,
  compare,
  rcompare,
  compareLoose,
  compareBuild,
  sort,
  rsort,
  gt,
  lt,
  eq,
  neq,
  gte,
  lte,
  cmp,
  coerce,
  truncate,
  Comparator,
  Range,
  satisfies,
  toComparators,
  maxSatisfying,
  minSatisfying,
  minVersion,
  validRange,
  outside,
  gtr,
  ltr,
  intersects,
  simplifyRange,
  subset,
  SemVer,
  re: internalRe.re,
  src: internalRe.src,
  tokens: internalRe.t,
  SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
  RELEASE_TYPES: constants.RELEASE_TYPES,
  compareIdentifiers: identifiers.compareIdentifiers,
  rcompareIdentifiers: identifiers.rcompareIdentifiers,
};

var __createBinding$2 = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault$2 = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar$2 = (commonjsGlobal && commonjsGlobal.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding$2(result, mod, k[i]);
        __setModuleDefault$2(result, mod);
        return result;
    };
})();
Object.defineProperty(version, "__esModule", { value: true });
version.compareVersions = compareVersions;
version.isUpdateAvailable = isUpdateAvailable;
version.extractBundleIdentity = extractBundleIdentity;
version.isSameBundleIdentity = isSameBundleIdentity;
/**
 * Domain layer — Bundle version comparison and identity extraction.
 *
 * Ported from the extension's `src/utils/version-manager.ts`
 * (`VersionManager`'s static methods), using the `semver` library for
 * comparison/coercion. That class also called `Logger.getInstance()`
 * for debug/warn diagnostics on its fallback paths (coercion, string-
 * comparison fallback) — untested, non-behavioral side effects that
 * don't belong in `core`'s pure domain layer (same precedent as
 * `domain/errors.ts`), so they are dropped here. The extension's
 * `VersionManager` delegates to these functions unchanged.
 * @module domain/bundle/version
 */
const semver = __importStar$2(semver$1);
/**
 * Maximum bundle ID length to prevent ReDoS attacks and excessive memory usage.
 *
 * Rationale: Based on GitHub's repository name limit (100 chars) + owner (39 chars)
 * + version suffix (20 chars) + separators and safety margin = 200 chars total.
 * This prevents malicious inputs from causing regex catastrophic backtracking.
 */
const MAX_BUNDLE_ID_LENGTH = 200;
/**
 * Maximum version string length to prevent ReDoS attacks.
 *
 * Rationale: Semver spec allows for long pre-release/build metadata, but 100 chars
 * is reasonable for legitimate versions (e.g., "1.2.3-beta.1+build.20231201.sha256hash").
 * This prevents malicious inputs from causing performance issues.
 */
const MAX_VERSION_LENGTH = 100;
function isContentHashVersion(version) {
    return version.startsWith('hash:');
}
/**
 * Compare two semantic versions using semver.compare()
 *
 * Comparison strategy:
 * 1. Try semver.clean() for standard versions
 * 2. Fall back to semver.coerce() for non-standard versions
 * 3. Last resort: lexicographic string comparison
 * @param v1 - First version string
 * @param v2 - Second version string
 * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 * @throws {Error} if either version is empty or exceeds maximum length
 */
function compareVersions(v1, v2) {
    if (!v1 || !v2) {
        throw new Error('Version strings cannot be empty or null');
    }
    if (v1.length > MAX_VERSION_LENGTH || v2.length > MAX_VERSION_LENGTH) {
        throw new Error(`Version string exceeds maximum length of ${MAX_VERSION_LENGTH}`);
    }
    const clean1 = semver.clean(v1);
    const clean2 = semver.clean(v2);
    if (clean1 && clean2) {
        return semver.compare(clean1, clean2);
    }
    const coerced1 = semver.coerce(v1);
    const coerced2 = semver.coerce(v2);
    if (coerced1 && coerced2) {
        return semver.compare(coerced1, coerced2);
    }
    return v1.localeCompare(v2);
}
/**
 * Determine if an update is available using semver.gt()
 * @param installedVersion - Currently installed version
 * @param latestVersion - Latest available version
 * @returns True if update available (latest > installed)
 * @throws {Error} if either version is empty or invalid
 */
function isUpdateAvailable(installedVersion, latestVersion) {
    if (!installedVersion || !latestVersion) {
        throw new Error('Version strings cannot be empty or null');
    }
    // Hash-based versions update whenever the hash differs.
    if (isContentHashVersion(installedVersion) || isContentHashVersion(latestVersion)) {
        return installedVersion !== latestVersion;
    }
    const cleanInstalled = semver.clean(installedVersion) || semver.coerce(installedVersion)?.version;
    const cleanLatest = semver.clean(latestVersion) || semver.coerce(latestVersion)?.version;
    if (cleanInstalled && cleanLatest) {
        return semver.gt(cleanLatest, cleanInstalled);
    }
    return compareVersions(installedVersion, latestVersion) > 0;
}
/**
 * Extract bundle identity from GitHub bundle ID by removing version suffix
 *
 * GitHub bundle IDs follow the format: {owner}-{repo}-{version}
 * This method extracts {owner}-{repo} by identifying and removing the version suffix.
 *
 * For non-GitHub sources, the bundle ID is returned unchanged.
 * @example
 * extractBundleIdentity('microsoft-vscode-v1.0.0', 'github') // 'microsoft-vscode'
 * extractBundleIdentity('my-org-my-repo-2.1.3', 'github')    // 'my-org-my-repo'
 * extractBundleIdentity('owner-123-v1.0.0', 'github')        // 'owner-123'
 * extractBundleIdentity('bundle-id', 'local')                // 'bundle-id' (unchanged)
 * @param bundleId - Bundle ID potentially containing version suffix
 * @param sourceType - Source type of the bundle
 * @returns Bundle identity without version suffix (GitHub only)
 * @throws {Error} if bundleId exceeds maximum length
 */
function extractBundleIdentity(bundleId, sourceType) {
    // Security: Prevent ReDoS attacks with length validation
    if (bundleId.length > MAX_BUNDLE_ID_LENGTH) {
        throw new Error(`Bundle ID exceeds maximum length of ${MAX_BUNDLE_ID_LENGTH}`);
    }
    if (sourceType !== 'github') {
        return bundleId; // For non-GitHub, return as-is
    }
    // Match version pattern at the end: -v1.2.3 or -1.2.3
    // This regex is more efficient than iterating through all parts
    // Quantifier limits prevent ReDoS attacks
    // Pattern breakdown: -v? (optional v prefix), \d{1,3} (1-3 digits per version part),
    // optional pre-release/build metadata with restricted character set
    const versionPattern = /-v?\d{1,3}\.\d{1,3}\.\d{1,3}(?:-[a-zA-Z0-9._-]{1,50})?$/;
    const match = bundleId.match(versionPattern);
    if (match && match.index !== undefined) {
        return bundleId.slice(0, match.index);
    }
    // No version suffix found, return as-is
    return bundleId;
}
/**
 * Check if two bundle IDs represent the same bundle identity
 * Handles versioned IDs and different source types
 * @param id1 - First bundle ID
 * @param type1 - Source type of first bundle
 * @param id2 - Second bundle ID
 * @param type2 - Source type of second bundle
 * @returns True if they represent the same bundle identity
 */
function isSameBundleIdentity(id1, type1, id2, type2) {
    return extractBundleIdentity(id1, type1) === extractBundleIdentity(id2, type2);
}

var identityMatcher = {};

(function (exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.VERSION_SUFFIX_REGEX = void 0;
	exports.bundleIdentitiesMatch = bundleIdentitiesMatch;
	exports.extractBaseBundleId = extractBaseBundleId;
	exports.bundleIdHasVersionSuffix = bundleIdHasVersionSuffix;
	const version_1 = version;
	/**
	 * Version suffix regex pattern used across the codebase.
	 */
	exports.VERSION_SUFFIX_REGEX = /-v?\d{1,3}\.\d{1,3}\.\d{1,3}(?:-[\w.]+)?$/;
	/**
	 * Check if two bundle IDs match based on source type
	 * @param bundleId1 - First bundle ID to compare
	 * @param bundleId2 - Second bundle ID to compare
	 * @param sourceType - Source type determining matching strategy
	 * @returns True if bundles match according to source type rules
	 * @example
	 * ```typescript
	 * // GitHub bundles match by identity (ignoring version)
	 * bundleIdentitiesMatch('owner-repo-v1.0.0', 'owner-repo-v2.0.0', 'github'); // true
	 *
	 * // Non-GitHub bundles require exact match
	 * bundleIdentitiesMatch('local-bundle-v1.0.0', 'local-bundle-v2.0.0', 'local'); // false
	 * ```
	 */
	function bundleIdentitiesMatch(bundleId1, bundleId2, sourceType) {
	    if (sourceType === 'github') {
	        // For GitHub, extract identity without version suffix
	        const identity1 = (0, version_1.extractBundleIdentity)(bundleId1, sourceType);
	        const identity2 = (0, version_1.extractBundleIdentity)(bundleId2, sourceType);
	        return identity1 === identity2;
	    }
	    // For non-GitHub sources, exact match required
	    return bundleId1 === bundleId2;
	}
	/**
	 * Extract base ID without version suffix
	 * @param bundleId - Bundle ID potentially containing version suffix
	 * @returns Base bundle ID without version
	 * @example
	 * ```typescript
	 * extractBaseBundleId('my-bundle-v1.0.0'); // 'my-bundle'
	 * ```
	 */
	function extractBaseBundleId(bundleId) {
	    return bundleId.replace(exports.VERSION_SUFFIX_REGEX, '');
	}
	/**
	 * Check if bundle ID contains a version suffix
	 * @param bundleId - Bundle ID to check
	 * @returns True if bundle ID contains version suffix
	 */
	function bundleIdHasVersionSuffix(bundleId) {
	    return exports.VERSION_SUFFIX_REGEX.test(bundleId);
	}
	
} (identityMatcher));

var types$7 = {};

/**
 * Domain layer — Collection types.
 *
 * `Collection` is the pre-build, author-facing shape of a directory that
 * validates and builds into a `Bundle` (`../bundle/types.ts`) — mirrors
 * `lib/src/types.ts` (`Collection`, `CollectionItem`) and the
 * `deployment-manifest.yml` schema described in
 * `docs/author-guide/collection-schema.md`.
 *
 * `DeploymentManifest` mirrors the production shape at
 * `src/types/registry.ts` verbatim (field names/casing match the on-disk
 * YAML schema and must not be reformatted to camelCase).
 * @module domain/collection/types
 */
Object.defineProperty(types$7, "__esModule", { value: true });

var validate$2 = {};

(function (exports) {
	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    var desc = Object.getOwnPropertyDescriptor(m, k);
	    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
	      desc = { enumerable: true, get: function() { return m[k]; } };
	    }
	    Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    o[k2] = m[k];
	}));
	var __setModuleDefault = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
	    Object.defineProperty(o, "default", { enumerable: true, value: v });
	}) : function(o, v) {
	    o["default"] = v;
	});
	var __importStar = (commonjsGlobal && commonjsGlobal.__importStar) || (function () {
	    var ownKeys = function(o) {
	        ownKeys = Object.getOwnPropertyNames || function (o) {
	            var ar = [];
	            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
	            return ar;
	        };
	        return ownKeys(o);
	    };
	    return function (mod) {
	        if (mod && mod.__esModule) return mod;
	        var result = {};
	        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
	        __setModuleDefault(result, mod);
	        return result;
	    };
	})();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.DEFAULT_VALIDATION_RULES = void 0;
	exports.validateCollectionId = validateCollectionId;
	exports.validateVersion = validateVersion;
	exports.validateItemKind = validateItemKind;
	exports.normalizeRepoRelativePath = normalizeRepoRelativePath;
	exports.isSafeRepoRelativePath = isSafeRepoRelativePath;
	exports.validateCollectionObject = validateCollectionObject;
	/**
	 * Collection validation utilities (pure functions).
	 * @module domain/collection/validate
	 *
	 * Pure validation logic for collection files.
	 * File-IO dependent functions are in `app/collection/read-collection.ts`.
	 *
	 * Ported unchanged from the reference branch's
	 * `core/src/domain/collection/validate.ts`, save for dropping its trailing
	 * `export { type ValidationResult, type ObjectValidationResult } from
	 * './types'` — this barrel already re-exports every `./collection/types`
	 * name via `domain/index.ts`'s own `export * from './collection/types'`,
	 * so repeating it here would create an ambiguous star-export binding.
	 */
	const path = __importStar(require$$0);
	/**
	 * Default validation rules for collections.
	 * Item kinds are loaded from the JSON schema for single source of truth.
	 */
	exports.DEFAULT_VALIDATION_RULES = {
	    collectionId: {
	        maxLength: 100,
	        pattern: /^[a-z0-9-]+$/,
	        description: 'lowercase letters, numbers, and hyphens only'
	    },
	    version: {
	        pattern: /^\d+\.\d+\.\d+$/,
	        default: '1.0.0',
	        description: 'semantic versioning format (X.Y.Z)'
	    },
	    itemKinds: ['prompt', 'instruction', 'chat-mode', 'agent', 'skill', 'plugin', 'hook'],
	    deprecatedKinds: {
	        chatmode: 'agent'
	    }
	};
	/**
	 * Validate a collection ID.
	 * @param id - Collection ID to validate
	 * @param rules - Validation rules (uses DEFAULT_VALIDATION_RULES if not provided)
	 * @returns Validation result
	 */
	function validateCollectionId(id, rules = exports.DEFAULT_VALIDATION_RULES) {
	    if (!id || typeof id !== 'string') {
	        return { valid: false, error: 'Collection ID is required and must be a string' };
	    }
	    if (id.length > rules.collectionId.maxLength) {
	        return {
	            valid: false,
	            error: `Collection ID must be at most ${rules.collectionId.maxLength} characters (got ${id.length})`
	        };
	    }
	    if (!rules.collectionId.pattern.test(id)) {
	        return {
	            valid: false,
	            error: `Collection ID must contain only ${rules.collectionId.description}`
	        };
	    }
	    return { valid: true };
	}
	/**
	 * Validate a version string.
	 * @param version - Version string to validate
	 * @param rules - Validation rules (uses DEFAULT_VALIDATION_RULES if not provided)
	 * @returns Validation result with normalized version
	 */
	function validateVersion(version, rules = exports.DEFAULT_VALIDATION_RULES) {
	    // If no version provided, use default
	    if (version === undefined || version === null) {
	        return { valid: true, normalized: rules.version.default };
	    }
	    if (typeof version !== 'string') {
	        return { valid: false, error: 'Version must be a string' };
	    }
	    if (!rules.version.pattern.test(version)) {
	        return {
	            valid: false,
	            error: `Version must follow ${rules.version.description} (got "${version}")`
	        };
	    }
	    return { valid: true, normalized: version };
	}
	/**
	 * Validate an item kind.
	 * @param kind - Item kind to validate
	 * @param rules - Validation rules (uses DEFAULT_VALIDATION_RULES if not provided)
	 * @returns Validation result
	 */
	function validateItemKind(kind, rules = exports.DEFAULT_VALIDATION_RULES) {
	    if (!kind || typeof kind !== 'string') {
	        return { valid: false, error: 'Item kind is required and must be a string' };
	    }
	    const normalizedKind = kind.toLowerCase();
	    // Check for deprecated kinds (chatmode)
	    if (rules.deprecatedKinds[normalizedKind]) {
	        const replacement = rules.deprecatedKinds[normalizedKind];
	        return {
	            valid: false,
	            error: `Item kind '${kind}' is deprecated. Use '${replacement}' instead`,
	            deprecated: true,
	            replacement
	        };
	    }
	    // Check for valid kinds
	    if (!rules.itemKinds.includes(normalizedKind)) {
	        return {
	            valid: false,
	            error: `Invalid item kind '${kind}'. Must be one of: ${rules.itemKinds.join(', ')}`
	        };
	    }
	    return { valid: true };
	}
	/**
	 * Normalize a path to be repo-root relative.
	 * Uses POSIX normalization since collection paths are repo-root relative
	 * and should work consistently across platforms.
	 * @param p - Path to normalize
	 * @returns Normalized repo-relative path
	 * @throws {Error} if path is empty, traverses outside repo, or is absolute
	 */
	function normalizeRepoRelativePath(p) {
	    if (!p || typeof p !== 'string') {
	        throw new Error('path must be a non-empty string');
	    }
	    const s = String(p).trim().replaceAll('\\', '/').replace(/^\//, '');
	    if (!s) {
	        throw new Error('path must be a non-empty string');
	    }
	    // Use posix normalization since collection paths are repo-root relative.
	    const normalized = path.posix.normalize(s);
	    if (normalized.startsWith('../') || normalized === '..') {
	        throw new Error('path must not traverse outside repo');
	    }
	    if (normalized.startsWith('/')) {
	        throw new Error('path must be repo-root relative');
	    }
	    return normalized;
	}
	/**
	 * Check if a path is a safe repo-relative path.
	 * @param p - Path to check
	 * @returns True if path is valid and safe
	 */
	function isSafeRepoRelativePath(p) {
	    try {
	        normalizeRepoRelativePath(p);
	        return true;
	    }
	    catch {
	        return false;
	    }
	}
	/**
	 * Validate a collection object structure.
	 * @param collection - Parsed collection object
	 * @param sourceLabel - Label for error messages
	 * @param rules - Validation rules (uses DEFAULT_VALIDATION_RULES if not provided)
	 * @returns Validation result
	 */
	function validateCollectionObject(collection, sourceLabel, rules = exports.DEFAULT_VALIDATION_RULES) {
	    const errors = [];
	    if (!collection || typeof collection !== 'object') {
	        return { ok: false, errors: [`${sourceLabel}: YAML did not parse to an object`] };
	    }
	    const col = collection;
	    // Validate collection ID
	    if (!col.id || typeof col.id !== 'string') {
	        errors.push(`${sourceLabel}: Missing required field: id`);
	    }
	    else {
	        const idResult = validateCollectionId(col.id, rules);
	        if (!idResult.valid) {
	            errors.push(`${sourceLabel}: ${idResult.error}`);
	        }
	    }
	    if (!col.name || typeof col.name !== 'string') {
	        errors.push(`${sourceLabel}: Missing required field: name`);
	    }
	    // Validate version if present
	    if (col.version !== undefined) {
	        const versionResult = validateVersion(col.version, rules);
	        if (!versionResult.valid) {
	            errors.push(`${sourceLabel}: ${versionResult.error}`);
	        }
	    }
	    if (!Array.isArray(col.items)) {
	        errors.push(`${sourceLabel}: Missing required field: items (array)`);
	    }
	    if (Array.isArray(col.items)) {
	        col.items.forEach((item, idx) => {
	            const prefix = `${sourceLabel}: items[${idx}]`;
	            if (!item || typeof item !== 'object') {
	                errors.push(`${prefix}: must be an object`);
	                return;
	            }
	            const it = item;
	            if (!it.path || typeof it.path !== 'string') {
	                errors.push(`${prefix}: Missing required field: path`);
	            }
	            else {
	                try {
	                    normalizeRepoRelativePath(it.path);
	                }
	                catch {
	                    errors.push(`${prefix}: Invalid path (must be repo-root relative): ${it.path}`);
	                }
	            }
	            if (!it.kind || typeof it.kind !== 'string') {
	                errors.push(`${prefix}: Missing required field: kind`);
	            }
	            else {
	                // Validate item kind (including chatmode rejection)
	                const kindResult = validateItemKind(it.kind, rules);
	                if (!kindResult.valid) {
	                    errors.push(`${prefix}: ${kindResult.error}`);
	                }
	            }
	        });
	    }
	    return { ok: errors.length === 0, errors };
	}
	
} (validate$2));

var manifestValidator = {};

var jsYaml = {};

var loader$1 = {};

var common$5 = {};

function isNothing (subject) {
  return (typeof subject === 'undefined') || (subject === null)
}

function isObject (subject) {
  return (typeof subject === 'object') && (subject !== null)
}

function toArray (sequence) {
  if (Array.isArray(sequence)) return sequence
  else if (isNothing(sequence)) return []

  return [sequence]
}

function extend (target, source) {
  if (source) {
    const sourceKeys = Object.keys(source);

    for (let index = 0, length = sourceKeys.length; index < length; index += 1) {
      const key = sourceKeys[index];
      target[key] = source[key];
    }
  }

  return target
}

function repeat (string, count) {
  let result = '';

  for (let cycle = 0; cycle < count; cycle += 1) {
    result += string;
  }

  return result
}

function isNegativeZero (number) {
  return (number === 0) && (Number.NEGATIVE_INFINITY === 1 / number)
}

common$5.isNothing = isNothing;
common$5.isObject = isObject;
common$5.toArray = toArray;
common$5.repeat = repeat;
common$5.isNegativeZero = isNegativeZero;
common$5.extend = extend;

function formatError (exception, compact) {
  let where = '';
  const message = exception.reason || '(unknown reason)';

  if (!exception.mark) return message

  if (exception.mark.name) {
    where += 'in "' + exception.mark.name + '" ';
  }

  where += '(' + (exception.mark.line + 1) + ':' + (exception.mark.column + 1) + ')';

  if (!compact && exception.mark.snippet) {
    where += '\n\n' + exception.mark.snippet;
  }

  return message + ' ' + where
}

function YAMLException$4 (reason, mark) {
  // Super constructor
  Error.call(this);

  this.name = 'YAMLException';
  this.reason = reason;
  this.mark = mark;
  this.message = formatError(this, false);

  // Include stack trace in error object
  if (Error.captureStackTrace) {
    // Chrome and NodeJS
    Error.captureStackTrace(this, this.constructor);
  } else {
    // FF, IE 10+ and Safari 6+. Fallback for others
    this.stack = (new Error()).stack || '';
  }
}

// Inherit from Error
YAMLException$4.prototype = Object.create(Error.prototype);
YAMLException$4.prototype.constructor = YAMLException$4;

YAMLException$4.prototype.toString = function toString (compact) {
  return this.name + ': ' + formatError(this, compact)
};

var exception = YAMLException$4;

const common$4 = common$5;

// get snippet for a single line, respecting maxLength
function getLine (buffer, lineStart, lineEnd, position, maxLineLength) {
  let head = '';
  let tail = '';
  const maxHalfLength = Math.floor(maxLineLength / 2) - 1;

  if (position - lineStart > maxHalfLength) {
    head = ' ... ';
    lineStart = position - maxHalfLength + head.length;
  }

  if (lineEnd - position > maxHalfLength) {
    tail = ' ...';
    lineEnd = position + maxHalfLength - tail.length;
  }

  return {
    str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, '→') + tail,
    pos: position - lineStart + head.length // relative position
  }
}

function padStart (string, max) {
  return common$4.repeat(' ', max - string.length) + string
}

function makeSnippet$1 (mark, options) {
  options = Object.create(options || null);

  if (!mark.buffer) return null

  if (!options.maxLength) options.maxLength = 79;
  if (typeof options.indent !== 'number') options.indent = 1;
  if (typeof options.linesBefore !== 'number') options.linesBefore = 3;
  if (typeof options.linesAfter !== 'number') options.linesAfter = 2;

  const re = /\r?\n|\r|\0/g;
  const lineStarts = [0];
  const lineEnds = [];
  let match;
  let foundLineNo = -1;

  while ((match = re.exec(mark.buffer))) {
    lineEnds.push(match.index);
    lineStarts.push(match.index + match[0].length);

    if (mark.position <= match.index && foundLineNo < 0) {
      foundLineNo = lineStarts.length - 2;
    }
  }

  if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;

  let result = '';
  const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
  const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);

  for (let i = 1; i <= options.linesBefore; i++) {
    if (foundLineNo - i < 0) break
    const line = getLine(
      mark.buffer,
      lineStarts[foundLineNo - i],
      lineEnds[foundLineNo - i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
      maxLineLength
    );
    result = common$4.repeat(' ', options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) +
      ' | ' + line.str + '\n' + result;
  }

  const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
  result += common$4.repeat(' ', options.indent) + padStart((mark.line + 1).toString(), lineNoLength) +
    ' | ' + line.str + '\n';
  result += common$4.repeat('-', options.indent + lineNoLength + 3 + line.pos) + '^' + '\n';

  for (let i = 1; i <= options.linesAfter; i++) {
    if (foundLineNo + i >= lineEnds.length) break
    const line = getLine(
      mark.buffer,
      lineStarts[foundLineNo + i],
      lineEnds[foundLineNo + i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
      maxLineLength
    );
    result += common$4.repeat(' ', options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) +
      ' | ' + line.str + '\n';
  }

  return result.replace(/\n$/, '')
}

var snippet = makeSnippet$1;

const YAMLException$3 = exception;

const TYPE_CONSTRUCTOR_OPTIONS = [
  'kind',
  'multi',
  'resolve',
  'construct',
  'instanceOf',
  'predicate',
  'represent',
  'representName',
  'defaultStyle',
  'styleAliases'
];

const YAML_NODE_KINDS = [
  'scalar',
  'sequence',
  'mapping'
];

function compileStyleAliases (map) {
  const result = {};

  if (map !== null) {
    Object.keys(map).forEach(function (style) {
      map[style].forEach(function (alias) {
        result[String(alias)] = style;
      });
    });
  }

  return result
}

function Type$e (tag, options) {
  options = options || {};

  Object.keys(options).forEach(function (name) {
    if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
      throw new YAMLException$3('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.')
    }
  });

  // TODO: Add tag format check.
  this.options = options; // keep original options in case user wants to extend this type later
  this.tag = tag;
  this.kind = options['kind'] || null;
  this.resolve = options['resolve'] || function () { return true };
  this.construct = options['construct'] || function (data) { return data };
  this.instanceOf = options['instanceOf'] || null;
  this.predicate = options['predicate'] || null;
  this.represent = options['represent'] || null;
  this.representName = options['representName'] || null;
  this.defaultStyle = options['defaultStyle'] || null;
  this.multi = options['multi'] || false;
  this.styleAliases = compileStyleAliases(options['styleAliases'] || null);

  if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
    throw new YAMLException$3('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.')
  }
}

var type$1 = Type$e;

const YAMLException$2 = exception;
const Type$d = type$1;

function compileList (schema, name) {
  const result = [];

  schema[name].forEach(function (currentType) {
    let newIndex = result.length;

    result.forEach(function (previousType, previousIndex) {
      if (previousType.tag === currentType.tag &&
          previousType.kind === currentType.kind &&
          previousType.multi === currentType.multi) {
        newIndex = previousIndex;
      }
    });

    result[newIndex] = currentType;
  });

  return result
}

function compileMap (/* lists... */) {
  const result = {
    scalar: {},
    sequence: {},
    mapping: {},
    fallback: {},
    multi: {
      scalar: [],
      sequence: [],
      mapping: [],
      fallback: []
    }
  };
  function collectType (type) {
    if (type.multi) {
      result.multi[type.kind].push(type);
      result.multi['fallback'].push(type);
    } else {
      result[type.kind][type.tag] = result['fallback'][type.tag] = type;
    }
  }

  for (let index = 0, length = arguments.length; index < length; index += 1) {
    arguments[index].forEach(collectType);
  }
  return result
}

function Schema$1 (definition) {
  return this.extend(definition)
}

Schema$1.prototype.extend = function extend (definition) {
  let implicit = [];
  let explicit = [];

  if (definition instanceof Type$d) {
    // Schema.extend(type)
    explicit.push(definition);
  } else if (Array.isArray(definition)) {
    // Schema.extend([ type1, type2, ... ])
    explicit = explicit.concat(definition);
  } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
    // Schema.extend({ explicit: [ type1, type2, ... ], implicit: [ type1, type2, ... ] })
    if (definition.implicit) implicit = implicit.concat(definition.implicit);
    if (definition.explicit) explicit = explicit.concat(definition.explicit);
  } else {
    throw new YAMLException$2('Schema.extend argument should be a Type, [ Type ], ' +
      'or a schema definition ({ implicit: [...], explicit: [...] })')
  }

  implicit.forEach(function (type) {
    if (!(type instanceof Type$d)) {
      throw new YAMLException$2('Specified list of YAML types (or a single Type object) contains a non-Type object.')
    }

    if (type.loadKind && type.loadKind !== 'scalar') {
      throw new YAMLException$2('There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.')
    }

    if (type.multi) {
      throw new YAMLException$2('There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.')
    }
  });

  explicit.forEach(function (type) {
    if (!(type instanceof Type$d)) {
      throw new YAMLException$2('Specified list of YAML types (or a single Type object) contains a non-Type object.')
    }
  });

  const result = Object.create(Schema$1.prototype);

  result.implicit = (this.implicit || []).concat(implicit);
  result.explicit = (this.explicit || []).concat(explicit);

  result.compiledImplicit = compileList(result, 'implicit');
  result.compiledExplicit = compileList(result, 'explicit');
  result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);

  return result
};

var schema = Schema$1;

const Type$c = type$1;

var str = new Type$c('tag:yaml.org,2002:str', {
  kind: 'scalar',
  construct: function (data) { return data !== null ? data : '' }
});

const Type$b = type$1;

var seq = new Type$b('tag:yaml.org,2002:seq', {
  kind: 'sequence',
  construct: function (data) { return data !== null ? data : [] }
});

const Type$a = type$1;

var map = new Type$a('tag:yaml.org,2002:map', {
  kind: 'mapping',
  construct: function (data) { return data !== null ? data : {} }
});

const Schema = schema;

var failsafe = new Schema({
  explicit: [
    str,
    seq,
    map
  ]
});

const Type$9 = type$1;

function resolveYamlNull (data) {
  if (data === null) return true

  const max = data.length;

  return (max === 1 && data === '~') ||
         (max === 4 && (data === 'null' || data === 'Null' || data === 'NULL'))
}

function constructYamlNull () {
  return null
}

function isNull (object) {
  return object === null
}

var _null = new Type$9('tag:yaml.org,2002:null', {
  kind: 'scalar',
  resolve: resolveYamlNull,
  construct: constructYamlNull,
  predicate: isNull,
  represent: {
    canonical: function () { return '~' },
    lowercase: function () { return 'null' },
    uppercase: function () { return 'NULL' },
    camelcase: function () { return 'Null' },
    empty: function () { return '' }
  },
  defaultStyle: 'lowercase'
});

const Type$8 = type$1;

function resolveYamlBoolean (data) {
  if (data === null) return false

  const max = data.length;

  return (max === 4 && (data === 'true' || data === 'True' || data === 'TRUE')) ||
         (max === 5 && (data === 'false' || data === 'False' || data === 'FALSE'))
}

function constructYamlBoolean (data) {
  return data === 'true' ||
         data === 'True' ||
         data === 'TRUE'
}

function isBoolean (object) {
  return Object.prototype.toString.call(object) === '[object Boolean]'
}

var bool = new Type$8('tag:yaml.org,2002:bool', {
  kind: 'scalar',
  resolve: resolveYamlBoolean,
  construct: constructYamlBoolean,
  predicate: isBoolean,
  represent: {
    lowercase: function (object) { return object ? 'true' : 'false' },
    uppercase: function (object) { return object ? 'TRUE' : 'FALSE' },
    camelcase: function (object) { return object ? 'True' : 'False' }
  },
  defaultStyle: 'lowercase'
});

const common$3 = common$5;
const Type$7 = type$1;

function isHexCode (c) {
  return ((c >= 0x30/* 0 */) && (c <= 0x39/* 9 */)) ||
         ((c >= 0x41/* A */) && (c <= 0x46/* F */)) ||
         ((c >= 0x61/* a */) && (c <= 0x66/* f */))
}

function isOctCode (c) {
  return ((c >= 0x30/* 0 */) && (c <= 0x37/* 7 */))
}

function isDecCode (c) {
  return ((c >= 0x30/* 0 */) && (c <= 0x39/* 9 */))
}

function resolveYamlInteger (data) {
  if (data === null) return false

  const max = data.length;
  let index = 0;
  let hasDigits = false;

  if (!max) return false

  let ch = data[index];

  // sign
  if (ch === '-' || ch === '+') {
    ch = data[++index];
  }

  if (ch === '0') {
    // 0
    if (index + 1 === max) return true
    ch = data[++index];

    // base 2, base 8, base 16

    if (ch === 'b') {
      // base 2
      index++;

      for (; index < max; index++) {
        ch = data[index];
        if (ch !== '0' && ch !== '1') return false
        hasDigits = true;
      }
      return hasDigits && isFinite(parseYamlInteger(data))
    }

    if (ch === 'x') {
      // base 16
      index++;

      for (; index < max; index++) {
        if (!isHexCode(data.charCodeAt(index))) return false
        hasDigits = true;
      }
      return hasDigits && isFinite(parseYamlInteger(data))
    }

    if (ch === 'o') {
      // base 8
      index++;

      for (; index < max; index++) {
        if (!isOctCode(data.charCodeAt(index))) return false
        hasDigits = true;
      }
      return hasDigits && isFinite(parseYamlInteger(data))
    }
  }

  // base 10 (except 0)

  for (; index < max; index++) {
    if (!isDecCode(data.charCodeAt(index))) {
      return false
    }
    hasDigits = true;
  }

  if (!hasDigits) return false

  return isFinite(parseYamlInteger(data))
}

function parseYamlInteger (data) {
  let value = data;
  let sign = 1;

  let ch = value[0];

  if (ch === '-' || ch === '+') {
    if (ch === '-') sign = -1;
    value = value.slice(1);
    ch = value[0];
  }

  if (value === '0') return 0

  if (ch === '0') {
    if (value[1] === 'b') return sign * parseInt(value.slice(2), 2)
    if (value[1] === 'x') return sign * parseInt(value.slice(2), 16)
    if (value[1] === 'o') return sign * parseInt(value.slice(2), 8)
  }

  return sign * parseInt(value, 10)
}

function constructYamlInteger (data) {
  return parseYamlInteger(data)
}

function isInteger (object) {
  return (Object.prototype.toString.call(object)) === '[object Number]' &&
         (object % 1 === 0 && !common$3.isNegativeZero(object))
}

var int = new Type$7('tag:yaml.org,2002:int', {
  kind: 'scalar',
  resolve: resolveYamlInteger,
  construct: constructYamlInteger,
  predicate: isInteger,
  represent: {
    binary: function (obj) { return obj >= 0 ? '0b' + obj.toString(2) : '-0b' + obj.toString(2).slice(1) },
    octal: function (obj) { return obj >= 0 ? '0o' + obj.toString(8) : '-0o' + obj.toString(8).slice(1) },
    decimal: function (obj) { return obj.toString(10) },
    hexadecimal: function (obj) { return obj >= 0 ? '0x' + obj.toString(16).toUpperCase() : '-0x' + obj.toString(16).toUpperCase().slice(1) }
  },
  defaultStyle: 'decimal',
  styleAliases: {
    binary: [2, 'bin'],
    octal: [8, 'oct'],
    decimal: [10, 'dec'],
    hexadecimal: [16, 'hex']
  }
});

const common$2 = common$5;
const Type$6 = type$1;

const YAML_FLOAT_PATTERN = new RegExp(
  // 2.5e4, 2.5 and integers
  '^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?' +
  // .2e4, .2
  // special case, seems not from spec
  '|\\.[0-9]+(?:[eE][-+]?[0-9]+)?' +
  // .inf
  '|[-+]?\\.(?:inf|Inf|INF)' +
  // .nan
  '|\\.(?:nan|NaN|NAN))$');

const YAML_FLOAT_SPECIAL_PATTERN = new RegExp(
  '^(?:' +
  // .inf
  '[-+]?\\.(?:inf|Inf|INF)' +
  // .nan
  '|\\.(?:nan|NaN|NAN))$');

function resolveYamlFloat (data) {
  if (data === null) return false

  if (!YAML_FLOAT_PATTERN.test(data)) {
    return false
  }

  if (isFinite(parseFloat(data, 10))) {
    return true
  }

  return YAML_FLOAT_SPECIAL_PATTERN.test(data)
}

function constructYamlFloat (data) {
  let value = data.toLowerCase();
  const sign = value[0] === '-' ? -1 : 1;

  if ('+-'.indexOf(value[0]) >= 0) {
    value = value.slice(1);
  }

  if (value === '.inf') {
    return (sign === 1) ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
  } else if (value === '.nan') {
    return NaN
  }
  return sign * parseFloat(value, 10)
}

const SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;

function representYamlFloat (object, style) {
  if (isNaN(object)) {
    switch (style) {
      case 'lowercase': return '.nan'
      case 'uppercase': return '.NAN'
      case 'camelcase': return '.NaN'
    }
  } else if (Number.POSITIVE_INFINITY === object) {
    switch (style) {
      case 'lowercase': return '.inf'
      case 'uppercase': return '.INF'
      case 'camelcase': return '.Inf'
    }
  } else if (Number.NEGATIVE_INFINITY === object) {
    switch (style) {
      case 'lowercase': return '-.inf'
      case 'uppercase': return '-.INF'
      case 'camelcase': return '-.Inf'
    }
  } else if (common$2.isNegativeZero(object)) {
    return '-0.0'
  }

  const res = object.toString(10);

  // JS stringifier can build scientific format without dots: 5e-100,
  // while YAML requres dot: 5.e-100. Fix it with simple hack

  return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace('e', '.e') : res
}

function isFloat (object) {
  return (Object.prototype.toString.call(object) === '[object Number]') &&
         (object % 1 !== 0 || common$2.isNegativeZero(object))
}

var float = new Type$6('tag:yaml.org,2002:float', {
  kind: 'scalar',
  resolve: resolveYamlFloat,
  construct: constructYamlFloat,
  predicate: isFloat,
  represent: representYamlFloat,
  defaultStyle: 'lowercase'
});

var json = failsafe.extend({
  implicit: [
    _null,
    bool,
    int,
    float
  ]
});

var core = json;

const Type$5 = type$1;

const YAML_DATE_REGEXP = new RegExp(
  '^([0-9][0-9][0-9][0-9])' + // [1] year
  '-([0-9][0-9])' + // [2] month
  '-([0-9][0-9])$');                   // [3] day

const YAML_TIMESTAMP_REGEXP = new RegExp(
  '^([0-9][0-9][0-9][0-9])' + // [1] year
  '-([0-9][0-9]?)' + // [2] month
  '-([0-9][0-9]?)' + // [3] day
  '(?:[Tt]|[ \\t]+)' + // ...
  '([0-9][0-9]?)' + // [4] hour
  ':([0-9][0-9])' + // [5] minute
  ':([0-9][0-9])' + // [6] second
  '(?:\\.([0-9]*))?' + // [7] fraction
  '(?:[ \\t]*(Z|([-+])([0-9][0-9]?)' + // [8] tz [9] tz_sign [10] tzHour
  '(?::([0-9][0-9]))?))?$');           // [11] tzMinute

function resolveYamlTimestamp (data) {
  if (data === null) return false
  if (YAML_DATE_REGEXP.exec(data) !== null) return true
  if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true
  return false
}

function constructYamlTimestamp (data) {
  let fraction = 0;
  let delta = null;

  let match = YAML_DATE_REGEXP.exec(data);
  if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);

  if (match === null) throw new Error('Date resolve error')

  // match: [1] year [2] month [3] day

  const year = +(match[1]);
  const month = +(match[2]) - 1; // JS month starts with 0
  const day = +(match[3]);

  if (!match[4]) { // no hour
    return new Date(Date.UTC(year, month, day))
  }

  // match: [4] hour [5] minute [6] second [7] fraction

  const hour = +(match[4]);
  const minute = +(match[5]);
  const second = +(match[6]);

  if (match[7]) {
    fraction = match[7].slice(0, 3);
    while (fraction.length < 3) { // milli-seconds
      fraction += '0';
    }
    fraction = +fraction;
  }

  // match: [8] tz [9] tz_sign [10] tzHour [11] tzMinute

  if (match[9]) {
    const tzHour = +(match[10]);
    const tzMinute = +(match[11] || 0);
    delta = (tzHour * 60 + tzMinute) * 60000; // delta in mili-seconds
    if (match[9] === '-') delta = -delta;
  }

  const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));

  if (delta) date.setTime(date.getTime() - delta);

  return date
}

function representYamlTimestamp (object /*, style */) {
  return object.toISOString()
}

var timestamp = new Type$5('tag:yaml.org,2002:timestamp', {
  kind: 'scalar',
  resolve: resolveYamlTimestamp,
  construct: constructYamlTimestamp,
  instanceOf: Date,
  represent: representYamlTimestamp
});

const Type$4 = type$1;

function resolveYamlMerge (data) {
  return data === '<<' || data === null
}

var merge = new Type$4('tag:yaml.org,2002:merge', {
  kind: 'scalar',
  resolve: resolveYamlMerge
});

const Type$3 = type$1;

// [ 64, 65, 66 ] -> [ padding, CR, LF ]
const BASE64_MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r';

function resolveYamlBinary (data) {
  if (data === null) return false

  let bitlen = 0;
  const max = data.length;
  const map = BASE64_MAP;

  // Convert one by one.
  for (let idx = 0; idx < max; idx++) {
    const code = map.indexOf(data.charAt(idx));

    // Skip CR/LF
    if (code > 64) continue

    // Fail on illegal characters
    if (code < 0) return false

    bitlen += 6;
  }

  // If there are any bits left, source was corrupted
  return (bitlen % 8) === 0
}

function constructYamlBinary (data) {
  const input = data.replace(/[\r\n=]/g, ''); // remove CR/LF & padding to simplify scan
  const max = input.length;
  const map = BASE64_MAP;
  let bits = 0;
  const result = [];

  // Collect by 6*4 bits (3 bytes)

  for (let idx = 0; idx < max; idx++) {
    if ((idx % 4 === 0) && idx) {
      result.push((bits >> 16) & 0xFF);
      result.push((bits >> 8) & 0xFF);
      result.push(bits & 0xFF);
    }

    bits = (bits << 6) | map.indexOf(input.charAt(idx));
  }

  // Dump tail

  const tailbits = (max % 4) * 6;

  if (tailbits === 0) {
    result.push((bits >> 16) & 0xFF);
    result.push((bits >> 8) & 0xFF);
    result.push(bits & 0xFF);
  } else if (tailbits === 18) {
    result.push((bits >> 10) & 0xFF);
    result.push((bits >> 2) & 0xFF);
  } else if (tailbits === 12) {
    result.push((bits >> 4) & 0xFF);
  }

  return new Uint8Array(result)
}

function representYamlBinary (object /*, style */) {
  let result = '';
  let bits = 0;
  const max = object.length;
  const map = BASE64_MAP;

  // Convert every three bytes to 4 ASCII characters.

  for (let idx = 0; idx < max; idx++) {
    if ((idx % 3 === 0) && idx) {
      result += map[(bits >> 18) & 0x3F];
      result += map[(bits >> 12) & 0x3F];
      result += map[(bits >> 6) & 0x3F];
      result += map[bits & 0x3F];
    }

    bits = (bits << 8) + object[idx];
  }

  // Dump tail

  const tail = max % 3;

  if (tail === 0) {
    result += map[(bits >> 18) & 0x3F];
    result += map[(bits >> 12) & 0x3F];
    result += map[(bits >> 6) & 0x3F];
    result += map[bits & 0x3F];
  } else if (tail === 2) {
    result += map[(bits >> 10) & 0x3F];
    result += map[(bits >> 4) & 0x3F];
    result += map[(bits << 2) & 0x3F];
    result += map[64];
  } else if (tail === 1) {
    result += map[(bits >> 2) & 0x3F];
    result += map[(bits << 4) & 0x3F];
    result += map[64];
    result += map[64];
  }

  return result
}

function isBinary (obj) {
  return Object.prototype.toString.call(obj) === '[object Uint8Array]'
}

var binary = new Type$3('tag:yaml.org,2002:binary', {
  kind: 'scalar',
  resolve: resolveYamlBinary,
  construct: constructYamlBinary,
  predicate: isBinary,
  represent: representYamlBinary
});

const Type$2 = type$1;

const _hasOwnProperty$3 = Object.prototype.hasOwnProperty;
const _toString$2 = Object.prototype.toString;

function resolveYamlOmap (data) {
  if (data === null) return true

  const objectKeys = [];
  const object = data;

  for (let index = 0, length = object.length; index < length; index += 1) {
    const pair = object[index];
    let pairHasKey = false;

    if (_toString$2.call(pair) !== '[object Object]') return false

    let pairKey;
    for (pairKey in pair) {
      if (_hasOwnProperty$3.call(pair, pairKey)) {
        if (!pairHasKey) pairHasKey = true;
        else return false
      }
    }

    if (!pairHasKey) return false

    if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
    else return false
  }

  return true
}

function constructYamlOmap (data) {
  return data !== null ? data : []
}

var omap = new Type$2('tag:yaml.org,2002:omap', {
  kind: 'sequence',
  resolve: resolveYamlOmap,
  construct: constructYamlOmap
});

const Type$1 = type$1;

const _toString$1 = Object.prototype.toString;

function resolveYamlPairs (data) {
  if (data === null) return true

  const object = data;

  const result = new Array(object.length);

  for (let index = 0, length = object.length; index < length; index += 1) {
    const pair = object[index];

    if (_toString$1.call(pair) !== '[object Object]') return false

    const keys = Object.keys(pair);

    if (keys.length !== 1) return false

    result[index] = [keys[0], pair[keys[0]]];
  }

  return true
}

function constructYamlPairs (data) {
  if (data === null) return []

  const object = data;
  const result = new Array(object.length);

  for (let index = 0, length = object.length; index < length; index += 1) {
    const pair = object[index];

    const keys = Object.keys(pair);

    result[index] = [keys[0], pair[keys[0]]];
  }

  return result
}

var pairs = new Type$1('tag:yaml.org,2002:pairs', {
  kind: 'sequence',
  resolve: resolveYamlPairs,
  construct: constructYamlPairs
});

const Type = type$1;

const _hasOwnProperty$2 = Object.prototype.hasOwnProperty;

function resolveYamlSet (data) {
  if (data === null) return true

  const object = data;

  for (const key in object) {
    if (_hasOwnProperty$2.call(object, key)) {
      if (object[key] !== null) return false
    }
  }

  return true
}

function constructYamlSet (data) {
  return data !== null ? data : {}
}

var set = new Type('tag:yaml.org,2002:set', {
  kind: 'mapping',
  resolve: resolveYamlSet,
  construct: constructYamlSet
});

var _default = core.extend({
  implicit: [
    timestamp,
    merge
  ],
  explicit: [
    binary,
    omap,
    pairs,
    set
  ]
});

const common$1 = common$5;
const YAMLException$1 = exception;
const makeSnippet = snippet;
const DEFAULT_SCHEMA$1 = _default;

const _hasOwnProperty$1 = Object.prototype.hasOwnProperty;

const CONTEXT_FLOW_IN = 1;
const CONTEXT_FLOW_OUT = 2;
const CONTEXT_BLOCK_IN = 3;
const CONTEXT_BLOCK_OUT = 4;

const CHOMPING_CLIP = 1;
const CHOMPING_STRIP = 2;
const CHOMPING_KEEP = 3;

// eslint-disable-next-line no-control-regex
const PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
const PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
// eslint-disable-next-line no-useless-escape
const PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
// eslint-disable-next-line no-useless-escape
const PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
// eslint-disable-next-line no-useless-escape
const PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;

function _class (obj) { return Object.prototype.toString.call(obj) }

function isEol (c) {
  return (c === 0x0A/* LF */) || (c === 0x0D/* CR */)
}

function isWhiteSpace (c) {
  return (c === 0x09/* Tab */) || (c === 0x20/* Space */)
}

function isWsOrEol (c) {
  return (c === 0x09/* Tab */) ||
         (c === 0x20/* Space */) ||
         (c === 0x0A/* LF */) ||
         (c === 0x0D/* CR */)
}

function isFlowIndicator (c) {
  return c === 0x2C/* , */ ||
         c === 0x5B/* [ */ ||
         c === 0x5D/* ] */ ||
         c === 0x7B/* { */ ||
         c === 0x7D/* } */
}

function fromHexCode (c) {
  if ((c >= 0x30/* 0 */) && (c <= 0x39/* 9 */)) {
    return c - 0x30
  }

  const lc = c | 0x20;

  if ((lc >= 0x61/* a */) && (lc <= 0x66/* f */)) {
    return lc - 0x61 + 10
  }

  return -1
}

function escapedHexLen (c) {
  if (c === 0x78/* x */) { return 2 }
  if (c === 0x75/* u */) { return 4 }
  if (c === 0x55/* U */) { return 8 }
  return 0
}

function fromDecimalCode (c) {
  if ((c >= 0x30/* 0 */) && (c <= 0x39/* 9 */)) {
    return c - 0x30
  }

  return -1
}

function simpleEscapeSequence (c) {
  switch (c) {
    case 0x30/* 0 */: return '\x00'
    case 0x61/* a */: return '\x07'
    case 0x62/* b */: return '\x08'
    case 0x74/* t */: return '\x09'
    case 0x09/* Tab */: return '\x09'
    case 0x6E/* n */: return '\x0A'
    case 0x76/* v */: return '\x0B'
    case 0x66/* f */: return '\x0C'
    case 0x72/* r */: return '\x0D'
    case 0x65/* e */: return '\x1B'
    case 0x20/* Space */: return ' '
    case 0x22/* " */: return '\x22'
    case 0x2F/* / */: return '/'
    case 0x5C/* \ */: return '\x5C'
    case 0x4E/* N */: return '\x85'
    case 0x5F/* _ */: return '\xA0'
    case 0x4C/* L */: return '\u2028'
    case 0x50/* P */: return '\u2029'
    default: return ''
  }
}

function charFromCodepoint (c) {
  if (c <= 0xFFFF) {
    return String.fromCharCode(c)
  }
  // Encode UTF-16 surrogate pair
  // https://en.wikipedia.org/wiki/UTF-16#Code_points_U.2B010000_to_U.2B10FFFF
  return String.fromCharCode(
    ((c - 0x010000) >> 10) + 0xD800,
    ((c - 0x010000) & 0x03FF) + 0xDC00
  )
}

// set a property of a literal object, while protecting against prototype pollution,
// see https://github.com/nodeca/js-yaml/issues/164 for more details
function setProperty (object, key, value) {
  // used for this specific key only because Object.defineProperty is slow
  if (key === '__proto__') {
    Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: value
    });
  } else {
    object[key] = value;
  }
}

const simpleEscapeCheck = new Array(256); // integer, for fast access
const simpleEscapeMap = new Array(256);
for (let i = 0; i < 256; i++) {
  simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
  simpleEscapeMap[i] = simpleEscapeSequence(i);
}

function State$1 (input, options) {
  this.input = input;

  this.filename = options['filename'] || null;
  this.schema = options['schema'] || DEFAULT_SCHEMA$1;
  this.onWarning = options['onWarning'] || null;
  // (Hidden) Remove? makes the loader to expect YAML 1.1 documents
  // if such documents have no explicit %YAML directive
  this.legacy = options['legacy'] || false;

  this.json = options['json'] || false;
  this.listener = options['listener'] || null;
  this.maxDepth = typeof options['maxDepth'] === 'number' ? options['maxDepth'] : 100;
  this.maxTotalMergeKeys = typeof options['maxTotalMergeKeys'] === 'number' ? options['maxTotalMergeKeys'] : 10000;

  this.implicitTypes = this.schema.compiledImplicit;
  this.typeMap = this.schema.compiledTypeMap;

  this.length = input.length;
  this.position = 0;
  this.line = 0;
  this.lineStart = 0;
  this.lineIndent = 0;
  this.depth = 0;
  this.totalMergeKeys = 0;

  // position of first leading tab in the current line,
  // used to make sure there are no tabs in the indentation
  this.firstTabInLine = -1;

  this.documents = [];
  this.anchorMapTransactions = [];

  /*
  this.version;
  this.checkLineBreaks;
  this.tagMap;
  this.anchorMap;
  this.tag;
  this.anchor;
  this.kind;
  this.result; */
}

function generateError (state, message) {
  const mark = {
    name: state.filename,
    buffer: state.input.slice(0, -1), // omit trailing \0
    position: state.position,
    line: state.line,
    column: state.position - state.lineStart
  };

  mark.snippet = makeSnippet(mark);

  return new YAMLException$1(message, mark)
}

function throwError (state, message) {
  throw generateError(state, message)
}

function throwWarning (state, message) {
  if (state.onWarning) {
    state.onWarning.call(null, generateError(state, message));
  }
}

function storeAnchor (state, name, value) {
  const transactions = state.anchorMapTransactions;

  if (transactions.length !== 0) {
    const transaction = transactions[transactions.length - 1];

    if (!_hasOwnProperty$1.call(transaction, name)) {
      transaction[name] = {
        existed: _hasOwnProperty$1.call(state.anchorMap, name),
        value: state.anchorMap[name]
      };
    }
  }

  state.anchorMap[name] = value;
}

function beginAnchorTransaction (state) {
  state.anchorMapTransactions.push(Object.create(null));
}

function commitAnchorTransaction (state) {
  const transaction = state.anchorMapTransactions.pop();
  const transactions = state.anchorMapTransactions;

  if (transactions.length === 0) return

  const parent = transactions[transactions.length - 1];
  const names = Object.keys(transaction);

  for (let index = 0, length = names.length; index < length; index += 1) {
    const name = names[index];

    if (!_hasOwnProperty$1.call(parent, name)) {
      parent[name] = transaction[name];
    }
  }
}

function rollbackAnchorTransaction (state) {
  const transaction = state.anchorMapTransactions.pop();
  const names = Object.keys(transaction);

  for (let index = names.length - 1; index >= 0; index -= 1) {
    const entry = transaction[names[index]];

    if (entry.existed) {
      state.anchorMap[names[index]] = entry.value;
    } else {
      delete state.anchorMap[names[index]];
    }
  }
}

function snapshotState (state) {
  return {
    position: state.position,
    line: state.line,
    lineStart: state.lineStart,
    lineIndent: state.lineIndent,
    firstTabInLine: state.firstTabInLine,
    tag: state.tag,
    anchor: state.anchor,
    kind: state.kind,
    result: state.result
  }
}

function restoreState (state, snapshot) {
  state.position = snapshot.position;
  state.line = snapshot.line;
  state.lineStart = snapshot.lineStart;
  state.lineIndent = snapshot.lineIndent;
  state.firstTabInLine = snapshot.firstTabInLine;
  state.tag = snapshot.tag;
  state.anchor = snapshot.anchor;
  state.kind = snapshot.kind;
  state.result = snapshot.result;
}

const directiveHandlers = {

  YAML: function handleYamlDirective (state, name, args) {
    if (state.version !== null) {
      throwError(state, 'duplication of %YAML directive');
    }

    if (args.length !== 1) {
      throwError(state, 'YAML directive accepts exactly one argument');
    }

    const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);

    if (match === null) {
      throwError(state, 'ill-formed argument of the YAML directive');
    }

    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);

    if (major !== 1) {
      throwError(state, 'unacceptable YAML version of the document');
    }

    state.version = args[0];
    state.checkLineBreaks = (minor < 2);

    if (minor !== 1 && minor !== 2) {
      throwWarning(state, 'unsupported YAML version of the document');
    }
  },

  TAG: function handleTagDirective (state, name, args) {
    let prefix;

    if (args.length !== 2) {
      throwError(state, 'TAG directive accepts exactly two arguments');
    }

    const handle = args[0];
    prefix = args[1];

    if (!PATTERN_TAG_HANDLE.test(handle)) {
      throwError(state, 'ill-formed tag handle (first argument) of the TAG directive');
    }

    if (_hasOwnProperty$1.call(state.tagMap, handle)) {
      throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
    }

    if (!PATTERN_TAG_URI.test(prefix)) {
      throwError(state, 'ill-formed tag prefix (second argument) of the TAG directive');
    }

    try {
      prefix = decodeURIComponent(prefix);
    } catch (err) {
      throwError(state, 'tag prefix is malformed: ' + prefix);
    }

    state.tagMap[handle] = prefix;
  }
};

function captureSegment (state, start, end, checkJson) {
  if (start < end) {
    const _result = state.input.slice(start, end);

    if (checkJson) {
      for (let _position = 0, _length = _result.length; _position < _length; _position += 1) {
        const _character = _result.charCodeAt(_position);
        if (!(_character === 0x09 ||
              (_character >= 0x20 && _character <= 0x10FFFF))) {
          throwError(state, 'expected valid JSON character');
        }
      }
    } else if (PATTERN_NON_PRINTABLE.test(_result)) {
      throwError(state, 'the stream contains non-printable characters');
    }

    state.result += _result;
  }
}

function mergeMappings (state, destination, source, overridableKeys) {
  if (!common$1.isObject(source)) {
    throwError(state, 'cannot merge mappings; the provided source object is unacceptable');
  }

  const sourceKeys = Object.keys(source);

  for (let index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
    const key = sourceKeys[index];

    if (state.maxTotalMergeKeys !== -1 && ++state.totalMergeKeys > state.maxTotalMergeKeys) {
      throwError(state, 'merge keys exceeded maxTotalMergeKeys (' + state.maxTotalMergeKeys + ')');
    }

    if (!_hasOwnProperty$1.call(destination, key)) {
      setProperty(destination, key, source[key]);
      overridableKeys[key] = true;
    }
  }
}

function storeMappingPair (state, _result, overridableKeys, keyTag, keyNode, valueNode,
  startLine, startLineStart, startPos) {
  // The output is a plain object here, so keys can only be strings.
  // We need to convert keyNode to a string, but doing so can hang the process
  // (deeply nested arrays that explode exponentially using aliases).
  if (Array.isArray(keyNode)) {
    keyNode = Array.prototype.slice.call(keyNode);

    for (let index = 0, quantity = keyNode.length; index < quantity; index += 1) {
      if (Array.isArray(keyNode[index])) {
        throwError(state, 'nested arrays are not supported inside keys');
      }

      if (typeof keyNode === 'object' && _class(keyNode[index]) === '[object Object]') {
        keyNode[index] = '[object Object]';
      }
    }
  }

  // Avoid code execution in load() via toString property
  // (still use its own toString for arrays, timestamps,
  // and whatever user schema extensions happen to have @@toStringTag)
  if (typeof keyNode === 'object' && _class(keyNode) === '[object Object]') {
    keyNode = '[object Object]';
  }

  keyNode = String(keyNode);

  if (_result === null) {
    _result = {};
  }

  if (keyTag === 'tag:yaml.org,2002:merge') {
    if (Array.isArray(valueNode)) {
      for (let index = 0, quantity = valueNode.length; index < quantity; index += 1) {
        mergeMappings(state, _result, valueNode[index], overridableKeys);
      }
    } else {
      mergeMappings(state, _result, valueNode, overridableKeys);
    }
  } else {
    if (!state.json &&
        !_hasOwnProperty$1.call(overridableKeys, keyNode) &&
        _hasOwnProperty$1.call(_result, keyNode)) {
      state.line = startLine || state.line;
      state.lineStart = startLineStart || state.lineStart;
      state.position = startPos || state.position;
      throwError(state, 'duplicated mapping key');
    }

    setProperty(_result, keyNode, valueNode);
    delete overridableKeys[keyNode];
  }

  return _result
}

function readLineBreak (state) {
  const ch = state.input.charCodeAt(state.position);

  if (ch === 0x0A/* LF */) {
    state.position++;
  } else if (ch === 0x0D/* CR */) {
    state.position++;
    if (state.input.charCodeAt(state.position) === 0x0A/* LF */) {
      state.position++;
    }
  } else {
    throwError(state, 'a line break is expected');
  }

  state.line += 1;
  state.lineStart = state.position;
  state.firstTabInLine = -1;
}

function skipSeparationSpace (state, allowComments, checkIndent) {
  let lineBreaks = 0;
  let ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    while (isWhiteSpace(ch)) {
      if (ch === 0x09/* Tab */ && state.firstTabInLine === -1) {
        state.firstTabInLine = state.position;
      }
      ch = state.input.charCodeAt(++state.position);
    }

    if (allowComments && ch === 0x23/* # */) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0x0A/* LF */ && ch !== 0x0D/* CR */ && ch !== 0)
    }

    if (isEol(ch)) {
      readLineBreak(state);

      ch = state.input.charCodeAt(state.position);
      lineBreaks++;
      state.lineIndent = 0;

      while (ch === 0x20/* Space */) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    } else {
      break
    }
  }

  if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
    throwWarning(state, 'deficient indentation');
  }

  return lineBreaks
}

function testDocumentSeparator (state) {
  let _position = state.position;
  let ch = state.input.charCodeAt(_position);

  // Condition state.position === state.lineStart is tested
  // in parent on each call, for efficiency. No needs to test here again.
  if ((ch === 0x2D/* - */ || ch === 0x2E/* . */) &&
      ch === state.input.charCodeAt(_position + 1) &&
      ch === state.input.charCodeAt(_position + 2)) {
    _position += 3;

    ch = state.input.charCodeAt(_position);

    if (ch === 0 || isWsOrEol(ch)) {
      return true
    }
  }

  return false
}

function writeFoldedLines (state, count) {
  if (count === 1) {
    state.result += ' ';
  } else if (count > 1) {
    state.result += common$1.repeat('\n', count - 1);
  }
}

function readPlainScalar (state, nodeIndent, withinFlowCollection) {
  let captureStart;
  let captureEnd;
  let hasPendingContent;
  let _line;
  let _lineStart;
  let _lineIndent;
  const _kind = state.kind;
  const _result = state.result;

  let ch = state.input.charCodeAt(state.position);

  if (isWsOrEol(ch) ||
      isFlowIndicator(ch) ||
      ch === 0x23/* # */ ||
      ch === 0x26/* & */ ||
      ch === 0x2A/* * */ ||
      ch === 0x21/* ! */ ||
      ch === 0x7C/* | */ ||
      ch === 0x3E/* > */ ||
      ch === 0x27/* ' */ ||
      ch === 0x22/* " */ ||
      ch === 0x25/* % */ ||
      ch === 0x40/* @ */ ||
      ch === 0x60/* ` */) {
    return false
  }

  if (ch === 0x3F/* ? */ || ch === 0x2D/* - */) {
    const following = state.input.charCodeAt(state.position + 1);

    if (isWsOrEol(following) ||
        (withinFlowCollection && isFlowIndicator(following))) {
      return false
    }
  }

  state.kind = 'scalar';
  state.result = '';
  captureStart = captureEnd = state.position;
  hasPendingContent = false;

  while (ch !== 0) {
    if (ch === 0x3A/* : */) {
      const following = state.input.charCodeAt(state.position + 1);

      if (isWsOrEol(following) ||
          (withinFlowCollection && isFlowIndicator(following))) {
        break
      }
    } else if (ch === 0x23/* # */) {
      const preceding = state.input.charCodeAt(state.position - 1);

      if (isWsOrEol(preceding)) {
        break
      }
    } else if ((state.position === state.lineStart && testDocumentSeparator(state)) ||
               (withinFlowCollection && isFlowIndicator(ch))) {
      break
    } else if (isEol(ch)) {
      _line = state.line;
      _lineStart = state.lineStart;
      _lineIndent = state.lineIndent;
      skipSeparationSpace(state, false, -1);

      if (state.lineIndent >= nodeIndent) {
        hasPendingContent = true;
        ch = state.input.charCodeAt(state.position);
        continue
      } else {
        state.position = captureEnd;
        state.line = _line;
        state.lineStart = _lineStart;
        state.lineIndent = _lineIndent;
        break
      }
    }

    if (hasPendingContent) {
      captureSegment(state, captureStart, captureEnd, false);
      writeFoldedLines(state, state.line - _line);
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
    }

    if (!isWhiteSpace(ch)) {
      captureEnd = state.position + 1;
    }

    ch = state.input.charCodeAt(++state.position);
  }

  captureSegment(state, captureStart, captureEnd, false);

  if (state.result) {
    return true
  }

  state.kind = _kind;
  state.result = _result;
  return false
}

function readSingleQuotedScalar (state, nodeIndent) {
  let captureStart;
  let captureEnd;

  let ch = state.input.charCodeAt(state.position);

  if (ch !== 0x27/* ' */) {
    return false
  }

  state.kind = 'scalar';
  state.result = '';
  state.position++;
  captureStart = captureEnd = state.position;

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 0x27/* ' */) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);

      if (ch === 0x27/* ' */) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else {
        return true
      }
    } else if (isEol(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, 'unexpected end of the document within a single quoted scalar');
    } else {
      state.position++;
      if (!isWhiteSpace(ch)) {
        captureEnd = state.position;
      }
    }
  }

  throwError(state, 'unexpected end of the stream within a single quoted scalar');
}

function readDoubleQuotedScalar (state, nodeIndent) {
  let captureStart;
  let captureEnd;
  let tmp;

  let ch = state.input.charCodeAt(state.position);

  if (ch !== 0x22/* " */) {
    return false
  }

  state.kind = 'scalar';
  state.result = '';
  state.position++;
  captureStart = captureEnd = state.position;

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 0x22/* " */) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true
    } else if (ch === 0x5C/* \ */) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);

      if (isEol(ch)) {
        skipSeparationSpace(state, false, nodeIndent);

        // TODO: rework to inline fn with no type cast?
      } else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;
      } else if ((tmp = escapedHexLen(ch)) > 0) {
        let hexLength = tmp;
        let hexResult = 0;

        for (; hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);

          if ((tmp = fromHexCode(ch)) >= 0) {
            hexResult = (hexResult << 4) + tmp;
          } else {
            throwError(state, 'expected hexadecimal character');
          }
        }

        state.result += charFromCodepoint(hexResult);

        state.position++;
      } else {
        throwError(state, 'unknown escape sequence');
      }

      captureStart = captureEnd = state.position;
    } else if (isEol(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, 'unexpected end of the document within a double quoted scalar');
    } else {
      state.position++;
      if (!isWhiteSpace(ch)) {
        captureEnd = state.position;
      }
    }
  }

  throwError(state, 'unexpected end of the stream within a double quoted scalar');
}

function readFlowCollection (state, nodeIndent) {
  let readNext = true;
  let _line;
  let _lineStart;
  let _pos;
  const _tag = state.tag;
  let _result;
  const _anchor = state.anchor;
  let terminator;
  let isPair;
  let isExplicitPair;
  let isMapping;
  const overridableKeys = Object.create(null);
  let keyNode;
  let keyTag;
  let valueNode;

  let ch = state.input.charCodeAt(state.position);

  if (ch === 0x5B/* [ */) {
    terminator = 0x5D;/* ] */
    isMapping = false;
    _result = [];
  } else if (ch === 0x7B/* { */) {
    terminator = 0x7D;/* } */
    isMapping = true;
    _result = {};
  } else {
    return false
  }

  if (state.anchor !== null) {
    storeAnchor(state, state.anchor, _result);
  }

  ch = state.input.charCodeAt(++state.position);

  while (ch !== 0) {
    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if (ch === terminator) {
      state.position++;
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = isMapping ? 'mapping' : 'sequence';
      state.result = _result;
      return true
    } else if (!readNext) {
      throwError(state, 'missed comma between flow collection entries');
    } else if (ch === 0x2C/* , */) {
      // "flow collection entries can never be completely empty", as per YAML 1.2, section 7.4
      throwError(state, "expected the node content, but found ','");
    }

    keyTag = keyNode = valueNode = null;
    isPair = isExplicitPair = false;

    if (ch === 0x3F/* ? */) {
      const following = state.input.charCodeAt(state.position + 1);

      if (isWsOrEol(following)) {
        isPair = isExplicitPair = true;
        state.position++;
        skipSeparationSpace(state, true, nodeIndent);
      }
    }

    _line = state.line; // Save the current line.
    _lineStart = state.lineStart;
    _pos = state.position;
    composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    keyTag = state.tag;
    keyNode = state.result;
    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if ((isExplicitPair || state.line === _line) && ch === 0x3A/* : */) {
      isPair = true;
      ch = state.input.charCodeAt(++state.position);
      skipSeparationSpace(state, true, nodeIndent);
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      valueNode = state.result;
    }

    if (isMapping) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
    } else if (isPair) {
      _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
    } else {
      _result.push(keyNode);
    }

    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if (ch === 0x2C/* , */) {
      readNext = true;
      ch = state.input.charCodeAt(++state.position);
    } else {
      readNext = false;
    }
  }

  throwError(state, 'unexpected end of the stream within a flow collection');
}

function readBlockScalar (state, nodeIndent) {
  let folding;
  let chomping = CHOMPING_CLIP;
  let didReadContent = false;
  let detectedIndent = false;
  let textIndent = nodeIndent;
  let emptyLines = 0;
  let atMoreIndented = false;
  let tmp;

  let ch = state.input.charCodeAt(state.position);

  if (ch === 0x7C/* | */) {
    folding = false;
  } else if (ch === 0x3E/* > */) {
    folding = true;
  } else {
    return false
  }

  state.kind = 'scalar';
  state.result = '';

  while (ch !== 0) {
    ch = state.input.charCodeAt(++state.position);

    if (ch === 0x2B/* + */ || ch === 0x2D/* - */) {
      if (CHOMPING_CLIP === chomping) {
        chomping = (ch === 0x2B/* + */) ? CHOMPING_KEEP : CHOMPING_STRIP;
      } else {
        throwError(state, 'repeat of a chomping mode identifier');
      }
    } else if ((tmp = fromDecimalCode(ch)) >= 0) {
      if (tmp === 0) {
        throwError(state, 'bad explicit indentation width of a block scalar; it cannot be less than one');
      } else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else {
        throwError(state, 'repeat of an indentation width identifier');
      }
    } else {
      break
    }
  }

  if (isWhiteSpace(ch)) {
    do { ch = state.input.charCodeAt(++state.position); }
    while (isWhiteSpace(ch))

    if (ch === 0x23/* # */) {
      do { ch = state.input.charCodeAt(++state.position); }
      while (!isEol(ch) && (ch !== 0))
    }
  }

  while (ch !== 0) {
    readLineBreak(state);
    state.lineIndent = 0;

    ch = state.input.charCodeAt(state.position);

    // eslint-disable-next-line no-unmodified-loop-condition
    while ((!detectedIndent || state.lineIndent < textIndent) &&
           (ch === 0x20/* Space */)) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }

    if (!detectedIndent && state.lineIndent > textIndent) {
      textIndent = state.lineIndent;
    }

    if (isEol(ch)) {
      emptyLines++;
      continue
    }

    if (!detectedIndent && textIndent === 0) {
      throwError(state, 'missing indentation for block scalar');
    }

    // End of the scalar.
    if (state.lineIndent < textIndent) {
      // Perform the chomping.
      if (chomping === CHOMPING_KEEP) {
        state.result += common$1.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
      } else if (chomping === CHOMPING_CLIP) {
        if (didReadContent) { // i.e. only if the scalar is not empty.
          state.result += '\n';
        }
      }

      // Break this `while` cycle and go to the funciton's epilogue.
      break
    }

    // Folded style: use fancy rules to handle line breaks.
    if (folding) {
      // Lines starting with white space characters (more-indented lines) are not folded.
      if (isWhiteSpace(ch)) {
        atMoreIndented = true;
        // except for the first content line (cf. Example 8.1)
        state.result += common$1.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);

      // End of more-indented block.
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common$1.repeat('\n', emptyLines + 1);

      // Just one line break - perceive as the same line.
      } else if (emptyLines === 0) {
        if (didReadContent) { // i.e. only if we have already read some scalar content.
          state.result += ' ';
        }

      // Several line breaks - perceive as different lines.
      } else {
        state.result += common$1.repeat('\n', emptyLines);
      }

    // Literal style: just add exact number of line breaks between content lines.
    } else {
      // Keep all line breaks except the header line break.
      state.result += common$1.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
    }

    didReadContent = true;
    detectedIndent = true;
    emptyLines = 0;
    const captureStart = state.position;

    while (!isEol(ch) && (ch !== 0)) {
      ch = state.input.charCodeAt(++state.position);
    }

    captureSegment(state, captureStart, state.position, false);
  }

  return true
}

function readBlockSequence (state, nodeIndent) {
  const _tag = state.tag;
  const _anchor = state.anchor;
  const _result = [];
  let detected = false;

  // there is a leading tab before this token, so it can't be a block sequence/mapping;
  // it can still be flow sequence/mapping or a scalar
  if (state.firstTabInLine !== -1) return false

  if (state.anchor !== null) {
    storeAnchor(state, state.anchor, _result);
  }

  let ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    if (state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, 'tab characters must not be used in indentation');
    }

    if (ch !== 0x2D/* - */) {
      break
    }

    const following = state.input.charCodeAt(state.position + 1);

    if (!isWsOrEol(following)) {
      break
    }

    detected = true;
    state.position++;

    if (skipSeparationSpace(state, true, -1)) {
      if (state.lineIndent <= nodeIndent) {
        _result.push(null);
        ch = state.input.charCodeAt(state.position);
        continue
      }
    }

    const _line = state.line;
    composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    _result.push(state.result);
    skipSeparationSpace(state, true, -1);

    ch = state.input.charCodeAt(state.position);

    if ((state.line === _line || state.lineIndent > nodeIndent) && (ch !== 0)) {
      throwError(state, 'bad indentation of a sequence entry');
    } else if (state.lineIndent < nodeIndent) {
      break
    }
  }

  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = 'sequence';
    state.result = _result;
    return true
  }
  return false
}

function readBlockMapping (state, nodeIndent, flowIndent) {
  let allowCompact;
  let _keyLine;
  let _keyLineStart;
  let _keyPos;
  const _tag = state.tag;
  const _anchor = state.anchor;
  const _result = {};
  const overridableKeys = Object.create(null);
  let keyTag = null;
  let keyNode = null;
  let valueNode = null;
  let atExplicitKey = false;
  let detected = false;

  // there is a leading tab before this token, so it can't be a block sequence/mapping;
  // it can still be flow sequence/mapping or a scalar
  if (state.firstTabInLine !== -1) return false

  if (state.anchor !== null) {
    storeAnchor(state, state.anchor, _result);
  }

  let ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    if (!atExplicitKey && state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, 'tab characters must not be used in indentation');
    }

    const following = state.input.charCodeAt(state.position + 1);
    const _line = state.line; // Save the current line.

    //
    // Explicit notation case. There are two separate blocks:
    // first for the key (denoted by "?") and second for the value (denoted by ":")
    //
    if ((ch === 0x3F/* ? */ || ch === 0x3A/* : */) && isWsOrEol(following)) {
      if (ch === 0x3F/* ? */) {
        if (atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }

        detected = true;
        atExplicitKey = true;
        allowCompact = true;
      } else if (atExplicitKey) {
        // i.e. 0x3A/* : */ === character after the explicit key.
        atExplicitKey = false;
        allowCompact = true;
      } else {
        throwError(state, 'incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line');
      }

      state.position += 1;
      ch = following;

    //
    // Implicit notation case. Flow-style node as the key first, then ":", and the value.
    //
    } else {
      _keyLine = state.line;
      _keyLineStart = state.lineStart;
      _keyPos = state.position;

      if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
        // Neither implicit nor explicit notation.
        // Reading is done. Go to the epilogue.
        break
      }

      if (state.line === _line) {
        ch = state.input.charCodeAt(state.position);

        while (isWhiteSpace(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }

        if (ch === 0x3A/* : */) {
          ch = state.input.charCodeAt(++state.position);

          if (!isWsOrEol(ch)) {
            throwError(state, 'a whitespace character is expected after the key-value separator within a block mapping');
          }

          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }

          detected = true;
          atExplicitKey = false;
          allowCompact = false;
          keyTag = state.tag;
          keyNode = state.result;
        } else if (detected) {
          throwError(state, 'can not read an implicit mapping pair; a colon is missed');
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true // Keep the result of `composeNode`.
        }
      } else if (detected) {
        throwError(state, 'can not read a block mapping entry; a multiline key may not be an implicit key');
      } else {
        state.tag = _tag;
        state.anchor = _anchor;
        return true // Keep the result of `composeNode`.
      }
    }

    //
    // Common reading code for both explicit and implicit notations.
    //
    if (state.line === _line || state.lineIndent > nodeIndent) {
      if (atExplicitKey) {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
      }

      if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
        if (atExplicitKey) {
          keyNode = state.result;
        } else {
          valueNode = state.result;
        }
      }

      if (!atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
        keyTag = keyNode = valueNode = null;
      }

      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
    }

    if ((state.line === _line || state.lineIndent > nodeIndent) && (ch !== 0)) {
      throwError(state, 'bad indentation of a mapping entry');
    } else if (state.lineIndent < nodeIndent) {
      break
    }
  }

  //
  // Epilogue.
  //

  // Special case: last mapping's node contains only the key in explicit notation.
  if (atExplicitKey) {
    storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
  }

  // Expose the resulting mapping.
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = 'mapping';
    state.result = _result;
  }

  return detected
}

function readTagProperty (state) {
  let isVerbatim = false;
  let isNamed = false;
  let tagHandle;
  let tagName;

  let ch = state.input.charCodeAt(state.position);

  if (ch !== 0x21/* ! */) return false

  if (state.tag !== null) {
    throwError(state, 'duplication of a tag property');
  }

  ch = state.input.charCodeAt(++state.position);

  if (ch === 0x3C/* < */) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);
  } else if (ch === 0x21/* ! */) {
    isNamed = true;
    tagHandle = '!!';
    ch = state.input.charCodeAt(++state.position);
  } else {
    tagHandle = '!';
  }

  let _position = state.position;

  if (isVerbatim) {
    do { ch = state.input.charCodeAt(++state.position); }
    while (ch !== 0 && ch !== 0x3E/* > */)

    if (state.position < state.length) {
      tagName = state.input.slice(_position, state.position);
      ch = state.input.charCodeAt(++state.position);
    } else {
      throwError(state, 'unexpected end of the stream within a verbatim tag');
    }
  } else {
    while (ch !== 0 && !isWsOrEol(ch)) {
      if (ch === 0x21/* ! */) {
        if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);

          if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
            throwError(state, 'named tag handle cannot contain such characters');
          }

          isNamed = true;
          _position = state.position + 1;
        } else {
          throwError(state, 'tag suffix cannot contain exclamation marks');
        }
      }

      ch = state.input.charCodeAt(++state.position);
    }

    tagName = state.input.slice(_position, state.position);

    if (PATTERN_FLOW_INDICATORS.test(tagName)) {
      throwError(state, 'tag suffix cannot contain flow indicator characters');
    }
  }

  if (tagName && !PATTERN_TAG_URI.test(tagName)) {
    throwError(state, 'tag name cannot contain such characters: ' + tagName);
  }

  try {
    tagName = decodeURIComponent(tagName);
  } catch (err) {
    throwError(state, 'tag name is malformed: ' + tagName);
  }

  if (isVerbatim) {
    state.tag = tagName;
  } else if (_hasOwnProperty$1.call(state.tagMap, tagHandle)) {
    state.tag = state.tagMap[tagHandle] + tagName;
  } else if (tagHandle === '!') {
    state.tag = '!' + tagName;
  } else if (tagHandle === '!!') {
    state.tag = 'tag:yaml.org,2002:' + tagName;
  } else {
    throwError(state, 'undeclared tag handle "' + tagHandle + '"');
  }

  return true
}

function readAnchorProperty (state) {
  let ch = state.input.charCodeAt(state.position);

  if (ch !== 0x26/* & */) return false

  if (state.anchor !== null) {
    throwError(state, 'duplication of an anchor property');
  }

  ch = state.input.charCodeAt(++state.position);
  const _position = state.position;

  while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }

  if (state.position === _position) {
    throwError(state, 'name of an anchor node must contain at least one character');
  }

  state.anchor = state.input.slice(_position, state.position);
  return true
}

function readAlias (state) {
  let ch = state.input.charCodeAt(state.position);

  if (ch !== 0x2A/* * */) return false

  ch = state.input.charCodeAt(++state.position);
  const _position = state.position;

  while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }

  if (state.position === _position) {
    throwError(state, 'name of an alias node must contain at least one character');
  }

  const alias = state.input.slice(_position, state.position);

  if (!_hasOwnProperty$1.call(state.anchorMap, alias)) {
    throwError(state, 'unidentified alias "' + alias + '"');
  }

  state.result = state.anchorMap[alias];
  skipSeparationSpace(state, true, -1);
  return true
}

function tryReadBlockMappingFromProperty (state, propertyStart, nodeIndent, flowIndent) {
  const fallbackState = snapshotState(state);

  beginAnchorTransaction(state);
  restoreState(state, propertyStart);

  // Re-read the leading properties as part of the first implicit key, not as
  // properties of the current node.
  state.tag = null;
  state.anchor = null;
  state.kind = null;
  state.result = null;

  if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === 'mapping') {
    commitAnchorTransaction(state);
    return true
  }

  rollbackAnchorTransaction(state);
  restoreState(state, fallbackState);
  return false
}

function composeNode (state, parentIndent, nodeContext, allowToSeek, allowCompact) {
  let allowBlockScalars;
  let allowBlockCollections;
  let indentStatus = 1; // 1: this>parent, 0: this=parent, -1: this<parent
  let atNewLine = false;
  let hasContent = false;
  let propertyStart = null;
  let type;
  let flowIndent;
  let blockIndent;

  if (state.depth >= state.maxDepth) {
    throwError(state, 'nesting exceeded maxDepth (' + state.maxDepth + ')');
  }

  state.depth += 1;

  if (state.listener !== null) {
    state.listener('open', state);
  }

  state.tag = null;
  state.anchor = null;
  state.kind = null;
  state.result = null;

  const allowBlockStyles = allowBlockScalars = allowBlockCollections =
    CONTEXT_BLOCK_OUT === nodeContext ||
    CONTEXT_BLOCK_IN === nodeContext;

  if (allowToSeek) {
    if (skipSeparationSpace(state, true, -1)) {
      atNewLine = true;

      if (state.lineIndent > parentIndent) {
        indentStatus = 1;
      } else if (state.lineIndent === parentIndent) {
        indentStatus = 0;
      } else if (state.lineIndent < parentIndent) {
        indentStatus = -1;
      }
    }
  }

  if (indentStatus === 1) {
    while (true) {
      const ch = state.input.charCodeAt(state.position);
      const propertyState = snapshotState(state);

      // A duplicate property token after a line break can be the first key of
      // a nested block mapping, e.g. `!!map\n  !!str key: value`.
      if (atNewLine &&
          ((ch === 0x21/* ! */ && state.tag !== null) ||
           (ch === 0x26/* & */ && state.anchor !== null))) {
        break
      }

      if (!readTagProperty(state) && !readAnchorProperty(state)) {
        break
      }

      if (propertyStart === null) {
        propertyStart = propertyState;
      }

      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;

        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      } else {
        allowBlockCollections = false;
      }
    }
  }

  if (allowBlockCollections) {
    allowBlockCollections = atNewLine || allowCompact;
  }

  if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
    if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
      flowIndent = parentIndent;
    } else {
      flowIndent = parentIndent + 1;
    }

    blockIndent = state.position - state.lineStart;

    if (indentStatus === 1) {
      if ((allowBlockCollections &&
          (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent))) ||
          readFlowCollection(state, flowIndent)) {
        hasContent = true;
      } else {
        const ch = state.input.charCodeAt(state.position);

        if (propertyStart !== null && allowBlockStyles && !allowBlockCollections &&
            ch !== 0x7C/* | */ && ch !== 0x3E/* > */ &&
            tryReadBlockMappingFromProperty(
              state,
              propertyStart,
              propertyStart.position - propertyStart.lineStart,
              flowIndent
            )) {
          hasContent = true;
        } else if ((allowBlockScalars && readBlockScalar(state, flowIndent)) ||
            readSingleQuotedScalar(state, flowIndent) ||
            readDoubleQuotedScalar(state, flowIndent)) {
          hasContent = true;
        } else if (readAlias(state)) {
          hasContent = true;

          if (state.tag !== null || state.anchor !== null) {
            throwError(state, 'alias node should not have any properties');
          }
        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;

          if (state.tag === null) {
            state.tag = '?';
          }
        }

        if (state.anchor !== null) {
          storeAnchor(state, state.anchor, state.result);
        }
      }
    } else if (indentStatus === 0) {
      // Special case: block sequences are allowed to have same indentation level as the parent.
      // http://www.yaml.org/spec/1.2/spec.html#id2799784
      hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
  }

  if (state.tag === null) {
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, state.result);
    }
  } else if (state.tag === '?') {
    // Implicit resolving is not allowed for non-scalar types, and '?'
    // non-specific tag is only automatically assigned to plain scalars.
    //
    // We only need to check kind conformity in case user explicitly assigns '?'
    // tag, for example like this: "!<?> [0]"
    //
    if (state.result !== null && state.kind !== 'scalar') {
      throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
    }

    for (let typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
      type = state.implicitTypes[typeIndex];

      if (type.resolve(state.result)) { // `state.result` updated in resolver if matched
        state.result = type.construct(state.result);
        state.tag = type.tag;
        if (state.anchor !== null) {
          storeAnchor(state, state.anchor, state.result);
        }
        break
      }
    }
  } else if (state.tag !== '!') {
    if (_hasOwnProperty$1.call(state.typeMap[state.kind || 'fallback'], state.tag)) {
      type = state.typeMap[state.kind || 'fallback'][state.tag];
    } else {
      // looking for multi type
      type = null;
      const typeList = state.typeMap.multi[state.kind || 'fallback'];

      for (let typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
        if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
          type = typeList[typeIndex];
          break
        }
      }
    }

    if (!type) {
      throwError(state, 'unknown tag !<' + state.tag + '>');
    }

    if (state.result !== null && type.kind !== state.kind) {
      throwError(state, 'unacceptable node kind for !<' + state.tag + '> tag; it should be "' + type.kind + '", not "' + state.kind + '"');
    }

    if (!type.resolve(state.result, state.tag)) { // `state.result` updated in resolver if matched
      throwError(state, 'cannot resolve a node with !<' + state.tag + '> explicit tag');
    } else {
      state.result = type.construct(state.result, state.tag);
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, state.result);
      }
    }
  }

  if (state.listener !== null) {
    state.listener('close', state);
  }

  state.depth -= 1;
  return state.tag !== null || state.anchor !== null || hasContent
}

function readDocument (state) {
  const documentStart = state.position;
  let hasDirectives = false;
  let ch;

  state.version = null;
  state.checkLineBreaks = state.legacy;
  state.tagMap = Object.create(null);
  state.anchorMap = Object.create(null);

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    skipSeparationSpace(state, true, -1);

    ch = state.input.charCodeAt(state.position);

    if (state.lineIndent > 0 || ch !== 0x25/* % */) {
      break
    }

    hasDirectives = true;
    ch = state.input.charCodeAt(++state.position);
    let _position = state.position;

    while (ch !== 0 && !isWsOrEol(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }

    const directiveName = state.input.slice(_position, state.position);
    const directiveArgs = [];

    if (directiveName.length < 1) {
      throwError(state, 'directive name must not be less than one character in length');
    }

    while (ch !== 0) {
      while (isWhiteSpace(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }

      if (ch === 0x23/* # */) {
        do { ch = state.input.charCodeAt(++state.position); }
        while (ch !== 0 && !isEol(ch))
        break
      }

      if (isEol(ch)) break

      _position = state.position;

      while (ch !== 0 && !isWsOrEol(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }

      directiveArgs.push(state.input.slice(_position, state.position));
    }

    if (ch !== 0) readLineBreak(state);

    if (_hasOwnProperty$1.call(directiveHandlers, directiveName)) {
      directiveHandlers[directiveName](state, directiveName, directiveArgs);
    } else {
      throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
  }

  skipSeparationSpace(state, true, -1);

  if (state.lineIndent === 0 &&
      state.input.charCodeAt(state.position) === 0x2D/* - */ &&
      state.input.charCodeAt(state.position + 1) === 0x2D/* - */ &&
      state.input.charCodeAt(state.position + 2) === 0x2D/* - */) {
    state.position += 3;
    skipSeparationSpace(state, true, -1);
  } else if (hasDirectives) {
    throwError(state, 'directives end mark is expected');
  }

  composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
  skipSeparationSpace(state, true, -1);

  if (state.checkLineBreaks &&
      PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
    throwWarning(state, 'non-ASCII line breaks are interpreted as content');
  }

  state.documents.push(state.result);

  if (state.position === state.lineStart && testDocumentSeparator(state)) {
    if (state.input.charCodeAt(state.position) === 0x2E/* . */) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    }
    return
  }

  if (state.position < (state.length - 1)) {
    throwError(state, 'end of the stream or a document separator is expected');
  }
}

function loadDocuments (input, options) {
  input = String(input);
  options = options || {};

  if (input.length !== 0) {
    // Add tailing `\n` if not exists
    if (input.charCodeAt(input.length - 1) !== 0x0A/* LF */ &&
        input.charCodeAt(input.length - 1) !== 0x0D/* CR */) {
      input += '\n';
    }

    // Strip BOM
    if (input.charCodeAt(0) === 0xFEFF) {
      input = input.slice(1);
    }
  }

  const state = new State$1(input, options);

  const nullpos = input.indexOf('\0');

  if (nullpos !== -1) {
    state.position = nullpos;
    throwError(state, 'null byte is not allowed in input');
  }

  // Use 0 as string terminator. That significantly simplifies bounds check.
  state.input += '\0';

  while (state.input.charCodeAt(state.position) === 0x20/* Space */) {
    state.lineIndent += 1;
    state.position += 1;
  }

  while (state.position < (state.length - 1)) {
    readDocument(state);
  }

  return state.documents
}

function loadAll (input, iterator, options) {
  if (iterator !== null && typeof iterator === 'object' && typeof options === 'undefined') {
    options = iterator;
    iterator = null;
  }

  const documents = loadDocuments(input, options);

  if (typeof iterator !== 'function') {
    return documents
  }

  for (let index = 0, length = documents.length; index < length; index += 1) {
    iterator(documents[index]);
  }
}

function load (input, options) {
  const documents = loadDocuments(input, options);

  if (documents.length === 0) {
    return undefined
  } else if (documents.length === 1) {
    return documents[0]
  }
  throw new YAMLException$1('expected a single document in the stream, but found more')
}

loader$1.loadAll = loadAll;
loader$1.load = load;

var dumper$1 = {};

const common = common$5;
const YAMLException = exception;
const DEFAULT_SCHEMA = _default;

const _toString = Object.prototype.toString;
const _hasOwnProperty = Object.prototype.hasOwnProperty;

const CHAR_BOM = 0xFEFF;
const CHAR_TAB = 0x09; /* Tab */
const CHAR_LINE_FEED = 0x0A; /* LF */
const CHAR_CARRIAGE_RETURN = 0x0D; /* CR */
const CHAR_SPACE = 0x20; /* Space */
const CHAR_EXCLAMATION = 0x21; /* ! */
const CHAR_DOUBLE_QUOTE = 0x22; /* " */
const CHAR_SHARP = 0x23; /* # */
const CHAR_PERCENT = 0x25; /* % */
const CHAR_AMPERSAND = 0x26; /* & */
const CHAR_SINGLE_QUOTE = 0x27; /* ' */
const CHAR_ASTERISK = 0x2A; /* * */
const CHAR_COMMA = 0x2C; /* , */
const CHAR_MINUS = 0x2D; /* - */
const CHAR_COLON = 0x3A; /* : */
const CHAR_EQUALS = 0x3D; /* = */
const CHAR_GREATER_THAN = 0x3E; /* > */
const CHAR_QUESTION = 0x3F; /* ? */
const CHAR_COMMERCIAL_AT = 0x40; /* @ */
const CHAR_LEFT_SQUARE_BRACKET = 0x5B; /* [ */
const CHAR_RIGHT_SQUARE_BRACKET = 0x5D; /* ] */
const CHAR_GRAVE_ACCENT = 0x60; /* ` */
const CHAR_LEFT_CURLY_BRACKET = 0x7B; /* { */
const CHAR_VERTICAL_LINE = 0x7C; /* | */
const CHAR_RIGHT_CURLY_BRACKET = 0x7D; /* } */

const ESCAPE_SEQUENCES = {};

ESCAPE_SEQUENCES[0x00] = '\\0';
ESCAPE_SEQUENCES[0x07] = '\\a';
ESCAPE_SEQUENCES[0x08] = '\\b';
ESCAPE_SEQUENCES[0x09] = '\\t';
ESCAPE_SEQUENCES[0x0A] = '\\n';
ESCAPE_SEQUENCES[0x0B] = '\\v';
ESCAPE_SEQUENCES[0x0C] = '\\f';
ESCAPE_SEQUENCES[0x0D] = '\\r';
ESCAPE_SEQUENCES[0x1B] = '\\e';
ESCAPE_SEQUENCES[0x22] = '\\"';
ESCAPE_SEQUENCES[0x5C] = '\\\\';
ESCAPE_SEQUENCES[0x85] = '\\N';
ESCAPE_SEQUENCES[0xA0] = '\\_';
ESCAPE_SEQUENCES[0x2028] = '\\L';
ESCAPE_SEQUENCES[0x2029] = '\\P';

const DEPRECATED_BOOLEANS_SYNTAX = [
  'y', 'Y', 'yes', 'Yes', 'YES', 'on', 'On', 'ON',
  'n', 'N', 'no', 'No', 'NO', 'off', 'Off', 'OFF'
];

const DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;

function compileStyleMap (schema, map) {
  if (map === null) return {}

  const result = {};
  const keys = Object.keys(map);

  for (let index = 0, length = keys.length; index < length; index += 1) {
    let tag = keys[index];
    let style = String(map[tag]);

    if (tag.slice(0, 2) === '!!') {
      tag = 'tag:yaml.org,2002:' + tag.slice(2);
    }
    const type = schema.compiledTypeMap['fallback'][tag];

    if (type && _hasOwnProperty.call(type.styleAliases, style)) {
      style = type.styleAliases[style];
    }

    result[tag] = style;
  }

  return result
}

function encodeHex (character) {
  let handle;
  let length;

  const string = character.toString(16).toUpperCase();

  if (character <= 0xFF) {
    handle = 'x';
    length = 2;
  } else if (character <= 0xFFFF) {
    handle = 'u';
    length = 4;
  } else if (character <= 0xFFFFFFFF) {
    handle = 'U';
    length = 8;
  } else {
    throw new YAMLException('code point within a string may not be greater than 0xFFFFFFFF')
  }

  return '\\' + handle + common.repeat('0', length - string.length) + string
}

const QUOTING_TYPE_SINGLE = 1;
const QUOTING_TYPE_DOUBLE = 2;

function State (options) {
  this.schema = options['schema'] || DEFAULT_SCHEMA;
  this.indent = Math.max(1, (options['indent'] || 2));
  this.noArrayIndent = options['noArrayIndent'] || false;
  this.skipInvalid = options['skipInvalid'] || false;
  this.flowLevel = (common.isNothing(options['flowLevel']) ? -1 : options['flowLevel']);
  this.styleMap = compileStyleMap(this.schema, options['styles'] || null);
  this.sortKeys = options['sortKeys'] || false;
  this.lineWidth = options['lineWidth'] || 80;
  this.noRefs = options['noRefs'] || false;
  this.noCompatMode = options['noCompatMode'] || false;
  this.condenseFlow = options['condenseFlow'] || false;
  this.quotingType = options['quotingType'] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
  this.forceQuotes = options['forceQuotes'] || false;
  this.replacer = typeof options['replacer'] === 'function' ? options['replacer'] : null;

  this.implicitTypes = this.schema.compiledImplicit;
  this.explicitTypes = this.schema.compiledExplicit;

  this.tag = null;
  this.result = '';

  this.duplicates = [];
  this.usedDuplicates = null;
}

// Indents every line in a string. Empty lines (\n only) are not indented.
function indentString (string, spaces) {
  const ind = common.repeat(' ', spaces);
  let position = 0;
  let result = '';
  const length = string.length;

  while (position < length) {
    let line;
    const next = string.indexOf('\n', position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }

    if (line.length && line !== '\n') result += ind;

    result += line;
  }

  return result
}

function generateNextLine (state, level) {
  return '\n' + common.repeat(' ', state.indent * level)
}

function testImplicitResolving (state, str) {
  for (let index = 0, length = state.implicitTypes.length; index < length; index += 1) {
    const type = state.implicitTypes[index];

    if (type.resolve(str)) {
      return true
    }
  }

  return false
}

// [33] s-white ::= s-space | s-tab
function isWhitespace (c) {
  return c === CHAR_SPACE || c === CHAR_TAB
}

// Returns true if the character can be printed without escaping.
// From YAML 1.2: "any allowed characters known to be non-printable
// should also be escaped. [However,] This isn’t mandatory"
// Derived from nb-char - \t - #x85 - #xA0 - #x2028 - #x2029.
function isPrintable (c) {
  return (c >= 0x00020 && c <= 0x00007E) ||
    ((c >= 0x000A1 && c <= 0x00D7FF) && c !== 0x2028 && c !== 0x2029) ||
    ((c >= 0x0E000 && c <= 0x00FFFD) && c !== CHAR_BOM) ||
    (c >= 0x10000 && c <= 0x10FFFF)
}

// [34] ns-char ::= nb-char - s-white
// [27] nb-char ::= c-printable - b-char - c-byte-order-mark
// [26] b-char  ::= b-line-feed | b-carriage-return
// Including s-white (for some reason, examples doesn't match specs in this aspect)
// ns-char ::= c-printable - b-line-feed - b-carriage-return - c-byte-order-mark
function isNsCharOrWhitespace (c) {
  return isPrintable(c) &&
    c !== CHAR_BOM &&
    // - b-char
    c !== CHAR_CARRIAGE_RETURN &&
    c !== CHAR_LINE_FEED
}

// [127]  ns-plain-safe(c) ::= c = flow-out  ⇒ ns-plain-safe-out
//                             c = flow-in   ⇒ ns-plain-safe-in
//                             c = block-key ⇒ ns-plain-safe-out
//                             c = flow-key  ⇒ ns-plain-safe-in
// [128] ns-plain-safe-out ::= ns-char
// [129]  ns-plain-safe-in ::= ns-char - c-flow-indicator
// [130]  ns-plain-char(c) ::=  ( ns-plain-safe(c) - “:” - “#” )
//                            | ( /* An ns-char preceding */ “#” )
//                            | ( “:” /* Followed by an ns-plain-safe(c) */ )
function isPlainSafe (c, prev, inblock) {
  const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
  const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
  return (
    (
      // ns-plain-safe
      inblock // c = flow-in
        ? cIsNsCharOrWhitespace
        : cIsNsCharOrWhitespace &&
          // - c-flow-indicator
          c !== CHAR_COMMA &&
          c !== CHAR_LEFT_SQUARE_BRACKET &&
          c !== CHAR_RIGHT_SQUARE_BRACKET &&
          c !== CHAR_LEFT_CURLY_BRACKET &&
          c !== CHAR_RIGHT_CURLY_BRACKET
    ) &&
    // ns-plain-char
    c !== CHAR_SHARP && // false on '#'
    !(prev === CHAR_COLON && !cIsNsChar)
  ) || // false on ': '
  (isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP) || // change to true on '[^ ]#'
  (prev === CHAR_COLON && cIsNsChar) // change to true on ':[^ ]'
}

// Simplified test for values allowed as the first character in plain style.
function isPlainSafeFirst (c) {
  // Uses a subset of ns-char - c-indicator
  // where ns-char = nb-char - s-white.
  // No support of ( ( “?” | “:” | “-” ) /* Followed by an ns-plain-safe(c)) */ ) part
  return isPrintable(c) &&
    c !== CHAR_BOM &&
    !isWhitespace(c) && // - s-white
    // - (c-indicator ::=
    // “-” | “?” | “:” | “,” | “[” | “]” | “{” | “}”
    c !== CHAR_MINUS &&
    c !== CHAR_QUESTION &&
    c !== CHAR_COLON &&
    c !== CHAR_COMMA &&
    c !== CHAR_LEFT_SQUARE_BRACKET &&
    c !== CHAR_RIGHT_SQUARE_BRACKET &&
    c !== CHAR_LEFT_CURLY_BRACKET &&
    c !== CHAR_RIGHT_CURLY_BRACKET &&
    // | “#” | “&” | “*” | “!” | “|” | “=” | “>” | “'” | “"”
    c !== CHAR_SHARP &&
    c !== CHAR_AMPERSAND &&
    c !== CHAR_ASTERISK &&
    c !== CHAR_EXCLAMATION &&
    c !== CHAR_VERTICAL_LINE &&
    c !== CHAR_EQUALS &&
    c !== CHAR_GREATER_THAN &&
    c !== CHAR_SINGLE_QUOTE &&
    c !== CHAR_DOUBLE_QUOTE &&
    // | “%” | “@” | “`”)
    c !== CHAR_PERCENT &&
    c !== CHAR_COMMERCIAL_AT &&
    c !== CHAR_GRAVE_ACCENT
}

// Simplified test for values allowed as the last character in plain style.
function isPlainSafeLast (c) {
  // just not whitespace or colon, it will be checked to be plain character later
  return !isWhitespace(c) && c !== CHAR_COLON
}

// Same as 'string'.codePointAt(pos), but works in older browsers.
function codePointAt (string, pos) {
  const first = string.charCodeAt(pos);
  let second;

  if (first >= 0xD800 && first <= 0xDBFF && pos + 1 < string.length) {
    second = string.charCodeAt(pos + 1);
    if (second >= 0xDC00 && second <= 0xDFFF) {
      // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000
    }
  }
  return first
}

// Determines whether block indentation indicator is required.
function needIndentIndicator (string) {
  const leadingSpaceRe = /^\n* /;
  return leadingSpaceRe.test(string)
}

const STYLE_PLAIN = 1;
const STYLE_SINGLE = 2;
const STYLE_LITERAL = 3;
const STYLE_FOLDED = 4;
const STYLE_DOUBLE = 5;

// Determines which scalar styles are possible and returns the preferred style.
// lineWidth = -1 => no limit.
// Pre-conditions: str.length > 0.
// Post-conditions:
//    STYLE_PLAIN or STYLE_SINGLE => no \n are in the string.
//    STYLE_LITERAL => no lines are suitable for folding (or lineWidth is -1).
//    STYLE_FOLDED => a line > lineWidth and can be folded (and lineWidth != -1).
function chooseScalarStyle (string, singleLineOnly, indentPerLevel, lineWidth,
  testAmbiguousType, quotingType, forceQuotes, inblock) {
  let i;
  let char = 0;
  let prevChar = null;
  let hasLineBreak = false;
  let hasFoldableLine = false; // only checked if shouldTrackWidth
  const shouldTrackWidth = lineWidth !== -1;
  let previousLineBreak = -1; // count the first line correctly
  let plain = isPlainSafeFirst(codePointAt(string, 0)) &&
    isPlainSafeLast(codePointAt(string, string.length - 1));

  if (singleLineOnly || forceQuotes) {
    // Case: no block styles.
    // Check for disallowed characters to rule out plain and single.
    for (i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (!isPrintable(char)) {
        return STYLE_DOUBLE
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
  } else {
    // Case: block styles permitted.
    for (i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (char === CHAR_LINE_FEED) {
        hasLineBreak = true;
        // Check if any line can be folded.
        if (shouldTrackWidth) {
          hasFoldableLine = hasFoldableLine ||
            // Foldable line = too long, and not more-indented.
            (i - previousLineBreak - 1 > lineWidth &&
             string[previousLineBreak + 1] !== ' ');
          previousLineBreak = i;
        }
      } else if (!isPrintable(char)) {
        return STYLE_DOUBLE
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
    // in case the end is missing a \n
    hasFoldableLine = hasFoldableLine || (shouldTrackWidth &&
      (i - previousLineBreak - 1 > lineWidth &&
       string[previousLineBreak + 1] !== ' '));
  }
  // Although every style can represent \n without escaping, prefer block styles
  // for multiline, since they're more readable and they don't add empty lines.
  // Also prefer folding a super-long line.
  if (!hasLineBreak && !hasFoldableLine) {
    // Strings interpretable as another type have to be quoted;
    // e.g. the string 'true' vs. the boolean true.
    if (plain && !forceQuotes && !testAmbiguousType(string)) {
      return STYLE_PLAIN
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE
  }
  // Edge case: block indentation indicator can only have one digit.
  if (indentPerLevel > 9 && needIndentIndicator(string)) {
    return STYLE_DOUBLE
  }
  // At this point we know block styles are valid.
  // Prefer literal style unless we want to fold.
  if (!forceQuotes) {
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL
  }
  return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE
}

// Note: line breaking/folding is implemented for only the folded style.
// NB. We drop the last trailing newline (if any) of a returned block scalar
//  since the dumper adds its own newline. This always works:
//    • No ending newline => unaffected; already using strip "-" chomping.
//    • Ending newline    => removed then restored.
//  Importantly, this keeps the "+" chomp indicator from gaining an extra line.
function writeScalar (state, string, level, iskey, inblock) {
  state.dump = (function () {
    if (string.length === 0) {
      return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''"
    }
    if (!state.noCompatMode) {
      if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? ('"' + string + '"') : ("'" + string + "'")
      }
    }

    const indent = state.indent * Math.max(1, level); // no 0-indent scalars
    // As indentation gets deeper, let the width decrease monotonically
    // to the lower bound min(state.lineWidth, 40).
    // Note that this implies
    //  state.lineWidth ≤ 40 + state.indent: width is fixed at the lower bound.
    //  state.lineWidth > 40 + state.indent: width decreases until the lower bound.
    // This behaves better than a constant minimum width which disallows narrower options,
    // or an indent threshold which causes the width to suddenly increase.
    const lineWidth = (state.lineWidth === -1)
      ? -1
      : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);

    // Without knowing if keys are implicit/explicit, assume implicit for safety.
    const singleLineOnly = iskey ||
      // No block styles in flow mode.
      (state.flowLevel > -1 && level >= state.flowLevel);
    function testAmbiguity (string) {
      return testImplicitResolving(state, string)
    }

    switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth,
      testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {
      case STYLE_PLAIN:
        return string
      case STYLE_SINGLE:
        return "'" + string.replace(/'/g, "''") + "'"
      case STYLE_LITERAL:
        return '|' + blockHeader(string, state.indent) +
          dropEndingNewline(indentString(string, indent))
      case STYLE_FOLDED:
        return '>' + blockHeader(string, state.indent) +
          dropEndingNewline(indentString(foldString(string, lineWidth), indent))
      case STYLE_DOUBLE:
        return '"' + escapeString(string) + '"'
      default:
        throw new YAMLException('impossible error: invalid scalar style')
    }
  }());
}

// Pre-conditions: string is valid for a block scalar, 1 <= indentPerLevel <= 9.
function blockHeader (string, indentPerLevel) {
  const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : '';

  // note the special case: the string '\n' counts as a "trailing" empty line.
  const clip = string[string.length - 1] === '\n';
  const keep = clip && (string[string.length - 2] === '\n' || string === '\n');
  const chomp = keep ? '+' : (clip ? '' : '-');

  return indentIndicator + chomp + '\n'
}

// (See the note for writeScalar.)
function dropEndingNewline (string) {
  return string[string.length - 1] === '\n' ? string.slice(0, -1) : string
}

// Note: a long line without a suitable break point will exceed the width limit.
// Pre-conditions: every char in str isPrintable, str.length > 0, width > 0.
function foldString (string, width) {
  // In folded style, $k$ consecutive newlines output as $k+1$ newlines—
  // unless they're before or after a more-indented line, or at the very
  // beginning or end, in which case $k$ maps to $k$.
  // Therefore, parse each chunk as newline(s) followed by a content line.
  const lineRe = /(\n+)([^\n]*)/g;

  // first line (possibly an empty line)
  let result = (function () {
    let nextLF = string.indexOf('\n');
    nextLF = nextLF !== -1 ? nextLF : string.length;
    lineRe.lastIndex = nextLF;
    return foldLine(string.slice(0, nextLF), width)
  }());
  // If we haven't reached the first content line yet, don't add an extra \n.
  let prevMoreIndented = string[0] === '\n' || string[0] === ' ';
  let moreIndented;

  // rest of the lines
  let match;
  while ((match = lineRe.exec(string))) {
    const prefix = match[1];
    const line = match[2];

    moreIndented = (line[0] === ' ');
    result += prefix +
      ((!prevMoreIndented && !moreIndented && line !== '') ? '\n' : '') +
      foldLine(line, width);
    prevMoreIndented = moreIndented;
  }

  return result
}

// Greedy line breaking.
// Picks the longest line under the limit each time,
// otherwise settles for the shortest line over the limit.
// NB. More-indented lines *cannot* be folded, as that would add an extra \n.
function foldLine (line, width) {
  if (line === '' || line[0] === ' ') return line

  // Since a more-indented line adds a \n, breaks can't be followed by a space.
  const breakRe = / [^ ]/g; // note: the match index will always be <= length-2.
  let match;
  // start is an inclusive index. end, curr, and next are exclusive.
  let start = 0;
  let end;
  let curr = 0;
  let next = 0;
  let result = '';

  // Invariants: 0 <= start <= length-1.
  //   0 <= curr <= next <= max(0, length-2). curr - start <= width.
  // Inside the loop:
  //   A match implies length >= 2, so curr and next are <= length-2.
  while ((match = breakRe.exec(line))) {
    next = match.index;
    // maintain invariant: curr - start <= width
    if (next - start > width) {
      end = (curr > start) ? curr : next; // derive end <= length-2
      result += '\n' + line.slice(start, end);
      // skip the space that was output as \n
      start = end + 1;                    // derive start <= length-1
    }
    curr = next;
  }

  // By the invariants, start <= length-1, so there is something left over.
  // It is either the whole string or a part starting from non-whitespace.
  result += '\n';
  // Insert a break if the remainder is too long and there is a break available.
  if (line.length - start > width && curr > start) {
    result += line.slice(start, curr) + '\n' + line.slice(curr + 1);
  } else {
    result += line.slice(start);
  }

  return result.slice(1) // drop extra \n joiner
}

// Escapes a double-quoted string.
function escapeString (string) {
  let result = '';
  let char = 0;

  for (let i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
    char = codePointAt(string, i);
    const escapeSeq = ESCAPE_SEQUENCES[char];

    if (!escapeSeq && isPrintable(char)) {
      result += string[i];
      if (char >= 0x10000) result += string[i + 1];
    } else {
      result += escapeSeq || encodeHex(char);
    }
  }

  return result
}

function writeFlowSequence (state, level, object) {
  let _result = '';
  const _tag = state.tag;

  for (let index = 0, length = object.length; index < length; index += 1) {
    let value = object[index];

    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }

    // Write only valid elements, put null instead of invalid elements.
    if (writeNode(state, level, value, false, false) ||
        (typeof value === 'undefined' &&
         writeNode(state, level, null, false, false))) {
      if (_result !== '') _result += ',' + (!state.condenseFlow ? ' ' : '');
      _result += state.dump;
    }
  }

  state.tag = _tag;
  state.dump = '[' + _result + ']';
}

function writeBlockSequence (state, level, object, compact) {
  let _result = '';
  const _tag = state.tag;

  for (let index = 0, length = object.length; index < length; index += 1) {
    let value = object[index];

    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }

    // Write only valid elements, put null instead of invalid elements.
    if (writeNode(state, level + 1, value, true, true, false, true) ||
        (typeof value === 'undefined' &&
         writeNode(state, level + 1, null, true, true, false, true))) {
      if (!compact || _result !== '') {
        _result += generateNextLine(state, level);
      }

      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        _result += '-';
      } else {
        _result += '- ';
      }

      _result += state.dump;
    }
  }

  state.tag = _tag;
  state.dump = _result || '[]'; // Empty sequence if no valid values.
}

function writeFlowMapping (state, level, object) {
  let _result = '';
  const _tag = state.tag;
  const objectKeyList = Object.keys(object);

  for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
    let pairBuffer = '';
    if (_result !== '') pairBuffer += ', ';

    if (state.condenseFlow) pairBuffer += '"';

    const objectKey = objectKeyList[index];
    let objectValue = object[objectKey];

    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }

    if (!writeNode(state, level, objectKey, false, false)) {
      continue // Skip this pair because of invalid key;
    }

    if (state.dump.length > 1024) pairBuffer += '? ';

    pairBuffer += state.dump + (state.condenseFlow ? '"' : '') + ':' + (state.condenseFlow ? '' : ' ');

    if (!writeNode(state, level, objectValue, false, false)) {
      continue // Skip this pair because of invalid value.
    }

    pairBuffer += state.dump;

    // Both key and value are valid.
    _result += pairBuffer;
  }

  state.tag = _tag;
  state.dump = '{' + _result + '}';
}

function writeBlockMapping (state, level, object, compact) {
  let _result = '';
  const _tag = state.tag;
  const objectKeyList = Object.keys(object);

  // Allow sorting keys so that the output file is deterministic
  if (state.sortKeys === true) {
    // Default sorting
    objectKeyList.sort();
  } else if (typeof state.sortKeys === 'function') {
    // Custom sort function
    objectKeyList.sort(state.sortKeys);
  } else if (state.sortKeys) {
    // Something is wrong
    throw new YAMLException('sortKeys must be a boolean or a function')
  }

  for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
    let pairBuffer = '';

    if (!compact || _result !== '') {
      pairBuffer += generateNextLine(state, level);
    }

    const objectKey = objectKeyList[index];
    let objectValue = object[objectKey];

    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }

    if (!writeNode(state, level + 1, objectKey, true, true, true)) {
      continue // Skip this pair because of invalid key.
    }

    const explicitPair = (state.tag !== null && state.tag !== '?') ||
                   (state.dump && state.dump.length > 1024);

    if (explicitPair) {
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += '?';
      } else {
        pairBuffer += '? ';
      }
    }

    pairBuffer += state.dump;

    if (explicitPair) {
      pairBuffer += generateNextLine(state, level);
    }

    if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
      continue // Skip this pair because of invalid value.
    }

    if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
      pairBuffer += ':';
    } else {
      pairBuffer += ': ';
    }

    pairBuffer += state.dump;

    // Both key and value are valid.
    _result += pairBuffer;
  }

  state.tag = _tag;
  state.dump = _result || '{}'; // Empty mapping if no valid pairs.
}

function detectType (state, object, explicit) {
  const typeList = explicit ? state.explicitTypes : state.implicitTypes;

  for (let index = 0, length = typeList.length; index < length; index += 1) {
    const type = typeList[index];

    if ((type.instanceOf || type.predicate) &&
        (!type.instanceOf || ((typeof object === 'object') && (object instanceof type.instanceOf))) &&
        (!type.predicate || type.predicate(object))) {
      if (explicit) {
        if (type.multi && type.representName) {
          state.tag = type.representName(object);
        } else {
          state.tag = type.tag;
        }
      } else {
        state.tag = '?';
      }

      if (type.represent) {
        const style = state.styleMap[type.tag] || type.defaultStyle;

        let _result;
        if (_toString.call(type.represent) === '[object Function]') {
          _result = type.represent(object, style);
        } else if (_hasOwnProperty.call(type.represent, style)) {
          _result = type.represent[style](object, style);
        } else {
          throw new YAMLException('!<' + type.tag + '> tag resolver accepts not "' + style + '" style')
        }

        state.dump = _result;
      }

      return true
    }
  }

  return false
}

// Serializes `object` and writes it to global `result`.
// Returns true on success, or false on invalid object.
//
function writeNode (state, level, object, block, compact, iskey, isblockseq) {
  state.tag = null;
  state.dump = object;

  if (!detectType(state, object, false)) {
    detectType(state, object, true);
  }

  const type = _toString.call(state.dump);
  const inblock = block;

  if (block) {
    block = (state.flowLevel < 0 || state.flowLevel > level);
  }

  const objectOrArray = type === '[object Object]' || type === '[object Array]';
  let duplicateIndex;
  let duplicate;

  if (objectOrArray) {
    duplicateIndex = state.duplicates.indexOf(object);
    duplicate = duplicateIndex !== -1;
  }

  if ((state.tag !== null && state.tag !== '?') || duplicate || (state.indent !== 2 && level > 0)) {
    compact = false;
  }

  if (duplicate && state.usedDuplicates[duplicateIndex]) {
    state.dump = '*ref_' + duplicateIndex;
  } else {
    if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
      state.usedDuplicates[duplicateIndex] = true;
    }
    if (type === '[object Object]') {
      if (block && (Object.keys(state.dump).length !== 0)) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + state.dump;
        }
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
        }
      }
    } else if (type === '[object Array]') {
      if (block && (state.dump.length !== 0)) {
        if (state.noArrayIndent && !isblockseq && level > 0) {
          writeBlockSequence(state, level - 1, state.dump, compact);
        } else {
          writeBlockSequence(state, level, state.dump, compact);
        }
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + state.dump;
        }
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
        }
      }
    } else if (type === '[object String]') {
      if (state.tag !== '?') {
        writeScalar(state, state.dump, level, iskey, inblock);
      }
    } else if (type === '[object Undefined]') {
      return false
    } else {
      if (state.skipInvalid) return false
      throw new YAMLException('unacceptable kind of an object to dump ' + type)
    }

    if (state.tag !== null && state.tag !== '?') {
      // Need to encode all characters except those allowed by the spec:
      //
      // [35] ns-dec-digit    ::=  [#x30-#x39] /* 0-9 */
      // [36] ns-hex-digit    ::=  ns-dec-digit
      //                         | [#x41-#x46] /* A-F */ | [#x61-#x66] /* a-f */
      // [37] ns-ascii-letter ::=  [#x41-#x5A] /* A-Z */ | [#x61-#x7A] /* a-z */
      // [38] ns-word-char    ::=  ns-dec-digit | ns-ascii-letter | “-”
      // [39] ns-uri-char     ::=  “%” ns-hex-digit ns-hex-digit | ns-word-char | “#”
      //                         | “;” | “/” | “?” | “:” | “@” | “&” | “=” | “+” | “$” | “,”
      //                         | “_” | “.” | “!” | “~” | “*” | “'” | “(” | “)” | “[” | “]”
      //
      // Also need to encode '!' because it has special meaning (end of tag prefix).
      //
      let tagStr = encodeURI(
        state.tag[0] === '!' ? state.tag.slice(1) : state.tag
      ).replace(/!/g, '%21');

      if (state.tag[0] === '!') {
        tagStr = '!' + tagStr;
      } else if (tagStr.slice(0, 18) === 'tag:yaml.org,2002:') {
        tagStr = '!!' + tagStr.slice(18);
      } else {
        tagStr = '!<' + tagStr + '>';
      }

      state.dump = tagStr + ' ' + state.dump;
    }
  }

  return true
}

function getDuplicateReferences (object, state) {
  const objects = [];
  const duplicatesIndexes = [];

  inspectNode(object, objects, duplicatesIndexes);

  const length = duplicatesIndexes.length;
  for (let index = 0; index < length; index += 1) {
    state.duplicates.push(objects[duplicatesIndexes[index]]);
  }
  state.usedDuplicates = new Array(length);
}

function inspectNode (object, objects, duplicatesIndexes) {
  if (object !== null && typeof object === 'object') {
    const index = objects.indexOf(object);
    if (index !== -1) {
      if (duplicatesIndexes.indexOf(index) === -1) {
        duplicatesIndexes.push(index);
      }
    } else {
      objects.push(object);

      if (Array.isArray(object)) {
        for (let i = 0, length = object.length; i < length; i += 1) {
          inspectNode(object[i], objects, duplicatesIndexes);
        }
      } else {
        const objectKeyList = Object.keys(object);

        for (let i = 0, length = objectKeyList.length; i < length; i += 1) {
          inspectNode(object[objectKeyList[i]], objects, duplicatesIndexes);
        }
      }
    }
  }
}

function dump (input, options) {
  options = options || {};

  const state = new State(options);

  if (!state.noRefs) getDuplicateReferences(input, state);

  let value = input;

  if (state.replacer) {
    value = state.replacer.call({ '': value }, '', value);
  }

  if (writeNode(state, 0, value, true, true)) return state.dump + '\n'

  return ''
}

dumper$1.dump = dump;

const loader = loader$1;
const dumper = dumper$1;

function renamed (from, to) {
  return function () {
    throw new Error('Function yaml.' + from + ' is removed in js-yaml 4. ' +
      'Use yaml.' + to + ' instead, which is now safe by default.')
  }
}

jsYaml.Type = type$1;
jsYaml.Schema = schema;
jsYaml.FAILSAFE_SCHEMA = failsafe;
jsYaml.JSON_SCHEMA = json;
jsYaml.CORE_SCHEMA = core;
jsYaml.DEFAULT_SCHEMA = _default;
jsYaml.load = loader.load;
jsYaml.loadAll = loader.loadAll;
jsYaml.dump = dumper.dump;
jsYaml.YAMLException = exception;

// Re-export all types in case user wants to create custom schema
jsYaml.types = {
  binary: binary,
  float: float,
  map: map,
  null: _null,
  pairs: pairs,
  set: set,
  timestamp: timestamp,
  bool: bool,
  int: int,
  merge: merge,
  omap: omap,
  seq: seq,
  str: str
};

// Removed functions from JS-YAML 3.0.x
jsYaml.safeLoad = renamed('safeLoad', 'load');
jsYaml.safeLoadAll = renamed('safeLoadAll', 'loadAll');
jsYaml.safeDump = renamed('safeDump', 'dump');

(function (exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.validateManifest = exports.ManifestValidationError = exports.MANIFEST_FILENAME = void 0;
	/**
	 * Manifest validator.
	 *
	 * Reads `deployment-manifest.yml` from the extracted file map and
	 * validates the same invariants `BundleInstaller.validateBundle()`
	 * checks in the VS Code extension:
	 *
	 *   - manifest exists at the bundle root
	 *   - has `id`, `version`, `name`
	 *   - `id` matches the expected bundle id (exact or suffix-tolerant,
	 *     see {@link isManifestIdMatch})
	 *   - `version` matches `bundleSpec.bundleVersion` (unless 'latest')
	 *
	 * Returns the parsed manifest on success; throws classed Errors on
	 * failure (the install command wraps them at the caller boundary).
	 * @module domain/collection/manifest-validator
	 */
	const js_yaml_1 = jsYaml;
	const id_1 = id;
	exports.MANIFEST_FILENAME = 'deployment-manifest.yml';
	/**
	 * Error thrown when manifest validation fails.
	 */
	class ManifestValidationError extends Error {
	    code;
	    /**
	     * Create a ManifestValidationError.
	     * @param message Error message.
	     * @param code Error code for programmatic handling.
	     */
	    constructor(message, code) {
	        super(message);
	        this.code = code;
	        this.name = 'ManifestValidationError';
	    }
	}
	exports.ManifestValidationError = ManifestValidationError;
	/**
	 * Read + validate the deployment manifest in `files`.
	 * @param files - ExtractedFiles map.
	 * @param opts - Expected id / version.
	 * @returns Parsed + validated manifest.
	 * @throws {ManifestValidationError} On any failure.
	 */
	const validateManifest = (files, opts) => {
	    const bytes = files.get(exports.MANIFEST_FILENAME);
	    if (bytes === undefined) {
	        throw new ManifestValidationError(`bundle is missing ${exports.MANIFEST_FILENAME} at root`, 'BUNDLE.MANIFEST_MISSING');
	    }
	    const text = new TextDecoder().decode(bytes);
	    let parsed;
	    try {
	        parsed = (0, js_yaml_1.load)(text);
	    }
	    catch (err) {
	        throw new ManifestValidationError(`${exports.MANIFEST_FILENAME} is not valid YAML: ${err.message}`, 'BUNDLE.MANIFEST_INVALID');
	    }
	    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
	        throw new ManifestValidationError(`${exports.MANIFEST_FILENAME} must be a YAML mapping`, 'BUNDLE.MANIFEST_INVALID');
	    }
	    const m = parsed;
	    for (const k of ['id', 'version', 'name']) {
	        if (typeof m[k] !== 'string' || (m[k]).length === 0) {
	            throw new ManifestValidationError(`${exports.MANIFEST_FILENAME} missing or empty "${k}" field`, 'BUNDLE.MANIFEST_INVALID');
	        }
	    }
	    const id = m.id;
	    const version = m.version;
	    if (opts.expectedId !== undefined && !(0, id_1.isManifestIdMatch)(id, version, opts.expectedId)) {
	        throw new ManifestValidationError(`manifest id "${id}" does not match expected "${opts.expectedId}"`, 'BUNDLE.ID_MISMATCH');
	    }
	    if (opts.expectedVersion !== undefined
	        && opts.expectedVersion !== 'latest'
	        && version !== opts.expectedVersion) {
	        throw new ManifestValidationError(`manifest version "${version}" does not match expected "${opts.expectedVersion}"`, 'BUNDLE.VERSION_MISMATCH');
	    }
	    return m;
	};
	exports.validateManifest = validateManifest;
	
} (manifestValidator));

var scaffold = {};

var types$6 = {};

/**
 * Domain types for scaffolding collections and primitives.
 *
 * These types define the structure for CLI scaffolding commands,
 * adapted from the VS Code extension's scaffolding implementation
 * but without VS Code-specific dependencies.
 * @module domain/scaffold/types
 */
Object.defineProperty(types$6, "__esModule", { value: true });
types$6.ScaffoldType = void 0;
types$6.generateSanitizedId = generateSanitizedId;
/**
 * Sanitize an ID by converting to lowercase and replacing non-alphanumeric chars with hyphens.
 * @param name - The name to sanitize.
 * @returns Sanitized ID string.
 */
function generateSanitizedId(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
/**
 * Supported scaffold types for CLI commands.
 */
var ScaffoldType;
(function (ScaffoldType) {
    // Collection scaffolding
    ScaffoldType["collection"] = "collection";
    // Primitive scaffolding
    ScaffoldType["prompt"] = "prompt";
    ScaffoldType["instruction"] = "instruction";
    ScaffoldType["agent"] = "agent";
    ScaffoldType["skill"] = "skill";
    ScaffoldType["plugin"] = "plugin";
    ScaffoldType["hook"] = "hook";
    ScaffoldType["chatMode"] = "chat-mode";
    // Project scaffolding
    ScaffoldType["projectGitHub"] = "project-github";
    ScaffoldType["projectApm"] = "project-apm";
})(ScaffoldType || (types$6.ScaffoldType = ScaffoldType = {}));

(function (exports) {
	/**
	 * Domain types for scaffolding collections and primitives.
	 *
	 * Exported for use by infra (TemplateEngine) and CLI (commands).
	 * @module domain/scaffold
	 */
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ScaffoldType = exports.generateSanitizedId = void 0;
	var types_1 = types$6;
	Object.defineProperty(exports, "generateSanitizedId", { enumerable: true, get: function () { return types_1.generateSanitizedId; } });
	Object.defineProperty(exports, "ScaffoldType", { enumerable: true, get: function () { return types_1.ScaffoldType; } });
	
} (scaffold));

var types$5 = {};

/**
 * Discovery domain types.
 *
 * Core type definitions for AI-powered resource discovery. These types
 * are pure and have no dependencies on feature layers.
 *
 * Ported unchanged from the reference branch's
 * `core/src/domain/discovery/types.ts`.
 * @module domain/discovery/types
 */
Object.defineProperty(types$5, "__esModule", { value: true });

var errors = {};

/**
 * Pure error categorization.
 *
 * Ported from the extension's `src/utils/error-handler.ts`
 * (`ErrorHandler.categorize` + its four private keyword-matching
 * predicates) — that file also pulls in `vscode` (for its `handle()`
 * method's user-facing notifications), so only this pure, side-effect-free
 * slice moves to `core`. The extension's `ErrorHandler.categorize`
 * delegates here; `app` use-cases that need the same classification
 * (e.g. deciding whether an update-enrichment failure is worth retrying)
 * call it directly.
 * @module domain/errors
 */
Object.defineProperty(errors, "__esModule", { value: true });
errors.categorizeError = categorizeError;
const NETWORK_KEYWORDS = ['network', 'timeout', 'econnrefused', 'enotfound', 'econnreset', 'etimedout', 'connection', 'dns', 'socket'];
const NOT_FOUND_KEYWORDS = ['not found', '404', 'does not exist', 'missing', 'unavailable'];
const VALIDATION_KEYWORDS = ['invalid', 'validation', 'schema', 'format', 'required', 'malformed'];
const AUTHENTICATION_KEYWORDS = ['unauthorized', 'forbidden', 'authentication', 'token', 'credentials', '401', '403'];
/**
 * Categorize an error based on keyword-matching its message.
 * @param error - The error to categorize.
 */
function categorizeError(error) {
    const message = error.message.toLowerCase();
    if (NETWORK_KEYWORDS.some((keyword) => message.includes(keyword))) {
        return 'network';
    }
    if (NOT_FOUND_KEYWORDS.some((keyword) => message.includes(keyword))) {
        return 'notfound';
    }
    if (VALIDATION_KEYWORDS.some((keyword) => message.includes(keyword))) {
        return 'validation';
    }
    if (AUTHENTICATION_KEYWORDS.some((keyword) => message.includes(keyword))) {
        return 'authentication';
    }
    return 'unexpected';
}

var registryError = {};

/**
 * Domain error — structured, machine-readable error type used across
 * all layers. Lives here (not in `cli`'s framework) so application and
 * infrastructure code can throw `RegistryError` without depending on
 * the CLI layer.
 *
 * Named `registry-error.ts` rather than `errors.ts` to avoid colliding
 * with this package's pre-existing `domain/errors.ts` (`categorizeError`,
 * a keyword-based classifier for generic `Error` objects, ported from the
 * extension's `ErrorHandler` — an unrelated concern that happens to want
 * the same filename in the reference branch this class is ported from).
 *
 * A `renderError()` helper (which needs a CLI `Context` for stderr) stays
 * in `cli`'s framework and is re-exported from its barrel for callers that
 * need both, matching the reference branch's own split.
 * @module domain/registry-error
 */
Object.defineProperty(registryError, "__esModule", { value: true });
registryError.isRegistryError = registryError.RegistryError = void 0;
const NAMESPACES = [
    'BUNDLE', 'INDEX', 'HUB', 'PRIMITIVE',
    'CONFIG', 'NETWORK', 'AUTH', 'FS',
    'PLUGIN', 'USAGE', 'INTERNAL'
];
const CODE_PATTERN = /^([A-Z]+)\.[A-Z][A-Z0-9_]*$/;
/**
 * Domain-specific error class. All error paths in command and
 * application code should throw `RegistryError` so the renderer can
 * produce consistent output for both text and JSON modes.
 */
class RegistryError extends Error {
    code;
    hint;
    docsUrl;
    context;
    cause;
    constructor(opts) {
        super(opts.message);
        validateCode(opts.code);
        this.name = 'RegistryError';
        this.code = opts.code;
        this.hint = opts.hint;
        this.docsUrl = opts.docsUrl;
        this.context = opts.context;
        this.cause = opts.cause;
    }
    /**
     * Serialize to the JSON shape consumed by the output envelope.
     * @returns Output-friendly representation.
     */
    toJSON() {
        const out = {
            code: this.code,
            message: this.message
        };
        if (this.hint !== undefined) {
            out.hint = this.hint;
        }
        if (this.docsUrl !== undefined) {
            out.docsUrl = this.docsUrl;
        }
        if (this.context !== undefined) {
            out.context = this.context;
        }
        return out;
    }
}
registryError.RegistryError = RegistryError;
const validateCode = (code) => {
    const m = CODE_PATTERN.exec(code);
    if (m === null) {
        throw new TypeError(`Invalid RegistryError code "${code}": expected NAMESPACE.UPPER_SNAKE format`);
    }
    const ns = m[1];
    if (!NAMESPACES.includes(ns)) {
        throw new TypeError(`Invalid RegistryError namespace "${ns}" in code "${code}": expected one of ${NAMESPACES.join(', ')}`);
    }
};
/**
 * Type guard for RegistryError.
 * @param value Anything.
 * @returns Whether `value` is a RegistryError.
 */
const isRegistryError = (value) => value instanceof RegistryError;
registryError.isRegistryError = isRegistryError;

var types$4 = {};

/**
 * Domain layer — Source types.
 *
 * Mirrors the production shape at `src/types/registry.ts`
 * (`SourceType`, `RegistrySource`, `SourceMetadata`, `SourceSyncedEvent`).
 * `ValidationResult` here consolidates two near-duplicate shapes found on
 * `main` (`src/types/registry.ts` and `src/types/hub.ts`, the latter
 * missing `warnings`/`bundlesFound`) into the one, more complete shape —
 * a superset, so existing `{ valid, errors }` call sites remain compatible.
 * @module domain/source/types
 */
Object.defineProperty(types$4, "__esModule", { value: true });

var sourceId = {};

(function (exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.generateHubKey = exports.generateSourceId = exports.normalizeUrl = void 0;
	/**
	 * sourceId helper.
	 *
	 * Mirrors the algorithm in `src/utils/source-id-utils.ts` of the
	 * VS Code extension exactly so that lockfile entries written by the
	 * CLI are interchangeable with entries written by the extension.
	 *
	 * Pure function; no IO; safe to import from anywhere.
	 * @module domain/source-id
	 */
	const node_crypto_1 = require$$0$1;
	/**
	 * Lowercase host + path; strip protocol + trailing slashes.
	 *
	 * Falls back to a regex-based normalization when `URL` parsing fails
	 * (matches the extension's behaviour for invalid URLs).
	 * @param url Raw URL.
	 * @returns Normalized URL string.
	 */
	const normalizeUrl = (url) => {
	    try {
	        const u = new URL(url);
	        const host = u.hostname.toLowerCase();
	        const path = u.pathname.toLowerCase().replace(/\/+$/, '');
	        return host + path;
	    }
	    catch {
	        return url
	            .toLowerCase()
	            .replace(/^https?:\/\//, '')
	            .replace(/\/+$/, '');
	    }
	};
	exports.normalizeUrl = normalizeUrl;
	/**
	 * Canonicalize branch name to 'main' if missing or 'master'.
	 * @param branch Optional branch name.
	 * @returns Canonical branch.
	 */
	const canonicalBranch = (branch) => {
	    if (branch === undefined || branch.length === 0 || branch === 'master') {
	        return 'main';
	    }
	    return branch;
	};
	/**
	 * Generate a stable sourceId of the form `{type}-{12hex}`.
	 *
	 * The hash includes (sourceType, normalizedUrl, branch,
	 * collectionsPath) so that the same logical source maps to the same
	 * id regardless of how the user typed the URL.
	 * @param sourceType e.g. 'github', 'awesome-copilot', 'apm'.
	 * @param url Source URL.
	 * @param config Optional branch + collections path.
	 * @returns The sourceId.
	 */
	const generateSourceId = (sourceType, url, config) => {
	    const normalizedUrl = (0, exports.normalizeUrl)(url);
	    const branch = canonicalBranch(config?.branch);
	    const collectionsPath = config?.collectionsPath ?? 'collections';
	    const hash = (0, node_crypto_1.createHash)('sha256')
	        .update(`${sourceType}:${normalizedUrl}:${branch}:${collectionsPath}`)
	        .digest('hex')
	        .substring(0, 12);
	    return `${sourceType}-${hash}`;
	};
	exports.generateSourceId = generateSourceId;
	/**
	 * Generate a hub-key analogue for hubs[] entries in the lockfile.
	 *
	 * Format: `{12hex}` for main/master/no-branch, `{12hex}-{branch}`
	 * otherwise (matches extension's `generateHubKey`).
	 * @param url Hub URL.
	 * @param branch Optional branch.
	 * @returns The hub key.
	 */
	const generateHubKey = (url, branch) => {
	    const normalizedUrl = (0, exports.normalizeUrl)(url);
	    const hash = (0, node_crypto_1.createHash)('sha256')
	        .update(normalizedUrl)
	        .digest('hex')
	        .substring(0, 12);
	    const b = canonicalBranch(branch);
	    return b === 'main' ? hash : `${hash}-${b}`;
	};
	exports.generateHubKey = generateHubKey;
	
} (sourceId));

var types$3 = {};

Object.defineProperty(types$3, "__esModule", { value: true });

var target = {};

(function (exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.TARGET_TYPES = void 0;
	exports.isTarget = isTarget;
	/**
	 * All target types known to `ai-primitives-hub-next`.
	 */
	exports.TARGET_TYPES = [
	    'vscode',
	    'vscode-insiders',
	    'copilot-cli',
	    'kiro',
	    'windsurf',
	    'claude-code'
	];
	const INSTALLATION_SCOPES = ['user', 'workspace', 'repository'];
	const COMMIT_MODES = ['commit', 'local-only'];
	/**
	 * Type guard for `Target`. Pure; no IO — safe to use directly against
	 * parsed YAML/JSON config nodes.
	 * @param value - Candidate value, typically a parsed config node.
	 * @returns true iff `value` matches the `Target` shape.
	 */
	function isTarget(value) {
	    if (value === null || typeof value !== 'object') {
	        return false;
	    }
	    const candidate = value;
	    if (typeof candidate.name !== 'string' || candidate.name.length === 0) {
	        return false;
	    }
	    if (typeof candidate.type !== 'string' || !exports.TARGET_TYPES.includes(candidate.type)) {
	        return false;
	    }
	    if (candidate.scope !== undefined && !INSTALLATION_SCOPES.includes(candidate.scope)) {
	        return false;
	    }
	    if (candidate.commitMode !== undefined && !COMMIT_MODES.includes(candidate.commitMode)) {
	        return false;
	    }
	    return true;
	}
	
} (target));

var installable = {};

Object.defineProperty(installable, "__esModule", { value: true });
installable.parseBundleSpec = void 0;
/**
 * Parse an `install <spec>` positional argument into a `BundleSpec`.
 * Accepted forms (see module doc):
 *   `foo`                  -> `{ bundleId: 'foo' }`
 *   `owner/repo:foo`       -> `{ sourceId: 'owner/repo', bundleId: 'foo' }`
 *   `owner/repo:foo@1.2.3` -> `{ sourceId: 'owner/repo', bundleId: 'foo', bundleVersion: '1.2.3' }`
 *   `foo@1.2.3`            -> `{ bundleId: 'foo', bundleVersion: '1.2.3' }`
 * @param raw - Raw positional argument.
 * @returns Parsed bundle spec.
 * @throws {Error} When `raw` is empty or has no bundle id segment.
 */
const parseBundleSpec = (raw) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        throw new Error('bundle spec must be a non-empty string');
    }
    const colonIndex = trimmed.lastIndexOf(':');
    const sourceId = colonIndex === -1 ? undefined : trimmed.slice(0, colonIndex);
    const rest = colonIndex === -1 ? trimmed : trimmed.slice(colonIndex + 1);
    const atIndex = rest.lastIndexOf('@');
    const bundleId = atIndex === -1 ? rest : rest.slice(0, atIndex);
    const bundleVersion = atIndex === -1 ? undefined : rest.slice(atIndex + 1);
    if (bundleId.length === 0) {
        throw new Error(`bundle spec "${raw}" has no bundle id`);
    }
    return {
        sourceId: sourceId !== undefined && sourceId.length > 0 ? sourceId : undefined,
        bundleId,
        bundleVersion: bundleVersion !== undefined && bundleVersion.length > 0 ? bundleVersion : undefined
    };
};
installable.parseBundleSpec = parseBundleSpec;

var copilotFileType = {};

/**
 * Copilot file type domain logic.
 *
 * Pure classification/naming rules for GitHub Copilot customization files
 * (prompts, instructions, chatmodes, agents, skills): given a manifest
 * item's file name/tags, decide its `CopilotFileType`, and given an id +
 * type, compute the canonical on-disk file name.
 *
 * Ported verbatim from the extension's `src/utils/copilot-file-type-utils.ts`
 * (migration plan §7.5 item 2) — that module becomes a thin re-export of
 * this one. No IO, no framework imports: safe for both the extension and
 * the CLI to depend on directly.
 * @module domain/install/copilot-file-type
 */
Object.defineProperty(copilotFileType, "__esModule", { value: true });
copilotFileType.normalizePromptId = normalizePromptId;
copilotFileType.isSkillDirectory = isSkillDirectory;
copilotFileType.getSkillName = getSkillName;
copilotFileType.determineFileType = determineFileType;
copilotFileType.getTargetFileName = getTargetFileName;
copilotFileType.getRepositoryTargetDirectory = getRepositoryTargetDirectory;
copilotFileType.getFileExtension = getFileExtension;
/**
 * Normalize a prompt ID to a safe string for use in file names.
 *
 * Replaces any characters that are not alphanumeric, hyphens, or underscores
 * with hyphens. Also handles YAML parsing numeric-looking IDs as numbers.
 * @param id - The prompt ID to normalize (can be string or number from YAML parsing)
 * @returns A normalized string safe for use in file names
 */
function normalizePromptId(id) {
    return String(id).replace(/[^a-zA-Z0-9-_]/g, '-');
}
/**
 * File extension mappings for each Copilot file type
 */
const FILE_EXTENSIONS = {
    prompt: '.prompt.md',
    instructions: '.instructions.md',
    chatmode: '.chatmode.md',
    agent: '.agent.md',
    skill: '' // Skills are directories, not single files
};
/**
 * Repository directory mappings for each Copilot file type
 * These follow VS Code Copilot conventions for repository-level customizations
 */
const REPOSITORY_DIRECTORIES = {
    prompt: '.github/prompts/',
    instructions: '.github/instructions/',
    chatmode: '.github/agents/', // Chatmodes are associated with agents
    agent: '.github/agents/',
    skill: '.github/skills/'
};
/**
 * Common skill directory patterns
 */
const SKILL_DIRECTORY_PATTERNS = [
    /^skills[/\\]/i, // skills/skill-name
    /[/\\]skills[/\\]/i // path/to/skills/skill-name
];
/**
 * Check if a path represents a skill directory.
 *
 * Skill directories are identified by:
 * 1. Being under a 'skills/' parent directory
 * 2. Containing a SKILL.md file (when checking contents)
 * @param filePath - The path to check
 * @returns True if the path represents a skill directory
 */
function isSkillDirectory(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    // Check if path is under a skills directory
    return SKILL_DIRECTORY_PATTERNS.some((pattern) => pattern.test(normalizedPath));
}
/**
 * Extract the skill name from a skill directory path.
 *
 * Given a path like 'skills/my-skill' or 'path/to/skills/my-skill',
 * returns 'my-skill'.
 * @param skillPath - The path to the skill directory
 * @returns The skill name, or null if not a valid skill path
 */
function getSkillName(skillPath) {
    const normalizedPath = skillPath.replace(/\\/g, '/');
    // Match patterns like 'skills/skill-name' or 'path/skills/skill-name'
    const match = normalizedPath.match(/(?:^|[/\\])skills[/\\]([^/\\]+)(?:[/\\]|$)/i);
    if (match && match[1]) {
        return match[1];
    }
    return null;
}
/**
 * Determine the Copilot file type from a file name and optional tags.
 *
 * Detection priority:
 * 1. File extension patterns (e.g., .prompt.md, .agent.md)
 * 2. Special file names (e.g., SKILL.md)
 * 3. Tags from manifest
 * 4. Filename patterns (e.g., contains "instructions")
 * 5. Default to 'prompt'
 * @param fileName - The file name or path to analyze
 * @param tags - Optional tags from the manifest
 * @returns The detected CopilotFileType
 */
function determineFileType(fileName, tags) {
    // Get just the file name without directory path
    const baseName = fileName.replace(/^.*[/\\]/, '');
    const lowerBaseName = baseName.toLowerCase();
    // 1. Check for specific file extension patterns (highest priority)
    if (lowerBaseName.endsWith('.prompt.md')) {
        return 'prompt';
    }
    if (lowerBaseName.endsWith('.instructions.md')) {
        return 'instructions';
    }
    if (lowerBaseName.endsWith('.chatmode.md')) {
        return 'chatmode';
    }
    if (lowerBaseName.endsWith('.agent.md')) {
        return 'agent';
    }
    // 2. Check for special file names
    if (lowerBaseName === 'skill.md') {
        return 'skill';
    }
    // 3. Check tags if provided
    if (tags && tags.length > 0) {
        const lowerTags = tags.map((t) => t.toLowerCase());
        if (lowerTags.includes('instructions')) {
            return 'instructions';
        }
        if (lowerTags.includes('chatmode') || lowerTags.includes('mode')) {
            return 'chatmode';
        }
        if (lowerTags.includes('agent')) {
            return 'agent';
        }
        if (lowerTags.includes('skill')) {
            return 'skill';
        }
    }
    // 4. Check filename patterns
    if (lowerBaseName.includes('instructions')) {
        return 'instructions';
    }
    // 5. Default to prompt
    return 'prompt';
}
/**
 * Generate the target file name for a given ID and file type.
 * @param id - The prompt/agent/etc. identifier
 * @param type - The Copilot file type
 * @returns The target file name with appropriate extension
 */
function getTargetFileName(id, type) {
    // Skills use SKILL.md as the main file
    if (type === 'skill') {
        return 'SKILL.md';
    }
    return `${id}${FILE_EXTENSIONS[type]}`;
}
/**
 * Get the repository target directory for a given file type.
 *
 * Returns the appropriate .github/ subdirectory where files of this type
 * should be placed for repository-level installation.
 * @param type - The Copilot file type
 * @returns The repository directory path (e.g., '.github/prompts/')
 */
function getRepositoryTargetDirectory(type) {
    return REPOSITORY_DIRECTORIES[type];
}
/**
 * Get the file extension for a given Copilot file type.
 * @param type - The Copilot file type
 * @returns The file extension (e.g., '.prompt.md') or empty string for skills
 */
function getFileExtension(type) {
    return FILE_EXTENSIONS[type];
}

var layout = {};

/**
 * Domain types for target layout configuration.
 *
 * A layout config describes where each primitive kind should be placed
 * for a given target type and scope (user vs repository). These types
 * represent the on-disk configuration format (YAML/JSON) as well as
 * the resolved shape consumed by writers.
 *
 * Pure domain: no IO, no framework imports.
 * @module domain/install/layout
 */
Object.defineProperty(layout, "__esModule", { value: true });
layout.validateTargetLayoutsConfig = validateTargetLayoutsConfig;
/**
 * Validate an unknown value as a `TargetLayoutsConfig`.
 * Returns the typed config or throws with a descriptive message.
 * Pure; no IO.
 * @param raw - Parsed YAML/JSON to validate.
 * @returns Typed `TargetLayoutsConfig`.
 */
function validateTargetLayoutsConfig(raw) {
    if (raw === null || typeof raw !== 'object') {
        throw new Error('layout config must be an object');
    }
    const obj = raw;
    if (obj.layouts === null || typeof obj.layouts !== 'object') {
        throw new Error('layout config must have a "layouts" object');
    }
    const layouts = obj.layouts;
    for (const [type, def] of Object.entries(layouts)) {
        if (def === null || typeof def !== 'object') {
            throw new Error(`layout config: "${type}" must be an object`);
        }
        const typedDef = def;
        validateScopedLayoutDef(typedDef.user, `${type}.user`);
        if (typedDef.repository !== undefined) {
            validateScopedLayoutDef(typedDef.repository, `${type}.repository`);
        }
    }
    return raw;
}
function validateScopedLayoutDef(raw, path) {
    if (raw === null || typeof raw !== 'object') {
        throw new TypeError(`layout config: "${path}" must be an object`);
    }
    const obj = raw;
    if (typeof obj.baseDir !== 'string') {
        throw new TypeError(`layout config: "${path}.baseDir" must be a string`);
    }
    if (obj.kindRoutes === null || typeof obj.kindRoutes !== 'object') {
        throw new TypeError(`layout config: "${path}.kindRoutes" must be an object`);
    }
    for (const [k, v] of Object.entries(obj.kindRoutes)) {
        if (typeof v !== 'string') {
            throw new TypeError(`layout config: "${path}.kindRoutes.${k}" must be a string`);
        }
    }
    if (obj.skipPaths !== undefined) {
        if (!Array.isArray(obj.skipPaths)) {
            throw new TypeError(`layout config: "${path}.skipPaths" must be an array`);
        }
        for (const p of obj.skipPaths) {
            if (typeof p !== 'string') {
                throw new TypeError(`layout config: "${path}.skipPaths" entries must be strings`);
            }
        }
    }
}

var transform = {};

Object.defineProperty(transform, "__esModule", { value: true });
transform.changed = transform.noChange = void 0;
/**
 * Create a TransformResult indicating no change.
 * @param content - The (unchanged) content.
 * @returns TransformResult with modified=false.
 */
const noChange = (content) => ({
    content,
    modified: false
});
transform.noChange = noChange;
/**
 * Create a TransformResult indicating a change.
 * @param content - The transformed content.
 * @returns TransformResult with modified=true.
 */
const changed = (content) => ({
    content,
    modified: true
});
transform.changed = changed;

var types$2 = {};

Object.defineProperty(types$2, "__esModule", { value: true });

var guards = {};

Object.defineProperty(guards, "__esModule", { value: true });
guards.isBundleUpdateArray = isBundleUpdateArray;
guards.isSourceArray = isSourceArray;
/**
 * Type guard for a `BundleUpdate[]`.
 * @param value - Value to check.
 */
function isBundleUpdateArray(value) {
    if (!Array.isArray(value)) {
        return false;
    }
    return value.every((item) => typeof item === 'object'
        && item !== null
        && typeof item.bundleId === 'string'
        && typeof item.currentVersion === 'string'
        && typeof item.latestVersion === 'string');
}
/**
 * Type guard for a minimal source array (id/type/name present).
 * @param value - Value to check.
 */
function isSourceArray(value) {
    if (!Array.isArray(value)) {
        return false;
    }
    return value.every((item) => typeof item === 'object'
        && item !== null
        && typeof item.id === 'string'
        && typeof item.type === 'string'
        && typeof item.name === 'string');
}

var settings = {};

Object.defineProperty(settings, "__esModule", { value: true });

var types$1 = {};

Object.defineProperty(types$1, "__esModule", { value: true });
types$1.DEFAULT_LOCAL_HUB_ID = void 0;
/**
 * Reserved hub id for the synthetic, auto-managed hub that holds
 * "detached" sources/profiles added directly via `source add`/
 * `profile create` rather than imported from a real hub reference.
 * `HubManager.importHub` refuses this id for real imports.
 */
types$1.DEFAULT_LOCAL_HUB_ID = 'default-local';

var validate$1 = {};

Object.defineProperty(validate$1, "__esModule", { value: true });
validate$1.hasPathTraversal = hasPathTraversal;
validate$1.isValidProtocol = isValidProtocol;
validate$1.sanitizeHubId = sanitizeHubId;
validate$1.validateHubReference = validateHubReference;
/**
 * Check whether a path contains directory-traversal sequences, including
 * the URL-encoded form.
 * @param path - Path to inspect.
 */
function hasPathTraversal(path) {
    if (!path) {
        return false;
    }
    if (path.includes('..')) {
        return true;
    }
    const decoded = decodeURIComponent(path);
    return decoded.includes('..');
}
/**
 * Only HTTPS is an acceptable protocol for a hub `url` reference.
 * @param protocol - Protocol string, e.g. `https:`.
 */
function isValidProtocol(protocol) {
    return protocol === 'https:';
}
/**
 * Validate a hub ID: non-empty, ≤255 chars, no path separators or
 * traversal, alphanumeric/dash/underscore only.
 * @param hubId - Hub ID to validate.
 * @throws {Error} if the ID is invalid.
 */
function sanitizeHubId(hubId) {
    if (!hubId) {
        throw new Error('Invalid hub ID: cannot be empty');
    }
    if (hubId.length > 255) {
        throw new Error('Invalid hub ID: too long (max 255 characters)');
    }
    if (hubId.includes('..') || hubId.includes('/') || hubId.includes('\\')) {
        throw new Error('Invalid hub ID: path traversal detected');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(hubId)) {
        throw new Error('Invalid hub ID: only alphanumeric characters, dash, and underscore allowed');
    }
}
/**
 * Validate a hub reference's `location` against its `type`.
 * @param ref - Hub reference to validate.
 * @throws {Error} if validation fails.
 */
function validateHubReference(ref) {
    if (ref.location === null || ref.location === undefined) {
        throw new Error('Location is required');
    }
    if (ref.location === '') {
        throw new Error('Location cannot be empty');
    }
    switch (ref.type) {
        case 'github': {
            if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(ref.location)) {
                throw new Error('Invalid GitHub repository format. Expected: owner/repo');
            }
            break;
        }
        case 'local': {
            if (hasPathTraversal(ref.location)) {
                throw new Error('Path traversal detected in local path');
            }
            break;
        }
        case 'url': {
            let url;
            try {
                url = new URL(ref.location);
            }
            catch {
                throw new Error('Invalid URL format');
            }
            if (!isValidProtocol(url.protocol)) {
                throw new Error('Only HTTPS URLs are allowed for security');
            }
            break;
        }
    }
}

var types = {};

(function (exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.PRIMITIVE_KINDS = void 0;
	exports.isPrimitiveKind = isPrimitiveKind;
	exports.PRIMITIVE_KINDS = [
	    'prompt',
	    'instruction',
	    'chat-mode',
	    'agent',
	    'skill',
	    'plugin',
	    'hook',
	    'mcp-server'
	];
	/**
	 * Type guard for `PrimitiveKind`.
	 * @param value - Candidate value.
	 */
	function isPrimitiveKind(value) {
	    return typeof value === 'string' && exports.PRIMITIVE_KINDS.includes(value);
	}
	
} (types));

var validate = {};

(function (exports) {
	/**
	 * Skills validation module (pure functions).
	 *
	 * Validates skill folders following the Agent Skills specification.
	 * File-IO dependent functions belong in the `app` layer.
	 *
	 * Ported unchanged from the reference branch's
	 * `core/src/domain/skill/validate.ts`. Its `parseFrontmatter` is
	 * reused as-is by `app/transform/transformers/kiro-transformer.ts`
	 * (a generic YAML-frontmatter reader, despite this file's own
	 * skill-specific name/home — matches the reference's own reuse).
	 * @see https://agentskills.io/specification
	 * @module domain/skill/validate
	 */
	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    var desc = Object.getOwnPropertyDescriptor(m, k);
	    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
	      desc = { enumerable: true, get: function() { return m[k]; } };
	    }
	    Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    o[k2] = m[k];
	}));
	var __setModuleDefault = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
	    Object.defineProperty(o, "default", { enumerable: true, value: v });
	}) : function(o, v) {
	    o["default"] = v;
	});
	var __importStar = (commonjsGlobal && commonjsGlobal.__importStar) || (function () {
	    var ownKeys = function(o) {
	        ownKeys = Object.getOwnPropertyNames || function (o) {
	            var ar = [];
	            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
	            return ar;
	        };
	        return ownKeys(o);
	    };
	    return function (mod) {
	        if (mod && mod.__esModule) return mod;
	        var result = {};
	        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
	        __setModuleDefault(result, mod);
	        return result;
	    };
	})();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.MAX_ASSET_SIZE = exports.SKILL_DESCRIPTION_MAX_LENGTH = exports.SKILL_DESCRIPTION_MIN_LENGTH = exports.SKILL_NAME_MAX_LENGTH = void 0;
	exports.parseFrontmatter = parseFrontmatter;
	exports.validateSkillName = validateSkillName;
	exports.validateSkillDescription = validateSkillDescription;
	const yaml = __importStar(jsYaml);
	// Constants
	exports.SKILL_NAME_MAX_LENGTH = 64;
	exports.SKILL_DESCRIPTION_MIN_LENGTH = 10;
	exports.SKILL_DESCRIPTION_MAX_LENGTH = 1024;
	exports.MAX_ASSET_SIZE = 5 * 1024 * 1024; // 5 MB
	/**
	 * Parse YAML frontmatter from SKILL.md content
	 * @param content
	 */
	function parseFrontmatter(content) {
	    const match = /^---\n([\s\S]*?)\n---/.exec(content);
	    if (!match) {
	        return null;
	    }
	    try {
	        return yaml.load(match[1]);
	    }
	    catch {
	        return null;
	    }
	}
	/**
	 * Validate skill name format
	 * @param name
	 */
	function validateSkillName(name) {
	    if (!name || typeof name !== 'string') {
	        return 'name is required and must be a string';
	    }
	    if (!/^[a-z0-9-]+$/.test(name)) {
	        return 'name must contain only lowercase letters, numbers, and hyphens';
	    }
	    if (name.length > exports.SKILL_NAME_MAX_LENGTH) {
	        return `name must not exceed ${exports.SKILL_NAME_MAX_LENGTH} characters`;
	    }
	    return null;
	}
	/**
	 * Validate skill description
	 * @param description
	 */
	function validateSkillDescription(description) {
	    if (!description || typeof description !== 'string') {
	        return 'description is required and must be a string';
	    }
	    if (description.length < exports.SKILL_DESCRIPTION_MIN_LENGTH) {
	        return `description must be at least ${exports.SKILL_DESCRIPTION_MIN_LENGTH} characters`;
	    }
	    if (description.length > exports.SKILL_DESCRIPTION_MAX_LENGTH) {
	        return `description must not exceed ${exports.SKILL_DESCRIPTION_MAX_LENGTH} characters`;
	    }
	    return null;
	}
	
} (validate));

(function (exports) {
	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    var desc = Object.getOwnPropertyDescriptor(m, k);
	    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
	      desc = { enumerable: true, get: function() { return m[k]; } };
	    }
	    Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    o[k2] = m[k];
	}));
	var __exportStar = (commonjsGlobal && commonjsGlobal.__exportStar) || function(m, exports) {
	    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * Domain layer barrel export.
	 * @module domain
	 */
	__exportStar(types$8, exports);
	__exportStar(id, exports);
	__exportStar(version, exports);
	__exportStar(identityMatcher, exports);
	__exportStar(types$7, exports);
	__exportStar(validate$2, exports);
	__exportStar(manifestValidator, exports);
	__exportStar(scaffold, exports);
	__exportStar(types$5, exports);
	__exportStar(errors, exports);
	__exportStar(registryError, exports);
	__exportStar(types$4, exports);
	__exportStar(sourceId, exports);
	__exportStar(types$3, exports);
	__exportStar(target, exports);
	__exportStar(installable, exports);
	__exportStar(copilotFileType, exports);
	__exportStar(layout, exports);
	__exportStar(transform, exports);
	__exportStar(types$2, exports);
	__exportStar(guards, exports);
	__exportStar(settings, exports);
	__exportStar(types$1, exports);
	__exportStar(validate$1, exports);
	__exportStar(types, exports);
	__exportStar(validate, exports);
	
} (domain));

var ports = {};

var sourceAdapter = {};

Object.defineProperty(sourceAdapter, "__esModule", { value: true });

var appStorage = {};

/**
 * AppStorage port — universal, non-VS-Code-specific storage-root
 * resolution for the registry/bookkeeping layer (config, cache,
 * installed-bundle records per scope, profiles, logs).
 *
 * Models exactly the directory/file responsibilities the extension's
 * `RegistryStorage` (`src/storage/registry-storage.ts`) already defines,
 * plus a tiny generic key/value slot for small persisted state (bundle
 * update preferences today) — so path *and* state resolution are both
 * behind one injectable seam instead of being resolved inline against
 * `vscode.ExtensionContext`.
 *
 * Two implementations: the VS Code extension's own adapter, backed by
 * `context.globalStorageUri`/`context.globalState` (kept exactly as-is
 * for existing users — see ADR-0005 decision 3); and `infra`'s
 * `XdgAppStorage`, an XDG Base Directory-compliant default for the CLI
 * and any other non-VS-Code client (ADR-0005 decision 2).
 * @module ports/app-storage
 */
Object.defineProperty(appStorage, "__esModule", { value: true });

var clock = {};

/**
 * Clock port — time abstraction for deterministic testing.
 *
 * Code that needs "now" (timestamps on `InstalledBundle.installedAt`,
 * lockfile `generatedAt`, cache TTLs, ...) depends on this interface
 * instead of calling `Date.now()`/`new Date()` directly, so tests can
 * inject a fixed or controllable clock. The production adapter
 * (`@ai-primitives-hub/infra`, Phase 3) simply wraps the real `Date`.
 * @module ports/clock
 */
Object.defineProperty(clock, "__esModule", { value: true });

var copilotSdk = {};

/**
 * Copilot SDK port interface.
 *
 * Abstract interface for Copilot SDK integration — the AI-session
 * backend `app/discovery/recommendation-engine.ts`'s AI-powered path
 * depends on. Infrastructure layer provides concrete implementations
 * (e.g. a real Copilot SDK client for the CLI's `discover --ai`
 * command); this package only depends on the shape.
 *
 * Ported unchanged from the reference branch's
 * `core/src/ports/copilot-sdk.ts`.
 * @module ports/copilot-sdk
 */
Object.defineProperty(copilotSdk, "__esModule", { value: true });

var filesystem = {};

/**
 * FileSystem port — IO abstraction for all file-system operations.
 *
 * The contract every feature layer uses for filesystem access — mirrors
 * the operations `src/services/*` already perform via `fs/promises`
 * today (read/write text and JSON, existence checks, directory
 * creation/listing, removal). Concrete adapters live in
 * `@ai-primitives-hub/infra` (Phase 3); tests supply hand-written
 * in-memory doubles. Keeps `core`/`app` free of direct `node:fs` imports.
 * @module ports/filesystem
 */
Object.defineProperty(filesystem, "__esModule", { value: true });

var http = {};

/**
 * HTTP port — network abstraction for source adapters and the install
 * pipeline.
 *
 * `app`/`infra` non-adapter code depends only on this interface, never on
 * `fetch`/`axios`/`node:http` directly. The production adapter
 * (`@ai-primitives-hub/infra`, Phase 3) wraps the real HTTP client.
 * @module ports/http
 */
Object.defineProperty(http, "__esModule", { value: true });

var githubApi = {};

/**
 * GitHubApi port — interface for GitHub REST API interactions.
 *
 * Covers the access patterns `src/adapters/github-adapter.ts` and
 * `src/adapters/skills-adapter.ts` need: JSON GETs (repository contents,
 * tree, releases), text GETs (raw file content), and binary downloads
 * (release/tarball assets). Also covers the ETag-conditional GET the
 * Phase 3b harvest subsystem needs to poll `/commits/:ref` cheaply across
 * many hub sources without spending full rate-limit budget on unchanged
 * repos (`getJsonWithEtag`). Retry/backoff/rate-limit handling is
 * deliberately *not* part of this port — it's a resilience concern of
 * whichever concrete implementation wraps the transport (see
 * `@ai-primitives-hub/infra`'s `GitHubApiClient`), not something every
 * `GitHubApi` implementation (e.g. a test double) needs to reason about.
 * @module ports/github-api
 */
Object.defineProperty(githubApi, "__esModule", { value: true });

var processRunner = {};

/**
 * Process-execution port — shells out to external CLIs.
 *
 * Needed by adapters that delegate to a third-party command-line tool
 * rather than a plain HTTP API (the `apm` CLI for `ApmAdapter`, Phase 3a).
 * A narrower, purpose-built shell-out already exists for a single command
 * (`infra/auth/gh-cli-token-provider.ts`'s `ExecFn`, for `gh auth token`);
 * this is the general-purpose counterpart for adapters that need to run
 * more than one distinct command with `cwd`/`env`/timeout control.
 * @module ports/process-runner
 */
Object.defineProperty(processRunner, "__esModule", { value: true });

var bundleExtractor = {};

/**
 * BundleExtractor port — decodes zip bytes into a path→bytes map.
 * Concrete adapters live in `infra`. Tests inject a dict-backed fake.
 * @module ports/bundle-extractor
 */
Object.defineProperty(bundleExtractor, "__esModule", { value: true });

var targetWriter = {};

Object.defineProperty(targetWriter, "__esModule", { value: true });

var layoutConfigLoader = {};

Object.defineProperty(layoutConfigLoader, "__esModule", { value: true });

var resourceTransformer = {};

Object.defineProperty(resourceTransformer, "__esModule", { value: true });

var sourceResolver = {};

Object.defineProperty(sourceResolver, "__esModule", { value: true });

var bundleDownloader = {};

Object.defineProperty(bundleDownloader, "__esModule", { value: true });

var registryOperations = {};

Object.defineProperty(registryOperations, "__esModule", { value: true });

var updateStore = {};

/**
 * Bundle update-preference persistence — the narrow slice of the
 * extension's `RegistryStorage` (`src/storage/registry-storage.ts`)
 * that the update-checking/auto-update use cases need. `RegistryStorage`
 * already exposes exactly this shape (`getUpdatePreference`/
 * `setUpdatePreference`/`getUpdatePreferences`), so it satisfies this
 * port with zero changes.
 * @module ports/update-store
 */
Object.defineProperty(updateStore, "__esModule", { value: true });

var updateNotifier = {};

/**
 * Update-outcome notification port — the narrow slice of the extension's
 * `BundleUpdateNotifications` (`src/notifications/bundle-update-notifications.ts`)
 * that the auto-update use case needs to report outcomes through. A CLI
 * implementation would print to stdout instead of showing a VS Code
 * notification; `BundleUpdateNotifications` already exposes exactly this
 * shape, so it satisfies this port with zero changes.
 * @module ports/update-notifier
 */
Object.defineProperty(updateNotifier, "__esModule", { value: true });

var telemetry = {};

/**
 * Telemetry port interfaces.
 *
 * Defines the contract for telemetry documents and transports.
 * Implementations in `@ai-primitives-hub/infra` handle delivery to
 * specific backends (Elasticsearch, console, etc.).
 * @module ports/telemetry
 */
Object.defineProperty(telemetry, "__esModule", { value: true });

(function (exports) {
	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    var desc = Object.getOwnPropertyDescriptor(m, k);
	    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
	      desc = { enumerable: true, get: function() { return m[k]; } };
	    }
	    Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    o[k2] = m[k];
	}));
	var __exportStar = (commonjsGlobal && commonjsGlobal.__exportStar) || function(m, exports) {
	    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	/**
	 * Ports layer barrel export.
	 * @module ports
	 */
	__exportStar(sourceAdapter, exports);
	__exportStar(appStorage, exports);
	__exportStar(clock, exports);
	__exportStar(copilotSdk, exports);
	__exportStar(filesystem, exports);
	__exportStar(http, exports);
	__exportStar(githubApi, exports);
	__exportStar(processRunner, exports);
	__exportStar(bundleExtractor, exports);
	__exportStar(targetWriter, exports);
	__exportStar(layoutConfigLoader, exports);
	__exportStar(resourceTransformer, exports);
	__exportStar(sourceResolver, exports);
	__exportStar(bundleDownloader, exports);
	__exportStar(registryOperations, exports);
	__exportStar(updateStore, exports);
	__exportStar(updateNotifier, exports);
	__exportStar(telemetry, exports);
	
} (ports));

var $schema = "http://json-schema.org/draft-07/schema#";
var $id = "https://github.com/AmadeusITGroup/prompt-registry/schemas/collection.schema.json";
var title = "Awesome Copilot Collection";
var description = "Schema for Copilot prompt collection files";
var type = "object";
var required = [
	"id",
	"name",
	"description",
	"items"
];
var properties = {
	id: {
		type: "string",
		description: "Unique identifier for the collection (lowercase letters, numbers, and hyphens only)",
		pattern: "^[a-z0-9-]+$",
		minLength: 1,
		examples: [
			"my-prompts",
			"python-helpers",
			"git-workflows"
		]
	},
	name: {
		type: "string",
		description: "Human-readable name of the collection",
		minLength: 1,
		maxLength: 100,
		examples: [
			"My Awesome Prompts",
			"Python Development Helpers"
		]
	},
	description: {
		type: "string",
		description: "Detailed description of the collection's purpose and contents",
		minLength: 1,
		maxLength: 500
	},
	items: {
		type: "array",
		description: "List of resources in this collection",
		minItems: 0,
		maxItems: 50,
		items: {
			type: "object",
			required: [
				"path",
				"kind"
			],
			properties: {
				path: {
					type: "string",
					description: "Relative path to the resource file",
					minLength: 1,
					examples: [
						"prompts/my-prompt.prompt.md",
						"instructions/code-style.instructions.md",
						"skills/my-skill/SKILL.md"
					]
				},
				kind: {
					type: "string",
					description: "Type of resource",
					"enum": [
						"prompt",
						"instruction",
						"chat-mode",
						"agent",
						"skill",
						"plugin",
						"hook"
					]
				},
				title: {
					type: "string",
					description: "Optional display title for the resource"
				},
				description: {
					type: "string",
					description: "Optional description of the resource"
				},
				tags: {
					type: "array",
					description: "Optional tags for categorization",
					items: {
						type: "string"
					}
				}
			},
			additionalProperties: false
		}
	},
	mcp: {
		type: "object",
		description: "Model Context Protocol (MCP) server configurations to be installed with this collection",
		properties: {
			items: {
				type: "object",
				description: "MCP servers to install (follows mcp.json spec)",
				patternProperties: {
					"^[a-zA-Z0-9_-]+$": {
						type: "object",
						description: "MCP server configuration",
						properties: {
							type: {
								type: "string",
								description: "Transport type for the MCP server",
								"enum": [
									"stdio",
									"http",
									"sse"
								],
								"default": "stdio",
								examples: [
									"stdio",
									"http",
									"sse"
								]
							},
							command: {
								type: "string",
								description: "Command to start the MCP server (required for stdio type)",
								examples: [
									"node",
									"python",
									"npx"
								]
							},
							args: {
								type: "array",
								description: "Arguments for the server command (stdio only)",
								items: {
									type: "string"
								},
								examples: [
									[
										"${bundlePath}/server.js"
									],
									[
										"${bundlePath}/mcp_server.py"
									],
									[
										"${env:HOME}/.local/bin/my-mcp-server"
									]
								]
							},
							env: {
								type: "object",
								description: "Environment variables for the server (stdio only)",
								additionalProperties: {
									type: "string"
								}
							},
							envFile: {
								type: "string",
								description: "Path to an environment file to load variables from (stdio only)",
								examples: [
									"${workspaceFolder}/.env",
									"${bundlePath}/.env"
								]
							},
							url: {
								type: "string",
								description: "URL for the remote MCP server (required for http/sse types). Supports HTTP/HTTPS URLs, Unix sockets (unix:///path), and Windows named pipes (pipe:///pipe/name)",
								examples: [
									"http://localhost:3000/mcp",
									"https://api.example.com/mcp",
									"unix:///tmp/mcp.sock",
									"pipe:///pipe/mcp-server"
								]
							},
							headers: {
								type: "object",
								description: "HTTP headers for authentication or configuration (http/sse only)",
								additionalProperties: {
									type: "string"
								},
								examples: [
									{
										Authorization: "Bearer ${input:api-token}"
									}
								]
							},
							disabled: {
								type: "boolean",
								description: "Whether the server is disabled",
								"default": false
							}
						},
						allOf: [
							{
								"if": {
									properties: {
										type: {
											"const": "stdio"
										}
									}
								},
								then: {
									required: [
										"command"
									]
								}
							},
							{
								"if": {
									not: {
										properties: {
											type: {
												"const": "stdio"
											}
										}
									},
									required: [
										"type"
									]
								},
								then: {
									required: [
										"url"
									]
								}
							},
							{
								"if": {
									properties: {
										type: {
											"enum": [
												"http",
												"sse"
											]
										}
									},
									required: [
										"type"
									]
								},
								then: {
									required: [
										"url"
									]
								}
							},
							{
								"if": {
									not: {
										required: [
											"type"
										]
									}
								},
								then: {
									required: [
										"command"
									]
								}
							}
						],
						additionalProperties: false
					}
				},
				additionalProperties: false
			}
		},
		additionalProperties: false
	},
	version: {
		type: "string",
		description: "Version of the collection",
		pattern: "^\\d+\\.\\d+\\.\\d+$",
		examples: [
			"1.0.0",
			"2.1.3"
		]
	},
	author: {
		type: "string",
		description: "Author of the collection"
	},
	tags: {
		type: "array",
		description: "Tags for the entire collection",
		items: {
			type: "string"
		}
	},
	display: {
		type: "object",
		description: "Display preferences for the collection",
		properties: {
			color: {
				type: "string",
				description: "Color theme for the collection"
			},
			icon: {
				type: "string",
				description: "Icon identifier for the collection"
			},
			ordering: {
				type: "string",
				description: "How to order items in the collection",
				"enum": [
					"manual",
					"alphabetical"
				]
			},
			show_badge: {
				type: "boolean",
				description: "Whether to show a badge for the collection"
			}
		},
		additionalProperties: false
	}
};
var additionalProperties = false;
var require$$3 = {
	$schema: $schema,
	$id: $id,
	title: title,
	description: description,
	type: type,
	required: required,
	properties: properties,
	additionalProperties: additionalProperties
};

(function (exports) {
	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    var desc = Object.getOwnPropertyDescriptor(m, k);
	    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
	      desc = { enumerable: true, get: function() { return m[k]; } };
	    }
	    Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    o[k2] = m[k];
	}));
	var __setModuleDefault = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
	    Object.defineProperty(o, "default", { enumerable: true, value: v });
	}) : function(o, v) {
	    o["default"] = v;
	});
	var __importStar = (commonjsGlobal && commonjsGlobal.__importStar) || (function () {
	    var ownKeys = function(o) {
	        ownKeys = Object.getOwnPropertyNames || function (o) {
	            var ar = [];
	            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
	            return ar;
	        };
	        return ownKeys(o);
	    };
	    return function (mod) {
	        if (mod && mod.__esModule) return mod;
	        var result = {};
	        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
	        __setModuleDefault(result, mod);
	        return result;
	    };
	})();
	var __exportStar = (commonjsGlobal && commonjsGlobal.__exportStar) || function(m, exports) {
	    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
	};
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.CORE_PACKAGE_READY = exports.COLLECTION_SCHEMA = exports.SCHEMA_DIR = void 0;
	/**
	 * The `@ai-primitives-hub/core` package.
	 *
	 * Domain types and port interfaces, per the migration plan
	 * (.tmp/ai-primitives-hub-next-migration-plan.md §7.3): bundle/collection,
	 * source, install/target (full TargetType union), hub/profile/registry,
	 * primitive/index, and port interfaces for filesystem, HTTP, GitHub API,
	 * clock. Landing incrementally, one bounded context per commit.
	 */
	const path = __importStar(require$$0);
	__exportStar(domain, exports);
	__exportStar(ports, exports);
	/**
	 * Public schema directory path.
	 * This directory contains JSON schemas for validation.
	 */
	exports.SCHEMA_DIR = path.join(__dirname, './public/schemas');
	/**
	 * Collection schema JSON embedded directly in the bundle.
	 * Use this instead of loading from disk to ensure schema is always available
	 * in single-executable applications.
	 */
	var collection_schema_json_1 = require$$3;
	Object.defineProperty(exports, "COLLECTION_SCHEMA", { enumerable: true, get: function () { return __importDefault(collection_schema_json_1).default; } });
	/**
	 * Phase 1 scaffolding marker, kept until `infra`/`app`/`cli` each have real
	 * code of their own to depend on instead of this placeholder re-export
	 * chain (see those packages' `src/index.ts`) — removed in Phase 5 once
	 * `cli` no longer needs it.
	 */
	exports.CORE_PACKAGE_READY = true;
	
} (dist));

/**
 * Skills file generation utilities (file-IO dependent).
 * @module app/collection/generate-skill
 *
 * File-IO dependent skill generation functions.
 * Pure validation functions are in `@ai-primitives-hub/core`'s
 * `domain/skill/validate.ts`.
 *
 * Ported unchanged from the reference branch's
 * `app/src/collection/generate-skill.ts`.
 */
var __createBinding$1 = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault$1 = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar$1 = (commonjsGlobal && commonjsGlobal.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding$1(result, mod, k[i]);
        __setModuleDefault$1(result, mod);
        return result;
    };
})();
Object.defineProperty(generateSkill, "__esModule", { value: true });
generateSkill.validateSkillFolder = validateSkillFolder;
generateSkill.validateAllSkills = validateAllSkills;
generateSkill.generateSkillContent = generateSkillContent;
generateSkill.createSkill = createSkill;
const fs$1 = __importStar$1(require$$0$2);
const path$1 = __importStar$1(require$$0);
const core_1$1 = dist;
/**
 * Validate a single skill folder.
 * @param folderPath
 * @param folderName
 */
function validateSkillFolder(folderPath, folderName) {
    const errors = [];
    let skillName = folderName;
    // Check if SKILL.md exists
    const skillFile = path$1.join(folderPath, 'SKILL.md');
    if (!fs$1.existsSync(skillFile)) {
        return {
            skillName,
            folderName,
            valid: false,
            errors: ['Missing SKILL.md file']
        };
    }
    // Read and parse frontmatter
    const content = fs$1.readFileSync(skillFile, 'utf8');
    const metadata = (0, core_1$1.parseFrontmatter)(content);
    if (!metadata) {
        return {
            skillName,
            folderName,
            valid: false,
            errors: ['Failed to parse SKILL.md frontmatter']
        };
    }
    skillName = metadata.name || folderName;
    // Validate name field
    const nameError = (0, core_1$1.validateSkillName)(metadata.name);
    if (nameError) {
        errors.push(`name: ${nameError}`);
    }
    else if (metadata.name !== folderName) {
        errors.push(`Folder name "${folderName}" does not match skill name "${metadata.name}"`);
    }
    // Validate description field
    const descError = (0, core_1$1.validateSkillDescription)(metadata.description);
    if (descError) {
        errors.push(`description: ${descError}`);
    }
    // Check for reasonable file sizes in bundled assets
    const files = fs$1.readdirSync(folderPath);
    for (const file of files) {
        if (file === 'SKILL.md') {
            continue;
        }
        const filePath = path$1.join(folderPath, file);
        try {
            const stats = fs$1.statSync(filePath);
            if (stats.isFile() && stats.size > core_1$1.MAX_ASSET_SIZE) {
                const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                errors.push(`Bundled asset "${file}" exceeds maximum size of 5MB (${sizeMB}MB)`);
            }
        }
        catch (error) {
            errors.push(`Cannot access bundled asset "${file}": ${error.message}`);
        }
    }
    return {
        skillName,
        folderName,
        valid: errors.length === 0,
        errors
    };
}
/**
 * Validate all skills in a directory.
 * @param repoRoot
 * @param skillsDir
 */
function validateAllSkills(repoRoot, skillsDir = 'skills') {
    const skillsPath = path$1.join(repoRoot, skillsDir);
    if (!fs$1.existsSync(skillsPath)) {
        return {
            valid: true,
            skills: [],
            totalSkills: 0,
            validSkills: 0,
            invalidSkills: 0
        };
    }
    const skillFolders = fs$1.readdirSync(skillsPath).filter((file) => {
        const filePath = path$1.join(skillsPath, file);
        return fs$1.statSync(filePath).isDirectory();
    });
    if (skillFolders.length === 0) {
        return {
            valid: true,
            skills: [],
            totalSkills: 0,
            validSkills: 0,
            invalidSkills: 0
        };
    }
    const results = [];
    const usedNames = new Set();
    let hasErrors = false;
    for (const folder of skillFolders) {
        const folderPath = path$1.join(skillsPath, folder);
        const result = validateSkillFolder(folderPath, folder);
        // Check for duplicate names
        if (result.valid && usedNames.has(result.skillName)) {
            result.valid = false;
            result.errors.push(`Duplicate skill name "${result.skillName}"`);
        }
        else if (result.valid) {
            usedNames.add(result.skillName);
        }
        if (!result.valid) {
            hasErrors = true;
        }
        results.push(result);
    }
    return {
        valid: !hasErrors,
        skills: results,
        totalSkills: results.length,
        validSkills: results.filter((r) => r.valid).length,
        invalidSkills: results.filter((r) => !r.valid).length
    };
}
/**
 * Generate SKILL.md content
 * @param name
 * @param description
 */
function generateSkillContent(name, description) {
    return `---
name: ${name}
description: "${description}"
---

# ${name}

${description}

## Capabilities

Describe what this skill enables Copilot to do.

## Usage

Explain when and how Copilot should use this skill.

## Examples

Provide example interactions or use cases.
`;
}
/**
 * Create a new skill directory structure
 * @param repoRoot
 * @param skillName
 * @param description
 * @param skillsDir
 */
function createSkill(repoRoot, skillName, description, skillsDir = 'skills') {
    // Validate inputs
    const nameError = (0, core_1$1.validateSkillName)(skillName);
    if (nameError) {
        return { success: false, path: '', error: nameError };
    }
    const descError = (0, core_1$1.validateSkillDescription)(description);
    if (descError) {
        return { success: false, path: '', error: descError };
    }
    const skillsPath = path$1.join(repoRoot, skillsDir);
    const skillPath = path$1.join(skillsPath, skillName);
    if (fs$1.existsSync(skillPath)) {
        return { success: false, path: skillPath, error: `Skill "${skillName}" already exists` };
    }
    try {
        // Ensure skills directory exists
        if (!fs$1.existsSync(skillsPath)) {
            fs$1.mkdirSync(skillsPath, { recursive: true });
        }
        // Create skill folder
        fs$1.mkdirSync(skillPath, { recursive: true });
        // Create SKILL.md
        const content = generateSkillContent(skillName, description);
        fs$1.writeFileSync(path$1.join(skillPath, 'SKILL.md'), content);
        return { success: true, path: skillPath };
    }
    catch (error) {
        return { success: false, path: skillPath, error: error.message };
    }
}

var readCollection$1 = {};

var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (commonjsGlobal && commonjsGlobal.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(readCollection$1, "__esModule", { value: true });
readCollection$1.loadItemKindsFromSchema = loadItemKindsFromSchema;
readCollection$1.validateCollectionFile = validateCollectionFile;
readCollection$1.validateAllCollections = validateAllCollections;
readCollection$1.generateMarkdown = generateMarkdown;
readCollection$1.listCollectionFiles = listCollectionFiles;
readCollection$1.readCollection = readCollection;
readCollection$1.writeCollection = writeCollection;
readCollection$1.resolveCollectionItemPaths = resolveCollectionItemPaths;
/**
 * Collection file reading/writing utilities (file-IO dependent).
 * @module app/collection/read-collection
 *
 * File-IO dependent collection reading functions.
 * Pure validation functions are in `@ai-primitives-hub/core`'s
 * `domain/collection/validate.ts`.
 *
 * Ported from the reference branch's `app/src/collection/read-collection.ts`,
 * with one addition: `writeCollection`. The reference branch itself has
 * this function duplicated in a CLI-local `cli/src/collections.ts` (which
 * also re-implements `readCollection`/`listCollectionFiles`/
 * `resolveCollectionItemPaths` verbatim) rather than adding it here —
 * exactly the "two parallel domains" duplication this migration's `app`
 * layer exists to eliminate, so it's added here instead of carried
 * forward as a second copy.
 */
const fs = __importStar(require$$0$2);
const path = __importStar(require$$0);
const core_1 = dist;
const yaml = __importStar(jsYaml);
/**
 * Load valid item kinds from the JSON schema (single source of truth).
 * Falls back to a default list if schema cannot be loaded.
 * @param schemaDir - Directory containing the schema file
 * @returns Array of valid item kinds
 */
function loadItemKindsFromSchema(schemaDir) {
    try {
        const schemaPath = schemaDir
            ? path.join(schemaDir, 'collection.schema.json')
            : path.join(core_1.SCHEMA_DIR, 'collection.schema.json');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse returns any
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Dynamic schema access
        const kinds = schema?.properties?.items?.items?.properties?.kind?.enum;
        if (Array.isArray(kinds) && kinds.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Schema enum is string[]
            return kinds;
        }
    }
    catch {
        // Schema unavailable or malformed, use fallback
    }
    return ['prompt', 'instruction', 'agent', 'skill'];
}
/**
 * Validate a collection file from disk.
 * Checks YAML syntax, required fields, and referenced file existence.
 * @param repoRoot - Repository root path
 * @param collectionFile - Collection file path (absolute or repo-relative)
 * @returns Validation result with parsed collection
 */
function validateCollectionFile(repoRoot, collectionFile) {
    const rel = collectionFile.replace(/\\/g, '/');
    const abs = path.isAbsolute(collectionFile)
        ? collectionFile
        : path.join(repoRoot, collectionFile);
    const errors = [];
    if (!fs.existsSync(abs)) {
        return { ok: false, errors: [`${rel}: Collection file not found`] };
    }
    let collection;
    try {
        collection = yaml.load(fs.readFileSync(abs, 'utf8'));
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, errors: [`${rel}: YAML parse error: ${message}`] };
    }
    const schema = (0, core_1.validateCollectionObject)(collection, rel);
    errors.push(...schema.errors);
    if (Array.isArray(collection?.items)) {
        collection.items.forEach((item, idx) => {
            if (!item?.path || typeof item.path !== 'string') {
                return;
            }
            let relPath;
            try {
                relPath = (0, core_1.normalizeRepoRelativePath)(item.path);
            }
            catch {
                return;
            }
            const itemAbs = path.join(repoRoot, relPath);
            if (!fs.existsSync(itemAbs)) {
                errors.push(`${rel}: items[${idx}] referenced file not found: ${relPath}`);
            }
        });
    }
    return { ok: errors.length === 0, errors, collection };
}
/**
 * Validate all collections in a repository, including duplicate detection.
 * @param repoRoot - Repository root path
 * @param collectionFiles - Array of collection file paths (repo-relative)
 * @returns Validation result
 */
function validateAllCollections(repoRoot, collectionFiles) {
    const errors = [];
    const fileResults = [];
    const seenIds = new Map(); // id -> file path
    const seenNames = new Map(); // name -> file path
    for (const file of collectionFiles) {
        const result = validateCollectionFile(repoRoot, file);
        fileResults.push({ file, ...result });
        errors.push(...result.errors);
        // Check for duplicate IDs and names
        if (result.collection) {
            const { id, name } = result.collection;
            if (id && seenIds.has(id)) {
                errors.push(`${file}: Duplicate collection ID '${id}' (also in ${seenIds.get(id)})`);
            }
            else if (id) {
                seenIds.set(id, file);
            }
            if (name && seenNames.has(name)) {
                errors.push(`${file}: Duplicate collection name '${name}' (also in ${seenNames.get(name)})`);
            }
            else if (name) {
                seenNames.set(name, file);
            }
        }
    }
    return { ok: errors.length === 0, errors, fileResults };
}
/**
 * Generate markdown content for PR comment from validation result.
 * @param result - Result from validateAllCollections
 * @param totalFiles - Total number of collection files
 * @returns Markdown content
 */
function generateMarkdown(result, totalFiles) {
    let md = '## 📋 Collection Validation Results\n\n';
    if (result.ok) {
        md += `✅ **All ${totalFiles} collection(s) validated successfully!**\n`;
    }
    else {
        md += `❌ **Validation failed with ${result.errors.length} error(s)**\n\n`;
        md += '### Errors\n\n';
        result.errors.forEach((err) => {
            md += `- ${err}\n`;
        });
    }
    return md;
}
/**
 * List all collection files in the repository.
 * @param repoRoot - Repository root path
 * @returns Array of collection file paths (repo-relative)
 */
function listCollectionFiles(repoRoot) {
    const collectionsDir = path.join(repoRoot, 'collections');
    return fs
        .readdirSync(collectionsDir)
        .filter((f) => f.endsWith('.collection.yml'))
        .map((f) => path.join('collections', f));
}
/**
 * Read and parse a collection YAML file.
 * @param repoRoot - Repository root path
 * @param collectionFile - Collection file path (absolute or repo-relative)
 * @returns Parsed collection object
 * @throws {Error} if file is invalid YAML or not an object
 */
function readCollection(repoRoot, collectionFile) {
    const abs = path.isAbsolute(collectionFile)
        ? collectionFile
        : path.join(repoRoot, collectionFile);
    const content = fs.readFileSync(abs, 'utf8');
    const collection = yaml.load(content);
    if (!collection || typeof collection !== 'object') {
        throw new Error(`Invalid collection YAML: ${collectionFile}`);
    }
    // Ensure items array is initialized
    if (!collection.items) {
        collection.items = [];
    }
    return collection;
}
/**
 * Write a collection object to a YAML file.
 * @param repoRoot - Repository root path
 * @param collectionFile - Collection file path (absolute or repo-relative)
 * @param collection - Collection object to write
 */
function writeCollection(repoRoot, collectionFile, collection) {
    const abs = path.isAbsolute(collectionFile)
        ? collectionFile
        : path.join(repoRoot, collectionFile);
    const content = yaml.dump(collection, { indent: 2, lineWidth: -1 });
    fs.writeFileSync(abs, content, 'utf8');
}
/**
 * Recursively list all files in a directory.
 * @param dirPath - Absolute path to directory
 * @param basePath - Base path for relative paths
 * @returns Array of repo-relative file paths
 */
function listFilesRecursively(dirPath, basePath) {
    const results = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            results.push(...listFilesRecursively(fullPath, basePath));
        }
        else {
            const relPath = path.relative(basePath, fullPath).replaceAll('\\', '/');
            results.push(relPath);
        }
    }
    return results;
}
/**
 * Resolve all item paths referenced in a collection.
 * For skills, expands the skill directory to include all files.
 * @param repoRoot - Repository root path
 * @param collection - Parsed collection object
 * @returns Array of normalized repo-relative paths
 */
function resolveCollectionItemPaths(repoRoot, collection) {
    const items = Array.isArray(collection.items) ? collection.items : [];
    const allPaths = [];
    for (const item of items) {
        if (!item?.path) {
            continue;
        }
        const normalizedPath = (0, core_1.normalizeRepoRelativePath)(item.path);
        if (item.kind === 'skill') {
            // For skills, the path points to SKILL.md but we need the entire directory
            const skillDir = path.dirname(path.join(repoRoot, normalizedPath));
            if (fs.existsSync(skillDir) && fs.statSync(skillDir).isDirectory()) {
                const skillFiles = listFilesRecursively(skillDir, repoRoot);
                allPaths.push(...skillFiles);
            }
            else {
                // Fallback: just include the path as-is if directory doesn't exist
                allPaths.push(normalizedPath);
            }
        }
        else {
            allPaths.push(normalizedPath);
        }
    }
    return allPaths;
}

(function (exports) {
	/**
	 * Collection use-cases: reading/writing/validating collection YAML files
	 * and generating/validating skill folders.
	 * @module app/collection
	 */
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.writeCollection = exports.validateCollectionFile = exports.validateAllCollections = exports.resolveCollectionItemPaths = exports.readCollection = exports.loadItemKindsFromSchema = exports.listCollectionFiles = exports.generateMarkdown = exports.validateSkillFolder = exports.validateAllSkills = exports.generateSkillContent = exports.createSkill = void 0;
	var generate_skill_1 = generateSkill;
	Object.defineProperty(exports, "createSkill", { enumerable: true, get: function () { return generate_skill_1.createSkill; } });
	Object.defineProperty(exports, "generateSkillContent", { enumerable: true, get: function () { return generate_skill_1.generateSkillContent; } });
	Object.defineProperty(exports, "validateAllSkills", { enumerable: true, get: function () { return generate_skill_1.validateAllSkills; } });
	Object.defineProperty(exports, "validateSkillFolder", { enumerable: true, get: function () { return generate_skill_1.validateSkillFolder; } });
	var read_collection_1 = readCollection$1;
	Object.defineProperty(exports, "generateMarkdown", { enumerable: true, get: function () { return read_collection_1.generateMarkdown; } });
	Object.defineProperty(exports, "listCollectionFiles", { enumerable: true, get: function () { return read_collection_1.listCollectionFiles; } });
	Object.defineProperty(exports, "loadItemKindsFromSchema", { enumerable: true, get: function () { return read_collection_1.loadItemKindsFromSchema; } });
	Object.defineProperty(exports, "readCollection", { enumerable: true, get: function () { return read_collection_1.readCollection; } });
	Object.defineProperty(exports, "resolveCollectionItemPaths", { enumerable: true, get: function () { return read_collection_1.resolveCollectionItemPaths; } });
	Object.defineProperty(exports, "validateAllCollections", { enumerable: true, get: function () { return read_collection_1.validateAllCollections; } });
	Object.defineProperty(exports, "validateCollectionFile", { enumerable: true, get: function () { return read_collection_1.validateCollectionFile; } });
	Object.defineProperty(exports, "writeCollection", { enumerable: true, get: function () { return read_collection_1.writeCollection; } });
	
} (collection));

/**
 * Collection Validation GitHub Action
 *
 * Delegates to the shared `@ai-primitives-hub/app` validation logic so the
 * action and the CLI always behave identically.
 */


// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

/**
 * Main validation function
 */
function main() {
    console.log(`${colors.cyan}${colors.bold}📋 Collection Validation${colors.reset}\n`);

    const projectRoot = process.cwd();
    let files;
    try {
        files = collection.listCollectionFiles(projectRoot);
    } catch (error) {
        console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
        process.exit(1);
    }

    if (files.length === 0) {
        console.log(`${colors.yellow}⚠️  No collection files found in collections/${colors.reset}`);
        process.exit(0);
    }

    console.log(`Found ${files.length} collection(s)\n`);

    const result = collection.validateAllCollections(projectRoot, files);
    let validCollections = 0;

    for (const fileResult of result.fileResults) {
        console.log(`Validating: ${colors.bold}${fileResult.file}${colors.reset}`);
        if (fileResult.ok) {
            console.log(`  ${colors.green}✓ Valid${colors.reset}`);
            validCollections++;
        } else {
            for (const err of fileResult.errors) {
                console.log(`  ${colors.red}✗ Error: ${err}${colors.reset}`);
            }
        }
        console.log('');
    }

    const totalErrors = result.errors.length;
    console.log('='.repeat(60));
    console.log(`Summary: ${validCollections}/${files.length} collections valid`);
    if (totalErrors > 0) {
        console.log(`${colors.red}Total Errors: ${totalErrors}${colors.reset}`);
    } else {
        console.log(`${colors.green}Total Errors: ${totalErrors}${colors.reset}`);
    }
    console.log('='.repeat(60));

    if (!result.ok) {
        console.log(`\n${colors.red}❌ Validation failed${colors.reset}`);
        process.exit(1);
    }

    console.log(`\n${colors.green}✅ All collections valid!${colors.reset}`);
    process.exit(0);
}

main();
//# sourceMappingURL=index.cjs.map
