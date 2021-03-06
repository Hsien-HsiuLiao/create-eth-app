import chalk from "chalk";
import fs from "fs";
import makeDir from "make-dir";
import path from "path";

import {
  FrameworkKey,
  downloadAndExtractFrameworkHandlebars,
  hasFramework,
  hasFrameworkHandlebars,
} from "./helpers/frameworks";
import {
  TemplateKey,
  downloadAndExtractTemplate,
  hasTemplate,
  parseTemplate,
  registerHandlebarsHelpers,
} from "./helpers/templates";
import { getOnline } from "./helpers/networking";
import { install } from "./helpers/install";
import { isFolderEmpty } from "./helpers/isFolderEmpty";
import { shouldUseYarn, shouldUseYarnWorkspaces } from "./helpers/yarn";
import { throwFrameworkNotFoundError, throwTemplateNotFoundError } from "./helpers/errors";
import { tryGitInit } from "./helpers/git";

export async function createEthApp({
  appPath,
  framework,
  template,
}: {
  appPath: string;
  framework?: string;
  template?: string;
}) {
  if (framework) {
    const foundFramework: boolean = await hasFramework(framework);
    const foundFrameworkHandlebars: boolean = await hasFrameworkHandlebars(framework);

    if (!foundFramework || !foundFrameworkHandlebars) {
      throwFrameworkNotFoundError(framework);
    }
  } else {
    framework = "react";
  }

  if (template) {
    if (template === "sablier") {
      template = "sablier-v1";
    }
    if (template === "uniswap") {
      template = "uniswap-v2";
    }
    const found = await hasTemplate(framework, template);

    if (!found) {
      throwTemplateNotFoundError(template);
    }
  } else {
    template = "default";
  }

  const root: string = path.resolve(appPath);
  const appName: string = path.basename(root);

  await makeDir(root);
  if (!isFolderEmpty(root, appName)) {
    process.exit(1);
  }

  shouldUseYarn();
  shouldUseYarnWorkspaces();
  const isOnline: boolean = await getOnline();
  const originalDirectory: string = process.cwd();

  console.log();
  console.log(
    `Creating a new Ethereum-powered ${framework.charAt(0).toUpperCase() + framework.slice(1)} app in ${chalk.green(
      root,
    )}.`,
  );
  console.log();

  await makeDir(root);
  process.chdir(root);

  if (template === "default") {
    console.log("Downloading template files. This might take a moment.");
  } else {
    console.log(`Downloading files for template ${chalk.cyan(template)}. This might take a moment.`);
  }

  console.log();
  registerHandlebarsHelpers();
  await downloadAndExtractFrameworkHandlebars(root, framework);
  await parseTemplate(appPath, framework as FrameworkKey, template as TemplateKey);

  /* Copy our default `.gitignore` if the application did not provide one */
  const ignorePath = path.join(root, ".gitignore");
  if (!fs.existsSync(ignorePath)) {
    fs.copyFileSync(path.join(__dirname, "gitignore"), ignorePath);
  }

  console.log("Installing packages. This might take a couple of minutes.");
  console.log();

  await install(root, null, { isOnline });
  console.log();

  if (tryGitInit(root)) {
    console.log("Initialized a git repository.");
    console.log();
  }

  let cdPath: string;
  if (path.join(originalDirectory, appName) === appPath) {
    cdPath = appName;
  } else {
    cdPath = appPath;
  }

  console.log(`${chalk.green("Success!")} Created ${appName} at ${appPath}`);
  console.log("Inside that directory, you can run several commands:");

  const reactAppPath = path.join(root, "packages", "react-app");
  if (fs.existsSync(reactAppPath)) {
    console.log();
    console.log(chalk.cyan("  yarn react-app:start"));
    console.log("    Starts the development server.");
    console.log();
    console.log(chalk.cyan("  yarn react-app:build"));
    console.log("    Builds the app for production.");
    console.log();
  }

  const vueAppPath = path.join(root, "packages", "vue-app");
  if (fs.existsSync(vueAppPath)) {
    console.log();
    console.log(chalk.cyan("  yarn vue-app:serve"));
    console.log("    Starts the development server.");
    console.log();
    console.log(chalk.cyan("  yarn vue-app:build"));
    console.log("    Builds the app for production.");
    console.log();
  }

  const subgraphPath = path.join(root, "packages", "subgraph");
  if (fs.existsSync(subgraphPath)) {
    console.log(chalk.cyan("  yarn subgraph:codegen"));
    console.log("    Generates AssemblyScript types for smart contract ABIs and the subgraph schema.");
    console.log();
    console.log(chalk.cyan("  yarn subgraph:deploy"));
    console.log("    Deploys the subgraph to the official Graph Node.");
    console.log();
  }

  console.log("We suggest that you begin by typing:");
  console.log();
  console.log(chalk.cyan("  cd"), cdPath);
  if (fs.existsSync(reactAppPath)) {
    console.log(`  ${chalk.cyan("yarn react-app:start")}`);
  } else if (fs.existsSync(vueAppPath)) {
    console.log(`  ${chalk.cyan("yarn vue-app:serve")}`);
  }
  console.log();
}
