#!/usr/bin/env node

function parseArgs() {
  return process.argv.slice(2);
}

function executeCommand(args) {
  if (args.length === 0) {
    console.log("No command provided.");
    return;
  }
  const [command, ...rest] = args;
  console.log(`Executing ${command} with args: ${rest.join(", ")}`);
}

function main() {
  const args = parseArgs();
  executeCommand(args);
}

main();
