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

// Preset configurations
const presets = {
  2: { roles: ['member_1', 'member_2'], description: 'Flat (Member_1 + Member_2)' },
  3: { roles: ['leader', 'member_1', 'member_2'], description: 'Leader + 2 Members' },
  4: { roles: ['officer', 'leader', 'member_1', 'member_2'], description: 'Full hierarchy (Officer + Leader + 2 Members)' },
  5: { roles: ['officer', 'leader', 'member_1', 'member_2', 'member_3'], description: 'Officer + Leader + 3 Members' },
  6: { roles: ['officer', 'leader', 'member_1', 'member_2', 'member_3', 'member_4'], description: 'Officer + Leader + 4 Members' }
};

// Get the directory where this script is located
const scriptDir = path.dirname(__filename);
const templatesDir = path.join(scriptDir, '..', 'templates');
const targetDir = process.cwd();

// Configuration state
let config = {
  terminalCount: 3,
  roles: ['leader', 'member_1', 'member_2'],
  autoSplit: false
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
      terminalCount: 3,
      roles: presets[3].roles,
      autoSplit: false
    };
    return;
  }

  const rl = createReadlineInterface();

  try {
    log('cyan', '');
    log('cyan', '=== Configuration ===');
    log('cyan', '');

    // Show available presets
    log('blue', 'Available configurations:');
    Object.entries(presets).forEach(([count, preset]) => {
      log('blue', `  ${count} terminals: ${preset.description}`);
    });
    log('blue', '');

    // Get terminal count
    const countAnswer = await question(rl, `Number of terminals [2-6] (default: 3): `);
    const count = parseInt(countAnswer) || 3;
    config.terminalCount = Math.max(2, Math.min(6, count));

    // Use preset or ask for custom roles
    const preset = presets[config.terminalCount];
    if (preset) {
      log('green', `Using preset: ${preset.description}`);
      config.roles = [...preset.roles];
    } else {
      // Custom roles for edge cases
      config.roles = [];
      for (let i = 0; i < config.terminalCount; i++) {
        const roleAnswer = await question(rl, `Role for Pane ${i}: `);
        config.roles.push(roleAnswer || `pane_${i}`);
      }
    }

    // Ask about auto-split
    const splitAnswer = await question(rl, 'Auto-split terminals via Extension? (y/N): ');
    config.autoSplit = splitAnswer.toLowerCase() === 'y';

    log('cyan', '');
    log('green', 'Configuration complete!');
    log('green', `  Terminals: ${config.terminalCount}`);
    log('green', `  Roles: ${config.roles.join(', ')}`);
    log('green', `  Auto-split: ${config.autoSplit ? 'Yes' : 'No'}`);
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
    log('blue', '  Would generate role-specific files');
    return;
  }

  // Ensure all required directories exist
  const inboxDir = path.join(targetDir, 'relay', 'inbox');
  const toDir = path.join(targetDir, 'relay', 'to');
  const fromDir = path.join(targetDir, 'relay', 'from');
  const instructionsDir = path.join(targetDir, 'instructions');

  [inboxDir, toDir, fromDir, instructionsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log('green', `  Created directory: ${dir}`);
    }
  });

  // Generate inbox files for each role
  config.roles.forEach(role => {
    const inboxFile = path.join(inboxDir, `${role}.yaml`);
    if (!fs.existsSync(inboxFile)) {
      fs.writeFileSync(inboxFile, `# Inbox for ${role}\nmessages: []\n`);
      log('green', `  Created: ${inboxFile}`);
    }
  });

  // Generate to/from files
  config.roles.forEach(role => {
    // to/ files (except officer who doesn't receive tasks)
    if (role !== 'officer') {
      const toFile = path.join(toDir, `${role}.yaml`);
      if (!fs.existsSync(toFile)) {
        fs.writeFileSync(toFile, `# Messages for ${role}\nmessages:\n`);
        log('green', `  Created: ${toFile}`);
      }
    }

    // from/ files (except officer who doesn't report)
    if (role !== 'officer') {
      const fromFile = path.join(fromDir, `${role}.yaml`);
      if (!fs.existsSync(fromFile)) {
        fs.writeFileSync(fromFile, `# Reports from ${role}\nmessages:\n`);
        log('green', `  Created: ${fromFile}`);
      }
    }
  });

  // Generate instruction files
  config.roles.forEach(role => {
    const instructionFile = path.join(instructionsDir, `${role}.md`);
    if (!fs.existsSync(instructionFile)) {
      const template = generateInstructionTemplate(role);
      fs.writeFileSync(instructionFile, template);
      log('green', `  Created: ${instructionFile}`);
    }
  });

  // Generate config file
  const configFile = path.join(targetDir, '.relay-config.json');
  fs.writeFileSync(configFile, JSON.stringify({
    terminalCount: config.terminalCount,
    roles: config.roles,
    createdAt: new Date().toISOString()
  }, null, 2));
  log('green', `  Created: ${configFile}`);
}

