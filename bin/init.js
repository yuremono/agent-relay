#!/usr/bin/env node

/**
 * Agent Relay System - Project Initializer
 *
 * Usage: relay-init [options]
 *
 * Options:
 *   --dry-run    Show what would be done without making changes
 *   --force      Overwrite existing files
 *   --non-interactive   Use default configuration (3 terminals)
 *   --help       Show this help message
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const showHelp = args.includes('--help');
const nonInteractive = args.includes('--non-interactive') || args.includes('-y');

if (showHelp) {
  console.log(`
Agent Relay System - Project Initializer

Usage: relay-init [options]

Options:
  --dry-run           Show what would be done without making changes
  --force             Overwrite existing files
  --non-interactive   Use default configuration without prompting
  --help              Show this help message

Description:
  Initializes the current directory with the multi-agent system structure.
  Prompts for terminal count and role configuration.

  Also checks for the Terminal Relay VS Code extension.
`);
  process.exit(0);
}

// Colors for output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Get the directory where this script is located
const scriptDir = path.dirname(__filename);
const templatesDir = path.join(scriptDir, '..', 'templates');
const targetDir = process.cwd();

// Configuration state (firstPaneIsLeader only, roles are determined at startup)
let config = {
  firstPaneIsLeader: true
};

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function collectConfiguration() {
  if (nonInteractive) {
    config = {
      firstPaneIsLeader: true
    };
    return;
  }

  const rl = createReadlineInterface();

  try {
    log('cyan', '');
    log('cyan', '=== Configuration ===');
    log('cyan', '');

    // Ask if first pane is leader
    const leaderAnswer = await question(rl, `Pane 0 を leader にしますか？ (Y/n): `);
    config.firstPaneIsLeader = leaderAnswer.toLowerCase() !== 'n';

    log('cyan', '');
    log('green', 'Configuration complete!');
    log('green', `  First pane is leader: ${config.firstPaneIsLeader ? 'Yes' : 'No'}`);
    log('green', `  Roles will be assigned automatically based on terminal count`);
    log('cyan', '');

  } finally {
    rl.close();
  }
}

function copyRecursive(src, dest, options = {}) {
  const { dryRun = false, force = false } = options;

  if (!fs.existsSync(src)) {
    log('red', `  Source not found: ${src}`);
    return false;
  }

  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      if (dryRun) {
        log('blue', `  Would create directory: ${dest}`);
      } else {
        fs.mkdirSync(dest, { recursive: true });
        log('green', `  Created directory: ${dest}`);
      }
    } else {
      log('yellow', `  Directory exists: ${dest}`);
    }

    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(
        path.join(src, entry),
        path.join(dest, entry),
        options
      );
    }
  } else {
    if (fs.existsSync(dest) && !force) {
      log('yellow', `  File exists (skip): ${dest}`);
      return true;
    }

    if (dryRun) {
      log('blue', `  Would copy: ${src} -> ${dest}`);
    } else {
      fs.copyFileSync(src, dest);
      log('green', `  Copied: ${dest}`);
    }
  }

  return true;
}

function createGitkeep(dir) {
  const gitkeep = path.join(dir, '.gitkeep');
  if (!fs.existsSync(gitkeep)) {
    if (dryRun) {
      log('blue', `  Would create: ${gitkeep}`);
    } else {
      fs.writeFileSync(gitkeep, '');
      log('green', `  Created: ${gitkeep}`);
    }
  }
}

function generateRoleFiles() {
  if (dryRun) {
    log('blue', '  Would generate config file');
    return;
  }

  // Copy instruction files (leader.md and member.md only)
  const instructionsDir = path.join(targetDir, 'instructions');
  if (!fs.existsSync(instructionsDir)) {
    fs.mkdirSync(instructionsDir, { recursive: true });
    log('green', `  Created directory: ${instructionsDir}`);
  }

  // Copy leader.md and member.md from templates
  ['leader.md', 'member.md'].forEach(file => {
    const srcPath = path.join(templatesDir, 'instructions', file);
    const destPath = path.join(instructionsDir, file);
    if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
      log('green', `  Created: ${destPath}`);
    }
  });

  // Generate config file (firstPaneIsLeader only, roles are determined at startup)
  const configFile = path.join(targetDir, '.relay-config.json');
  fs.writeFileSync(configFile, JSON.stringify({
    firstPaneIsLeader: config.firstPaneIsLeader,
    createdAt: new Date().toISOString()
  }, null, 2));
  log('green', `  Created: ${configFile}`);
}

function printNextSteps() {
  log('green', '');
  log('green', '========================================');
  log('green', '  Next Steps');
  log('green', '========================================');
  log('green', '');
  log('blue', '1. Install the Extension (if not done):');
  log('blue', '   code --install-extension terminal-relay-0.0.1.vsix');
  log('blue', '   Then reload VS Code/Cursor');
  log('blue', '');

  log('blue', '2. Start the file watchers:');
  log('blue', '   relay-start');
  log('blue', '');

  log('blue', '3. Check each pane for role assignment:');
  log('blue', '   (relay-start will display roles in each terminal)');
  log('blue', '');

  log('blue', '4. Instruct each Claude Code:');
  log('blue', '   "instructions/<role>.md を読んでください。"');
  log('blue', '');

  log('blue', '5. Communication commands:');
  log('blue', '   Send task:   ./scripts/to_write.sh relay/to/<role>.yaml <from> "message"');
  log('blue', '   Send report: ./scripts/from_write.sh relay/from/<role>.yaml <status> "message"');
  log('blue', '   Check inbox: ./scripts/check_pending.sh relay/to/<role>.yaml');
  log('blue', '');
  log('green', `Ready! Configuration saved to .relay-config.json`);
  log('green', '');
}

async function main() {
  log('green', '');
  log('green', '========================================');
  log('green', '  Agent Relay System Initializer');
  log('green', '========================================');
  log('green', '');

  if (dryRun) {
    log('yellow', 'DRY RUN - No files will be modified');
    log('yellow', '');
  }

  // Collect configuration
  await collectConfiguration();

  log('blue', `Target directory: ${targetDir}`);
  log('blue', `Templates directory: ${templatesDir}`);
  log('blue', '');

  // Check templates directory
  if (!fs.existsSync(templatesDir)) {
    log('red', 'Error: Templates directory not found!');
    log('red', 'Make sure you are running relay-init from the installed package.');
    process.exit(1);
  }

  // Copy base template files (relay and scripts)
  // instructions are copied separately in generateRoleFiles
  log('green', 'Copying template files...');
  const filesToCopy = [
    { src: 'relay', dest: 'relay' },
    { src: 'scripts', dest: 'scripts' }
  ];

  for (const item of filesToCopy) {
    const srcPath = path.join(templatesDir, item.src);
    const destPath = path.join(targetDir, item.dest);
    copyRecursive(srcPath, destPath, { dryRun, force });
  }

  // Create additional directories
  log('green', '');
  log('green', 'Creating additional directories...');
  const dirsToCreate = ['logs', path.join('relay', 'archive')];
  for (const dir of dirsToCreate) {
    const dirPath = path.join(targetDir, dir);
    if (!fs.existsSync(dirPath)) {
      if (dryRun) {
        log('blue', `  Would create directory: ${dirPath}`);
      } else {
        fs.mkdirSync(dirPath, { recursive: true });
        log('green', `  Created directory: ${dirPath}`);
      }
    } else {
      log('yellow', `  Directory exists: ${dirPath}`);
    }
    createGitkeep(dirPath);
  }

  // Generate role-specific files
  log('green', '');
  log('green', 'Generating role-specific files...');
  generateRoleFiles();

  // Copy Extension VSIX file
  log('green', '');
  log('green', 'Copying Extension VSIX...');
  const extensionDir = path.join(scriptDir, '..', 'extension');
  const vsixFiles = fs.readdirSync(extensionDir).filter(f => f.endsWith('.vsix'));
  if (vsixFiles.length > 0) {
    for (const vsixFile of vsixFiles) {
      const srcVsix = path.join(extensionDir, vsixFile);
      const destVsix = path.join(targetDir, vsixFile);
      if (fs.existsSync(destVsix) && !force) {
        log('yellow', `  VSIX exists (skip): ${destVsix}`);
      } else {
        if (dryRun) {
          log('blue', `  Would copy: ${srcVsix} -> ${destVsix}`);
        } else {
          fs.copyFileSync(srcVsix, destVsix);
          log('green', `  Copied: ${destVsix}`);
        }
      }
    }
    log('cyan', '');
    log('cyan', '  To install the Extension, run:');
    log('cyan', `    code --install-extension ${vsixFiles[0]}`);
    log('cyan', '  Or in VS Code/Cursor:');
    log('cyan', '    Cmd+Shift+P → Extensions: Install from VSIX...');
    log('cyan', '');
  } else {
    log('yellow', '  No VSIX file found. Build it with: npm run package:extension');
  }

  // Copy CLAUDE_SAMPLE.md
  log('green', '');
  log('green', 'Copying CLAUDE_SAMPLE.md...');
  const sampleFile = path.join(scriptDir, '..', 'CLAUDE_SAMPLE.md');
  const destSample = path.join(targetDir, 'CLAUDE_SAMPLE.md');
  if (fs.existsSync(sampleFile)) {
    if (fs.existsSync(destSample) && !force) {
      log('yellow', `  File exists (skip): ${destSample}`);
    } else {
      if (dryRun) {
        log('blue', `  Would copy: ${sampleFile} -> ${destSample}`);
      } else {
        fs.copyFileSync(sampleFile, destSample);
        log('green', `  Copied: ${destSample}`);
      }
    }
  } else {
    log('yellow', '  CLAUDE_SAMPLE.md not found in package');
  }

  // Check for Extension
  log('green', '');
  log('green', 'Checking Terminal Relay Extension...');
  const http = require('http');

  const req = http.request({
    hostname: 'localhost',
    port: 3773,
    path: '/',
    method: 'GET',
    timeout: 2000
  }, () => {
    log('green', '  Extension server is running on port 3773');
    printNextSteps();
  });

  req.on('error', () => {
    log('yellow', '  Extension server not responding on port 3773');
    log('yellow', '  Please install and activate the Terminal Relay extension:');
    log('yellow', '    1. Open VS Code/Cursor');
    log('yellow', '    2. Press Cmd+Shift+P (or Ctrl+Shift+P)');
    log('yellow', '    3. Type "Extensions: Install from VSIX..."');
    log('yellow', '    4. Select the agent-relay-extension.vsix file');
    log('yellow', '    5. Reload VS Code/Cursor');
    printNextSteps();
  });

  req.on('timeout', () => {
    req.destroy();
    log('yellow', '  Extension server not responding on port 3773');
    printNextSteps();
  });

  req.end();
}

main();
