/**
 * ESLint rule to enforce public API architectural invariants (Phase 1 / Step 1.9).
 *
 * Enforces that the public API does not import from internal implementation layers:
 * - No imports from lib/src/cli/ (CLI is internal, not part of public API)
 * - No imports from lib/src/app/ (application use cases are internal)
 * - No imports from lib/src/infra/ (infrastructure implementations are internal)
 *
 * Rule: `no-cli-imports-in-public`
 * - Files under `lib/src/public/` may not import from cli, app, infra
 * - This ensures the public API remains a clean boundary
 *
 * Phase 2E: Updated for new structure after Phase 2A-2C refactoring.
 */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce public API does not import from internal implementation layers',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noCliImport: 'Public API may not import from lib/src/cli/ (CLI is internal implementation).',
      noAppImport: 'Public API may not import from lib/src/app/ (application use cases are internal).',
      noInfraImport: 'Public API may not import from lib/src/infra/ (infrastructure implementations are internal).',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename;
    const isPublicFile = filename.includes('/lib/src/public/');

    // Only enforce in public files
    if (!isPublicFile) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        // Check for imports from internal layers
        if (source.startsWith('../cli/') || source.startsWith('./cli/')) {
          context.report({
            node,
            messageId: 'noCliImport',
            data: { source },
          });
        }

        if (source.startsWith('../app/') || source.startsWith('./app/')) {
          context.report({
            node,
            messageId: 'noAppImport',
            data: { source },
          });
        }

        if (source.startsWith('../infra/') || source.startsWith('./infra/')) {
          context.report({
            node,
            messageId: 'noInfraImport',
            data: { source },
          });
        }
      },
    };
  },
};

export default rule;