function generateInstructionTemplate(role) {
  const isOfficer = role === 'officer';
  const isLeader = role === 'leader';
  const isMember = role.startsWith('member_');

  let template = `# ${role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')} 指示書\n\n`;
  template += `あなたは **${role}** です。\n\n`;
  template += `## ターミナル位置\n\n`;
  template += `- ペインインデックス: ${config.roles.indexOf(role)}\n\n`;

  if (isOfficer) {
    template += `## 役割\n\n- ユーザー（人間）からリクエストを受け取る\n- タスクを Leader に割り当てる\n- 最終統合とユーザーへの報告\n\n`;
    template += `## 通信方法\n\n### Leader への送信\n\`\`\`bash\n./scripts/to_write.sh relay/to/leader.yaml ${role} "タスク内容" task\n./scripts/inbox_write.sh relay/inbox/leader.yaml ${role} new_task relay/to/leader.yaml "タスク通知"\n\`\`\`\n`;
  } else if (isLeader) {
    template += `## 役割\n\n- タスクをサブタスクに分解\n- Members に割り当て\n- 成果を統合して Officer に報告\n\n`;
    template += `## 通信方法\n\n### Member への送信\n\`\`\`bash\n./scripts/to_write.sh relay/to/member_1.yaml ${role} "サブタスク" task\n./scripts/inbox_write.sh relay/inbox/member_1.yaml ${role} subtask relay/to/member_1.yaml "通知"\n\`\`\`\n\n### Officer への報告\n\`\`\`bash\n./scripts/from_write.sh relay/from/leader.yaml completed "完了報告"\n./scripts/inbox_write.sh relay/inbox/officer.yaml ${role} report relay/from/leader.yaml "完了"\n\`\`\`\n`;
  } else {
    template += `## 役割\n\n- 実装・テスト実行\n- Leader に進捗報告\n\n`;
    template += `## 通信方法\n\n### Leader への報告\n\`\`\`bash\n./scripts/from_write.sh relay/from/${role}.yaml completed "完了報告"\n./scripts/inbox_write.sh relay/inbox/leader.yaml ${role} report relay/from/${role}.yaml "完了"\n\`\`\`\n`;
  }

  return template;
}

function triggerAutoSplit() {
  if (!config.autoSplit || dryRun) return;

  const http = require('http');

  log('blue', 'Triggering auto-split via Extension...');

  const rolesParam = config.roles.join(',');
  const req = http.request({
    hostname: 'localhost',
    port: 3773,
    path: `/setup?count=${config.terminalCount}&roles=${encodeURIComponent(rolesParam)}`,
    method: 'GET',
    timeout: 5000
  }, (res) => {
    log('green', '  Auto-split triggered successfully');
  });

  req.on('error', () => {
    log('yellow', '  Could not trigger auto-split (Extension not responding)');
    log('yellow', '  You can manually split terminals in VS Code');
  });

  req.on('timeout', () => {
    req.destroy();
    log('yellow', '  Auto-split timeout');
  });

  req.end();
}

function printNextSteps() {
  log('green', '');
  log('green', '========================================');
  log('green', '  Next Steps');
  log('green', '========================================');
  log('green', '');
  log('blue', '1. Start the file watchers:');
  log('blue', '   relay-start');
  log('blue', '');

  if (!config.autoSplit) {
    log('blue', '2. Split terminal into panes:');
    log('blue', '   Cmd+\\ (multiple times) or Terminal > Split Terminal');
    log('blue', '');
  } else {
    log('blue', '2. Terminals will be auto-split via Extension');
    log('blue', '');
  }

  log('blue', `${config.autoSplit ? '3' : '3'}. Start Claude Code in each pane:`);
  config.roles.forEach((role, i) => {
    const model = role === 'officer' || role === 'leader' ? 'opus' : 'sonnet';
    log('blue', `   Pane ${i}: claude --model ${model}    # ${role}`);
  });
  log('blue', '');

  log('blue', '4. Each agent reads its instruction file:');
  config.roles.forEach(role => {
    log('blue', `   ${role}: instructions/${role}.md`);
  });
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

  // Copy base template files
  log('green', 'Copying template files...');
  const filesToCopy = [
    { src: 'relay', dest: 'relay' },
    { src: 'instructions', dest: 'instructions' },
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
  }, (res) => {
    log('green', '  Extension server is running on port 3773');
    triggerAutoSplit();
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
