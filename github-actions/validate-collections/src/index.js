#!/usr/bin/env node
/**
 * Collection Validation GitHub Action
 *
 * Delegates to the shared `@ai-primitives-hub/app` validation logic so the
 * action and the CLI always behave identically.
 */

import {
    listCollectionFiles,
    validateAllCollections,
} from '@ai-primitives-hub/app/dist/collection/index.js';

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
        files = listCollectionFiles(projectRoot);
    } catch (error) {
        console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
        process.exit(1);
    }

    if (files.length === 0) {
        console.log(`${colors.yellow}⚠️  No collection files found in collections/${colors.reset}`);
        process.exit(0);
    }

    console.log(`Found ${files.length} collection(s)\n`);

    const result = validateAllCollections(projectRoot, files);
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